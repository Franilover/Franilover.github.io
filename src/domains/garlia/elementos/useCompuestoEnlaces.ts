"use client";

/**
 * useCompuestoEnlaces.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Enlaces reales instanciados de un Compuesto (tabla "compuesto_enlaces"):
 * cada fila conecta dos elementos concretos (elemento_a_id/elemento_b_id) a
 * través de un enlace de catálogo (enlace_sitios_id → enlace_sitios), que
 * trae intensidad/coste_energetico/estabilidad/reversibilidad/confianza.
 *
 * Distinto de compuesto_estabilidad (agregado: un número de tensión/calidad
 * para todo el compuesto) — acá se ve el detalle enlace por enlace, el
 * grafo elemento↔elemento real que alimenta ese agregado.
 *
 * Solo lectura, mismo criterio que useCompuestoEstabilidad: sin cache
 * Dexie, se resuelve en vivo contra Supabase cada vez que cambia
 * compuestoId.
 */

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

/** Una fila de compuesto_enlaces ya resuelta contra enlace_sitios, lista
 *  para renderizar — nombres de elementos se resuelven aparte contra el
 *  catálogo de elementos que ya tiene el caller (CompuestoEditor). */
export interface CompuestoEnlaceRow {
  id: string;
  compuesto_id: string;
  elemento_a_id: string;
  elemento_b_id: string;
  intensidad: number | null;
  coste_energetico: number | null;
  estabilidad: number | null;
  reversibilidad: number | null;
  confianza: number | null;
  estado: string | null;
}

export const CONFIG_COMPUESTO_ENLACES = {
  tabla: "compuesto_enlaces",
  select:
    "id, compuesto_id, elemento_a_id, elemento_b_id, " +
    "enlace_sitios:enlace_sitios_id ( intensidad, coste_energetico, estabilidad, reversibilidad, confianza, estado )",
};

export function useCompuestoEnlaces(compuestoId: string | null) {
  const [items, setItems] = useState<CompuestoEnlaceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!compuestoId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data, error } = await supabase
      .from(CONFIG_COMPUESTO_ENLACES.tabla)
      .select(CONFIG_COMPUESTO_ENLACES.select)
      .eq("compuesto_id", compuestoId);

    if (error || !data) {
      setItems([]);
      setLoading(false);
      return;
    }

    const filas: CompuestoEnlaceRow[] = (data as unknown as Array<{
      id: string;
      compuesto_id: string;
      elemento_a_id: string;
      elemento_b_id: string;
      enlace_sitios: {
        intensidad: number | null;
        coste_energetico: number | null;
        estabilidad: number | null;
        reversibilidad: number | null;
        confianza: number | null;
        estado: string | null;
      } | null;
    }>).map((r) => ({
      id: r.id,
      compuesto_id: r.compuesto_id,
      elemento_a_id: r.elemento_a_id,
      elemento_b_id: r.elemento_b_id,
      intensidad: r.enlace_sitios?.intensidad ?? null,
      coste_energetico: r.enlace_sitios?.coste_energetico ?? null,
      estabilidad: r.enlace_sitios?.estabilidad ?? null,
      reversibilidad: r.enlace_sitios?.reversibilidad ?? null,
      confianza: r.enlace_sitios?.confianza ?? null,
      estado: r.enlace_sitios?.estado ?? null,
    }));

    setItems(filas);
    setLoading(false);
  }, [compuestoId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, load };
}
