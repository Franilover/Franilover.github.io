"use client";
import React from "react";

import { cn } from "@/lib/utils/index";

/**
 * Chip
 * ───────────────────────────────────────────────────────────────────────────
 * Pastilla individual seleccionable. Uso suelto (ver PanelFiltros.tsx):
 *
 *   <Chip active={x} onClick={...}>Texto</Chip>
 *
 * Acepta cualquier children (texto, iconos, o ambos).
 */
interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  colorDot?: string;
}

export function Chip({ active, colorDot, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest transition-all border shrink-0",
        active
          ? "bg-primary text-btn-text border-primary"
          : "bg-primary/5 text-muted-on-surface border-primary/10 hover:border-primary/30",
        className,
      )}
      style={{ borderRadius: "var(--radius-btn)" }}
      {...props}
    >
      {colorDot && (
        <span
          aria-hidden
          className="inline-block w-2 h-2 rounded-full border border-primary/10 shrink-0"
          style={{ background: colorDot }}
        />
      )}
      {children}
    </button>
  );
}

/**
 * ChipGroup
 * ───────────────────────────────────────────────────────────────────────────
 * Conjunto de Chips multi-selección sobre una lista de opciones tipadas
 * (ver PrendaForms.tsx). `colorDot` opcional: Record<Opción, colorCSS> para
 * mostrar un puntito de color junto al label (usado en selector de Colores).
 */
interface ChipGroupProps<T extends string> {
  options: T[];
  selected: T[];
  onToggle: (value: T) => void;
  colorDot?: Record<T, string>;
  className?: string;
}

export function ChipGroup<T extends string>({
  options,
  selected,
  onToggle,
  colorDot,
  className,
}: ChipGroupProps<T>) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((opt) => (
        <Chip
          key={opt}
          active={selected.includes(opt)}
          colorDot={colorDot?.[opt]}
          onClick={() => onToggle(opt)}
        >
          {opt}
        </Chip>
      ))}
    </div>
  );
}
