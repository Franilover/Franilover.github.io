"use client";

/**
 * SelectorOris.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Picker compacto para elegir un Oris real (tabla "oris", dominio Física)
 * como valor del campo "canaliza" en Canales/Filtros de un Subsistema de
 * Magia. Antes ese campo era texto libre (cualquier string a mano); ahora
 * guarda el `id` del Oris elegido — sigue siendo un string dentro del jsonb
 * de la fila, así que no hace falta migrar el schema de Supabase, pero el
 * dato ahora es una referencia real en vez de texto suelto.
 *
 * Con solo 9 Oris fijos (catálogo chico y estable, ver fisica/types.ts) no
 * hace falta un buscador con creación como SelectorCompuesto — un dropdown
 * simple agrupado por familia alcanza y es más rápido de usar acá, donde
 * el campo vive dentro de una fila angosta de tabla.
 */

import { Check, ChevronDown, Sparkle, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ORIS_FAMILIAS, type Oris } from "@/domains/garlia/fisica/types";

interface Props {
  oris: Oris[];
  orisId: string | null;
  onChange: (orisId: string | null) => void;
}

export function SelectorOris({ oris, orisId, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const elegido = useMemo(() => oris.find((o) => o.id === orisId) ?? null, [oris, orisId]);

  const porFamilia = useMemo(() => {
    const grupos = new Map<string, Oris[]>();
    for (const fam of ORIS_FAMILIAS) grupos.set(fam, []);
    for (const o of oris) {
      const lista = grupos.get(o.familia) ?? [];
      lista.push(o);
      grupos.set(o.familia, lista);
    }
    return grupos;
  }, [oris]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.max(r.width, 200);
      setPos({
        left: Math.min(r.left, window.innerWidth - width - 8),
        top: r.bottom + 4,
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
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Qué Oris canaliza"
        className="min-w-0 w-full flex items-center gap-1 bg-transparent text-xs font-semibold outline-none px-1 py-0.5 rounded hover:bg-primary/5 focus:bg-primary/8 text-left"
        style={{ color: elegido ? "var(--accent, currentColor)" : undefined }}
      >
        <Sparkle size={9} className="shrink-0 text-accent/50" />
        <span className={`flex-1 min-w-0 truncate ${elegido ? "text-accent/80" : "text-primary/25 font-normal"}`}>
          {elegido ? elegido.nombre : "Canaliza (Oris)"}
        </span>
        {elegido ? (
          <span
            role="button"
            title="Quitar"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="shrink-0 text-primary/25 hover:text-red-400 transition-colors"
          >
            <X size={10} />
          </span>
        ) : (
          <ChevronDown size={10} className="shrink-0 text-primary/25" />
        )}
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
              maxHeight: "min(320px, calc(100vh - 16px))",
              background: "var(--bg-main)",
              borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            <div className="max-h-80 overflow-y-auto p-1">
              {oris.length === 0 ? (
                <p className="text-micro text-primary/25 italic text-center py-3">
                  Sin Oris en el catálogo todavía.
                </p>
              ) : (
                ORIS_FAMILIAS.map((fam) => {
                  const lista = porFamilia.get(fam) ?? [];
                  if (lista.length === 0) return null;
                  return (
                    <div key={fam} className="mb-1 last:mb-0">
                      <div className="px-2 pt-1.5 pb-0.5 text-micro font-black uppercase tracking-widest text-primary/30">
                        {fam}
                      </div>
                      {lista.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => {
                            onChange(o.id);
                            setOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                            o.id === orisId ? "bg-primary/8" : "hover:bg-primary/5"
                          }`}
                        >
                          {o.id === orisId ? (
                            <Check size={11} className="text-accent shrink-0" />
                          ) : (
                            <span className="w-[11px] shrink-0" />
                          )}
                          <span className="text-micro font-black text-primary/70 shrink-0">
                            {o.formula || "—"}
                          </span>
                          <span className="flex-1 min-w-0 truncate text-micro text-primary/60">
                            {o.nombre}
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
