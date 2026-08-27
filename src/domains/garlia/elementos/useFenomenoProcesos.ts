"use client";

import { useMemo } from "react";

import { CONFIG_FENOMENO_PROCESOS, type FenomenoProceso } from "./types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

/** Procesos asociados a un Fenómeno — mismo patrón que
 *  useMaterialComponentes/useMaterialEstructuras. */
export function useFenomenoProcesos(fenomenoId?: string | null) {
  const { data, loading } = useSupabaseData<FenomenoProceso>(
    CONFIG_FENOMENO_PROCESOS.tabla,
    {
      select: CONFIG_FENOMENO_PROCESOS.select,
      order: { campo: "created_at" },
    },
  );

  const items = useMemo(
    () => (fenomenoId ? data.filter((item) => item.fenomeno_id === fenomenoId) : []),
    [data, fenomenoId],
  );

  return { items, loading };
}
