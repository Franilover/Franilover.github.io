"use client";

/**
 * useSubsistemasMagia
 * ───────────────────────────────────────────────────────────────────────────
 * CRUD directo (sin offline-sync/Dexie, a diferencia de useSupabaseData) para
 * la tabla `subsistemas_magia` — subsistemas como Luminia, Sintonía, Litonio,
 * Fitonio, Hemonia, etc. del sistema de magia. Cada subsistema tiene un
 * nombre, descripción libre, y tablas de Canales / Filtros / Complementos
 * (mismo formato que el documento de referencia: nombre + descripción +
 * qué Oris canaliza).
 *
 * Es una tabla nueva y aislada — no necesita el pipeline grande de
 * useSupabaseData (Dexie, canales realtime compartidos, etc.), así que se
 * maneja con un CRUD simple directo a Supabase.
 */

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

export interface SubsistemaFila {
  nombre: string;
  descripcion?: string;
  canaliza?: string;
}

export interface SubsistemaMagia {
  id: string;
  nombre: string;
  descripcion: string;
  canales: SubsistemaFila[];
  filtros: SubsistemaFila[];
  complementos: SubsistemaFila[];
  orden: number;
  created_at: string;
  updated_at: string;
}

export type SubsistemaInput = Partial<
  Pick<SubsistemaMagia, "nombre" | "descripcion" | "canales" | "filtros" | "complementos" | "orden">
>;

export function useSubsistemasMagia() {
  const [subsistemas, setSubsistemas] = useState<SubsistemaMagia[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("subsistemas_magia")
      .select("*")
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error && data) setSubsistemas(data as SubsistemaMagia[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const crear = useCallback(async (nombre: string) => {
    setCreating(true);
    const { data, error } = await supabase
      .from("subsistemas_magia")
      .insert([{ nombre, descripcion: "", canales: [], filtros: [], complementos: [] }])
      .select()
      .single();
    setCreating(false);
    if (error || !data) return null;
    setSubsistemas((prev) => [...prev, data as SubsistemaMagia]);
    return data as SubsistemaMagia;
  }, []);

  const actualizar = useCallback(async (id: string, updates: SubsistemaInput) => {
    setSubsistemas((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    );
    const { error } = await supabase
      .from("subsistemas_magia")
      .update(updates)
      .eq("id", id);
    if (error) {
      // Revertir en caso de error recargando desde el servidor.
      void load();
    }
  }, [load]);

  const eliminar = useCallback(async (id: string) => {
    setSubsistemas((prev) => prev.filter((s) => s.id !== id));
    await supabase.from("subsistemas_magia").delete().eq("id", id);
  }, []);

  return { subsistemas, loading, creating, crear, actualizar, eliminar };
}
