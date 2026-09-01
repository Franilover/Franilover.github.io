"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

/**
 * La unidad de volumen que el motor físico espera en
 * items.geometria_fisica.unidad_volumen (verificado contra
 * calcular_propiedades_objeto: matchea contra unidades_fisicas.clave/
 * simbolo, o un alias activo en alias_unidades_fisicas, de la magnitud
 * "Volumen" — [L³]).
 *
 * Hoy el catálogo real solo tiene una unidad de volumen dada de alta
 * (verificado en Supabase: clave "volumen_u", símbolo "uV"). Este hook la
 * trae tal cual está en el catálogo — no la hardcodea ni asume que seguirá
 * siendo la única si el motor agrega más adelante.
 */
export interface UnidadVolumen {
  id: string;
  clave: string;
  simbolo: string;
}

export function useUnidadVolumen() {
  const [unidad, setUnidad] = useState<UnidadVolumen | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      setLoading(true);
      const { data: magnitud, error: errorMagnitud } = await supabase
        .from("magnitudes_fisicas")
        .select("id")
        .eq("clave", "volumen")
        .maybeSingle();
      if (errorMagnitud || !magnitud) {
        if (!cancelado) setLoading(false);
        return;
      }
      const { data: unidades, error: errorUnidades } = await supabase
        .from("unidades_fisicas")
        .select("id, clave, simbolo")
        .eq("magnitud_id", magnitud.id)
        .order("factor_si", { ascending: true })
        .limit(1);
      if (!cancelado) {
        if (!errorUnidades && unidades && unidades.length > 0) {
          setUnidad(unidades[0] as UnidadVolumen);
        }
        setLoading(false);
      }
    }
    void cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  return { unidad, loading };
}
