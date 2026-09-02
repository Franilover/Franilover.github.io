"use client";

/**
 * useEstructuraComposicion.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Resuelve y edita de qué Compuesto(s) está hecha UNA Estructura, directo
 * (tabla puente "estructura_compuestos"), sin pasar por una Célula
 * intermedia — a diferencia de useCelulaEstructuras.ts, que resuelve esto
 * mismo pero anidado bajo cada Estructura de una Célula. Este hook es el
 * que usa el catálogo propio de Estructuras (CatalogoTejidosBiologia →
 * sección Estructuras) para mostrar/editar la composición al abrir una
 * Estructura sola.
 *
 * 2026-09-02: se vuelve editable (agregar/actualizar/eliminar), mismo
 * pedido y mismo patrón exacto que useMaterialComponentes.ts /
 * useMaterialEstructuras.ts — escritura directa contra Supabase con
 * actualización optimista de `data` local (rollback si falla), fetch vía
 * useSupabaseData (cache/offline). Antes era solo lectura porque se asumía
 * que estructura_compuestos se poblaba únicamente por migración/cálculo;
 * el pedido explícito de "Materiales" fue llevar ese mismo nivel de
 * edición manual al análogo de Estructuras.
 */

import { useCallback, useMemo } from "react";

import {
  CONFIG_COMPUESTOS,
  CONFIG_ESTRUCTURA_COMPUESTOS,
  type Compuesto,
  type EstructuraCompuesto,
} from "@/domains/garlia/elementos/types";
import { supabase } from "@/infra/supabase/supabase";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

/** Un Compuesto vinculado a la Estructura, ya resuelto. */
export interface CompuestoDeEstructura {
  vinculo_id: string;
  compuesto_id: string;
  cantidad: number | null;
  rol: string | null;
  proporcion: number | null;
  unidad: string | null;
  tipo_proporcion: string | null;
  orden: number | null;
  compuesto: Compuesto;
}

export function useEstructuraComposicion(estructuraId: string | null) {
  const { data: vinculosTodos, setData: setVinculos, loading: loadingVinculos } =
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
          cantidad: v.cantidad,
          rol: v.rol,
          proporcion: v.proporcion,
          unidad: v.unidad,
          tipo_proporcion: v.tipo_proporcion,
          orden: v.orden,
          compuesto,
        };
      })
      .filter((c): c is CompuestoDeEstructura => c !== null);
  }, [vinculos, compuestosPorId]);

  // ── Vincular un Compuesto del catálogo a esta Estructura ────────────────
  const agregar = useCallback(
    async (params: {
      compuesto_id: string;
      cantidad?: number | null;
      proporcion?: number | null;
      unidad?: string | null;
      tipo_proporcion?: string | null;
      rol?: string | null;
    }) => {
      if (!estructuraId) return null;
      const ordenMax = vinculosTodos
        .filter((v) => v.estructura_id === estructuraId)
        .reduce((max, v) => Math.max(max, v.orden ?? 0), 0);
      const { data: nuevo, error } = await supabase
        .from(CONFIG_ESTRUCTURA_COMPUESTOS.tabla)
        .insert([
          {
            estructura_id: estructuraId,
            compuesto_id: params.compuesto_id,
            cantidad: params.cantidad ?? null,
            proporcion: params.proporcion ?? null,
            unidad: params.unidad ?? null,
            tipo_proporcion: params.tipo_proporcion ?? null,
            rol: params.rol ?? null,
            orden: ordenMax + 1,
          },
        ])
        .select()
        .single();
      if (error || !nuevo) {
        console.error("[useEstructuraComposicion] error agregando compuesto:", error);
        return null;
      }
      const fila = nuevo as unknown as EstructuraCompuesto;
      setVinculos((prev) => [...prev, fila]);
      return fila;
    },
    [estructuraId, vinculosTodos, setVinculos],
  );

  // ── Editar cantidad/proporción/unidad/rol de un vínculo existente ───────
  const actualizar = useCallback(
    async (
      id: string,
      cambios: Partial<
        Pick<
          EstructuraCompuesto,
          "cantidad" | "proporcion" | "unidad" | "tipo_proporcion" | "rol" | "orden"
        >
      >,
    ) => {
      const anterior = vinculosTodos.find((row) => row.id === id);
      setVinculos((prev) => prev.map((row) => (row.id === id ? { ...row, ...cambios } : row)));
      const { error } = await supabase
        .from(CONFIG_ESTRUCTURA_COMPUESTOS.tabla)
        .update(cambios)
        .eq("id", id);
      if (error) {
        console.error("[useEstructuraComposicion] error actualizando compuesto:", error);
        if (anterior) {
          setVinculos((prev) => prev.map((row) => (row.id === id ? anterior : row)));
        }
        return { ok: false, error };
      }
      return { ok: true, error: null };
    },
    [vinculosTodos, setVinculos],
  );

  // ── Quitar un Compuesto de esta Estructura ──────────────────────────────
  const eliminar = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from(CONFIG_ESTRUCTURA_COMPUESTOS.tabla)
        .delete()
        .eq("id", id);
      if (error) {
        console.error("[useEstructuraComposicion] error eliminando compuesto:", error);
        return { ok: false, error };
      }
      setVinculos((prev) => prev.filter((row) => row.id !== id));
      return { ok: true, error: null };
    },
    [setVinculos],
  );

  return {
    items,
    loading: estructuraId ? loadingVinculos || loadingCompuestos : false,
    agregar,
    actualizar,
    eliminar,
  };
}
