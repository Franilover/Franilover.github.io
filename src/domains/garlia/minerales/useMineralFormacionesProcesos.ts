"use client";

/**
 * useMineralFormacionesProcesos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Hook para CRUD de Formaciones y Procesos de un mineral. Mismo molde que
 * usePlantaOrganosProcesos.ts (ver ese archivo para el razonamiento
 * completo sobre el patrón de vínculo N:N), con dos diferencias
 * deliberadas:
 *
 * - Sin `orden`/reordenarProcesos: a diferencia del ciclo de vida de una
 *   planta, los procesos geológicos de un mineral no tienen una secuencia
 *   narrativa única (puede oxidarse sin metamorfizar, o al revés), así que
 *   no hay drag-and-drop ni columna `orden` que persistir.
 *
 * - migrarComponentesLegado: el campo plano `Mineral.componentes` (composición
 *   sin estructura, pre-Formaciones) se migra una sola vez a una Formación
 *   real (tabla "estructuras_ensambladas" + vínculo) la primera vez que se
 *   cargan formaciones para un mineral que aún no tiene ninguna. Así no se
 *   pierde data ya cargada.
 *
 * Formaciones: catálogo propio — tabla real "estructuras_ensambladas"
 * (separada de "grupos_compuestos", compartida con Órganos de Flora/
 * Criaturas y Estructura de Items), vinculado N:N vía la tabla puente
 * "mineral_formaciones" (solo {id, mineral_id, grupo_compuesto_id,
 * created_at} — el nombre/fórmula/notas viven en la Formación, no en esta
 * tabla).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import type { GrupoCompuesto } from "@/domains/garlia/elementos/types";

import type {
  Mineral,
  MineralFormacion,
  MineralFormacionVinculo,
  MineralProceso,
  MineralProcesoInput,
} from "./types";

export function useMineralFormacionesProcesos(
  mineralId: string,
  catalogoFormaciones: GrupoCompuesto[],
  mineralLegado?: Mineral | null,
) {
  const [vinculos, setVinculos] = useState<MineralFormacionVinculo[]>([]);
  const [procesos, setProcesos] = useState<MineralProceso[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Cargar vínculos (mineral_formaciones) y procesos ───────────────────
  const load = useCallback(async () => {
    setLoading(true);

    const { data: vinculoData, error: vinculoError } = await supabase
      .from("mineral_formaciones")
      .select("*")
      .eq("mineral_id", mineralId)
      .order("created_at", { ascending: true });

    if (!vinculoError && vinculoData) {
      setVinculos(vinculoData as MineralFormacionVinculo[]);
    }

    const { data: procesoData, error: procesoError } = await supabase
      .from("mineral_reacciones")
      .select("*")
      .eq("mineral_id", mineralId)
      .order("created_at", { ascending: true });

    if (!procesoError && procesoData) {
      setProcesos(procesoData as MineralProceso[]);
    }

    setLoading(false);
    return { formacionesVacias: !vinculoError && (vinculoData?.length ?? 0) === 0 };
  }, [mineralId]);

  useEffect(() => {
    if (mineralId) void load();
  }, [mineralId, load]);

  // ── Formaciones vinculadas a este mineral, ya resueltas contra el
  // catálogo (huérfanos se ignoran silenciosamente, igual que en Flora) ──
  const formaciones = useMemo<MineralFormacion[]>(() => {
    const porId = new Map(catalogoFormaciones.map((g) => [g.id, g]));
    return vinculos
      .map((v) => {
        const grupo = porId.get(v.grupo_compuesto_id);
        if (!grupo) return null;
        return { ...grupo, vinculo_id: v.id };
      })
      .filter((f): f is MineralFormacion => f !== null);
  }, [vinculos, catalogoFormaciones]);

  // ── Migración one-shot del campo legado `componentes` ──────────────────
  // Se corre después de la primera carga: si el mineral tiene composición
  // legado pero todavía no tiene ninguna Formación, la convierte en una
  // Formación (tabla "estructuras_ensambladas") + vínculo, para no perder la data ya
  // cargada por el usuario.
  useEffect(() => {
    if (!mineralId || loading) return;
    if (vinculos.length > 0) return;
    const legado = mineralLegado?.componentes;
    if (!legado || legado.length === 0) return;

    void (async () => {
      const { data: nuevoGrupo, error: errorGrupo } = await supabase
        .from("estructuras_ensambladas")
        .insert([
          {
            nombre: "",
            componentes: legado.map((c) => ({ compuesto_id: c.compuesto_id, cantidad: 1 })),
            notas: legado.some((c) => c.tag) ? legado.map((c) => c.tag).filter(Boolean).join(", ") : null,
          },
        ])
        .select()
        .single();
      if (errorGrupo || !nuevoGrupo) return;

      const { data: vinculo, error: errorVinculo } = await supabase
        .from("mineral_formaciones")
        .insert([{ mineral_id: mineralId, grupo_compuesto_id: (nuevoGrupo as GrupoCompuesto).id }])
        .select()
        .single();
      if (errorVinculo || !vinculo) return;

      setVinculos((prev) => (prev.length > 0 ? prev : [vinculo as MineralFormacionVinculo]));
    })();
    // Solo debe dispararse una vez apenas se sabe que no hay formaciones —
    // no en cada cambio de `vinculos` (evitaría re-disparar en loop).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mineralId, loading]);

  // ── Crear una Formación nueva + vincularla a este mineral ──────────────
  const crearFormacion = useCallback(
    async () => {
      const { data: nuevoGrupo, error: errorGrupo } = await supabase
        .from("estructuras_ensambladas")
        .insert([{ nombre: "", componentes: [] }])
        .select()
        .single();
      if (errorGrupo || !nuevoGrupo) return null;

      const { data: vinculo, error: errorVinculo } = await supabase
        .from("mineral_formaciones")
        .insert([{ mineral_id: mineralId, grupo_compuesto_id: (nuevoGrupo as GrupoCompuesto).id }])
        .select()
        .single();
      if (errorVinculo || !vinculo) return null;

      setVinculos((prev) => [...prev, vinculo as MineralFormacionVinculo]);
      return { ...(nuevoGrupo as GrupoCompuesto), vinculo_id: (vinculo as MineralFormacionVinculo).id };
    },
    [mineralId],
  );

  // ── Vincular una Formación ya existente del catálogo a este mineral ────
  const vincularFormacionExistente = useCallback(
    async (grupoCompuestoId: string) => {
      if (vinculos.some((v) => v.grupo_compuesto_id === grupoCompuestoId)) return null;

      const { data: vinculo, error } = await supabase
        .from("mineral_formaciones")
        .insert([{ mineral_id: mineralId, grupo_compuesto_id: grupoCompuestoId }])
        .select()
        .single();
      if (error || !vinculo) return null;

      setVinculos((prev) => [...prev, vinculo as MineralFormacionVinculo]);
      return vinculo as MineralFormacionVinculo;
    },
    [mineralId, vinculos],
  );

  // ── Actualizar la Formación en el catálogo (afecta a todos los
  // minerales que la tengan vinculada) ────────────────────────────────────
  const actualizarFormacion = useCallback(
    async (grupoCompuestoId: string, updates: Partial<GrupoCompuesto>) => {
      const { error } = await supabase
        .from("estructuras_ensambladas")
        .update(updates)
        .eq("id", grupoCompuestoId);
      if (error) {
        console.error("[useMineralFormacionesProcesos] error actualizando formacion:", error);
      }
    },
    [],
  );

  // ── Desvincular (borra solo la fila puente, la Formación sigue en el
  // catálogo para otros minerales) ─────────────────────────────────────────
  const eliminarFormacion = useCallback(async (vinculoId: string) => {
    setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
    await supabase.from("mineral_formaciones").delete().eq("id", vinculoId);
  }, []);

  // ── CRUD de procesos: ahora solo un evento geológico (descripcion) — el
  // consume/produce vive en la Reacción vinculada 1:1 (ver
  // useEntidadVinculoReaccion, instanciado por proceso desde la UI). Tabla
  // real "mineral_reacciones" (no "mineral_procesos"), sin columna `orden`
  // — los eventos geológicos no tienen secuencia narrativa única. ────────
  const crearProceso = useCallback(
    async () => {
      const { data, error } = await supabase
        .from("mineral_reacciones")
        .insert([{ mineral_id: mineralId, descripcion: null, reaccion_id: null }])
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
      const { error } = await supabase.from("mineral_reacciones").update(updates).eq("id", id);
      if (error) void load();
    },
    [load],
  );

  const eliminarProceso = useCallback(async (id: string) => {
    setProcesos((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("mineral_reacciones").delete().eq("id", id);
  }, []);

  return {
    formaciones,
    procesos,
    loading,
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
    load,
  };
}
