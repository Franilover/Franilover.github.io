"use client";

/**
 * useEstructuraComposicion.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Resuelve de qué Compuesto(s) está hecha UNA Estructura, directo (tabla
 * puente "estructura_compuestos"), sin pasar por una Célula intermedia —
 * a diferencia de useCelulaEstructuras.ts, que resuelve esto mismo pero
 * anidado bajo cada Estructura de una Célula. Este hook es el que usa el
 * catálogo propio de Estructuras (CatalogoTejidosBiologia → sección
 * Estructuras) para mostrar la composición al abrir una Estructura sola.
 *
 * Solo lectura: mismo motivo que useCelulaEstructuras — estructura_compuestos
 * se puebla por migración/cálculo, no por edición manual desde acá.
 *
 * Migrado a useSupabaseData (2026-08-28, barrido de huecos de persistencia
 * de Química): antes pegaba directo a Supabase con supabase.from() +
 * useState/useEffect propios, sin pasar por Dexie ni tener timeout, pese a
 * que "estructura_compuestos" y "compuestos" ya estaban en DEXIE_TABLES.
 * Mismo patrón que useCompuestoEnlaces (ver db.ts v39): dos useSupabaseData
 * en paralelo (vínculo + catálogo), resolviendo el join en memoria con
 * useMemo — así ambas capas quedan cache-first y offline-first, sin
 * inventar un modelo relacional que PostgREST no ofrece embebido.
 */

import { useMemo } from "react";

import {
  CONFIG_COMPUESTOS,
  CONFIG_ESTRUCTURA_COMPUESTOS,
  type Compuesto,
  type EstructuraCompuesto,
} from "@/domains/garlia/elementos/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

/** Un Compuesto vinculado a la Estructura, ya resuelto. */
export interface CompuestoDeEstructura {
  vinculo_id: string;
  compuesto_id: string;
  rol: string | null;
  proporcion: number | null;
  compuesto: Compuesto;
}

export function useEstructuraComposicion(estructuraId: string | null) {
  const { data: vinculosTodos, loading: loadingVinculos } =
    useSupabaseData<EstructuraCompuesto>(CONFIG_ESTRUCTURA_COMPUESTOS.tabla, {
      select: CONFIG_ESTRUCTURA_COMPUESTOS.select,
      order: { campo: "orden" },
    });

  const { data: compuestosTodos, loading: loadingCompuestos } =
    useSupabaseData<Compuesto>(CONFIG_COMPUESTOS.tabla, {
      select: CONFIG_COMPUESTOS.select,
    });

  const vinculos = useMemo(
    () =>
      estructuraId
        ? vinculosTodos.filter((v) => v.estructura_id === estructuraId)
        : [],
    [vinculosTodos, estructuraId],
  );

  const compuestosPorId = useMemo(() => {
    const mapa: Record<string, Compuesto> = {};
    for (const c of compuestosTodos) mapa[c.id] = c;
    return mapa;
  }, [compuestosTodos]);

  const items = useMemo<CompuestoDeEstructura[]>(() => {
    return vinculos
      .map((v) => {
        const compuesto = compuestosPorId[v.compuesto_id];
        if (!compuesto) return null;
        return {
          vinculo_id: v.id,
          compuesto_id: v.compuesto_id,
          rol: v.rol,
          proporcion: v.proporcion,
          compuesto,
        };
      })
      .filter((c): c is CompuestoDeEstructura => c !== null);
  }, [vinculos, compuestosPorId]);

  return {
    items,
    loading: estructuraId ? loadingVinculos || loadingCompuestos : false,
  };
}
