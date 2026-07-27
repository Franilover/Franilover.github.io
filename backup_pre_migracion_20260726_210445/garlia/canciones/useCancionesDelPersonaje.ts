"use client";

/**
 * useCancionesDelPersonaje.ts
 * ────────────────────────────
 * Canciones asociadas a un personaje: únicamente por personaje_id, que es
 * el vínculo real (el mismo campo que guarda PanelInfoSidebar al asignar
 * un personaje desde el editor de la canción).
 *
 * Antes esto también hacía match por coincidencia de nombre en el título
 * (`titulo ILIKE %nombre%`), lo que mostraba canciones "fantasma": el
 * personaje las veía listadas como si estuvieran vinculadas, pero al abrir
 * esa canción en su editor el selector de Personaje salía vacío (porque
 * personaje_id era null en realidad) — daba la falsa impresión de que el
 * guardado no funcionaba. Se quitó esa heurística: ahora la lista siempre
 * coincide con lo que se ve y se guarda del lado de la canción.
 *
 * Dexie primero → Supabase en background.
 *
 * Ruta: src/features/editorGarlia/hooks/useCancionesDelPersonaje.ts
 */

import { useCallback, useEffect, useState } from "react";

import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";

// ─── Tipo ─────────────────────────────────────────────────────────────────────

export type CancionMin = {
  id: string;
  titulo: string;
  cantante: string | null;
  portada_url: string | null;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCancionesDelPersonaje(
  personajeId: string,
): { canciones: CancionMin[]; loading: boolean } {
  const [canciones, setCanciones] = useState<CancionMin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    // ── 1. Dexie — índice personaje_id ────────────────────────────────────
    try {
      if (db) {
        const byId: any[] =
          (await (db as any).canciones
            ?.where("personaje_id")
            .equals(personajeId)
            .toArray()) ?? [];

        if (byId.length > 0) {
          setCanciones(
            byId.map((c: any) => ({
              id: c.id,
              titulo: c.titulo ?? "Sin título",
              cantante: c.cantante ?? null,
              portada_url: c.portada_url ?? null,
            })),
          );
          setLoading(false);
          if (!navigator.onLine) return;
        }
      }
    } catch {}

    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    // ── 2. Supabase: fuente de verdad, solo por personaje_id ──────────────
    try {
      const { data } = await supabase
        .from("canciones")
        .select("id, titulo, cantante, portada_url")
        .eq("personaje_id", personajeId)
        .order("titulo");
      setCanciones(
        (data ?? []).map((c: any) => ({
          id: c.id,
          titulo: c.titulo ?? "Sin título",
          cantante: c.cantante ?? null,
          portada_url: c.portada_url ?? null,
        })),
      );
    } catch {}

    setLoading(false);
  }, [personajeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { canciones, loading };
}
