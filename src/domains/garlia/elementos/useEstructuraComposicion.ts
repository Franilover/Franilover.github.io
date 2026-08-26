"use client";

/**
 * useEstructuraComposicion.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Resuelve de qué Compuesto(s) está hecha UNA Estructura, directo (tabla
 * puente "estructura_compuestos"), sin pasar por una Célula intermedia —
 * a diferencia de useCelulaEstructuras.ts, que resuelve esto mismo pero
 * anidado bajo cada Estructura de una Célula. Este hook es el que usa el
 * catálogo propio de Estructuras (CatalogoTejidosBiologia → sección
 * Estructuras) para mostrar la composición al abrir una Estructura sola.
 *
 * Solo lectura: mismo motivo que useCelulaEstructuras — estructura_compuestos
 * se puebla por migración/cálculo, no por edición manual desde acá.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import {
  CONFIG_COMPUESTOS,
  CONFIG_ESTRUCTURA_COMPUESTOS,
  type Compuesto,
  type EstructuraCompuesto,
} from "@/domains/garlia/elementos/types";

/** Un Compuesto vinculado a la Estructura, ya resuelto. */
export interface CompuestoDeEstructura {
  vinculo_id: string;
  compuesto_id: string;
  rol: string | null;
  proporcion: number | null;
  compuesto: Compuesto;
}

export function useEstructuraComposicion(estructuraId: string | null) {
  const [vinculos, setVinculos] = useState<EstructuraCompuesto[]>([]);
  const [compuestos, setCompuestos] = useState<Record<string, Compuesto>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!estructuraId) {
      setVinculos([]);
      setCompuestos({});
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: vinculoData, error } = await supabase
      .from(CONFIG_ESTRUCTURA_COMPUESTOS.tabla)
      .select(CONFIG_ESTRUCTURA_COMPUESTOS.select)
      .eq("estructura_id", estructuraId)
      .order("orden", { ascending: true });

    if (error || !vinculoData) {
      setVinculos([]);
      setCompuestos({});
      setLoading(false);
      return;
    }
    const vinculosResueltos = vinculoData as unknown as EstructuraCompuesto[];
    setVinculos(vinculosResueltos);

    const compuestoIds = [...new Set(vinculosResueltos.map((v) => v.compuesto_id))];
    if (compuestoIds.length === 0) {
      setCompuestos({});
      setLoading(false);
      return;
    }

    const { data: compuestoData } = await supabase
      .from(CONFIG_COMPUESTOS.tabla)
      .select(CONFIG_COMPUESTOS.select)
      .in("id", compuestoIds);
    const compuestosPorId: Record<string, Compuesto> = {};
    for (const c of (compuestoData ?? []) as unknown as Compuesto[]) compuestosPorId[c.id] = c;
    setCompuestos(compuestosPorId);
    setLoading(false);
  }, [estructuraId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<CompuestoDeEstructura[]>(() => {
    return vinculos
      .map((v) => {
        const compuesto = compuestos[v.compuesto_id];
        if (!compuesto) return null;
        return {
          vinculo_id: v.id,
          compuesto_id: v.compuesto_id,
          rol: v.rol,
          proporcion: v.proporcion,
          compuesto,
        };
      })
      .filter((c): c is CompuestoDeEstructura => c !== null);
  }, [vinculos, compuestos]);

  return { items, loading };
}
