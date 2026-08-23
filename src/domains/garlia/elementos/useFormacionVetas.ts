"use client";

/**
 * useFormacionVetas.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Espejo inerte de useOrganoTejidos.ts. Cadena real en Supabase:
 *   Formacion → formacion_vetas (proporcion) → Veta → Grano → Compuesto
 * Ver useOrganoTejidos.ts para el razonamiento completo sobre por qué
 * "agregar compuesto" crea Grano+Veta+vínculo en cadena en vez de exponer
 * los 3 niveles como catálogos separados.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import {
  CONFIG_GRANOS,
  CONFIG_VETAS,
  type FormacionVeta,
  type Grano,
  type Veta,
} from "@/domains/garlia/elementos/types";

/** Una fila de la fórmula de una Formación, ya resuelta: vínculo + veta + grano. */
export interface VetaDeFormacion {
  /** Id de la fila puente formacion_vetas — necesario para desvincular. */
  vinculo_id: string;
  formacion_id: string;
  veta_id: string;
  grano_id: string | null;
  /** Alias de grano_id — id de catálogo donde vive compuesto_id (shape
   *  compartido con TejidoDeOrgano, ver FilaFormulaTejido). */
  catalogo_id: string | null;
  proporcion: string | null;
  nombre: string;
  funcion: string | null;
  notas: string | null;
  compuesto_id: string | null;
}

export function useFormacionVetas(formacionId: string | null) {
  const [vinculos, setVinculos] = useState<FormacionVeta[]>([]);
  const [vetas, setVetas] = useState<Record<string, Veta>>({});
  const [granos, setGranos] = useState<Record<string, Grano>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!formacionId) {
      setVinculos([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: vinculoData, error: vinculoError } = await supabase
      .from("formacion_vetas")
      .select("*")
      .eq("formacion_id", formacionId)
      .order("created_at", { ascending: true });

    if (vinculoError || !vinculoData) {
      setVinculos([]);
      setLoading(false);
      return;
    }
    setVinculos(vinculoData as FormacionVeta[]);

    const vetaIds = (vinculoData as FormacionVeta[]).map((v) => v.veta_id);
    if (vetaIds.length === 0) {
      setVetas({});
      setGranos({});
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

    const granoIds = Object.values(vetasPorId)
      .map((v) => v.grano_id)
      .filter((id): id is string => !!id);

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
  }, [formacionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<VetaDeFormacion[]>(() => {
    return vinculos
      .map((v) => {
        const veta = vetas[v.veta_id];
        if (!veta) return null;
        const grano = veta.grano_id ? granos[veta.grano_id] : undefined;
        return {
          vinculo_id: v.id,
          formacion_id: v.formacion_id,
          veta_id: v.veta_id,
          grano_id: veta.grano_id,
          catalogo_id: veta.grano_id,
          proporcion: v.proporcion,
          nombre: veta.nombre,
          funcion: veta.funcion,
          notas: veta.notas,
          compuesto_id: grano?.compuesto_id ?? null,
        };
      })
      .filter((v): v is VetaDeFormacion => v !== null);
  }, [vinculos, vetas, granos]);

  const agregarCompuesto = useCallback(
    async (compuestoId: string) => {
      if (!formacionId) return null;

      const { data: nuevoGrano, error: errorGrano } = await supabase
        .from(CONFIG_GRANOS.tabla)
        .insert([{ nombre: "", compuesto_id: compuestoId, estructura: [] }])
        .select()
        .single();
      if (errorGrano || !nuevoGrano) return null;

      const { data: nuevaVeta, error: errorVeta } = await supabase
        .from(CONFIG_VETAS.tabla)
        .insert([{ nombre: "", grano_id: (nuevoGrano as Grano).id, estructura: [] }])
        .select()
        .single();
      if (errorVeta || !nuevaVeta) return null;

      const { data: vinculo, error: errorVinculo } = await supabase
        .from("formacion_vetas")
        .insert([{ formacion_id: formacionId, veta_id: (nuevaVeta as Veta).id }])
        .select()
        .single();
      if (errorVinculo || !vinculo) return null;

      setVetas((prev) => ({ ...prev, [(nuevaVeta as Veta).id]: nuevaVeta as Veta }));
      setGranos((prev) => ({ ...prev, [(nuevoGrano as Grano).id]: nuevoGrano as Grano }));
      setVinculos((prev) => [...prev, vinculo as FormacionVeta]);
      return vinculo as FormacionVeta;
    },
    [formacionId],
  );

  const actualizarCompuesto = useCallback(async (granoId: string, compuestoId: string) => {
    setGranos((prev) =>
      prev[granoId] ? { ...prev, [granoId]: { ...prev[granoId], compuesto_id: compuestoId } } : prev,
    );
    const { error } = await supabase
      .from(CONFIG_GRANOS.tabla)
      .update({ compuesto_id: compuestoId })
      .eq("id", granoId);
    if (error) console.error("[useFormacionVetas] error actualizando grano:", error);
  }, []);

  const actualizarProporcion = useCallback(async (vinculoId: string, proporcion: string) => {
    setVinculos((prev) => prev.map((v) => (v.id === vinculoId ? { ...v, proporcion } : v)));
    const { error } = await supabase
      .from("formacion_vetas")
      .update({ proporcion })
      .eq("id", vinculoId);
    if (error) console.error("[useFormacionVetas] error actualizando proporción:", error);
  }, []);

  const quitarCompuesto = useCallback(async (vinculoId: string) => {
    setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
    await supabase.from("formacion_vetas").delete().eq("id", vinculoId);
  }, []);

  return {
    items,
    loading,
    agregarCompuesto,
    actualizarCompuesto,
    actualizarProporcion,
    quitarCompuesto,
    load,
  };
}
