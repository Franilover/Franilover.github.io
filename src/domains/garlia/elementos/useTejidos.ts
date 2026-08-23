"use client";

/**
 * useTejidos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Espejo de useCelulas.ts, un nivel arriba: catálogo GLOBAL de Tejidos
 * (tabla real "tejidos") con CRUD completo, independiente de cualquier
 * Órgano. Ver useCelulas.ts para el razonamiento completo.
 */

import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

import { CONFIG_TEJIDOS, type Tejido } from "@/domains/garlia/elementos/types";

export function useTejidos() {
  const { data, setData, loading } = useSupabaseData<Tejido>(CONFIG_TEJIDOS.tabla, {
    select: CONFIG_TEJIDOS.select,
    order: { campo: "created_at" },
  });

  const items = useMemo(() => data, [data]);

  const [creando, setCreando] = useState(false);

  // ── Crear un Tejido suelto (sin celula_id todavía) ───────────────────────
  const crear = useCallback(async () => {
    setCreando(true);
    try {
      const { data: nuevo, error } = await supabase
        .from(CONFIG_TEJIDOS.tabla)
        .insert([{ nombre: "Nuevo tejido", celula_id: null, estructura: [] }])
        .select()
        .single();
      if (error || !nuevo) return null;
      setData((prev) => [...prev, nuevo as Tejido]);
      return nuevo as Tejido;
    } finally {
      setCreando(false);
    }
  }, [setData]);

  const actualizar = useCallback(
    async (id: string, cambios: Partial<Tejido>) => {
      setData((prev) => prev.map((t) => (t.id === id ? { ...t, ...cambios } : t)));
      const { error } = await supabase.from(CONFIG_TEJIDOS.tabla).update(cambios).eq("id", id);
      if (error) console.error("[useTejidos] error actualizando tejido:", error);
    },
    [setData],
  );

  // ── Eliminar — rechazado por Supabase si algún organo_tejidos todavía
  // referencia este Tejido (FK constraint); el error se propaga tal cual. ──
  const eliminar = useCallback(
    async (id: string) => {
      const { error } = await supabase.from(CONFIG_TEJIDOS.tabla).delete().eq("id", id);
      if (error) {
        console.error("[useTejidos] error eliminando tejido:", error);
        return { ok: false, error };
      }
      setData((prev) => prev.filter((t) => t.id !== id));
      return { ok: true, error: null };
    },
    [setData],
  );

  return { items, setItems: setData, loading, creando, crear, actualizar, eliminar };
}
