"use client";

import { useMemo } from "react";

import { CONFIG_PROCESO_REACCIONES, type ProcesoReaccion } from "./types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

/** Reacciones asociadas a un Proceso, ordenadas por "orden" — mismo patrón
 *  que useMaterialComponentes/useMaterialEstructuras. */
export function useProcesoReacciones(procesoId?: string | null) {
  const { data, loading } = useSupabaseData<ProcesoReaccion>(
    CONFIG_PROCESO_REACCIONES.tabla,
    {
      select: CONFIG_PROCESO_REACCIONES.select,
      order: { campo: "orden" },
    },
  );

  const items = useMemo(
    () => (procesoId ? data.filter((item) => item.proceso_id === procesoId) : []),
    [data, procesoId],
  );

  return { items, loading };
}
