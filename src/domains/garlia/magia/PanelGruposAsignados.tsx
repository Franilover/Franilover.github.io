"use client";

/**
 * PanelGruposAsignados.tsx
 * ──────────────────────────
 * `ChipGrupo`           — chip compacto de un grupo asignado, con botón de
 *                          quitar y (opcional) click para navegar al grupo.
 * `SelectorAgregarGrupo` — chip "+" que abre un dropdown de búsqueda para
 *                           añadir grupos, anclado al mismo flujo de chips.
 * `PanelGruposAsignados` — compone los dos anteriores en una sola fila que
 *                           envuelve (flex-wrap), sin tarjetas ni bordes
 *                           pesados — los grupos son etiquetas, no entidades.
 *
 * Los tres reciben todo por props, no fetchean nada.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/magia/PanelGruposAsignados.tsx
 */

import { Check, Layers, Loader2, Plus, Search, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { type GrupoMin } from "./types";

// ─── ChipGrupo ─────────────────────────────────────────────────────────────────

function ChipGrupo({
  grupo,
  onQuitar,
  onNavigate,
  color,
  labelMiembros = "criaturas",
}: {
  grupo: GrupoMin;
  onQuitar: () => void;
  onNavigate?: () => void;
  color: string;
  /** Texto tras el conteo de miembros, ej. "criaturas" o "runas" */
  labelMiembros?: string;
}) {
  return (
    <div
      className="group/chip flex items-center gap-1 pl-2 pr-1 py-1 rounded-full border transition-colors"
      style={{
        borderColor: `color-mix(in srgb, ${color} 18%, transparent)`,
        background: `color-mix(in srgb, ${color} 5%, transparent)`,
      }}
    >
      <button
        type="button"
        className="flex items-center gap-1.5 min-w-0 disabled:cursor-default"
        disabled={!onNavigate}
        title={onNavigate ? "Abrir grupo" : undefined}
        onClick={onNavigate}
      >
        <span
          className={`text-micro font-bold text-primary/80 truncate max-w-[10rem] ${onNavigate ? "group-hover/chip:underline" : ""}`}
        >
          {grupo.nombre}
        </span>
        <span className="text-micro text-primary/30 shrink-0">
          {grupo.miembro_ids.length}
        </span>
      </button>
      <button
        className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-primary/20 hover:text-red-400 hover:bg-red-400/10 transition-all"
        title={`Quitar de ${labelMiembros}`}
        onClick={onQuitar}
      >
        <X size={8} />
      </button>
    </div>
  );
}

// ─── SelectorAgregarGrupo ───────────────────────────────────────────────────────

function SelectorAgregarGrupo({
  grupos,
  loadingGrupos,
  asignados,
  onAgregar,
  color,
  textoBoton = "Agregar grupo de criaturas",
  placeholderBusqueda = "Buscar grupo…",
  labelMiembros = "criaturas",
}: {
  grupos: GrupoMin[];
  loadingGrupos: boolean;
  asignados: string[];
  onAgregar: (g: GrupoMin) => void;
  color: string;
  textoBoton?: string;
  placeholderBusqueda?: string;
  labelMiembros?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const disponibles = useMemo(
    () =>
      grupos.filter(
        (g) =>
          !asignados.includes(g.id) &&
          g.nombre.toLowerCase().includes(search.toLowerCase()),
      ),
    [grupos, asignados, search],
  );

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        className="flex items-center gap-1 pl-1.5 pr-2.5 py-1 rounded-full border border-dashed text-micro font-bold transition-colors"
        style={{
          borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
          color: `color-mix(in srgb, ${color} 55%, transparent)`,
        }}
        type="button"
        title={textoBoton}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = `color-mix(in srgb, ${color} 7%, transparent)`;
          (e.currentTarget as HTMLElement).style.color = color;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = `color-mix(in srgb, ${color} 55%, transparent)`;
        }}
      >
        <Plus size={10} /> Grupo
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpen(false);
              setSearch("");
            }}
          />
          <div
            className="absolute z-50 top-full left-0 mt-1.5 w-64 rounded-xl border overflow-hidden shadow-xl"
            style={{
              background: "var(--bg-main)",
              borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            <div
              className="p-2 border-b"
              style={{ borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)" }}
            >
              <div className="relative">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-primary/25"
                  size={9}
                />
                <input
                  autoFocus
                  className="w-full bg-primary/5 border border-primary/10 rounded-lg pl-7 pr-2 py-1.5 text-micro outline-none focus:border-primary/25 text-primary placeholder:text-primary/25"
                  placeholder={placeholderBusqueda}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto p-1">
              {loadingGrupos ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="animate-spin text-primary/20" size={14} />
                </div>
              ) : disponibles.length === 0 ? (
                <p className="text-micro text-primary/25 text-center py-4 italic">
                  {grupos.length === asignados.length
                    ? "Todos los grupos ya están asignados"
                    : "Sin resultados"}
                </p>
              ) : (
                disponibles.map((g) => (
                  <button
                    key={g.id}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left hover:bg-primary/6 transition-colors"
                    onMouseDown={() => {
                      onAgregar(g);
                      setSearch("");
                    }}
                  >
                    <Layers className="shrink-0 text-primary/25" size={10} />
                    <span className="flex-1 min-w-0 text-micro font-medium text-primary/80 truncate">
                      {g.nombre}
                    </span>
                    <span className="text-micro text-primary/30 shrink-0">
                      {g.miembro_ids.length} {labelMiembros}
                    </span>
                    <Check className="shrink-0 text-primary/15" size={9} />
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── PanelGruposAsignados ───────────────────────────────────────────────────────

export function PanelGruposAsignados({
  grupoIds,
  onGrupoIdsChange,
  grupos,
  loadingGrupos,
  color,
  label = "Grupos de criaturas que pueden usarlo",
  textoBoton = "Agregar grupo de criaturas",
  placeholderBusqueda = "Buscar grupo…",
  labelMiembros = "criaturas",
  mensajeVacio = "Sin grupos asignados — estará disponible para todos (universal)",
  onNavigateGrupo,
}: {
  entidadId: string;
  modo: string;
  grupoIds: string[];
  onGrupoIdsChange: (ids: string[]) => void;
  grupos: GrupoMin[];
  loadingGrupos: boolean;
  color: string;
  /** Título del panel. Por defecto asume el caso hechizos/dones (grupos de criaturas). */
  label?: string;
  /** Texto del botón para agregar un grupo. */
  textoBoton?: string;
  /** Placeholder del buscador del dropdown. */
  placeholderBusqueda?: string;
  /** Sufijo tras el conteo de miembros de cada grupo (ej. "criaturas", "runas"). */
  labelMiembros?: string;
  /** Mensaje cuando no hay grupos asignados todavía. */
  mensajeVacio?: string;
  /** Si se pasa, el nombre de cada grupo asignado navega a su editor. */
  onNavigateGrupo?: (id: string) => void;
}) {
  const asignados = useMemo(
    () => grupos.filter((g) => grupoIds.includes(g.id)),
    [grupos, grupoIds],
  );

  const agregar = (g: GrupoMin) => {
    if (grupoIds.includes(g.id)) return;
    onGrupoIdsChange([...grupoIds, g.id]);
  };

  const quitar = (grupoId: string) => {
    onGrupoIdsChange(grupoIds.filter((id) => id !== grupoId));
  };

  return (
    <div className="space-y-1.5">
      <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/30 flex items-center gap-1.5">
        <Layers size={9} /> {label}
      </label>

      {loadingGrupos ? (
        <div className="flex items-center gap-2 py-1.5">
          <Loader2 className="animate-spin text-primary/20" size={11} />
          <span className="text-micro text-primary/25 italic">Cargando grupos…</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {asignados.length === 0 && (
            <p className="text-micro text-primary/20 italic py-1">{mensajeVacio}</p>
          )}

          {asignados.map((g) => (
            <ChipGrupo
              key={g.id}
              color={color}
              grupo={g}
              labelMiembros={labelMiembros}
              onNavigate={onNavigateGrupo ? () => onNavigateGrupo(g.id) : undefined}
              onQuitar={() => quitar(g.id)}
            />
          ))}

          <SelectorAgregarGrupo
            asignados={grupoIds}
            color={color}
            grupos={grupos}
            labelMiembros={labelMiembros}
            loadingGrupos={loadingGrupos}
            placeholderBusqueda={placeholderBusqueda}
            textoBoton={textoBoton}
            onAgregar={agregar}
          />
        </div>
      )}
    </div>
  );
}
