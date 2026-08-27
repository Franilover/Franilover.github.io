"use client";

import { useMemo } from "react";

import { CONFIG_FENOMENO_ELEMENTOS, type FenomenoElemento } from "./types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

/** Elementos asociados a un Fenómeno — mismo patrón que
 *  useMaterialComponentes/useMaterialEstructuras. */
export function useFenomenoElementos(fenomenoId?: string | null) {
  const { data, loading } = useSupabaseData<FenomenoElemento>(
    CONFIG_FENOMENO_ELEMENTOS.tabla,
    {
      select: CONFIG_FENOMENO_ELEMENTOS.select,
      order: { campo: "created_at" },
    },
  );

  const items = useMemo(
    () => (fenomenoId ? data.filter((item) => item.fenomeno_id === fenomenoId) : []),
    [data, fenomenoId],
  );

  return { items, loading };
}
