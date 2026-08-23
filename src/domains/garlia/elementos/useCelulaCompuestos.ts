"use client";

/**
 * useCelulaCompuestos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Resuelve los Compuestos vinculados a UNA Célula — tabla puente
 * `celula_compuestos` (nueva, migración ago-2026, reemplaza a la vieja
 * `celulas.compuesto_id` 1:1). De qué materiales está hecha la célula misma
 * (membrana, citoplasma, matriz interna, etc.) — una Célula real puede usar
 * varios Compuestos a la vez, no uno solo.
 * Mismo patrón que useTejidoCompuestos.ts, sin caché Dexie todavía.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import {
  CONFIG_CELULA_COMPUESTOS,
  CONFIG_COMPUESTOS,
  type CelulaCompuesto,
  type Compuesto,
} from "@/domains/garlia/elementos/types";

export interface CompuestoDeCelula {
  vinculo_id: string;
  celula_id: string;
  compuesto_id: string;
  rol: string | null;
  proporcion: string | null;
  compuesto: Compuesto;
}

export function useCelulaCompuestos(celulaId: string | null) {
  const [vinculos, setVinculos] = useState<CelulaCompuesto[]>([]);
  const [compuestos, setCompuestos] = useState<Record<string, Compuesto>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!celulaId) {
      setVinculos([]);
      setCompuestos({});
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: vinculoData, error: vinculoError } = await supabase
      .from(CONFIG_CELULA_COMPUESTOS.tabla)
      .select(CONFIG_CELULA_COMPUESTOS.select)
      .eq("celula_id", celulaId)
      .order("created_at", { ascending: true });

    if (vinculoError || !vinculoData) {
      setVinculos([]);
      setCompuestos({});
      setLoading(false);
      return;
    }
    setVinculos(vinculoData as unknown as CelulaCompuesto[]);

    const compuestoIds = (vinculoData as unknown as CelulaCompuesto[]).map((v) => v.compuesto_id);
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
  }, [celulaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<CompuestoDeCelula[]>(() => {
    return vinculos
      .map((v) => {
        const compuesto = compuestos[v.compuesto_id];
        if (!compuesto) return null;
        return {
          vinculo_id: v.id,
          celula_id: v.celula_id,
          compuesto_id: v.compuesto_id,
          rol: v.rol,
          proporcion: v.proporcion,
          compuesto,
        };
      })
      .filter((c): c is CompuestoDeCelula => c !== null);
  }, [vinculos, compuestos]);

  const vincularExistente = useCallback(
    async (compuestoId: string, rol?: string) => {
      if (!celulaId) return null;
      const { data: vinculo, error } = await supabase
        .from(CONFIG_CELULA_COMPUESTOS.tabla)
        .insert([{ celula_id: celulaId, compuesto_id: compuestoId, rol: rol ?? null }])
        .select()
        .single();
      if (error || !vinculo) return null;

      if (!compuestos[compuestoId]) {
        const { data: compuestoData } = await supabase
          .from(CONFIG_COMPUESTOS.tabla)
          .select(CONFIG_COMPUESTOS.select)
          .eq("id", compuestoId)
          .single();
        if (compuestoData) {
          setCompuestos((prev) => ({ ...prev, [compuestoId]: compuestoData as unknown as Compuesto }));
        }
      }
      setVinculos((prev) => [...prev, vinculo as unknown as CelulaCompuesto]);
      return vinculo as unknown as CelulaCompuesto;
    },
    [celulaId, compuestos],
  );

  const actualizarRol = useCallback(async (vinculoId: string, rol: string) => {
    setVinculos((prev) => prev.map((v) => (v.id === vinculoId ? { ...v, rol } : v)));
    const { error } = await supabase
      .from(CONFIG_CELULA_COMPUESTOS.tabla)
      .update({ rol })
      .eq("id", vinculoId);
    if (error) console.error("[useCelulaCompuestos] error actualizando rol:", error);
  }, []);

  const actualizarProporcion = useCallback(async (vinculoId: string, proporcion: string) => {
    setVinculos((prev) => prev.map((v) => (v.id === vinculoId ? { ...v, proporcion } : v)));
    const { error } = await supabase
      .from(CONFIG_CELULA_COMPUESTOS.tabla)
      .update({ proporcion })
      .eq("id", vinculoId);
    if (error) console.error("[useCelulaCompuestos] error actualizando proporción:", error);
  }, []);

  const quitar = useCallback(async (vinculoId: string) => {
    setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
    const { error } = await supabase.from(CONFIG_CELULA_COMPUESTOS.tabla).delete().eq("id", vinculoId);
    if (error) console.error("[useCelulaCompuestos] error quitando vínculo:", error);
  }, []);

  return { items, loading, vincularExistente, actualizarRol, actualizarProporcion, quitar, load };
}
