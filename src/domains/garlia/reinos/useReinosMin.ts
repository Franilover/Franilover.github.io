"use client";

/**
 * useReinosMin.ts
 * ────────────────
 * Lista de reinos mínimos (id, nombre).
 * Dexie primero → Supabase en background.
 *
 * Migrado desde _legacy/hooks/reinos/useReinosMin.ts a domains/garlia/reinos,
 * siguiendo el patrón ya aplicado a personajes/canciones/criaturas/items.
 * El supabase.from("reinos") suelto que vivía acá pasó a reinosQueries.listMin.
 */

import { useEffect, useState } from "react";

import { isReallyOnline } from "@/infra/sync/useOfflineSync";
import { db } from "@/infra/supabase/db";

import { type ReinoMin } from "./model";
import { reinosQueries } from "./queries";

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
        const data = await reinosQueries.listMin();
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
