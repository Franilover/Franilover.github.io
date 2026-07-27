"use client";

/**
 * useFavoritos (Zustand + persist)
 * ───────────────────────────────────────────────────────────────────────────
 * Favoritos del Home Dashboard de Mundo. Local al navegador (localStorage),
 * mismo patrón que useMundoNavigationStore — sin tabla nueva en Supabase,
 * sin sincronización entre dispositivos (si más adelante se quiere que los
 * favoritos viajen entre dispositivos, esto se puede migrar a una tabla
 * "favoritos" en Supabase manteniendo la misma interfaz pública).
 *
 * Cada favorito guarda lo mínimo para poder:
 *   1. Navegar directo a la entidad (section + id vía openEntity).
 *   2. Mostrar un chip decente sin tener que re-fetchear (nombre + tabla).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { SectionKey } from "./useMundoNavigationStore";

export interface Favorito {
  /** section/tabla a la que pertenece (ej: "personajes", "reinos") */
  section: SectionKey;
  id: string;
  nombre: string;
  /** timestamp de cuándo se marcó como favorito, para ordenar */
  addedAt: number;
}

interface FavoritosState {
  favoritos: Favorito[];
  isFavorito: (section: SectionKey, id: string) => boolean;
  toggleFavorito: (fav: Omit<Favorito, "addedAt">) => void;
  removeFavorito: (section: SectionKey, id: string) => void;
}

export const useFavoritos = create<FavoritosState>()(
  persist(
    (set, get) => ({
      favoritos: [],

      isFavorito: (section, id) =>
        get().favoritos.some((f) => f.section === section && f.id === id),

      toggleFavorito: (fav) =>
        set((state) => {
          const exists = state.favoritos.some(
            (f) => f.section === fav.section && f.id === fav.id,
          );
          if (exists) {
            return {
              favoritos: state.favoritos.filter(
                (f) => !(f.section === fav.section && f.id === fav.id),
              ),
            };
          }
          return {
            favoritos: [...state.favoritos, { ...fav, addedAt: Date.now() }],
          };
        }),

      removeFavorito: (section, id) =>
        set((state) => ({
          favoritos: state.favoritos.filter(
            (f) => !(f.section === section && f.id === id),
          ),
        })),
    }),
    {
      name: "mundo:favoritos:v1",
    },
  ),
);
