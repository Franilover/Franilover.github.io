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

/** Órganos individuales de una planta, cada uno con fórmula química propia */
export interface PlantaOrgano {
  id: string;
  planta_id: string;
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

export type PlantaOrganoInput = Partial<
  Pick<PlantaOrgano, "nombre" | "componentes" | "compuesto_base_id" | "notas">
>;

export type PlantaProcesoInput = Partial<
  Pick<PlantaProceso, "nombre" | "consume" | "produce" | "descripcion">
>;
