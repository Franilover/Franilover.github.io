"use client";

/**
 * BloqueEntidadesDeCriatura.tsx
 * ───────────────────────────────
 * Agrupador visual "Criatura → Items". Muestra, dentro del editor de
 * Criatura, los ítems que tienen a esta criatura como origen directo
 * (columna `criatura_id`) — de solo lectura + navegación, ya que la edición
 * del vínculo vive en el selector "Criatura" del editor de cada ítem.
 *
 * Nota: Dones/Runas/Hechizos ya no se vinculan a criaturas — esa relación
 * fue eliminada.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/criaturas/BloqueEntidadesDeCriatura.tsx
 */

import { Loader2, Package } from "lucide-react";
import Image from "next/image";
import React from "react";

import {
  useEntidadesDeCriatura,
  type EntidadDeCriaturaMin,
} from "@/domains/garlia/criaturas/useEntidadesDeCriatura";

export function BloqueEntidadesDeCriatura({
  criaturaId,
  onNavigate,
}: {
  criaturaId: string;
  /** Navega al editor del ítem */
  onNavigate?: (tipo: "items", id: string) => void;
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
            <Package
              size={10}
              style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
            />
            <span
              className="text-micro font-black uppercase tracking-widest"
              style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
            >
              Ítems
            </span>
            <span
              className="ml-auto text-micro font-black tabular-nums"
              style={{ color: "var(--primary)" }}
            >
              {grupos.items.length}
            </span>
          </div>
          <div className="p-1.5 space-y-1 max-h-40 overflow-y-auto">
            {grupos.items.map((e: EntidadDeCriaturaMin) => (
              <button
                key={e.id}
                className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded-lg text-left transition-all hover:bg-primary/5"
                type="button"
                onClick={() => onNavigate?.("items", e.id)}
              >
                <div className="shrink-0 w-4 h-4 rounded-full overflow-hidden border border-primary/10 bg-primary/5 flex items-center justify-center">
                  {e.imagen_url ? (
                    <Image
                      alt={e.nombre}
                      className="w-full h-full object-cover"
                      height={16}
                      src={e.imagen_url}
                      width={16}
                    />
                  ) : (
                    <Package className="text-primary/20" size={8} />
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
      </div>
    </div>
  );
}
