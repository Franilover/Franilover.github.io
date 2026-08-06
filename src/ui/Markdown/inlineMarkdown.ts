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
