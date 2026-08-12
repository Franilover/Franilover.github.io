/**
 * types.ts — domains/garlia/fisica
 * ───────────────────────────────────────────────────────────────────────────
 * Tipos del sistema de Física/Energías: los 9 Oris (fuerzas cósmicas) y los
 * bloques de conceptos (Vacío/Garin/Eterium, Manifestaciones, etc).
 *
 * Tablas propias en Supabase — "oris" y "fisica_conceptos" — separadas por
 * completo de "elementos" (Tabla Química/Alquímica), aunque comparten la
 * misma jerarquía conceptual (Partícula Base → Partículas → Ium → Oris).
 * Partículas Base / Partículas / Iums son catálogos fijos (no cambian, no
 * tienen CRUD propio) y viven como constantes acá mismo — mismo criterio
 * que PARTICLE_TYPES en elementos/types.ts.
 */

import { Atom, Beaker, Sparkle } from "lucide-react";

export type OrisFamilia = "Mecánica" | "Energética" | "Biológica";

export const ORIS_FAMILIAS: OrisFamilia[] = ["Mecánica", "Energética", "Biológica"];

export const ORIS_FAMILIA_ICON: Record<OrisFamilia, React.ElementType> = {
  Mecánica: Atom,
  Energética: Sparkle,
  Biológica: Beaker,
};

/** Fila cruda tal cual vive en Supabase (tabla "oris"). */
export interface Oris {
  id: string;
  orden: number;
  nombre: string;
  familia: OrisFamilia;
  formula: string;
  dominio: string;
  descripcion?: string | null;
}

export const ORIS_CONFIG = {
  tabla: "oris",
  select: "id, orden, nombre, familia, formula, dominio, descripcion",
};

/** Fila cruda tal cual vive en Supabase (tabla "fisica_conceptos"). */
export interface FisicaConcepto {
  id: string;
  orden: number;
  bloque: string;
  titulo: string;
  contenido: string;
}

export const FISICA_CONCEPTOS_CONFIG = {
  tabla: "fisica_conceptos",
  select: "id, orden, bloque, titulo, contenido",
};

/** Agrupa conceptos por su campo "bloque", preservando orden. */
export function agruparPorBloque(
  conceptos: FisicaConcepto[],
): { bloque: string; items: FisicaConcepto[] }[] {
  const grupos: { bloque: string; items: FisicaConcepto[] }[] = [];
  const indice = new Map<string, number>();
  for (const c of conceptos) {
    if (!indice.has(c.bloque)) {
      indice.set(c.bloque, grupos.length);
      grupos.push({ bloque: c.bloque, items: [] });
    }
    grupos[indice.get(c.bloque)!].items.push(c);
  }
  return grupos;
}

// ─── Catálogos fijos: Partícula Base e Iums ────────────────────────────────
// No tienen CRUD ni tabla propia — son constantes del sistema, igual que
// PARTICLE_TYPES en elementos/types.ts. Se muestran como referencia fija
// arriba de los Oris en la tab Física.

export interface FilaCatalogo {
  nombre: string;
  detalle: string;
  extra?: string;
}

export const PARTICULAS_BASE: FilaCatalogo[] = [
  { nombre: "Tesis (A)", detalle: "Impulso, voluntad, lo que empuja." },
  { nombre: "Antítesis (T)", detalle: "Inercia, resistencia, lo que limita." },
  {
    nombre: "Síntesis (S)",
    detalle: "Transformación, equilibrio, lo que surge del choque entre A y T.",
  },
];

// ─── Partículas (capa intermedia Base → Partículas → Ium) ─────────────────
// A diferencia de Base/Ium, esta capa SÍ vive en Supabase (tabla
// "particulas"): son las 11 combinaciones originales de Tesis/Antítesis/
// Síntesis más las 16 combinaciones restantes del espacio 3³=27 (marcadas
// con es_teorica=true — inestables/no manifestadas en el mundo tras la
// ruptura del Garin), para poder nombrarlas, editarlas y ampliarlas sin
// tocar código.

/** Fila cruda tal cual vive en Supabase (tabla "particulas"). */
export interface Particula {
  id: string;
  orden: number;
  nombre: string;
  /** Combinación de 3 letras A/T/S, ej. "AAA", "SAT". */
  formula: string;
  extra?: string | null;
  /** Suma de A=+1/T=-1/S=0 sobre la fórmula — polaridad neta. */
  vector_neto?: number | null;
  /** Cantidad de "S" en la fórmula (0 a 3). */
  s_count?: number | null;
  /** true = parte de las 16 combinaciones no manifestadas originalmente,
   *  añadidas para completar el espacio de 27; false = las 11 originales. */
  es_teorica: boolean;
}

export const PARTICULAS_CONFIG = {
  tabla: "particulas",
  select: "id, orden, nombre, formula, extra, vector_neto, s_count, es_teorica",
};

/** Adapta una Particula (Supabase) al shape FilaCatalogo usado por las
 *  vistas de catálogo compartidas con Base/Ium. */
export function particulaAFilaCatalogo(p: Particula): FilaCatalogo {
  return { nombre: p.nombre, detalle: p.formula, extra: p.extra ?? undefined };
}

export const IUMS: FilaCatalogo[] = [
  { nombre: "Pondus", detalle: "3 Masa", extra: "Peso puro, lo que ancla" },
  { nombre: "Velox", detalle: "3 Cinética", extra: "Movimiento puro" },
  { nombre: "Fluxor", detalle: "2 Cinética + 1 Masa", extra: "Flujo que arrastra" },
  {
    nombre: "Fulgor",
    detalle: "2 Potencial + 1 Cinética",
    extra: "Carga que estalla en movimiento",
  },
  {
    nombre: "Patrix",
    detalle: "2 Información + 1 Potencial",
    extra: "Patrón que espera activarse",
  },
  { nombre: "Tensia", detalle: "3 Potencial", extra: "Tensión latente sin liberar" },
  { nombre: "Formix", detalle: "2 Masa + 1 Información", extra: "Estructura que se repite" },
  {
    nombre: "Voluntas",
    detalle: "2 Voluntad + 1 Percepción",
    extra: "Impulso con conciencia de objetivo",
  },
  {
    nombre: "Sensia",
    detalle: "2 Percepción + 1 Voluntad",
    extra: "Conciencia que absorbe antes de actuar",
  },
  {
    nombre: "Metus",
    detalle: "2 Transición + 1 Catálisis",
    extra: "Cambio de estado que se dispara y se sostiene",
  },
  {
    nombre: "Ruina",
    detalle: "2 Entropía + 1 Ciclo",
    extra: "Desorden que se repite, desgaste constante",
  },
];
