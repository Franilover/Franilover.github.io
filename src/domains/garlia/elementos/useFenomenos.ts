"use client";

import { useSupabaseData } from "@/infra/sync/useSupabaseData";
import { CONFIG_FENOMENOS, type Fenomeno } from "./types";

export function useFenomenos() {
  const { data, setData, loading } = useSupabaseData<Fenomeno>(CONFIG_FENOMENOS.tabla, {
    select: CONFIG_FENOMENOS.select,
    order: { campo: "created_at" },
  });

  return { items: data, setItems: setData, loading };
}
