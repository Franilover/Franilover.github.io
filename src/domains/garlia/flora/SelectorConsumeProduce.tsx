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
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
          {label}
        </span>
        <button
          type="button"
          onClick={agregar}
          disabled={elementos.length === 0}
          title={`Agregar a ${label}`}
          className="shrink-0 w-4 h-4 flex items-center justify-center rounded text-primary/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={11} />
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-micro text-primary/25 italic">Nada definido todavía.</p>
      )}

      {items.length > 0 && (
        <div className="divide-y divide-primary/10">
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
        </div>
      )}
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
  const [buscando, setBuscando] = useState(false);
  const [activo, setActivo] = useState(0);

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

  const opciones = filtrados.slice(0, 30);

  function elegir(c: Elemento | Compuesto) {
    onChange({ id: c.id });
    setBusqueda("");
    setBuscando(false);
  }

  function cambiarTipo(tipo: "elemento" | "compuesto") {
    const nuevoCatalogo = tipo === "elemento" ? elementos : compuestos;
    const primero = nuevoCatalogo[0];
    onChange({ tipo, id: primero?.id ?? "" });
    setBusqueda("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!buscando || opciones.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => (i + 1) % opciones.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => (i - 1 + opciones.length) % opciones.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = opciones[activo];
      if (c) elegir(c);
    } else if (e.key === "Escape") {
      setBuscando(false);
    }
  }

  return (
    <div className="flex items-center gap-2 py-1">
      {/* Toggle elemento/compuesto */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => cambiarTipo("elemento")}
          title="Elemento"
          className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
            item.tipo === "elemento"
              ? "bg-primary/15 text-primary"
              : "text-primary/30 hover:text-primary/60 hover:bg-primary/5"
          }`}
        >
          <Atom size={11} />
        </button>
        <button
          type="button"
          onClick={() => cambiarTipo("compuesto")}
          title="Compuesto"
          className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
            item.tipo === "compuesto"
              ? "bg-accent/15 text-accent"
              : "text-primary/30 hover:text-primary/60 hover:bg-primary/5"
          }`}
        >
          <Beaker size={11} />
        </button>
      </div>

      {/* Buscador / valor elegido */}
      <div className="flex-1 min-w-0 relative">
        <input
          value={buscando || !elegido ? busqueda : elegido.nombre}
          onFocus={() => {
            setBuscando(true);
            setBusqueda("");
            setActivo(0);
          }}
          onBlur={() => {
            // Da tiempo a que el onMouseDown de una opción se dispare antes de cerrar
            setTimeout(() => setBuscando(false), 120);
          }}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setActivo(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={`Buscar ${item.tipo}…`}
          className="w-full bg-transparent px-0 py-1 text-micro font-bold text-primary outline-none placeholder:text-primary/30 placeholder:font-normal transition-colors"
        />
        {buscando && (
          <div
            className="absolute z-20 mt-1 left-0 right-0 max-h-40 overflow-y-auto rounded-md border shadow-lg"
            style={{
              background: "var(--bg-main)",
              borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            {opciones.length === 0 ? (
              <p className="text-micro text-primary/25 italic text-center py-2">Sin resultados</p>
            ) : (
              opciones.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseEnter={() => setActivo(i)}
                  onMouseDown={() => elegir(c)}
                  className={`w-full flex items-center gap-1.5 px-2 py-1 text-left text-micro font-bold transition-colors truncate ${
                    i === activo ? "bg-primary/10 text-primary" : "text-primary/75 hover:bg-primary/6 hover:text-primary"
                  }`}
                >
                  {c.nombre}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Stepper cantidad */}
      <div className="shrink-0 flex items-center gap-1.5 text-primary/50">
        <button
          type="button"
          onClick={() => onChange({ cantidad: Math.max(1, item.cantidad - 1) })}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
        >
          −
        </button>
        <span className="w-4 text-center text-micro font-black text-primary tabular-nums">
          {item.cantidad}
        </span>
        <button
          type="button"
          onClick={() => onChange({ cantidad: item.cantidad + 1 })}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={onQuitar}
        title="Quitar"
        className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}
