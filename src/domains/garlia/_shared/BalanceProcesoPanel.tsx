"use client";

/**
 * BalanceProcesoPanel.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Muestra si un Proceso (MineralProceso/PlantaProceso) está balanceado:
 * compara consume vs produce capa por capa vía calcularBalanceProceso —
 * una reacción real no crea ni destruye partículas, solo las reordena
 * (igual que 2H₂ + O₂ → 2H₂O), así que ambos lados deben sumar lo mismo.
 *
 * Reutilizable por Mineral y Flora (ambos comparten el mismo shape de
 * consume/produce), mismo criterio que ComposicionQuimicaPanel para
 * Formaciones/Órganos.
 */

import { AlertTriangle, Check } from "lucide-react";
import React, { useMemo } from "react";

import { calcularBalanceProceso, autocompletarBalanceProceso, type EntradaProceso } from "@/domains/garlia/elementos/afinidad";
import type { Compuesto, Elemento, LayerName } from "@/domains/garlia/elementos/types";

const LAYER_LABEL: Record<LayerName, string> = {
  nucleo: "Núcleo",
  media: "Media",
  externa: "Externa",
};

export function BalanceProcesoPanel({
  consume,
  produce,
  compuestos,
  elementos,
  onAutocompletar,
}: {
  consume: EntradaProceso[];
  produce: EntradaProceso[];
  compuestos: Compuesto[];
  elementos: Elemento[];
  /** Si se pasa, habilita el botón "Autocompletar" que re-escala produce
   *  para balancear (mismo factor entero para todas sus entradas). */
  onAutocompletar?: (produce: EntradaProceso[]) => void;
}) {
  const balance = useMemo(
    () => calcularBalanceProceso(consume, produce, compuestos, elementos),
    [consume, produce, compuestos, elementos],
  );

  const sugerencia = useMemo(() => {
    if (balance.balanceado || !onAutocompletar) return null;
    if (!consume?.length || !produce?.length) return null;
    return autocompletarBalanceProceso(consume, produce, compuestos, elementos);
  }, [balance.balanceado, consume, produce, compuestos, elementos, onAutocompletar]);

  if ((consume?.length ?? 0) === 0 && (produce?.length ?? 0) === 0) return null;

  return (
    <div className="mt-1.5 p-2 rounded-lg border border-primary/10 bg-primary/[0.02]">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          {balance.balanceado ? (
            <Check size={11} className="text-emerald-500/70 shrink-0" />
          ) : (
            <AlertTriangle size={11} className="text-amber-500/70 shrink-0" />
          )}
          <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
            {balance.balanceado ? "Reacción balanceada" : "Reacción desbalanceada"}
          </span>
        </div>
        {sugerencia?.balanceado && onAutocompletar && (
          <button
            type="button"
            onClick={() => onAutocompletar(sugerencia.produce)}
            title={`Multiplicar produce ×${sugerencia.factor} para balancear`}
            className="shrink-0 text-micro font-black uppercase tracking-wide px-2 py-0.5 rounded border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
          >
            Autocompletar ×{sugerencia.factor}
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {balance.capas.map((c) => (
          <div key={c.layer} className="flex flex-col gap-0.5">
            <span className="text-micro text-primary/35">{LAYER_LABEL[c.layer]}</span>
            <span
              className={`text-xs font-black tabular-nums ${
                c.diferencia === 0
                  ? "text-primary/50"
                  : c.diferencia > 0
                    ? "text-emerald-500/80"
                    : "text-red-400/80"
              }`}
            >
              {c.consumido} → {c.producido}
              {c.diferencia !== 0 && (
                <span className="ml-1 font-bold">
                  ({c.diferencia > 0 ? "+" : ""}
                  {c.diferencia})
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      {balance.huerfanos.length > 0 && (
        <p className="mt-1.5 text-micro text-amber-500/70 italic">
          {balance.huerfanos.length} referencia(s) a elementos/compuestos que ya no existen en el catálogo — el balance las ignora.
        </p>
      )}
    </div>
  );
}
