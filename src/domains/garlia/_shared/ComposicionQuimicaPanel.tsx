"use client";

/**
 * ComposicionQuimicaPanel.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Panel genérico de física derivada para una MEZCLA de Compuestos
 * ({ compuesto_id, cantidad }[]) — extraído del bloque "Composición
 * material" de PerfilAtomicoCriaturaPanel para que Mineral (Formaciones) y
 * Flora (Órganos) lo compartan sin duplicar el cálculo ni el render.
 *
 * Reusa TAL CUAL el motor de afinidad.ts: calcularPerfilAtomicoDeMezcla,
 * calcularBalancePorCapa, calcularReactividadDeMezcla, calcularPesoDeMezcla
 * — mismo criterio que ya usa Biología para el tejido duro de una
 * criatura, pero operando sobre Compuestos en vez de Elementos sueltos
 * (una Formación/Órgano es una mezcla de Compuestos, no un Compuesto
 * único armado a mano).
 *
 * No incluye selector de composición (eso ya lo cubre
 * SelectorFormulaOrgano) — este panel es solo la lectura derivada:
 * balance por capa, reactividad y peso.
 */

import React, { useMemo } from "react";

import {
  calcularBalancePorCapa,
  calcularPesoDeMezcla,
  calcularReactividadDeMezcla,
  calcularPerfilAtomicoDeMezcla,
  type ComponenteCompuestoEnMezcla,
} from "@/domains/garlia/elementos/afinidad";
import {
  LAYER_LABEL,
  REACTIVIDAD_LABEL,
  formatLayer,
  type Compuesto,
  type Elemento,
  type LayerName,
} from "@/domains/garlia/elementos/types";

const LAYERS: LayerName[] = ["nucleo", "media", "externa"];

function BarraCapa({
  layer,
  perfil,
  total,
  capacidad,
}: {
  layer: LayerName;
  perfil: Record<string, number | undefined>;
  total: number;
  capacidad: number;
}) {
  const balance = total - capacidad;
  const pct = capacidad > 0 ? Math.min(100, (total / capacidad) * 100) : 0;

  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-micro font-black uppercase tracking-wide text-primary/50">
          {LAYER_LABEL[layer]}
        </span>
        <span className="text-micro font-bold text-primary/40">
          {total}/{capacidad}{" "}
          {balance === 0 ? "(saturada)" : balance > 0 ? `(+${balance})` : `(${balance})`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-primary/8 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            balance < 0 ? "bg-amber-400/60" : balance > 0 ? "bg-accent/60" : "bg-emerald-400/60"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-micro text-primary/35 mt-0.5 block">{formatLayer(perfil)}</span>
    </div>
  );
}

export function ComposicionQuimicaPanel({
  mezcla,
  compuestos,
  elementos,
  titulo = "Física derivada",
}: {
  /** Mezcla de Compuestos + cantidad — mismo shape que MineralFormacion.componentes
   *  o PlantaOrgano.componentes. */
  mezcla: ComponenteCompuestoEnMezcla[];
  compuestos: Compuesto[];
  elementos: Elemento[];
  titulo?: string;
}) {
  const mezclaValida = useMemo(
    () => (mezcla ?? []).filter((c) => c.compuesto_id && c.cantidad > 0),
    [mezcla],
  );

  const perfilAtomico = useMemo(
    () => calcularPerfilAtomicoDeMezcla(mezclaValida, compuestos, elementos),
    [mezclaValida, compuestos, elementos],
  );
  const balance = useMemo(() => calcularBalancePorCapa(perfilAtomico), [perfilAtomico]);
  const reactividad = useMemo(
    () => calcularReactividadDeMezcla(mezclaValida, compuestos, elementos),
    [mezclaValida, compuestos, elementos],
  );
  const peso = useMemo(
    () => calcularPesoDeMezcla(mezclaValida, compuestos, elementos),
    [mezclaValida, compuestos, elementos],
  );

  if (mezclaValida.length === 0) return null;

  return (
    <div className="p-3 rounded-xl border border-primary/10 bg-primary/[0.02]">
      <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-2">
        {titulo}
      </span>

      {LAYERS.map((layer) => {
        const b = balance.find((x) => x.layer === layer)!;
        return (
          <BarraCapa
            key={layer}
            layer={layer}
            perfil={perfilAtomico[layer]}
            total={b.total}
            capacidad={b.capacidad}
          />
        );
      })}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-primary/10">
        <span className="text-micro font-bold text-primary/50">
          Reactividad: <span className="text-primary/80">{REACTIVIDAD_LABEL[reactividad.nivel]}</span>
        </span>
        <span className="text-micro font-bold text-primary/50">
          Peso: <span className="text-primary/80">{peso.pesoTotal} ({peso.categoria})</span>
        </span>
      </div>
    </div>
  );
}
