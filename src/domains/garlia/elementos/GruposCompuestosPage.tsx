"use client";

/**
 * GruposCompuestosPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Sub-sección "Grupos de compuestos" dentro de Química: catálogo de
 * conjuntos reutilizables de Compuestos (ej. "Base floral" = Fluxio×2 +
 * Cristalio×1). Se usan como fórmula ya armada desde Flora (Órganos) u
 * otros módulos, en vez de tener que reconstruir la mezcla cada vez.
 *
 * Mismo patrón visual simple que la tarjeta de Órgano en FloraEditor: lista
 * vertical con nombre editable + fórmula (chips + stepper, reutilizando
 * SelectorFormulaOrgano ya que comparte el shape {compuesto_id, cantidad})
 * + notas. Sin grid periódico ni laboratorio — es un catálogo chico y
 * directo, no una tabla química.
 */

import { Boxes, Loader2, Plus, Trash2 } from "lucide-react";
import React from "react";

import { supabase } from "@/infra/supabase/supabase";
import { SelectorFormulaOrgano, type ComponenteOrgano } from "@/domains/garlia/flora/SelectorFormulaOrgano";

import type { Compuesto, GrupoCompuesto } from "./types";

interface Props {
  grupos: GrupoCompuesto[];
  compuestos: Compuesto[];
  loading?: boolean;
  creating?: boolean;
  onCreate?: () => void;
  onActualizar: (id: string, cambios: Partial<GrupoCompuesto>) => void;
  onEliminar?: (id: string) => void;
  onAbrirCompuesto?: (compuestoId: string) => void;
}

export function GruposCompuestosPage({
  grupos,
  compuestos,
  loading,
  creating,
  onCreate,
  onActualizar,
  onEliminar,
  onAbrirCompuesto,
}: Props) {
  // Persiste en Supabase y recién después actualiza el estado local del
  // padre — mismo patrón que persist() en CompuestoPanelFlotante y
  // actualizarOrgano() en usePlantaOrganosProcesos. onActualizar (la prop)
  // solo sincroniza el estado en memoria; el guardado real vive acá.
  async function guardar(id: string, cambios: Partial<GrupoCompuesto>) {
    onActualizar(id, cambios); // optimista: refleja el cambio ya mismo
    const { error } = await supabase.from("grupos_compuestos").update(cambios).eq("id", id);
    if (error) {
      console.error("[GruposCompuestosPage] error guardando grupo de compuestos:", error);
    }
  }

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-primary/40">
          <p className="text-micro font-black uppercase tracking-widest">Grupos de compuestos</p>
        </div>
        {onCreate && (
          <button
            type="button"
            disabled={creating || compuestos.length === 0}
            onClick={onCreate}
            title={
              compuestos.length === 0
                ? "Primero cargá compuestos en la Tabla Química"
                : "Nuevo grupo de compuestos"
            }
            className="flex items-center justify-center p-1.5 rounded-md bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {creating ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
          </button>
        )}
      </div>

      {loading && grupos.length === 0 ? (
        <div className="py-6 text-micro text-primary/30 text-center">Cargando…</div>
      ) : grupos.length === 0 ? (
        <div className="py-6 text-micro text-primary/25 text-center">
          Todavía no hay grupos de compuestos creados.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
          {grupos.map((grupo) => (
            <div key={grupo.id} className="border-b border-primary/10">
              <GrupoCompuestoCard
                grupo={grupo}
                compuestos={compuestos}
                onUpdate={guardar}
                onDelete={onEliminar ? () => onEliminar(grupo.id) : undefined}
                onAbrirCompuesto={onAbrirCompuesto}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GrupoCompuestoCard({
  grupo,
  compuestos,
  onUpdate,
  onDelete,
  onAbrirCompuesto,
}: {
  grupo: GrupoCompuesto;
  compuestos: Compuesto[];
  onUpdate: (id: string, cambios: Partial<GrupoCompuesto>) => void;
  onDelete?: () => void;
  onAbrirCompuesto?: (compuestoId: string) => void;
}) {
  function agregarComponente() {
    const componentes = grupo.componentes ?? [];
    const elegidos = new Set(componentes.map((c) => c.compuesto_id));
    const primero = compuestos.find((c) => !elegidos.has(c.id)) ?? compuestos[0];
    if (!primero) return;
    onUpdate(grupo.id, {
      componentes: [...componentes, { compuesto_id: primero.id, cantidad: 1 }],
    });
  }

  return (
    <div className="group py-3">
      {/* Header: nombre del grupo (texto libre) + agregar compuesto + eliminar (hover) */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Boxes size={12} className="text-primary/25 shrink-0" />
          <input
            className="min-w-0 flex-1 bg-transparent px-0 py-1 text-sm font-semibold text-primary/80 outline-none transition-colors placeholder:text-primary/25 placeholder:font-normal"
            placeholder="Nombre del grupo (ej: Base floral)…"
            value={grupo.nombre ?? ""}
            onChange={(e) => onUpdate(grupo.id, { nombre: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={agregarComponente}
            disabled={compuestos.length === 0}
            title="Agregar compuesto"
            className="w-6 h-6 flex items-center justify-center rounded text-primary/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} />
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1 rounded hover:bg-red-500/10 text-red-500/40 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Contenido: grid de 2 columnas cuando hay ancho, sin cajas anidadas */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-x-5 gap-y-2 text-xs items-start">
        <div>
          <SelectorFormulaOrgano
            compuestos={compuestos}
            componentes={(grupo.componentes ?? []) as ComponenteOrgano[]}
            onChange={(componentes) => onUpdate(grupo.id, { componentes })}
            onAbrirCompuesto={onAbrirCompuesto}
            ocultarBotonAgregar
          />
        </div>

        <div>
          <textarea
            className="w-full h-full min-h-[3.5rem] bg-transparent px-0 py-1 text-primary/70 resize-none outline-none transition-colors placeholder:text-primary/25"
            placeholder="Notas del grupo…"
            value={grupo.notas ?? ""}
            onChange={(e) => onUpdate(grupo.id, { notas: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
