"use client";

/**
 * DescargarDatosDropdown
 * ───────────────────────────────────────────────────────────────────────────
 * Ícono compacto (sin texto) que se ubica pegado a la izquierda del botón
 * "Añadir" en cada vista jerárquica (Reino, Criatura, Items). Al hacer click
 * despliega un menú para elegir qué dataset descargar (Items / Criaturas /
 * Personajes) en vez de depender de en qué vista está parado el usuario.
 *
 * Mismo patrón visual que AñadirDropdown (botón + menú flotante con
 * click-outside-to-close), pero como icon-button solo.
 */

import { Box, ChevronDown, Download, PawPrint, Users } from "lucide-react";
import React, { useLayoutEffect, useRef, useState } from "react";

export interface DescargarDatosDropdownProps {
  onDescargarItems?: () => void;
  onDescargarCriaturas?: () => void;
  onDescargarPersonajes?: () => void;
}

export function DescargarDatosDropdown({
  onDescargarItems,
  onDescargarCriaturas,
  onDescargarPersonajes,
}: DescargarDatosDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const opciones: {
    key: string;
    label: string;
    Icon: React.ElementType;
    onClick?: () => void;
  }[] = [
    { key: "items", label: "Items", Icon: Box, onClick: onDescargarItems },
    { key: "criaturas", label: "Criaturas", Icon: PawPrint, onClick: onDescargarCriaturas },
    { key: "personajes", label: "Personajes", Icon: Users, onClick: onDescargarPersonajes },
  ].filter((o) => o.onClick);

  if (opciones.length === 0) return null;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Descargar datos…"
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-primary/[0.04] border border-primary/10 hover:bg-primary/10 transition-colors text-primary/50 hover:text-primary/80"
      >
        <Download size={13} />
        <ChevronDown size={10} className="shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 min-w-[180px] rounded-lg border border-primary/10 bg-[var(--card,_#1a1a1a)] shadow-lg overflow-hidden py-1">
          {opciones.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => {
                o.onClick?.();
                setOpen(false);
              }}
              className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 text-micro font-bold uppercase tracking-wide truncate transition-colors text-primary/70 hover:bg-primary/5"
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
