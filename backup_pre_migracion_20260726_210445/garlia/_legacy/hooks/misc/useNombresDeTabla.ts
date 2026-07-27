/**
 * useNombresDeTabla.ts
 * ──────────────────────
 * Lee la columna `nombre` de una tabla entera. Cachea en Dexie si la tabla
 * está disponible, y en session_cache si no.
 *
 * Extraído de `hooks/hooks.ts` (archivo cajón-de-sastre con 11 hooks
 * mezclados) al partirlo por dominio.
 *
 * Ruta: src/features/editorGarlia/hooks/misc/useNombresDeTabla.ts
 */

import { useState, useEffect } from "react";

import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";
import { dexieReadAll as dexieRead } from "@/lib/utils/dexieHelpers";

import { SESSION_CACHE_TTL_MS } from "../sessionCache";

export function useNombresDeTabla(tabla: string) {
  const [nombres, setNombres] = useState<string[]>([]);
  const cacheKey = `nombres:${tabla}`;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // 1. Intentar leer de la tabla Dexie directa (si existe)
      const local = await dexieRead<{ nombre: string }>(tabla);
      if (local.length > 0 && !cancelled) {
        setNombres(
          [...new Set(local.map((r) => r.nombre).filter(Boolean))].sort(),
        );
        if (!navigator.onLine) return;
      }

      // 2. Fallback: session_cache
      if (local.length === 0) {
        try {
          if (db) {
            const cached = await (db as any).session_cache?.get(cacheKey);
            if (
              cached &&
              Date.now() - cached.updated_at < SESSION_CACHE_TTL_MS
            ) {
              if (!cancelled) setNombres(cached.value as string[]);
              if (!navigator.onLine) return;
            }
          }
        } catch {}
      }

      if (!navigator.onLine) return;

      // 3. Fetch remoto
      try {
        const { data } = await supabase
          .from(tabla)
          .select("nombre")
          .not("nombre", "is", null)
          .order("nombre");
        if (!data || cancelled) return;
        const result = data.map((r: any) => r.nombre as string).filter(Boolean);
        setNombres(result);
        // Persistir en Dexie si la tabla existe
        if (db && (db as any)[tabla]) {
          // Ya lo habrá guardado useEntidades; no duplicar
        } else {
          // Guardar en session_cache como fallback
          try {
            if (db) {
              await (db as any).session_cache?.put({
                key: cacheKey,
                value: result,
                updated_at: Date.now(),
              });
            }
          } catch {}
        }
      } catch {}
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [tabla, cacheKey]);

  return nombres;
}
