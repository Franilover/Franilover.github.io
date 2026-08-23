"use client";

/**
 * useGranos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Espejo inerte de useCelulas.ts: catálogo GLOBAL de Granos (tabla real
 * "granos") con CRUD completo — crear, actualizar y eliminar un Grano
 * suelto, sin que esté vinculado todavía a ninguna Veta/Formación.
 *
 * Hasta ahora los Granos solo se creaban en cadena desde
 * useFormacionVetas.agregarCompuesto (ver ese archivo) — este hook expone
 * el catálogo completo de forma independiente, mismo patrón que
 * useCelulas.ts (fetch con useSupabaseData) para no repetir esa lógica en
 * FisicaPage.tsx.
 */

import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

import { CONFIG_GRANOS, type Grano } from "@/domains/garlia/elementos/types";

export function useGranos() {
  const { data, setData, loading } = useSupabaseData<Grano>(CONFIG_GRANOS.tabla, {
    select: CONFIG_GRANOS.select,
    order: { campo: "created_at" },
  });

  const items = useMemo(() => data, [data]);

  const [creando, setCreando] = useState(false);

  // ── Crear un Grano suelto (sin compuesto_id todavía) ─────────────────────
  const crear = useCallback(async () => {
    setCreando(true);
    try {
      const { data: nuevo, error } = await supabase
        .from(CONFIG_GRANOS.tabla)
        .insert([{ nombre: "Nuevo grano", compuesto_id: null, estructura: [] }])
        .select()
        .single();
      if (error || !nuevo) return null;
      setData((prev) => [...prev, nuevo as Grano]);
      return nuevo as Grano;
    } finally {
      setCreando(false);
    }
  }, [setData]);

  const actualizar = useCallback(
    async (id: string, cambios: Partial<Grano>) => {
      setData((prev) => prev.map((g) => (g.id === id ? { ...g, ...cambios } : g)));
      const { error } = await supabase.from(CONFIG_GRANOS.tabla).update(cambios).eq("id", id);
      if (error) console.error("[useGranos] error actualizando grano:", error);
    },
    [setData],
  );

  // ── Eliminar — solo tiene sentido si no está en uso por ninguna Veta;
  // Supabase rechaza el delete si hay FK apuntando (constraint), y ese
  // error se propaga tal cual para que la UI lo muestre. ─────────────────
  const eliminar = useCallback(
    async (id: string) => {
      const { error } = await supabase.from(CONFIG_GRANOS.tabla).delete().eq("id", id);
      if (error) {
        console.error("[useGranos] error eliminando grano:", error);
        return { ok: false, error };
      }
      setData((prev) => prev.filter((g) => g.id !== id));
      return { ok: true, error: null };
    },
    [setData],
  );

  return { items, setItems: setData, loading, creando, crear, actualizar, eliminar };
}
