"use client";

import { useMemo } from "react";

import {
  CONFIG_MATERIALES,
  type Material,
} from "@/domains/garlia/materiales/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export function useMateriales() {
  const { data, loading } = useSupabaseData<Material>(
    CONFIG_MATERIALES.tabla,
    {
      select: CONFIG_MATERIALES.select,
      order: { campo: "orden" },
    },
  );

  const items = useMemo(() => data, [data]);

  return {
    items,
    loading,
  };
}
