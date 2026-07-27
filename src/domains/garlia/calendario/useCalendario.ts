/**
 * useCalendario.ts
 * ──────────────────
 * Hook de catálogo del calendario del mundo (estaciones, config, eras).
 * Extraído de EditorLineaTiempo.tsx, donde vivía mezclado con la UI —
 * lo usan tanto SelectorFechaMundo/FechaMundoBadge (components/) como
 * PanelHistoriaMundo (views/), así que corresponde a hooks/.
 *
 * Cache en 4 capas por prioridad: memoria del módulo → Dexie → localStorage
 * → Supabase (con TTL de refresh en segundo plano). Lógica copiada literal
 * del original, sin cambios de comportamiento.
 *
 * Ruta destino:
 *   src/features/editorGarlia/hooks/useCalendario.ts
 */

import { useEffect, useState } from "react";

import { supabase } from "@/lib/api/client/supabase";
import type { Estacion, CalendarioConfig, EraMundo } from "@/lib/utils/calendario";

// ─── Hook: cargar calendario — Dexie → memoria → Supabase ────────────────────
// Orden de prioridad:
//   1. Memoria del módulo (_cache)  — 0 ms, persiste durante la sesión SPA
//   2. Dexie (IndexedDB)            — ~2 ms, persiste entre recargas, offline-ready
//   3. localStorage                 — fallback legacy
//   4. Supabase                     — solo si no hay datos locales o TTL expiró
type CalCache = {
  estaciones: Estacion[];
  config: CalendarioConfig;
  eras: EraMundo[];
};
export type { CalCache };
let _cache: CalCache | null = null;

const LS_KEY = "garlia-calendario-cache-v2";
// TTL para el fetch de fondo — no bloquea la UI, solo refresca en silencio
const CAL_REFRESH_TTL = 10 * 60_000; // 10 min
let _lastFetch = 0;

function leerCacheLocal(): CalCache | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CalCache;
  } catch {
    return null;
  }
}

function guardarCacheLocal(data: CalCache) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {}
}

async function leerDexie(): Promise<CalCache | null> {
  try {
    const { db } = await import("@/lib/api/client/db");
    if (!db) return null;
    const [estaciones, configs, eras] = await Promise.all([
      (db as any).calendario_estaciones?.orderBy("orden").toArray() ?? [],
      (db as any).calendario_config?.toArray() ?? [],
      (db as any).eras_mundo?.orderBy("anio_inicio").toArray() ?? [],
    ]);
    if (!estaciones?.length) return null;
    return {
      estaciones: estaciones as Estacion[],
      config: (configs?.[0] ?? {
        dias_por_semana: 5,
        horas_por_dia: 25,
        anio_inicio: 0,
      }) as CalendarioConfig,
      eras: (eras ?? []) as EraMundo[],
    };
  } catch {
    return null;
  }
}

async function guardarDexie(data: CalCache): Promise<void> {
  try {
    const { db } = await import("@/lib/api/client/db");
    if (!db) return;
    await Promise.all([
      (db as any).calendario_estaciones?.bulkPut(data.estaciones),
      (db as any).calendario_config?.put({ id: "singleton", ...data.config }),
      (db as any).eras_mundo?.bulkPut(data.eras),
    ]);
  } catch {}
}

async function fetchSupabase(): Promise<CalCache | null> {
  try {
    const [{ data: est }, { data: cfg }, { data: eras }] = await Promise.all([
      supabase.from("calendario_estaciones").select("*").order("orden"),
      supabase.from("calendario_config").select("*").single(),
      (supabase as any).from("eras_mundo").select("*").order("anio_inicio"),
    ]);
    if (!est?.length) return null;
    return {
      estaciones: est as Estacion[],
      config: (cfg ?? {
        dias_por_semana: 5,
        horas_por_dia: 25,
        anio_inicio: 0,
      }) as CalendarioConfig,
      eras: (eras ?? []) as EraMundo[],
    };
  } catch {
    return null;
  }
}

export function useCalendario() {
  // Arrancar con memoria para evitar cualquier flash de loading
  const [data, setData] = useState<CalCache | null>(_cache);
  const [loading, setLoading] = useState(_cache === null);

  useEffect(() => {
    if (_cache) {
      setData(_cache);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const cargar = async () => {
      // 1. Dexie — rápido, offline-ready, persiste entre recargas
      const dexie = await leerDexie();
      if (dexie) {
        _cache = dexie;
        if (!cancelled) {
          setData(dexie);
          setLoading(false);
        }
      }

      // 2. localStorage como fallback si Dexie está vacío
      if (!_cache) {
        const ls = leerCacheLocal();
        if (ls) {
          _cache = ls;
          if (!cancelled) {
            setData(ls);
            setLoading(false);
          }
        }
      }

      // 3. Sin datos locales → mostrar loading hasta Supabase
      if (!_cache && !cancelled) setLoading(true);

      // 4. Supabase — fetch solo si no hay datos o TTL expiró
      if (!navigator.onLine) {
        if (!cancelled) setLoading(false);
        return;
      }
      const necesitaRefresh =
        !_cache || Date.now() - _lastFetch > CAL_REFRESH_TTL;
      if (!necesitaRefresh) {
        if (!cancelled) setLoading(false);
        return;
      }

      const fresh = await fetchSupabase();
      if (!fresh || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }

      _cache = fresh;
      _lastFetch = Date.now();
      guardarCacheLocal(fresh);
      void guardarDexie(fresh); // fire-and-forget, no bloquea
      if (!cancelled) {
        setData(fresh);
        setLoading(false);
      }
    };

    void cargar();
    return () => {
      cancelled = true;
    };
  }, []);

  return { cal: data, loading };
}

// ─── Invalidar caché del calendario ──────────────────────────────────────────
// Fuerza un refetch real en el próximo useCalendario(). Usada por
// ModalEra/ModalGestionEras en EditorLineaTiempo.tsx tras crear/editar/borrar
// una era, para que aparezca sin esperar a refrescar la página. Vive acá (y
// no en la view) porque necesita tocar las variables privadas del módulo
// (_cache, _lastFetch, LS_KEY) que respaldan el cache en memoria.
export function invalidarCacheEras() {
  _cache = null;
  _lastFetch = 0;
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
}
