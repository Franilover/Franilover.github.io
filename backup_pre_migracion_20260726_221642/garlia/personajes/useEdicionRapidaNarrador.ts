"use client";

/**
 * useEdicionRapidaNarrador.ts
 * ─────────────────────────────
 * Permite editar `sobre` (descripción) y `caracteristicas` de un personaje
 * directamente desde el panel lateral del editor de capítulos, sin navegar
 * a su ficha completa. Pensado para el bloque "Narrador" del panel.
 *
 * Carga bajo demanda: el contexto EntidadesLoreContext solo trae
 * {id, nombre} de cada personaje (liviano, se usa en selectores en toda la
 * app), así que estos dos campos se piden por separado, solo para el
 * narrador activo, cuando el bloque se abre.
 *
 * Guardado: debounced (el usuario tipea en un textarea), Supabase + Dexie,
 * mismo patrón que el resto del proyecto — Supabase es la fuente de
 * verdad acá porque es edición explícita de un campo de personaje, no
 * contenido offline-first como el capítulo.
 *
 * Ruta: src/features/editorGarlia/hooks/personajes/useEdicionRapidaNarrador.ts
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";

export type SaveState = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 900;

export function useEdicionRapidaNarrador(personajeId: string | null) {
  const [sobre, setSobreState] = useState("");
  const [caracteristicas, setCaracteristicasState] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<SaveState>("idle");

  // Guarda el id que originó la carga más reciente, para descartar
  // respuestas tardías si el usuario cambia de narrador rápido.
  const loadedForRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    loadedForRef.current = null;
    setSobreState("");
    setCaracteristicasState("");
    setStatus("idle");
    if (!personajeId) return;

    let cancelled = false;
    setLoading(true);
    void (async () => {
      // Dexie primero (instantáneo si ya está cacheado por otra pantalla).
      try {
        const local = await (db as any)?.personajes?.get(personajeId);
        if (local && !cancelled) {
          setSobreState(local.sobre ?? "");
          setCaracteristicasState(local.caracteristicas ?? "");
        }
      } catch {}

      try {
        const { data, error } = await supabase
          .from("personajes")
          .select("sobre, caracteristicas")
          .eq("id", personajeId)
          .single();
        if (error) throw error;
        if (!cancelled && data) {
          setSobreState(data.sobre ?? "");
          setCaracteristicasState(data.caracteristicas ?? "");
        }
      } catch {
        // Sin conexión o error: se queda con lo que Dexie haya dado (o
        // vacío) — no bloqueamos la edición, el guardado ya avisa si falla.
      } finally {
        if (!cancelled) {
          loadedForRef.current = personajeId;
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(debounceRef.current);
    };
  }, [personajeId]);

  const guardar = useCallback(
    async (campos: { sobre?: string; caracteristicas?: string }) => {
      if (!personajeId) return;
      setStatus("saving");
      try {
        const { error } = await supabase
          .from("personajes")
          .update(campos)
          .eq("id", personajeId);
        if (error) throw error;
        try {
          const existing = await (db as any)?.personajes?.get(personajeId);
          if (existing) {
            await (db as any)?.personajes?.put({ ...existing, ...campos });
          }
        } catch {}
        setStatus("saved");
        setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500);
      } catch {
        setStatus("error");
      }
    },
    [personajeId],
  );

  // Setters "optimistas": actualizan el textarea al instante y programan el
  // guardado debounced, para no pegarle a Supabase en cada tecla.
  const setSobre = useCallback(
    (v: string) => {
      setSobreState(v);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void guardar({ sobre: v });
      }, DEBOUNCE_MS);
    },
    [guardar],
  );

  const setCaracteristicas = useCallback(
    (v: string) => {
      setCaracteristicasState(v);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void guardar({ caracteristicas: v });
      }, DEBOUNCE_MS);
    },
    [guardar],
  );

  return {
    sobre,
    caracteristicas,
    setSobre,
    setCaracteristicas,
    loading,
    status,
  };
}
