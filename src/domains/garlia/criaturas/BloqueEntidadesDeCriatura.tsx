"use client";

/**
 * BloqueEntidadesDeCriatura.tsx
 * ───────────────────────────────
 * Agrupador visual "Criatura → Entidades". Muestra, dentro del editor de
 * Criatura, al mismo nivel:
 *   - Ítems que tienen a esta criatura como origen directo (columna
 *     `criatura_id`).
 *   - Flora y Minerales de todo Ecosistema donde esta criatura habita
 *     (vía Ecosistema.flora_ids / mineral_ids).
 * Todo de solo lectura + navegación — la edición del vínculo vive en el
 * editor de cada entidad (selector "Criatura" en Ítems, selector
 * "Criaturas que lo habitan" en Ecosistema).
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/criaturas/BloqueEntidadesDeCriatura.tsx
 */

import { Gem, Leaf, Loader2, Package } from "lucide-react";
import Image from "next/image";
import React from "react";

import {
  useEntidadesDeCriatura,
  type EntidadDeCriaturaMin,
} from "@/domains/garlia/criaturas/useEntidadesDeCriatura";

type TipoNavegable = "items" | "flora" | "minerales";

function ColumnaEntidades({
  Icon,
  label,
  entidades,
  tipo,
  onNavigate,
}: {
  Icon: React.ElementType;
  label: string;
  entidades: EntidadDeCriaturaMin[];
  tipo: TipoNavegable;
  onNavigate?: (tipo: TipoNavegable, id: string) => void;
}) {
  if (entidades.length === 0) return null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
        background: "color-mix(in srgb, var(--primary) 2%, transparent)",
      }}
    >
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5"
        style={{
          borderBottom: "1px solid color-mix(in srgb, var(--primary) 6%, transparent)",
        }}
      >
        <Icon size={10} style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }} />
        <span
          className="text-micro font-black uppercase tracking-widest"
          style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
        >
          {label}
        </span>
        <span className="ml-auto text-micro font-black tabular-nums" style={{ color: "var(--primary)" }}>
          {entidades.length}
        </span>
      </div>
      <div className="p-1.5 space-y-1 max-h-40 overflow-y-auto">
        {entidades.map((e) => (
          <button
            key={e.id}
            className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded-lg text-left transition-all hover:bg-primary/5"
            type="button"
            onClick={() => onNavigate?.(tipo, e.id)}
          >
            <div className="shrink-0 w-4 h-4 rounded-full overflow-hidden border border-primary/10 bg-primary/5 flex items-center justify-center">
              {e.imagen_url ? (
                <Image alt={e.nombre} className="w-full h-full object-cover" height={16} src={e.imagen_url} width={16} />
              ) : (
                <Icon className="text-primary/20" size={8} />
              )}
            </div>
            <span
              className="flex-1 min-w-0 text-micro font-bold truncate"
              style={{ color: "color-mix(in srgb, var(--primary) 65%, transparent)" }}
            >
              {e.nombre}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function BloqueEntidadesDeCriatura({
  criaturaId,
  onNavigate,
}: {
  criaturaId: string;
  /** Navega al editor de la entidad (ítem, flora o mineral) */
  onNavigate?: (tipo: TipoNavegable, id: string) => void;
}) {
  const { grupos, total, loading } = useEntidadesDeCriatura(criaturaId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="animate-spin text-primary/20" size={14} />
      </div>
    );
  }

  if (total === 0) return null;

  return (
    <div className="space-y-3">
      <p
        className="text-micro font-black uppercase tracking-[0.25em]"
        style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
      >
        Vinculados a esta criatura
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ColumnaEntidades
          Icon={Package}
          label="Ítems"
          entidades={grupos.items}
          tipo="items"
          onNavigate={onNavigate}
        />
        <ColumnaEntidades
          Icon={Leaf}
          label="Flora"
          entidades={grupos.flora}
          tipo="flora"
          onNavigate={onNavigate}
        />
        <ColumnaEntidades
          Icon={Gem}
          label="Minerales"
          entidades={grupos.minerales}
          tipo="minerales"
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}
