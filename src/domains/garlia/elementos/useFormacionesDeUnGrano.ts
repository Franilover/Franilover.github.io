"use client";

/**
 * useFormacionesDeUnGrano.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Dirección inversa y transitiva de useFormacionVetas: dado un grano_id,
 * resuelve TODAS las Formaciones que lo alcanzan atravesando la cadena real
 * en sentido inverso:
 *   Grano ← grano_id ← Veta → formacion_vetas → Formacion
 * A diferencia de su espejo useOrganosDeUnaCelula (Célula→Tejido es M:N vía
 * tejido_celulas), acá el primer tramo Grano→Veta es 1:1 directo (columna
 * `vetas.grano_id`, sin tabla puente) — por eso el primer paso es un filtro
 * simple en vez de una consulta a una tabla puente. El segundo tramo
 * (Veta→Formación) sí es M:N vía `formacion_vetas`, igual que su espejo.
 *
 * Una misma Veta puede ser usada por varias Formaciones distintas — este
 * hook junta la unión completa, sin duplicados, para el nivel "Formación"
 * del breadcrumb parado en un Grano.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import {
  CONFIG_FORMACIONES,
  CONFIG_VETAS,
  type Formacion,
  type Veta,
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

    // Paso 1: Vetas que apuntan a este Grano (1:1 directo, filtro simple).
    const { data: vetaData, error: vetaError } = await supabase
      .from(CONFIG_VETAS.tabla)
      .select("id")
      .eq("grano_id", granoId);

    if (vetaError || !vetaData) {
      setVetaIds([]);
      setVinculosFormacion([]);
      setFormaciones({});
      setLoading(false);
      return;
    }

    const idsVetas = (vetaData as unknown as Pick<Veta, "id">[]).map((v) => v.id);
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
