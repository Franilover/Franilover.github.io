"use client";

/**
 * useSistemas.ts
 * ────────────────────────
 * Catálogo de Sistemas (tabla real "sistemas"): nombre/descripción/notas,
 * sin fórmula propia — la composición vive debajo, en Órganos (ver
 * useSistemaOrganos.ts). Mismo patrón que useOrganos.ts, un nivel arriba
 * en la cadena Célula → Tejido → Órgano → Sistema → Organismo.
 */

import { useMemo } from "react";

import { CONFIG_SISTEMAS, type Sistema } from "@/domains/garlia/elementos/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export function useSistemas() {
  const { data, setData, loading } = useSupabaseData<Sistema>(CONFIG_SISTEMAS.tabla, {
    select: CONFIG_SISTEMAS.select,
    order: { campo: "created_at" },
  });

  const items = useMemo(() => data, [data]);

  return { items, setItems: setData, loading };
}
