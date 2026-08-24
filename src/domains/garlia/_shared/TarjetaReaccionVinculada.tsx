"use client";

/**
 * TarjetaReaccionVinculada.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Tarjeta de una Reacción vinculada N:N a un Proceso (Flora/Mineral) o
 * Habilidad (Item) — mismo espíritu que TarjetaGrupoVinculado, pero para el
 * catálogo de Reacciones: nombre + editor completo de consume/produce +
 * balance + descripción, siempre visible (sin colapsar/expandir).
 *
 * Editar acá afecta a todos los Procesos/Habilidades que tengan esta misma
 * Reacción vinculada (es el catálogo compartido, en vivo).
 */

import { ExternalLink, Trash2 } from "lucide-react";
import React from "react";

import type { Compuesto, Elemento, Reaccion } from "@/domains/garlia/elementos/types";
import { persistirReaccion } from "@/domains/garlia/elementos/persistirReaccion";
import { SelectorConsumeProduce, type ItemProceso } from "@/domains/garlia/flora/SelectorConsumeProduce";
import { BalanceProcesoPanel } from "@/domains/garlia/_shared/BalanceProcesoPanel";

/** Reaccion + un id de "vínculo" (hoy siempre = reaccion.id, ya que el
 *  modelo es 1:1 sin tabla puente) — se mantiene el shape para no acoplar
 *  esta tarjeta a los detalles de cómo cada consumidor guarda el vínculo. */
export interface ReaccionVinculadaResuelta extends Reaccion {
  vinculo_id: string;
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
  return (
    <div className="group">
      <div className="flex items-center gap-2 py-2">
        <div className="min-w-0 flex-1">
          <input
            className="w-full bg-transparent px-0 py-0.5 text-xs font-semibold text-primary/80 outline-none placeholder:text-primary/25 placeholder:font-normal"
            placeholder="Nombre de la reacción…"
            value={reaccion.nombre ?? ""}
            onChange={(e) => onUpdate(reaccion.id, { nombre: e.target.value })}
          />
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

      <div className="pb-2.5 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-3">
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
          </div>

          <textarea
            className="w-full h-full min-h-[3.5rem] bg-transparent px-0 py-1 text-xs text-primary/70 resize-none outline-none placeholder:text-primary/25"
            placeholder="Descripción / condiciones de esta reacción…"
            value={reaccion.descripcion ?? ""}
            onChange={(e) => onUpdate(reaccion.id, { descripcion: e.target.value })}
          />
        </div>

        <BalanceProcesoPanel
          consume={(reaccion.consume ?? []) as ItemProceso[]}
          produce={(reaccion.produce ?? []) as ItemProceso[]}
          compuestos={compuestos}
          elementos={elementos}
          onAutocompletar={(produce) => onUpdate(reaccion.id, { produce })}
        />
      </div>
    </div>
  );
}
