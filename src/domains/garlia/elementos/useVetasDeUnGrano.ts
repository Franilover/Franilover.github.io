"use client";

/**
 * useVetasDeUnGrano.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Dirección inversa de Veta.grano_id: dado un grano_id, devuelve las Vetas
 * que lo usan. A diferencia de useTejidosDeUnaCelula (M:N vía tabla puente),
 * acá Veta→Grano es 1:1 directo (columna `grano_id` en la propia tabla
 * `vetas`, ver elementos/types.ts) — no hay tabla puente que consultar, solo
 * un filtro simple `.eq("grano_id", granoId)`. Aun así la relación inversa
 * es 1:N (un Grano puede ser reutilizado por varias Vetas), por eso este
 * hook devuelve una lista, igual que su contraparte de Biología.
 *
 * Resuelve "¿quién me usa?" para el breadcrumb navegable
 * Grano ⇄ Veta ⇄ Formación (espejo de Célula ⇄ Tejido ⇄ Órgano).
 *
 * Liviano y de solo lectura, mismo espíritu que useOrganosDeUnTejido.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import { CONFIG_VETAS, type Veta } from "@/domains/garlia/elementos/types";

/** Una Veta que usa el Grano consultado — ya resuelta para la UI, con el
 *  mismo shape { vinculo_id, ..., item } que los vínculos M:N, aunque acá
 *  no exista tabla puente (vinculo_id = id de la propia Veta). */
export interface VetaDeGrano {
  vinculo_id: string;
  veta_id: string;
  grano_id: string;
  veta: Veta;
}

export function useVetasDeUnGrano(granoId: string | null) {
  const [vetas, setVetas] = useState<Veta[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!granoId) {
      setVetas([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data, error } = await supabase
      .from(CONFIG_VETAS.tabla)
      .select(CONFIG_VETAS.select)
      .eq("grano_id", granoId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      setVetas([]);
      setLoading(false);
      return;
    }
    setVetas(data as unknown as Veta[]);
    setLoading(false);
  }, [granoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<VetaDeGrano[]>(() => {
    return vetas.map((v) => ({
      vinculo_id: v.id,
      veta_id: v.id,
      grano_id: v.grano_id ?? "",
      veta: v,
    }));
  }, [vetas]);

  return { items, loading, load };
}
