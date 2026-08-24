"use client";

/**
 * useEntidadVinculoReaccion.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Vínculo 1:1 entre una entidad (PlantaProceso, MineralProceso, o el propio
 * Item vía item_habilidades) y un Proceso/Reacción de la tabla real
 * "reacciones" (catálogo separado de "grupos_compuestos" — Procesos y
 * Habilidades siguen siendo EL MISMO catálogo entre sí, solo aislado del
 * resto de Química), vía columna `reaccion_id` directa — sin tabla puente.
 *
 * La Reacción vinculada ES la reacción real del catálogo — no hay copia.
 * Editarla acá (o desde Química) actualiza todo lo que la use.
 *
 * Uso:
 *   const vinculo = useEntidadVinculoReaccion({
 *     tabla: "planta_reacciones",
 *     entidadId: proceso.id,
 *     reaccionIdActual: proceso.reaccion_id,
 *     catalogo: reacciones,
 *     onReaccionIdCambiado: (id) => onUpdate(proceso.id, { reaccion_id: id }),
 *   });
 */

import { useCallback, useMemo } from "react";
import { supabase } from "@/infra/supabase/supabase";
import { persistirReaccion } from "@/domains/garlia/elementos/persistirReaccion";
import type { Reaccion } from "@/domains/garlia/elementos/types";

export function useEntidadVinculoReaccion({
  tabla,
  entidadId,
  reaccionIdActual,
  catalogo,
  onReaccionIdCambiado,
}: {
  /** Tabla de la entidad dueña del vínculo, ej. "planta_reacciones". */
  tabla: string;
  entidadId: string;
  reaccionIdActual: string | null;
  /** Catálogo de Reacciones (cargado por el padre vía useReacciones). */
  catalogo: Reaccion[];
  /** Se llama cuando cambia reaccion_id en la entidad (crear/usar/quitar),
   *  para que el padre actualice su estado local (optimista). */
  onReaccionIdCambiado: (reaccionId: string | null) => void;
}) {
  const reaccion = useMemo(
    () => catalogo.find((r) => r.id === reaccionIdActual) ?? null,
    [catalogo, reaccionIdActual],
  );

  const persistirReaccionId = useCallback(
    async (reaccionId: string | null) => {
      onReaccionIdCambiado(reaccionId);
      const { error } = await supabase
        .from(tabla)
        .update({ reaccion_id: reaccionId })
        .eq("id", entidadId);
      if (error) {
        console.error(`[useEntidadVinculoReaccion] error actualizando ${tabla}:`, error);
      }
    },
    [tabla, entidadId, onReaccionIdCambiado],
  );

  // ── Crear un Proceso/Reacción nuevo en el catálogo + vincularlo ────────
  const crearYVincular = useCallback(async () => {
    const { data: nuevaReaccion, error } = await supabase
      .from("reacciones")
      .insert([{ nombre: "", descripcion: null }])
      .select()
      .single();
    if (error || !nuevaReaccion) return null;

    await persistirReaccionId((nuevaReaccion as Reaccion).id);
    return { ...(nuevaReaccion as Reaccion), consume: [], produce: [] };
  }, [persistirReaccionId]);

  // ── Vincular una Reacción ya existente del catálogo (reemplaza la actual) ─
  const vincularExistente = useCallback(
    async (reaccionId: string) => {
      await persistirReaccionId(reaccionId);
    },
    [persistirReaccionId],
  );

  // ── Actualizar la Reacción vinculada en el catálogo (afecta a todo lo
  // que la tenga vinculada) ────────────────────────────────────────────────
  const actualizar = useCallback(async (updates: Partial<Reaccion>) => {
    if (!reaccionIdActual) return;
    const { error } = await persistirReaccion(reaccionIdActual, updates);
    if (error) {
      console.error("[useEntidadVinculoReaccion] error actualizando reacción:", error);
    }
  }, [reaccionIdActual]);

  // ── Desvincular (solo pone reaccion_id en null, la Reacción sigue en el
  // catálogo para otros usos) ──────────────────────────────────────────────
  const desvincular = useCallback(async () => {
    await persistirReaccionId(null);
  }, [persistirReaccionId]);

  return {
    reaccion,
    crearYVincular,
    vincularExistente,
    actualizar,
    desvincular,
  };
}
