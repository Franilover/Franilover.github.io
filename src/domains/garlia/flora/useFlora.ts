"use client";

/**
 * useFlora.ts
 * ───────────────────────────────────────────────────────────────────────────
 * CRUD directo (mismo molde simple que useClados/useEcosistemas en
 * biologia/useBiologia.ts — sin Dexie/offline-sync) para organismos vegetales.
 *
 * NOTA MIGRACIÓN (2026-08-26): antes apuntaba a la tabla legacy `flora`.
 * Ahora usa la tabla canónica `organismos` (filtrada por
 * tipo_organismo = 'vegetal'), según sistema_arquitectura §15 y el
 * comentario de la propia tabla `organismos` en Supabase. `flora` y
 * `flora_compuestos` quedan sin uso desde el frontend; no se borraron
 * en la base por si hay otras dependencias no verificadas.
 */

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import { type Flora, type FloraInput } from "./types";

const TABLA = "organismos";
const TIPO_ORGANISMO = "vegetal";

export function useFlora() {
  const [flora, setFlora] = useState<Flora[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(TABLA)
      .select("*")
      .eq("tipo_organismo", TIPO_ORGANISMO)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error && data) setFlora(data as Flora[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const crear = useCallback(async (nombre: string) => {
    setCreating(true);
    const { data, error } = await supabase
      .from(TABLA)
      .insert([
        {
          nombre,
          imagen_url: null,
          descripcion: "",
          compuesto_id: null,
          notas: "",
          tipo_organismo: TIPO_ORGANISMO,
        },
      ])
      .select()
      .single();
    setCreating(false);
    if (error || !data) return null;
    setFlora((prev) => [...prev, data as Flora]);
    return data as Flora;
  }, []);

  const actualizar = useCallback(
    async (id: string, updates: FloraInput) => {
      setFlora((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
      const { error } = await supabase.from(TABLA).update(updates).eq("id", id);
      if (error) {
        console.error("[useFlora] error actualizando flora:", error);
        void load();
      }
    },
    [load],
  );

  const eliminar = useCallback(async (id: string) => {
    setFlora((prev) => prev.filter((f) => f.id !== id));
    await supabase.from(TABLA).delete().eq("id", id);
  }, []);

  return { flora, loading, creating, crear, actualizar, eliminar };
}
