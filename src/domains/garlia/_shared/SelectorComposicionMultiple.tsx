"use client";

/**
 * SelectorComposicionMultiple.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Sucesor de SelectorCompuesto para entidades cuya composición puede tener
 * VARIAS partes hechas de compuestos distintos (ej: un árbol → "Madera" en
 * el tronco, "Clorofila" en las hojas, "Resina" en la savia).
 *
 * Cada entrada de la lista es { compuesto_id, tag }: un Compuesto del
 * catálogo + una etiqueta libre que explica en qué parte del ítem/planta/
 * mineral está presente ese compuesto. La tag es solo texto libre, no un
 * campo controlado — el usuario escribe lo que tenga sentido ("Tronco",
 * "Hojas", "Núcleo del cristal", etc.).
 *
 * Reusa SelectorCompuesto para elegir/crear cada compuesto individual, y
 * muestra debajo de cada fila su resumen de reactividad/peso (no se intenta
 * combinar matemáticamente el perfil atómico de varios compuestos a la vez,
 * porque conceptualmente son partes distintas del ítem, no una mezcla).
 */

import { GripVertical, Plus, Tag, Trash2 } from "lucide-react";
import React from "react";

import {
  calcularPeso,
  calcularReactividad,
} from "@/domains/garlia/elementos/afinidad";
import { REACTIVIDAD_LABEL, type Compuesto } from "@/domains/garlia/elementos/types";
import type { Elemento } from "@/domains/garlia/elementos/types";

import { SelectorCompuesto } from "@/domains/garlia/_shared/SelectorCompuesto";

export type ComposicionEntrada = {
  compuesto_id: string;
  /** Explicación libre de por qué/dónde está este compuesto en la entidad,
   *  ej. "Tronco", "Hojas", "Raíz", "Veta principal". */
  tag: string;
};

interface Props {
  composicion: ComposicionEntrada[];
  onChange: (composicion: ComposicionEntrada[]) => void;
  compuestos: Compuesto[];
  elementos: Elemento[];
  loadingCompuestos?: boolean;
  onCompuestoCreado?: (compuesto: Compuesto) => void;
  onEditarCompuesto?: (compuestoId: string) => void;
}

function ResumenCompuesto({
  compuesto,
  elementos,
}: {
  compuesto: Compuesto;
  elementos: Elemento[];
}) {
  const reactividad = calcularReactividad(compuesto, elementos);
  const peso = calcularPeso(compuesto, elementos);
  return (
    <div className="flex items-center gap-3 pl-2.5">
      <span className="text-micro text-primary/40">
        Reactividad:{" "}
        <span className="text-primary/70 font-bold">
          {reactividad ? REACTIVIDAD_LABEL[reactividad.nivel] : "—"}
        </span>
      </span>
      <span className="text-micro text-primary/40">
        Peso:{" "}
        <span className="text-primary/70 font-bold">
          {peso ? `${peso.pesoTotal} (${peso.categoria})` : "—"}
        </span>
      </span>
    </div>
  );
}

export function SelectorComposicionMultiple({
  composicion,
  onChange,
  compuestos,
  elementos,
  loadingCompuestos,
  onCompuestoCreado,
  onEditarCompuesto,
}: Props) {
  function agregarEntrada() {
    onChange([...composicion, { compuesto_id: "", tag: "" }]);
  }

  function actualizarEntrada(idx: number, cambios: Partial<ComposicionEntrada>) {
    onChange(
      composicion.map((entrada, i) => (i === idx ? { ...entrada, ...cambios } : entrada)),
    );
  }

  function quitarEntrada(idx: number) {
    onChange(composicion.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-3">
      {composicion.length === 0 && (
        <p className="text-micro text-primary/25 italic">
          Sin compuestos todavía. Agregá uno por cada parte relevante (ej: tronco,
          hojas, raíz…).
        </p>
      )}

      {composicion.map((entrada, idx) => {
        const compuestoElegido = compuestos.find((c) => c.id === entrada.compuesto_id) ?? null;
        return (
          <div
            key={idx}
            className="rounded-lg border border-primary/10 bg-primary/[0.015] p-2.5 flex flex-col gap-2"
          >
            <div className="flex items-center gap-1.5">
              <GripVertical size={12} className="text-primary/15 shrink-0" />
              <div className="flex-1 min-w-0 flex items-center gap-1.5 bg-primary/5 rounded-md px-2 py-1.5 border border-primary/10 focus-within:border-primary/30">
                <Tag size={11} className="text-primary/30 shrink-0" />
                <input
                  value={entrada.tag}
                  onChange={(e) => actualizarEntrada(idx, { tag: e.target.value })}
                  placeholder='Etiqueta (ej: "Tronco", "Hojas"…)'
                  className="flex-1 min-w-0 bg-transparent text-micro font-bold text-primary outline-none placeholder:text-primary/30 placeholder:font-normal"
                />
              </div>
              <button
                type="button"
                onClick={() => quitarEntrada(idx)}
                title="Quitar esta parte de la composición"
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 transition-all cursor-pointer"
              >
                <Trash2 size={12} />
              </button>
            </div>

            <SelectorCompuesto
              compuestos={compuestos}
              loadingCompuestos={loadingCompuestos}
              compuestoId={entrada.compuesto_id || null}
              onChange={(compuestoId) =>
                actualizarEntrada(idx, { compuesto_id: compuestoId ?? "" })
              }
              onCompuestoCreado={onCompuestoCreado}
              onEditarCompuesto={onEditarCompuesto}
            />

            {compuestoElegido && (
              <ResumenCompuesto compuesto={compuestoElegido} elementos={elementos} />
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={agregarEntrada}
        className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-micro font-black uppercase tracking-wide border border-dashed border-primary/20 text-primary/50 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer"
      >
        <Plus size={11} />
        Agregar compuesto
      </button>
    </div>
  );
}
