import type { CSSProperties } from "react";

import type { IdiomaKey, Filtros, Seccion, EscenaMV, ColState } from "./types";

export const IDIOMAS: {
  id: IdiomaKey;
  label: string;
  nombre: string;
  campo: keyof Seccion;
}[] = [
  { id: "es", label: "ES", nombre: "Español", campo: "letra_es" },
  { id: "en", label: "EN", nombre: "Inglés", campo: "letra_en" },
  { id: "jp", label: "JP", nombre: "Japonés", campo: "letra_jp" },
  { id: "romaji", label: "RO", nombre: "Romaji", campo: "letra_romaji" },
];

export const ESTADOS = ["TERMINADA", "EN PROCESO", "BORRADOR"] as const;

// Antes esto eran clases de Tailwind fijas (bg-emerald-500, bg-amber-500…),
// sin ninguna relación con el tema activo. Ahora usamos las mismas
// variables semánticas de "callout" que ya usa el resto del sitio
// (--callout-success-border, --callout-warning-border…), así que si el
// tema cambia sus colores, estos badges cambian con él en vez de quedar
// pegados a un verde/ámbar fijo. Se consumen como `style`, no `className`
// (ver los usos en PanelEditor, PanelGuionMV y SidebarItem).
function badgeStyle(cssVar: string): CSSProperties {
  return {
    background: `color-mix(in srgb, var(${cssVar}) 18%, transparent)`,
    color: `var(${cssVar})`,
    borderColor: `color-mix(in srgb, var(${cssVar}) 35%, transparent)`,
  };
}
function badgeStylePrimary(alpha: {
  bg: number;
  border: number;
  opacity: number;
}): CSSProperties {
  return {
    background: `color-mix(in srgb, var(--primary) ${alpha.bg}%, transparent)`,
    color: `color-mix(in srgb, var(--primary) ${alpha.opacity}%, transparent)`,
    borderColor: `color-mix(in srgb, var(--primary) ${alpha.border}%, transparent)`,
  };
}

export const ESTADO_COLOR: Record<string, CSSProperties> = {
  TERMINADA: badgeStyle("--callout-success-border"),
  "EN PROCESO": badgeStyle("--callout-warning-border"),
  BORRADOR: badgeStylePrimary({ bg: 10, border: 20, opacity: 50 }),
};

export const FILTROS_VACIOS: Filtros = {
  estado: "",
  visible: "",
  idioma: "",
  cantante: "",
  compositor: "",
  personaje: "",
};

export const TABLA_SEC = "secciones_cancion";

export const TIPO_ESCENA_LABEL: Record<EscenaMV["tipo"], string> = {
  escena: "Escena",
  camara: "Cámara",
  efecto: "Efecto",
  transicion: "Transición",
  personaje: "Personaje",
};

// 5 categorías → 5 variables de callout distintas, para que sigan siendo
// distinguibles entre sí a simple vista sin depender de un solo hue fijo
// (violeta/celeste/rosa/ámbar/verde) que no existe en todos los temas.
export const TIPO_ESCENA_COLOR: Record<EscenaMV["tipo"], CSSProperties> = {
  escena: badgeStyle("--callout-info-border"),
  camara: badgeStyle("--callout-tip-border"),
  efecto: badgeStyle("--callout-danger-border"),
  transicion: badgeStyle("--callout-warning-border"),
  personaje: badgeStyle("--callout-success-border"),
};

export const IDLE_STATE: ColState = {
  dirty: false,
  saving: false,
  saved: false,
  mode: "idle",
  msg: null,
};
