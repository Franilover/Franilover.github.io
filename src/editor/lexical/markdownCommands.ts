export type MarkdownCommandId =
  | "h1"
  | "h2"
  | "h3"
  | "paragraph"
  | "bullet"
  | "numbered"
  | "quote"
  | "code"
  | "table";

export interface MarkdownCommandItem {
  id: MarkdownCommandId;
  label: string;
  hint: string;
  keywords: string[];
}

export const MARKDOWN_COMMANDS: MarkdownCommandItem[] = [
  { id: "h1", label: "Título 1", hint: "#", keywords: ["titulo", "heading", "h1"] },
  { id: "h2", label: "Título 2", hint: "##", keywords: ["titulo", "heading", "h2"] },
  { id: "h3", label: "Título 3", hint: "###", keywords: ["titulo", "heading", "h3"] },
  {
    id: "paragraph",
    label: "Texto",
    hint: "¶",
    keywords: ["texto", "parrafo", "párrafo", "normal", "paragraph"],
  },
  {
    id: "bullet",
    label: "Lista con viñetas",
    hint: "•",
    keywords: ["lista", "bullet", "ul", "vineta", "viñeta"],
  },
  {
    id: "numbered",
    label: "Lista numerada",
    hint: "1.",
    keywords: ["lista", "numerada", "ol", "numero", "número"],
  },
  { id: "quote", label: "Cita", hint: "❝", keywords: ["cita", "quote", "blockquote"] },
  { id: "code", label: "Bloque de código", hint: "</>", keywords: ["codigo", "código", "code"] },
  { id: "table", label: "Tabla", hint: "▦", keywords: ["tabla", "table"] },
];

export function filterMarkdownCommands(query: string): MarkdownCommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return MARKDOWN_COMMANDS;
  return MARKDOWN_COMMANDS.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q)),
  );
}
