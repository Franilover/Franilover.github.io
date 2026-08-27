"use client";

/**
 * useElementoSitiosEnlace.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Sitios de enlace de un Elemento (tabla "elemento_sitios_enlace"): cada fila
 * es un sitio individual (numero_sitio) con su geometría, afinidad,
 * capacidad, selectividad y saturación — poblados/recalculados en Supabase
 * (propagar_elemento_a_sitios + calcular_propiedades_sitio), nunca escritos
 * desde el frontend. Solo lectura.
 *
 * v39: migrado a useSupabaseData (cache-first vía Dexie + timeout + retry +
 * realtime) — antes pegaba directo a Supabase sin cache ni timeout en cada
 * cambio de elementoId, dejando el panel vacío indefinidamente con mala
 * conexión (ver infra/supabase/db.ts v39). Trae la tabla completa (ya
 * cacheada por useSupabaseData) y filtra/ordena en memoria por elementoId,
 * mismo patrón que useUsosCompuesto.
 */

import { useMemo } from "react";

import { useSupabaseData } from "@/infra/sync/useSupabaseData";

/** Fila cruda tal cual vive en Supabase (tabla "elemento_sitios_enlace"). */
export interface ElementoSitioEnlace {
  id: string;
  elemento_id: string;
  tipo: string;
  cantidad: number;
  afinidad: number | null;
  capacidad: number | null;
  selectividad: number | null;
  saturacion: number | null;
  polaridad: number | null;
  estado: string | null;
  numero_sitio: number | null;
  geometria_clave: string | null;
  rigidez_emergente: number | null;
}

export const CONFIG_ELEMENTO_SITIOS_ENLACE = {
  tabla: "elemento_sitios_enlace",
  select:
    "id, elemento_id, tipo, cantidad, afinidad, capacidad, selectividad, saturacion, polaridad, estado, numero_sitio, geometria_clave, rigidez_emergente",
};

export function useElementoSitiosEnlace(elementoId: string | null) {
  const { data, loading, isOffline, refetch } =
    useSupabaseData<ElementoSitioEnlace>(CONFIG_ELEMENTO_SITIOS_ENLACE.tabla, {
      select: CONFIG_ELEMENTO_SITIOS_ENLACE.select,
    });

  const items = useMemo(() => {
    if (!elementoId) return [];
    return data
      .filter((r) => r.elemento_id === elementoId)
      .sort((a, b) => (a.numero_sitio ?? 0) - (b.numero_sitio ?? 0));
  }, [data, elementoId]);

  return { items, loading: elementoId ? loading : false, isOffline, load: refetch };
}
