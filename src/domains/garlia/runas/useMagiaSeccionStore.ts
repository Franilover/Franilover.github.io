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

// Física y Biología dejaron de ser tabs de nivel superior — ahora viven
// como sub-secciones internas de "tabla" (Química), ver
// SubSeccionQuimica más abajo. Se mantienen como valores válidos de
// SeccionMagia (en vez de borrarlos) solo para no romper el `seccion`
// persistido de sesiones viejas: quien lea el store hoy debe tratarlos
// como "tabla" (ver migrate más abajo).
export type SeccionMagia =
  | "runas"
  | "tabla"
  | "fisica"
  | "biologia"
  | "sandbox"
  | "visualizador"
  | "logica";

// Sub-secciones dentro de la tab "Química": antes física/biología tenían
// su propia jerarquía Partículas Base > Partículas > Elementos por
// separado; ahora conviven acá como pestañas internas, respetando esa
// misma jerarquía (Tabla = Elementos, Física = Partículas Base >
// Partículas > Iums > Oris, Biología = Cladística/Tejidos/Órganos).
export type SubSeccionQuimica = "tabla" | "fisica" | "biologia";

interface MagiaSeccionState {
  seccion: SeccionMagia;
  /** Sub-tab activa dentro de "Química" — persiste igual que `seccion`. */
  subSeccionQuimica: SubSeccionQuimica;
  /** Item seleccionado por sub-tab (id o null). Solo aplica a runas/tabla/fisica. */
  itemPorSeccion: Partial<Record<SeccionMagia, string | null>>;

  setSeccion: (seccion: SeccionMagia) => void;
  setSubSeccionQuimica: (sub: SubSeccionQuimica) => void;
  setItem: (seccion: SeccionMagia, id: string | null) => void;
}

export const useMagiaSeccionStore = create<MagiaSeccionState>()(
  persist(
    (set) => ({
      seccion: "runas",
      subSeccionQuimica: "tabla",
      itemPorSeccion: {},

      setSeccion: (seccion) => set({ seccion }),
      setSubSeccionQuimica: (sub) => set({ subSeccionQuimica: sub }),

      setItem: (seccion, id) =>
        set((state) => ({
          itemPorSeccion: { ...state.itemPorSeccion, [seccion]: id },
        })),
    }),
    {
      name: "mundo:magia-seccion:v2",
      // v1 guardaba "fisica"/"biologia" como `seccion` de nivel superior
      // (tabs propias). Al migrar, las redirigimos a "tabla" + la
      // sub-sección interna correspondiente, para que quien tenía
      // Física o Biología abierta no caiga en una tab que ya no existe.
      version: 2,
      migrate: (persisted: any) => {
        if (!persisted) return persisted;
        if (persisted.seccion === "fisica" || persisted.seccion === "biologia") {
          return {
            ...persisted,
            subSeccionQuimica: persisted.seccion,
            seccion: "tabla",
          };
        }
        return persisted;
      },
    },
  ),
);
