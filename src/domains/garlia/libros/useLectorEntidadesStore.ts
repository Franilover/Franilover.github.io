"use client";

/**
 * useLectorEntidadesStore (Zustand)
 * ───────────────────────────────────────────────────────────────────────────
 * Mapas de entidades referenciadas por los capítulos del libro activo:
 * personajes, reinos y ciudades. Se separan de useLectorStore porque tienen
 * un ciclo de vida y una fuente distintos:
 *
 *   - useLectorStore    → estado de navegación (capId, capitulos, loading),
 *                         cambia seguido (cada click de capítulo).
 *   - useLectorEntidadesStore → mapas id→entidad, se precargan UNA VEZ para
 *                         todo el libro (ver loadPersonajesMap/loadReinosMap/
 *                         loadCiudadesMap en syncEngine.ts) y después solo se
 *                         leen — cambiar de capítulo NUNCA dispara un fetch
 *                         nuevo acá, solo un lookup sincrónico por ids.
 *
 * Separarlos evita que un componente que solo lee personajesMap (ej.
 * PersonajesPanel) se re-renderice cuando cambia capId, y viceversa.
 *
 * Un solo libro activo a la vez (igual que useLectorStore) — resetLibro()
 * limpia los tres mapas al entrar a un libro distinto.
 *
 * NO persiste: los datos ya viven cacheados en Dexie (fuente real offline);
 * esto es solo el estado en memoria de React para el libro que se está
 * leyendo ahora mismo.
 */

import { create } from "zustand";

interface PersonajeLite {
  id: string;
  nombre: string;
  img_url?: string | null;
  [key: string]: any;
}

interface ReinoLite {
  id: string;
  nombre: string;
  [key: string]: any;
}

interface CiudadLite {
  id: string;
  nombre: string;
  [key: string]: any;
}

interface LectorEntidadesState {
  personajesMap: Record<string, PersonajeLite>;
  reinosMap: Record<string, ReinoLite>;
  ciudadesMap: Record<string, CiudadLite>;

  /** Limpia los tres mapas — llamar al cambiar de libro (nuevo slugParam). */
  resetEntidades: () => void;

  /** Mergea entradas nuevas sin pisar lo ya cargado — así, si loadPersonajesMap
   *  resuelve en dos rondas (Dexie primero, Supabase después vía onUpdate),
   *  cada ronda solo agrega lo que llega, sin parpadeo de lo que ya estaba. */
  mergePersonajes: (map: Record<string, PersonajeLite>) => void;
  mergeReinos: (map: Record<string, ReinoLite>) => void;
  mergeCiudades: (map: Record<string, CiudadLite>) => void;
}

export const useLectorEntidadesStore = create<LectorEntidadesState>()(
  (set) => ({
    personajesMap: {},
    reinosMap: {},
    ciudadesMap: {},

    resetEntidades: () =>
      set({ personajesMap: {}, reinosMap: {}, ciudadesMap: {} }),

    mergePersonajes: (map) =>
      set((state) => ({
        personajesMap: { ...state.personajesMap, ...map },
      })),

    mergeReinos: (map) =>
      set((state) => ({ reinosMap: { ...state.reinosMap, ...map } })),

    mergeCiudades: (map) =>
      set((state) => ({ ciudadesMap: { ...state.ciudadesMap, ...map } })),
  }),
);
