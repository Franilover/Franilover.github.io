"use client";

/**
 * useMineralFormacionesProcesos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Hook para CRUD de Formaciones y Procesos de un mineral. Mismo molde que
 * usePlantaOrganosProcesos.ts (ver ese archivo para el razonamiento
 * completo sobre el patrón de vínculo N:N) — el CRUD del vínculo N:N de
 * Formaciones ya no se reimplementa a mano acá, delega directo a
 * useEntidadVinculosGrupo, instanciado contra la tabla real "formaciones"
 * y la tabla puente "mineral_formaciones". Dos diferencias deliberadas
 * frente a Flora:
 *
 * - Sin `orden`/reordenarProcesos: a diferencia del ciclo de vida de una
 *   planta, los procesos geológicos de un mineral no tienen una secuencia
 *   narrativa única (puede oxidarse sin metamorfizar, o al revés), así que
 *   no hay drag-and-drop ni columna `orden` que persistir.
 *
 * - migrarComponentesLegado: el campo plano `Mineral.componentes` (composición
 *   sin estructura, pre-Formaciones) se migra una sola vez la primera vez
 *   que se cargan formaciones para un mineral que aún no tiene ninguna.
 *   Ya NO se convierte en una Formación real del catálogo (una Formación
 *   ya no tiene columna `componentes` para volcar ahí) — se archiva tal
 *   cual en la tabla real "mineral_formaciones_legado" (id, mineral_id,
 *   nombre, componentes jsonb, notas), pensada justo para este caso: no
 *   se pierde la data vieja, pero tampoco se fuerza una Formación/Tejido/
 *   Célula sintética solo para alojarla. Migrar esa data a una Formación
 *   real con su fórmula vía Vetas/Granos queda como paso manual aparte.
 *
 * Formaciones: catálogo propio — tabla real "formaciones" (separada de
 * "organos", que usan Flora/Criaturas; compartida con Estructura de
 * Items), vinculado N:N vía la tabla puente "mineral_formaciones" (solo
 * {id, mineral_id, grupo_compuesto_id, created_at} — el nombre/función/
 * notas viven en la Formación, la fórmula vive más abajo vía
 * formacion_vetas, no en esta tabla).
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import type { Formacion } from "@/domains/garlia/elementos/types";
import { useEntidadVinculosGrupo } from "@/domains/garlia/_shared/useEntidadVinculosGrupo";

import type { Mineral, MineralFormacion, MineralProceso, MineralProcesoInput } from "./types";

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
    tablaCatalogo: "formaciones",
    tablaPuente: "mineral_formaciones",
    columnaFk: "mineral_id",
    catalogo: catalogoFormaciones,
  });

  // crearYVincular acepta un nombre opcional; Formaciones se crean vacías
  // (mismo comportamiento que antes, solo se renombra el wrapper para
  // mantener el nombre de export `crearFormacion` que usa MineralEditor).
  const crearFormacion = useCallback(() => crearFormacionVinculo(""), [crearFormacionVinculo]);

  const [procesos, setProcesos] = useState<MineralProceso[]>([]);
  const [loadingProcesos, setLoadingProcesos] = useState(true);

  // ── Cargar procesos (mineral_reacciones) ────────────────────────────────
  const loadProcesos = useCallback(async () => {
    setLoadingProcesos(true);
    const { data: procesoData, error: procesoError } = await supabase
      .from("mineral_reacciones")
      .select("*")
      .eq("mineral_id", mineralId)
      .order("created_at", { ascending: true });

    if (!procesoError && procesoData) {
      setProcesos(procesoData as MineralProceso[]);
    }
    setLoadingProcesos(false);
  }, [mineralId]);

  useEffect(() => {
    if (mineralId) void loadProcesos();
  }, [mineralId, loadProcesos]);

  // ── Migración one-shot del campo legado `componentes` ──────────────────
  // Se corre después de la primera carga: si el mineral tiene composición
  // legado pero todavía no tiene ninguna Formación vinculada, la archiva
  // en "mineral_formaciones_legado" (tabla real pensada para esto — no se
  // inventa una Formación/fórmula sintética) para no perder la data ya
  // cargada por el usuario. No crea vínculo en mineral_formaciones: queda
  // como registro de consulta/migración manual aparte.
  useEffect(() => {
    if (!mineralId || loadingFormaciones) return;
    if (formaciones.length > 0) return;
    const legado = mineralLegado?.componentes;
    if (!legado || legado.length === 0) return;

    void (async () => {
      const { error } = await supabase.from("mineral_formaciones_legado").insert([
        {
          mineral_id: mineralId,
          nombre: "",
          componentes: legado.map((c) => ({ compuesto_id: c.compuesto_id, cantidad: 1 })),
          notas: legado.some((c) => c.tag) ? legado.map((c) => c.tag).filter(Boolean).join(", ") : null,
        },
      ]);
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
    return data as MineralProceso;
  }, [mineralId]);

  const actualizarProceso = useCallback(
    async (id: string, updates: MineralProcesoInput) => {
      setProcesos((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
      const { error } = await supabase.from("mineral_reacciones").update(updates).eq("id", id);
      if (error) void loadProcesos();
    },
    [loadProcesos],
  );

  const eliminarProceso = useCallback(async (id: string) => {
    setProcesos((prev) => prev.filter((p) => p.id !== id));
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
