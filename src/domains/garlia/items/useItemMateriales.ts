"use client";

import { useMemo } from "react";

import { CONFIG_ITEM_MATERIALES, type ItemMaterial } from "./types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

/**
 * Composición física real de un Objeto vía item_materiales — fuente
 * principal del Modelo físico canónico v218 (documentacion_sistema, orden
 * 1001). compuesto_id en `items` es solo una vía secundaria de
 * compatibilidad y nunca se suma a esto (ver "Fuente física única del
 * objeto", orden 212). Solo lectura: cantidad/proporcion ya vienen
 * ponderadas por Supabase en items.propiedades_fisicas, no se recalculan acá.
 */
export function useItemMateriales(itemId?: string | null) {
  const { data, loading } = useSupabaseData<ItemMaterial>(
    CONFIG_ITEM_MATERIALES.tabla,
    {
      select: CONFIG_ITEM_MATERIALES.select,
    },
  );

  const items = useMemo(
    () => (itemId ? data.filter((row) => row.item_id === itemId) : []),
    [data, itemId],
  );

  return {
    items,
    loading: itemId ? loading : false,
  };
}
