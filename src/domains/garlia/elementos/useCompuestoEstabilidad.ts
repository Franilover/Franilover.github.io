"use client";

/**
 * useCompuestoEstabilidad.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Fila auxiliar de análisis de estabilidad de un Compuesto (tabla
 * "compuesto_estabilidad"): detalle de tensión, calidad de enlaces y
 * complejidad estructural, calculado en Supabase a partir de
 * compuesto_enlaces (ver estado_proyecto "v_auditoria_compuestos_derivacion"
 * / "77 de 90 compuestos tienen fila auxiliar" — no todos los compuestos
 * tienen fila, ver items === null abajo). Solo lectura.
 *
 * Liviano y sin cache Dexie, mismo criterio que useElementoSitiosEnlace:
 * se resuelve en vivo contra Supabase cada vez que cambia compuestoId.
 */

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

/** Fila cruda tal cual vive en Supabase (tabla "compuesto_estabilidad"). */
export interface CompuestoEstabilidadRow {
  id: string;
  compuesto_id: string;
  energia_enlaces: number | null;
  coste_organizacion: number | null;
  tension: number | null;
  compatibilidad: number | null;
  estabilidad: number | null;
  clasificacion: string | null;
  confianza: number | null;
  estado: string | null;
  calidad_enlaces: number | null;
  complejidad_estructural: number | null;
  metodo_calibracion: string | null;
}

export const CONFIG_COMPUESTO_ESTABILIDAD = {
  tabla: "compuesto_estabilidad",
  select:
    "id, compuesto_id, energia_enlaces, coste_organizacion, tension, compatibilidad, estabilidad, clasificacion, confianza, estado, calidad_enlaces, complejidad_estructural, metodo_calibracion",
};

/**
 * Filas de compuesto_elementos (con proporcion_molar/deducida/rol) para UN
 * compuesto puntual — más liviano que traer useCompuestosConElementos
 * completo cuando el caller (CompuestoEditor) solo necesita la proporción
 * real del compuesto que ya tiene abierto, junto a compuesto_estabilidad.
 */
export interface CompuestoElementoProporcion {
  id: string;
  elemento_id: string;
  cantidad: number;
  proporcion_molar: number | null;
  proporcion_deducida: number | null;
  proporcion_fuente: string | null;
  rol: string | null;
}

export function useCompuestoElementosProporcion(compuestoId: string | null) {
  const [items, setItems] = useState<CompuestoElementoProporcion[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!compuestoId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data, error } = await supabase
      .from("compuesto_elementos")
      .select("id, elemento_id, cantidad, proporcion_molar, proporcion_deducida, proporcion_fuente, rol")
      .eq("compuesto_id", compuestoId);

    if (error || !data) {
      setItems([]);
      setLoading(false);
      return;
    }

    setItems(data as unknown as CompuestoElementoProporcion[]);
    setLoading(false);
  }, [compuestoId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, load };
}

export function useCompuestoEstabilidad(compuestoId: string | null) {
  const [item, setItem] = useState<CompuestoEstabilidadRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!compuestoId) {
      setItem(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data, error } = await supabase
      .from(CONFIG_COMPUESTO_ESTABILIDAD.tabla)
      .select(CONFIG_COMPUESTO_ESTABILIDAD.select)
      .eq("compuesto_id", compuestoId)
      .maybeSingle();

    if (error || !data) {
      setItem(null);
      setLoading(false);
      return;
    }

    setItem(data as unknown as CompuestoEstabilidadRow);
    setLoading(false);
  }, [compuestoId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { item, loading, load };
}
