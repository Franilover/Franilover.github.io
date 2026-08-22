"use client";

/**
 * GruposCompuestosPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Ya NO existe la sub-sección de página "Grupos de compuestos" (la tabla
 * "grupos_compuestos" fue eliminada de Supabase — reemplazada por
 * "estructuras_ensambladas" y "reacciones", ver elementos/types.ts). Este
 * archivo solo sobrevive por GrupoCompuestoPanelFlotante: el modal genérico
 * de edición de fórmula (chips + stepper vía SelectorFormulaOrgano) que
 * reutilizan MineralEditor, EditorItem, EditorCriatura, FloraEditor y
 * GridCatalogoGrupo para editar una EstructuraEnsamblada o Reaccion ya
 * vinculada — recibe todo por props (grupo, onActualizar, onEliminar), no
 * toca ninguna tabla directamente, así que sigue siendo válido tal cual.
 */

import { Boxes, Plus, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import { SelectorFormulaOrgano, type ComponenteOrgano } from "@/domains/garlia/flora/SelectorFormulaOrgano";

import type { Compuesto, GrupoCompuesto } from "./types";

/**
 * Panel flotante centrado del detalle de un Grupo de Compuestos — mismo
 * comportamiento visual que ElementoPanelFlotante/CompuestoPanelFlotante en
 * ElementosPage.tsx: modal centrado con backdrop blur, cierra con click en
 * el backdrop, Escape, o el botón X. Más liviano que esos dos (sin
 * EditorHeaderBar) porque acá el "editor" es solo nombre + fórmula + notas.
 */
export function GrupoCompuestoPanelFlotante({
  grupo,
  compuestos,
  onCerrar,
  onActualizar,
  onEliminar,
  onAbrirCompuesto,
}: {
  grupo: GrupoCompuesto;
  compuestos: Compuesto[];
  onCerrar: () => void;
  onActualizar: (id: string, cambios: Partial<GrupoCompuesto>) => void;
  onEliminar?: (id: string) => void;
  onAbrirCompuesto?: (compuestoId: string) => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onCerrar]);

  function agregarComponente() {
    const componentes = grupo.componentes ?? [];
    const elegidos = new Set(componentes.map((c) => c.compuesto_id));
    const primero = compuestos.find((c) => !elegidos.has(c.id)) ?? compuestos[0];
    if (!primero) return;
    onActualizar(grupo.id, {
      componentes: [...componentes, { compuesto_id: primero.id, cantidad: 1 }],
    });
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
      style={{
        background: "color-mix(in srgb, var(--primary) 35%, transparent)",
        backdropFilter: "blur(8px)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        className="w-full max-w-xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: "var(--bg-main)",
          border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
          animation: "popIn 160ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Header: ícono + nombre editable + eliminar + cerrar */}
        <div
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
          }}
        >
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              background: "color-mix(in srgb, var(--primary) 8%, transparent)",
              borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
            }}
          >
            <Boxes className="text-primary/50" size={12} />
          </div>
          <input
            className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
            placeholder="Nombre del grupo (ej: Base floral)…"
            value={grupo.nombre ?? ""}
            onChange={(e) => onActualizar(grupo.id, { nombre: e.target.value })}
          />
          {onEliminar && (
            <button
              type="button"
              onClick={() => onEliminar(grupo.id)}
              title="Eliminar grupo"
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all cursor-pointer"
            >
              <Trash2 size={10} />
            </button>
          )}
          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar (Esc)"
            className="shrink-0 p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/8 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Contenido: fórmula + notas */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-micro font-black uppercase tracking-widest text-primary/40">
                Fórmula
              </p>
              <button
                type="button"
                onClick={agregarComponente}
                disabled={compuestos.length === 0}
                title="Agregar compuesto"
                className="w-6 h-6 flex items-center justify-center rounded text-primary/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={13} />
              </button>
            </div>
            <SelectorFormulaOrgano
              compuestos={compuestos}
              componentes={(grupo.componentes ?? []) as ComponenteOrgano[]}
              onChange={(componentes) => onActualizar(grupo.id, { componentes })}
              onAbrirCompuesto={onAbrirCompuesto}
              ocultarBotonAgregar
            />
          </div>

          <div>
            <p className="text-micro font-black uppercase tracking-widest text-primary/40 mb-1.5">
              Notas
            </p>
            <textarea
              className="w-full min-h-[6rem] bg-transparent px-0 py-1 text-xs text-primary/70 resize-none outline-none transition-colors placeholder:text-primary/25"
              placeholder="Notas del grupo…"
              value={grupo.notas ?? ""}
              onChange={(e) => onActualizar(grupo.id, { notas: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
