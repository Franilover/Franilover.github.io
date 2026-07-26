"use client";

/**
 * useCiudadesItem.ts
 * ───────────────────
 * Ciudades donde se encuentra el ítem (tabla item_ciudades).
 *
 * Ruta destino:
 *   src/features/editorGarlia/hooks/useCiudadesItem.ts
 */

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/api/client/supabase";

import { type CiudadMin } from "../misc/useItemCatalogosUbicacion";

export type ItemCiudadRow = {
  rowId: string;
  ciudadId: string;
  ciudadNombre: string;
};

export function useCiudadesItem(itemId: string) {
  const [rows, setRows] = useState<ItemCiudadRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("item_ciudades")
      .select("id, ciudad_id, ciudades!ciudad_id(nombre)")
      .eq("item_id", itemId);

    setRows(
      (data ?? []).map((r: any) => ({
        rowId: r.id,
        ciudadId: r.ciudad_id,
        ciudadNombre:
          (Array.isArray(r.ciudades)
            ? r.ciudades[0]?.nombre
            : r.ciudades?.nombre) ?? "—",
      })),
    );
    setLoading(false);
  }, [itemId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (l: CiudadMin) => {
    if (rows.some((r) => r.ciudadId === l.id)) return;
    const { data, error } = await supabase
      .from("item_ciudades")
      .insert([{ item_id: itemId, ciudad_id: l.id }])
      .select()
      .single();
    if (!error && data) {
      setRows((prev) => [
        ...prev,
        { rowId: data.id, ciudadId: l.id, ciudadNombre: l.nombre },
      ]);
    }
  };

  const remove = async (rowId: string) => {
    await supabase.from("item_ciudades").delete().eq("id", rowId);
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  return { rows, loading, add, remove };
}
