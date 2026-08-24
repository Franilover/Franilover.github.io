"use client";

/**
 * useItemHabilidadReaccion.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Vínculo 1:1 entre un Item y una Reacción del catálogo global de Química,
 * vía la tabla puente `item_habilidades` (item_id, reaccion_id) — a
 * diferencia de PlantaProceso/MineralProceso, acá el reaccion_id NO vive en
 * la tabla `items` sino en esta tabla satélite (una sola fila por item).
 * Misma interfaz de salida que useEntidadVinculoReaccion para poder
 * reutilizar SeccionReaccionVinculada sin cambios.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import type { Reaccion } from "@/domains/garlia/elementos/types";

export function useItemHabilidadReaccion({
  itemId,
  catalogo,
  onReaccionIdCambiado,
}: {
  itemId: string;
  /** Catálogo de Reacciones (cargado por el padre vía useReacciones). */
  catalogo: Reaccion[];
  /** Se llama cuando cambia el reaccion_id vinculado, para que el padre
   *  actualice su estado local si lo necesita (opcional). */
  onReaccionIdCambiado?: (reaccionId: string | null) => void;
}) {
  const [vinculoId, setVinculoId] = useState<string | null>(null);
  const [reaccionId, setReaccionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    supabase
      .from("item_habilidades")
      .select("id, reaccion_id")
      .eq("item_id", itemId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelado) return;
        setVinculoId((data as { id: string } | null)?.id ?? null);
        setReaccionId((data as { reaccion_id: string } | null)?.reaccion_id ?? null);
        setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [itemId]);

  const reaccion = useMemo(
    () => catalogo.find((r) => r.id === reaccionId) ?? null,
    [catalogo, reaccionId],
  );

  const persistirReaccionId = useCallback(
    async (nuevoReaccionId: string | null) => {
      setReaccionId(nuevoReaccionId);
      onReaccionIdCambiado?.(nuevoReaccionId);

      if (nuevoReaccionId === null) {
        if (vinculoId) {
          await supabase.from("item_habilidades").delete().eq("id", vinculoId);
          setVinculoId(null);
        }
        return;
      }

      if (vinculoId) {
        await supabase.from("item_habilidades").update({ reaccion_id: nuevoReaccionId }).eq("id", vinculoId);
      } else {
        const { data } = await supabase
          .from("item_habilidades")
          .insert([{ item_id: itemId, reaccion_id: nuevoReaccionId }])
          .select("id")
          .single();
        if (data) setVinculoId((data as { id: string }).id);
      }
    },
    [itemId, vinculoId, onReaccionIdCambiado],
  );

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

  const vincularExistente = useCallback(
    async (id: string) => {
      await persistirReaccionId(id);
    },
    [persistirReaccionId],
  );

  const actualizar = useCallback(
    async (updates: Partial<Reaccion>) => {
      if (!reaccionId) return;
      const { error } = await persistirReaccion(reaccionId, updates);
      if (error) {
        console.error("[useItemHabilidadReaccion] error actualizando reacción:", error);
      }
    },
    [reaccionId],
  );

  const desvincular = useCallback(async () => {
    await persistirReaccionId(null);
  }, [persistirReaccionId]);

  return {
    reaccion,
    loading,
    crearYVincular,
    vincularExistente,
    actualizar,
    desvincular,
  };
}
