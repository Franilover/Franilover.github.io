"use client";
import { create } from "zustand";

export type PanelApp =
  | "reloj"
  | "tareas"
  | "ejercicios"
  | "ingredientes"
  | "recetas"
  | "ropa";

interface AppPanelsStore {
  panelAbierto: PanelApp | null;
  vistaPersonal: "libros" | null;
  setPanelAbierto: (panel: PanelApp | null) => void;
  setVistaPersonal: (vista: "libros" | null) => void;
  /** Abre una app desde cualquier lugar (ej. el Command Palette). */
  abrirApp: (id: PanelApp | "libros") => void;
}

export const useAppPanels = create<AppPanelsStore>((set) => ({
  panelAbierto: null,
  vistaPersonal: null,
  setPanelAbierto: (panel) => set({ panelAbierto: panel }),
  setVistaPersonal: (vista) => set({ vistaPersonal: vista }),
  abrirApp: (id) =>
    id === "libros"
      ? set({ vistaPersonal: "libros", panelAbierto: null })
      : set({ panelAbierto: id, vistaPersonal: null }),
}));
