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

/** Adapta un Oris (Supabase) al shape FilaCatalogo usado por las vistas de
 *  catálogo compartidas con Base/Ium/Partículas. */
export function orisAFilaCatalogo(o: Oris): FilaCatalogo {
  return { nombre: o.nombre, detalle: o.dominio || o.formula, extra: o.familia };
}

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

// ─── Catálogos: Partícula Base e Iums ──────────────────────────────────────
// Viven en Supabase (tablas "particulas_base" e "iums") — mismo criterio que
// "particulas": son catálogos fijos en contenido pero editables desde ahí,
// no constantes hardcodeadas. Se muestran como referencia fija arriba de
// los Oris en la tab Física.

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

/** Fila cruda tal cual vive en Supabase (tabla "particulas_base"). */
export interface ParticulaBase {
  id: string;
  orden: number;
  letra: "T" | "A" | "S";
  nombre: string;
  detalle: string;
}

export const PARTICULAS_BASE_CONFIG = {
  tabla: "particulas_base",
  select: "id, orden, letra, nombre, detalle",
};

/** Adapta una ParticulaBase (Supabase) al shape FilaParticulaBase usado por
 *  las vistas de catálogo. */
export function particulaBaseAFilaCatalogo(p: ParticulaBase): FilaParticulaBase {
  return { nombre: p.nombre, detalle: p.detalle, letra: p.letra };
}

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
 *  contarLetrasDeIum en este archivo). */
export interface FilaIum extends FilaCatalogo {
  id: string;
  composicion: { particula: string; cantidad: number }[];
}

/** Fila cruda tal cual vive en Supabase (tabla "iums"). */
export interface Ium {
  id: string;
  orden: number;
  nombre: string;
  detalle: string;
  extra?: string | null;
  composicion: { particula: string; cantidad: number }[];
}

export const IUMS_CONFIG = {
  tabla: "iums",
  select: "id, orden, nombre, detalle, extra, composicion",
};

/** Adapta un Ium (Supabase) al shape FilaIum usado por las vistas de
 *  catálogo y por las funciones utilitarias de este archivo. */
export function iumAFilaIum(i: Ium): FilaIum {
  return {
    id: i.id,
    nombre: i.nombre,
    detalle: i.detalle,
    extra: i.extra ?? undefined,
    composicion: i.composicion,
  };
}

/**
 * Fórmula A/T/S (3 letras) de cada una de las 11 Partículas de Química —
 * mismo nombre que ParticleType en elementos/types.ts, pero acá es el
 * mapeo hacia el sistema de Física. Refleja la convención actual
 * (T=Tesis/impulso, A=Antítesis/resistencia) ya aplicada en la tabla
 * "particulas" de Supabase — ver migración de convención A↔T.
 * Duplicado como constante fija en vez de fetch porque no cambia y evita
 * acoplar este archivo al fetch de useParticulas() solo para dibujar
 * íconos.
 */
export const PARTICULA_QUIMICA_FORMULA: Record<string, string> = {
  Masa: "TTT",
  Cinética: "AAA",
  Potencial: "ATT",
  Información: "TAA",
  Voluntad: "AAT",
  Percepción: "TTA",
  Transición: "TST",
  Ciclo: "ASA",
  Entropía: "STA",
  Catálisis: "TAS",
  Equilibrio: "SSS",
};

/** Inicial corta de cada Partícula de Química — para el modo "iniciales"
 *  de IumVisual (mismo criterio que PARTICLE_INITIAL en elementos/types.ts):
 *  cada círculo muestra la letra de su Partícula en vez de sus 3 tercios A/T/S. */
export const PARTICULA_INITIAL: Record<string, string> = {
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

/** Lista de partículas componentes de un Ium con su fórmula A/T/S real,
 *  expandida en entradas individuales (una por cada unidad, sin agrupar
 *  por cantidad) — para dibujar cada una como círculo propio orbitando
 *  (ver IumVisual en ParticulaVisual.tsx). Ej. Fluxor (2×Cinética + 1×Masa)
 *  → [Cinética, Cinética, Masa], 3 entradas individuales. */
export function particulasDeIum(
  ium: FilaIum,
): { nombre: string; formula: string }[] {
  const out: { nombre: string; formula: string }[] = [];
  for (const c of ium.composicion) {
    const formula = PARTICULA_QUIMICA_FORMULA[c.particula];
    if (!formula) continue;
    for (let i = 0; i < c.cantidad; i++) {
      out.push({ nombre: c.particula, formula });
    }
  }
  return out;
}

/** Lista de partículas componentes de un Oris a partir de iums_composicion,
 *  expandida en entradas individuales: cada Ium aporta sus propias
 *  Partículas (ya expandidas), repetidas tantas veces como el Ium aparezca
 *  en el Oris. Sin agrupar — se muestran siempre las partículas reales.
 *  Recibe iumPorId (armado desde useIums()) en vez de leer una constante
 *  global, ya que Iums ahora vive en Supabase. */
export function particulasDeOris(
  iumsComposicion: Record<string, number>,
  iumPorId: Record<string, FilaIum>,
): { nombre: string; formula: string }[] {
  const out: { nombre: string; formula: string }[] = [];
  for (const [iumId, cantidadIum] of Object.entries(iumsComposicion)) {
    const ium = iumPorId[iumId];
    if (!ium || !cantidadIum) continue;
    const particulas = particulasDeIum(ium);
    for (let i = 0; i < cantidadIum; i++) {
      out.push(...particulas);
    }
  }
  return out;
}

/** Conteo de letras A/T/S de un Oris a partir de iums_composicion
 *  ({ [iumId]: cantidad }): cada Ium aporta su propio conteo × cantidad.
 *  Recibe iumPorId (armado desde useIums()) en vez de leer una constante
 *  global, ya que Iums ahora vive en Supabase. */
export function contarLetrasDeOris(
  iumsComposicion: Record<string, number>,
  iumPorId: Record<string, FilaIum>,
): {
  A: number;
  T: number;
  S: number;
} {
  const out = { A: 0, T: 0, S: 0 };
  for (const [iumId, cantidad] of Object.entries(iumsComposicion)) {
    const ium = iumPorId[iumId];
    if (!ium || !cantidad) continue;
    const letras = contarLetrasDeIum(ium);
    out.A += letras.A * cantidad;
    out.T += letras.T * cantidad;
    out.S += letras.S * cantidad;
  }
  return out;
}
