/**
 * types.ts — domains/garlia/elementos
 * ───────────────────────────────────────────────────────────────────────────
 * Tipos del sistema de Alquimia/Energías: los 29 Elementos base, sus 3 capas
 * (núcleo, media, externa) y las 11 partículas posibles por capa.
 *
 * Basado en el documento de arquitectura (types.ts / registry.ts del motor
 * de dominio) y en TablaQuimica.py — unificados acá como la fuente única
 * editable desde Supabase (tabla "elementos").
 *
 * Capas guardadas como jsonb: { "Masa": 2, "Potencial": 1, ... } — mismo
 * patrón que patron_trazos (jsonb) en runas/types.ts.
 */

import { Atom, Beaker, Gem, Layers, Sparkle } from "lucide-react";

export type ParticleType =
  | "Masa"
  | "Cinética"
  | "Potencial"
  | "Información"
  | "Voluntad"
  | "Percepción"
  | "Transición"
  | "Ciclo"
  | "Entropía"
  | "Catálisis"
  | "Equilibrio";

export const PARTICLE_TYPES: ParticleType[] = [
  "Masa",
  "Cinética",
  "Potencial",
  "Información",
  "Voluntad",
  "Percepción",
  "Transición",
  "Ciclo",
  "Entropía",
  "Catálisis",
  "Equilibrio",
];

/** Inicial usada como abreviatura corta en las tarjetas (ej. "2M 1P"). */
export const PARTICLE_INITIAL: Record<ParticleType, string> = {
  Masa: "M",
  Cinética: "C",
  Potencial: "P",
  Información: "I",
  Voluntad: "V",
  Percepción: "Pc",
  Transición: "T",
  Ciclo: "Cl",
  Entropía: "E",
  Catálisis: "Ct",
  Equilibrio: "Eq",
};

export type LayerName = "nucleo" | "media" | "externa";

export const LAYER_LABEL: Record<LayerName, string> = {
  nucleo: "Núcleo",
  media: "Media",
  externa: "Externa",
};

export type ParticleMap = Partial<Record<ParticleType, number>>;

export type ElementFamily =
  | "Sensibles"
  | "Reactivos"
  | "Nobles"
  | "Base Terrosa"
  | "Puente";

export const ELEMENT_FAMILIES: ElementFamily[] = [
  "Sensibles",
  "Reactivos",
  "Nobles",
  "Base Terrosa",
  "Puente",
];

export const FAMILY_ICON: Record<ElementFamily, React.ElementType> = {
  Sensibles: Sparkle,
  Reactivos: Beaker,
  Nobles: Gem,
  "Base Terrosa": Layers,
  Puente: Atom,
};

/** Fila cruda tal cual vive en Supabase (tabla "elementos"). */
export interface Elemento {
  id: string;
  numero_atomico: number;
  nombre: string;
  simbolo: string;
  familia: ElementFamily;
  es_noble: boolean;
  notas?: string | null;
  nucleo: ParticleMap;
  media: ParticleMap;
  externa: ParticleMap;
}

export const CONFIG = {
  tabla: "elementos",
  select:
    "id, numero_atomico, nombre, simbolo, familia, es_noble, notas, nucleo, media, externa",
};

// ─── Compuestos: combinaciones de elementos de la Tabla Química ───────────
// Ej. Agua = Fluxio + Cristalio, Fuego = Plasmio + Reactivo, etc. Cada
// compuesto referencia 2+ elementos por id (componentes) y tiene su propio
// nombre/símbolo/notas — mismo espíritu que EditorCombinacionesRunas pero
// para Elementos en vez de Runas.
export interface ComponenteCompuesto {
  elemento_id: string;
  /** Cuántas "partes" de este elemento entran en el compuesto (default 1). */
  cantidad: number;
}

/** Fila cruda tal cual vive en Supabase (tabla "compuestos"). */
export interface Compuesto {
  id: string;
  nombre: string;
  simbolo?: string | null;
  notas?: string | null;
  componentes: ComponenteCompuesto[];
  created_at?: string;
}

export const CONFIG_COMPUESTOS = {
  tabla: "compuestos",
  select: "id, nombre, simbolo, notas, componentes, created_at",
};

/** Compacta un ParticleMap en algo tipo "2M 1P" para tarjetas/resúmenes. */
export function formatLayer(layer: ParticleMap | null | undefined): string {
  if (!layer) return "—";
  const entries = Object.entries(layer).filter(([, v]) => (v ?? 0) > 0);
  if (entries.length === 0) return "—";
  return entries
    .map(([k, v]) => `${v}${PARTICLE_INITIAL[k as ParticleType] ?? k[0]}`)
    .join(" ");
}

/** Total de partículas en una capa (para mostrar ocupación, ej. "4/4"). */
export function layerTotal(layer: ParticleMap | null | undefined): number {
  if (!layer) return 0;
  return Object.values(layer).reduce((a, b) => a + (b ?? 0), 0);
}
