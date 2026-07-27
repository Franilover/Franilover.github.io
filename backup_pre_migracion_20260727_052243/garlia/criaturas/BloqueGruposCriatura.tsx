"use client";

/**
 * BloqueGruposCriatura.tsx
 * ─────────────────────────
 * `BloqueGrupoCategoria` — selector de un grupo por subtipo (Hábitat, Inteligencia…)
 * `BloqueGruposCriatura` — chips + dropdown de grupos generales
 *
 * Ambos reciben sus datos por props: no fetchean ni tienen lógica de dominio.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/criaturas/BloqueGruposCriatura.tsx
 */

import { ChevronDown, Layers, Pencil, Plus, Search, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { type GrupoMin } from "@/domains/garlia/grupos/useMembresiaGruposCriatura";

// ─── Tipo extendido (GrupoMin + subtipo) ──────────────────────────────────────
export type GrupoMinExt = GrupoMin & { subtipo?: string | null };

// ─── BloqueGrupoCategoria ─────────────────────────────────────────────────────
// Selector de un único grupo dentro de un subtipo (Hábitat, Inteligencia, etc.)

export function BloqueGrupoCategoria({
  label,
  subtipo,
  icon: Icon,
  gruposActuales,
  todosGrupos,
  onAdd,
  onRemove,
  onSelectGrupo,
}: {
  label: string;
  subtipo: string;
  icon: React.ElementType;
  gruposActuales: GrupoMinExt[];
  todosGrupos: GrupoMinExt[];
  onAdd: (grupoId: string) => void;
  onRemove: (grupoId: string) => void;
  onSelectGrupo?: (grupoId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const gruposDeCat = todosGrupos.filter((g) => g.subtipo === subtipo);
  const actual = gruposActuales.filter((g) =>
    gruposDeCat.some((c) => c.id === g.id),
  );
  const disponibles = gruposDeCat.filter(
    (g) =>
      !gruposActuales.some((a) => a.id === g.id) &&
      g.nombre.toLowerCase().includes(search.toLowerCase()),
  );

  const border =
    "1px solid color-mix(in srgb, var(--primary) 15%, transparent)";
  const borderFocus =
    "1px solid color-mix(in srgb, var(--primary) 35%, transparent)";

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={containerRef} className="space-y-1.5">
      {actual.length > 0 && (
        <div className="flex flex-col gap-1">
          {actual.map((g) => (
            <div
              key={g.id}
              className="w-full flex items-center rounded-[var(--radius-btn)] overflow-hidden transition-all"
              style={{
                background:
                  "color-mix(in srgb, var(--primary) 5%, transparent)",
                border,
              }}
            >
              <button
                className="flex-1 flex items-center gap-2 px-3 py-2 text-micro font-black uppercase truncate transition-all hover:bg-primary/5 min-w-0"
                style={{ color: "var(--primary)" }}
                title="Ir al grupo"
                type="button"
                onClick={() => onSelectGrupo?.(g.id)}
              >
                <span className="truncate">{g.nombre}</span>
              </button>
              <button
                className="shrink-0 flex items-center justify-center px-2.5 py-2 transition-all hover:bg-primary/10"
                style={{
                  borderLeft:
                    "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                  color: "color-mix(in srgb, var(--primary) 35%, transparent)",
                }}
                title="Cambiar"
                type="button"
                onClick={() => {
                  setOpen((o) => !o);
                  setSearch("");
                }}
              >
                <Pencil size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {actual.length === 0 && (
        <button
          className="w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius-btn)] text-micro font-bold transition-all"
          style={{
            background: "color-mix(in srgb, var(--primary) 5%, transparent)",
            border: open ? borderFocus : border,
            color: "color-mix(in srgb, var(--primary) 40%, transparent)",
          }}
          type="button"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="font-black uppercase text-micro tracking-wide">
            Sin asignar
          </span>
          <ChevronDown
            className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            size={12}
            style={{ opacity: 0.5 }}
          />
        </button>
      )}

      {open && (
        <div
          className="rounded-[var(--radius-btn)] overflow-hidden"
          style={{
            border,
            background: "var(--bg-main)",
            boxShadow:
              "0 8px 24px color-mix(in srgb, var(--primary) 10%, transparent)",
          }}
        >
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{
              borderBottom:
                "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
            }}
          >
            <Search
              size={11}
              style={{
                color: "color-mix(in srgb, var(--primary) 30%, transparent)",
                flexShrink: 0,
              }}
            />
            <input
              autoFocus
              className="flex-1 bg-transparent outline-none text-micro font-bold uppercase tracking-wide placeholder:normal-case placeholder:font-medium placeholder:tracking-normal"
              placeholder="Buscar…"
              style={{ color: "var(--primary)", caretColor: "var(--primary)" }}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Escape" && (setOpen(false), setSearch(""))
              }
            />
            {search && (
              <button
                className="opacity-30 hover:opacity-70 transition-opacity"
                type="button"
                onClick={() => setSearch("")}
              >
                <X size={10} style={{ color: "var(--primary)" }} />
              </button>
            )}
          </div>

          <div className="max-h-48 overflow-y-auto">
            {actual.length > 0 && (
              <button
                className="w-full flex items-center gap-2 px-4 py-2.5 text-micro font-bold uppercase transition-all hover:bg-primary/5"
                style={{
                  color: "color-mix(in srgb, var(--primary) 45%, transparent)",
                }}
                type="button"
                onMouseDown={() => {
                  actual.forEach((g) => onRemove(g.id));
                  setOpen(false);
                  setSearch("");
                }}
              >
                <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                  <X className="opacity-50" size={9} />
                </span>
                Sin asignar
              </button>
            )}

            {gruposDeCat.length === 0 ? (
              <p className="text-micro text-primary/30 px-4 py-3 font-bold uppercase">
                No hay grupos de «{label}» creados
              </p>
            ) : disponibles.length === 0 && actual.length === 0 ? (
              <p className="text-micro text-primary/30 px-4 py-3 font-bold uppercase">
                {search ? `Sin resultados para "${search}"` : "Todos asignados"}
              </p>
            ) : (
              disponibles.map((g) => (
                <button
                  key={g.id}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-micro font-bold uppercase transition-all hover:bg-primary/6"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 50%, transparent)",
                  }}
                  type="button"
                  onMouseDown={() => {
                    onAdd(g.id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <span className="truncate">{g.nombre}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BloqueGruposCriatura ─────────────────────────────────────────────────────
// Chips de grupos generales + dropdown para añadir/quitar.

export function BloqueGruposCriatura({
  gruposActuales,
  todosGrupos,
  onAdd,
  onRemove,
  onSelectGrupo,
}: {
  gruposActuales: GrupoMin[];
  todosGrupos: GrupoMin[];
  onAdd: (grupoId: string) => void;
  onRemove: (grupoId: string) => void;
  onSelectGrupo?: (grupoId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const disponibles = useMemo(
    () =>
      todosGrupos.filter(
        (g) =>
          !gruposActuales.some((a) => a.id === g.id) &&
          g.nombre.toLowerCase().includes(search.toLowerCase()),
      ),
    [todosGrupos, gruposActuales, search],
  );

  if (todosGrupos.length === 0) return null;

  return (
    <div className="space-y-2">
      <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/30 flex items-center gap-1">
        <Layers size={9} /> Grupos
      </label>

      {gruposActuales.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {gruposActuales.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg border text-micro font-bold"
              style={{
                background:
                  "color-mix(in srgb, var(--primary) 6%, transparent)",
                borderColor:
                  "color-mix(in srgb, var(--primary) 15%, transparent)",
                color: "var(--primary)",
              }}
            >
              <button
                className="hover:underline cursor-pointer text-left leading-none"
                title="Ir al grupo"
                type="button"
                onClick={() => onSelectGrupo?.(g.id)}
              >
                {g.nombre}
              </button>
              <button
                className="w-3.5 h-3.5 rounded flex items-center justify-center text-primary/30 hover:text-red-400 transition-colors cursor-pointer"
                type="button"
                onClick={() => onRemove(g.id)}
              >
                <X size={8} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <button
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed text-micro font-black uppercase tracking-widest transition-all cursor-pointer"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
            color: "color-mix(in srgb, var(--primary) 35%, transparent)",
          }}
          type="button"
          onClick={() => setOpen((o) => !o)}
        >
          <Plus size={8} /> Añadir a grupo
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
              className="absolute z-50 top-full left-0 mt-1 w-52 rounded-xl border shadow-xl overflow-hidden"
              style={{
                background: "var(--bg-main)",
                borderColor:
                  "color-mix(in srgb, var(--primary) 12%, transparent)",
              }}
            >
              <div
                className="p-1.5 border-b"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--primary) 8%, transparent)",
                }}
              >
                <input
                  autoFocus
                  className="w-full bg-transparent text-micro text-primary outline-none placeholder:text-primary/30 px-1.5 py-0.5"
                  placeholder="Buscar grupo…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="max-h-44 overflow-y-auto p-1">
                {disponibles.length === 0 ? (
                  <p className="text-micro text-primary/25 italic text-center py-3">
                    {search ? "Sin resultados" : "Ya está en todos los grupos"}
                  </p>
                ) : (
                  disponibles.map((g) => (
                    <button
                      key={g.id}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-micro font-medium text-primary/75 hover:bg-primary/6 hover:text-primary transition-colors truncate cursor-pointer"
                      type="button"
                      onMouseDown={() => {
                        onAdd(g.id);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      {g.nombre}
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
