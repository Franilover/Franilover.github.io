/**
 * useMundoSecciones.ts
 * ──────────────────────
 * Textos largos de las secciones generales del mundo (magia, geografía,
 * historia) — usado en la vista general del editor de mundo.
 *
 * Extraído de `hooks/hooks.ts` (archivo cajón-de-sastre con 11 hooks
 * mezclados) al partirlo por dominio.
 *
 * Ruta: src/features/editorGarlia/hooks/mundo/useMundoSecciones.ts
 */

import { useState, useEffect } from "react";

import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";

import { SESSION_CACHE_TTL_MS } from "../sessionCache";
import { type MundoSectionKey } from "../types";

export function useMundoSecciones() {
  const [textos, setTextos] = useState<Record<MundoSectionKey, string>>({
    magia: "",
    geografia: "",
    historia: "",
  });
  const [loading, setLoading] = useState(true);
  const cacheKey = "mundo_secciones";

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Cache
      try {
        if (db) {
          const cached = await (db as any).session_cache?.get(cacheKey);
          if (cached && Date.now() - cached.updated_at < SESSION_CACHE_TTL_MS) {
            if (!cancelled) {
              setTextos(cached.value);
              setLoading(false);
            }
            if (!navigator.onLine) return;
          }
        }
      } catch {}

      if (!navigator.onLine) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("mundo_secciones")
        .select("key, contenido");
      if (!data || cancelled) return;

      const result = { magia: "", geografia: "", historia: "" } as Record<
        MundoSectionKey,
        string
      >;
      data.forEach((r: any) => {
        result[r.key as MundoSectionKey] = r.contenido ?? "";
      });
      setTextos(result);
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
  }, []);

  const save = async (section: MundoSectionKey, value: string) => {
    await supabase
      .from("mundo_secciones")
      .update({ contenido: value, updated_at: new Date().toISOString() })
      .eq("key", section);

    // Invalidar caché tras guardar
    try {
      if (db) {
        const cached = await (db as any).session_cache?.get(cacheKey);
        if (cached) {
          await (db as any).session_cache?.put({
            key: cacheKey,
            value: { ...cached.value, [section]: value },
            updated_at: Date.now(),
          });
        }
      }
    } catch {}
  };

  return { textos, setTextos, loading, save };
}
