/**
 * commandItems.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Tipos y datos del menú de comandos ("add …").
 * Sin dependencias de React ni del DOM — importable en cualquier contexto.
 *
 * Exports:
 *   CommandItem       — tipo de un item del menú
 *   COMMAND_ITEMS     — lista completa de comandos built-in
 *   SnippetAction     — union de acciones que puede emitir el preview
 *   WikiEntity        — entidad para autocompletado de [[wikilinks]]
 *   toWikiEntities    — normaliza string[] | WikiEntity[] → WikiEntity[]
 *   ViewMode          — "edit" | "preview" | "split"
 */

// ── Tipos ────────────────────────────────────────────────────────────────────
export type ViewMode = "edit" | "preview" | "split";

export interface CommandItem {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  icon: string;
  snippet?: string;
  action?: () => void;
  /** Posición del cursor después de insertar (desde el final del snippet) */
  cursorOffset?: number;
}

export type SnippetAction =
  | { type: "choice"; target: string }
  | { type: "section"; id: string; label?: string }
  | {
      type: "use";
      word: string;
      itemId: string;
      targetOk: string;
      targetFail?: string;
    }
  | { type: "gate"; itemId: string }
  | { type: "drop"; raw: string }
  | { type: "sound"; raw: string }
  | { type: "img"; url: string; caption?: string }
  | { type: "float"; word: string; url: string; caption?: string }
  | { type: "wikilink"; target: string };

export type WikiEntity = { name: string; type: string };

/** Normaliza string[] | WikiEntity[] → WikiEntity[] */
export function toWikiEntities(
  entities: (string | WikiEntity)[],
): WikiEntity[] {
  return entities.map((e) =>
    typeof e === "string" ? { name: e, type: "nota" } : e,
  );
}

// ── Command items ────────────────────────────────────────────────────────────
export const COMMAND_ITEMS: CommandItem[] = [
  {
    id: "codeblock",
    label: "Bloque de código",
    description: "Inserta un bloque ```código```",
    keywords: ["cod", "code", "bloc", "bloque", "pre"],
    icon: "</>",
    snippet: "\n```\n\n```\n",
    cursorOffset: 5,
  },
  {
    id: "heading1",
    label: "Título H1",
    description: "# Encabezado grande",
    keywords: ["h1", "tit", "titulo", "título", "head"],
    icon: "H1",
    snippet: "\n# ",
  },
  {
    id: "heading2",
    label: "Título H2",
    description: "## Encabezado mediano",
    keywords: ["h2", "tit", "titulo", "título", "head"],
    icon: "H2",
    snippet: "\n## ",
  },
  {
    id: "heading3",
    label: "Título H3",
    description: "### Encabezado pequeño",
    keywords: ["h3", "tit", "titulo", "título", "head"],
    icon: "H3",
    snippet: "\n### ",
  },
  {
    id: "heading4",
    label: "Título H4",
    description: "#### Encabezado, incluido en el TOC",
    keywords: ["h4", "tit", "titulo", "título", "head"],
    icon: "H4",
    snippet: "\n#### ",
  },
  {
    id: "table",
    label: "Tabla",
    description: "Inserta una tabla markdown",
    keywords: ["tab", "table", "tabla", "grid"],
    icon: "⊞",
    snippet:
      "\n| Col 1 | Col 2 | Col 3 |\n|---|---|---|\n| dato | dato | dato |\n",
  },
  {
    id: "list",
    label: "Lista",
    description: "Lista con viñetas",
    keywords: ["lis", "list", "lista", "ul", "vif"],
    icon: "≡",
    snippet: "\n- elemento 1\n- elemento 2\n- elemento 3\n",
  },
  {
    id: "tasklist",
    label: "Lista de tareas",
    description: "Lista con checkboxes",
    keywords: ["tas", "task", "tarea", "check", "todo"],
    icon: "✓",
    snippet: "\n- [ ] Tarea 1\n- [ ] Tarea 2\n- [x] Completada\n",
  },
  {
    id: "link",
    label: "Enlace",
    description: "[texto](url)",
    keywords: ["lin", "link", "enl", "enlace", "url", "href"],
    icon: "🔗",
    snippet: "[texto](url)",
    cursorOffset: 4,
  },
  {
    id: "image",
    label: "Imagen",
    description: "![alt](url)",
    keywords: ["img", "image", "imagen", "foto", "pic"],
    icon: "🖼",
    snippet: "![alt](url)",
    cursorOffset: 4,
  },
  {
    id: "bold",
    label: "Negrita",
    description: "**texto en negrita**",
    keywords: ["bol", "bold", "neg", "negrita", "fuerte"],
    icon: "B",
    snippet: "**texto**",
    cursorOffset: 6,
  },
  {
    id: "italic",
    label: "Cursiva",
    description: "*texto en cursiva*",
    keywords: ["ita", "italic", "cur", "cursiva", "itálica"],
    icon: "I",
    snippet: "*texto*",
    cursorOffset: 6,
  },
  {
    id: "hr",
    label: "Separador",
    description: "Línea horizontal ---",
    keywords: ["hr", "sep", "separa", "div", "lin", "linea"],
    icon: "—",
    snippet: "\n---\n",
  },
  {
    id: "quote",
    label: "Blockquote",
    description: "> cita o nota destacada",
    keywords: ["quo", "quote", "cit", "cita", "blq", "block"],
    icon: "❝",
    snippet: "\n> ",
  },
  {
    id: "orderedlist",
    label: "Lista numerada",
    description: "1. 2. 3. lista ordenada",
    keywords: ["num", "ol", "ord", "numer", "lista", "1"],
    icon: "1.",
    snippet: "\n1. elemento 1\n2. elemento 2\n3. elemento 3\n",
  },
  {
    id: "highlight",
    label: "Resaltado",
    description: "==texto resaltado==",
    keywords: ["res", "mark", "high", "resal", "color", "amarillo"],
    icon: "▐",
    snippet: "==texto==",
    cursorOffset: 6,
  },
  {
    id: "superscript",
    label: "Superíndice",
    description: "texto^superíndice^",
    keywords: ["sup", "super", "exp", "potencia", "arriba"],
    icon: "Xⁿ",
    snippet: "^texto^",
    cursorOffset: 5,
  },
  {
    id: "subscript",
    label: "Subíndice",
    description: "texto~subíndice~",
    keywords: ["sub", "indice", "abajo", "quim"],
    icon: "Xₙ",
    snippet: "~texto~",
    cursorOffset: 5,
  },
  {
    id: "math-inline",
    label: "Math inline",
    description: "$fórmula$ en línea",
    keywords: ["mat", "math", "form", "ecua", "latex", "kat"],
    icon: "∑",
    snippet: "$x^2$",
    cursorOffset: 3,
  },
  {
    id: "math-block",
    label: "Math bloque",
    description: "$$fórmula centrada$$",
    keywords: ["mat", "math", "form", "ecua", "latex", "bloque"],
    icon: "∫",
    snippet: "\n$$\n\n$$\n",
    cursorOffset: 5,
  },
  // ── Callouts ───────────────────────────────────────────────────────────────
  {
    id: "callout-note",
    label: "Callout Note",
    description: "> [!NOTE] azul informativo",
    keywords: ["cal", "callout", "note", "nota", "info"],
    icon: "📝",
    snippet: "\n> [!NOTE]\n> Escribe tu nota aquí.\n",
    cursorOffset: 1,
  },
  {
    id: "callout-tip",
    label: "Callout Tip",
    description: "> [!TIP] verde consejo",
    keywords: ["cal", "callout", "tip", "consejo", "verde"],
    icon: "💡",
    snippet: "\n> [!TIP]\n> Escribe un consejo aquí.\n",
    cursorOffset: 1,
  },
  {
    id: "callout-warning",
    label: "Callout Warning",
    description: "> [!WARNING] amarillo advertencia",
    keywords: ["cal", "callout", "warn", "warning", "adver", "amarillo"],
    icon: "⚠️",
    snippet: "\n> [!WARNING]\n> Escribe una advertencia aquí.\n",
    cursorOffset: 1,
  },
  {
    id: "callout-danger",
    label: "Callout Danger",
    description: "> [!DANGER] rojo peligro",
    keywords: ["cal", "callout", "danger", "error", "peli", "rojo"],
    icon: "🔴",
    snippet: "\n> [!DANGER]\n> Escribe un error o peligro aquí.\n",
    cursorOffset: 1,
  },
  {
    id: "callout-success",
    label: "Callout Success",
    description: "> [!SUCCESS] verde éxito",
    keywords: ["cal", "callout", "success", "exito", "éxito", "ok"],
    icon: "✅",
    snippet: "\n> [!SUCCESS]\n> Operación completada con éxito.\n",
    cursorOffset: 1,
  },
  {
    id: "callout-info",
    label: "Callout Info",
    description: "> [!INFO] violeta información",
    keywords: ["cal", "callout", "info", "purple", "violeta"],
    icon: "ℹ️",
    snippet: "\n> [!INFO]\n> Información adicional aquí.\n",
    cursorOffset: 1,
  },
  // ── TOC ────────────────────────────────────────────────────────────────────
  {
    id: "toc",
    label: "Tabla de contenidos",
    description: "[[TOC]] generada automáticamente",
    keywords: ["toc", "tabla", "contenidos", "indice", "índice", "nav"],
    icon: "📋",
    snippet: "\n[[TOC]]\n",
  },
  // ── Plantillas ─────────────────────────────────────────────────────────────
  {
    id: "template-article",
    label: "Plantilla: Artículo",
    description: "Estructura básica de artículo",
    keywords: ["tem", "template", "plan", "plantilla", "art", "articulo"],
    icon: "📄",
    snippet:
      "\n# Título del artículo\n\n[[TOC]]\n\n## Introducción\n\nEscribe aquí la introducción.\n\n## Desarrollo\n\nEscribe aquí el contenido principal.\n\n## Conclusión\n\nEscribe aquí las conclusiones.\n",
  },
  {
    id: "template-readme",
    label: "Plantilla: README",
    description: "README para proyecto",
    keywords: ["tem", "template", "plan", "readme", "repo", "git", "proyec"],
    icon: "📦",
    snippet:
      "\n# Nombre del Proyecto\n\n> [!INFO]\n> Descripción breve del proyecto.\n\n## Instalación\n\n```\nnpm install\n```\n\n## Uso\n\n```\nnpm start\n```\n\n## Contribuir\n\n1. Fork del repo\n2. Crea tu rama (`git checkout -b feature/algo`)\n3. Commit tus cambios\n4. Abre un Pull Request\n",
  },
  {
    id: "template-meeting",
    label: "Plantilla: Reunión",
    description: "Acta de reunión",
    keywords: ["tem", "template", "plan", "reunion", "reunión", "acta", "meet"],
    icon: "🗓",
    snippet:
      "\n# Reunión — {{fecha}}\n\n**Asistentes:** Nombre1, Nombre2\n\n## Agenda\n\n1. Punto 1\n2. Punto 2\n\n## Notas\n\n- Discusión sobre...\n\n## Acciones\n\n- [ ] Tarea 1 — responsable\n- [ ] Tarea 2 — responsable\n\n## Próxima reunión\n\nFecha: \n",
  },
  {
    id: "template-report",
    label: "Plantilla: Reporte",
    description: "Reporte técnico / ejecutivo",
    keywords: [
      "tem",
      "template",
      "plan",
      "repo",
      "report",
      "reporte",
      "ejecut",
    ],
    icon: "📊",
    snippet:
      "\n# Reporte: {{título}}\n\n> [!NOTE]\n> Resumen ejecutivo del reporte.\n\n[[TOC]]\n\n## Contexto\n\nDescripción del contexto o problema.\n\n## Análisis\n\n| Métrica | Valor | Objetivo |\n|---|---|---|\n| KPI 1 | - | - |\n| KPI 2 | - | - |\n\n## Conclusiones\n\n> [!SUCCESS]\n> Escribe aquí los resultados positivos.\n\n## Próximos pasos\n\n- [ ] Acción 1\n- [ ] Acción 2\n",
  },
  {
    id: "link-list",
    label: "Lista de Enlaces",
    description: ":::links bloque con título personalizado",
    keywords: [
      "link",
      "links",
      "lista",
      "url",
      "urls",
      "enlace",
      "enlaces",
      "web",
      "coleccion",
      "colección",
    ],
    icon: "🌐",
    snippet:
      "\n:::links Mis enlaces\nhttps://ejemplo.com\nhttps://otro-sitio.com\n:::\n",
  },
  {
    id: "strikethrough",
    label: "Tachado",
    description: "~~texto tachado~~",
    keywords: ["tac", "tach", "tachado", "strike", "del", "elimin"],
    icon: "S̶",
    snippet: "~~texto~~",
    cursorOffset: 7,
  },
  {
    id: "inline-code",
    label: "Código en línea",
    description: "`código` en línea, dentro de un párrafo",
    keywords: ["cod", "code", "inline", "linea", "línea", "snippet", "mono"],
    icon: "`",
    snippet: "`código`",
    cursorOffset: 7,
  },
  {
    id: "callout-error",
    label: "Callout Error",
    description: "> [!ERROR] rojo error",
    keywords: ["cal", "callout", "error", "err", "fail", "rojo"],
    icon: "❌",
    snippet: "\n> [!ERROR]\n> Describe el error aquí.\n",
    cursorOffset: 1,
  },
];
