"use client";

/**
 * useFormaciones.ts
 * ────────────────────────
 * Catálogo de Formaciones (tabla real "formaciones"): espejo inerte de
 * useOrganos.ts. Nombre/función/notas, sin fórmula propia — la
 * composición vive debajo, en Vetas/Granos (ver useFormacionVetas.ts).
 * Se vincula N:N a minerales (mineral_formaciones) e items
 * (item_estructura), vía la columna puente `grupo_compuesto_id` (nombre
 * histórico, hoy apunta a formaciones.id).
 *
 * Reemplaza a useEstructurasEnsambladas.ts, que apuntaba a la tabla ya
 * eliminada "estructuras_ensambladas".
 */

import { useMemo } from "react";

import { CONFIG_FORMACIONES, type Formacion } from "@/domains/garlia/elementos/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export function useFormaciones() {
  const { data, setData, loading } = useSupabaseData<Formacion>(CONFIG_FORMACIONES.tabla, {
    select: CONFIG_FORMACIONES.select,
    order: { campo: "created_at" },
  });

  const items = useMemo(() => data, [data]);

  return { items, setItems: setData, loading };
}
