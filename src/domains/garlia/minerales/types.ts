/**
 * types.ts (Minerales)
 * ───────────────────────────────────────────────────────────────────────────
 * Entidad plana (mismo molde que Flora/Item/Ecosistema): nombre, imagen,
 * descripción, notas. Ahora extendida con el mismo patrón que Flora:
 * - Formaciones: partes del mineral con fórmula propia (veta, inclusión,
 *   capa, núcleo, superficie, cristal…). "Formación" ya NO es una entidad
 *   1:1 propia de mineral_formaciones: es un GrupoCompuesto con
 *   tipo="formacion" (ver elementos/types.ts), vinculado N:N vía la tabla
 *   puente mineral_formaciones (mismo patrón que planta_organos en Flora).
 *   Esto permite reutilizar la misma formación entre varios minerales y
 *   reutiliza el catálogo/editor de "Grupos de compuestos" tal cual.
 * - Procesos: eventos geológicos de formación/transformación
 *   (cristalización, oxidación, metamorfismo…) con consume/produce —
 *   mismo shape que PlantaProceso, pero SIN orden/secuencia: a diferencia
 *   del ciclo de vida de una planta, los procesos geológicos de un mineral
 *   no tienen un orden narrativo único (puede oxidarse sin metamorfizar,
 *   o al revés), así que no hay drag-and-drop ni columna `orden`.
 */

import type { GrupoCompuesto } from "@/domains/garlia/elementos/types";

export interface Mineral {
  id: string;
  nombre: string;
  imagen_url: string | null;
  descripcion: string;
  /** @deprecated Legado: un solo compuesto. Se mantiene por compatibilidad. */
  compuesto_id: string | null;
  /** @deprecated Legado: composición plana sin estructura. Reemplazada por
   *  Formaciones (grupos_compuestos vinculados vía mineral_formaciones). Se
   *  mantiene por compatibilidad con datos viejos ya migrados. */
  componentes: { compuesto_id: string; tag: string }[];
  notas: string;
  orden: number;
  created_at: string;
  updated_at: string;
}

/**
 * Vínculo N:N entre Mineral y GrupoCompuesto (con tipo="formacion").
 * Reemplaza a la vieja fila-completa `mineral_formaciones` (que antes tenía
 * nombre/componentes/notas propios, 1:1 con mineral_id): ahora esa misma
 * tabla es solo el vínculo puente, y el nombre/fórmula/notas viven en el
 * GrupoCompuesto referenciado — igual que planta_organos en Flora.
 */
export interface MineralFormacionVinculo {
  id: string;
  mineral_id: string;
  /** FK a grupos_compuestos.id. */
  grupo_compuesto_id: string;
  created_at: string;
}

/**
 * Vista combinada usada por la UI: el vínculo puente + los datos del
 * GrupoCompuesto ya resueltos — mismo espíritu que PlantaOrganoResuelto en
 * Flora. `vinculo_id` es el id de la fila puente (MineralFormacionVinculo.id),
 * necesario para desvincular sin borrar la formación del catálogo.
 */
export interface MineralFormacion extends GrupoCompuesto {
  vinculo_id: string;
}

/**
 * Evento geológico de formación/transformación de un mineral (ej.
 * "Cristalización", "Oxidación"). Ya NO tiene consume/produce propios ni
 * nombre — es un contenedor que vincula N:N Reacciones del catálogo global
 * de Química (tabla puente `mineral_proceso_reacciones`), mismo patrón que
 * PlantaProceso en Flora. Cada Reacción vinculada trae su propio nombre,
 * consume/produce y balance.
 */
export interface MineralProceso {
  id: string;
  mineral_id: string;
  descripcion: string | null;
  created_at: string;
  updated_at: string;
}

/** Vínculo N:N entre MineralProceso y Reaccion (tabla puente `mineral_proceso_reacciones`). */
export interface MineralProcesoReaccion {
  id: string;
  mineral_proceso_id: string;
  reaccion_id: string;
  created_at: string;
}

export type MineralInput = Partial<
  Pick<
    Mineral,
    "nombre" | "imagen_url" | "descripcion" | "compuesto_id" | "componentes" | "notas" | "orden"
  >
>;

export type MineralProcesoInput = Partial<Pick<MineralProceso, "descripcion">>;
