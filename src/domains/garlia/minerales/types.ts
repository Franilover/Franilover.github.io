/**
 * types.ts (Minerales)
 * ───────────────────────────────────────────────────────────────────────────
 * Entidad plana (mismo molde que Flora/Item/Ecosistema): nombre, imagen,
 * descripción, notas. Ahora extendida con el mismo patrón que Flora:
 * - Formaciones: partes del mineral con fórmula propia (veta, inclusión,
 *   capa, núcleo, superficie, cristal…). "Formación" es una fila real de la
 *   tabla propia "formaciones" (ver elementos/types.ts), vinculada N:N vía
 *   la tabla puente mineral_formaciones (mismo patrón que planta_organos en
 *   Flora). Esto permite reutilizar la misma formación entre varios
 *   minerales, e incluso compartirla con la Estructura de Items. Una
 *   Formación ya NO tiene columna `componentes` inline: su fórmula vive dos
 *   niveles más abajo, vía formacion_vetas→Veta→Grano→Compuesto (ver
 *   useFormacionVetas).
 * - Procesos: eventos geológicos de formación/transformación
 *   (cristalización, oxidación, metamorfismo…) con consume/produce —
 *   mismo shape que PlantaProceso, pero SIN orden/secuencia: a diferencia
 *   del ciclo de vida de una planta, los procesos geológicos de un mineral
 *   no tienen un orden narrativo único (puede oxidarse sin metamorfizar,
 *   o al revés), así que no hay drag-and-drop ni columna `orden`.
 */

import type { Formacion } from "@/domains/garlia/elementos/types";

export interface Mineral {
  id: string;
  nombre: string;
  imagen_url: string | null;
  descripcion: string;
  /** @deprecated Legado: un solo compuesto. Se mantiene por compatibilidad. */
  compuesto_id: string | null;
  /** @deprecated Legado: composición plana sin estructura. Reemplazada por
   *  Formaciones (tabla "formaciones" vinculada vía mineral_formaciones).
   *  Se mantiene por compatibilidad con datos viejos aún no migrados —
   *  ver migración one-shot en useMineralFormacionesProcesos, que ahora
   *  escribe en la tabla "mineral_formaciones_legado" en vez de perder
   *  este campo. */
  componentes: { compuesto_id: string; tag: string }[];
  notas: string;
  orden: number;
  created_at: string;
  updated_at: string;
}

/**
 * Vínculo N:N entre Mineral y Formacion. Tabla puente real
 * "mineral_formaciones" → formaciones.id. La columna `grupo_compuesto_id`
 * es el nombre histórico (de cuando existía una tabla unificada
 * "grupos_compuestos"/"estructuras_ensambladas") pero hoy apunta a
 * formaciones.id.
 */
export interface MineralFormacionVinculo {
  id: string;
  mineral_id: string;
  /** FK a formaciones.id (nombre de columna histórico). */
  grupo_compuesto_id: string;
  created_at: string;
}

/**
 * Vista combinada usada por la UI: el vínculo puente + los datos de la
 * Formacion ya resueltos — mismo espíritu que PlantaOrganoResuelto en
 * Flora. `vinculo_id` es el id de la fila puente (MineralFormacionVinculo.id),
 * necesario para desvincular sin borrar la formación del catálogo.
 */
export interface MineralFormacion extends Formacion {
  vinculo_id: string;
}

/**
 * Evento geológico de formación/transformación de un mineral (ej.
 * "Cristalización", "Oxidación"). Ya NO tiene consume/produce propios ni
 * nombre — es un contenedor que vincula 1:1 una Reacción del catálogo
 * global de Química vía reaccion_id, mismo patrón que PlantaProceso en
 * Flora. La Reacción vinculada trae su propio nombre, consume/produce y
 * balance.
 */
export interface MineralProceso {
  id: string;
  mineral_id: string;
  /** Reacción vinculada del catálogo global — 1:1, null si aún no se eligió. */
  reaccion_id: string | null;
  descripcion: string | null;
  created_at: string;
}

export type MineralInput = Partial<
  Pick<
    Mineral,
    "nombre" | "imagen_url" | "descripcion" | "compuesto_id" | "componentes" | "notas" | "orden"
  >
>;

export type MineralProcesoInput = Partial<Pick<MineralProceso, "reaccion_id" | "descripcion">>;
