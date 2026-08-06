"use client";

/**
 * AgrupacionPersonajesDropdown
 * ───────────────────────────────────────────────────────────────────────────
 * Ícono tipo dropdown que vive pegado a la izquierda del buscador de
 * "Personajes" y deja elegir cómo agrupar la vista: por Reino (jerarquía
 * Reino → Ciudad → Personaje) o por Criatura (Criatura → Personaje).
 * Al cambiar la agrupación, EntidadesPage swapea qué componente jerárquico
 * renderiza (GeografiaJerarquica / CriaturasJerarquica) y qué dropdowns de
 * filtro por grupo corresponden — ver EntidadesPage.
 */

import { ChevronDown, Map, Bug } from "lucide-react";
import React, { useLayoutEffect, useRef, useState } from "react";

export type AgrupacionPersonajes = "reino" | "criatura";

const OPCIONES: { value: AgrupacionPersonajes; label: string; Icon: React.ElementType }[] = [
  { value: "reino", label: "Por Reino", Icon: Map },
  { value: "criatura", label: "Por Criatura", Icon: Bug },
];

export function AgrupacionPersonajesDropdown({
  value,
  onChange,
}: {
  value: AgrupacionPersonajes;
  onChange: (value: AgrupacionPersonajes) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const actual = OPCIONES.find((o) => o.value === value) ?? OPCIONES[0];

  useLayoutEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={`Agrupar: ${actual.label}`}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-primary/[0.04] border border-primary/10 hover:bg-primary/10 transition-colors text-primary/60"
      >
        <actual.Icon size={12} />
        <ChevronDown size={10} className="shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 min-w-[160px] rounded-lg border border-primary/10 bg-[var(--card,_#1a1a1a)] shadow-lg overflow-hidden py-1">
          {OPCIONES.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-1.5 text-left px-3 py-1.5 text-micro font-semibold truncate transition-colors ${
                value === o.value ? "text-accent bg-accent/10" : "text-primary/70 hover:bg-primary/5"
              }`}
            >
              <o.Icon size={11} className="shrink-0" />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
