"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * Ajustes de lectura persistentes (tamaño de fuente).
 * ───────────────────────────────────────────────────────────────────────────
 * El lector ya usa `clamp()` fluido por contenedor (ver FLUID_FONT_STYLES en
 * CapituloScrollBlock.tsx) para que el texto escale con el ancho de la
 * columna. Este hook agrega un multiplicador encima de eso — no reemplaza el
 * fluid type, lo escala — vía la variable CSS `--lector-font-scale`, que
 * CapituloScrollBlock lee en sus clamp().
 *
 * El tema (claro/oscuro) NO se maneja acá: ya existe un ThemeProvider global
 * (dark/light + accent) que aplica a toda la app — el lector expone un
 * atajo a `toggleDark()` de ese provider en vez de duplicar el estado.
 */

const STORAGE_KEY = "lector-font-scale-v1";
const MIN_SCALE = 0.85;
const MAX_SCALE = 1.35;
const DEFAULT_SCALE = 1;
const STEP = 0.05;

function clampScale(v: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));
}

export function useLectorAjustes() {
  const [fontScale, setFontScaleState] = useState<number>(DEFAULT_SCALE);
  const [loaded, setLoaded] = useState(false);

  // Cargar valor guardado al montar (cliente only — localStorage no existe en SSR).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed)) setFontScaleState(clampScale(parsed));
      }
    } catch {
      // localStorage puede fallar en modo privado — no es crítico, se
      // queda con DEFAULT_SCALE para esta sesión.
    }
    setLoaded(true);
  }, []);

  const setFontScale = useCallback((value: number) => {
    const clamped = clampScale(value);
    setFontScaleState(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {}
  }, []);

  const incrementarFuente = useCallback(() => {
    setFontScale(fontScale + STEP);
  }, [fontScale, setFontScale]);

  const decrementarFuente = useCallback(() => {
    setFontScale(fontScale - STEP);
  }, [fontScale, setFontScale]);

  const resetFuente = useCallback(() => {
    setFontScale(DEFAULT_SCALE);
  }, [setFontScale]);

  return {
    fontScale,
    setFontScale,
    incrementarFuente,
    decrementarFuente,
    resetFuente,
    loaded,
    minScale: MIN_SCALE,
    maxScale: MAX_SCALE,
    step: STEP,
    defaultScale: DEFAULT_SCALE,
  };
}
