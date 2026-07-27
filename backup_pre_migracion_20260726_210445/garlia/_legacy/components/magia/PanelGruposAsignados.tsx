"use client";

/**
 * PanelGruposAsignados.tsx
 * ──────────────────────────
 * `FilaGrupo` — una fila de grupo asignado, con botón de quitar
 * `SelectorAgregarGrupo` — dropdown de búsqueda para añadir grupos
 * `PanelGruposAsignados` — compone los dos anteriores
 *
 * Los tres reciben todo por props, no fetchean nada.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/magia/PanelGruposAsignados.tsx
 */

import { Check, Layers, Loader2, Plus, Search, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { type GrupoMin } from "./types";

// ─── FilaGrupo ─────────────────────────────────────────────────────────────────

function FilaGrupo({
  grupo,
  onQuitar,
  color,
}: {
  grupo: GrupoMin;
  onQuitar: () => void;
  color: string;
}) {
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        borderColor: `color-mix(in srgb, ${color} 20%, transparent)`,
        background: `color-mix(in srgb, ${color} 4%, transparent)`,
      }}
    >
      <div className="flex items-center gap-2.5 px-3 py-2">
        <div className="shrink-0 w-7 h-7 rounded-lg border border-primary/10 bg-primary/5 flex items-center justify-center">
          <Layers className="text-primary/30" size={11} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-micro font-bold text-primary/85 truncate block">
            {grupo.nombre}
          </span>
          <span className="text-micro text-primary/30">
            {grupo.miembro_ids.length} criaturas
          </span>
        </div>
        <button
          className="w-6 h-6 rounded-lg flex items-center justify-center text-primary/20 hover:text-red-400 hover:bg-red-400/10 transition-all"
          title="Quitar grupo"
          onClick={onQuitar}
        >
          <X size={10} />
        </button>
      </div>
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
}: {
  grupos: GrupoMin[];
  loadingGrupos: boolean;
  asignados: string[];
  onAgregar: (g: GrupoMin) => void;
  color: string;
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
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed text-micro font-black uppercase tracking-widest transition-all"
        style={{
          borderColor: `color-mix(in srgb, ${color} 22%, transparent)`,
          color: `color-mix(in srgb, ${color} 55%, transparent)`,
        }}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = `color-mix(in srgb, ${color} 6%, transparent)`;
          (e.currentTarget as HTMLElement).style.color = color;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = `color-mix(in srgb, ${color} 55%, transparent)`;
        }}
      >
        <Plus size={9} /> Agregar grupo de criaturas
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
            className="absolute z-50 top-full left-0 right-0 mt-1.5 rounded-xl border overflow-hidden shadow-xl"
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
                  placeholder="Buscar grupo…"
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
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-primary/6 transition-colors"
                    onMouseDown={() => {
                      onAgregar(g);
                      setSearch("");
                    }}
                  >
                    <div className="shrink-0 w-6 h-6 rounded-lg border border-primary/10 bg-primary/5 flex items-center justify-center">
                      <Layers className="text-primary/25" size={10} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-micro font-medium text-primary/80 truncate block">
                        {g.nombre}
                      </span>
                      <span className="text-micro text-primary/30">
                        {g.miembro_ids.length} criaturas
                      </span>
                    </div>
                    <Check className="text-primary/15" size={9} />
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
}: {
  entidadId: string;
  modo: string;
  grupoIds: string[];
  onGrupoIdsChange: (ids: string[]) => void;
  grupos: GrupoMin[];
  loadingGrupos: boolean;
  color: string;
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
    <div className="space-y-2">
      <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35 flex items-center gap-1.5">
        <Layers size={9} /> Grupos de criaturas que pueden usarlo
      </label>

      {loadingGrupos ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="animate-spin text-primary/20" size={11} />
          <span className="text-micro text-primary/25 italic">Cargando grupos…</span>
        </div>
      ) : (
        <div className="space-y-2">
          {asignados.length === 0 && (
            <p className="text-micro text-primary/20 italic px-1">
              Sin grupos asignados — estará disponible para todos (universal)
            </p>
          )}

          {asignados.map((g) => (
            <FilaGrupo key={g.id} color={color} grupo={g} onQuitar={() => quitar(g.id)} />
          ))}

          <SelectorAgregarGrupo
            asignados={grupoIds}
            color={color}
            grupos={grupos}
            loadingGrupos={loadingGrupos}
            onAgregar={agregar}
          />
        </div>
      )}
    </div>
  );
}
