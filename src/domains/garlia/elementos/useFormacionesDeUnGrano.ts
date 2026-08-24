"use client";

/**
 * useFormacionesDeUnGrano.ts
 * ───────────────────────────────────────────────────────────────────────────
 * FASE 4 — reescrito para N:M real en ambos tramos. Dado un granoId,
 * resuelve TODAS las Formaciones que lo alcanzan atravesando la cadena
 * completa:
 *   Grano ← estructura_componentes(padre=veta,hijo=grano) ← Veta
 *         → formacion_vetas → Formacion
 *
 * Antes (Fase 0-3) el primer tramo Grano→Veta era 1:1 directo (columna
 * `vetas.grano_id`) y se resolvía con un filtro simple. Ahora es N:M vía
 * `estructura_componentes` — un mismo Grano puede estar en varias Vetas —
 * así que el primer paso pasa a ser una consulta a la tabla puente igual
 * que el segundo tramo (Veta→Formación, que ya era M:N vía
 * `formacion_vetas` y no cambia).
 *
 * Una misma Veta puede ser usada por varias Formaciones distintas, y un
 * mismo Grano por varias Vetas — este hook junta la unión completa, sin
 * duplicados, para el nivel "Formación" del breadcrumb parado en un Grano.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import {
  CONFIG_ESTRUCTURA_COMPONENTES,
  CONFIG_FORMACIONES,
  type EstructuraComponente,
  type Formacion,
} from "@/domains/garlia/elementos/types";

interface VinculoFormacionVeta {
  id: string;
  formacion_id: string;
  veta_id: string;
}

export function useFormacionesDeUnGrano(granoId: string | null) {
  const [vetaIds, setVetaIds] = useState<string[]>([]);
  const [vinculosFormacion, setVinculosFormacion] = useState<VinculoFormacionVeta[]>([]);
  const [formaciones, setFormaciones] = useState<Record<string, Formacion>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!granoId) {
      setVetaIds([]);
      setVinculosFormacion([]);
      setFormaciones({});
      setLoading(false);
      return;
    }
    setLoading(true);

    // Paso 1: Vetas que contienen este Grano — N:M vía estructura_componentes.
    const { data: vgData, error: vgError } = await supabase
      .from(CONFIG_ESTRUCTURA_COMPONENTES.tabla)
      .select(CONFIG_ESTRUCTURA_COMPONENTES.select)
      .eq("padre_tipo", "veta")
      .eq("hijo_tipo", "grano")
      .eq("hijo_id", granoId);

    if (vgError || !vgData) {
      setVetaIds([]);
      setVinculosFormacion([]);
      setFormaciones({});
      setLoading(false);
      return;
    }

    const idsVetas = Array.from(
      new Set((vgData as unknown as EstructuraComponente[]).map((l) => l.padre_id)),
    );
    setVetaIds(idsVetas);

    if (idsVetas.length === 0) {
      setVinculosFormacion([]);
      setFormaciones({});
      setLoading(false);
      return;
    }

    // Paso 2: Formaciones que usan cualquiera de esas Vetas (M:N vía formacion_vetas).
    const { data: fvData, error: fvError } = await supabase
      .from("formacion_vetas")
      .select("id, formacion_id, veta_id")
      .in("veta_id", idsVetas);

    if (fvError || !fvData) {
      setVinculosFormacion([]);
      setFormaciones({});
      setLoading(false);
      return;
    }
    setVinculosFormacion(fvData as unknown as VinculoFormacionVeta[]);

    const formacionIds = Array.from(
      new Set((fvData as unknown as VinculoFormacionVeta[]).map((v) => v.formacion_id)),
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
  }, [granoId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Unión sin duplicados: una misma Formación puede alcanzarse por varias Vetas. */
  const items = useMemo<Formacion[]>(() => {
    const idsVistos = new Set<string>();
    const out: Formacion[] = [];
    for (const v of vinculosFormacion) {
      const formacion = formaciones[v.formacion_id];
      if (!formacion || idsVistos.has(formacion.id)) continue;
      idsVistos.add(formacion.id);
      out.push(formacion);
    }
    return out;
  }, [vinculosFormacion, formaciones]);

  return { items, vetaIds, loading, load };
}
