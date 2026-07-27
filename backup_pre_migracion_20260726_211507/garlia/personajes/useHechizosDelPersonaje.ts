"use client";

/**
 * useHechizosDelPersonaje.ts
 * ───────────────────────────
 * Hechizos disponibles (filtrados por grupos de la especie) y los
 * ya seleccionados para el personaje. Expone `toggle` para añadir/quitar.
 *
 * Ruta: src/features/editorGarlia/hooks/useHechizosDelPersonaje.ts
 */

import { useCallback, useEffect, useState } from "react";

import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";

// ─── Tipo ─────────────────────────────────────────────────────────────────────

export type HechizMin = { id: string; nombre: string; imagen_url?: string | null };

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useHechizosDelPersonaje(
  personajeId: string,
  grupoIds: string[],
) {
  const [disponibles, setDisponibles] = useState<HechizMin[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const grupoKey = grupoIds.join(",");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // ── 1. Hechizos disponibles (Dexie → Supabase) ──────────────────────
      let hechizosData: HechizMin[] = [];
      try {
        if (db) {
          const todos: any[] = (await (db as any).hechizos?.toArray()) ?? [];
          hechizosData = todos
            .filter((h: any) => {
              if (!grupoIds.length) return true;
              return (h.grupo_ids ?? []).some((gid: string) =>
                grupoIds.includes(gid),
              );
            })
            .map((h: any) => ({
              id: h.id,
              nombre: h.nombre,
              imagen_url: null,
            }));
        }
      } catch {}

      if (!hechizosData.length && navigator.onLine) {
        let query = supabase
          .from("hechizos")
          .select("id, nombre")
          .order("nombre");
        if (grupoIds.length) {
          query = (query as any).overlaps("grupo_ids", grupoIds);
        }
        const { data } = await query;
        hechizosData = (data ?? []).map((h: any) => ({
          id: h.id,
          nombre: h.nombre,
          imagen_url: null,
        }));
      }
      setDisponibles(hechizosData);

      // ── 2. Hechizos seleccionados (Dexie → Supabase) ────────────────────
      let selIds: string[] = [];
      try {
        if (db) {
          const local: any[] =
            (await (db as any).personaje_hechizos
              ?.where("personaje_id")
              .equals(personajeId)
              .toArray()) ?? [];
          selIds = local.map((r: any) => r.hechizo_id);
        }
      } catch {}

      if (!selIds.length && navigator.onLine) {
        const { data } = await supabase
          .from("personaje_hechizos")
          .select("hechizo_id")
          .eq("personaje_id", personajeId);
        selIds = (data ?? []).map((r: any) => r.hechizo_id);
      }
      setSelectedIds(selIds);
    } catch {}
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personajeId, grupoKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(
    async (hechizId: string, add: boolean) => {
      setSelectedIds((prev) =>
        add ? [...prev, hechizId] : prev.filter((id) => id !== hechizId),
      );
      setSaving(true);
      try {
        if (add) {
          await supabase
            .from("personaje_hechizos")
            .insert({ personaje_id: personajeId, hechizo_id: hechizId });
          try {
            if (db)
              await (db as any).personaje_hechizos?.put({
                id: `${personajeId}_${hechizId}`,
                personaje_id: personajeId,
                hechizo_id: hechizId,
              });
          } catch {}
        } else {
          await supabase
            .from("personaje_hechizos")
            .delete()
            .eq("personaje_id", personajeId)
            .eq("hechizo_id", hechizId);
          try {
            if (db)
              await (db as any).personaje_hechizos?.delete(
                `${personajeId}_${hechizId}`,
              );
          } catch {}
        }
      } catch {
        // Revertir si falla
        setSelectedIds((prev) =>
          add ? prev.filter((id) => id !== hechizId) : [...prev, hechizId],
        );
      }
      setSaving(false);
    },
    [personajeId],
  );

  return { disponibles, selectedIds, loading, saving, toggle };
}
