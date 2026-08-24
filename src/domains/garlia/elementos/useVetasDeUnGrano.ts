"use client";

/**
 * useVetasDeUnGrano.ts
 * ───────────────────────────────────────────────────────────────────────────
 * FASE 4 — reescrito para N:M real. Dado un granoId, devuelve las Vetas que
 * lo usan. Antes esto era un filtro simple `.eq("grano_id", granoId)` sobre
 * la tabla `vetas` (1:1 directo). Ahora la relación vive en
 * `estructura_componentes` (padre_tipo='veta', hijo_tipo='grano',
 * hijo_id=granoId) — un Grano puede estar en varias Vetas, y desde Fase 4
 * también puede estar acompañado de otros Granos dentro de la misma Veta.
 *
 * Resuelve "¿quién me usa?" para el breadcrumb navegable
 * Grano ⇄ Veta ⇄ Formación (espejo de Célula ⇄ Tejido ⇄ Órgano).
 *
 * Liviano y de solo lectura, mismo espíritu que useOrganosDeUnTejido.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import {
  CONFIG_ESTRUCTURA_COMPONENTES,
  CONFIG_VETAS,
  type EstructuraComponente,
  type Veta,
} from "@/domains/garlia/elementos/types";

/** Una Veta que usa el Grano consultado — resuelta para la UI, con el
 *  vínculo real de estructura_componentes (vinculo_id ya NO es el id de
 *  la propia Veta, ver Fase 4). */
export interface VetaDeGrano {
  vinculo_id: string;
  veta_id: string;
  grano_id: string;
  cantidad: number | null;
  proporcion: number | null;
  unidad: string | null;
  rol: string | null;
  veta: Veta;
}

export function useVetasDeUnGrano(granoId: string | null) {
  const [links, setLinks] = useState<EstructuraComponente[]>([]);
  const [vetas, setVetas] = useState<Record<string, Veta>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!granoId) {
      setLinks([]);
      setVetas({});
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: linkData, error: linkError } = await supabase
      .from(CONFIG_ESTRUCTURA_COMPONENTES.tabla)
      .select(CONFIG_ESTRUCTURA_COMPONENTES.select)
      .eq("padre_tipo", "veta")
      .eq("hijo_tipo", "grano")
      .eq("hijo_id", granoId)
      .order("created_at", { ascending: true });

    if (linkError || !linkData) {
      setLinks([]);
      setVetas({});
      setLoading(false);
      return;
    }
    const linksTyped = linkData as unknown as EstructuraComponente[];
    setLinks(linksTyped);

    const vetaIds = Array.from(new Set(linksTyped.map((l) => l.padre_id)));
    if (vetaIds.length === 0) {
      setVetas({});
      setLoading(false);
      return;
    }

    const { data: vetaData } = await supabase
      .from(CONFIG_VETAS.tabla)
      .select(CONFIG_VETAS.select)
      .in("id", vetaIds);

    const vetasPorId: Record<string, Veta> = {};
    for (const v of (vetaData ?? []) as unknown as Veta[]) vetasPorId[v.id] = v;
    setVetas(vetasPorId);
    setLoading(false);
  }, [granoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<VetaDeGrano[]>(() => {
    return links
      .map((link) => {
        const veta = vetas[link.padre_id];
        if (!veta) return null;
        return {
          vinculo_id: link.id,
          veta_id: link.padre_id,
          grano_id: link.hijo_id,
          cantidad: link.cantidad,
          proporcion: link.proporcion,
          unidad: link.unidad,
          rol: link.rol,
          veta,
        };
      })
      .filter((v): v is VetaDeGrano => v !== null);
  }, [links, vetas]);

  return { items, loading, load };
}
