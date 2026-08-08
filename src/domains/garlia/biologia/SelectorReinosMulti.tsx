"use client";

/**
 * SelectorReinosMulti.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Chips + buscador para vincular N reinos a un Bioma (M:N). Mismo patrón
 * visual que SelectorCriaturasMulti/SelectorMineralesMulti, pero resuelve
 * contra useReinosMin() — que a diferencia de los catálogos "Min" de
 * criaturas/flora/minerales es síncrono (array plano, sin {data, loading}),
 * así que acá no hay estado de loading para el catálogo ni para los
 * asignados: se derivan directo del array con useMemo.
 */

import { Compass, Plus, Search, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useReinosMin } from "@/domains/garlia/reinos/useReinosMin";

export function SelectorReinosMulti({
  ids,
  onChange,
  onSelectReino,
  compacto = false,
  label = "Reinos",
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
  /** Se dispara al clickear el nombre de un reino ya asignado. */
  onSelectReino?: (id: string) => void;
  compacto?: boolean;
  label?: string;
}) {
  const catalogo = useReinosMin();
  const asignados = useMemo(
    () => ids.map((id) => catalogo.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r),
    [ids, catalogo],
  );

  const agregar = (id: string) => {
    if (ids.includes(id)) return;
    onChange([...ids, id]);
  };
  const quitar = (id: string) => {
    onChange(ids.filter((x) => x !== id));
  };

  const size = compacto ? 16 : 20;
  const iconSize = compacto ? 8 : 9;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
          {label}
        </span>
        <BuscadorReino catalogo={catalogo} excluirIds={ids} onSelect={agregar} />
      </div>

      {asignados.length === 0 ? (
        <p className="text-micro text-primary/25 italic py-1">Ningún reino asignado todavía</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {asignados.map((r) => (
            <div
              key={r.id}
              className="group flex items-center gap-1.5 pl-1 pr-1 py-1 rounded-full border border-primary/10 bg-primary/[0.02] hover:border-primary/25 transition-colors"
            >
              <button
                type="button"
                title={r.nombre}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                onClick={() => onSelectReino?.(r.id)}
              >
                <span
                  className="shrink-0 rounded-full overflow-hidden bg-primary/8 flex items-center justify-center"
                  style={{ width: size, height: size }}
                >
                  <Compass size={iconSize} className="text-primary/25" />
                </span>
                <span className="text-micro font-bold text-primary/70 truncate max-w-[120px]">
                  {r.nombre}
                </span>
              </button>
              <button
                type="button"
                title={`Quitar a ${r.nombre}`}
                className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-primary/25 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                onClick={() => quitar(r.id)}
              >
                <X size={9} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Buscador (dropdown en portal, mismo mecanismo anti-clip que en runas) ──

function BuscadorReino({
  catalogo,
  excluirIds,
  onSelect,
}: {
  catalogo: { id: string; nombre: string }[];
  excluirIds: string[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const disponibles = useMemo(
    () =>
      catalogo.filter(
        (r) => !excluirIds.includes(r.id) && r.nombre.toLowerCase().includes(search.toLowerCase()),
      ),
    [catalogo, excluirIds, search],
  );

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.max(r.width, 224);
      const espacioAbajo = window.innerHeight - r.bottom;
      const abreHaciaArriba = espacioAbajo < 260 && r.top > espacioAbajo;
      setPos({
        left: Math.min(r.left, window.innerWidth - width - 8),
        top: abreHaciaArriba ? r.top - 4 : r.bottom + 4,
        width,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
      setSearch("");
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const abreHaciaArriba =
    pos != null && triggerRef.current ? pos.top < triggerRef.current.getBoundingClientRect().top : false;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed text-micro font-black uppercase tracking-widest transition-all"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
          color: "color-mix(in srgb, var(--primary) 35%, transparent)",
        }}
      >
        <Plus size={8} /> Añadir
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] rounded-xl border shadow-xl overflow-hidden"
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              transform: abreHaciaArriba ? "translateY(-100%)" : undefined,
              maxHeight: "min(320px, calc(100vh - 16px))",
              background: "var(--bg-main)",
              borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            <div
              className="flex items-center gap-2 px-3 py-2"
              style={{ borderBottom: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)" }}
            >
              <Search size={11} style={{ color: "color-mix(in srgb, var(--primary) 30%, transparent)", flexShrink: 0 }} />
              <input
                autoFocus
                className="flex-1 bg-transparent outline-none text-micro font-bold uppercase tracking-wide placeholder:normal-case placeholder:font-medium placeholder:tracking-normal"
                placeholder="Buscar reino…"
                style={{ color: "var(--primary)", caretColor: "var(--primary)" }}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && (setOpen(false), setSearch(""))}
              />
            </div>
            <div className="max-h-52 overflow-y-auto p-1">
              {disponibles.length === 0 ? (
                <p className="text-micro text-primary/25 italic text-center py-3">
                  {search ? "Sin resultados" : "No hay más reinos"}
                </p>
              ) : (
                disponibles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-micro font-bold text-primary/75 hover:bg-primary/6 hover:text-primary transition-colors truncate"
                    onMouseDown={() => {
                      onSelect(r.id);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <span className="shrink-0 w-5 h-5 rounded-full overflow-hidden bg-primary/8 flex items-center justify-center">
                      <Compass size={9} className="text-primary/25" />
                    </span>
                    <span className="truncate">{r.nombre}</span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
