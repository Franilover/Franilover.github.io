"use client";

/**
 * useMobileAsidePanel
 * ───────────────────────────────────────────────────────────────────────────
 * Antes, cada editor con panel lateral (EditorPersonaje, EditorCriatura,
 * EditorReino, EnsayoNotas...) dibujaba su propio botón "sm:hidden" en su
 * propio header para abrir el drawer de entidades/relaciones en celular.
 * Resultado: un botón repetido N veces, cada uno con su propio estado local
 * (mobileAsideOpen), y la navbar no sabía nada de esto.
 *
 * Ahora ese botón vive UNA sola vez, a la derecha de la navbar mobile. Los
 * editores solo tienen que:
 *
 *   1. Registrarse mientras están montados:
 *        useRegisterMobileAside(); // en el propio componente del editor
 *
 *   2. Leer si el drawer está abierto (en vez de su propio useState):
 *        const open = useMobileAsidePanel((s) => s.open);
 *        const close = useMobileAsidePanel((s) => s.close);
 *
 * La navbar solo muestra el botón si hay un editor registrado (`available`),
 * y el propio hook de registro cierra el drawer al desmontarse ese editor
 * (cambio de sección, back, etc.) para que no quede un botón fantasma ni un
 * drawer abierto huérfano.
 */

import { useEffect } from "react";
import { create } from "zustand";

interface MobileAsideState {
  /** Hay algún editor montado que expone un panel lateral en celular. */
  available: boolean;
  /** El drawer está abierto actualmente. */
  open: boolean;

  setAvailable: (available: boolean) => void;
  toggle: () => void;
  openPanel: () => void;
  close: () => void;
}

export const useMobileAsidePanel = create<MobileAsideState>()((set) => ({
  available: false,
  open: false,

  setAvailable: (available) => set({ available }),
  toggle: () => set((s) => ({ open: !s.open })),
  openPanel: () => set({ open: true }),
  close: () => set({ open: false }),
}));

/**
 * Hook de conveniencia para que un editor "anuncie" que tiene panel lateral
 * mientras está montado, y limpie el estado global al desmontarse (para que
 * el botón desaparezca de la navbar y no quede el drawer abierto si el
 * usuario navega a otra sección o entidad).
 */
export function useRegisterMobileAside() {
  const setAvailable = useMobileAsidePanel((s) => s.setAvailable);
  const close = useMobileAsidePanel((s) => s.close);

  useEffect(() => {
    setAvailable(true);
    return () => {
      setAvailable(false);
      close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
