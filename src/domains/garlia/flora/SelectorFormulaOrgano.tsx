"use client";

/**
 * SelectorFormulaOrgano.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Editor visual para PlantaOrgano.componentes — lista de Compuestos + cantidad
 * (un órgano real es una mezcla de compuestos en proporciones distintas, no
 * un compuesto único). Mismo lenguaje visual que SelectorConsumeProduce
 * (buscador + stepper), pero sin el toggle Elemento/Compuesto: acá siempre
 * es Compuesto, elegido por id de un catálogo real (sin texto libre).
 *
 * Reemplaza la versión anterior que apuntaba a Elementos por nombre.
 */

import { Plus, Trash2, Pencil } from "lucide-react";
import React, { useMemo, useState } from "react";

import type { Compuesto } from "@/domains/garlia/elementos/types";

export interface ComponenteOrgano {
  compuesto_id: string;
  cantidad: number;
}

export function SelectorFormulaOrgano({
  compuestos,
  componentes,
  onChange,
  onAbrirCompuesto,
}: {
  compuestos: Compuesto[];
  componentes: ComponenteOrgano[];
  onChange: (componentes: ComponenteOrgano[]) => void;
  /** Abre el panel flotante del Compuesto elegido en una fila, reemplazando
   *  el panel actualmente abierto. */
  onAbrirCompuesto?: (compuestoId: string) => void;
}) {
  function agregar() {
    const elegidos = new Set(componentes.map((c) => c.compuesto_id));
    const primero = compuestos.find((c) => !elegidos.has(c.id)) ?? compuestos[0];
    if (!primero) return;
    onChange([...componentes, { compuesto_id: primero.id, cantidad: 1 }]);
  }

  function actualizar(idx: number, cambios: Partial<ComponenteOrgano>) {
    onChange(componentes.map((c, i) => (i === idx ? { ...c, ...cambios } : c)));
  }

  function quitar(idx: number) {
    onChange(componentes.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col">
      {componentes.length === 0 && (
        <p className="text-micro text-primary/25 italic mb-1.5">Nada definido todavía.</p>
      )}

      {componentes.length > 0 && (
        <div className="divide-y divide-primary/10 mb-1.5">
          {componentes.map((componente, idx) => (
            <FilaComponenteOrgano
              key={idx}
              componente={componente}
              compuestos={compuestos}
              onChange={(cambios) => actualizar(idx, cambios)}
              onQuitar={() => quitar(idx)}
              onAbrir={onAbrirCompuesto ? () => onAbrirCompuesto(componente.compuesto_id) : undefined}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={agregar}
        disabled={compuestos.length === 0}
        className="flex items-center justify-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-dashed border-primary/20 text-primary/50 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus size={10} />
        Agregar
      </button>

      {compuestos.length === 0 && (
        <p className="text-micro text-primary/25">
          Todavía no hay compuestos en la Tabla Química para asignar.
        </p>
      )}
    </div>
  );
}

function FilaComponenteOrgano({
  componente,
  compuestos,
  onChange,
  onQuitar,
  onAbrir,
}: {
  componente: ComponenteOrgano;
  compuestos: Compuesto[];
  onChange: (cambios: Partial<ComponenteOrgano>) => void;
  onQuitar: () => void;
  onAbrir?: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [activo, setActivo] = useState(0);

  const elegido = useMemo(
    () => compuestos.find((c) => c.id === componente.compuesto_id) ?? null,
    [compuestos, componente.compuesto_id],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return compuestos;
    return compuestos.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [compuestos, busqueda]);

  const opciones = filtrados.slice(0, 30);

  function elegir(c: Compuesto) {
    onChange({ compuesto_id: c.id });
    setBusqueda("");
    setBuscando(false);
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
      {/* Valor elegido (clickeable → abre panel) o buscador */}
      <div className="flex-1 min-w-0 relative">
        {elegido && !buscando ? (
          <div className="flex items-center gap-1 group/item">
            <button
              type="button"
              onClick={onAbrir}
              disabled={!onAbrir}
              title={onAbrir ? `Abrir ${elegido.nombre}` : undefined}
              className="min-w-0 flex-1 text-left px-0 py-1 text-micro font-bold text-primary truncate transition-colors disabled:cursor-default hover:enabled:text-accent hover:enabled:underline cursor-pointer"
            >
              {elegido.nombre}
            </button>
            <button
              type="button"
              onClick={() => {
                setBuscando(true);
                setBusqueda("");
                setActivo(0);
              }}
              title="Reemplazar"
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-primary/25 hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover/item:opacity-100 cursor-pointer"
            >
              <Pencil size={10} />
            </button>
          </div>
        ) : (
          <input
            autoFocus={buscando}
            value={busqueda}
            onBlur={() => {
              // Da tiempo a que el onMouseDown de una opción se dispare antes de cerrar
              setTimeout(() => setBuscando(false), 120);
            }}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setActivo(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Buscar compuesto…"
            className="w-full bg-transparent px-0 py-1 text-micro font-bold text-primary outline-none placeholder:text-primary/30 placeholder:font-normal transition-colors"
          />
        )}
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
          onClick={() => onChange({ cantidad: Math.max(1, componente.cantidad - 1) })}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
        >
          −
        </button>
        <span className="w-4 text-center text-micro font-black text-primary tabular-nums">
          {componente.cantidad}
        </span>
        <button
          type="button"
          onClick={() => onChange({ cantidad: componente.cantidad + 1 })}
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
