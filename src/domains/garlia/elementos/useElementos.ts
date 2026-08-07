"use client";

/**
 * useElementos.ts
 * ────────────────────────
 * Catálogo de elementos de la Tabla Química/Alquímica (#1 al #29).
 * Mismo patrón que useRunas.ts: useSupabaseData con select fijo y orden
 * por número atómico (equivalente al "orden de descubrimiento" del roadmap
 * del documento de arquitectura).
 */

import { useMemo } from "react";

import { CONFIG, type Elemento } from "@/domains/garlia/elementos/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export function useElementos() {
  const { data, setData, loading } = useSupabaseData<Elemento>(CONFIG.tabla, {
    select: CONFIG.select,
    order: { campo: "numero_atomico" },
  });

  const items = useMemo(() => data, [data]);

  return { items, setItems: setData, loading };
}
