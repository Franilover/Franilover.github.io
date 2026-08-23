/**
 * types.ts (Flora mejorado)
 * ───────────────────────────────────────────────────────────────────────────
 * Entidad Flora extendida: ahora incluye órganos individuales (hoja, pétalo,
 * raíz, fruto, tallo) cada uno con su propia fórmula química (JSONB), y
 * procesos del ciclo de vida (fotosíntesis, floración, fructificación, etc)
 * que describen qué consume y qué produce en cada etapa.
 *
 * "Órgano" ya NO es una entidad propia: es un GrupoCompuesto con
 * tipo="organo" (ver elementos/types.ts) — se reutiliza el mismo catálogo
 * y editor que "Grupos de compuestos", solo filtrado por tag. Esto evita
 * mantener dos tablas de fórmulas reutilizables ({compuesto_id,cantidad}[])
 * en paralelo.
 */

import type { Organo } from "@/domains/garlia/elementos/types";

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
 * Vínculo N:N entre Flora y Organo. Tabla puente real `planta_organos` →
 * `organos.id`. La columna `grupo_compuesto_id` es el nombre histórico
 * (de cuando existía una tabla unificada "grupos_compuestos") pero hoy
 * apunta a organos.id.
 */
export interface PlantaOrgano {
  id: string;
  planta_id: string;
  /** FK a organos.id (nombre de columna histórico). */
  grupo_compuesto_id: string;
  created_at: string;
}

/**
 * Vista combinada usada por la UI: el vínculo puente + los datos del
 * Organo ya resueltos, para no tener que hacer el join a mano en cada
 * componente que solo necesita "los órganos de esta planta". La fórmula
 * de compuestos (Tejidos/Células) se resuelve aparte, vía
 * useOrganoTejidos, sobre el id de este Organo. `vinculo_id` es el id de
 * la fila puente (PlantaOrgano.id) — necesario para poder desvincular
 * sin borrar el Organo del catálogo.
 */
export interface PlantaOrganoResuelto extends Organo {
  vinculo_id: string;
}

/**
 * Etapa del ciclo de vida de una planta (ej. "Floración", "Fructificación").
 * Ya NO tiene consume/produce propios ni nombre — es un contenedor que
 * vincula 1:1 una Reacción del catálogo global de Química vía reaccion_id.
 * La Reacción vinculada trae su propio nombre, consume/produce y balance —
 * ver useReacciones / useEntidadVinculoReaccion.
 */
export interface PlantaProceso {
  id: string;
  planta_id: string;
  /** Reacción vinculada del catálogo global — 1:1, null si aún no se eligió. */
  reaccion_id: string | null;
  /** Descripción libre de la etapa (condiciones ambientales, contexto, etc) */
  descripcion: string | null;
  /** Orden de la etapa en el ciclo de vida — persiste el drag-and-drop. */
  orden: number;
  created_at: string;
}

export type FloraInput = Partial<
  Pick<
    Flora,
    "nombre" | "imagen_url" | "descripcion" | "compuesto_id" | "componentes" | "notas" | "orden"
  >
>;

export type PlantaProcesoInput = Partial<Pick<PlantaProceso, "reaccion_id" | "descripcion" | "orden">>;
