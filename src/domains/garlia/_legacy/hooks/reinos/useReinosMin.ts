"use client";

/**
 * useReinosMin.ts
 * ────────────────
 * Lista de reinos mínimos (id, nombre).
 * Dexie primero → Supabase en background.
 *
 * Ruta: src/features/editorGarlia/hooks/useReinosMin.ts
 */

import { useEffect, useState } from "react";

import { isReallyOnline } from "@/hooks/data/useOfflineSync";
import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";

// ─── Tipo ─────────────────────────────────────────────────────────────────────

export type ReinoMin = { id: string; nombre: string };

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useReinosMin(): ReinoMin[] {
  const [reinos, setReinos] = useState<ReinoMin[]>([]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      // ── 1. Dexie primero ──────────────────────────────────────────────────
      try {
        if (db?.reinos) {
          const local: any[] = await db.reinos.toArray();
          const mapped = local
            .filter((r: any) => !r.deleted)
            .map((r: any) => ({ id: r.id, nombre: r.nombre }));
          if (mapped.length && mounted) setReinos(mapped);
        }
      } catch {}

      // ── 2. Supabase en background ─────────────────────────────────────────
      try {
        const online = await isReallyOnline();
        if (!online || !mounted) return;
        const { data } = await supabase
          .from("reinos")
          .select("id, nombre")
          .order("nombre");
        if (data && mounted) setReinos(data);
      } catch {}
    };

    void run();
    return () => {
      mounted = false;
    };
  }, []);

  return reinos;
}
