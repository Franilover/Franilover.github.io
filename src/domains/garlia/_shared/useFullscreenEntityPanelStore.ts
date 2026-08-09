"use client";

/**
 * useFullscreenEntityPanel (Zustand)
 * ───────────────────────────────────────────────────────────────────────────
 * Estado global mínimo para el panel flotante en pantalla completa que se
 * abre al hacer click con el botón del medio del mouse sobre una EntityCard
 * de Personaje o Criatura (en GeografiaJerarquica / CriaturasJerarquica).
 *
 * Distinto de useMundoNavigation.openEntity(): ese navega la sección activa
 * (reemplaza lo que se ve en el editor principal, agrega una pestaña).
 * Este store en cambio abre un overlay POR ENCIMA de lo que ya está en
 * pantalla, sin tocar la navegación — pensado para "espiar" o editar rápido
 * un personaje/criatura sin perder el lugar donde estabas (ej. en medio de
 * un árbol de Geografía o Criaturas).
 *
 * Guarda el objeto mínimo ya disponible en el punto de click (mismo shape
 * que usan PersonajeEditor/CriaturaEditor: id, nombre, + resto de campos
 * opcionales) — no vuelve a pedir los datos a la API.
 *
 * Uso:
 *   const openFullscreen = useFullscreenEntityPanel((s) => s.open);
 *   <EntityCard ... onMiddleClick={() => openFullscreen("personaje", p)} />
 */

import { create } from "zustand";

export type FullscreenEntityKind = "personaje" | "criatura";

export interface FullscreenEntityData {
  id: string;
  nombre: string;
  [key: string]: any;
}

interface FullscreenEntityPanelState {
  entity: { kind: FullscreenEntityKind; data: FullscreenEntityData } | null;
  open: (kind: FullscreenEntityKind, data: FullscreenEntityData) => void;
  close: () => void;
}

export const useFullscreenEntityPanel = create<FullscreenEntityPanelState>()((set) => ({
  entity: null,
  open: (kind, data) => set({ entity: { kind, data } }),
  close: () => set({ entity: null }),
}));
