"use client";

/**
 * useMineralFormacionesProcesos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Hook para CRUD de mineral_formaciones y mineral_procesos. Mismo molde que
 * usePlantaOrganosProcesos.ts (ver ese archivo para el razonamiento
 * completo), con dos diferencias deliberadas:
 *
 * - Sin `orden`/reordenarProcesos: a diferencia del ciclo de vida de una
 *   planta, los procesos geológicos de un mineral no tienen una secuencia
 *   narrativa única (puede oxidarse sin metamorfizar, o al revés), así que
 *   no hay drag-and-drop ni columna `orden` que persistir.
 *
 * - migrarComponentesLegado: el campo plano `Mineral.componentes` (composición
 *   sin estructura, pre-Formaciones) se migra una sola vez a una Formación
 *   real de tipo "otro" la primera vez que se cargan formaciones para un
 *   mineral que aún no tiene ninguna. Así no se pierde data ya cargada.
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import type {
  Mineral,
  MineralFormacion,
  MineralFormacionInput,
  MineralProceso,
  MineralProcesoInput,
} from "./types";

export function useMineralFormacionesProcesos(mineralId: string, mineralLegado?: Mineral | null) {
  const [formaciones, setFormaciones] = useState<MineralFormacion[]>([]);
  const [procesos, setProcesos] = useState<MineralProceso[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Cargar formaciones y procesos ──────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);

    const { data: formacionData, error: formacionError } = await supabase
      .from("mineral_formaciones")
      .select("*")
      .eq("mineral_id", mineralId)
      .order("created_at", { ascending: true });

    if (!formacionError && formacionData) {
      setFormaciones(formacionData as MineralFormacion[]);
    }

    const { data: procesoData, error: procesoError } = await supabase
      .from("mineral_procesos")
      .select("*")
      .eq("mineral_id", mineralId)
      .order("created_at", { ascending: true });

    if (!procesoError && procesoData) {
      setProcesos(procesoData as MineralProceso[]);
    }

    setLoading(false);
    return { formacionesVacias: !formacionError && (formacionData?.length ?? 0) === 0 };
  }, [mineralId]);

  useEffect(() => {
    if (mineralId) void load();
  }, [mineralId, load]);

  // ── Migración one-shot del campo legado `componentes` ──────────────────
  // Se corre después de la primera carga: si el mineral tiene composición
  // legado pero todavía no tiene ninguna Formación, la convierte en una
  // Formación tipo "otro" para no perder la data ya cargada por el usuario.
  useEffect(() => {
    if (!mineralId || loading) return;
    if (formaciones.length > 0) return;
    const legado = mineralLegado?.componentes;
    if (!legado || legado.length === 0) return;

    void (async () => {
      const { data, error } = await supabase
        .from("mineral_formaciones")
        .insert([
          {
            mineral_id: mineralId,
            tipo_formacion: "otro",
            componentes: legado.map((c) => ({ compuesto_id: c.compuesto_id, cantidad: 1 })),
            notas: legado.some((c) => c.tag) ? legado.map((c) => c.tag).filter(Boolean).join(", ") : null,
          },
        ])
        .select()
        .single();

      if (!error && data) {
        setFormaciones((prev) => (prev.length > 0 ? prev : [data as MineralFormacion]));
      }
    })();
    // Solo debe dispararse una vez apenas se sabe que no hay formaciones —
    // no en cada cambio de `formaciones` (evitaría re-disparar en loop).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mineralId, loading]);

  // ── CRUD de formaciones ─────────────────────────────────────────────────
  const crearFormacion = useCallback(
    async (tipoFormacion: MineralFormacion["tipo_formacion"]) => {
      const { data, error } = await supabase
        .from("mineral_formaciones")
        .insert([{ mineral_id: mineralId, tipo_formacion: tipoFormacion, componentes: null }])
        .select()
        .single();

      if (error || !data) return null;
      setFormaciones((prev) => [...prev, data as MineralFormacion]);
      return data as MineralFormacion;
    },
    [mineralId],
  );

  const actualizarFormacion = useCallback(
    async (id: string, updates: MineralFormacionInput) => {
      setFormaciones((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
      const { error } = await supabase.from("mineral_formaciones").update(updates).eq("id", id);
      if (error) {
        console.error("[useMineralFormacionesProcesos] error actualizando formacion:", error);
        void load();
      }
    },
    [load],
  );

  const eliminarFormacion = useCallback(async (id: string) => {
    setFormaciones((prev) => prev.filter((f) => f.id !== id));
    await supabase.from("mineral_formaciones").delete().eq("id", id);
  }, []);

  // ── CRUD de procesos ────────────────────────────────────────────────────
  const crearProceso = useCallback(
    async (tipoProceso: MineralProceso["tipo_proceso"]) => {
      const { data, error } = await supabase
        .from("mineral_procesos")
        .insert([
          {
            mineral_id: mineralId,
            tipo_proceso: tipoProceso,
            consume: null,
            produce: null,
            condiciones: null,
            descripcion: null,
          },
        ])
        .select()
        .single();

      if (error || !data) return null;
      setProcesos((prev) => [...prev, data as MineralProceso]);
      return data as MineralProceso;
    },
    [mineralId],
  );

  const actualizarProceso = useCallback(
    async (id: string, updates: MineralProcesoInput) => {
      setProcesos((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
      const { error } = await supabase.from("mineral_procesos").update(updates).eq("id", id);
      if (error) void load();
    },
    [load],
  );

  const eliminarProceso = useCallback(async (id: string) => {
    setProcesos((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("mineral_procesos").delete().eq("id", id);
  }, []);

  return {
    formaciones,
    procesos,
    loading,
    // Formaciones
    crearFormacion,
    actualizarFormacion,
    eliminarFormacion,
    // Procesos
    crearProceso,
    actualizarProceso,
    eliminarProceso,
    // Reload
    load,
  };
}
