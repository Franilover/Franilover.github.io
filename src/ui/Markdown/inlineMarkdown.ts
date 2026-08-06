/**
 * inlineMarkdown
 * ───────────────────────────────────────────────────────────────────────────
 * Única fuente de verdad para el parser regex→HTML de markdown inline
 * (**bold**, *italic*, `code`, ~~strike~~, ==mark==, [[wikilinks]] opcional).
 *
 * Antes existían dos copias casi idénticas de este parser:
 *   - applyInlineMarkdown en domains/garlia/libros/public/ContenidoInteractivo.tsx
 *   - applyInlinePlainMarkdown en editor/lexical/PlainMarkdownPreview.tsx
 * Cualquier fix de seguridad había que aplicarlo dos veces. Se consolidan
 * acá con una sola función parametrizada por `withWikilinks`.
 *
 * Defensa en profundidad: además del escape manual de &<> que ya hacía el
 * parser, el HTML resultante pasa por DOMPurify.sanitize() antes de usarse
 * en dangerouslySetInnerHTML (ver toSafeHtml). Así, si el regex tuviera un
 * bug futuro (p.ej. una regla nueva mal escrita que abra XSS), DOMPurify
 * actúa como red de seguridad independiente del parser.
 *
 * IMPORTANTE: requiere la dependencia "dompurify" (y sus tipos) instalada
 * en el proyecto: `npm install dompurify @types/dompurify`.
 */
import DOMPurify from "dompurify";

export interface InlineMarkdownOptions {
  /** Habilita el parseo de [[wikilink]] / [[wikilink|alias]]. */
  withWikilinks?: boolean;
}

/**
 * Convierte una línea de texto plano en HTML aplicando las reglas de
 * markdown inline soportadas. Escapa &<> primero para que el input nunca
 * pueda inyectar HTML crudo, sin importar qué reglas se agreguen después.
 *
 * No usar el resultado directamente en dangerouslySetInnerHTML — pasarlo
 * primero por toSafeHtml() (o usar renderInlineMarkdownSafe más abajo).
 */
export function applyInlineMarkdown(
  text: string,
  options: InlineMarkdownOptions = {},
): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  if (options.withWikilinks) {
    html = html.replace(
      /\[\[([^\]|#]+?)(?:\|([^\]]+))?\]\]/g,
      (_, target: string, alias?: string) => {
        const label = (alias?.trim() || target.trim()).replace(/"/g, "&quot;");
        const safeTarget = target.trim().replace(/"/g, "&quot;");
        return `<a class="wikilink" data-wikilink="${safeTarget}" href="javascript:void(0)" title="Ir a: ${safeTarget}">${label}</a>`;
      },
    );
  }

  return html
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/==(.+?)==/g, '<mark class="md-mark">$1</mark>');
}

// Config de DOMPurify: solo las etiquetas/atributos que el parser puede
// producir. Todo lo demás (scripts, on*, iframes, etc.) queda fuera aunque
// el regex de arriba algún día lo generara por error.
const PURIFY_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: ["strong", "em", "code", "del", "mark", "a", "br"],
  ALLOWED_ATTR: ["class", "href", "title", "data-wikilink"],
  // Bloquea cualquier esquema de URL que no sea http(s), mailto o el
  // javascript:void(0) fijo que usamos para wikilinks — nunca javascript:
  // arbitrario ni data:.
  ALLOWED_URI_REGEXP: /^(?:javascript:void\(0\)|https?:|mailto:)/i,
};

/**
 * Sanitiza HTML ya generado por applyInlineMarkdown. Red de seguridad
 * final, independiente del parser — usar siempre antes de
 * dangerouslySetInnerHTML.
 */
export function toSafeHtml(html: string): string {
  return DOMPurify.sanitize(html, PURIFY_CONFIG) as unknown as string;
}

/**
 * Atajo: parsea y sanitiza en un solo paso. Es lo que deberían usar la
 * mayoría de los consumidores.
 */
export function renderInlineMarkdownSafe(
  text: string,
  options: InlineMarkdownOptions = {},
): string {
  return toSafeHtml(applyInlineMarkdown(text, options));
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloques de nivel superior compartidos: código (```) y separador (---).
// Antes cada renderer de lectura (TextoMarkdown en ContenidoInteractivo.tsx,
// PlainMarkdownPreview.tsx) partía el texto en párrafos con su propio
// value.split(/\n{2,}/) y no reconocía ninguno de los dos — un ``` o un ---
// se mostraba como texto plano. Se consolida acá el reconocimiento de
// bloques para que ambos renderers los soporten sin duplicar la lógica,
// igual que ya se hizo con el parser inline arriba.
export type MarkdownBlock =
  | { type: "code"; lang: string; code: string }
  | { type: "hr" }
  | { type: "text"; raw: string };

/**
 * Parte un documento markdown en bloques de nivel superior, reconociendo
 * ```code``` y --- antes de caer al criterio de párrafo por defecto (línea
 * en blanco separa párrafos). El contenido de cada bloque "text" conserva
 * el criterio previo de líneas — el consumidor decide cómo renderizarlo
 * (heading, párrafo, etc.), esta función solo aísla code/hr del resto.
 */
export function splitMarkdownBlocks(value: string): MarkdownBlock[] {
  const lineas = value.split("\n");
  const blocks: MarkdownBlock[] = [];
  let textoAcumulado: string[] = [];

  const flushTexto = () => {
    if (textoAcumulado.length === 0) return;
    // Reparte el texto acumulado en párrafos (línea en blanco = separador),
    // igual que el criterio previo, preservando bloques vacíos.
    const raw = textoAcumulado.join("\n");
    for (const bloque of raw.split(/\n{2,}/)) {
      blocks.push({ type: "text", raw: bloque });
    }
    textoAcumulado = [];
  };

  // Separador: una línea con SOLO ---, ***, o ___ (3 o más), sin nada más
  // que espacios alrededor — mismo criterio que el HR estándar de Markdown
  // (y el que ya reconoce @lexical/markdown al escribir en el editor).
  const HR_RE = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;

  let i = 0;
  while (i < lineas.length) {
    const linea = lineas[i];

    if (linea.trim().startsWith("```")) {
      const lang = linea.trim().slice(3).trim();
      const codeLineas: string[] = [];
      let j = i + 1;
      while (j < lineas.length && !lineas[j].trim().startsWith("```")) {
        codeLineas.push(lineas[j]);
        j++;
      }
      // Si no se encontró el cierre, el bloque llega hasta el final del
      // documento en vez de perderse — mejor mostrar el código sin cerrar
      // que tragarse todo el resto del texto silenciosamente.
      flushTexto();
      blocks.push({ type: "code", lang, code: codeLineas.join("\n") });
      i = j + 1;
      continue;
    }

    if (HR_RE.test(linea)) {
      flushTexto();
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    textoAcumulado.push(linea);
    i++;
  }

  flushTexto();
  return blocks;
}
