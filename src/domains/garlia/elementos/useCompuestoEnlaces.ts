"use client";

/**
 * useCompuestoEnlaces.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Enlaces reales instanciados de un Compuesto (tabla "compuesto_enlaces"):
 * cada fila conecta dos elementos concretos (elemento_a_id/elemento_b_id) a
 * través de un enlace de catálogo (enlace_sitios_id → enlace_sitios), que
 * trae intensidad/coste_energetico/estabilidad/reversibilidad/confianza.
 *
 * Distinto de compuesto_estabilidad (agregado: un número de tensión/calidad
 * para todo el compuesto) — acá se ve el detalle enlace por enlace, el
 * grafo elemento↔elemento real que alimenta ese agregado.
 *
 * Solo lectura.
 *
 * v39: migrado a useSupabaseData (cache-first vía Dexie + timeout + retry +
 * realtime) — antes pegaba directo a Supabase con un select embebido
 * (enlace_sitios:enlace_sitios_id (...)), sin cache Dexie ni timeout, y ese
 * embed de PostgREST era además más frágil que un select plano. Ahora
 * compuesto_enlaces y enlace_sitios se cachean como dos tablas planas
 * propias (ver infra/supabase/db.ts v39) y el join se resuelve en memoria,
 * mismo patrón que useUsosCompuesto.
 */

import { useMemo } from "react";

import { useSupabaseData } from "@/infra/sync/useSupabaseData";

/** Una fila de compuesto_enlaces ya resuelta contra enlace_sitios, lista
 *  para renderizar — nombres de elementos se resuelven aparte contra el
 *  catálogo de elementos que ya tiene el caller (CompuestoEditor). */
export interface CompuestoEnlaceRow {
  id: string;
  compuesto_id: string;
  elemento_a_id: string;
  elemento_b_id: string;
  intensidad: number | null;
  coste_energetico: number | null;
  estabilidad: number | null;
  reversibilidad: number | null;
  confianza: number | null;
  estado: string | null;
}

/** Fila cruda de compuesto_enlaces tal cual vive en Supabase (sin resolver
 *  contra enlace_sitios todavía). */
interface CompuestoEnlaceCrudo {
  id: string;
  compuesto_id: string;
  elemento_a_id: string;
  elemento_b_id: string;
  enlace_sitios_id: string | null;
}

/** Fila del catálogo enlace_sitios (solo los campos que consume este hook). */
interface EnlaceSitioCatalogo {
  id: string;
  intensidad: number | null;
  coste_energetico: number | null;
  estabilidad: number | null;
  reversibilidad: number | null;
  confianza: number | null;
  estado: string | null;
}

export const CONFIG_COMPUESTO_ENLACES = {
  tabla: "compuesto_enlaces",
  select: "id, compuesto_id, elemento_a_id, elemento_b_id, enlace_sitios_id",
};

const SELECT_ENLACE_SITIOS =
  "id, intensidad, coste_energetico, estabilidad, reversibilidad, confianza, estado";

export function useCompuestoEnlaces(compuestoId: string | null) {
  const {
    data: enlacesCrudos,
    loading: loadingEnlaces,
    isOffline: offlineEnlaces,
    error: errorEnlaces,
    refetch,
  } = useSupabaseData<CompuestoEnlaceCrudo>(CONFIG_COMPUESTO_ENLACES.tabla, {
    select: CONFIG_COMPUESTO_ENLACES.select,
  });

  const {
    data: catalogoEnlaceSitios,
    loading: loadingCatalogo,
    isOffline: offlineCatalogo,
  } = useSupabaseData<EnlaceSitioCatalogo>("enlace_sitios", {
    select: SELECT_ENLACE_SITIOS,
  });

  const loading = compuestoId ? loadingEnlaces || loadingCatalogo : false;
  const isOffline = offlineEnlaces || offlineCatalogo;

  const items = useMemo<CompuestoEnlaceRow[]>(() => {
    if (!compuestoId) return [];

    const catalogoPorId = new Map(catalogoEnlaceSitios.map((c) => [c.id, c]));

    return enlacesCrudos
      .filter((r) => r.compuesto_id === compuestoId)
      .map((r) => {
        const enlace = r.enlace_sitios_id
          ? catalogoPorId.get(r.enlace_sitios_id)
          : undefined;
        return {
          id: r.id,
          compuesto_id: r.compuesto_id,
          elemento_a_id: r.elemento_a_id,
          elemento_b_id: r.elemento_b_id,
          intensidad: enlace?.intensidad ?? null,
          coste_energetico: enlace?.coste_energetico ?? null,
          estabilidad: enlace?.estabilidad ?? null,
          reversibilidad: enlace?.reversibilidad ?? null,
          confianza: enlace?.confianza ?? null,
          estado: enlace?.estado ?? null,
        };
      });
  }, [enlacesCrudos, catalogoEnlaceSitios, compuestoId]);

  return { items, loading, error: errorEnlaces, isOffline, load: refetch };
}
