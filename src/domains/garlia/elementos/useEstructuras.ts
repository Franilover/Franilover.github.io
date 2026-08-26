"use client";

/**
 * useEstructuras.ts
 * ────────────────────────
 * Catálogo de Estructuras (tabla real "estructuras"): capa nueva entre
 * Compuesto y Célula — agrupa Compuestos espacialmente (vía
 * estructura_compuestos) con propiedades calculadas propias (masa/rigidez/
 * estabilidad/etc. en propiedades_calculadas, jsonb). Mismo patrón
 * calculado que Elemento/Compuesto: solo lectura desde el frontend, no
 * expone crear/actualizar/eliminar acá — ver types.ts para el detalle de
 * por qué (Estructura se puebla por migración/cálculo, no por edición
 * manual de nombre/función como Sistema u Organismo).
 *
 * Mismo patrón useSupabaseData que useCompuestos.ts / useOrganismos.ts.
 */

import { useMemo } from "react";

import { CONFIG_ESTRUCTURAS, type Estructura } from "@/domains/garlia/elementos/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export function useEstructuras() {
  const { data, loading } = useSupabaseData<Estructura>(CONFIG_ESTRUCTURAS.tabla, {
    select: CONFIG_ESTRUCTURAS.select,
    order: { campo: "created_at" },
  });

  const items = useMemo(() => data, [data]);

  return { items, loading };
}
