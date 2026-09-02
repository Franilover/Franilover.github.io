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
 * v39: migrado a useSupabaseData (cache-first vía Dexie + timeout + retry +
 * realtime) — antes pegaba directo a Supabase con un select embebido
 * (enlace_sitios:enlace_sitios_id (...)), sin cache Dexie ni timeout, y ese
 * embed de PostgREST era además más frágil que un select plano. Ahora
 * compuesto_enlaces y enlace_sitios se cachean como dos tablas planas
 * propias (ver infra/supabase/db.ts v39) y el join se resuelve en memoria,
 * mismo patrón que useUsosCompuesto.
 *
 * Mutaciones (agregar/quitar fila de compuesto_enlaces) agregadas más abajo:
 * solo asignan a un par de elementos un enlace_sitios_id EXISTENTE — y
 * además ya filtrado por useEnlaceSitiosParaPar a los que esa pareja de
 * elementos puede usar según la cadena enlace_sitios → site_a/b_id →
 * elemento_sitios_enlace.elemento_id (ver ese hook más abajo). Nunca se
 * crea ni edita una fila de enlace_sitios desde acá: ese catálogo, y la
 * regla de qué combinaciones son físicamente válidas
 * (calcular_compatibilidad_sitios / fn_asignar_enlaces_compuesto), vive y
 * se decide en Supabase — este archivo solo lee esa cadena y escribe
 * compuesto_enlaces, la instancia dentro de un compuesto puntual.
 */

import { useMemo } from "react";

import { useSupabaseData } from "@/infra/sync/useSupabaseData";
import { supabase } from "@/infra/supabase/supabase";

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

/** Fila del catálogo enlace_sitios (los 4 números + site_a_id/site_b_id,
 *  que son la procedencia real: cada uno apunta a una fila de
 *  elemento_sitios_enlace, que sí tiene elemento_id — ver
 *  useElementoSitiosEnlace. enlace_sitios NO duplica elemento_a_id/
 *  elemento_b_id; se resuelve en memoria contra esa cadena, nunca se
 *  reconstruye la regla de compatibilidad física en el frontend (eso vive
 *  en calcular_compatibilidad_sitios/fn_asignar_enlaces_compuesto, en
 *  Supabase). */
interface EnlaceSitioCatalogo {
  id: string;
  site_a_id: string;
  site_b_id: string;
  tipo_enlace_id: string | null;
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
  "id, site_a_id, site_b_id, tipo_enlace_id, intensidad, coste_energetico, estabilidad, reversibilidad, confianza, estado";

/** Solo lo necesario de elemento_sitios_enlace para resolver
 *  site_id → elemento_id (ver EnlaceSitioCatalogo arriba). */
interface SitioElementoLookup {
  id: string;
  elemento_id: string;
}

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

/**
 * Enlaces del catálogo aplicables a UN PAR de elementos concretos —
 * "aplicable" quiere decir: sus dos sitios (site_a_id/site_b_id) resuelven,
 * vía elemento_sitios_enlace.elemento_id, exactamente al par {elementoAId,
 * elementoBId} (en cualquier orden). Esto es solo el join de lectura de la
 * cadena enlace_sitios → sitio → elemento; NO reimplementa
 * calcular_compatibilidad_sitios ni ninguna otra regla física — si el
 * backend calificó un enlace como válido para ese par de sitios, acá
 * aparece; si un enlace técnicamente listado no debería usarse por alguna
 * regla adicional del backend, fn_asignar_enlaces_compuesto/constraints en
 * Supabase son quienes lo rechazan al guardar, no este hook.
 */
export function useEnlaceSitiosParaPar(elementoAId: string | null, elementoBId: string | null) {
  const { data: catalogoEnlaceSitios, loading: loadingEnlaces, isOffline: offlineEnlaces } =
    useSupabaseData<EnlaceSitioCatalogo>("enlace_sitios", {
      select: SELECT_ENLACE_SITIOS,
    });
  const { data: sitios, loading: loadingSitios, isOffline: offlineSitios } =
    useSupabaseData<SitioElementoLookup>("elemento_sitios_enlace", {
      select: "id, elemento_id",
    });

  const loading = elementoAId && elementoBId ? loadingEnlaces || loadingSitios : false;
  const isOffline = offlineEnlaces || offlineSitios;

  const items = useMemo(() => {
    if (!elementoAId || !elementoBId) return [];
    const elementoPorSitio = new Map(sitios.map((s) => [s.id, s.elemento_id]));
    const par = new Set([elementoAId, elementoBId]);
    return catalogoEnlaceSitios.filter((e) => {
      const elA = elementoPorSitio.get(e.site_a_id);
      const elB = elementoPorSitio.get(e.site_b_id);
      if (!elA || !elB) return false;
      return new Set([elA, elB]).size === par.size && [elA, elB].every((id) => par.has(id));
    });
  }, [catalogoEnlaceSitios, sitios, elementoAId, elementoBId]);

  return { items, loading, isOffline };
}

/**
 * Crea una fila de compuesto_enlaces asignando un enlace_sitios_id YA
 * EXISTENTE (elegido de los que devuelve useEnlaceSitiosParaPar para ese
 * mismo par) a un par de elementos del compuesto. No crea ni edita
 * enlace_sitios.
 */
export async function agregarEnlaceACompuesto(
  compuestoId: string,
  elementoAId: string,
  elementoBId: string,
  enlaceSitiosId: string,
) {
  const { error } = await supabase.from(CONFIG_COMPUESTO_ENLACES.tabla).insert({
    compuesto_id: compuestoId,
    elemento_a_id: elementoAId,
    elemento_b_id: elementoBId,
    enlace_sitios_id: enlaceSitiosId,
  });
  if (error) console.error("[agregarEnlaceACompuesto] error:", error);
  return !error;
}

/** Reasigna el enlace_sitios_id de una fila de compuesto_enlaces ya
 *  existente (cambiar qué enlace del catálogo aplica a ese par de
 *  elementos, sin tocar el par en sí). */
export async function actualizarEnlaceSitiosDeCompuestoEnlace(
  compuestoEnlaceId: string,
  enlaceSitiosId: string,
) {
  const { error } = await supabase
    .from(CONFIG_COMPUESTO_ENLACES.tabla)
    .update({ enlace_sitios_id: enlaceSitiosId })
    .eq("id", compuestoEnlaceId);
  if (error) console.error("[actualizarEnlaceSitiosDeCompuestoEnlace] error:", error);
  return !error;
}

export async function quitarEnlaceDeCompuesto(compuestoEnlaceId: string) {
  const { error } = await supabase
    .from(CONFIG_COMPUESTO_ENLACES.tabla)
    .delete()
    .eq("id", compuestoEnlaceId);
  if (error) console.error("[quitarEnlaceDeCompuesto] error:", error);
  return !error;
}
