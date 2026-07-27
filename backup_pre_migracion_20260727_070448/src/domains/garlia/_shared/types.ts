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
  "w-full bg-input-bg text-input-text border border-primary/15 rounded-xl px-3 py-2.5 text-xs font-medium outline-none focus:border-primary/40 placeholder:text-primary/25 transition-colors";
