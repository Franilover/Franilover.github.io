"use client";

/**
 * BloqueSubsistemaMagicoCriatura.tsx
 * ────────────────────────────────────
 * Combo-selector de un único subsistema mágico (Luminia, Sintonía,
 * Litonio…) para una criatura — mismo look & feel que
 * `BloqueGrupoCategoria` (Clasificación), pero:
 *   - selección única (una criatura pertenece a un solo subsistema)
 *   - sin subtipo: la lista es directamente `todosSubsistemas`
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/criaturas/BloqueSubsistemaMagicoCriatura.tsx
 */

import { ChevronDown, Pencil, Search, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { type SubsistemaMin } from "@/domains/garlia/criaturas/useMembresiaSubsistemaCriatura";

export function BloqueSubsistemaMagicoCriatura({
  subsistemaActual,
  todosSubsistemas,
  onChange,
  onSelectSubsistema,
}: {
  subsistemaActual: SubsistemaMin | null;
  todosSubsistemas: SubsistemaMin[];
  onChange: (subsistemaId: string | null) => void;
  onSelectSubsistema?: (subsistemaId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const disponibles = todosSubsistemas.filter(
    (s) =>
      s.id !== subsistemaActual?.id &&
      s.nombre.toLowerCase().includes(search.toLowerCase()),
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
      {subsistemaActual ? (
        <div
          className="w-full flex items-center rounded-[var(--radius-btn)] overflow-hidden transition-all"
          style={{
            background: "color-mix(in srgb, var(--primary) 5%, transparent)",
            border,
          }}
        >
          <button
            className="flex-1 flex items-center gap-2 px-3 py-2 text-micro font-black uppercase truncate transition-all hover:bg-primary/5 min-w-0"
            style={{ color: "var(--primary)" }}
            title="Ir al subsistema"
            type="button"
            onClick={() => onSelectSubsistema?.(subsistemaActual.id)}
          >
            <span className="truncate">{subsistemaActual.nombre}</span>
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
      ) : (
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
            {subsistemaActual && (
              <button
                className="w-full flex items-center gap-2 px-4 py-2.5 text-micro font-bold uppercase transition-all hover:bg-primary/5"
                style={{
                  color: "color-mix(in srgb, var(--primary) 45%, transparent)",
                }}
                type="button"
                onMouseDown={() => {
                  onChange(null);
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

            {todosSubsistemas.length === 0 ? (
              <p className="text-micro text-primary/30 px-4 py-3 font-bold uppercase">
                No hay subsistemas mágicos creados
              </p>
            ) : disponibles.length === 0 && !subsistemaActual ? (
              <p className="text-micro text-primary/30 px-4 py-3 font-bold uppercase">
                {search ? `Sin resultados para "${search}"` : "Todos asignados"}
              </p>
            ) : (
              disponibles.map((s) => (
                <button
                  key={s.id}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-micro font-bold uppercase transition-all hover:bg-primary/6"
                  style={{
                    color: "color-mix(in srgb, var(--primary) 50%, transparent)",
                  }}
                  type="button"
                  onMouseDown={() => {
                    onChange(s.id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <span className="truncate">{s.nombre}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
