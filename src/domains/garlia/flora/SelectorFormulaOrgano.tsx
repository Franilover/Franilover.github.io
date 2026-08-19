"use client";

/**
 * SelectorFormulaOrgano.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Editor visual para PlantaOrgano.componentes — mismo patrón de chips +
 * stepper que SelectorComposicionElementos (elementos/), pero apuntando a
 * elementos de la Tabla Química por NOMBRE (no por id), que es el shape
 * histórico de este campo: Array<{ elemento: string; cantidad: number }>.
 *
 * Reemplaza el textarea/JSON.stringify crudo que tenía OrganoCard.
 */

import { X } from "lucide-react";
import React from "react";

import type { Elemento } from "@/domains/garlia/elementos/types";

export interface ComponenteOrgano {
  elemento: string;
  cantidad: number;
}

export function SelectorFormulaOrgano({
  elementos,
  componentes,
  onChange,
}: {
  elementos: Elemento[];
  componentes: ComponenteOrgano[];
  onChange: (componentes: ComponenteOrgano[]) => void;
}) {
  const nombresElegidos = new Set(componentes.map((c) => c.elemento));

  function toggleElemento(nombre: string) {
    if (nombresElegidos.has(nombre)) {
      onChange(componentes.filter((c) => c.elemento !== nombre));
    } else {
      onChange([...componentes, { elemento: nombre, cantidad: 1 }]);
    }
  }

  function setCantidad(nombre: string, cantidad: number) {
    onChange(
      componentes.map((c) =>
        c.elemento === nombre ? { ...c, cantidad: Math.max(1, cantidad) } : c,
      ),
    );
  }

  const disponibles = elementos.filter((el) => !nombresElegidos.has(el.nombre));

  return (
    <div className="flex flex-col gap-2">
      {componentes.length > 0 && (
        <div className="flex flex-col gap-1">
          {componentes.map((c) => (
            <div
              key={c.elemento}
              className="flex items-center gap-1.5 bg-primary/5 rounded-md pl-2 pr-1 py-1 border border-primary/10"
            >
              <span className="flex-1 min-w-0 truncate text-micro font-bold text-primary/80">
                {c.elemento}
              </span>
              <div className="shrink-0 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCantidad(c.elemento, c.cantidad - 1)}
                  className="w-5 h-5 flex items-center justify-center rounded border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 transition-all cursor-pointer"
                >
                  −
                </button>
                <span className="w-4 text-center text-micro font-black text-primary tabular-nums">
                  {c.cantidad}
                </span>
                <button
                  type="button"
                  onClick={() => setCantidad(c.elemento, c.cantidad + 1)}
                  className="w-5 h-5 flex items-center justify-center rounded border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 transition-all cursor-pointer"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => toggleElemento(c.elemento)}
                  title="Quitar"
                  className="w-5 h-5 flex items-center justify-center rounded border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 transition-all cursor-pointer"
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {disponibles.map((el) => (
          <button
            key={el.id}
            type="button"
            onClick={() => toggleElemento(el.nombre)}
            title={`Agregar ${el.nombre}`}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-micro font-bold border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
          >
            <span className="font-black">{el.simbolo || "??"}</span>
            <span className="truncate max-w-[80px]">{el.nombre}</span>
          </button>
        ))}
        {elementos.length === 0 && (
          <p className="text-micro text-primary/25">
            Todavía no hay elementos en la Tabla Química para asignar.
          </p>
        )}
      </div>
    </div>
  );
}
