"use client";

/**
 * SelectorMineralesMulti.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Chips + buscador para vincular N entidades de Minerales a una entidad de
 * Biología (hoy solo Ecosistema — Minerales no participa en cadenas
 * alimenticias). Clon exacto de SelectorCriaturasMulti (domains/garlia/
 * biologia), tipado a Mineral, icono Gem.
 */

import { Gem, Plus, Search, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useMineralesCatalogoMin } from "@/domains/garlia/minerales/useMineralesCatalogoMin";
import { useMineralesPorIds } from "@/domains/garlia/minerales/useMineralesPorIds";

export function SelectorMineralesMulti({
  ids,
  onChange,
  onSelectMineral,
  compacto = false,
  label = "Minerales",
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
  /** Se dispara al clickear el nombre de un mineral ya asignado. */
  onSelectMineral?: (id: string) => void;
  compacto?: boolean;
  label?: string;
}) {
  const { minerales: asignados, loading: loadingAsignados } = useMineralesPorIds(ids);
  const { minerales: catalogo, loading: loadingCatalogo } = useMineralesCatalogoMin();

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
        <BuscadorMineral
          catalogo={catalogo}
          excluirIds={ids}
          loading={loadingCatalogo}
          onSelect={agregar}
        />
      </div>

      {loadingAsignados ? (
        <p className="text-micro text-primary/25 italic py-1">Cargando…</p>
      ) : asignados.length === 0 ? (
        <p className="text-micro text-primary/25 italic py-1">Ningún mineral asignado todavía</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {asignados.map((m) => (
            <div
              key={m.id}
              className="group flex items-center gap-1.5 pl-1 pr-1 py-1 rounded-full border border-primary/10 bg-primary/[0.02] hover:border-primary/25 transition-colors"
            >
              <button
                type="button"
                title={m.nombre}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                onClick={() => onSelectMineral?.(m.id)}
              >
                <span
                  className="shrink-0 rounded-full overflow-hidden bg-primary/8 flex items-center justify-center"
                  style={{ width: size, height: size }}
                >
                  {m.imagen_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={m.nombre} className="w-full h-full object-cover" src={m.imagen_url} />
                  ) : (
                    <Gem size={iconSize} className="text-primary/25" />
                  )}
                </span>
                <span className="text-micro font-bold text-primary/70 truncate max-w-[120px]">
                  {m.nombre}
                </span>
              </button>
              <button
                type="button"
                title={`Quitar a ${m.nombre}`}
                className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-primary/25 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                onClick={() => quitar(m.id)}
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

function BuscadorMineral({
  catalogo,
  excluirIds,
  loading,
  onSelect,
}: {
  catalogo: { id: string; nombre: string; imagen_url: string | null }[];
  excluirIds: string[];
  loading: boolean;
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
        (m) => !excluirIds.includes(m.id) && m.nombre.toLowerCase().includes(search.toLowerCase()),
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
                placeholder="Buscar mineral…"
                style={{ color: "var(--primary)", caretColor: "var(--primary)" }}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && (setOpen(false), setSearch(""))}
              />
            </div>
            <div className="max-h-52 overflow-y-auto p-1">
              {loading ? (
                <p className="text-micro text-primary/25 italic text-center py-3">Cargando…</p>
              ) : disponibles.length === 0 ? (
                <p className="text-micro text-primary/25 italic text-center py-3">
                  {search ? "Sin resultados" : "No hay más minerales"}
                </p>
              ) : (
                disponibles.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-micro font-bold text-primary/75 hover:bg-primary/6 hover:text-primary transition-colors truncate"
                    onMouseDown={() => {
                      onSelect(m.id);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <span className="shrink-0 w-5 h-5 rounded-full overflow-hidden bg-primary/8 flex items-center justify-center">
                      {m.imagen_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt={m.nombre} className="w-full h-full object-cover" src={m.imagen_url} />
                      ) : (
                        <Gem size={9} className="text-primary/25" />
                      )}
                    </span>
                    <span className="truncate">{m.nombre}</span>
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
