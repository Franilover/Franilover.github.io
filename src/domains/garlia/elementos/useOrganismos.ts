"use client";

/**
 * useOrganismos.ts
 * ────────────────────────
 * Catálogo de Organismos (tabla real "organismos"): nombre/descripción/notas,
 * sin fórmula propia — la composición vive debajo, en Sistemas (ver
 * useOrganismoSistemas.ts). Techo de la cadena biológica:
 *   Célula → Tejido → Órgano → Sistema → Organismo
 * Mismo patrón que useOrganos.ts / useSistemas.ts.
 */

import { useMemo } from "react";

import { CONFIG_ORGANISMOS, type Organismo } from "@/domains/garlia/elementos/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export function useOrganismos() {
  const { data, setData, loading } = useSupabaseData<Organismo>(CONFIG_ORGANISMOS.tabla, {
    select: CONFIG_ORGANISMOS.select,
    order: { campo: "created_at" },
  });

  const items = useMemo(() => data, [data]);

  return { items, setItems: setData, loading };
}
