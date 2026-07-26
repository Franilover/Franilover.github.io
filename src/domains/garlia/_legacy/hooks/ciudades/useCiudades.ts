"use client";

/**
 * useCiudades.ts
 * ───────────────
 * Lista de ciudades mínimas (id, nombre, reino_id).
 * Dexie primero → Supabase en background.
 *
 * Ruta: src/features/editorGarlia/hooks/useCiudades.ts
 */

import { useEffect, useState } from "react";

import { isReallyOnline } from "@/hooks/data/useOfflineSync";
import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";

// ─── Tipo ─────────────────────────────────────────────────────────────────────

export type CiudadMin = { id: string; nombre: string; reino_id: string | null };

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCiudades(): CiudadMin[] {
  const [ciudades, setCiudades] = useState<CiudadMin[]>([]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      // ── 1. Dexie primero ──────────────────────────────────────────────────
      try {
        if (db?.ciudades) {
          const local: any[] = await db.ciudades.toArray();
          const mapped = local
            .filter((l: any) => !l.deleted)
            .map((l: any) => ({
              id: l.id,
              nombre: l.nombre,
              reino_id: l.reino_id ?? null,
            }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
          if (mapped.length && mounted) setCiudades(mapped);
        }
      } catch {}

      // ── 2. Supabase en background ─────────────────────────────────────────
      try {
        const online = await isReallyOnline();
        if (!online || !mounted) return;
        const { data } = await supabase
          .from("ciudades")
          .select("id, nombre, reino_id")
          .order("nombre");
        if (data && mounted)
          setCiudades(
            data.map((l: any) => ({
              id: l.id,
              nombre: l.nombre,
              reino_id: l.reino_id ?? null,
            })),
          );
      } catch {}
    };

    void run();
    return () => {
      mounted = false;
    };
  }, []);

  return ciudades;
}
