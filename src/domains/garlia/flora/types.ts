/**
 * types.ts (Flora mejorado)
 * ───────────────────────────────────────────────────────────────────────────
 * Entidad Flora extendida: ahora incluye órganos individuales (hoja, pétalo,
 * raíz, fruto, tallo) cada uno con su propia fórmula química (JSONB), y
 * procesos del ciclo de vida (fotosíntesis, floración, fructificación, etc)
 * que describen qué consume y qué produce en cada etapa.
 */

export interface Flora {
  id: string;
  nombre: string;
  imagen_url: string | null;
  descripcion: string;
  /** @deprecated Legado: un solo compuesto. Se mantiene por compatibilidad. */
  compuesto_id: string | null;
  /** Composición material de la planta: partes hechas de compuestos distintos */
  componentes: { compuesto_id: string; tag: string }[];
  notas: string;
  orden: number;
  created_at: string;
  updated_at: string;
}

/**
 * Órgano: catálogo compartido (ya NO vive 1:1 dentro de una planta). Un
 * mismo Órgano (ej. "Raíz fibrosa") puede vincularse a varias plantas vía
 * PlantaOrgano — si se edita su fórmula acá, se actualiza en todas las
 * plantas que lo usan.
 */
export interface Organo {
  id: string;
  /** Nombre del órgano (texto libre: "hoja", "pétalo", "raíz", etc) */
  nombre: string;
  /** Fórmula del órgano: mezcla de Compuestos + cantidad (mismo lenguaje que consume/produce de Procesos y Composición de Flora) */
  componentes: Array<{ compuesto_id: string; cantidad: number }> | null;
  /** ID opcional de compuesto base (para derivar fórmulas sin escribir todo) */
  compuesto_base_id: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

/** Tabla puente N:N entre Flora y Organo (catálogo compartido). */
export interface PlantaOrgano {
  id: string;
  planta_id: string;
  organo_id: string;
  created_at: string;
}

/**
 * Vista combinada usada por la UI: el vínculo puente + los datos del
 * Órgano ya resueltos, para no tener que hacer el join a mano en cada
 * componente que solo necesita "los órganos de esta planta, con su
 * fórmula". `vinculo_id` es el id de la fila puente (PlantaOrgano.id) —
 * necesario para poder desvincular sin borrar el Organo del catálogo.
 */
export interface PlantaOrganoResuelto extends Organo {
  vinculo_id: string;
}

/** Procesos del ciclo de vida de una planta (fotosíntesis, floración, etc) */
export interface PlantaProceso {
  id: string;
  planta_id: string;
  /** Nombre del proceso (texto libre: "fotosíntesis", "floración", etc) */
  nombre: string;
  /** Qué consume: array de {tipo: 'elemento'|'compuesto', id, cantidad} */
  consume: Array<{ tipo: "elemento" | "compuesto"; id: string; cantidad: number }> | null;
  /** Qué produce: array de {tipo: 'elemento'|'compuesto', id, cantidad} */
  produce: Array<{ tipo: "elemento" | "compuesto"; id: string; cantidad: number }> | null;
  /** Descripción libre del proceso (incluye condiciones ambientales, etc) */
  descripcion: string | null;
  created_at: string;
  updated_at: string;
}

export type FloraInput = Partial<
  Pick<
    Flora,
    "nombre" | "imagen_url" | "descripcion" | "compuesto_id" | "componentes" | "notas" | "orden"
  >
>;

export type OrganoInput = Partial<
  Pick<Organo, "nombre" | "componentes" | "compuesto_base_id" | "notas">
>;

export type PlantaProcesoInput = Partial<
  Pick<PlantaProceso, "nombre" | "consume" | "produce" | "descripcion">
>;
