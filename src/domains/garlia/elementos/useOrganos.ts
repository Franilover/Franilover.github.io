"use client";

/**
 * useOrganos.ts
 * ────────────────────────
 * Catálogo de Órganos (tabla real "organos"): nombre/función/notas, sin
 * fórmula propia — la composición vive debajo, en Tejidos/Células (ver
 * useOrganoTejidos.ts). Se vincula N:N a plantas (planta_organos),
 * criaturas (criatura_organos) e items (item_estructura), todas vía la
 * columna puente `grupo_compuesto_id` (nombre histórico, hoy apunta a
 * organos.id).
 *
 * Reemplaza a useEstructurasEnsambladas.ts, que apuntaba a la tabla ya
 * eliminada "estructuras_ensambladas". Mismo patrón useSupabaseData que
 * useCompuestos.ts.
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
