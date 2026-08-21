"use client";

/**
 * SeccionReaccionVinculada.tsx (singular — 1:1)
 * ───────────────────────────────────────────────────────────────────────────
 * Bloque para el vínculo 1:1 con el catálogo de Reacciones (ver
 * useEntidadVinculoReaccion). Si hay una Reacción vinculada, muestra su
 * tarjeta editable completa (TarjetaReaccionVinculada). Si no hay ninguna,
 * muestra solo el botón "+" para crear/elegir una.
 */

import { Beaker, Plus, type LucideIcon } from "lucide-react";
import React, { useState } from "react";

import type { Compuesto, Elemento, Reaccion } from "@/domains/garlia/elementos/types";
import { SelectorGrupoVinculado } from "@/domains/garlia/_shared/SelectorGrupoVinculado";
import { TarjetaReaccionVinculada } from "@/domains/garlia/_shared/TarjetaReaccionVinculada";
import type { ItemProceso } from "@/domains/garlia/flora/SelectorConsumeProduce";

export function SeccionReaccionVinculada({
  titulo = "Reacción",
  descripcion,
  icono = Beaker,
  reaccion,
  catalogo,
  compuestos,
  elementos,
  onCrearNuevo,
  onUsarExistente,
  onUpdate,
  onQuitar,
  onAbrirItem,
  onAbrirReaccion,
  labelCrear = "Crear reacción nueva",
  labelExistente = "Usar una existente",
  labelBuscar = "Buscar reacción…",
}: {
  titulo?: string;
  descripcion?: string;
  icono?: LucideIcon;
  /** Reacción actualmente vinculada, o null si no hay ninguna. */
  reaccion: Reaccion | null;
  /** Catálogo completo de Reacciones para el picker "usar existente". */
  catalogo: Reaccion[];
  compuestos: Compuesto[];
  elementos: Elemento[];
  onCrearNuevo: () => void;
  onUsarExistente: (reaccionId: string) => void;
  onUpdate: (id: string, updates: Partial<Reaccion>) => void;
  onQuitar: () => void;
  onAbrirItem?: (item: ItemProceso) => void;
  onAbrirReaccion?: (reaccionId: string) => void;
  labelCrear?: string;
  labelExistente?: string;
  labelBuscar?: string;
}) {
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const Icono = icono;

  return (
    <div className="pt-1">
      {!reaccion && (
        <div className="flex items-center justify-end mb-1.5 relative">
          <button
            type="button"
            onClick={() => setSelectorAbierto((v) => !v)}
            title={`Elegir ${titulo.toLowerCase()}`}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-primary/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
          >
            <Plus size={13} />
          </button>
          {selectorAbierto && (
            <SelectorGrupoVinculado
              catalogo={catalogo}
              yaVinculadosIds={new Set()}
              onCrearNuevo={onCrearNuevo}
              onUsarExistente={onUsarExistente}
              onClose={() => setSelectorAbierto(false)}
              icono={Icono}
              labelCrear={labelCrear}
              labelExistente={labelExistente}
              labelBuscar={labelBuscar}
            />
          )}
        </div>
      )}

      {descripcion && !reaccion && (
        <p className="text-micro text-primary/30 mb-1.5 -mt-1">{descripcion}</p>
      )}

      {!reaccion ? (
        <p className="text-micro text-primary/25 italic py-2">Sin reacción vinculada todavía.</p>
      ) : (
        <TarjetaReaccionVinculada
          reaccion={{ ...reaccion, vinculo_id: reaccion.id }}
          onUpdate={onUpdate}
          onDelete={onQuitar}
          compuestos={compuestos}
          elementos={elementos}
          onAbrirItem={onAbrirItem}
          onAbrirReaccion={onAbrirReaccion}
        />
      )}
    </div>
  );
}
