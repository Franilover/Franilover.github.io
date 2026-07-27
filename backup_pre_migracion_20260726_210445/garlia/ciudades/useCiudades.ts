"use client";

/**
 * useCiudades.ts
 * ────────────────
 * Lista de ciudades mínimas (id, nombre, reino_id).
 * Dexie primero → Supabase en background.
 *
 * Migrado desde _legacy/hooks/ciudades/useCiudades.ts a domains/garlia/ciudades,
 * siguiendo el patrón ya aplicado a personajes/canciones/criaturas/items/reinos.
 * El supabase.from("ciudades") suelto que vivía acá pasó a ciudadesQueries.listMin.
 */

import { useEffect, useState } from "react";

import { isReallyOnline } from "@/hooks/data/useOfflineSync";
import { db } from "@/lib/api/client/db";

import { type CiudadMin } from "./model";
import { ciudadesQueries } from "./queries";

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
        const data = await ciudadesQueries.listMin();
        if (data && mounted) setCiudades(data);
      } catch {}
    };

    void run();
    return () => {
      mounted = false;
    };
  }, []);

  return ciudades;
}
