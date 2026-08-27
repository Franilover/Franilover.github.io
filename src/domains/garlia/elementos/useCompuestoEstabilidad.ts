"use client";

/**
 * useCompuestoEstabilidad.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Fila auxiliar de análisis de estabilidad de un Compuesto (tabla
 * "compuesto_estabilidad"): detalle de tensión, calidad de enlaces y
 * complejidad estructural, calculado en Supabase a partir de
 * compuesto_enlaces (ver estado_proyecto "v_auditoria_compuestos_derivacion"
 * / "77 de 90 compuestos tienen fila auxiliar" — no todos los compuestos
 * tienen fila, ver item === null abajo). Solo lectura.
 *
 * v39: migrado a useSupabaseData (cache-first vía Dexie + timeout + retry +
 * realtime) — antes pegaba directo a Supabase sin cache ni timeout en cada
 * cambio de compuestoId, mismo problema que useCompuestoEnlaces y
 * useElementoSitiosEnlace (ver infra/supabase/db.ts v39).
 * useCompuestoElementosProporcion migra también: compuesto_elementos ya
 * estaba en Dexie desde v34 pero este hook seguía haciendo fetch manual sin
 * timeout en vez de aprovechar ese cache.
 */

import { useMemo } from "react";

import { useSupabaseData } from "@/infra/sync/useSupabaseData";

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

const SELECT_COMPUESTO_ELEMENTOS_PROPORCION =
  "id, elemento_id, cantidad, proporcion_molar, proporcion_deducida, proporcion_fuente, rol";

export function useCompuestoElementosProporcion(compuestoId: string | null) {
  const { data, loading, isOffline, refetch } =
    useSupabaseData<CompuestoElementoProporcion>("compuesto_elementos", {
      select: SELECT_COMPUESTO_ELEMENTOS_PROPORCION,
    });

  const items = useMemo(() => {
    if (!compuestoId) return [];
    return data.filter(
      (r) => (r as unknown as { compuesto_id: string }).compuesto_id === compuestoId,
    );
  }, [data, compuestoId]);

  return { items, loading: compuestoId ? loading : false, isOffline, load: refetch };
}

export function useCompuestoEstabilidad(compuestoId: string | null) {
  const { data, loading, isOffline, refetch } =
    useSupabaseData<CompuestoEstabilidadRow>(CONFIG_COMPUESTO_ESTABILIDAD.tabla, {
      select: CONFIG_COMPUESTO_ESTABILIDAD.select,
    });

  const item = useMemo(() => {
    if (!compuestoId) return null;
    return data.find((r) => r.compuesto_id === compuestoId) ?? null;
  }, [data, compuestoId]);

  return { item, loading: compuestoId ? loading : false, isOffline, load: refetch };
}
