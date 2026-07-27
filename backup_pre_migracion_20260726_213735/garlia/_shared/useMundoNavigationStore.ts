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
  | "items"
  | "reinos"
  | "ciudades"
  | "grupos"
  | "hechizos"
  | "dones"
  | "runas"
  | "capitulos"
  | "letras"
  | "notas"
  | "mapa"
  | "linea-tiempo"
  | "aventura";

/** @deprecated Magia ya no es una sub-navegación; "hechizos"/"dones"/"runas" son SectionKey propios. */
export type MagiaTipo = "hechizos" | "dones" | "runas";

interface MundoNavState {
  /** null = mostrando el menú agrupado de secciones, sin ninguna abierta */
  section: SectionKey | null;
  selectedId: string | null;
  /** Incrementa en cada "apertura puntual" de entidad, útil como React key para forzar remount sin setTimeout */
  navKey: number;

  selectSection: (section: SectionKey) => void;
  openEntity: (section: SectionKey, id: string) => void;
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

      selectSection: (section) => set({ section, selectedId: null }),

      openEntity: (section, id) =>
        set((state) => ({
          section,
          selectedId: id,
          navKey: state.navKey + 1,
        })),

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
      }),
    },
  ),
);
