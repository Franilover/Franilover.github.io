"use client";

/**
 * SeccionGruposVinculados.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Bloque completo "título + botón agregar + lista" para una relación N:N con
 * el catálogo de GrupoCompuesto (ver useEntidadVinculosGrupo). Pensado para
 * insertarse directo en un editor (ej. EditorItem) sin repetir el fontanería
 * de abrir/cerrar el popover y armar cada tarjeta.
 */

import { Plus, type LucideIcon } from "lucide-react";
import React, { useState } from "react";

import type { Compuesto, GrupoCompuesto } from "@/domains/garlia/elementos/types";
import { SelectorGrupoVinculado } from "@/domains/garlia/_shared/SelectorGrupoVinculado";
import { TarjetaGrupoVinculado } from "@/domains/garlia/_shared/TarjetaGrupoVinculado";
import type { GrupoVinculadoResuelto } from "@/domains/garlia/_shared/useEntidadVinculosGrupo";

export function SeccionGruposVinculados({
  titulo,
  descripcion,
  icono,
  items,
  catalogo,
  loading,
  compuestos,
  gruposCompuestos,
  onCrearNuevo,
  onUsarExistente,
  onUpdate,
  onDelete,
  onAbrirCompuesto,
  placeholderNombre,
  placeholderNotas,
  labelCrear,
  labelExistente,
  labelBuscar,
}: {
  titulo: string;
  descripcion?: string;
  icono: LucideIcon;
  items: GrupoVinculadoResuelto[];
  /** Catálogo completo (ya filtrado por tipo) para el picker "usar existente". */
  catalogo: GrupoCompuesto[];
  loading?: boolean;
  compuestos: Compuesto[];
  /** Catálogo genérico para el botón "Usar grupo" dentro de cada fórmula (opcional). */
  gruposCompuestos?: GrupoCompuesto[];
  onCrearNuevo: () => void;
  onUsarExistente: (grupoCompuestoId: string) => void;
  onUpdate: (id: string, updates: Partial<GrupoCompuesto>) => void;
  onDelete: (vinculoId: string) => void;
  onAbrirCompuesto?: (compuestoId: string) => void;
  placeholderNombre?: string;
  placeholderNotas?: string;
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
        <p className="text-micro text-primary/25 italic py-2">Nada definido todavía.</p>
      ) : (
        <div className="divide-y divide-primary/10">
          {items.map((item) => (
            <TarjetaGrupoVinculado
              key={item.vinculo_id}
              grupo={item}
              onUpdate={onUpdate}
              onDelete={() => onDelete(item.vinculo_id)}
              compuestos={compuestos}
              onAbrirCompuesto={onAbrirCompuesto}
              gruposCompuestos={gruposCompuestos}
              placeholderNombre={placeholderNombre}
              placeholderNotas={placeholderNotas}
            />
          ))}
        </div>
      )}
    </div>
  );
}
