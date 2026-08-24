"use client";

/**
 * useGranosDeUnCompuesto.ts
 * ───────────────────────────────────────────────────────────────────────────
 * FASE 4 — reescrito para N:M real. Dado un compuestoId, devuelve los
 * Granos que lo usan. Antes esto era un filtro simple
 * `.eq("compuesto_id", compuestoId)` sobre la tabla `granos` (1:1 directo).
 * Ahora la relación vive en `estructura_componentes` (padre_tipo='grano',
 * hijo_tipo='compuesto', hijo_id=compuestoId) — un Compuesto puede estar en
 * varios Granos, y desde Fase 4 cada Grano puede estar hecho de varios
 * Compuestos distintos a la vez.
 *
 * Resuelve la rama "Grano" de la vista dual Compuesto → {Grano, Célula} —
 * ver useCelulasDeUnCompuesto para la otra rama (M:N vía celula_compuestos).
 *
 * Espejo inerte de useVetasDeUnGrano.ts, un nivel más abajo en la cadena.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import {
  CONFIG_ESTRUCTURA_COMPONENTES,
  CONFIG_GRANOS,
  type EstructuraComponente,
  type Grano,
} from "@/domains/garlia/elementos/types";

/** Un Grano que usa el Compuesto consultado — resuelto para la UI, con el
 *  vínculo real de estructura_componentes (vinculo_id ya NO es el id del
 *  propio Grano, ver Fase 4). */
export interface GranoDeCompuesto {
  vinculo_id: string;
  grano_id: string;
  compuesto_id: string;
  cantidad: number | null;
  proporcion: number | null;
  unidad: string | null;
  rol: string | null;
  grano: Grano;
}

export function useGranosDeUnCompuesto(compuestoId: string | null) {
  const [links, setLinks] = useState<EstructuraComponente[]>([]);
  const [granos, setGranos] = useState<Record<string, Grano>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!compuestoId) {
      setLinks([]);
      setGranos({});
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: linkData, error: linkError } = await supabase
      .from(CONFIG_ESTRUCTURA_COMPONENTES.tabla)
      .select(CONFIG_ESTRUCTURA_COMPONENTES.select)
      .eq("padre_tipo", "grano")
      .eq("hijo_tipo", "compuesto")
      .eq("hijo_id", compuestoId)
      .order("created_at", { ascending: true });

    if (linkError || !linkData) {
      setLinks([]);
      setGranos({});
      setLoading(false);
      return;
    }
    const linksTyped = linkData as unknown as EstructuraComponente[];
    setLinks(linksTyped);

    const granoIds = Array.from(new Set(linksTyped.map((l) => l.padre_id)));
    if (granoIds.length === 0) {
      setGranos({});
      setLoading(false);
      return;
    }

    const { data: granoData } = await supabase
      .from(CONFIG_GRANOS.tabla)
      .select(CONFIG_GRANOS.select)
      .in("id", granoIds);

    const granosPorId: Record<string, Grano> = {};
    for (const g of (granoData ?? []) as unknown as Grano[]) granosPorId[g.id] = g;
    setGranos(granosPorId);
    setLoading(false);
  }, [compuestoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<GranoDeCompuesto[]>(() => {
    return links
      .map((link) => {
        const grano = granos[link.padre_id];
        if (!grano) return null;
        return {
          vinculo_id: link.id,
          grano_id: link.padre_id,
          compuesto_id: link.hijo_id,
          cantidad: link.cantidad,
          proporcion: link.proporcion,
          unidad: link.unidad,
          rol: link.rol,
          grano,
        };
      })
      .filter((g): g is GranoDeCompuesto => g !== null);
  }, [links, granos]);

  return { items, loading, load };
}
