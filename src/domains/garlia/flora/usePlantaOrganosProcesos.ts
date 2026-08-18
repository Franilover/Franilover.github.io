"use client";

/**
 * usePlantaOrganosProcesos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Hook para CRUD de planta_organos y planta_procesos. Carga ambas tablas
 * filtradas por planta_id y proporciona métodos para crear, actualizar y
 * eliminar registros.
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import type { PlantaOrgano, PlantaProceso, PlantaOrganoInput, PlantaProcesoInput } from "./types";

export function usePlantaOrganosProcesos(plantaId: string) {
  const [organos, setOrganos] = useState<PlantaOrgano[]>([]);
  const [procesos, setProcesos] = useState<PlantaProceso[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Cargar órganos y procesos ──────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);

    // Cargar órganos
    const { data: organoData, error: organoError } = await supabase
      .from("planta_organos")
      .select("*")
      .eq("planta_id", plantaId)
      .order("created_at", { ascending: true });

    if (!organoError && organoData) {
      setOrganos(organoData as PlantaOrgano[]);
    }

    // Cargar procesos
    const { data: procesoData, error: procesoError } = await supabase
      .from("planta_procesos")
      .select("*")
      .eq("planta_id", plantaId)
      .order("orden", { ascending: true });

    if (!procesoError && procesoData) {
      setProcesos(procesoData as PlantaProceso[]);
    }

    setLoading(false);
  }, [plantaId]);

  useEffect(() => {
    if (plantaId) void load();
  }, [plantaId, load]);

  // ── CRUD de órganos ────────────────────────────────────────────────────
  const crearOrgano = useCallback(
    async (tipoOrgano: PlantaOrgano["tipo_organo"]) => {
      const { data, error } = await supabase
        .from("planta_organos")
        .insert([{ planta_id: plantaId, tipo_organo: tipoOrgano, componentes: null }])
        .select()
        .single();

      if (error || !data) return null;
      setOrganos((prev) => [...prev, data as PlantaOrgano]);
      return data as PlantaOrgano;
    },
    [plantaId],
  );

  const actualizarOrgano = useCallback(
    async (id: string, updates: PlantaOrganoInput) => {
      setOrganos((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
      const { error } = await supabase.from("planta_organos").update(updates).eq("id", id);
      if (error) void load();
    },
    [load],
  );

  const eliminarOrgano = useCallback(async (id: string) => {
    setOrganos((prev) => prev.filter((o) => o.id !== id));
    await supabase.from("planta_organos").delete().eq("id", id);
  }, []);

  // ── CRUD de procesos ───────────────────────────────────────────────────
  const crearProceso = useCallback(
    async (tipoProceso: PlantaProceso["tipo_proceso"]) => {
      const maxOrden = procesos.length > 0 ? Math.max(...procesos.map((p) => p.orden)) : -1;

      const { data, error } = await supabase
        .from("planta_procesos")
        .insert([
          {
            planta_id: plantaId,
            tipo_proceso: tipoProceso,
            orden: maxOrden + 1,
            consume: null,
            produce: null,
            condiciones: null,
            descripcion: null,
          },
        ])
        .select()
        .single();

      if (error || !data) return null;
      setProcesos((prev) => [...prev, data as PlantaProceso].sort((a, b) => a.orden - b.orden));
      return data as PlantaProceso;
    },
    [plantaId, procesos],
  );

  const actualizarProceso = useCallback(
    async (id: string, updates: PlantaProcesoInput) => {
      setProcesos((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
      const { error } = await supabase.from("planta_procesos").update(updates).eq("id", id);
      if (error) void load();
    },
    [load],
  );

  const eliminarProceso = useCallback(async (id: string) => {
    setProcesos((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("planta_procesos").delete().eq("id", id);
  }, []);

  return {
    organos,
    procesos,
    loading,
    // Órganos
    crearOrgano,
    actualizarOrgano,
    eliminarOrgano,
    // Procesos
    crearProceso,
    actualizarProceso,
    eliminarProceso,
    // Reload
    load,
  };
}
