"use client";

import { useMemo } from "react";

import {
  CONFIG_MATERIAL_COMPONENTES,
  type MaterialComponente,
} from "@/domains/garlia/materiales/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export function useMaterialComponentes(materialId?: string | null) {
  const { data, loading } = useSupabaseData<MaterialComponente>(
    CONFIG_MATERIAL_COMPONENTES.tabla,
    {
      select: CONFIG_MATERIAL_COMPONENTES.select,
      order: { campo: "orden" },
    },
  );

  const items = useMemo(
    () =>
      materialId
        ? data.filter((item) => item.material_id === materialId)
        : [],
    [data, materialId],
  );

  return {
    items,
    loading,
  };
}
