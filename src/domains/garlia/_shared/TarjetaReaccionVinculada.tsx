"use client";

/**
 * TarjetaReaccionVinculada.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Tarjeta compacta de una Reacción vinculada N:N a un Proceso (Flora/Mineral)
 * o Habilidad (Item) — mismo espíritu que TarjetaGrupoVinculado, pero para
 * el catálogo de Reacciones: nombre + mini resumen consume/produce + balance,
 * con un botón "Abrir" que despliega el detalle completo editable
 * (SelectorConsumeProduce + BalanceProcesoPanel + descripción) inline, para
 * no reimplementar el editor — se reutiliza el mismo cuerpo que
 * ReaccionPanelFlotante pero embebido en vez de modal.
 *
 * Editar acá afecta a todos los Procesos/Habilidades que tengan esta misma
 * Reacción vinculada (es el catálogo compartido, en vivo).
 */

import { ChevronDown, ChevronUp, ExternalLink, Trash2 } from "lucide-react";
import React, { useState } from "react";

import type { Compuesto, Elemento, Reaccion } from "@/domains/garlia/elementos/types";
import { SelectorConsumeProduce, type ItemProceso } from "@/domains/garlia/flora/SelectorConsumeProduce";
import { BalanceProcesoPanel } from "@/domains/garlia/_shared/BalanceProcesoPanel";
import type { ReaccionVinculadaResuelta } from "@/domains/garlia/_shared/useEntidadVinculosReaccion";

function resumenEntradas(entradas: { cantidad: number }[] | null | undefined): string {
  if (!entradas || entradas.length === 0) return "—";
  const total = entradas.reduce((a, e) => a + (e.cantidad ?? 0), 0);
  return `${entradas.length} item${entradas.length === 1 ? "" : "s"} · ${total}`;
}

export function TarjetaReaccionVinculada({
  reaccion,
  onUpdate,
  onDelete,
  compuestos,
  elementos,
  onAbrirItem,
  onAbrirReaccion,
}: {
  reaccion: ReaccionVinculadaResuelta;
  onUpdate: (id: string, updates: Partial<Reaccion>) => void;
  onDelete: () => void;
  compuestos: Compuesto[];
  elementos: Elemento[];
  onAbrirItem?: (item: ItemProceso) => void;
  /** Abre esta reacción en el panel flotante de Química (vista completa
   *  fuera de la tarjeta inline), útil cuando está vinculada a muchos
   *  procesos y se quiere editar desde un solo lugar. */
  onAbrirReaccion?: (reaccionId: string) => void;
}) {
  const [expandido, setExpandido] = useState(false);

  return (
    <div className="group rounded-lg border border-primary/10 bg-primary/[0.02]">
      <div className="flex items-center gap-2 py-2 px-2.5">
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-primary/35 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
          title={expandido ? "Colapsar" : "Expandir"}
        >
          {expandido ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-primary/80 truncate">
            {reaccion.nombre || "(sin nombre)"}
          </p>
          <p className="text-micro text-primary/35 truncate">
            {resumenEntradas(reaccion.consume)} → {resumenEntradas(reaccion.produce)}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onAbrirReaccion && (
            <button
              type="button"
              onClick={() => onAbrirReaccion(reaccion.id)}
              title="Abrir en Química"
              className="w-6 h-6 flex items-center justify-center rounded text-primary/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            >
              <ExternalLink size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            title="Quitar (sigue en el catálogo de Química para otros usos)"
            className="p-1 rounded hover:bg-red-500/10 text-red-500/40 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {expandido && (
        <div className="px-2.5 pb-2.5 flex flex-col gap-3 border-t border-primary/10 pt-2.5">
          <input
            className="w-full bg-transparent px-0 py-1 text-xs font-semibold text-primary/80 outline-none placeholder:text-primary/25 placeholder:font-normal"
            placeholder="Nombre de la reacción…"
            value={reaccion.nombre ?? ""}
            onChange={(e) => onUpdate(reaccion.id, { nombre: e.target.value })}
          />

          <SelectorConsumeProduce
            label="Consume"
            items={(reaccion.consume ?? []) as ItemProceso[]}
            onChange={(consume) => onUpdate(reaccion.id, { consume })}
            elementos={elementos}
            compuestos={compuestos}
            onAbrirItem={onAbrirItem}
          />

          <SelectorConsumeProduce
            label="Produce"
            items={(reaccion.produce ?? []) as ItemProceso[]}
            onChange={(produce) => onUpdate(reaccion.id, { produce })}
            elementos={elementos}
            compuestos={compuestos}
            onAbrirItem={onAbrirItem}
          />

          <BalanceProcesoPanel
            consume={(reaccion.consume ?? []) as ItemProceso[]}
            produce={(reaccion.produce ?? []) as ItemProceso[]}
            compuestos={compuestos}
            elementos={elementos}
            onAutocompletar={(produce) => onUpdate(reaccion.id, { produce })}
          />

          <textarea
            className="w-full min-h-[3.5rem] bg-transparent px-0 py-1 text-xs text-primary/70 resize-none outline-none placeholder:text-primary/25"
            placeholder="Descripción / condiciones de esta reacción…"
            value={reaccion.descripcion ?? ""}
            onChange={(e) => onUpdate(reaccion.id, { descripcion: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
