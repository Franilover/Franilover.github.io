"use client";

/**
 * SelectorRejilla.tsx
 * ──────────────────────
 * Sliders para que el jugador elija cuántas secciones (cuñas radiales)
 * y cuántos anillos concéntricos dividen el tablero. 1×1 = sin dividir
 * (comportamiento simple, un solo dibujo). Con más de una celda, el
 * jugador dibuja una runa distinta en cada una (ver RunasDibujo.tsx).
 *
 * Ruta destino:
 *   src/features/garliaPublic/runas/SelectorRejilla.tsx
 */

import { CircleDot, SplitSquareHorizontal } from "lucide-react";
import React from "react";

import { MAX_ANILLOS, MAX_SECCIONES, MIN_ANILLOS, MIN_SECCIONES, type Rejilla } from "../formasLimite";

export function SelectorRejilla({
  value,
  onChange,
}: {
  value: Rejilla;
  onChange: (rejilla: Rejilla) => void;
}) {
  return (
    <div className="w-full flex flex-col gap-2.5 max-w-[260px]">
      <div className="flex items-center gap-2">
        <SplitSquareHorizontal size={14} className="text-primary/40 shrink-0" />
        <input
          className="flex-1 accent-[var(--primary)]"
          max={MAX_SECCIONES}
          min={MIN_SECCIONES}
          type="range"
          value={value.secciones}
          onChange={(e) => onChange({ ...value, secciones: Number(e.target.value) })}
        />
        <span className="text-micro font-black text-primary/50 w-16 text-right">
          {value.secciones === 1 ? "1 sección" : `${value.secciones} secc.`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <CircleDot size={14} className="text-primary/40 shrink-0" />
        <input
          className="flex-1 accent-[var(--primary)]"
          max={MAX_ANILLOS}
          min={MIN_ANILLOS}
          type="range"
          value={value.anillos}
          onChange={(e) => onChange({ ...value, anillos: Number(e.target.value) })}
        />
        <span className="text-micro font-black text-primary/50 w-16 text-right">
          {value.anillos === 1 ? "1 anillo" : `${value.anillos} anillos`}
        </span>
      </div>
    </div>
  );
}
