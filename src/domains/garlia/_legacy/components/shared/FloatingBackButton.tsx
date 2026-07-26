"use client";

/**
 * FloatingBackButton
 * ───────────────────────────────────────────────────────────────────────────
 * Para secciones "hoja" totalmente autónomas (capítulos, letras, mapa,
 * línea de tiempo) que ya traen su propio layout interno completo. En vez
 * de envolverlas en un flex-col que podría pelear por el espacio vertical
 * con su scroll interno, se superpone un botón flotante fijo arriba a la
 * izquierda para volver al menú de secciones.
 */

import { X } from "lucide-react";
import React from "react";

import { useMundoNavigation } from "../../hooks/mundo/useMundoNavigationStore";

export function FloatingBackButton() {
  const goToMenu = useMundoNavigation((s) => s.goToMenu);

  return (
    <button
      type="button"
      onClick={goToMenu}
      className="absolute top-2 left-2 z-30 p-1.5 rounded-lg bg-bg-main/90 backdrop-blur-sm border border-primary/10 text-primary/50 hover:bg-primary/10 hover:text-primary transition-colors shadow-sm"
      aria-label="Volver a secciones"
    >
      <X size={14} />
    </button>
  );
}
