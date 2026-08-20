"use client";

/**
 * useGruposCompuestos.ts
 * ────────────────────────
 * Catálogo de Grupos de Compuestos: conjuntos reutilizables de Compuestos
 * con cantidad (ej. "Base floral" = Fluxio×2 + Cristalio×1), pensados para
 * usarse como fórmula ya armada en un Órgano de Flora u otro lugar que
 * consuma una lista de {compuesto_id, cantidad}.
 *
 * Mismo patrón que useCompuestos.ts — useSupabaseData con select fijo,
 * ordenado por fecha de creación.
 */

import { useMemo } from "react";

import { CONFIG_GRUPOS_COMPUESTOS, type GrupoCompuesto } from "@/domains/garlia/elementos/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export function useGruposCompuestos() {
  const { data, setData, loading } = useSupabaseData<GrupoCompuesto>(
    CONFIG_GRUPOS_COMPUESTOS.tabla,
    {
      select: CONFIG_GRUPOS_COMPUESTOS.select,
      order: { campo: "created_at" },
    },
  );

  const items = useMemo(() => data, [data]);

  return { items, setItems: setData, loading };
}
