"use client";

/**
 * useItemHabilidadesReaccion.ts (plural — N:N)
 * ───────────────────────────────────────────────────────────────────────────
 * Vínculo N:N entre un Item y varias Habilidades (tabla real "reacciones"
 * — catálogo separado de "grupos_compuestos", compartido con Procesos de
 * Flora/Minerales) vía la tabla puente `item_habilidades` (item_id,
 * reaccion_id) — un item puede tener múltiples filas (múltiples
 * habilidades), igual que Formaciones vía useEntidadVinculosGrupo. Misma
 * interfaz de salida que useEntidadVinculosGrupo (items/loading/
 * crearYVincular/vincularExistente/actualizar/desvincular) para poder
 * reutilizar SeccionReaccionesVinculadas sin duplicar lógica.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import type { Reaccion } from "@/domains/garlia/elementos/types";
import { persistirReaccion } from "@/domains/garlia/elementos/persistirReaccion";

interface VinculoHabilidad {
  id: string;
  item_id: string;
  reaccion_id: string;
  created_at?: string;
}

export interface ReaccionVinculadaHabilidad extends Reaccion {
  /** Id de la fila puente en item_habilidades — necesario para desvincular
   *  sin borrar la reacción del catálogo. */
  vinculo_id: string;
}

export function useItemHabilidadesReaccion({
  itemId,
  catalogo,
}: {
  itemId: string;
  /** Catálogo de Reacciones (cargado por el padre vía useReacciones). */
  catalogo: Reaccion[];
}) {
  const [vinculos, setVinculos] = useState<VinculoHabilidad[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("item_habilidades")
      .select("id, item_id, reaccion_id, created_at")
      .eq("item_id", itemId)
      .order("created_at", { ascending: true });

    if (!error && data) setVinculos(data as VinculoHabilidad[]);
    setLoading(false);
  }, [itemId]);

  useEffect(() => {
    if (itemId) void load();
  }, [itemId, load]);

  // ── Habilidades vinculadas a este item, ya resueltas contra el catálogo
  // compartido (si un vínculo apunta a una reaccion_id que ya no existe, se
  // ignora silenciosamente — huérfano, mismo espíritu que Estructura). ─────
  const items = useMemo<ReaccionVinculadaHabilidad[]>(() => {
    const porId = new Map(catalogo.map((r) => [r.id, r]));
    return vinculos
      .map((v) => {
        const reaccion = porId.get(v.reaccion_id);
        if (!reaccion) return null;
        return { ...reaccion, vinculo_id: v.id };
      })
      .filter((r): r is ReaccionVinculadaHabilidad => r !== null);
  }, [vinculos, catalogo]);

  // ── Crear una Habilidad nueva en el catálogo + vincularla ──────────────
  const crearYVincular = useCallback(async () => {
    const { data: nuevaReaccion, error: errorReaccion } = await supabase
      .from("reacciones")
      .insert([{ nombre: "", descripcion: null }])
      .select()
      .single();
    if (errorReaccion || !nuevaReaccion) return null;

    const { data: vinculo, error: errorVinculo } = await supabase
      .from("item_habilidades")
      .insert([{ item_id: itemId, reaccion_id: (nuevaReaccion as Reaccion).id }])
      .select()
      .single();
    if (errorVinculo || !vinculo) {
      // Rollback best-effort: la reacción queda huérfana en el catálogo,
      // sin romper nada — mismo trade-off que useEntidadVinculosGrupo.
      return null;
    }

    setVinculos((prev) => [...prev, vinculo as VinculoHabilidad]);
    return { ...(nuevaReaccion as Reaccion), consume: [], produce: [], vinculo_id: (vinculo as VinculoHabilidad).id };
  }, [itemId]);

  // ── Vincular una Reacción ya existente del catálogo ────────────────────
  const vincularExistente = useCallback(
    async (reaccionId: string) => {
      if (vinculos.some((v) => v.reaccion_id === reaccionId)) return null;

      const { data: vinculo, error } = await supabase
        .from("item_habilidades")
        .insert([{ item_id: itemId, reaccion_id: reaccionId }])
        .select()
        .single();
      if (error || !vinculo) return null;

      setVinculos((prev) => [...prev, vinculo as VinculoHabilidad]);
      return vinculo as VinculoHabilidad;
    },
    [itemId, vinculos],
  );

  // ── Actualizar la Reacción vinculada en el catálogo (afecta a todo lo
  // que la use) ────────────────────────────────────────────────────────────
  const actualizar = useCallback(async (reaccionId: string, updates: Partial<Reaccion>) => {
    const { error } = await persistirReaccion(reaccionId, updates);
    if (error) {
      console.error("[useItemHabilidadesReaccion] error actualizando reacción:", error);
    }
  }, []);

  // ── Desvincular (borra solo la fila puente, la Reacción sigue en el
  // catálogo para otros usos) ─────────────────────────────────────────────
  const desvincular = useCallback(async (vinculoId: string) => {
    setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
    await supabase.from("item_habilidades").delete().eq("id", vinculoId);
  }, []);

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
