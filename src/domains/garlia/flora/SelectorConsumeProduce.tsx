"use client";

/**
 * SelectorConsumeProduce.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Editor visual para PlantaProceso.consume / .produce — reemplaza el
 * textarea/JSON.stringify crudo de ProcesoCard por filas con:
 *   1. Toggle Elemento/Compuesto
 *   2. Buscador para elegir el id real (Elemento o Compuesto del catálogo)
 *   3. Stepper de cantidad
 * Mismo lenguaje visual que SelectorComposicionMultiple (filas en tarjeta +
 * botón "Agregar" con borde punteado).
 */

import { Beaker, Atom, Plus, Trash2 } from "lucide-react";
import React, { useMemo, useState } from "react";

import type { Compuesto, Elemento } from "@/domains/garlia/elementos/types";

export interface ItemProceso {
  tipo: "elemento" | "compuesto";
  id: string;
  cantidad: number;
}

export function SelectorConsumeProduce({
  label,
  items,
  onChange,
  elementos,
  compuestos,
}: {
  label: string;
  items: ItemProceso[];
  onChange: (items: ItemProceso[]) => void;
  elementos: Elemento[];
  compuestos: Compuesto[];
}) {
  function agregar() {
    const primero = elementos[0];
    if (!primero) return;
    onChange([...items, { tipo: "elemento", id: primero.id, cantidad: 1 }]);
  }

  function actualizar(idx: number, cambios: Partial<ItemProceso>) {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...cambios } : it)));
  }

  function quitar(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
        {label}
      </span>

      {items.length === 0 && (
        <p className="text-micro text-primary/25 italic">Nada definido todavía.</p>
      )}

      {items.map((item, idx) => (
        <FilaItemProceso
          key={idx}
          item={item}
          elementos={elementos}
          compuestos={compuestos}
          onChange={(cambios) => actualizar(idx, cambios)}
          onQuitar={() => quitar(idx)}
        />
      ))}

      <button
        type="button"
        onClick={agregar}
        disabled={elementos.length === 0}
        className="flex items-center justify-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-dashed border-primary/20 text-primary/50 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus size={10} />
        Agregar
      </button>
    </div>
  );
}

function FilaItemProceso({
  item,
  elementos,
  compuestos,
  onChange,
  onQuitar,
}: {
  item: ItemProceso;
  elementos: Elemento[];
  compuestos: Compuesto[];
  onChange: (cambios: Partial<ItemProceso>) => void;
  onQuitar: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");

  const catalogo = item.tipo === "elemento" ? elementos : compuestos;
  const elegido = useMemo(
    () => catalogo.find((c) => c.id === item.id) ?? null,
    [catalogo, item.id],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return catalogo;
    return catalogo.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [catalogo, busqueda]);

  function cambiarTipo(tipo: "elemento" | "compuesto") {
    const nuevoCatalogo = tipo === "elemento" ? elementos : compuestos;
    const primero = nuevoCatalogo[0];
    onChange({ tipo, id: primero?.id ?? "" });
    setBusqueda("");
  }

  return (
    <div className="rounded-lg border border-primary/10 bg-primary/[0.015] p-2 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {/* Toggle elemento/compuesto */}
        <div className="flex items-center rounded-md border border-primary/10 overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => cambiarTipo("elemento")}
            title="Elemento"
            className={`w-6 h-6 flex items-center justify-center transition-colors ${
              item.tipo === "elemento"
                ? "bg-primary/15 text-primary"
                : "text-primary/30 hover:text-primary/60"
            }`}
          >
            <Atom size={11} />
          </button>
          <button
            type="button"
            onClick={() => cambiarTipo("compuesto")}
            title="Compuesto"
            className={`w-6 h-6 flex items-center justify-center transition-colors ${
              item.tipo === "compuesto"
                ? "bg-accent/15 text-accent"
                : "text-primary/30 hover:text-primary/60"
            }`}
          >
            <Beaker size={11} />
          </button>
        </div>

        {/* Buscador / valor elegido */}
        <div className="flex-1 min-w-0 relative">
          <input
            value={elegido ? elegido.nombre : busqueda}
            onFocus={() => setBusqueda("")}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={`Buscar ${item.tipo}…`}
            className="w-full bg-primary/5 rounded-md px-2 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30 placeholder:text-primary/30 placeholder:font-normal"
          />
          {busqueda.trim() && (
            <div
              className="absolute z-20 mt-1 left-0 right-0 max-h-40 overflow-y-auto rounded-md border shadow-lg"
              style={{
                background: "var(--bg-main)",
                borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
              }}
            >
              {filtrados.length === 0 ? (
                <p className="text-micro text-primary/25 italic text-center py-2">Sin resultados</p>
              ) : (
                filtrados.slice(0, 30).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={() => {
                      onChange({ id: c.id });
                      setBusqueda("");
                    }}
                    className="w-full flex items-center gap-1.5 px-2 py-1 text-left text-micro font-bold text-primary/75 hover:bg-primary/6 hover:text-primary transition-colors truncate"
                  >
                    {c.nombre}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Stepper cantidad */}
        <div className="shrink-0 flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange({ cantidad: Math.max(1, item.cantidad - 1) })}
            className="w-5 h-5 flex items-center justify-center rounded border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 transition-all cursor-pointer"
          >
            −
          </button>
          <span className="w-4 text-center text-micro font-black text-primary tabular-nums">
            {item.cantidad}
          </span>
          <button
            type="button"
            onClick={() => onChange({ cantidad: item.cantidad + 1 })}
            className="w-5 h-5 flex items-center justify-center rounded border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 transition-all cursor-pointer"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={onQuitar}
          title="Quitar"
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 transition-all cursor-pointer"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}
