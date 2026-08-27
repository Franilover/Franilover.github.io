"use client";

/**
 * useMagiaSeccionStore (Zustand + persist)
 * ───────────────────────────────────────────────────────────────────────────
 * Recuerda, entre recargas, qué sub-tab de "Magia" estaba abierta (Runas /
 * Química / Física / Biología / Lógica) y qué item estaba seleccionado
 * dentro de cada una (runa / elemento / oris). Antes ambos eran useState
 * locales en RunasPage — se perdían al refrescar la página, forzando
 * volver a navegar desde cero cada vez.
 *
 * Solo se persiste lo que ya tiene soporte de deep-link vía props en su
 * página respectiva (seleccionarRunaId / seleccionarElementoId /
 * seleccionarOrisId) — Biología, Sandbox y Lógica no exponen ese hook
 * todavía (Cladística, el motor de simulación y el mapa de capas manejan
 * su selección internamente), así que por ahora solo se recuerda qué
 * sub-tab quedó activa ahí, no un item puntual.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SeccionMagia = "runas" | "tabla" | "fisica" | "biologia" | "sandbox" | "logica";

interface MagiaSeccionState {
  seccion: SeccionMagia;
  /** Item seleccionado por sub-tab (id o null). Solo aplica a runas/tabla/fisica. */
  itemPorSeccion: Partial<Record<SeccionMagia, string | null>>;

  setSeccion: (seccion: SeccionMagia) => void;
  setItem: (seccion: SeccionMagia, id: string | null) => void;
}

export const useMagiaSeccionStore = create<MagiaSeccionState>()(
  persist(
    (set) => ({
      seccion: "runas",
      itemPorSeccion: {},

      setSeccion: (seccion) => set({ seccion }),

      setItem: (seccion, id) =>
        set((state) => ({
          itemPorSeccion: { ...state.itemPorSeccion, [seccion]: id },
        })),
    }),
    {
      name: "mundo:magia-seccion:v1",
    },
  ),
);
