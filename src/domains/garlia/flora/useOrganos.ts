"use client";

/**
 * useOrganos.ts
 * ────────────────────────
 * Catálogo global y compartido de Órganos (tabla "organos"): ya no vive
 * 1:1 dentro de una planta — un mismo Órgano (ej. "Raíz fibrosa") puede
 * estar vinculado a varias plantas vía la tabla puente "planta_organos".
 * Editar la fórmula acá la actualiza en todas las plantas que lo usan.
 *
 * Mismo patrón que useCompuestos.ts — useSupabaseData con select fijo,
 * ordenado por fecha de creación.
 */

import { useMemo } from "react";

import { useSupabaseData } from "@/infra/sync/useSupabaseData";

import type { Organo } from "./types";

export const CONFIG_ORGANOS = {
  tabla: "organos",
  select: "id, nombre, componentes, compuesto_base_id, notas, created_at, updated_at",
};

export function useOrganos() {
  const { data, setData, loading } = useSupabaseData<Organo>(CONFIG_ORGANOS.tabla, {
    select: CONFIG_ORGANOS.select,
    order: { campo: "created_at" },
  });

  const items = useMemo(() => data, [data]);

  return { items, setItems: setData, loading };
}
