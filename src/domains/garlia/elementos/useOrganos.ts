"use client";

/**
 * useOrganos.ts
 * ────────────────────────
 * Catálogo de Órganos: conjuntos reutilizables de Compuestos, pensados
 * para vincularse N:N a plantas de Flora (planta_organos.grupo_compuesto_id
 * → organos.id). Editar un Órgano acá actualiza todas las plantas que lo
 * usen.
 *
 * Antes vivían como GrupoCompuesto tipo="organo" dentro de
 * "grupos_compuestos"; desde el rediseño de Biología/Física tienen tabla
 * propia "organos" — mismo shape, mismo patrón useSupabaseData que
 * useCompuestos.ts / useGruposCompuestos.ts.
 */

import { useMemo } from "react";

import { CONFIG_ORGANOS, type Organo } from "@/domains/garlia/elementos/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export function useOrganos() {
  const { data, setData, loading } = useSupabaseData<Organo>(CONFIG_ORGANOS.tabla, {
    select: CONFIG_ORGANOS.select,
    order: { campo: "created_at" },
  });

  const items = useMemo(() => data, [data]);

  return { items, setItems: setData, loading };
}
