/**
 * snippetDefs.ts
 * ──────────────
 * Fuente única de verdad para la config visual de cada tipo de snippet.
 * Reemplaza las 3 copias duplicadas de KIND_DEFS que había en:
 *   - SnippetOverlay.tsx
 *   - RichBlockEditor.tsx
 *   - SnippetCommandPalette.tsx (como CATS)
 */

export type SnippetKind =
  | "drop" | "img" | "float" | "choice" | "use" | "gate"
  | "section" | "sound" | "cita";

export type ModalKind =
  | "drop" | "imagen" | "choice" | "use" | "gate" | "section" | "sound";

export interface KindDef {
  label:    string;
  icon:     string;
  bg:       string;
  border:   string;
  text:     string;
  dot:      string;
  /** Resumen legible extraído del raw [[...]] */
  summary:  (raw: string) => string;
  /** Keywords para búsqueda en la palette */
  keywords: string[];
  /** Qué modal abrir al editar */
  modal:    ModalKind | null;
}

function parts(raw: string) { return raw.slice(2, -2).split("|"); }

export const KIND_DEFS: Record<string, KindDef> = {
  drop: {
    label: "Drop", icon: "⚔", modal: "drop",
    bg: "rgba(127,119,221,.13)", border: "rgba(127,119,221,.4)", text: "#a09af0", dot: "#7f77dd",
    summary: r => { const p = parts(r); return p[4] ?? p[1] ?? ""; },
    keywords: ["drop", "entidad", "personaje", "criatura", "item"],
  },
  img: {
    label: "Img", icon: "🖼", modal: "imagen",
    bg: "rgba(29,158,117,.13)", border: "rgba(29,158,117,.4)", text: "#2dc896", dot: "#1d9e75",
    summary: r => { const p = parts(r); return p[2] ?? p[1] ?? ""; },
    keywords: ["imagen", "img", "foto", "dibujo"],
  },
  float: {
    label: "Float", icon: "🖼", modal: "imagen",
    bg: "rgba(15,110,86,.13)", border: "rgba(15,110,86,.4)", text: "#14a87e", dot: "#0f6e56",
    summary: r => { const p = parts(r); return p[1] ?? ""; },
    keywords: ["float", "flotante"],
  },
  choice: {
    label: "Choice", icon: "🔀", modal: "choice",
    bg: "rgba(55,138,221,.13)", border: "rgba(55,138,221,.4)", text: "#5aabf5", dot: "#378add",
    summary: r => { const p = parts(r); return p[1] ?? ""; },
    keywords: ["choice", "decisión", "boton", "botón"],
  },
  use: {
    label: "Use", icon: "👆", modal: "use",
    bg: "rgba(226,75,74,.13)", border: "rgba(226,75,74,.4)", text: "#f07574", dot: "#e24b4a",
    summary: r => { const p = parts(r); return p[1] ?? ""; },
    keywords: ["use", "usar", "ítem", "inventario"],
  },
  gate: {
    label: "Gate", icon: "🚪", modal: "gate",
    bg: "rgba(186,117,23,.13)", border: "rgba(186,117,23,.4)", text: "#e09a2a", dot: "#ba7517",
    summary: r => { const p = parts(r); return p[1] ?? ""; },
    keywords: ["gate", "puerta", "condicional"],
  },
  section: {
    label: "Sección", icon: "›", modal: "section",
    bg: "rgba(83,74,183,.13)", border: "rgba(83,74,183,.4)", text: "#8b83e8", dot: "#534ab7",
    summary: r => { const p = parts(r); return p[2] ?? p[1] ?? ""; },
    keywords: ["section", "sección", "seccion", "ancla"],
  },
  sound: {
    label: "Sonido", icon: "♪", modal: "sound",
    bg: "rgba(212,83,126,.13)", border: "rgba(212,83,126,.4)", text: "#e87aaa", dot: "#d4537e",
    summary: r => { const p = parts(r); return p[1] ?? ""; },
    keywords: ["sonido", "sound", "música", "musica", "audio"],
  },
  cita: {
    label: "Cita", icon: "«»", modal: null,
    bg: "rgba(186,117,23,.10)", border: "rgba(186,117,23,.3)", text: "#e09a2a", dot: "#ba7517",
    summary: r => { const t = parts(r).slice(1).join("|"); return t.length > 28 ? t.slice(0, 28) + "…" : t; },
    keywords: ["cita"],
  },
};

export const KIND_FALLBACK: KindDef = {
  label: "?", icon: "◆", modal: null,
  bg: "rgba(128,128,128,.1)", border: "rgba(128,128,128,.3)", text: "#aaa", dot: "#888",
  summary: r => r.slice(2, -2).slice(0, 20),
  keywords: [],
};

/** Lista de tipos editables para toolbars y palettes (excluye cita, img/float separados) */
export const SNIPPET_TYPES: { kind: ModalKind; label: string; icon: string }[] = [
  { kind: "drop",    label: "Drop",       icon: "⚔"  },
  { kind: "choice",  label: "Choice",     icon: "🔀" },
  { kind: "use",     label: "Usar ítem",  icon: "👆" },
  { kind: "gate",    label: "Gate ítem",  icon: "🚪" },
  { kind: "section", label: "Sección",    icon: "›"  },
  { kind: "imagen",  label: "Imagen",     icon: "🖼"  },
  { kind: "sound",   label: "Sonido",     icon: "♪"  },
];
