"use client";

/**
 * useEntidadesUi (Zustand + persist)
 * ───────────────────────────────────────────────────────────────────────────
 * Estado de UI de EntidadesPage que antes vivía en useState local y se
 * perdía al recargar la página. Mismo patrón que useMundoNavigationStore /
 * useFavoritosStore: persist a localStorage, sin Provider, selección
 * granular por selector.
 *
 * Cubre:
 *   - agrupacionPersonajes: qué vista jerárquica se muestra dentro de
 *     "Personajes" — Por Reino (GeografiaJerarquica), Por Criatura
 *     (CriaturasJerarquica) o Items (ItemsJerarquia). Si recargás estando
 *     en cualquiera de las 3, se vuelve a abrir la misma.
 *   - mostrarPersonajes: toggle "ver personajes" dentro de esas jerarquías.
 *   - grupoXSeleccionadoId (x4): filtro de grupo activo en cada vista
 *     (Personajes/Reino, Criatura, Item, Reino-en-GeografiaJerarquica).
 *   - búsquedas (x3): texto de búsqueda por vista.
 *
 * Uso — seleccioná solo lo que necesitás para no re-renderizar de más:
 *
 *   const agrupacionPersonajes = useEntidadesUi((s) => s.agrupacionPersonajes);
 *   const setAgrupacionPersonajes = useEntidadesUi((s) => s.setAgrupacionPersonajes);
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { AgrupacionPersonajes } from "./AgrupacionPersonajesDropdown";

interface EntidadesUiState {
  // ── Qué jerarquía se muestra (Reino / Criatura / Items) ────────────────
  agrupacionPersonajes: AgrupacionPersonajes;
  setAgrupacionPersonajes: (v: AgrupacionPersonajes) => void;

  // ── Toggle "ver personajes" dentro de Geografía/Criaturas ──────────────
  mostrarPersonajes: boolean;
  setMostrarPersonajes: (v: boolean | ((prev: boolean) => boolean)) => void;

  // ── Filtros de grupo activos por vista ──────────────────────────────────
  grupoPersonajeSeleccionadoId: string | null;
  setGrupoPersonajeSeleccionadoId: (id: string | null) => void;
  grupoCriaturaSeleccionadoId: string | null;
  setGrupoCriaturaSeleccionadoId: (id: string | null) => void;
  grupoItemSeleccionadoId: string | null;
  setGrupoItemSeleccionadoId: (id: string | null) => void;
  grupoReinoSeleccionadoId: string | null;
  setGrupoReinoSeleccionadoId: (id: string | null) => void;

  // ── Búsquedas por vista ──────────────────────────────────────────────────
  busquedaCriatura: string;
  setBusquedaCriatura: (v: string) => void;
  busquedaReino: string;
  setBusquedaReino: (v: string) => void;
  busquedaItem: string;
  setBusquedaItem: (v: string) => void;
}

export const useEntidadesUi = create<EntidadesUiState>()(
  persist(
    (set) => ({
      agrupacionPersonajes: "reino",
      setAgrupacionPersonajes: (v) => set({ agrupacionPersonajes: v }),

      mostrarPersonajes: true,
      setMostrarPersonajes: (v) =>
        set((state) => ({
          mostrarPersonajes: typeof v === "function" ? v(state.mostrarPersonajes) : v,
        })),

      grupoPersonajeSeleccionadoId: null,
      setGrupoPersonajeSeleccionadoId: (id) => set({ grupoPersonajeSeleccionadoId: id }),
      grupoCriaturaSeleccionadoId: null,
      setGrupoCriaturaSeleccionadoId: (id) => set({ grupoCriaturaSeleccionadoId: id }),
      grupoItemSeleccionadoId: null,
      setGrupoItemSeleccionadoId: (id) => set({ grupoItemSeleccionadoId: id }),
      grupoReinoSeleccionadoId: null,
      setGrupoReinoSeleccionadoId: (id) => set({ grupoReinoSeleccionadoId: id }),

      busquedaCriatura: "",
      setBusquedaCriatura: (v) => set({ busquedaCriatura: v }),
      busquedaReino: "",
      setBusquedaReino: (v) => set({ busquedaReino: v }),
      busquedaItem: "",
      setBusquedaItem: (v) => set({ busquedaItem: v }),
    }),
    {
      // Clave propia, separada de mundo:nav:v2 — este store guarda estado
      // de filtros/agrupación de EntidadesPage, no la navegación entre
      // secciones/tabs (eso sigue en useMundoNavigationStore).
      name: "mundo:entidades-ui:v1",
    },
  ),
);
