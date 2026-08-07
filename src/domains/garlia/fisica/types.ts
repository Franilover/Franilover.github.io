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

// ─── Catálogos fijos: jerarquía Partícula Base → Partículas → Ium ─────────
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

export const PARTICULAS: FilaCatalogo[] = [
  { nombre: "Masa", detalle: "AAA", extra: "Fuerza en tensión" },
  { nombre: "Cinética", detalle: "TTT", extra: "Fuerza en tensión" },
  { nombre: "Potencial", detalle: "TAA", extra: "Fuerza en tensión" },
  { nombre: "Información", detalle: "ATT", extra: "Fuerza en tensión" },
  { nombre: "Voluntad", detalle: "TTA", extra: "Fuerza en tensión" },
  { nombre: "Percepción", detalle: "AAT", extra: "Fuerza en tensión" },
  { nombre: "Transición", detalle: "ASA", extra: "Resolución (cambio de estado)" },
  { nombre: "Ciclo", detalle: "TST", extra: "Resolución (repetición)" },
  { nombre: "Entropía", detalle: "SAT", extra: "Resolución (desorden)" },
  { nombre: "Catálisis", detalle: "ATS", extra: "Resolución (activación)" },
  { nombre: "Equilibrio", detalle: "SSS", extra: "Resolución (estabilidad pura)" },
];

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
