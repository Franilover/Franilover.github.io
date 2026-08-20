"use client";

/**
 * usePlantaOrganosProcesos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Hook para CRUD de planta_organos y planta_procesos. Carga ambas tablas
 * filtradas por planta_id y proporciona métodos para crear, actualizar,
 * eliminar y reordenar registros.
 *
 * Cambios vs versión anterior:
 * - crearOrgano/crearProceso ahora reciben el tipo real elegido por el
 *   usuario (antes el caller siempre pasaba un valor fijo tipo "hoja").
 * - Nuevo reordenarProcesos: recibe la lista de ids en el nuevo orden y
 *   persiste el campo `orden` de cada proceso — mismo patrón que
 *   onReorderCaps en EditorCapitulos.tsx (update optimista + persistencia
 *   individual por fila).
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

    const { data: organoData, error: organoError } = await supabase
      .from("planta_organos")
      .select("*")
      .eq("planta_id", plantaId)
      .order("created_at", { ascending: true });

    if (!organoError && organoData) {
      setOrganos(organoData as PlantaOrgano[]);
    }

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
      if (error) {
        console.error("[usePlantaOrganosProcesos] error actualizando organo:", error);
        void load();
      }
    },
    [load],
  );

  const eliminarOrgano = useCallback(async (id: string) => {
    setOrganos((prev) => prev.filter((o) => o.id !== id));
    await supabase.from("planta_organos").delete().eq("id", id);
  }, []);

  // ── CRUD de procesos ───────────────────────────────────────────────────
  const crearProceso = useCallback(
    async (nombre: string = "") => {
      const maxOrden = procesos.length > 0 ? Math.max(...procesos.map((p) => p.orden)) : -1;

      const { data, error } = await supabase
        .from("planta_procesos")
        .insert([
          {
            planta_id: plantaId,
            nombre,
            orden: maxOrden + 1,
            consume: null,
            produce: null,
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
      setProcesos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      );
      const { error } = await supabase.from("planta_procesos").update(updates).eq("id", id);
      if (error) void load();
    },
    [load],
  );

  const eliminarProceso = useCallback(async (id: string) => {
    setProcesos((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("planta_procesos").delete().eq("id", id);
  }, []);

  /**
   * Reordena procesos: recibe la lista de ids en el nuevo orden deseado y
   * persiste `orden` = índice en esa lista para cada fila. Update optimista
   * primero (UI responde al instante), luego persistencia fila por fila —
   * mismo espíritu que onReorderCaps en EditorCapitulos.tsx.
   */
  const reordenarProcesos = useCallback(
    async (orderedIds: string[]) => {
      setProcesos((prev) => {
        const porId = new Map(prev.map((p) => [p.id, p]));
        const reordenados = orderedIds
          .map((id, idx) => {
            const p = porId.get(id);
            return p ? { ...p, orden: idx } : null;
          })
          .filter((p): p is PlantaProceso => p !== null);
        return reordenados;
      });

      await Promise.all(
        orderedIds.map((id, idx) =>
          supabase.from("planta_procesos").update({ orden: idx }).eq("id", id),
        ),
      );
    },
    [],
  );

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
    reordenarProcesos,
    // Reload
    load,
  };
}
