"use client";

/**
 * useCelulasDeUnCompuesto.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Dirección inversa de useCelulaCompuestos: dado un compuesto_id, devuelve
 * las Células que lo usan (tabla puente `celula_compuestos`, filtro por
 * compuesto_id en vez de celula_id). A diferencia de Grano→Compuesto (1:1
 * directo vía columna, ver useGranosDeUnCompuesto), Célula→Compuesto es
 * M:N desde la migración ago-2026 (celulas.compuesto_id quedó legacy y sin
 * uso, ver elementos/types.ts) — por eso acá sí hace falta resolver la
 * tabla puente, igual que useOrganosDeUnTejido.
 *
 * Resuelve la rama "Célula" de la vista dual Compuesto → {Grano, Célula} —
 * ver useGranosDeUnCompuesto para la otra rama (1:1 directo vía grano.
 * compuesto_id).
 *
 * Liviano y de solo lectura: no cachea en Dexie, se resuelve en vivo contra
 * Supabase cada vez que cambia compuestoId.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import { CONFIG_CELULAS, type Celula } from "@/domains/garlia/elementos/types";

interface VinculoCelulaCompuesto {
  id: string;
  celula_id: string;
  compuesto_id: string;
  rol: string | null;
  proporcion: string | null;
}

/** Una Célula que usa el Compuesto consultado, ya resuelta para la UI. */
export interface CelulaDeCompuesto {
  vinculo_id: string;
  celula_id: string;
  compuesto_id: string;
  rol: string | null;
  proporcion: string | null;
  celula: Celula;
}

export function useCelulasDeUnCompuesto(compuestoId: string | null) {
  const [vinculos, setVinculos] = useState<VinculoCelulaCompuesto[]>([]);
  const [celulas, setCelulas] = useState<Record<string, Celula>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!compuestoId) {
      setVinculos([]);
      setCelulas({});
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: vinculoData, error: vinculoError } = await supabase
      .from("celula_compuestos")
      .select("id, celula_id, compuesto_id, rol, proporcion")
      .eq("compuesto_id", compuestoId)
      .order("created_at", { ascending: true });

    if (vinculoError || !vinculoData) {
      setVinculos([]);
      setCelulas({});
      setLoading(false);
      return;
    }
    setVinculos(vinculoData as unknown as VinculoCelulaCompuesto[]);

    const celulaIds = (vinculoData as unknown as VinculoCelulaCompuesto[]).map((v) => v.celula_id);
    if (celulaIds.length === 0) {
      setCelulas({});
      setLoading(false);
      return;
    }

    const { data: celulaData } = await supabase
      .from(CONFIG_CELULAS.tabla)
      .select(CONFIG_CELULAS.select)
      .in("id", celulaIds);

    const celulasPorId: Record<string, Celula> = {};
    for (const c of (celulaData ?? []) as unknown as Celula[]) celulasPorId[c.id] = c;
    setCelulas(celulasPorId);
    setLoading(false);
  }, [compuestoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<CelulaDeCompuesto[]>(() => {
    return vinculos
      .map((v) => {
        const celula = celulas[v.celula_id];
        if (!celula) return null;
        return {
          vinculo_id: v.id,
          celula_id: v.celula_id,
          compuesto_id: v.compuesto_id,
          rol: v.rol,
          proporcion: v.proporcion,
          celula,
        };
      })
      .filter((c): c is CelulaDeCompuesto => c !== null);
  }, [vinculos, celulas]);

  return { items, loading, load };
}
