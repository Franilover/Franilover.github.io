"use client";

/**
 * useFormacionesDeUnaVeta.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Dirección inversa de useFormacionVetas: dada una veta_id, devuelve las
 * Formaciones que la usan (tabla puente `formacion_vetas`, filtro por
 * veta_id en vez de formacion_id). Una misma Veta puede reutilizarse en
 * varias Formaciones — este hook resuelve "¿quién me usa?" para el
 * breadcrumb navegable Grano ⇄ Veta ⇄ Formación.
 *
 * Espejo inerte de useOrganosDeUnTejido.ts. Liviano y de solo lectura: no
 * cachea en Dexie, se resuelve en vivo contra Supabase cada vez que cambia
 * vetaId.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import { CONFIG_FORMACIONES, type Formacion } from "@/domains/garlia/elementos/types";

interface VinculoFormacionVeta {
  id: string;
  formacion_id: string;
  veta_id: string;
  proporcion: string | null;
}

/** Una Formación que usa la Veta consultada, ya resuelta para la UI. */
export interface FormacionDeVeta {
  vinculo_id: string;
  formacion_id: string;
  veta_id: string;
  proporcion: string | null;
  formacion: Formacion;
}

export function useFormacionesDeUnaVeta(vetaId: string | null) {
  const [vinculos, setVinculos] = useState<VinculoFormacionVeta[]>([]);
  const [formaciones, setFormaciones] = useState<Record<string, Formacion>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!vetaId) {
      setVinculos([]);
      setFormaciones({});
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: vinculoData, error: vinculoError } = await supabase
      .from("formacion_vetas")
      .select("id, formacion_id, veta_id, proporcion")
      .eq("veta_id", vetaId)
      .order("created_at", { ascending: true });

    if (vinculoError || !vinculoData) {
      setVinculos([]);
      setFormaciones({});
      setLoading(false);
      return;
    }
    setVinculos(vinculoData as unknown as VinculoFormacionVeta[]);

    const formacionIds = (vinculoData as unknown as VinculoFormacionVeta[]).map(
      (v) => v.formacion_id,
    );
    if (formacionIds.length === 0) {
      setFormaciones({});
      setLoading(false);
      return;
    }

    const { data: formacionData } = await supabase
      .from(CONFIG_FORMACIONES.tabla)
      .select(CONFIG_FORMACIONES.select)
      .in("id", formacionIds);

    const formacionesPorId: Record<string, Formacion> = {};
    for (const f of (formacionData ?? []) as unknown as Formacion[]) formacionesPorId[f.id] = f;
    setFormaciones(formacionesPorId);
    setLoading(false);
  }, [vetaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<FormacionDeVeta[]>(() => {
    return vinculos
      .map((v) => {
        const formacion = formaciones[v.formacion_id];
        if (!formacion) return null;
        return {
          vinculo_id: v.id,
          formacion_id: v.formacion_id,
          veta_id: v.veta_id,
          proporcion: v.proporcion,
          formacion,
        };
      })
      .filter((f): f is FormacionDeVeta => f !== null);
  }, [vinculos, formaciones]);

  return { items, loading, load };
}
