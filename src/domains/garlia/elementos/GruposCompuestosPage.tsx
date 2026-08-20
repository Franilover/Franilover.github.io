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

import { Boxes, Loader2, Plus, Sprout, Gem, Trash2, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { supabase } from "@/infra/supabase/supabase";
import { SelectorFormulaOrgano, type ComponenteOrgano } from "@/domains/garlia/flora/SelectorFormulaOrgano";
import { SelectorTipoGrupoCompuesto } from "./SelectorTipoGrupoCompuesto";

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

/** Ícono según tipo — Boxes (genérico), Sprout (órgano), Gem (formación). */
function IconoTipoGrupo({ tipo }: { tipo: GrupoCompuesto["tipo"] }) {
  if (tipo === "organo") return <Sprout size={10} className="text-primary/40 shrink-0" />;
  if (tipo === "formacion") return <Gem size={10} className="text-primary/40 shrink-0" />;
  return <Boxes size={10} className="text-primary/40 shrink-0" />;
}

/**
 * Pill compacta de grupo: solo el nombre, mismo lenguaje visual que
 * CompuestoCasilla en CompuestosPage — la ficha completa (fórmula + notas)
 * vive en el panel flotante, no acá.
 */
function GrupoCompuestoPill({
  grupo,
  seleccionado,
  onClick,
}: {
  grupo: GrupoCompuesto;
  seleccionado?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={grupo.nombre || "(sin nombre)"}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-micro font-bold tracking-wide transition-colors truncate max-w-full ${
        seleccionado
          ? "text-primary border border-primary/40 ring-2 ring-primary/30"
          : "hover:bg-primary/10 text-primary/70 border border-primary/15"
      }`}
    >
      <IconoTipoGrupo tipo={grupo.tipo} />
      <span className="truncate">{grupo.nombre || "(sin nombre)"}</span>
    </button>
  );
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
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

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

  const activo = useMemo(
    () => grupos.find((g) => g.id === seleccionadoId) ?? null,
    [grupos, seleccionadoId],
  );

  // Si se crea un grupo nuevo, abrirlo automáticamente (mismo espíritu que
  // seleccionarId en ElementosPage/CompuestosPage) — acá alcanza con mirar
  // si apareció un id que todavía no conocíamos, sin prop extra.
  const idsConocidosRef = React.useRef(new Set(grupos.map((g) => g.id)));
  useEffect(() => {
    const nuevo = grupos.find((g) => !idsConocidosRef.current.has(g.id));
    idsConocidosRef.current = new Set(grupos.map((g) => g.id));
    if (nuevo) setSeleccionadoId(nuevo.id);
  }, [grupos]);

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
        <div className="flex flex-wrap gap-1">
          {grupos.map((grupo) => (
            <GrupoCompuestoPill
              key={grupo.id}
              grupo={grupo}
              seleccionado={grupo.id === seleccionadoId}
              onClick={() => setSeleccionadoId((actual) => (actual === grupo.id ? null : grupo.id))}
            />
          ))}
        </div>
      )}

      {activo && (
        <GrupoCompuestoPanelFlotante
          grupo={activo}
          compuestos={compuestos}
          onCerrar={() => setSeleccionadoId(null)}
          onActualizar={guardar}
          onEliminar={
            onEliminar
              ? (id) => {
                  onEliminar(id);
                  setSeleccionadoId(null);
                }
              : undefined
          }
          onAbrirCompuesto={onAbrirCompuesto}
        />
      )}
    </div>
  );
}

/**
 * Panel flotante centrado del detalle de un Grupo de Compuestos — mismo
 * comportamiento visual que ElementoPanelFlotante/CompuestoPanelFlotante en
 * ElementosPage.tsx: modal centrado con backdrop blur, cierra con click en
 * el backdrop, Escape, o el botón X. Más liviano que esos dos (sin
 * EditorHeaderBar) porque acá el "editor" es solo nombre + fórmula + notas.
 */
function GrupoCompuestoPanelFlotante({
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
          <SelectorTipoGrupoCompuesto
            value={grupo.tipo ?? "generico"}
            onChange={(tipo) => onActualizar(grupo.id, { tipo })}
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
