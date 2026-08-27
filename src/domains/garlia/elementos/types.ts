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

import { Gem, Link2, Scale, Wind, CircleOff } from "lucide-react";

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
  "Masa", "Cinética", "Potencial", "Información", "Voluntad", "Percepción",
  "Transición", "Ciclo", "Entropía", "Catálisis", "Equilibrio",
];

export const PARTICLE_INITIAL: Record<ParticleType, string> = {
  Masa: "M", Cinética: "C", Potencial: "P", Información: "I", Voluntad: "V",
  Percepción: "Pc", Transición: "T", Ciclo: "Cl", Entropía: "E", Catálisis: "Ct", Equilibrio: "Eq",
};

export type LayerName = "nucleo" | "media" | "externa";
export const LAYER_LABEL: Record<LayerName, string> = { nucleo: "Núcleo", media: "Media", externa: "Externa" };
export const LAYER_PARTICLES: Record<LayerName, ParticleType[]> = {
  nucleo: ["Masa", "Cinética", "Equilibrio"],
  media: ["Potencial", "Información", "Ciclo", "Entropía"],
  externa: ["Voluntad", "Percepción", "Transición", "Catálisis"],
};
export type ParticleMap = Partial<Record<ParticleType, number>>;

export type ElementFamily = "Noble" | "Rígido" | "Intermedio" | "Reactivo" | "Inerte";
export const ELEMENT_FAMILIES: ElementFamily[] = ["Noble", "Rígido", "Intermedio", "Reactivo", "Inerte"];
export const FAMILY_ICON: Record<ElementFamily, React.ElementType> = { Noble: Gem, Rígido: Link2, Intermedio: Scale, Reactivo: Wind, Inerte: CircleOff };
export const FAMILY_COLOR: Record<ElementFamily, { text: string; bg: string; border: string }> = {
  Noble: { text: "#c9a3e0", bg: "rgba(170, 120, 190, 0.14)", border: "rgba(170, 120, 190, 0.38)" },
  Rígido: { text: "#8fb3d9", bg: "rgba(90, 130, 180, 0.14)", border: "rgba(90, 130, 180, 0.38)" },
  Intermedio: { text: "#9bc4a0", bg: "rgba(110, 160, 115, 0.14)", border: "rgba(110, 160, 115, 0.38)" },
  Reactivo: { text: "#d99a7a", bg: "rgba(190, 110, 70, 0.14)", border: "rgba(190, 110, 70, 0.38)" },
  Inerte: { text: "#a8a0ac", bg: "rgba(140, 130, 145, 0.12)", border: "rgba(140, 130, 145, 0.32)" },
};

export interface Elemento {
  id: string; numero_atomico: number; nombre: string; simbolo: string; familia: ElementFamily;
  es_noble: boolean; notas?: string | null; nucleo: ParticleMap; media: ParticleMap; externa: ParticleMap;
  es_catalizador?: boolean | null;
  masa_base?: number | null; estabilidad?: number | null; rigidez?: number | null; flexibilidad?: number | null;
  dureza?: number | null; conductividad?: number | null; transparencia?: number | null; capacidad_transformacion?: number | null;
  dinamismo_particular?: number | null; valencia_estructural?: number | null; capacidad_enlace?: number | null;
  polaridad_estructural?: number | null; saturacion_enlace?: number | null; regimen_estructural?: string | null;
}

// ... resto del archivo sin cambios ...

/** Fila real de la tabla "estructuras": la capa entre Compuesto y Célula. */
export interface Estructura {
  id: string;
  nombre: string;
  tipo: string | null;
  descripcion: string | null;
  funcion: string | null;
  notas: string | null;
  propiedades_calculadas: Record<string, unknown> | null;
  estado_calculo: string | null;
  calculado_at: string | null;
  created_at: string;
  updated_at?: string;
}

export const CONFIG_ESTRUCTURAS = {
  tabla: "estructuras",
  select:
    "id, nombre, tipo, descripcion, funcion, notas, propiedades_calculadas, estado_calculo, calculado_at, created_at, updated_at",
};

export interface EstructuraCompuesto {
  id: string; estructura_id: string; compuesto_id: string; cantidad: number | null; proporcion: number | null;
  unidad: string | null; tipo_proporcion: string | null; rol: string | null; orden: number | null; created_at: string;
}
export const CONFIG_ESTRUCTURA_COMPUESTOS = {
  tabla: "estructura_compuestos",
  select: "id, estructura_id, compuesto_id, cantidad, proporcion, unidad, tipo_proporcion, rol, orden, created_at",
};

export interface CelulaEstructura {
  id: string; celula_id: string; estructura_id: string; cantidad: number | null; proporcion: number | null;
  rol: string | null; orden: number | null; created_at: string;
}
export const CONFIG_CELULA_ESTRUCTURAS = {
  tabla: "celula_estructuras",
  select: "id, celula_id, estructura_id, cantidad, proporcion, rol, orden, created_at",
};
