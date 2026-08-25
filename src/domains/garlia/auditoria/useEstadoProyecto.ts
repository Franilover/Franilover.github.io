"use client";

/**
 * useEstadoProyecto.ts
 * ────────────────────────
 * Registro maestro único de estado_proyecto (clave="maestro"). Mismo
 * patrón que useElementos/useCompuestos (useSupabaseData con select fijo),
 * con una diferencia: useSupabaseData no soporta filtros (siempre trae la
 * tabla completa), así que acá se trae la tabla entera —hoy 1 sola fila
 * real, "maestro"— y se toma esa fila en memoria en vez de agregar un
 * mecanismo de filtro nuevo a la infraestructura compartida solo para
 * este caso de uso puntual.
 *
 * Solo lectura: no se expone setItems, este panel nunca escribe acá.
 */

import { useMemo } from "react";

import { CONFIG_ESTADO_PROYECTO, type EstadoProyecto } from "@/domains/garlia/auditoria/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export function useEstadoProyecto() {
  const { data, loading } = useSupabaseData<EstadoProyecto>(CONFIG_ESTADO_PROYECTO.tabla, {
    select: CONFIG_ESTADO_PROYECTO.select,
  });

  const maestro = useMemo(
    () => data.find((fila) => fila.clave === "maestro") ?? null,
    [data],
  );

  return { maestro, loading };
}
