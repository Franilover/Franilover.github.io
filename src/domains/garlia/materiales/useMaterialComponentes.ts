"use client";

import { useCallback, useMemo } from "react";

import {
  CONFIG_MATERIAL_COMPONENTES,
  type MaterialComponente,
} from "@/domains/garlia/materiales/types";
import { supabase } from "@/infra/supabase/supabase";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

/**
 * Componentes de un Material (material_componentes) — qué compuestos/otros
 * componentes lo forman, en qué cantidad/proporción y con qué rol.
 *
 * Mismo patrón de escritura que useItemMateriales.ts: fetch vía
 * useSupabaseData (cache/offline), escritura directa contra Supabase con
 * actualización optimista de `data` local (con rollback si falla).
 */
export function useMaterialComponentes(materialId?: string | null) {
  const { data, setData, loading } = useSupabaseData<MaterialComponente>(
    CONFIG_MATERIAL_COMPONENTES.tabla,
    {
      select: CONFIG_MATERIAL_COMPONENTES.select,
      order: { campo: "orden" },
    },
  );

  const items = useMemo(
    () =>
      materialId
        ? data.filter((item) => item.material_id === materialId)
        : [],
    [data, materialId],
  );

  // ── Agregar un componente (compuesto u otro tipo) al material ──────────
  const agregar = useCallback(
    async (params: {
      componente_tipo: string;
      componente_id: string;
      cantidad: number;
      proporcion_min?: number | null;
      proporcion_max?: number | null;
      unidad?: string | null;
      rol?: string | null;
    }) => {
      if (!materialId) return null;
      const ordenMax = data
        .filter((item) => item.material_id === materialId)
        .reduce((max, item) => Math.max(max, item.orden ?? 0), 0);
      const { data: nuevo, error } = await supabase
        .from(CONFIG_MATERIAL_COMPONENTES.tabla)
        .insert([
          {
            material_id: materialId,
            componente_tipo: params.componente_tipo,
            componente_id: params.componente_id,
            cantidad: params.cantidad,
            proporcion_min: params.proporcion_min ?? null,
            proporcion_max: params.proporcion_max ?? null,
            unidad: params.unidad ?? null,
            rol: params.rol ?? null,
            orden: ordenMax + 1,
          },
        ])
        .select()
        .single();
      if (error || !nuevo) {
        console.error("[useMaterialComponentes] error agregando componente:", error);
        return null;
      }
      const fila = nuevo as unknown as MaterialComponente;
      setData((prev) => [...prev, fila]);
      return fila;
    },
    [materialId, data, setData],
  );

  // ── Editar cantidad/proporción/unidad/rol de un componente ya vinculado ─
  const actualizar = useCallback(
    async (
      id: string,
      cambios: Partial<
        Pick<
          MaterialComponente,
          "cantidad" | "proporcion_min" | "proporcion_max" | "unidad" | "rol" | "orden"
        >
      >,
    ) => {
      const anterior = data.find((row) => row.id === id);
      setData((prev) => prev.map((row) => (row.id === id ? { ...row, ...cambios } : row)));
      const { error } = await supabase
        .from(CONFIG_MATERIAL_COMPONENTES.tabla)
        .update(cambios)
        .eq("id", id);
      if (error) {
        console.error("[useMaterialComponentes] error actualizando componente:", error);
        if (anterior) {
          setData((prev) => prev.map((row) => (row.id === id ? anterior : row)));
        }
        return { ok: false, error };
      }
      return { ok: true, error: null };
    },
    [data, setData],
  );

  // ── Quitar un componente del material ───────────────────────────────────
  const eliminar = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from(CONFIG_MATERIAL_COMPONENTES.tabla)
        .delete()
        .eq("id", id);
      if (error) {
        console.error("[useMaterialComponentes] error eliminando componente:", error);
        return { ok: false, error };
      }
      setData((prev) => prev.filter((row) => row.id !== id));
      return { ok: true, error: null };
    },
    [setData],
  );

  return {
    items,
    loading,
    agregar,
    actualizar,
    eliminar,
  };
}
