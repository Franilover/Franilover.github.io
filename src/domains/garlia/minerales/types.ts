/**
 * types.ts (Minerales)
 * ───────────────────────────────────────────────────────────────────────────
 * Entidad plana (mismo molde que Flora/Item/Ecosistema): nombre, imagen,
 * descripción, notas. Ahora extendida con el mismo patrón que Flora:
 * - Formaciones: partes del mineral con fórmula propia (veta, inclusión,
 *   capa, núcleo, superficie, cristal…) — reemplaza el antiguo campo plano
 *   `componentes` (composición sin estructura).
 * - Procesos: eventos geológicos de formación/transformación
 *   (cristalización, oxidación, metamorfismo…) con consume/produce —
 *   mismo shape que PlantaProceso, pero SIN orden/secuencia: a diferencia
 *   del ciclo de vida de una planta, los procesos geológicos de un mineral
 *   no tienen un orden narrativo único (puede oxidarse sin metamorfizar,
 *   o al revés), así que no hay drag-and-drop ni columna `orden`.
 */

export interface Mineral {
  id: string;
  nombre: string;
  imagen_url: string | null;
  descripcion: string;
  /** @deprecated Legado: un solo compuesto. Se mantiene por compatibilidad. */
  compuesto_id: string | null;
  /** @deprecated Legado: composición plana sin estructura. Reemplazada por
   *  MineralFormacion (ver mineral_formaciones). Se mantiene por
   *  compatibilidad con datos viejos ya migrados. */
  componentes: { compuesto_id: string; tag: string }[];
  notas: string;
  orden: number;
  created_at: string;
  updated_at: string;
}

/** Formaciones de un mineral: partes con fórmula propia (veta, inclusión, capa…) */
export interface MineralFormacion {
  id: string;
  mineral_id: string;
  tipo_formacion:
    | "veta"
    | "inclusion"
    | "capa"
    | "nucleo"
    | "superficie"
    | "cristal"
    | "otro";
  /** Fórmula de la formación: mezcla de Compuestos + cantidad (mismo lenguaje que PlantaOrgano.componentes) */
  componentes: Array<{ compuesto_id: string; cantidad: number }> | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

/** Procesos geológicos de formación/transformación de un mineral */
export interface MineralProceso {
  id: string;
  mineral_id: string;
  tipo_proceso:
    | "cristalizacion"
    | "sedimentacion"
    | "metamorfismo"
    | "oxidacion"
    | "erosion"
    | "fusion"
    | "otro";
  /** Qué consume: array de {tipo: 'elemento'|'compuesto', id, cantidad} */
  consume: Array<{ tipo: "elemento" | "compuesto"; id: string; cantidad: number }> | null;
  /** Qué produce: array de {tipo: 'elemento'|'compuesto', id, cantidad} */
  produce: Array<{ tipo: "elemento" | "compuesto"; id: string; cantidad: number }> | null;
  /** Condiciones geológicas (texto libre: "alta presión", "calor volcánico", "millones de años") */
  condiciones: string | null;
  descripcion: string | null;
  created_at: string;
  updated_at: string;
}

export type MineralInput = Partial<
  Pick<
    Mineral,
    "nombre" | "imagen_url" | "descripcion" | "compuesto_id" | "componentes" | "notas" | "orden"
  >
>;

export type MineralFormacionInput = Partial<
  Pick<MineralFormacion, "tipo_formacion" | "componentes" | "notas">
>;

export type MineralProcesoInput = Partial<
  Pick<MineralProceso, "tipo_proceso" | "consume" | "produce" | "condiciones" | "descripcion">
>;
