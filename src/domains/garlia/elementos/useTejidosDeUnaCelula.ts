"use client";

/**
 * useTejidosDeUnaCelula.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Dirección inversa de useTejidoCelulas: dada una celula_id, devuelve los
 * Tejidos que la usan (tabla puente `tejido_celulas`, filtro por celula_id
 * en vez de tejido_id). Una misma Célula puede poblar varios Tejidos —
 * este hook resuelve "¿quién me usa?" para el breadcrumb navegable
 * Célula ⇄ Tejido ⇄ Órgano.
 *
 * Liviano y de solo lectura, mismo espíritu que useOrganosDeUnTejido.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import {
  CONFIG_TEJIDOS,
  CONFIG_TEJIDO_CELULAS,
  type Tejido,
} from "@/domains/garlia/elementos/types";

interface VinculoTejidoCelula {
  id: string;
  tejido_id: string;
  celula_id: string;
  rol: string | null;
  proporcion: string | null;
}

/** Un Tejido que usa la Célula consultada, ya resuelto para la UI. */
export interface TejidoDeCelula {
  vinculo_id: string;
  tejido_id: string;
  celula_id: string;
  rol: string | null;
  proporcion: string | null;
  tejido: Tejido;
}

export function useTejidosDeUnaCelula(celulaId: string | null) {
  const [vinculos, setVinculos] = useState<VinculoTejidoCelula[]>([]);
  const [tejidos, setTejidos] = useState<Record<string, Tejido>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!celulaId) {
      setVinculos([]);
      setTejidos({});
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: vinculoData, error: vinculoError } = await supabase
      .from(CONFIG_TEJIDO_CELULAS.tabla)
      .select(CONFIG_TEJIDO_CELULAS.select)
      .eq("celula_id", celulaId)
      .order("created_at", { ascending: true });

    if (vinculoError || !vinculoData) {
      setVinculos([]);
      setTejidos({});
      setLoading(false);
      return;
    }
    setVinculos(vinculoData as unknown as VinculoTejidoCelula[]);

    const tejidoIds = (vinculoData as unknown as VinculoTejidoCelula[]).map((v) => v.tejido_id);
    if (tejidoIds.length === 0) {
      setTejidos({});
      setLoading(false);
      return;
    }

    const { data: tejidoData } = await supabase
      .from(CONFIG_TEJIDOS.tabla)
      .select(CONFIG_TEJIDOS.select)
      .in("id", tejidoIds);

    const tejidosPorId: Record<string, Tejido> = {};
    for (const t of (tejidoData ?? []) as unknown as Tejido[]) tejidosPorId[t.id] = t;
    setTejidos(tejidosPorId);
    setLoading(false);
  }, [celulaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<TejidoDeCelula[]>(() => {
    return vinculos
      .map((v) => {
        const tejido = tejidos[v.tejido_id];
        if (!tejido) return null;
        return {
          vinculo_id: v.id,
          tejido_id: v.tejido_id,
          celula_id: v.celula_id,
          rol: v.rol,
          proporcion: v.proporcion,
          tejido,
        };
      })
      .filter((t): t is TejidoDeCelula => t !== null);
  }, [vinculos, tejidos]);

  return { items, loading, load };
}
