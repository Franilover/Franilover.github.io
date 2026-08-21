"use client";

/**
 * SeccionReaccionesVinculadas.tsx (plural — N:N)
 * ───────────────────────────────────────────────────────────────────────────
 * Bloque completo "título + botón agregar + lista" para el vínculo N:N con
 * el catálogo de Reacciones (ver useItemHabilidadesReaccion). Mismo espíritu
 * que SeccionGruposVinculados (Estructura), pero para Reacciones: cada
 * habilidad se muestra en su propia TarjetaReaccionVinculada, en un grid de
 * 2 columnas (2 habilidades por fila en pantallas grandes).
 */

import { Plus, type LucideIcon } from "lucide-react";
import React, { useState } from "react";

import type { Compuesto, Elemento, Reaccion } from "@/domains/garlia/elementos/types";
import { SelectorGrupoVinculado } from "@/domains/garlia/_shared/SelectorGrupoVinculado";
import { TarjetaReaccionVinculada } from "@/domains/garlia/_shared/TarjetaReaccionVinculada";
import type { ReaccionVinculadaHabilidad } from "@/domains/garlia/_shared/useItemHabilidadesReaccion";
import type { ItemProceso } from "@/domains/garlia/flora/SelectorConsumeProduce";

export function SeccionReaccionesVinculadas({
  titulo = "Reacciones",
  descripcion,
  icono,
  items,
  catalogo,
  loading,
  compuestos,
  elementos,
  onCrearNuevo,
  onUsarExistente,
  onUpdate,
  onDelete,
  onAbrirItem,
  onAbrirReaccion,
  labelCrear = "Crear habilidad nueva",
  labelExistente = "Usar una existente",
  labelBuscar = "Buscar habilidad…",
}: {
  titulo?: string;
  descripcion?: string;
  icono: LucideIcon;
  items: ReaccionVinculadaHabilidad[];
  /** Catálogo completo de Reacciones para el picker "usar existente". */
  catalogo: Reaccion[];
  loading?: boolean;
  compuestos: Compuesto[];
  elementos: Elemento[];
  onCrearNuevo: () => void;
  onUsarExistente: (reaccionId: string) => void;
  onUpdate: (id: string, updates: Partial<Reaccion>) => void;
  onDelete: (vinculoId: string) => void;
  onAbrirItem?: (item: ItemProceso) => void;
  onAbrirReaccion?: (reaccionId: string) => void;
  labelCrear?: string;
  labelExistente?: string;
  labelBuscar?: string;
}) {
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const Icono = icono;

  return (
    <div className="pt-2 border-t border-primary/10">
      <div className="flex items-center justify-between mb-1.5 relative">
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
          {titulo} {items.length > 0 && `(${items.length})`}
        </span>
        <button
          type="button"
          onClick={() => setSelectorAbierto((v) => !v)}
          title={`Agregar ${titulo.toLowerCase()}`}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-primary/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
        >
          <Plus size={13} />
        </button>
        {selectorAbierto && (
          <SelectorGrupoVinculado
            catalogo={catalogo}
            yaVinculadosIds={new Set(items.map((i) => i.id))}
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

      {descripcion && <p className="text-micro text-primary/30 mb-1.5 -mt-1">{descripcion}</p>}

      {loading ? (
        <p className="text-micro text-primary/25 italic py-2">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-micro text-primary/25 italic py-2">Sin habilidades vinculadas todavía.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map((item) => (
            <TarjetaReaccionVinculada
              key={item.vinculo_id}
              reaccion={item}
              onUpdate={onUpdate}
              onDelete={() => onDelete(item.vinculo_id)}
              compuestos={compuestos}
              elementos={elementos}
              onAbrirItem={onAbrirItem}
              onAbrirReaccion={onAbrirReaccion}
            />
          ))}
        </div>
      )}
    </div>
  );
}
