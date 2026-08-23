"use client";

/**
 * useGranosDeUnCompuesto.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Dirección inversa de Grano.compuesto_id: dado un compuesto_id, devuelve
 * los Granos que lo usan. Igual que Veta→Grano, Grano→Compuesto es 1:1
 * directo (columna `compuesto_id` en la propia tabla `granos`, ver
 * elementos/types.ts) — no hay tabla puente, solo un filtro simple
 * `.eq("compuesto_id", compuestoId)`. La relación inversa sigue siendo 1:N
 * (un Compuesto puede ser reutilizado por varios Granos).
 *
 * Resuelve la rama "Grano" de la vista dual Compuesto → {Grano, Célula} —
 * ver useCelulasDeUnCompuesto para la otra rama (M:N vía celula_compuestos).
 *
 * Espejo inerte de useVetasDeUnGrano.ts, un nivel más abajo en la cadena.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import { CONFIG_GRANOS, type Grano } from "@/domains/garlia/elementos/types";

/** Un Grano que usa el Compuesto consultado — ya resuelto para la UI, con
 *  el mismo shape { vinculo_id, ..., item } que los vínculos M:N, aunque
 *  acá no exista tabla puente (vinculo_id = id del propio Grano). */
export interface GranoDeCompuesto {
  vinculo_id: string;
  grano_id: string;
  compuesto_id: string;
  grano: Grano;
}

export function useGranosDeUnCompuesto(compuestoId: string | null) {
  const [granos, setGranos] = useState<Grano[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!compuestoId) {
      setGranos([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data, error } = await supabase
      .from(CONFIG_GRANOS.tabla)
      .select(CONFIG_GRANOS.select)
      .eq("compuesto_id", compuestoId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      setGranos([]);
      setLoading(false);
      return;
    }
    setGranos(data as unknown as Grano[]);
    setLoading(false);
  }, [compuestoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<GranoDeCompuesto[]>(() => {
    return granos.map((g) => ({
      vinculo_id: g.id,
      grano_id: g.id,
      compuesto_id: g.compuesto_id ?? "",
      grano: g,
    }));
  }, [granos]);

  return { items, loading, load };
}
