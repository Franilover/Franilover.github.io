"use client";

/**
 * useEntidadVinculosReaccion.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Generaliza el patrón de useEntidadVinculosGrupo pero contra el catálogo
 * de Reacciones (reacciones: nombre + consume[] + produce[] + descripción)
 * en vez de GrupoCompuesto. Pensado para:
 *   - Procesos de Flora/Minerales: N:N, un Proceso (etapa del ciclo de vida,
 *     ej. "Floración") puede vincular varias Reacciones.
 *   - Habilidades de Items: N:N también, aunque hoy se use como 1 vínculo.
 *
 * Una Reacción vinculada ES la reacción real del catálogo — no hay copia.
 * Editarla en Química (o desde acá, que persiste directo en `reacciones`)
 * actualiza todos los Procesos/Habilidades que la usen.
 *
 * Uso:
 *   const reaccionesVinculadas = useEntidadVinculosReaccion({
 *     entidadId: proceso.id,
 *     tablaPuente: "planta_proceso_reacciones",
 *     columnaFk: "planta_proceso_id",
 *     catalogo: reacciones, // useReacciones() cargado por el padre
 *   });
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import type { Reaccion } from "@/domains/garlia/elementos/types";

/** Fila cruda de una tabla puente {id, [columnaFk]: string, reaccion_id, created_at}. */
interface VinculoReaccion {
  id: string;
  reaccion_id: string;
  created_at: string;
  [key: string]: unknown;
}

export interface ReaccionVinculadaResuelta extends Reaccion {
  /** Id de la fila puente — necesario para desvincular sin borrar la reacción del catálogo. */
  vinculo_id: string;
}

export function useEntidadVinculosReaccion({
  entidadId,
  tablaPuente,
  columnaFk,
  catalogo,
}: {
  /** Id de la entidad padre (planta_proceso, mineral_proceso, item…). */
  entidadId: string;
  /** Nombre de la tabla puente en Supabase, ej. "planta_proceso_reacciones". */
  tablaPuente: string;
  /** Columna FK de la tabla puente que apunta a la entidad padre. */
  columnaFk: string;
  /** Catálogo de Reacciones (cargado por el padre vía useReacciones). */
  catalogo: Reaccion[];
}) {
  const [vinculos, setVinculos] = useState<VinculoReaccion[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(tablaPuente)
      .select("*")
      .eq(columnaFk, entidadId)
      .order("created_at", { ascending: true });

    if (!error && data) setVinculos(data as VinculoReaccion[]);
    setLoading(false);
  }, [tablaPuente, columnaFk, entidadId]);

  useEffect(() => {
    if (entidadId) void load();
  }, [entidadId, load]);

  // ── Reacciones vinculadas a esta entidad, ya resueltas contra el
  // catálogo compartido (si un vínculo apunta a un reaccion_id que ya no
  // existe, se ignora silenciosamente — huérfano, mismo espíritu que Flora). ─
  const items = useMemo<ReaccionVinculadaResuelta[]>(() => {
    const porId = new Map(catalogo.map((r) => [r.id, r]));
    return vinculos
      .map((v) => {
        const reaccion = porId.get(v.reaccion_id);
        if (!reaccion) return null;
        return { ...reaccion, vinculo_id: v.id };
      })
      .filter((r): r is ReaccionVinculadaResuelta => r !== null);
  }, [vinculos, catalogo]);

  // ── Crear una Reacción nueva en el catálogo global + vincularla ────────
  const crearYVincular = useCallback(
    async (nombre: string = "") => {
      const { data: nuevaReaccion, error: errorReaccion } = await supabase
        .from("reacciones")
        .insert([{ nombre, consume: [], produce: [], descripcion: null }])
        .select()
        .single();
      if (errorReaccion || !nuevaReaccion) return null;

      const { data: vinculo, error: errorVinculo } = await supabase
        .from(tablaPuente)
        .insert([{ [columnaFk]: entidadId, reaccion_id: (nuevaReaccion as Reaccion).id }])
        .select()
        .single();
      if (errorVinculo || !vinculo) {
        // Rollback best-effort: la reacción queda huérfana en el catálogo,
        // sin romper nada — mismo trade-off que useEntidadVinculosGrupo.
        return null;
      }

      setVinculos((prev) => [...prev, vinculo as VinculoReaccion]);
      return { ...(nuevaReaccion as Reaccion), vinculo_id: (vinculo as VinculoReaccion).id };
    },
    [tablaPuente, columnaFk, entidadId],
  );

  // ── Vincular una Reacción ya existente del catálogo ─────────────────────
  const vincularExistente = useCallback(
    async (reaccionId: string) => {
      if (vinculos.some((v) => v.reaccion_id === reaccionId)) return null;

      const { data: vinculo, error } = await supabase
        .from(tablaPuente)
        .insert([{ [columnaFk]: entidadId, reaccion_id: reaccionId }])
        .select()
        .single();
      if (error || !vinculo) return null;

      setVinculos((prev) => [...prev, vinculo as VinculoReaccion]);
      return vinculo as VinculoReaccion;
    },
    [tablaPuente, columnaFk, entidadId, vinculos],
  );

  // ── Actualizar la Reacción en el catálogo (afecta a todo lo que la
  // tenga vinculada) ───────────────────────────────────────────────────────
  const actualizar = useCallback(async (reaccionId: string, updates: Partial<Reaccion>) => {
    const { error } = await supabase.from("reacciones").update(updates).eq("id", reaccionId);
    if (error) {
      console.error("[useEntidadVinculosReaccion] error actualizando reacción:", error);
    }
  }, []);

  // ── Desvincular (borra solo la fila puente, la Reacción sigue en el
  // catálogo para otros usos) ──────────────────────────────────────────────
  const desvincular = useCallback(
    async (vinculoId: string) => {
      setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
      await supabase.from(tablaPuente).delete().eq("id", vinculoId);
    },
    [tablaPuente],
  );

  return {
    items,
    loading,
    crearYVincular,
    vincularExistente,
    actualizar,
    desvincular,
    load,
  };
}
