"use client";

import { useSupabaseData } from "@/infra/sync/useSupabaseData";
import { CONFIG_PROCESOS, type Proceso } from "./types";

export function useProcesos() {
  const { data, setData, loading } = useSupabaseData<Proceso>(CONFIG_PROCESOS.tabla, {
    select: CONFIG_PROCESOS.select,
    order: { campo: "created_at" },
  });

  return { items: data, setItems: setData, loading };
}
