"use client";

/**
 * useVetas.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Espejo de useGranos.ts, un nivel arriba: catálogo GLOBAL de Vetas (tabla
 * real "vetas") con CRUD completo, independiente de cualquier Formación.
 * Ver useGranos.ts / useCelulas.ts para el razonamiento completo.
 */

import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

import { CONFIG_VETAS, type Veta } from "@/domains/garlia/elementos/types";

export function useVetas() {
  const { data, setData, loading } = useSupabaseData<Veta>(CONFIG_VETAS.tabla, {
    select: CONFIG_VETAS.select,
    order: { campo: "created_at" },
  });

  const items = useMemo(() => data, [data]);

  const [creando, setCreando] = useState(false);

  // ── Crear una Veta suelta (sin grano_id todavía) ──────────────────────────
  const crear = useCallback(async () => {
    setCreando(true);
    try {
      const { data: nueva, error } = await supabase
        .from(CONFIG_VETAS.tabla)
        .insert([{ nombre: "Nueva veta", grano_id: null, estructura: [] }])
        .select()
        .single();
      if (error || !nueva) return null;
      setData((prev) => [...prev, nueva as Veta]);
      return nueva as Veta;
    } finally {
      setCreando(false);
    }
  }, [setData]);

  const actualizar = useCallback(
    async (id: string, cambios: Partial<Veta>) => {
      setData((prev) => prev.map((v) => (v.id === id ? { ...v, ...cambios } : v)));
      const { error } = await supabase.from(CONFIG_VETAS.tabla).update(cambios).eq("id", id);
      if (error) console.error("[useVetas] error actualizando veta:", error);
    },
    [setData],
  );

  // ── Eliminar — rechazado por Supabase si algún formacion_vetas todavía
  // referencia esta Veta (FK constraint); el error se propaga tal cual. ────
  const eliminar = useCallback(
    async (id: string) => {
      const { error } = await supabase.from(CONFIG_VETAS.tabla).delete().eq("id", id);
      if (error) {
        console.error("[useVetas] error eliminando veta:", error);
        return { ok: false, error };
      }
      setData((prev) => prev.filter((v) => v.id !== id));
      return { ok: true, error: null };
    },
    [setData],
  );

  return { items, setItems: setData, loading, creando, crear, actualizar, eliminar };
}
