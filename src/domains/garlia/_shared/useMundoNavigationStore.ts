"use client";

/**
 * useMundoNavigation (Zustand)
 * ───────────────────────────────────────────────────────────────────────────
 * Reemplaza el Context+reducer anterior. Misma responsabilidad, menos
 * ceremonia: sin Provider que envolver, sin useContext, sin useMemo para
 * evitar renders de más — Zustand ya hace selección granular por selector.
 *
 * Requisito: `npm install zustand` (verificado con zustand@5.0.14 + TS strict,
 * sin errores).
 *
 * Uso en componentes — IMPORTANTE: seleccioná solo lo que necesitás, para no
 * re-renderizar en cada cambio de cualquier campo del store:
 *
 *   const section = useMundoNavigation((s) => s.section);
 *   const openEntity = useMundoNavigation((s) => s.openEntity);
 *
 * en vez de:
 *
 *   const { section, openEntity } = useMundoNavigation(); // ❌ re-renderiza siempre
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SectionKey =
  | "personajes"
  | "criaturas"
  | "biomas"
  | "ecosistemas"
  | "flora"
  | "minerales"
  | "items"
  | "reinos"
  | "ciudades"
  | "runas"
  | "elementos"
  | "grupos"
  | "capitulos"
  | "letras"
  | "notas"
  | "notas-gos"
  | "mapa"
  | "linea-tiempo"
  | "aventura"
  | "auditoria";

/** Una pestaña de entidad abierta: sección + id puntual. */
export interface MundoTab {
  section: SectionKey;
  id: string;
}

function sameTab(a: MundoTab, b: { section: SectionKey; id: string }) {
  return a.section === b.section && a.id === b.id;
}

interface MundoNavState {
  /** null = mostrando el menú agrupado de secciones, sin ninguna abierta */
  section: SectionKey | null;
  selectedId: string | null;
  /** Incrementa en cada "apertura puntual" de entidad, útil como React key para forzar remount sin setTimeout */
  navKey: number;

  /** Pestañas de entidad abiertas, en orden horizontal. section/selectedId
   *  reflejan siempre la pestaña activa (la última abierta o clickeada). */
  openTabs: MundoTab[];

  selectSection: (section: SectionKey) => void;
  /** Abre (o activa si ya existe) una pestaña de entidad puntual. */
  openEntity: (section: SectionKey, id: string) => void;
  /** Activa una pestaña ya abierta sin tocar la lista. */
  activateTab: (section: SectionKey, id: string) => void;
  /** Cierra una pestaña. Si era la activa, activa la pestaña vecina (o
   *  limpia la selección si no queda ninguna). */
  closeTab: (section: SectionKey, id: string) => void;
  clearSelection: () => void;
  /** Vuelve al menú de secciones (la "X" para atrás) */
  goToMenu: () => void;
}

export const useMundoNavigation = create<MundoNavState>()(
  persist(
    (set) => ({
      section: null,
      selectedId: null,
      navKey: 0,
      openTabs: [],

      selectSection: (section) => set({ section, selectedId: null }),

      openEntity: (section, id) =>
        set((state) => {
          const exists = state.openTabs.some((t) => sameTab(t, { section, id }));
          const openTabs = exists
            ? state.openTabs
            : [...state.openTabs, { section, id }];
          return {
            section,
            selectedId: id,
            navKey: state.navKey + 1,
            openTabs,
          };
        }),

      activateTab: (section, id) =>
        set((state) => ({
          section,
          selectedId: id,
          navKey: state.navKey + 1,
        })),

      closeTab: (section, id) =>
        set((state) => {
          const idx = state.openTabs.findIndex((t) => sameTab(t, { section, id }));
          if (idx === -1) return state;

          const openTabs = state.openTabs.filter((_, i) => i !== idx);
          const wasActive = state.section === section && state.selectedId === id;

          if (!wasActive) return { openTabs };

          // Al cerrar la pestaña activa, activamos la vecina (preferimos la
          // de la izquierda, como la mayoría de editores tipo tabs).
          const neighbor = openTabs[idx - 1] ?? openTabs[idx] ?? null;
          return {
            openTabs,
            section: neighbor ? neighbor.section : state.section,
            selectedId: neighbor ? neighbor.id : null,
            navKey: state.navKey + 1,
          };
        }),

      clearSelection: () => set({ selectedId: null }),

      goToMenu: () => set({ section: null, selectedId: null }),
    }),
    {
      // Única clave de persistencia — reemplaza los 3 mecanismos previos
      // (editorEntidades:session, garlia-panel-item, garlia-pending-open-entity).
      name: "mundo:nav:v2",
      // No persistimos navKey: al recargar la página no queremos forzar
      // remounts fantasma con un contador viejo.
      partialize: (state) => ({
        section: state.section,
        selectedId: state.selectedId,
        openTabs: state.openTabs,
      }),
    },
  ),
);
