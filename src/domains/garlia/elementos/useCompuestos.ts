"use client";

/**
 * useCompuestos.ts
 * ────────────────────────
 * Catálogo de Compuestos: combinaciones de 2+ Elementos de la Tabla
 * Química (ej. "Agua" = Fluxio + Cristalio, "Fuego" = Plasmio + Reactivo).
 * Mismo patrón que useElementos.ts — useSupabaseData con select fijo,
 * ordenado por fecha de creación (los más nuevos al final, orden natural
 * de descubrimiento).
 */

import { useMemo } from "react";

import { CONFIG_COMPUESTOS, type Compuesto } from "@/domains/garlia/elementos/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export function useCompuestos() {
  const { data, setData, loading } = useSupabaseData<Compuesto>(CONFIG_COMPUESTOS.tabla, {
    select: CONFIG_COMPUESTOS.select,
    order: { campo: "created_at" },
  });

  const items = useMemo(() => data, [data]);

  return { items, setItems: setData, loading };
}
