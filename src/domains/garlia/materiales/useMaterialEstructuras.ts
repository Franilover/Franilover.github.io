"use client";

import { useMemo } from "react";

import {
  CONFIG_MATERIAL_ESTRUCTURAS,
  type MaterialEstructura,
} from "@/domains/garlia/materiales/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export function useMaterialEstructuras(materialId?: string | null) {
  const { data, loading } = useSupabaseData<MaterialEstructura>(
    CONFIG_MATERIAL_ESTRUCTURAS.tabla,
    {
      select: CONFIG_MATERIAL_ESTRUCTURAS.select,
      order: { campo: "created_at" },
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
