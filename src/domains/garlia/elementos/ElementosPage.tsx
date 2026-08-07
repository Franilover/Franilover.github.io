"use client";

/**
 * ElementosPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Vista de la sección "Tabla" (Tabla Química/Alquímica): grid de los 29
 * elementos + detalle inline al seleccionar uno (capas núcleo/media/externa
 * editables). Mismo patrón que RunasPage: sin navegar a otra ruta, toggle
 * de selección adentro de la misma página.
 *
 * Pensado para crecer con tabs hermanas (Iums, Simulador de reacciones) —
 * ver PanelSubTabsElementos más abajo, hoy con un solo tab activo.
 */

import { Atom, Loader2, Plus } from "lucide-react";
import React, { useMemo, useState } from "react";

import { ElementoEditor } from "./ElementoEditor";
import { formatLayer, type Elemento } from "./types";

interface Props {
  elementos: Elemento[];
  loading?: boolean;
  creating?: boolean;
  onCreate?: () => void;
  onActualizar: (id: string, cambios: Partial<Elemento>) => void;
  onEliminar?: (id: string) => void;
  /** Id a dejar seleccionado tras crear (mismo patrón que runaRecienCreadaId). */
  seleccionarId?: string | null;
}

/**
 * Casilla tipo tabla periódica: símbolo (abreviatura) grande y centrado en
 * vez de imagen/ícono genérico, con número atómico arriba y las 3 capas
 * resumidas abajo — toda la info clave visible sin entrar al detalle.
 * Reemplaza a EntityCard/EntityCardGrid acá porque esas dos asumen
 * imagen-o-ícono + una sola línea de subtítulo, insuficiente para lo que
 * se quiere mostrar por elemento.
 */
function ElementoCasilla({ elemento, onClick }: { elemento: Elemento; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-stretch gap-1 p-2 rounded-lg border border-primary/10 bg-primary/[0.02] hover:bg-primary/5 hover:border-primary/25 transition-colors text-left"
    >
      <div className="flex items-start justify-between">
        <span className="text-micro font-black text-primary/30 tabular-nums">
          #{elemento.numero_atomico}
        </span>
        {elemento.es_noble && (
          <span
            title="Noble"
            className="w-1.5 h-1.5 rounded-full bg-accent/70 shrink-0 mt-0.5"
          />
        )}
      </div>

      <span className="text-xl font-black text-primary text-center leading-none py-1">
        {elemento.simbolo || "??"}
      </span>

      <span className="text-xs font-bold text-primary/80 truncate text-center leading-tight">
        {elemento.nombre}
      </span>

      <div className="mt-1 pt-1 border-t border-primary/10 flex flex-col gap-0.5">
        <span className="text-[9px] text-primary/40 truncate leading-tight">
          <span className="text-primary/25">N</span> {formatLayer(elemento.nucleo)}
        </span>
        <span className="text-[9px] text-primary/40 truncate leading-tight">
          <span className="text-primary/25">M</span> {formatLayer(elemento.media)}
        </span>
        <span className="text-[9px] text-primary/40 truncate leading-tight">
          <span className="text-primary/25">E</span> {formatLayer(elemento.externa)}
        </span>
      </div>
    </button>
  );
}

export function ElementosPage({
  elementos,
  loading,
  creating,
  onCreate,
  onActualizar,
  onEliminar,
  seleccionarId,
}: Props) {
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  const activoId = seleccionadoId ?? seleccionarId ?? null;
  const activo = useMemo(
    () => elementos.find((e) => e.id === activoId) ?? null,
    [elementos, activoId],
  );

  if (activo) {
    return (
      <ElementoEditor
        elemento={activo}
        onBack={() => setSeleccionadoId(null)}
        onActualizar={onActualizar}
        onEliminar={
          onEliminar
            ? (id) => {
                onEliminar(id);
                setSeleccionadoId(null);
              }
            : undefined
        }
      />
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-primary/40">
          <Atom size={13} />
          <p className="text-micro font-black uppercase tracking-widest">
            Tabla Química · {elementos.length} elementos
          </p>
        </div>
        {onCreate && (
          <button
            type="button"
            disabled={creating}
            onClick={onCreate}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {creating ? <Loader2 className="animate-spin" size={11} /> : <Plus size={11} />}
            Nuevo elemento
          </button>
        )}
      </div>

      {loading && elementos.length === 0 ? (
        <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>
      ) : elementos.length === 0 ? (
        <div className="py-6 text-xs text-primary/25 text-center">
          Todavía no hay elementos cargados.
        </div>
      ) : (
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))" }}
        >
          {elementos.map((el) => (
            <ElementoCasilla
              key={el.id}
              elemento={el}
              onClick={() => setSeleccionadoId(el.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
