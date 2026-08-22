"use client";

/**
 * useFormaciones.ts
 * ────────────────────────
 * Catálogo de Formaciones: conjuntos reutilizables de Compuestos, pensados
 * para vincularse N:N a Minerales (mineral_formaciones.grupo_compuesto_id
 * → formaciones.id) e Items (item_estructura.grupo_compuesto_id →
 * formaciones.id) — mismo catálogo compartido entre ambos módulos. Editar
 * una Formación acá actualiza todos los minerales/items que la usen.
 *
 * Antes vivían como GrupoCompuesto tipo="formacion" (Minerales) o
 * tipo="estructura" (Items, unificado con Formaciones después); desde el
 * rediseño de Biología/Física tienen tabla propia "formaciones" — mismo
 * shape, mismo patrón useSupabaseData que useGruposCompuestos.ts.
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
