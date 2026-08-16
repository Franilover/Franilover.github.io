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
//
// Tipado con Parameters<typeof DOMPurify.sanitize>[1] en vez de
// DOMPurify.Config directamente: la versión de "dompurify" instalada en
// Vercel resolvía un tipo Config distinto al del namespace importado acá
// (choque de tipos entre dos declaraciones de la misma librería), lo que
// rompía el build con "No overload matches this call" en PARSER_MEDIA_TYPE.
// Derivar el tipo desde la firma real de la función instalada evita ese
// desajuste sin importar qué versión termine resolviendo cada entorno.
const PURIFY_CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
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
export interface MarkdownListItem {
  text: string;
  children: MarkdownListItem[];
}

export type MarkdownBlock =
  | { type: "code"; lang: string; code: string }
  | { type: "hr" }
  | { type: "quote"; raw: string }
  | { type: "list"; ordered: boolean; items: MarkdownListItem[] }
  | { type: "table"; header: string[]; rows: string[][] }
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

  // Cita: "> texto" — mismo formato que produce serializeBlock($isQuoteNode)
  // en richTextSerializer.ts (cada línea del quote prefijada con "> ").
  const QUOTE_RE = /^ {0,3}>\s?(.*)$/;

  // Item de lista: "- texto" (bullet) o "1. texto" (ordenada), con
  // indentación de espacios para anidar — igual que serializeBlock
  // ($isListNode), que indenta listas anidadas con "\n" + su propio
  // serializeBlock recursivo (2 espacios por nivel, criterio estándar).
  const LIST_ITEM_RE = /^( *)(?:[-*]|(\d+)\.)\s+(.*)$/;

  // Fila de pipe-table: "| a | b |" — mismo formato que serializeTableNode.
  const TABLE_ROW_RE = /^ {0,3}\|(.+)\|\s*$/;
  const TABLE_SEP_RE = /^ {0,3}\|?[\s:|-]+\|?\s*$/;

  const parseTableCells = (linea: string): string[] => {
    const inner = linea.trim().replace(/^\|/, "").replace(/\|$/, "");
    return inner.split("|").map((c) => c.trim());
  };

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

    // Tabla: línea de header "| a | b |" seguida de una línea separadora
    // "|---|---|" — sin la separadora no es una tabla (podría ser un
    // párrafo que usa "|" por otra razón), igual que GFM estándar.
    if (
      TABLE_ROW_RE.test(linea) &&
      i + 1 < lineas.length &&
      TABLE_SEP_RE.test(lineas[i + 1]) &&
      lineas[i + 1].includes("-")
    ) {
      flushTexto();
      const header = parseTableCells(linea);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lineas.length && TABLE_ROW_RE.test(lineas[j])) {
        rows.push(parseTableCells(lineas[j]));
        j++;
      }
      blocks.push({ type: "table", header, rows });
      i = j;
      continue;
    }

    if (QUOTE_RE.test(linea)) {
      flushTexto();
      const quoteLineas: string[] = [];
      let j = i;
      while (j < lineas.length && QUOTE_RE.test(lineas[j])) {
        quoteLineas.push(QUOTE_RE.exec(lineas[j])![1]);
        j++;
      }
      blocks.push({ type: "quote", raw: quoteLineas.join("\n") });
      i = j;
      continue;
    }

    if (LIST_ITEM_RE.test(linea)) {
      flushTexto();
      const listLineas: string[] = [];
      let j = i;
      while (j < lineas.length && (LIST_ITEM_RE.test(lineas[j]) || lineas[j].trim() === "")) {
        // Una línea en blanco solo pertenece a la lista si sigue habiendo
        // items de lista después (evita tragarse el próximo párrafo).
        if (lineas[j].trim() === "") {
          const next = lineas[j + 1];
          if (next === undefined || !LIST_ITEM_RE.test(next)) break;
          j++;
          continue;
        }
        listLineas.push(lineas[j]);
        j++;
      }
      const firstMatch = LIST_ITEM_RE.exec(listLineas[0])!;
      const ordered = !!firstMatch[2];
      blocks.push({ type: "list", ordered, items: parseListItems(listLineas) });
      i = j;
      continue;
    }

    textoAcumulado.push(linea);
    i++;
  }

  flushTexto();
  return blocks;
}

// Construye el árbol de items (con anidado) a partir de las líneas crudas
// de una lista, usando la indentación (espacios antes del marcador) para
// determinar profundidad — simétrico con cómo serializeBlock($isListNode)
// indenta listas anidadas recursivamente al serializar.
function parseListItems(lineas: string[]): MarkdownListItem[] {
  const LIST_ITEM_RE = /^( *)(?:[-*]|(\d+)\.)\s+(.*)$/;
  type Entry = { indent: number; text: string; children: MarkdownListItem[] };

  const root: MarkdownListItem[] = [];
  const stack: { indent: number; items: MarkdownListItem[] }[] = [
    { indent: -1, items: root },
  ];

  for (const linea of lineas) {
    const match = LIST_ITEM_RE.exec(linea);
    if (!match) continue;
    const indent = match[1].length;
    const text = match[3];

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const item: MarkdownListItem = { text, children: [] };
    stack[stack.length - 1].items.push(item);
    stack.push({ indent, items: item.children });
  }

  return root;
}
