"use client";

/**
 * PerspectivaSwitcher.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Selector explícito entre las rutas del sistema. Existe para que sea
 * conceptualmente imposible leer "Partícula → IUM → Elemento" como una
 * única cadena: cada perspectiva muestra su propia ruta completa (con su
 * nivel intermedio y su resultado), nunca mezcladas en la misma vista.
 *
 *   Física:    Partícula (A/T/S) → IUM   → Oris
 *   Alquimia:  Partícula química → Capa  → Elemento
 *   Química:   Elemento → Sitios → Compatibilidad → Enlaces → Compuesto
 *              (VIS-03, documento maestro Parte 4 — tercera ruta,
 *              deliberadamente separada de Alquimia: acá el "resultado" no
 *              es el Elemento sino el Compuesto que varios Elementos forman)
 */

import React from "react";

export type Perspectiva = "fisica" | "alquimia" | "quimica";

const OPCIONES: {
  key: Perspectiva;
  label: string;
  ruta: string;
}[] = [
  { key: "fisica", label: "Física", ruta: "Partícula → IUM → Oris" },
  { key: "alquimia", label: "Alquimia", ruta: "Partícula → Capa → Elemento" },
  { key: "quimica", label: "Química", ruta: "Elemento → Sitios → Enlaces → Compuesto" },
];

export function PerspectivaSwitcher({
  value,
  onChange,
}: {
  value: Perspectiva;
  onChange: (p: Perspectiva) => void;
}) {
  return (
    <div className="flex w-full">
      {OPCIONES.map((op) => {
        const active = value === op.key;
        return (
          <button
            key={op.key}
            type="button"
            onClick={() => onChange(op.key)}
            className="flex flex-1 items-center gap-3 px-4 py-1.5 text-left transition-colors"
          >
            <span>
              <span
                className={`block text-[10px] font-black uppercase tracking-widest ${
                  active ? "text-primary/85" : "text-primary/45"
                }`}
              >
                {op.label}
              </span>
              <span className="mt-0.5 block text-[11px] text-primary/40">{op.ruta}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
