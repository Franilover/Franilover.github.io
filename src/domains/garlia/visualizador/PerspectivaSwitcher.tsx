"use client";

/**
 * PerspectivaSwitcher.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Selector explícito entre las dos rutas del sistema. Existe para que sea
 * conceptualmente imposible leer "Partícula → IUM → Elemento" como una
 * única cadena: cada perspectiva muestra su propia ruta completa (con su
 * nivel intermedio y su resultado), nunca mezcladas en la misma vista.
 *
 *   Física:    Partícula (A/T/S) → IUM   → Oris
 *   Alquimia:  Partícula química → Capa  → Elemento
 */

import React from "react";
import { Atom, Sparkles } from "lucide-react";

export type Perspectiva = "fisica" | "alquimia";

const OPCIONES: {
  key: Perspectiva;
  label: string;
  ruta: string;
  icon: React.ReactNode;
}[] = [
  { key: "fisica", label: "Física", ruta: "Partícula → IUM → Oris", icon: <Sparkles size={14} /> },
  { key: "alquimia", label: "Alquimia", ruta: "Partícula → Capa → Elemento", icon: <Atom size={14} /> },
];

export function PerspectivaSwitcher({
  value,
  onChange,
}: {
  value: Perspectiva;
  onChange: (p: Perspectiva) => void;
}) {
  return (
    <div className="inline-flex rounded-2xl border border-primary/10 p-1">
      {OPCIONES.map((op) => {
        const active = value === op.key;
        return (
          <button
            key={op.key}
            type="button"
            onClick={() => onChange(op.key)}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors ${
              active ? "border border-primary/25" : "border border-transparent hover:border-primary/15"
            }`}
          >
            <span className={active ? "text-primary/80" : "text-primary/40"}>{op.icon}</span>
            <span>
              <span
                className={`block text-[10px] font-black uppercase tracking-widest ${
                  active ? "text-primary/85" : "text-primary/45"
                }`}
              >
                {op.label}
              </span>
              <span className="block text-[10px] text-primary/40">{op.ruta}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
