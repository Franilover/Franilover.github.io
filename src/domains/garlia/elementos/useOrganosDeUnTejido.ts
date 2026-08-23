"use client";

/**
 * useOrganosDeUnTejido.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Dirección inversa de useOrganoTejidos: dado un tejido_id, devuelve los
 * Órganos que lo usan en su fórmula (tabla puente `organo_tejidos`, filtro
 * por tejido_id en vez de organo_id). Un mismo Tejido puede reutilizarse
 * en varios Órganos — este hook resuelve "¿quién me usa?" para el
 * breadcrumb navegable Célula ⇄ Tejido ⇄ Órgano.
 *
 * Liviano y de solo lectura: no cachea en Dexie (igual que useTejidoCelulas),
 * se resuelve en vivo contra Supabase cada vez que cambia tejidoId.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import { CONFIG_ORGANOS, type Organo } from "@/domains/garlia/elementos/types";

interface VinculoOrganoTejido {
  id: string;
  organo_id: string;
  tejido_id: string;
  proporcion: string | null;
}

/** Un Órgano que usa el Tejido consultado, ya resuelto para la UI. */
export interface OrganoDeTejido {
  vinculo_id: string;
  organo_id: string;
  tejido_id: string;
  proporcion: string | null;
  organo: Organo;
}

export function useOrganosDeUnTejido(tejidoId: string | null) {
  const [vinculos, setVinculos] = useState<VinculoOrganoTejido[]>([]);
  const [organos, setOrganos] = useState<Record<string, Organo>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tejidoId) {
      setVinculos([]);
      setOrganos({});
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: vinculoData, error: vinculoError } = await supabase
      .from("organo_tejidos")
      .select("id, organo_id, tejido_id, proporcion")
      .eq("tejido_id", tejidoId)
      .order("created_at", { ascending: true });

    if (vinculoError || !vinculoData) {
      setVinculos([]);
      setOrganos({});
      setLoading(false);
      return;
    }
    setVinculos(vinculoData as unknown as VinculoOrganoTejido[]);

    const organoIds = (vinculoData as unknown as VinculoOrganoTejido[]).map((v) => v.organo_id);
    if (organoIds.length === 0) {
      setOrganos({});
      setLoading(false);
      return;
    }

    const { data: organoData } = await supabase
      .from(CONFIG_ORGANOS.tabla)
      .select(CONFIG_ORGANOS.select)
      .in("id", organoIds);

    const organosPorId: Record<string, Organo> = {};
    for (const o of (organoData ?? []) as unknown as Organo[]) organosPorId[o.id] = o;
    setOrganos(organosPorId);
    setLoading(false);
  }, [tejidoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<OrganoDeTejido[]>(() => {
    return vinculos
      .map((v) => {
        const organo = organos[v.organo_id];
        if (!organo) return null;
        return {
          vinculo_id: v.id,
          organo_id: v.organo_id,
          tejido_id: v.tejido_id,
          proporcion: v.proporcion,
          organo,
        };
      })
      .filter((o): o is OrganoDeTejido => o !== null);
  }, [vinculos, organos]);

  return { items, loading, load };
}
