"use client";

/**
 * useMinerales.ts
 * ───────────────────────────────────────────────────────────────────────────
 * CRUD directo (mismo molde simple que useClados/useEcosistemas en
 * biologia/useBiologia.ts — sin Dexie/offline-sync) para la tabla `minerales`.
 */

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import { type Mineral, type MineralInput } from "./types";

export function useMinerales() {
  const [minerales, setMinerales] = useState<Mineral[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("minerales")
      .select("*")
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error && data) setMinerales(data as Mineral[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const crear = useCallback(async (nombre: string) => {
    setCreating(true);
    const { data, error } = await supabase
      .from("minerales")
      .insert([{ nombre, imagen_url: null, descripcion: "", compuesto_id: null, notas: "" }])
      .select()
      .single();
    setCreating(false);
    if (error || !data) return null;
    setMinerales((prev) => [...prev, data as Mineral]);
    return data as Mineral;
  }, []);

  const actualizar = useCallback(
    async (id: string, updates: MineralInput) => {
      setMinerales((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
      const { error } = await supabase.from("minerales").update(updates).eq("id", id);
      if (error) {
        console.error("[useMinerales] error actualizando mineral:", error);
        void load();
      }
    },
    [load],
  );

  const eliminar = useCallback(async (id: string) => {
    setMinerales((prev) => prev.filter((m) => m.id !== id));
    await supabase.from("minerales").delete().eq("id", id);
  }, []);

  return { minerales, loading, creating, crear, actualizar, eliminar };
}
