import { useEffect, useState } from "react";

import { db } from "@/lib/api/client/db";
import { SESSION_CACHE_TTL_MS } from "@/lib/sessionCache";

import { personajesQueries } from "./queries";
import { type Personaje } from "./model";

export function usePersonajesDelReino(reinoNombre: string | null | undefined) {
  const [personajes, setPersonajes] = useState<Personaje[]>([]);
  const [loading, setLoading] = useState(false);
  const cacheKey = `personajes_reino:${reinoNombre}`;

  useEffect(() => {
    if (!reinoNombre) {
      setPersonajes([]);
      return;
    }
    let cancelled = false;

    const run = async () => {
      setLoading(true);

      // Cache local
      try {
        if (db) {
          const cached = await (db as any).session_cache?.get(cacheKey);
          if (cached && Date.now() - cached.updated_at < SESSION_CACHE_TTL_MS) {
            if (!cancelled) {
              setPersonajes(cached.value);
              setLoading(false);
            }
            if (!navigator.onLine) return;
          }
        }
      } catch {}

      // Intentar desde Dexie directo (personajes ya está en Dexie)
      try {
        if (db) {
          const all = (await (db as any).personajes?.toArray()) as
            | Personaje[]
            | undefined;
          if (all?.length) {
            const q = reinoNombre.toLowerCase();
            const local = all.filter((p) => p.reino?.toLowerCase().includes(q));
            if (local.length && !cancelled) {
              setPersonajes(local);
              setLoading(false);
              if (!navigator.onLine) return;
            }
          }
        }
      } catch {}

      if (!navigator.onLine) {
        setLoading(false);
        return;
      }

      const result = await personajesQueries.getByReinoNombre(reinoNombre);
      if (cancelled) return;
      setPersonajes(result);
      setLoading(false);

      try {
        if (db) {
          await (db as any).session_cache?.put({
            key: cacheKey,
            value: result,
            updated_at: Date.now(),
          });
        }
      } catch {}
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [reinoNombre, cacheKey]);

  return { personajes, setPersonajes, loading };
}
