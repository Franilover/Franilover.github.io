/**
 * headingVariant.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Tipo HeadingVariant + parseo/serialización del sufijo "{variante}" al
 * final de una línea de heading ("## Título {barra}") — extraído de
 * VariantHeadingNode.tsx a un módulo SIN dependencias de Lexical.
 *
 * Por qué: VariantHeadingNode.tsx importa @lexical/rich-text, @lexical/markdown
 * y lexical (para poder subclasificar HeadingNode). Eso está bien dentro del
 * editor, pero ui/Markdown/inlineMarkdown.ts también necesita stripVariantSuffix
 * para que la página PÚBLICA de ensayos (que nunca carga el editor, ver
 * PlainMarkdownPreview.tsx) pinte el mismo ornamento visual que ve el autor
 * al escribir. Importar VariantHeadingNode.tsx desde ahí arrastraría todo
 * Lexical al bundle de una página que no lo necesita. Este módulo es el punto
 * de verdad real de la lógica; VariantHeadingNode.tsx la reexporta para no
 * romper a RichEditor.tsx/richTextSerializer.ts, que ya importaban desde ahí.
 */

export type HeadingVariant =
  | "none"
  | "linea"
  | "barra"
  | "portada"
  | "dropcap"
  | "primeramayuscula";

// Sintaxis "{variante}" al final de la línea de heading — ver nota en
// VariantHeadingNode.tsx sobre por qué se eligió "{...}" (no colisiona con
// markdown estándar) y por qué persiste como texto plano en vez de JSON.
export const VARIANT_SUFFIX_RE =
  /\s*\{(linea|barra|portada|dropcap|primeramayuscula)\}\s*$/;

export function stripVariantSuffix(text: string): {
  text: string;
  variant: HeadingVariant;
} {
  const match = VARIANT_SUFFIX_RE.exec(text);
  if (!match) return { text, variant: "none" };
  return {
    text: text.slice(0, match.index),
    variant: match[1] as HeadingVariant,
  };
}

export function appendVariantSuffix(
  text: string,
  variant: HeadingVariant,
): string {
  if (variant === "none") return text;
  return `${text} {${variant}}`;
}
