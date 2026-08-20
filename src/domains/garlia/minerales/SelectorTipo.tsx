"use client";

/**
 * SelectorTipo.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Dropdown compacto para elegir un "tipo" de una lista fija de opciones con
 * icono — usado para tipo_organo y tipo_proceso. Mismo mecanismo de portal +
 * anti-clip que BuscadorFlora (SelectorFloraMulti.tsx), pero sin buscador de
 * texto porque las listas son cortas (6-8 opciones fijas).
 *
 * Sirve tanto para el flujo de "crear nuevo" (trigger tipo botón con label
 * fijo, ej. "Nuevo órgano") como para "cambiar tipo" de un registro ya
 * creado (trigger tipo chip con el valor actual, editable en el lugar).
 */

import { Check, ChevronDown, Plus as PlusIcon, type LucideIcon } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface OpcionTipo<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

export function SelectorTipo<T extends string>({
  opciones,
  valor,
  onSelect,
  variant = "chip",
  triggerLabel,
  disabled,
  title,
}: {
  opciones: OpcionTipo<T>[];
  /** Valor actual (variant "chip") o null si es un trigger de creación. */
  valor?: T | null;
  onSelect: (value: T) => void;
  /** "chip": muestra el valor actual y permite cambiarlo (para editar).
   *  "crear": botón con label fijo, para elegir tipo al crear un registro.
   *  "crear-compacto": botón "+" icon-only (mismo look que el "+" de
   *  Flora/Procesos), para elegir tipo al crear un registro sin ocupar
   *  espacio con texto. */
  variant?: "chip" | "crear" | "crear-compacto";
  /** Contenido del botón cuando variant="crear", ej. "+ Nuevo órgano". */
  triggerLabel?: React.ReactNode;
  disabled?: boolean;
  /** Tooltip del botón cuando variant="crear-compacto". */
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const actual = opciones.find((o) => o.value === valor) ?? null;
  const ActualIcon = actual?.icon;

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.max(r.width, 180);
      const espacioAbajo = window.innerHeight - r.bottom;
      const abreHaciaArriba = espacioAbajo < 240 && r.top > espacioAbajo;
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
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const abreHaciaArriba =
    pos != null && triggerRef.current
      ? pos.top < triggerRef.current.getBoundingClientRect().top
      : false;

  return (
    <>
      {variant === "crear" ? (
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-primary/10 hover:bg-primary/20 text-primary/70 hover:text-primary transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {triggerLabel}
          <ChevronDown size={12} className={`transition ${open ? "rotate-180" : ""}`} />
        </button>
      ) : variant === "crear-compacto" ? (
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          title={title}
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 mb-1 w-7 h-7 flex items-center justify-center rounded-md text-primary/50 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <PlusIcon size={16} />
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-primary/15 hover:border-primary/35 hover:bg-primary/5 transition-all text-micro font-bold text-primary/70 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {ActualIcon && <ActualIcon size={11} className="text-primary/50 shrink-0" />}
          <span className="capitalize">{actual?.label ?? "Elegir tipo"}</span>
          <ChevronDown size={10} className={`transition shrink-0 ${open ? "rotate-180" : ""}`} />
        </button>
      )}

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
            <div className="max-h-72 overflow-y-auto p-1">
              {opciones.map((o) => {
                const Icon = o.icon;
                const seleccionado = o.value === valor;
                return (
                  <button
                    key={o.value}
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-micro font-bold text-primary/75 hover:bg-primary/6 hover:text-primary transition-colors"
                    onMouseDown={() => {
                      onSelect(o.value);
                      setOpen(false);
                    }}
                  >
                    {seleccionado ? (
                      <Check size={12} className="text-accent shrink-0" />
                    ) : Icon ? (
                      <Icon size={12} className="text-primary/30 shrink-0" />
                    ) : (
                      <span className="w-3 shrink-0" />
                    )}
                    <span className="truncate capitalize">{o.label}</span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
