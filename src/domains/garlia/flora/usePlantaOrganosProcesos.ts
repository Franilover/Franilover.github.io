"use client";

/**
 * usePlantaOrganosProcesos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Hook para CRUD de Órganos y Procesos de una planta.
 *
 * Órganos: catálogo compartido — ya NO es la tabla propia "organos", sino
 * "grupos_compuestos" filtrado por tipo="organo" (ver elementos/types.ts).
 * Este hook resuelve los vínculos de `plantaId` (tabla puente
 * "planta_organos", ahora con FK `grupo_compuesto_id`) contra el catálogo
 * de Grupos de Compuestos (recibido como parámetro, ya cargado por
 * useGruposCompuestos en el componente padre) y expone:
 *   - crearYVincularOrgano: crea un GrupoCompuesto nuevo (tipo="organo") y
 *     lo vincula a esta planta ("Crear órgano" en el picker).
 *   - vincularOrganoExistente: vincula un GrupoCompuesto ya existente del
 *     catálogo ("Usar uno existente" en el picker) — no duplica nada.
 *   - actualizarOrgano: edita la fórmula/nombre/notas del GrupoCompuesto en
 *     el catálogo — el cambio se refleja en todas las plantas que lo usan.
 *   - desvincularOrgano: quita el vínculo planta↔grupo (borra la fila
 *     puente), sin borrar el GrupoCompuesto del catálogo — así sigue
 *     disponible para otras plantas / para volver a vincularlo.
 *
 * Procesos: sin cambios de modelo, siguen 1:1 con planta_id.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import type { GrupoCompuesto } from "@/domains/garlia/elementos/types";

import type {
  PlantaOrgano,
  PlantaOrganoResuelto,
  PlantaProceso,
  PlantaProcesoInput,
} from "./types";

export function usePlantaOrganosProcesos(plantaId: string, catalogoOrganos: GrupoCompuesto[]) {
  const [vinculos, setVinculos] = useState<PlantaOrgano[]>([]);
  const [procesos, setProcesos] = useState<PlantaProceso[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Cargar vínculos (planta_organos) y procesos ────────────────────────
  const load = useCallback(async () => {
    setLoading(true);

    const { data: vinculoData, error: vinculoError } = await supabase
      .from("planta_organos")
      .select("*")
      .eq("planta_id", plantaId)
      .order("created_at", { ascending: true });

    if (!vinculoError && vinculoData) {
      setVinculos(vinculoData as PlantaOrgano[]);
    }

    const { data: procesoData, error: procesoError } = await supabase
      .from("planta_procesos")
      .select("*")
      .eq("planta_id", plantaId)
      .order("created_at", { ascending: true });

    if (!procesoError && procesoData) {
      setProcesos(procesoData as PlantaProceso[]);
    }

    setLoading(false);
  }, [plantaId]);

  useEffect(() => {
    if (plantaId) void load();
  }, [plantaId, load]);

  // ── Órganos vinculados a esta planta, ya resueltos contra el catálogo ──
  // (si un vínculo apunta a un grupo_compuesto_id que ya no existe en el
  // catálogo, se ignora silenciosamente — huérfano, mismo espíritu que
  // "huerfanos" en ResultadoBalanceProceso).
  const organos = useMemo<PlantaOrganoResuelto[]>(() => {
    const porId = new Map(catalogoOrganos.map((g) => [g.id, g]));
    return vinculos
      .map((v) => {
        const grupo = porId.get(v.grupo_compuesto_id);
        if (!grupo) return null;
        return { ...grupo, vinculo_id: v.id };
      })
      .filter((o): o is PlantaOrganoResuelto => o !== null);
  }, [vinculos, catalogoOrganos]);

  // ── Crear un GrupoCompuesto nuevo (tipo="organo") + vincularlo a esta
  // planta ──────────────────────────────────────────────────────────────
  const crearYVincularOrgano = useCallback(
    async (nombre: string = "") => {
      const { data: nuevoGrupo, error: errorGrupo } = await supabase
        .from("grupos_compuestos")
        .insert([{ nombre, componentes: [], tipo: "organo" }])
        .select()
        .single();
      if (errorGrupo || !nuevoGrupo) return null;

      const { data: vinculo, error: errorVinculo } = await supabase
        .from("planta_organos")
        .insert([{ planta_id: plantaId, grupo_compuesto_id: (nuevoGrupo as GrupoCompuesto).id }])
        .select()
        .single();
      if (errorVinculo || !vinculo) {
        // Rollback best-effort: el grupo quedó huérfano en el catálogo,
        // se deja (no rompe nada, solo queda sin usar todavía) en vez de
        // complejizar con una transacción real.
        return null;
      }

      setVinculos((prev) => [...prev, vinculo as PlantaOrgano]);
      return { ...(nuevoGrupo as GrupoCompuesto), vinculo_id: (vinculo as PlantaOrgano).id };
    },
    [plantaId],
  );

  // ── Vincular un GrupoCompuesto ya existente del catálogo a esta planta ─
  const vincularOrganoExistente = useCallback(
    async (grupoCompuestoId: string) => {
      // Evita duplicar el vínculo si ya está vinculado.
      if (vinculos.some((v) => v.grupo_compuesto_id === grupoCompuestoId)) return null;

      const { data: vinculo, error } = await supabase
        .from("planta_organos")
        .insert([{ planta_id: plantaId, grupo_compuesto_id: grupoCompuestoId }])
        .select()
        .single();
      if (error || !vinculo) return null;

      setVinculos((prev) => [...prev, vinculo as PlantaOrgano]);
      return vinculo as PlantaOrgano;
    },
    [plantaId, vinculos],
  );

  // ── Actualizar el GrupoCompuesto en el catálogo (afecta a todas las
  // plantas que lo tengan vinculado) ──────────────────────────────────────
  const actualizarOrgano = useCallback(
    async (grupoCompuestoId: string, updates: Partial<GrupoCompuesto>) => {
      const { error } = await supabase
        .from("grupos_compuestos")
        .update(updates)
        .eq("id", grupoCompuestoId);
      if (error) {
        console.error("[usePlantaOrganosProcesos] error actualizando organo:", error);
      }
    },
    [],
  );

  // ── Desvincular (borra solo la fila puente, el GrupoCompuesto sigue en
  // el catálogo para otras plantas) ────────────────────────────────────────
  const desvincularOrgano = useCallback(async (vinculoId: string) => {
    setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
    await supabase.from("planta_organos").delete().eq("id", vinculoId);
  }, []);

  // ── CRUD de procesos (sin cambios) ─────────────────────────────────────
  const crearProceso = useCallback(
    async (nombre: string = "") => {
      const { data, error } = await supabase
        .from("planta_procesos")
        .insert([
          {
            planta_id: plantaId,
            nombre,
            consume: null,
            produce: null,
            descripcion: null,
          },
        ])
        .select()
        .single();

      if (error || !data) return null;
      setProcesos((prev) => [...prev, data as PlantaProceso]);
      return data as PlantaProceso;
    },
    [plantaId],
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

  return {
    organos,
    procesos,
    loading,
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
    load,
  };
}
