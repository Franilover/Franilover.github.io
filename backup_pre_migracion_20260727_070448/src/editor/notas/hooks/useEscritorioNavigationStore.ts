"use client";

/**
 * useEscritorioNavigation (Zustand)
 * ───────────────────────────────────────────────────────────────────────────
 * Mismo patrón que useMundoNavigation (editorGarlia): controla qué sección
 * de /myself/escritorio está activa, para que el navbar pueda cambiarla sin
 * navegar de página (evita perder el estado del editor de notas).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type EscritorioSectionKey =
  | "inicio"
  | "libros"
  | "cocina"
  | "ingredientes"
  | "ejercicio"
  | "ropa";

interface EscritorioNavState {
  section: EscritorioSectionKey;
  selectSection: (section: EscritorioSectionKey) => void;
}

export const useEscritorioNavigation = create<EscritorioNavState>()(
  persist(
    (set) => ({
      section: "inicio",
      selectSection: (section) => set({ section }),
    }),
    {
      name: "escritorio:nav:v1",
    },
  ),
);
