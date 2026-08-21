"use client";

/**
 * useReacciones.ts
 * ────────────────────────
 * Catálogo de Reacciones: recetas reutilizables de consume/produce (ej.
 * "Fotosíntesis básica" = consume Luz+Agua, produce Glucosa+Oxígeno),
 * pensadas para vincularse en vivo desde Procesos (Flora/Minerales) y
 * Habilidades (Items) — editar la Reacción acá actualiza todos los lugares
 * que la usan.
 *
 * Mismo patrón que useGruposCompuestos.ts — useSupabaseData con select
 * fijo, ordenado por fecha de creación.
 */

import { useMemo } from "react";

import { CONFIG_REACCIONES, type Reaccion } from "@/domains/garlia/elementos/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export function useReacciones() {
  const { data, setData, loading } = useSupabaseData<Reaccion>(CONFIG_REACCIONES.tabla, {
    select: CONFIG_REACCIONES.select,
    order: { campo: "created_at" },
  });

  const items = useMemo(() => data, [data]);

  return { items, setItems: setData, loading };
}
