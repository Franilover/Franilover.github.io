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

import { Atom, Download, Loader2, Plus } from "lucide-react";
import React, { useMemo, useState } from "react";

import { ElementoEditor } from "./ElementoEditor";
import { formatLayer, type Elemento } from "./types";

// ─── Descarga: todos los elementos de la Tabla Química en un solo JSON ─────
function descargarDatosElementos(elementos: Elemento[]) {
  const payload = {
    exportado_en: new Date().toISOString(),
    elementos,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tabla-elementos-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

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
function ElementoCasilla({
  elemento,
  seleccionado,
  onClick,
}: {
  elemento: Elemento;
  seleccionado?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-stretch gap-0.5 p-1.5 rounded-md border transition-colors text-left ${
        seleccionado
          ? "border-primary/50 bg-primary/10 ring-2 ring-primary/40"
          : "border-primary/10 bg-primary/[0.02] hover:bg-primary/5 hover:border-primary/25"
      }`}
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

      <span className="text-base font-black text-primary text-center leading-none py-0.5">
        {elemento.simbolo || "??"}
      </span>

      <span className="text-micro font-bold text-primary/80 truncate text-center leading-tight">
        {elemento.nombre}
      </span>

      <div className="mt-0.5 pt-0.5 border-t border-primary/10 flex flex-col gap-0.5">
        <span className="text-micro text-primary/40 truncate leading-tight">
          <span className="text-primary/25">N</span> {formatLayer(elemento.nucleo)}
        </span>
        <span className="text-micro text-primary/40 truncate leading-tight">
          <span className="text-primary/25">M</span> {formatLayer(elemento.media)}
        </span>
        <span className="text-micro text-primary/40 truncate leading-tight">
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

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden relative">
      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-primary/40">
            <Atom size={12} />
            <p className="text-micro font-black uppercase tracking-widest">
              Tabla Química · {elementos.length} elementos
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => descargarDatosElementos(elementos)}
              title="Descargar todos los datos de la Tabla Química como JSON"
              className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
            >
              <Download size={10} />
              <span className="hidden sm:inline">Descargar datos</span>
            </button>
            {onCreate && (
              <button
                type="button"
                disabled={creating}
                onClick={onCreate}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {creating ? <Loader2 className="animate-spin" size={10} /> : <Plus size={10} />}
                Nuevo elemento
              </button>
            )}
          </div>
        </div>

        {loading && elementos.length === 0 ? (
          <div className="py-6 text-micro text-primary/30 text-center">Cargando…</div>
        ) : elementos.length === 0 ? (
          <div className="py-6 text-micro text-primary/25 text-center">
            Todavía no hay elementos cargados.
          </div>
        ) : (
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(68px, 1fr))" }}
          >
            {elementos.map((el) => (
              <ElementoCasilla
                key={el.id}
                elemento={el}
                seleccionado={el.id === activoId}
                onClick={() =>
                  setSeleccionadoId((actual) => (actual === el.id ? null : el.id))
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Panel lateral: overlay + drawer a la derecha con el detalle del
          elemento seleccionado. No reemplaza el grid — queda visible
          detrás, para poder seguir eligiendo otros elementos. */}
      {activo && (
        <>
          <div
            className="absolute inset-0 z-30 md:hidden"
            style={{ background: "color-mix(in srgb, var(--primary) 20%, transparent)" }}
            onClick={() => setSeleccionadoId(null)}
          />
          <div
            className="absolute md:sticky md:top-0 inset-y-0 right-0 z-40 flex flex-col w-full sm:w-[380px] md:w-[420px] shrink-0 border-l shadow-2xl md:shadow-none md:h-full md:self-start"
            style={{
              background: "var(--white-custom, var(--bg-main))",
              borderColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
            }}
          >
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
          </div>
        </>
      )}
    </div>
  );
}
