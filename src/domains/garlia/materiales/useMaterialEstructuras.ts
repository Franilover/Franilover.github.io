"use client";

import { useCallback, useMemo } from "react";

import {
  CONFIG_MATERIAL_ESTRUCTURAS,
  type MaterialEstructura,
} from "@/domains/garlia/materiales/types";
import { supabase } from "@/infra/supabase/supabase";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

/**
 * Estructuras asociadas a un Material (material_estructuras) — qué
 * estructuras físicas participan del material, en qué cantidad/proporción
 * y con qué rol.
 *
 * Mismo patrón de escritura que useItemMateriales.ts / useMaterialComponentes.ts:
 * fetch vía useSupabaseData (cache/offline), escritura directa contra
 * Supabase con actualización optimista de `data` local (con rollback si
 * falla).
 */
export function useMaterialEstructuras(materialId?: string | null) {
  const { data, setData, loading } = useSupabaseData<MaterialEstructura>(
    CONFIG_MATERIAL_ESTRUCTURAS.tabla,
    {
      select: CONFIG_MATERIAL_ESTRUCTURAS.select,
      order: { campo: "created_at" },
    },
  );

  const items = useMemo(
    () =>
      materialId
        ? data.filter((item) => item.material_id === materialId)
        : [],
    [data, materialId],
  );

  // ── Asociar una estructura del catálogo a este material ────────────────
  const agregar = useCallback(
    async (params: {
      estructura_id: string;
      cantidad: number;
      proporcion?: number | null;
      rol?: string | null;
    }) => {
      if (!materialId) return null;
      const { data: nuevo, error } = await supabase
        .from(CONFIG_MATERIAL_ESTRUCTURAS.tabla)
        .insert([
          {
            material_id: materialId,
            estructura_id: params.estructura_id,
            cantidad: params.cantidad,
            proporcion: params.proporcion ?? null,
            rol: params.rol ?? null,
          },
        ])
        .select()
        .single();
      if (error || !nuevo) {
        console.error("[useMaterialEstructuras] error agregando estructura:", error);
        return null;
      }
      const fila = nuevo as unknown as MaterialEstructura;
      setData((prev) => [...prev, fila]);
      return fila;
    },
    [materialId, setData],
  );

  // ── Editar cantidad/proporción/rol de una estructura ya asociada ───────
  const actualizar = useCallback(
    async (id: string, cambios: Partial<Pick<MaterialEstructura, "cantidad" | "proporcion" | "rol">>) => {
      const anterior = data.find((row) => row.id === id);
      setData((prev) => prev.map((row) => (row.id === id ? { ...row, ...cambios } : row)));
      const { error } = await supabase
        .from(CONFIG_MATERIAL_ESTRUCTURAS.tabla)
        .update(cambios)
        .eq("id", id);
      if (error) {
        console.error("[useMaterialEstructuras] error actualizando estructura:", error);
        if (anterior) {
          setData((prev) => prev.map((row) => (row.id === id ? anterior : row)));
        }
        return { ok: false, error };
      }
      return { ok: true, error: null };
    },
    [data, setData],
  );

  // ── Quitar una estructura del material ──────────────────────────────────
  const eliminar = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from(CONFIG_MATERIAL_ESTRUCTURAS.tabla)
        .delete()
        .eq("id", id);
      if (error) {
        console.error("[useMaterialEstructuras] error eliminando estructura:", error);
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
