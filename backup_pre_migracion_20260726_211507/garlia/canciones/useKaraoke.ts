"use client";

import { useState, useEffect, useRef } from "react";

import { supabase } from "@/lib/api/client/supabase";

import type { Seccion, IdiomaKey, KaraokeTimings, LineaConTiempo } from "./types";

export function useKaraoke(
  cancionId: string,
  idioma: IdiomaKey,
  secciones: Seccion[],
  duracion?: number | null,
  onSeccionTimingsChange?: (seccionId: string, col: string, timings: Record<string, number>) => void,
) {
  const storageKey = `karaoke-${cancionId}-${idioma}`;

  const timingsFromSupabase = (): KaraokeTimings => {
    const col = `timings_${idioma}` as keyof Seccion;
    const result: KaraokeTimings = {};
    for (const sec of secciones) {
      const t = sec[col] as Record<string, number> | null | undefined;
      if (t && Object.keys(t).length > 0) {
        result[sec.id] = Object.fromEntries(
          Object.entries(t).map(([k, v]) => [Number(k), v])
        );
      }
    }
    return result;
  };

  const [timings, setTimings] = useState<KaraokeTimings>(() => {
    const fromSupa = timingsFromSupabase();
    if (Object.keys(fromSupa).length > 0) return fromSupa;
    try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch { return {}; }
  });
  const [elapsed,  setElapsed]  = useState(0);
  const [playing,  setPlaying]  = useState(false);
  const [modoEdit, setModoEdit] = useState(false);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef     = useRef<number>(0);
  const baseRef      = useRef<number>(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fromSupa = timingsFromSupabase();
    if (Object.keys(fromSupa).length > 0) {
      setTimings(fromSupa);
    } else {
      try { setTimings(JSON.parse(localStorage.getItem(storageKey) || "{}")); } catch { setTimings({}); }
    }
    setElapsed(0); setPlaying(false);
  }, [storageKey]);

  useEffect(() => {
    if (playing) {
      startRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        const next = baseRef.current + (Date.now() - startRef.current) / 1000;
        if (duracion && next >= duracion) {
          setElapsed(duracion);
          baseRef.current = duracion;
          setPlaying(false);
          return;
        }
        setElapsed(next);
      }, 50);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      baseRef.current = elapsed;
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, duracion]);

  const saveSeccionTimings = (seccionId: string, secTimings: Record<number, number>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const col = `timings_${idioma}`;
      const data = Object.fromEntries(
        Object.entries(secTimings).map(([k, v]) => [String(k), v])
      );
      await supabase.from("secciones_cancion").update({ [col]: data }).eq("id", seccionId);
      onSeccionTimingsChange?.(seccionId, col, data);
    }, 1000);
  };

  const saveSeccionTimingsNow = async (seccionId: string, secTimings: Record<number, number>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const col = `timings_${idioma}`;
    const data = Object.fromEntries(
      Object.entries(secTimings).map(([k, v]) => [String(k), v])
    );
    await supabase.from("secciones_cancion").update({ [col]: data }).eq("id", seccionId);
    onSeccionTimingsChange?.(seccionId, col, data);
  };

  const toggle = () => setPlaying(p => !p);
  const reset  = () => { setPlaying(false); baseRef.current = 0; setElapsed(0); };
  const seekTo = (s: number) => {
    const clamped = duracion ? Math.min(s, duracion) : s;
    baseRef.current = clamped;
    startRef.current = Date.now();
    setElapsed(clamped);
  };

  const marcarLinea = (seccionId: string, lineaIdx: number) => {
    setTimings(prev => {
      const secTimings = { ...(prev[seccionId] || {}), [lineaIdx]: Math.round(elapsed * 10) / 10 };
      const next = { ...prev, [seccionId]: secTimings };
      localStorage.setItem(storageKey, JSON.stringify(next));
      saveSeccionTimings(seccionId, secTimings);
      return next;
    });
  };

  const borrarLinea = (seccionId: string, lineaIdx: number) => {
    setTimings(prev => {
      const next = { ...prev };
      if (next[seccionId]) {
        const sec = { ...next[seccionId] };
        delete sec[lineaIdx];
        next[seccionId] = sec;
        saveSeccionTimings(seccionId, sec);
      }
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const borrarTodo = async () => {
    localStorage.removeItem(storageKey);
    setTimings({});
    const col = `timings_${idioma}`;
    for (const sec of secciones) {
      await supabase.from("secciones_cancion").update({ [col]: null }).eq("id", sec.id);
    }
  };

  const getTiempo = (seccionId: string, lineaIdx: number): number | null =>
    timings[seccionId]?.[lineaIdx] ?? null;

  const setTiempo = (seccionId: string, lineaIdx: number, seg: number) => {
    setTimings(prev => {
      const secTimings = { ...(prev[seccionId] || {}), [lineaIdx]: seg };
      const next = { ...prev, [seccionId]: secTimings };
      localStorage.setItem(storageKey, JSON.stringify(next));
      void saveSeccionTimingsNow(seccionId, secTimings);
      return next;
    });
  };

  const getLineaActiva = (lineas: LineaConTiempo[]): number => {
    let activa = -1;
    for (let i = 0; i < lineas.length; i++) {
      const t = getTiempo(lineas[i].seccionId, lineas[i].lineaIdx);
      if (t !== null && t <= elapsed) activa = i;
    }
    return activa;
  };

  return {
    timings, elapsed, playing, modoEdit, setModoEdit,
    toggle, reset, seekTo,
    marcarLinea, borrarLinea, borrarTodo,
    getTiempo, setTiempo, getLineaActiva,
  };
}
