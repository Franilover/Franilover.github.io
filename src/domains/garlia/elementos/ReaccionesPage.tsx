"use client";

/**
 * ReaccionesPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Sub-sección "Reacciones" dentro de Química, apilada debajo de Grupos de
 * Compuestos: catálogo de recetas reutilizables de consume/produce (ej.
 * "Fotosíntesis básica" = consume Luz+Agua, produce Glucosa+Oxígeno).
 *
 * Reacción es un concepto independiente de Proceso (no una etapa obligatoria
 * dentro de él, ver documentacion_sistema #1120): representa una
 * transformación material específica y puede vincularse opcionalmente desde
 * Procesos (Flora/Minerales) y Habilidades (Items) — editar la Reacción acá
 * actualiza todos los lugares que la usan, pero un Proceso sin Reacción
 * asociada es un estado normal, no incompleto.
 *
 * Mismo patrón visual que GruposCompuestosPage: pills + panel flotante
 * centrado con el detalle (SelectorConsumeProduce + BalanceProcesoPanel +
 * notas), en vez de un grid de tabla química.
 */

import { Beaker, Loader2, Plus, Trash2, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { SelectorConsumeProduce, type ItemProceso } from "@/domains/garlia/flora/SelectorConsumeProduce";
import { BalanceProcesoPanel } from "@/domains/garlia/_shared/BalanceProcesoPanel";

import type { Compuesto, Elemento, Reaccion } from "./types";
import { persistirReaccion } from "./persistirReaccion";

interface Props {
  reacciones: Reaccion[];
  compuestos: Compuesto[];
  elementos: Elemento[];
  loading?: boolean;
  creating?: boolean;
  onCreate?: () => void;
  onActualizar: (id: string, cambios: Partial<Reaccion>) => void;
  onEliminar?: (id: string) => void;
  onAbrirItem?: (item: ItemProceso) => void;
}

/**
 * Pill compacta de reacción: solo el nombre, mismo lenguaje visual que
 * GrupoCompuestoPill — el detalle completo vive en el panel flotante.
 */
function ReaccionPill({
  reaccion,
  seleccionado,
  onClick,
}: {
  reaccion: Reaccion;
  seleccionado?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={reaccion.nombre || "(sin nombre)"}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-micro font-bold tracking-wide transition-colors truncate max-w-full ${
        seleccionado
          ? "text-primary border border-primary/40 ring-2 ring-primary/30"
          : "hover:bg-primary/10 text-primary/70 border border-primary/15"
      }`}
    >
      <Beaker size={10} className="text-primary/40 shrink-0" />
      <span className="truncate">{reaccion.nombre || "(sin nombre)"}</span>
    </button>
  );
}

export function ReaccionesPage({
  reacciones,
  compuestos,
  elementos,
  loading,
  creating,
  onCreate,
  onActualizar,
  onEliminar,
  onAbrirItem,
}: Props) {
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  // Persiste en Supabase y recién después actualiza el estado local del
  // padre — mismo patrón que guardar() en GruposCompuestosPage.
  async function guardar(id: string, cambios: Partial<Reaccion>) {
    onActualizar(id, cambios); // optimista: refleja el cambio ya mismo
    const { error } = await persistirReaccion(id, cambios);
    if (error) {
      console.error("[ReaccionesPage] error guardando reacción:", error);
    }
  }

  const activo = useMemo(
    () => reacciones.find((r) => r.id === seleccionadoId) ?? null,
    [reacciones, seleccionadoId],
  );

  // Si se crea una reacción nueva, abrirla automáticamente — mismo espíritu
  // que GruposCompuestosPage.
  const idsConocidosRef = React.useRef(new Set(reacciones.map((r) => r.id)));
  useEffect(() => {
    const nueva = reacciones.find((r) => !idsConocidosRef.current.has(r.id));
    idsConocidosRef.current = new Set(reacciones.map((r) => r.id));
    if (nueva) setSeleccionadoId(nueva.id);
  }, [reacciones]);

  return (
    <div className="p-3 flex flex-col gap-3">
      {loading && reacciones.length === 0 ? (
        <div className="py-6 text-micro text-primary/30 text-center">Cargando…</div>
      ) : reacciones.length === 0 ? (
        <div className="py-6 text-micro text-primary/25 text-center">
          Todavía no hay reacciones creadas. Una Reacción es opcional: representa una
          transformación material específica (consume/produce) y puede vincularse a un
          Proceso, pero no todo Proceso necesita una.
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {reacciones.map((reaccion) => (
            <ReaccionPill
              key={reaccion.id}
              reaccion={reaccion}
              seleccionado={reaccion.id === seleccionadoId}
              onClick={() => setSeleccionadoId((actual) => (actual === reaccion.id ? null : reaccion.id))}
            />
          ))}
        </div>
      )}

      {activo && (
        <ReaccionPanelFlotante
          reaccion={activo}
          compuestos={compuestos}
          elementos={elementos}
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
          onAbrirItem={onAbrirItem}
        />
      )}
    </div>
  );
}

/**
 * Panel flotante centrado del detalle de una Reacción — mismo comportamiento
 * visual que GrupoCompuestoPanelFlotante: modal centrado con backdrop blur,
 * cierra con click en el backdrop, Escape, o el botón X.
 */
export function ReaccionPanelFlotante({
  reaccion,
  compuestos,
  elementos,
  onCerrar,
  onActualizar,
  onEliminar,
  onAbrirItem,
}: {
  reaccion: Reaccion;
  compuestos: Compuesto[];
  elementos: Elemento[];
  onCerrar: () => void;
  onActualizar: (id: string, cambios: Partial<Reaccion>) => void;
  onEliminar?: (id: string) => void;
  onAbrirItem?: (item: ItemProceso) => void;
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
        className="w-full h-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
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
            <Beaker className="text-primary/50" size={12} />
          </div>
          <input
            className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
            placeholder="Nombre de la reacción (ej: Fotosíntesis básica)…"
            value={reaccion.nombre ?? ""}
            onChange={(e) => onActualizar(reaccion.id, { nombre: e.target.value })}
          />
          {onEliminar && (
            <button
              type="button"
              onClick={() => onEliminar(reaccion.id)}
              title="Eliminar reacción"
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

        {/* Contenido: consume + produce + balance + notas, en 2 columnas
            para coherencia con Elemento/Compuesto — no una pila vertical. */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5">
          <div className="grid grid-cols-2 gap-3 items-start">
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex flex-col gap-1.5 min-w-0 p-2">
                <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                  Consume
                </span>
                <SelectorConsumeProduce
                  label="Consume"
                  items={(reaccion.consume ?? []) as ItemProceso[]}
                  onChange={(consume) => onActualizar(reaccion.id, { consume })}
                  elementos={elementos}
                  compuestos={compuestos}
                  onAbrirItem={onAbrirItem}
                />
              </div>

              <div className="flex flex-col gap-1.5 min-w-0 p-2">
                <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                  Produce
                </span>
                <SelectorConsumeProduce
                  label="Produce"
                  items={(reaccion.produce ?? []) as ItemProceso[]}
                  onChange={(produce) => onActualizar(reaccion.id, { produce })}
                  elementos={elementos}
                  compuestos={compuestos}
                  onAbrirItem={onAbrirItem}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex flex-col gap-1.5 min-w-0 p-2">
                <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                  Balance
                </span>
                <BalanceProcesoPanel
                  consume={(reaccion.consume ?? []) as ItemProceso[]}
                  produce={(reaccion.produce ?? []) as ItemProceso[]}
                  compuestos={compuestos}
                  elementos={elementos}
                  onAutocompletar={(produce) => onActualizar(reaccion.id, { produce })}
                />
              </div>

              <div className="flex flex-col gap-1.5 min-w-0 p-2">
                <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                  Descripción
                </span>
                <textarea
                  className="w-full min-h-[5rem] bg-transparent px-0 py-1 text-micro leading-relaxed text-primary/70 resize-none outline-none transition-colors placeholder:text-primary/25"
                  placeholder="Condiciones, notas, contexto de esta reacción…"
                  value={reaccion.descripcion ?? ""}
                  onChange={(e) => onActualizar(reaccion.id, { descripcion: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
