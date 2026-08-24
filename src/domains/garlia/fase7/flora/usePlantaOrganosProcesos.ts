"use client";

/**
 * usePlantaOrganosProcesos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Hook para CRUD de Órganos y Procesos de una planta.
 *
 * Órganos: catálogo propio — tabla real "organos" (separada de
 * "formaciones", que usan Minerales/Items; compartida con Órganos de
 * Criaturas vía "criatura_organos"). Ya no tiene columna `componentes`: la
 * fórmula vive vía Tejidos/Células (organo_tejidos→tejidos→celulas→
 * compuesto_id, ver useOrganoTejidos). El CRUD del vínculo N:N ya no se
 * reimplementa acá — delega directo a useEntidadVinculosGrupo, mismo motor
 * que usan Formaciones de Minerales/Items y Órganos de Criaturas.
 *
 * Procesos: siguen siendo solo una etapa del ciclo de vida (descripcion)
 * que vincula 1:1 un Proceso/Reacción de la tabla real "reacciones" vía
 * reaccion_id — el CRUD de ese vínculo vive en useEntidadVinculoReaccion,
 * instanciado desde el componente que renderiza cada PlantaProceso. Esta
 * parte no cambió: sigue viviendo acá porque es propia de Flora (con
 * `orden` para el drag-and-drop del ciclo de vida, a diferencia de
 * Minerales).
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import type { Organo } from "@/domains/garlia/elementos/types";
import { useEntidadVinculosGrupo } from "@/domains/garlia/_shared/useEntidadVinculosGrupo";

import type { PlantaOrganoResuelto, PlantaProceso, PlantaProcesoInput } from "./types";

export function usePlantaOrganosProcesos(plantaId: string, catalogoOrganos: Organo[]) {
  const {
    items: organos,
    loading: loadingOrganos,
    crearYVincular: crearYVincularOrgano,
    vincularExistente: vincularOrganoExistente,
    actualizar: actualizarOrgano,
    desvincular: desvincularOrgano,
    load: loadOrganos,
  } = useEntidadVinculosGrupo({
    entidadId: plantaId,
    padreTipo: "planta",
    tablaCatalogo: "organos",
    hijoTipo: "organo",
    catalogo: catalogoOrganos,
  });

  const [procesos, setProcesos] = useState<PlantaProceso[]>([]);
  const [loadingProcesos, setLoadingProcesos] = useState(true);

  // ── Cargar procesos (planta_reacciones) ─────────────────────────────────
  const loadProcesos = useCallback(async () => {
    setLoadingProcesos(true);
    const { data: procesoData, error: procesoError } = await supabase
      .from("planta_reacciones")
      .select("*")
      .eq("planta_id", plantaId)
      .order("orden", { ascending: true });

    if (!procesoError && procesoData) {
      setProcesos(procesoData as PlantaProceso[]);
    }
    setLoadingProcesos(false);
  }, [plantaId]);

  useEffect(() => {
    if (plantaId) void loadProcesos();
  }, [plantaId, loadProcesos]);

  // ── CRUD de procesos: solo una etapa (descripcion) — el consume/produce
  // vive en la Reacción vinculada 1:1 (ver useEntidadVinculoReaccion,
  // instanciado por proceso desde la UI). Tabla real "planta_reacciones"
  // (no "planta_procesos") — tiene columna `orden` propia para el
  // drag-and-drop del ciclo de vida. ─────────────────────────────────────
  const crearProceso = useCallback(async () => {
    const siguienteOrden =
      procesos.length > 0 ? Math.max(...procesos.map((p) => p.orden ?? 0)) + 1 : 0;
    const { data, error } = await supabase
      .from("planta_reacciones")
      .insert([{ planta_id: plantaId, descripcion: null, reaccion_id: null, orden: siguienteOrden }])
      .select()
      .single();

    if (error || !data) return null;
    setProcesos((prev) => [...prev, data as PlantaProceso]);
    return data as PlantaProceso;
  }, [plantaId, procesos]);

  const actualizarProceso = useCallback(
    async (id: string, updates: PlantaProcesoInput) => {
      setProcesos((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
      const { error } = await supabase.from("planta_reacciones").update(updates).eq("id", id);
      if (error) void loadProcesos();
    },
    [loadProcesos],
  );

  const eliminarProceso = useCallback(async (id: string) => {
    setProcesos((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("planta_reacciones").delete().eq("id", id);
  }, []);

  return {
    organos: organos as PlantaOrganoResuelto[],
    procesos,
    loading: loadingOrganos || loadingProcesos,
    // Órganos
    crearYVincularOrgano,
    vincularOrganoExistente,
    actualizarOrgano,
    desvincularOrgano,
    // Procesos
    crearProceso,
    actualizarProceso,
    eliminarProceso,
    // Reload
    load: useCallback(async () => {
      await Promise.all([loadOrganos(), loadProcesos()]);
    }, [loadOrganos, loadProcesos]),
  };
}
