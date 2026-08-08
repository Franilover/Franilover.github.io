"use client";

/**
 * SelectorComposicionElementos.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Selector rico de elementos componentes — chips toggle con stepper +/-
 * para los ya elegidos, y los que más ayudan a cerrar el déficit actual
 * (sugerirElementosParaCompletar) destacados primero con badge.
 *
 * Extraído TAL CUAL de SelectorElementosCriatura (antes vivía local en
 * PerfilAtomicoCriaturaPanel.tsx) para que Criaturas, Flora y Minerales lo
 * compartan sin duplicar lógica — mismo motor de afinidad.ts para los tres.
 */

import { X } from "lucide-react";
import React, { useMemo } from "react";

import { sugerirElementosParaCompletar } from "./afinidad";
import type { ComponenteCompuesto, Elemento } from "./types";

/**
 * Nombre corto de un elemento por id — usado en los chips de "elegidos".
 * Mismo helper que nombreElemento en CompuestosPage / PerfilAtomicoCriaturaPanel.
 */
export function nombreElemento(elementos: Elemento[], id: string): string {
  return elementos.find((e) => e.id === id)?.nombre ?? "??";
}

export function SelectorComposicionElementos({
  elementos,
  componentes,
  onChange,
}: {
  elementos: Elemento[];
  componentes: ComponenteCompuesto[];
  onChange: (componentes: ComponenteCompuesto[]) => void;
}) {
  const idsElegidos = new Set(componentes.map((c) => c.elemento_id));

  const sugerencias = useMemo(
    () => sugerirElementosParaCompletar(componentes, elementos),
    [componentes, elementos],
  );
  const idsSugeridos = useMemo(
    () => new Set(sugerencias.slice(0, 3).map((s) => s.elemento.id)),
    [sugerencias],
  );

  function toggleElemento(id: string) {
    if (idsElegidos.has(id)) {
      onChange(componentes.filter((c) => c.elemento_id !== id));
    } else {
      onChange([...componentes, { elemento_id: id, cantidad: 1 }]);
    }
  }

  function setCantidad(id: string, cantidad: number) {
    onChange(
      componentes.map((c) =>
        c.elemento_id === id ? { ...c, cantidad: Math.max(1, cantidad) } : c,
      ),
    );
  }

  const disponibles = elementos.filter((el) => !idsElegidos.has(el.id));
  const disponiblesOrdenados = [
    ...disponibles.filter((el) => idsSugeridos.has(el.id)),
    ...disponibles.filter((el) => !idsSugeridos.has(el.id)),
  ];

  return (
    <div className="flex flex-col gap-2">
      {/* Elegidos, con stepper de cantidad */}
      {componentes.length > 0 && (
        <div className="flex flex-col gap-1">
          {componentes.map((c) => (
            <div
              key={c.elemento_id}
              className="flex items-center gap-1.5 bg-primary/5 rounded-md pl-2 pr-1 py-1 border border-primary/10"
            >
              <span className="flex-1 min-w-0 truncate text-micro font-bold text-primary/80">
                {nombreElemento(elementos, c.elemento_id)}
              </span>
              <div className="shrink-0 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCantidad(c.elemento_id, c.cantidad - 1)}
                  className="w-5 h-5 flex items-center justify-center rounded border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 transition-all cursor-pointer"
                >
                  −
                </button>
                <span className="w-4 text-center text-micro font-black text-primary tabular-nums">
                  {c.cantidad}
                </span>
                <button
                  type="button"
                  onClick={() => setCantidad(c.elemento_id, c.cantidad + 1)}
                  className="w-5 h-5 flex items-center justify-center rounded border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 transition-all cursor-pointer"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => toggleElemento(c.elemento_id)}
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

      {/* Disponibles para agregar — los que más cierran el déficit actual
          van primero, marcados con un puntito. */}
      <div className="flex flex-wrap gap-1">
        {disponiblesOrdenados.map((el) => {
          const sugerido = idsSugeridos.has(el.id);
          return (
            <button
              key={el.id}
              type="button"
              onClick={() => toggleElemento(el.id)}
              title={
                sugerido
                  ? `${el.nombre} — completa parte del déficit actual`
                  : `Agregar ${el.nombre}`
              }
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-micro font-bold border transition-all cursor-pointer ${
                sugerido
                  ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/15"
                  : "border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5"
              }`}
            >
              {sugerido && <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />}
              <span className="font-black">{el.simbolo || "??"}</span>
              <span className="truncate max-w-[80px]">{el.nombre}</span>
            </button>
          );
        })}
        {elementos.length === 0 && (
          <p className="text-micro text-primary/25">
            Todavía no hay elementos en la Tabla Química para asignar.
          </p>
        )}
      </div>
    </div>
  );
}
