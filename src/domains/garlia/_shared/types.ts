import {
  Users,
  Bug,
  Package,
  Map,
  Mountain,
  ScrollText,
  Sparkles,
  Star,
  Wand2,
  Layers,
  BookOpen,
  Music,
} from "lucide-react";

// ─── Nota ─────────────────────────────────────────────────────────────────────
export type Nota = {
  id: string;
  titulo: string;
  contenido?: string;
  etiquetas?: string | null; // JSON array string, ej: '["personaje","idea"]'
  created_at?: string;
  updated_at?: string;
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────
export type TabKey =
  | "personajes"
  | "criaturas"
  | "items"
  | "reinos"
  | "mundo"
  | "hechizos"
  | "dones"
  | "runas"
  | "grupos"
  | "capitulos"
  | "letras";
export type SaveStatus = "idle" | "saving" | "saved" | "error";

export const TAB_CONFIG: Record<
  Exclude<TabKey, "mundo">,
  {
    emoji: string;
    label: string;
    tabla: string;
    Icon: React.ElementType;
    orderBy?: string;
    labelKey?: string;
  }
> = {
  personajes: {
    emoji: "🧑",
    label: "Personajes",
    tabla: "personajes",
    Icon: Users,
  },
  criaturas: { emoji: "🐛", label: "Criaturas", tabla: "criaturas", Icon: Bug },
  items: { emoji: "📦", label: "Items", tabla: "items", Icon: Package },
  reinos: { emoji: "🗺️", label: "Mapas", tabla: "reinos", Icon: Map },
  hechizos: { emoji: "✨", label: "Hechizos", tabla: "hechizos", Icon: Wand2 },
  dones: { emoji: "⭐", label: "Dones", tabla: "dones", Icon: Star },
  runas: { emoji: "ᚱ", label: "Runas", tabla: "runas", Icon: ScrollText },
  grupos: { emoji: "", label: "Grupos", tabla: "grupos_mundo", Icon: Layers },
  capitulos: {
    emoji: "📖",
    label: "Capítulos",
    tabla: "capitulos",
    Icon: BookOpen,
  },
  letras: {
    emoji: "🎵",
    label: "Letras",
    tabla: "canciones",
    Icon: Music,
    orderBy: "titulo",
    labelKey: "titulo",
  },
};

export const MUNDO_SECTIONS = [
  { key: "magia", label: "Magia", Icon: Sparkles },
  { key: "geografia", label: "Mundo", Icon: Mountain },
  { key: "historia", label: "Historia", Icon: ScrollText },
] as const;

export type MundoSectionKey = (typeof MUNDO_SECTIONS)[number]["key"];

export const INPUT_CLS =
  "w-full bg-input-bg text-input-text border border-primary/15 rounded-lg px-2.5 py-2 text-xs font-medium outline-none focus:border-primary/40 placeholder:text-primary/25 transition-colors";

// ─── Design tokens compactos ───────────────────────────────────────────────
// Un solo lugar para tamaños de botón/etiqueta/título, para que todo el sitio
// comparta la misma escala y no haya mezcla de py-2/py-3/py-4, text-xs/lg/2xl,
// rounded-lg/xl/2xl, etc. Escala pensada para densidad: nada de alto >36px,
// texto de acción en 11-12px, títulos de sección en 15-16px como máximo.

/** Label uppercase pequeño usado arriba de inputs/selectores. */
export const LABEL_CLS =
  "text-micro font-black uppercase tracking-[0.15em] text-primary/35";

/** Título de sección/bloque (H2 dentro de una página, no el header de la página). */
export const SECTION_TITLE_CLS = "text-sm font-black text-primary";

/** Título de página (el más grande permitido en todo el sitio). */
export const PAGE_TITLE_CLS = "text-base font-black text-primary";

/** Botón primario compacto (acción principal: Guardar, Añadir, Confirmar). */
export const BTN_PRIMARY_CLS =
  "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-btn-text hover:bg-primary/90 transition-colors disabled:opacity-50 min-h-[30px]";

/** Botón secundario/ghost (acción neutra: Cancelar, filtros, iconos con texto). */
export const BTN_GHOST_CLS =
  "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-primary/60 hover:text-primary hover:bg-primary/8 transition-colors disabled:opacity-50 min-h-[30px]";

/** Botón destructivo compacto (Eliminar, etc.). */
export const BTN_DANGER_CLS =
  "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-colors min-h-[30px]";

/** Botón icono-solo (cuadrado, sin texto). */
export const BTN_ICON_CLS =
  "flex items-center justify-center w-7 h-7 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/8 transition-colors disabled:opacity-50";
