"use client";

/**
 * useSistemasDeUnOrgano.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Dirección inversa de useSistemaOrganos: dado un organo_id, devuelve los
 * Sistemas que lo usan (tabla puente `sistema_organos`, filtro por
 * organo_id en vez de sistema_id). Mismo rol que useOrganosDeUnTejido.ts
 * un nivel abajo — resuelve "¿quién me usa?" para el breadcrumb navegable
 * Órgano ⇄ Sistema.
 *
 * Liviano y de solo lectura: no cachea en Dexie, igual que su análogo.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import {
  CONFIG_SISTEMAS,
  CONFIG_SISTEMA_ORGANOS,
  type Sistema,
} from "@/domains/garlia/elementos/types";

interface VinculoSistemaOrgano {
  id: string;
  sistema_id: string;
  organo_id: string;
}

/** Un Sistema que usa el Órgano consultado, ya resuelto para la UI. */
export interface SistemaDeOrgano {
  vinculo_id: string;
  sistema_id: string;
  organo_id: string;
  sistema: Sistema;
}

export function useSistemasDeUnOrgano(organoId: string | null) {
  const [vinculos, setVinculos] = useState<VinculoSistemaOrgano[]>([]);
  const [sistemas, setSistemas] = useState<Record<string, Sistema>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organoId) {
      setVinculos([]);
      setSistemas({});
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: vinculoData, error: vinculoError } = await supabase
      .from(CONFIG_SISTEMA_ORGANOS.tabla)
      .select("id, sistema_id, organo_id")
      .eq("organo_id", organoId)
      .order("created_at", { ascending: true });

    if (vinculoError || !vinculoData) {
      setVinculos([]);
      setSistemas({});
      setLoading(false);
      return;
    }
    setVinculos(vinculoData as unknown as VinculoSistemaOrgano[]);

    const sistemaIds = (vinculoData as unknown as VinculoSistemaOrgano[]).map((v) => v.sistema_id);
    if (sistemaIds.length === 0) {
      setSistemas({});
      setLoading(false);
      return;
    }

    const { data: sistemaData } = await supabase
      .from(CONFIG_SISTEMAS.tabla)
      .select(CONFIG_SISTEMAS.select)
      .in("id", sistemaIds);

    const sistemasPorId: Record<string, Sistema> = {};
    for (const s of (sistemaData ?? []) as unknown as Sistema[]) sistemasPorId[s.id] = s;
    setSistemas(sistemasPorId);
    setLoading(false);
  }, [organoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<SistemaDeOrgano[]>(() => {
    return vinculos
      .map((v) => {
        const sistema = sistemas[v.sistema_id];
        if (!sistema) return null;
        return {
          vinculo_id: v.id,
          sistema_id: v.sistema_id,
          organo_id: v.organo_id,
          sistema,
        };
      })
      .filter((s): s is SistemaDeOrgano => s !== null);
  }, [vinculos, sistemas]);

  return { items, loading, load };
}
