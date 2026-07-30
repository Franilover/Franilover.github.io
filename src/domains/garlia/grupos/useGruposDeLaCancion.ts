"use client";

/**
 * useGruposDeLaCancion.ts
 * ─────────────────────────
 * Grupos del mundo (tipo "canciones") a los que pertenece una canción.
 * Dexie primero → Supabase en background.
 *
 * Análogo a useGruposDelPersonaje.ts pero para el tipo "canciones".
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";

// ─── Tipo ─────────────────────────────────────────────────────────────────────

export type GrupoMin = { id: string; nombre: string; tipo: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readGruposFromDexie(): Promise<any[]> {
  try {
    if (!db?.grupos_mundo) return [];
    const rows = await db.grupos_mundo
      .where("tipo")
      .equals("canciones")
      .toArray();
    return rows.filter((r: any) => !r.deleted);
  } catch {
    return [];
  }
}

async function writeGruposToDexie(rows: any[]): Promise<void> {
  try {
    if (!db?.grupos_mundo || rows.length === 0) return;
    const local: any[] = await db.grupos_mundo.toArray();
    const pendingIds = new Set(
      local.filter((r: any) => r.status === "pending").map((r: any) => r.id),
    );
    const toWrite = rows
      .filter((r: any) => !pendingIds.has(r.id))
      .map((r: any) => ({ ...r, status: "synced" }));
    if (toWrite.length > 0) await db.grupos_mundo.bulkPut(toWrite);
  } catch (e) {
    console.warn("[useGruposDeLaCancion] No se pudo guardar en Dexie:", e);
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGruposDeLaCancion(cancionId: string): {
  grupos: GrupoMin[];
  loading: boolean;
} {
  const [grupos, setGrupos] = useState<GrupoMin[]>([]);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  const filterByCancion = useCallback(
    (rows: any[]): GrupoMin[] =>
      rows
        .filter((g: any) => (g.miembro_ids ?? []).includes(cancionId))
        .map((g: any) => ({ id: g.id, nombre: g.nombre, tipo: g.tipo })),
    [cancionId],
  );

  const load = useCallback(async () => {
    // ── 1. Dexie primero (instantáneo) ──────────────────────────────────────
    const localRows = await readGruposFromDexie();
    if (!isMounted.current) return;

    if (localRows.length > 0) {
      setGrupos(filterByCancion(localRows));
      setLoading(false);
    }

    // ── 2. Supabase en background ────────────────────────────────────────────
    try {
      const { data, error } = await supabase
        .from("grupos_mundo")
        .select("id, nombre, tipo, miembro_ids")
        .eq("tipo", "canciones");

      if (error || !data) throw error ?? new Error("Sin datos");
      if (!isMounted.current) return;

      writeGruposToDexie(data).catch(() => {});
      setGrupos(filterByCancion(data));
    } catch {
      // Si Dexie tenía datos, el usuario ya los ve. Si no, lista vacía.
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [cancionId, filterByCancion]);

  useEffect(() => {
    isMounted.current = true;
    void load();
    return () => {
      isMounted.current = false;
    };
  }, [load]);

  return { grupos, loading };
}
