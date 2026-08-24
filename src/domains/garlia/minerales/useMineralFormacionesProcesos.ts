"use client";

/**
 * useMineralFormacionesProcesos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Hook para CRUD de Formaciones y Procesos de un mineral. Mismo molde que
 * usePlantaOrganosProcesos.ts (ver ese archivo para el razonamiento
 * completo sobre el patrón de vínculo N:N) — el CRUD del vínculo N:N de
 * Formaciones ya no se reimplementa a mano acá, delega directo a
 * useEntidadVinculosGrupo, instanciado con padreTipo="mineral" contra el
 * catálogo real "formaciones" vía estructura_componentes — FASE 7,
 * reemplaza la tabla dedicada "mineral_formaciones" (sigue existiendo sin
 * usarse, limpieza en Fase 8). Dos diferencias deliberadas frente a Flora:
 *
 * - Sin `orden`/reordenarProcesos: a diferencia del ciclo de vida de una
 *   planta, los procesos geológicos de un mineral no tienen una secuencia
 *   narrativa única (puede oxidarse sin metamorfizar, o al revés), así que
 *   no hay drag-and-drop ni columna `orden` que persistir.
 *
 * - migrarComponentesLegado: el campo plano `Mineral.componentes`
 *   (composición sin estructura, pre-Formaciones) se migra una sola vez la
 *   primera vez que se cargan formaciones para un mineral que aún no tiene
 *   ninguna. FASE 7: ya NO se archiva aparte en "mineral_formaciones_legado"
 *   (esa tabla sigue existiendo sin usarse, limpieza en Fase 8) — en vez de
 *   eso crea directo un vínculo mineral→compuesto en estructura_componentes
 *   por cada entrada del JSONB legado (mismo criterio que se usó para migrar
 *   flora.componentes en Fase 7), preservando `tag` como `rol` cuando existe.
 *   Sigue sin crear una Formación real: ese ensamblaje con fórmula vía
 *   Vetas/Granos queda como paso manual aparte.
 *
 * Formaciones: catálogo propio — tabla real "formaciones" (separada de
 * "organos", que usan Flora/Criaturas; compartida con Estructura de
 * Items), vinculado N:N vía estructura_componentes (padre_tipo='mineral',
 * hijo_tipo='formacion' para el catálogo, hijo_tipo='compuesto' para la
 * migración legado) — el nombre/función/notas viven en la Formación, la
 * fórmula vive más abajo vía formacion_vetas, no acá.
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";
import { db } from "@/infra/supabase/db";

import type { Formacion } from "@/domains/garlia/elementos/types";
import { useEntidadVinculosGrupo } from "@/domains/garlia/_shared/useEntidadVinculosGrupo";

import type { Mineral, MineralFormacion, MineralProceso, MineralProcesoInput } from "./types";

// ── Cache-first para mineral_reacciones (Fase 8): mismo patrón que
// useSistemaOrganos.ts — Dexie filtrado por mineral_id, luego revalidar.
async function leerProcesosDeDexie(mineralId: string): Promise<MineralProceso[]> {
  try {
    if (!db) return [];
    const rows = await db.mineral_reacciones
      .where("mineral_id")
      .equals(mineralId)
      .toArray();
    return rows as unknown as MineralProceso[];
  } catch {
    return [];
  }
}

async function guardarProcesosEnDexie(procesos: MineralProceso[]) {
  try {
    if (!db || procesos.length === 0) return;
    await db.mineral_reacciones.bulkPut(procesos as any[]);
  } catch (e) {
    console.warn("[useMineralFormacionesProcesos] no se pudo guardar procesos en Dexie:", e);
  }
}

export function useMineralFormacionesProcesos(
  mineralId: string,
  catalogoFormaciones: Formacion[],
  mineralLegado?: Mineral | null,
) {
  const {
    items: formaciones,
    loading: loadingFormaciones,
    crearYVincular: crearFormacionVinculo,
    vincularExistente: vincularFormacionExistente,
    actualizar: actualizarFormacion,
    desvincular: eliminarFormacion,
    load: loadFormaciones,
  } = useEntidadVinculosGrupo({
    entidadId: mineralId,
    padreTipo: "mineral",
    tablaCatalogo: "formaciones",
    hijoTipo: "formacion",
    catalogo: catalogoFormaciones,
  });

  // crearYVincular acepta un nombre opcional; Formaciones se crean vacías
  // (mismo comportamiento que antes, solo se renombra el wrapper para
  // mantener el nombre de export `crearFormacion` que usa MineralEditor).
  const crearFormacion = useCallback(() => crearFormacionVinculo(""), [crearFormacionVinculo]);

  const [procesos, setProcesos] = useState<MineralProceso[]>([]);
  const [loadingProcesos, setLoadingProcesos] = useState(true);

  // ── Cargar procesos (mineral_reacciones) — Fase 8: cache-first vía Dexie ─
  const loadProcesos = useCallback(async () => {
    // Paso 1: pintar de inmediato con lo que ya haya en Dexie.
    const procesosLocales = await leerProcesosDeDexie(mineralId);
    if (procesosLocales.length > 0) {
      setProcesos(procesosLocales);
      setLoadingProcesos(false);
    } else {
      setLoadingProcesos(true);
    }

    // Paso 2: revalidar contra Supabase en segundo plano.
    const { data: procesoData, error: procesoError } = await supabase
      .from("mineral_reacciones")
      .select("*")
      .eq("mineral_id", mineralId)
      .order("created_at", { ascending: true });

    if (!procesoError && procesoData) {
      setProcesos(procesoData as MineralProceso[]);
      void guardarProcesosEnDexie(procesoData as MineralProceso[]);
    } else if (procesosLocales.length === 0) {
      setProcesos([]);
    }
    setLoadingProcesos(false);
  }, [mineralId]);

  useEffect(() => {
    if (mineralId) void loadProcesos();
  }, [mineralId, loadProcesos]);

  // ── Migración one-shot del campo legado `componentes` ──────────────────
  // Se corre después de la primera carga: si el mineral tiene composición
  // legado pero todavía no tiene ninguna Formación vinculada, crea un
  // vínculo directo mineral→compuesto en estructura_componentes por cada
  // entrada del JSONB legado (FASE 7 — mismo criterio que se usó para
  // migrar flora.componentes). `tag`, si existe, se preserva como `rol`.
  // Sigue sin inventar una Formación/fórmula sintética: eso queda como
  // paso manual aparte, vía useFormacionVetas sobre una Formación creada
  // a mano.
  useEffect(() => {
    if (!mineralId || loadingFormaciones) return;
    if (formaciones.length > 0) return;
    const legado = mineralLegado?.componentes;
    if (!legado || legado.length === 0) return;

    void (async () => {
      const { error } = await supabase.from("estructura_componentes").insert(
        legado.map((c) => ({
          padre_tipo: "mineral",
          padre_id: mineralId,
          hijo_tipo: "compuesto",
          hijo_id: c.compuesto_id,
          rol: c.tag || null,
        })),
      );
      if (error) {
        console.error("[useMineralFormacionesProcesos] error migrando componentes legado:", error);
      }
    })();
    // Solo debe dispararse una vez apenas se sabe que no hay formaciones —
    // no en cada cambio de `formaciones` (evitaría re-disparar en loop).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mineralId, loadingFormaciones]);

  // ── CRUD de procesos: solo un evento geológico (descripcion) — el
  // consume/produce vive en la Reacción vinculada 1:1 (ver
  // useEntidadVinculoReaccion, instanciado por proceso desde la UI). Tabla
  // real "mineral_reacciones" (no "mineral_procesos"), sin columna `orden`
  // — los eventos geológicos no tienen secuencia narrativa única. ────────
  const crearProceso = useCallback(async () => {
    const { data, error } = await supabase
      .from("mineral_reacciones")
      .insert([{ mineral_id: mineralId, descripcion: null, reaccion_id: null }])
      .select()
      .single();

    if (error || !data) return null;
    setProcesos((prev) => [...prev, data as MineralProceso]);
    void guardarProcesosEnDexie([data as MineralProceso]);
    return data as MineralProceso;
  }, [mineralId]);

  const actualizarProceso = useCallback(
    async (id: string, updates: MineralProcesoInput) => {
      setProcesos((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, ...updates } : p));
        const actualizado = next.find((p) => p.id === id);
        if (actualizado) void guardarProcesosEnDexie([actualizado]);
        return next;
      });
      const { error } = await supabase.from("mineral_reacciones").update(updates).eq("id", id);
      if (error) void loadProcesos();
    },
    [loadProcesos],
  );

  const eliminarProceso = useCallback(async (id: string) => {
    setProcesos((prev) => prev.filter((p) => p.id !== id));
    try {
      if (db) await db.mineral_reacciones.delete(id);
    } catch {}
    await supabase.from("mineral_reacciones").delete().eq("id", id);
  }, []);

  return {
    formaciones: formaciones as MineralFormacion[],
    procesos,
    loading: loadingFormaciones || loadingProcesos,
    // Formaciones
    crearFormacion,
    vincularFormacionExistente,
    actualizarFormacion,
    eliminarFormacion,
    // Procesos
    crearProceso,
    actualizarProceso,
    eliminarProceso,
    // Reload
    load: useCallback(async () => {
      await Promise.all([loadFormaciones(), loadProcesos()]);
    }, [loadFormaciones, loadProcesos]),
  };
}
