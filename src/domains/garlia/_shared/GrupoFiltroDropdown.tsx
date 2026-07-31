"use client";

/**
 * GrupoFiltroDropdown
 * ───────────────────────────────────────────────────────────────────────────
 * Dropdown reutilizable para las barras superiores de las vistas jerárquicas
 * (GeografiaJerarquica, MagiaJerarquica, grid de Items…). Se usa uno por
 * cada subtipo de grupo del tipo correspondiente ("personajes", "criaturas",
 * "items"…): el botón muestra el subtipo (o el nombre del grupo elegido) y
 * al abrirse deja elegir entre "Todos" o alguno de los grupos de ese
 * subtipo. La selección la controla el padre (un solo grupo activo a la vez,
 * cualquiera sea su subtipo).
 */

import { ChevronDown } from "lucide-react";
import React, { useLayoutEffect, useRef, useState } from "react";

export interface GrupoFiltroItem {
  id: string;
  nombre: string;
  miembro_ids: string[];
}

export interface GrupoFiltroSubtipo {
  subtipo: string | null;
  grupos: GrupoFiltroItem[];
}

export function GrupoFiltroDropdown({
  subtipo,
  grupos,
  selectedId,
  onSelect,
}: {
  subtipo: string | null;
  grupos: GrupoFiltroItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const seleccionado = grupos.find((g) => g.id === selectedId) ?? null;

  useLayoutEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={subtipo ?? "Sin subtipo"}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-micro font-bold uppercase tracking-wide transition-colors max-w-[160px] ${
          seleccionado
            ? "bg-accent/15 text-accent border border-accent/25"
            : "bg-primary/10 hover:bg-primary/20 text-primary/70 border border-primary/15"
        }`}
      >
        <span className="truncate">
          {seleccionado ? seleccionado.nombre : (subtipo ?? "Sin subtipo")}
        </span>
        <ChevronDown size={10} className="shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 min-w-[180px] max-w-[260px] rounded-lg border border-primary/10 bg-[var(--card,_#1a1a1a)] shadow-lg overflow-hidden py-1">
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
            className={`w-full text-left px-3 py-1.5 text-micro font-semibold truncate transition-colors ${
              !seleccionado ? "text-accent bg-accent/10" : "text-primary/50 hover:bg-primary/5"
            }`}
          >
            Todos
          </button>
          {grupos.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                onSelect(g.id);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-micro font-semibold truncate transition-colors ${
                selectedId === g.id ? "text-accent bg-accent/10" : "text-primary/70 hover:bg-primary/5"
              }`}
            >
              {g.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Barra horizontal con un dropdown por subtipo — evita repetir el `.map`
 *  y el `flex flex-wrap` en cada vista jerárquica que la usa. */
export function GrupoFiltroBarra({
  bloques,
  grupoSeleccionadoId,
  onSeleccionarGrupo,
}: {
  bloques: GrupoFiltroSubtipo[] | undefined;
  grupoSeleccionadoId: string | null | undefined;
  onSeleccionarGrupo: ((grupoId: string | null) => void) | undefined;
}) {
  if (!bloques || bloques.length === 0) return <div className="flex-1" />;
  return (
    <div className="flex-1 flex items-center gap-2 flex-wrap">
      {bloques.map((bloque) => (
        <GrupoFiltroDropdown
          key={bloque.subtipo ?? "__sin-subtipo"}
          subtipo={bloque.subtipo}
          grupos={bloque.grupos}
          selectedId={
            bloque.grupos.some((g) => g.id === grupoSeleccionadoId)
              ? (grupoSeleccionadoId ?? null)
              : null
          }
          onSelect={(id) => onSeleccionarGrupo?.(id)}
        />
      ))}
    </div>
  );
}
