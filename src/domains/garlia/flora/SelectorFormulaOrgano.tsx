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

import { Plus, Trash2 } from "lucide-react";
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
}: {
  compuestos: Compuesto[];
  componentes: ComponenteOrgano[];
  onChange: (componentes: ComponenteOrgano[]) => void;
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
    <div className="flex flex-col gap-1.5">
      {componentes.length === 0 && (
        <p className="text-micro text-primary/25 italic">Nada definido todavía.</p>
      )}

      {componentes.map((componente, idx) => (
        <FilaComponenteOrgano
          key={idx}
          componente={componente}
          compuestos={compuestos}
          onChange={(cambios) => actualizar(idx, cambios)}
          onQuitar={() => quitar(idx)}
        />
      ))}

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
}: {
  componente: ComponenteOrgano;
  compuestos: Compuesto[];
  onChange: (cambios: Partial<ComponenteOrgano>) => void;
  onQuitar: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");

  const elegido = useMemo(
    () => compuestos.find((c) => c.id === componente.compuesto_id) ?? null,
    [compuestos, componente.compuesto_id],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return compuestos;
    return compuestos.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [compuestos, busqueda]);

  return (
    <div className="rounded-lg border border-primary/10 bg-primary/[0.015] p-2 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {/* Buscador / valor elegido */}
        <div className="flex-1 min-w-0 relative">
          <input
            value={elegido ? elegido.nombre : busqueda}
            onFocus={() => setBusqueda("")}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar compuesto…"
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
                      onChange({ compuesto_id: c.id });
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
            onClick={() => onChange({ cantidad: Math.max(1, componente.cantidad - 1) })}
            className="w-5 h-5 flex items-center justify-center rounded border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 transition-all cursor-pointer"
          >
            −
          </button>
          <span className="w-4 text-center text-micro font-black text-primary tabular-nums">
            {componente.cantidad}
          </span>
          <button
            type="button"
            onClick={() => onChange({ cantidad: componente.cantidad + 1 })}
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
