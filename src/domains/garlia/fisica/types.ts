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
  /** Mezcla de Iums que compone este Oris: { [iumId]: cantidad }. Se usa
   *  para calcular su gráfico A/T/S (ver contarLetrasDeOris) — igual que
   *  un Compuesto es mezcla de Elementos en la Tabla Química. */
  iums_composicion: Record<string, number>;
}

export const ORIS_CONFIG = {
  tabla: "oris",
  select: "id, orden, nombre, familia, formula, dominio, descripcion, iums_composicion",
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

/** Fila de Partícula Base: además de nombre/detalle, trae su letra A/T/S
 *  suelta (no una fórmula de 3) para poder dibujar su círculo de un solo
 *  color con ParticulaVisual. */
export interface FilaParticulaBase extends FilaCatalogo {
  letra: "A" | "T" | "S";
}

export const PARTICULAS_BASE: FilaParticulaBase[] = [
  { nombre: "Tesis (A)", detalle: "Impulso, voluntad, lo que empuja.", letra: "A" },
  { nombre: "Antítesis (T)", detalle: "Inercia, resistencia, lo que limita.", letra: "T" },
  {
    nombre: "Síntesis (S)",
    detalle: "Transformación, equilibrio, lo que surge del choque entre A y T.",
    letra: "S",
  },
];

// ─── Partículas (capa intermedia Base → Partículas → Ium) ─────────────────
// A diferencia de Base/Ium, esta capa SÍ vive en Supabase (tabla
// "particulas"): son las 11 combinaciones de Tesis/Antítesis/Síntesis que
// representan clases distintas dentro del espacio 3³=27. Las 16 combinaciones
// restantes se exploraron como partículas candidatas y luego se eliminaron
// (12/08/2026, ver "Partículas teóricas descartadas" en fisica_conceptos) al
// confirmar que son rotaciones de estas 11 — mismo grado de libertad visto en
// otra fase del ciclo A→T→S, no partículas nuevas ("Ley de Equivalencia
// Rotacional"). El campo es_teorica queda en el schema por compatibilidad,
// pero ya no debería haber filas con es_teorica=true.

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

/** Fila de Ium: además de nombre/detalle/extra, trae un id estable (slug)
 *  y su composición como lista de {particula de Química, cantidad} — usada
 *  para calcular el gráfico A/T/S (ver PARTICULA_QUIMICA_FORMULA +
 *  composicionIum en ParticulaVisual/este archivo). */
export interface FilaIum extends FilaCatalogo {
  id: string;
  composicion: { particula: string; cantidad: number }[];
}

export const IUMS: FilaIum[] = [
  {
    id: "pondus",
    nombre: "Pondus",
    detalle: "3 Masa",
    extra: "Peso puro, lo que ancla",
    composicion: [{ particula: "Masa", cantidad: 3 }],
  },
  {
    id: "velox",
    nombre: "Velox",
    detalle: "3 Cinética",
    extra: "Movimiento puro",
    composicion: [{ particula: "Cinética", cantidad: 3 }],
  },
  {
    id: "fluxor",
    nombre: "Fluxor",
    detalle: "2 Cinética + 1 Masa",
    extra: "Flujo que arrastra",
    composicion: [
      { particula: "Cinética", cantidad: 2 },
      { particula: "Masa", cantidad: 1 },
    ],
  },
  {
    id: "fulgor",
    nombre: "Fulgor",
    detalle: "2 Potencial + 1 Cinética",
    extra: "Carga que estalla en movimiento",
    composicion: [
      { particula: "Potencial", cantidad: 2 },
      { particula: "Cinética", cantidad: 1 },
    ],
  },
  {
    id: "patrix",
    nombre: "Patrix",
    detalle: "2 Información + 1 Potencial",
    extra: "Patrón que espera activarse",
    composicion: [
      { particula: "Información", cantidad: 2 },
      { particula: "Potencial", cantidad: 1 },
    ],
  },
  {
    id: "tensia",
    nombre: "Tensia",
    detalle: "3 Potencial",
    extra: "Tensión latente sin liberar",
    composicion: [{ particula: "Potencial", cantidad: 3 }],
  },
  {
    id: "formix",
    nombre: "Formix",
    detalle: "2 Masa + 1 Información",
    extra: "Estructura que se repite",
    composicion: [
      { particula: "Masa", cantidad: 2 },
      { particula: "Información", cantidad: 1 },
    ],
  },
  {
    id: "voluntas",
    nombre: "Voluntas",
    detalle: "2 Voluntad + 1 Percepción",
    extra: "Impulso con conciencia de objetivo",
    composicion: [
      { particula: "Voluntad", cantidad: 2 },
      { particula: "Percepción", cantidad: 1 },
    ],
  },
  {
    id: "sensia",
    nombre: "Sensia",
    detalle: "2 Percepción + 1 Voluntad",
    extra: "Conciencia que absorbe antes de actuar",
    composicion: [
      { particula: "Percepción", cantidad: 2 },
      { particula: "Voluntad", cantidad: 1 },
    ],
  },
  {
    id: "metus",
    nombre: "Metus",
    detalle: "2 Transición + 1 Catálisis",
    extra: "Cambio de estado que se dispara y se sostiene",
    composicion: [
      { particula: "Transición", cantidad: 2 },
      { particula: "Catálisis", cantidad: 1 },
    ],
  },
  {
    id: "ruina",
    nombre: "Ruina",
    detalle: "2 Entropía + 1 Ciclo",
    extra: "Desorden que se repite, desgaste constante",
    composicion: [
      { particula: "Entropía", cantidad: 2 },
      { particula: "Ciclo", cantidad: 1 },
    ],
  },
];

export const IUM_POR_ID: Record<string, FilaIum> = Object.fromEntries(IUMS.map((i) => [i.id, i]));

/**
 * Fórmula A/T/S (3 letras) de cada una de las 11 Partículas de Química —
 * mismo nombre que ParticleType en elementos/types.ts, pero acá es el
 * mapeo hacia el sistema de Física (tabla "particulas" en Supabase).
 * Duplicado como constante fija en vez de fetch porque no cambia (mismo
 * criterio que PARTICULAS_BASE/IUMS) y evita acoplar este archivo al
 * fetch de useParticulas() solo para dibujar íconos.
 */
export const PARTICULA_QUIMICA_FORMULA: Record<string, string> = {
  Masa: "AAA",
  Cinética: "TTT",
  Potencial: "TAA",
  Información: "ATT",
  Voluntad: "TTA",
  Percepción: "AAT",
  Transición: "ASA",
  Ciclo: "TST",
  Entropía: "SAT",
  Catálisis: "ATS",
  Equilibrio: "SSS",
};

/** Conteo de letras A/T/S de una lista de {particula de Química, cantidad}
 *  — usado tanto para el Ium (composicion fija) como para el Oris
 *  (iums_composicion → cada Ium aporta su propio conteo × cantidad). */
export function contarLetrasDeComposicion(
  composicion: { particula: string; cantidad: number }[],
): { A: number; T: number; S: number } {
  const out = { A: 0, T: 0, S: 0 };
  for (const { particula, cantidad } of composicion) {
    const formula = PARTICULA_QUIMICA_FORMULA[particula];
    if (!formula) continue;
    for (const c of formula) {
      if (c === "A" || c === "T" || c === "S") out[c] += cantidad;
    }
  }
  return out;
}

/** Conteo de letras A/T/S de un Ium por su composición fija. */
export function contarLetrasDeIum(ium: FilaIum): { A: number; T: number; S: number } {
  return contarLetrasDeComposicion(ium.composicion);
}

/** Conteo de letras A/T/S de un Oris a partir de iums_composicion
 *  ({ [iumId]: cantidad }): cada Ium aporta su propio conteo × cantidad. */
export function contarLetrasDeOris(iumsComposicion: Record<string, number>): {
  A: number;
  T: number;
  S: number;
} {
  const out = { A: 0, T: 0, S: 0 };
  for (const [iumId, cantidad] of Object.entries(iumsComposicion)) {
    const ium = IUM_POR_ID[iumId];
    if (!ium || !cantidad) continue;
    const letras = contarLetrasDeIum(ium);
    out.A += letras.A * cantidad;
    out.T += letras.T * cantidad;
    out.S += letras.S * cantidad;
  }
  return out;
}
