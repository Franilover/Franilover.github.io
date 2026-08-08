"use client";

/**
 * SelectorEcosistemasDeEntidad.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Edición INVERSA del vínculo Ecosistema ↔ Flora/Mineral: el vínculo real
 * vive en Ecosistema.flora_ids / mineral_ids (arrays en el ecosistema), no
 * en Flora/Mineral. Este selector se monta en FloraEditor/MineralEditor y
 * permite elegir en qué Ecosistema(s) vive esta entidad — por dentro,
 * actualiza el array correspondiente de cada Ecosistema afectado.
 *
 * Mismo lenguaje visual que SelectorFloraMulti/SelectorCriaturasMulti
 * (chips + buscador en portal), pero resolviendo la relación al revés.
 */

import { Leaf, Plus, Search, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useEcosistemas } from "@/domains/garlia/biologia/useBiologia";

type Campo = "flora_ids" | "mineral_ids";

export function SelectorEcosistemasDeEntidad({
  entidadId,
  campo,
  onSelectEcosistema,
  label = "Ecosistemas",
}: {
  /** id de la Flora o Mineral que se está editando. */
  entidadId: string;
  /** Qué array del Ecosistema contiene esta entidad. */
  campo: Campo;
  /** Se dispara al clickear el nombre de un ecosistema ya asignado. */
  onSelectEcosistema?: (id: string) => void;
  label?: string;
}) {
  const { ecosistemas, loading, actualizar } = useEcosistemas();

  const asignados = useMemo(
    () => ecosistemas.filter((e) => (e[campo] ?? []).includes(entidadId)),
    [ecosistemas, campo, entidadId],
  );
  const disponibles = useMemo(
    () => ecosistemas.filter((e) => !(e[campo] ?? []).includes(entidadId)),
    [ecosistemas, campo, entidadId],
  );

  const agregar = (ecosistemaId: string) => {
    const eco = ecosistemas.find((e) => e.id === ecosistemaId);
    if (!eco) return;
    const actuales = eco[campo] ?? [];
    if (actuales.includes(entidadId)) return;
    void actualizar(ecosistemaId, { [campo]: [...actuales, entidadId] } as any);
  };

  const quitar = (ecosistemaId: string) => {
    const eco = ecosistemas.find((e) => e.id === ecosistemaId);
    if (!eco) return;
    const actuales = eco[campo] ?? [];
    void actualizar(ecosistemaId, {
      [campo]: actuales.filter((id) => id !== entidadId),
    } as any);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
          {label}
        </span>
        <BuscadorEcosistema disponibles={disponibles} loading={loading} onSelect={agregar} />
      </div>

      {loading ? (
        <p className="text-micro text-primary/25 italic py-1">Cargando…</p>
      ) : asignados.length === 0 ? (
        <p className="text-micro text-primary/25 italic py-1">Sin ecosistema asignado todavía</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {asignados.map((eco) => (
            <div
              key={eco.id}
              className="group flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full border border-primary/10 bg-primary/[0.02] hover:border-primary/25 transition-colors"
            >
              <button
                type="button"
                title={eco.nombre}
                className="text-micro font-bold text-primary/70 truncate max-w-[140px] hover:opacity-80 transition-opacity"
                onClick={() => onSelectEcosistema?.(eco.id)}
              >
                {eco.nombre}
              </button>
              <button
                type="button"
                title={`Quitar de ${eco.nombre}`}
                className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-primary/25 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                onClick={() => quitar(eco.id)}
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

// ─── Buscador (dropdown en portal, mismo mecanismo anti-clip que en biologia) ──

function BuscadorEcosistema({
  disponibles,
  loading,
  onSelect,
}: {
  disponibles: { id: string; nombre: string }[];
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const filtrados = useMemo(
    () => disponibles.filter((e) => e.nombre.toLowerCase().includes(search.toLowerCase())),
    [disponibles, search],
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
                placeholder="Buscar ecosistema…"
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
              ) : filtrados.length === 0 ? (
                <p className="text-micro text-primary/25 italic text-center py-3">
                  {search ? "Sin resultados" : "No hay más ecosistemas"}
                </p>
              ) : (
                filtrados.map((eco) => (
                  <button
                    key={eco.id}
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-micro font-bold text-primary/75 hover:bg-primary/6 hover:text-primary transition-colors truncate"
                    onMouseDown={() => {
                      onSelect(eco.id);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Leaf size={9} className="text-primary/25 shrink-0" />
                    <span className="truncate">{eco.nombre}</span>
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
