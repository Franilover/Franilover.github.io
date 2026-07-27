"use client";

/**
 * useCapitulosConPersonaje.ts
 * ────────────────────────────
 * Capítulos en los que aparece un personaje dado.
 * Cache en memoria (TTL 30 s) + Dexie stale-while-revalidate + Supabase.
 *
 * Ruta: src/features/editorGarlia/hooks/useCapitulosConPersonaje.ts
 */

import { useEffect, useState } from "react";

import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";
import { getLibroMap } from "@/lib/utils/criaturaCache";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type CapAparece = {
  id: string;
  orden: number;
  titulo_capitulo: string;
  libro_titulo?: string | null;
  libro_id?: string | null;
};

// ─── Cache en memoria ─────────────────────────────────────────────────────────

const _capsCache = new Map<string, { caps: CapAparece[]; ts: number }>();
const CAPS_TTL_MS = 30_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapCap(c: any, libroMap: Record<string, string>): CapAparece {
  return {
    id: c.id,
    orden: c.orden ?? 0,
    titulo_capitulo: c.titulo_capitulo ?? "Sin título",
    libro_titulo: libroMap[c.libro_id] ?? null,
    libro_id: c.libro_id ?? null,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCapitulosConPersonaje(personajeId: string): {
  caps: CapAparece[];
  loading: boolean;
} {
  const cached = _capsCache.get(personajeId);
  const cacheVigente = cached && Date.now() - cached.ts < CAPS_TTL_MS;

  const [caps, setCaps] = useState<CapAparece[]>(
    cacheVigente ? cached!.caps : [],
  );
  const [loading, setLoading] = useState(!cacheVigente);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const cachedNow = _capsCache.get(personajeId);
      const vigente = cachedNow && Date.now() - cachedNow.ts < CAPS_TTL_MS;

      // ── 1. Dexie stale-while-revalidate ───────────────────────────────────
      if (!vigente) {
        try {
          if (db) {
            const [allCaps, libroMap] = await Promise.all([
              (db as any).capitulos?.toArray() ?? [],
              getLibroMap(),
            ]);
            if (cancelled) return;
            const filtered = (allCaps as any[])
              .filter((c: any) =>
                (c.personajes_ids ?? []).includes(personajeId),
              )
              .sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0))
              .map((c: any) => mapCap(c, libroMap));
            if (filtered.length > 0) setCaps(filtered);
            setLoading(false);
            if (!navigator.onLine) return;
          }
        } catch {
          setLoading(false);
        }
      }

      if (!navigator.onLine) {
        setLoading(false);
        return;
      }

      // ── 2. Supabase en background ──────────────────────────────────────────
      try {
        const { data, error } = await supabase
          .from("capitulos")
          .select(
            "id, orden, titulo_capitulo, libro_id, libros!libro_id(titulo)",
          )
          .contains("personajes_ids", [personajeId])
          .order("orden");
        if (error) throw error;
        if (cancelled) return;
        const fresh = (data ?? []).map((c: any) => ({
          id: c.id,
          orden: c.orden ?? 0,
          titulo_capitulo: c.titulo_capitulo ?? "Sin título",
          libro_titulo:
            (Array.isArray(c.libros)
              ? c.libros[0]?.titulo
              : c.libros?.titulo) ?? null,
          libro_id: c.libro_id ?? null,
        }));
        _capsCache.set(personajeId, { caps: fresh, ts: Date.now() });
        setCaps(fresh);
      } catch {
        // Si falló Supabase, no actualizar el ts: el próximo montaje reintentará.
      }
      setLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [personajeId]);

  return { caps, loading };
}
