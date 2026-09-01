"use client";

import { useCallback, useMemo } from "react";

import { CONFIG_ITEM_MATERIALES, type ItemMaterial } from "./types";
import { supabase } from "@/infra/supabase/supabase";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

/**
 * Composición física real de un Objeto vía item_materiales — fuente
 * principal del Modelo físico canónico v218 (documentacion_sistema, orden
 * 1001). compuesto_id en `items` es solo una vía secundaria de
 * compatibilidad y nunca se suma a esto (ver "Fuente física única del
 * objeto", orden 212).
 *
 * IMPORTANTE (regla 3 del editor de objetos): este hook NUNCA calcula
 * masa/densidad/etc. Solo escribe las CAUSAS (material_id, cantidad,
 * proporcion, rol) contra item_materiales.
 *
 * Responsabilidad única: leer/crear/actualizar/eliminar filas de
 * item_materiales. No es responsable de refrescar `items.propiedades_fisicas`
 * — eso lo hace un trigger en Supabase (trg_objeto_propiedades →
 * recalcular_objeto_propiedades, verificado contra el proyecto real:
 * persiste directo en items.propiedades_fisicas/estado_fisico tras cada
 * INSERT/UPDATE/DELETE de esta tabla). Si el consumidor necesita ver ese
 * resultado actualizado en pantalla, es su responsabilidad volver a pedir
 * el `item` — no de este hook.
 *
 * Mismo patrón de escritura que useGranos.ts/useMateriales.ts: fetch vía
 * useSupabaseData (cache/offline), escritura directa contra supabase con
 * actualización optimista de `data` local.
 */
export function useItemMateriales(itemId?: string | null) {
  const { data, setData, loading } = useSupabaseData<ItemMaterial>(
    CONFIG_ITEM_MATERIALES.tabla,
    {
      select: CONFIG_ITEM_MATERIALES.select,
    },
  );

  const items = useMemo(
    () => (itemId ? data.filter((row) => row.item_id === itemId) : []),
    [data, itemId],
  );

  // ── Vincular un material del catálogo a este objeto ─────────────────────
  // Solo escribe la causa (qué material, cuánta cantidad/proporción, qué
  // rol cumple). No calcula ni asume propiedades derivadas.
  const agregar = useCallback(
    async (params: {
      material_id: string;
      cantidad: number;
      proporcion?: number | null;
      rol?: string | null;
    }) => {
      if (!itemId) return null;
      const { data: nuevo, error } = await supabase
        .from(CONFIG_ITEM_MATERIALES.tabla)
        .insert([
          {
            item_id: itemId,
            material_id: params.material_id,
            cantidad: params.cantidad,
            proporcion: params.proporcion ?? null,
            rol: params.rol ?? null,
          },
        ])
        .select()
        .single();
      if (error || !nuevo) {
        console.error("[useItemMateriales] error agregando material:", error);
        return null;
      }
      const fila = nuevo as unknown as ItemMaterial;
      setData((prev) => [...prev, fila]);
      return fila;
    },
    [itemId, setData],
  );

  // ── Editar cantidad/proporción/rol de una fila ya vinculada ─────────────
  const actualizar = useCallback(
    async (id: string, cambios: Partial<Pick<ItemMaterial, "cantidad" | "proporcion" | "rol" | "material_id">>) => {
      setData((prev) => prev.map((row) => (row.id === id ? { ...row, ...cambios } : row)));
      const { error } = await supabase
        .from(CONFIG_ITEM_MATERIALES.tabla)
        .update(cambios)
        .eq("id", id);
      if (error) {
        console.error("[useItemMateriales] error actualizando material:", error);
      }
    },
    [setData],
  );

  // ── Quitar un material de la composición del objeto ─────────────────────
  const eliminar = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from(CONFIG_ITEM_MATERIALES.tabla)
        .delete()
        .eq("id", id);
      if (error) {
        console.error("[useItemMateriales] error eliminando material:", error);
        return { ok: false, error };
      }
      setData((prev) => prev.filter((row) => row.id !== id));
      return { ok: true, error: null };
    },
    [setData],
  );

  return {
    items,
    loading: itemId ? loading : false,
    agregar,
    actualizar,
    eliminar,
  };
}
