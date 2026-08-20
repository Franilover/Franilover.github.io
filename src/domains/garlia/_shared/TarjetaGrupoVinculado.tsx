"use client";

/**
 * TarjetaGrupoVinculado.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Generaliza OrganoCard (flora/FloraEditor.tsx) para cualquier
 * GrupoCompuesto vinculado N:N a una entidad — nombre libre, fórmula de
 * compuestos (SelectorFormulaOrgano) y notas. Editar acá afecta a todas las
 * entidades que tengan el mismo grupo vinculado (es el catálogo compartido).
 */

import { ExternalLink, Plus, Trash2 } from "lucide-react";
import React from "react";

import type { Compuesto, GrupoCompuesto } from "@/domains/garlia/elementos/types";
import {
  SelectorFormulaOrgano,
  type ComponenteOrgano,
} from "@/domains/garlia/flora/SelectorFormulaOrgano";
import type { GrupoVinculadoResuelto } from "@/domains/garlia/_shared/useEntidadVinculosGrupo";

export function TarjetaGrupoVinculado({
  grupo,
  onUpdate,
  onDelete,
  compuestos,
  onAbrirCompuesto,
  onAbrirGrupo,
  gruposCompuestos,
  placeholderNombre = "Nombre…",
  placeholderNotas = "Notas…",
  tituloEliminar = "Quitar de este ítem (sigue en el catálogo para otros ítems)",
}: {
  grupo: GrupoVinculadoResuelto;
  onUpdate: (id: string, updates: Partial<GrupoCompuesto>) => void;
  onDelete: () => void;
  compuestos: Compuesto[];
  onAbrirCompuesto?: (compuestoId: string) => void;
  /** Abre este grupo en el panel flotante (GrupoCompuestoPanelFlotante) —
   *  vista completa fuera de la tarjeta inline, útil cuando el grupo está
   *  vinculado a muchas entidades y se quiere editar desde un solo lugar. */
  onAbrirGrupo?: (grupoId: string) => void;
  gruposCompuestos?: GrupoCompuesto[];
  placeholderNombre?: string;
  placeholderNotas?: string;
  tituloEliminar?: string;
}) {
  function agregarComponente() {
    const componentes = (grupo.componentes ?? []) as ComponenteOrgano[];
    const elegidos = new Set(componentes.map((c) => c.compuesto_id));
    const primero = compuestos.find((c) => !elegidos.has(c.id)) ?? compuestos[0];
    if (!primero) return;
    onUpdate(grupo.id, {
      componentes: [...componentes, { compuesto_id: primero.id, cantidad: 1 }],
    });
  }

  return (
    <div className="group py-3 px-3 rounded-lg border border-primary/10 bg-primary/[0.02]">
      <div className="flex items-center justify-between mb-2 gap-2">
        <input
          className="min-w-0 flex-1 bg-transparent px-0 py-1 text-sm font-semibold text-primary/80 outline-none transition-colors placeholder:text-primary/25 placeholder:font-normal"
          placeholder={placeholderNombre}
          value={grupo.nombre ?? ""}
          onChange={(e) => onUpdate(grupo.id, { nombre: e.target.value })}
        />
        <div className="flex items-center gap-1 shrink-0">
          {onAbrirGrupo && (
            <button
              type="button"
              onClick={() => onAbrirGrupo(grupo.id)}
              title="Abrir en el editor flotante"
              className="w-6 h-6 flex items-center justify-center rounded text-primary/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            >
              <ExternalLink size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={agregarComponente}
            disabled={compuestos.length === 0}
            title="Agregar compuesto"
            className="w-6 h-6 flex items-center justify-center rounded text-primary/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={onDelete}
            title={tituloEliminar}
            className="p-1 rounded hover:bg-red-500/10 text-red-500/40 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-x-5 gap-y-2 text-xs items-start">
        <div>
          <SelectorFormulaOrgano
            compuestos={compuestos}
            componentes={(grupo.componentes ?? []) as ComponenteOrgano[]}
            onChange={(componentes) => onUpdate(grupo.id, { componentes })}
            onAbrirCompuesto={onAbrirCompuesto}
            ocultarBotonAgregar
            gruposCompuestos={gruposCompuestos}
          />
        </div>

        <div>
          <textarea
            className="w-full h-full min-h-[3.5rem] bg-transparent px-0 py-1 text-primary/70 resize-none outline-none transition-colors placeholder:text-primary/25"
            placeholder={placeholderNotas}
            value={grupo.notas ?? ""}
            onChange={(e) => onUpdate(grupo.id, { notas: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
