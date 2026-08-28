"use client";

import { Box, Loader2, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { PropiedadesFisicasGenerico } from "@/domains/garlia/_shared/GridPropiedadesCalculadas";

import { useEstructuraComposicion } from "./useEstructuraComposicion";
import { useEstructuras } from "./useEstructuras";
import type { Estructura } from "./types";

const ESTADO_LABEL: Record<string, string> = {
  calculado: "Calculado",
  calculable: "Calculado",
  pendiente: "Pendiente",
};

/**
 * Composición real de la estructura (tabla puente estructura_compuestos):
 * de qué Compuestos está hecha, con su rol y proporción — mismo criterio
 * de solo lectura que ComposicionRealBloque en CompuestosPage. La
 * estructura hereda magnitudes/propiedades del compuesto que la
 * constituye (ver documentacion_sistema "Derivación canónica
 * estructura→compuesto", orden 279): no toda propiedad es heredable, solo
 * las declaradas compatibles, por eso esto se muestra aparte de las
 * propiedades físicas propias de arriba, no mezclado con ellas.
 */
function ComposicionEstructuraBloque({ estructuraId }: { estructuraId: string }) {
  const { items, loading } = useEstructuraComposicion(estructuraId);

  return (
    <div className="flex flex-col gap-1.5 min-w-0 p-2">
      <div className="flex items-center gap-1.5">
        <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
          Compuestos
        </span>
      </div>
      {loading ? (
        <div className="flex items-center gap-1.5 py-2 text-micro text-primary/40">
          <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
        </div>
      ) : items.length === 0 ? (
        <p className="py-1 text-micro text-primary/30">Sin compuestos asociados.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <div
              key={item.vinculo_id}
              className="flex items-center justify-between gap-2 rounded-md border border-primary/10 px-2 py-1"
            >
              <span className="text-micro font-bold text-primary/70 truncate">{item.compuesto.nombre}</span>
              <span className="text-micro text-primary/45 shrink-0">
                {item.rol ?? ""}
                {item.proporcion != null ? ` · ${item.proporcion}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EstructuraDetail({ estructura }: { estructura: Estructura }) {
  const propiedades = estructura.propiedades_calculadas ?? {};
  const estadoCalculo = estructura.estado_calculo ?? "pendiente";

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-micro text-primary/40">
            {estructura.tipo && (
              <span className="rounded px-1.5 py-0.5 bg-primary/5 font-bold">{estructura.tipo}</span>
            )}
            <span className="rounded px-1.5 py-0.5 bg-primary/5 font-bold">
              {ESTADO_LABEL[estadoCalculo] ?? estadoCalculo}
            </span>
          </div>
          {estructura.descripcion && (
            <p className="mt-1.5 text-xs leading-relaxed text-primary/55">{estructura.descripcion}</p>
          )}
          {estructura.funcion && (
            <p className="mt-1 text-xs leading-relaxed text-primary/45">
              <span className="font-bold text-primary/55">Función: </span>
              {estructura.funcion}
            </p>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 items-start">
        <div className="flex flex-col gap-2 min-w-0">
          <PropiedadesFisicasGenerico propiedades={propiedades} columnas={2} />
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <ComposicionEstructuraBloque estructuraId={estructura.id} />
          {estructura.notas && (
            <div className="flex flex-col gap-1.5 min-w-0 p-2">
              <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                Notas
              </span>
              <p className="whitespace-pre-wrap text-micro leading-relaxed text-primary/50">
                {estructura.notas}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Mismo shell exacto que el resto de paneles flotantes del dominio
 *  (Elemento/Compuesto/Material/Fenómeno/Proceso): createPortal a
 *  document.body, fixed inset-0 z-[9999] con backdrop blur, contenedor
 *  w-full h-full max-w-6xl rounded-2xl, header shrink-0 con caja de ícono
 *  7×7 + botón cerrar, cuerpo flex-1 overflow-y-auto. Estructuras es de
 *  solo lectura (propiedades_calculadas viene de Supabase), por eso usa el
 *  header "default" (caja de ícono), no el sistema headerControls
 *  editable — mismo criterio que MaterialEditorFlotante. */
function EstructuraPanelFlotante({
  estructura,
  onClose,
}: {
  estructura: Estructura;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
      style={{
        background: "color-mix(in srgb, var(--primary) 35%, transparent)",
        backdropFilter: "blur(8px)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full h-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: "var(--bg-main)",
          border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
          animation: "popIn 160ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
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
            <Box className="text-primary/50" size={12} />
          </div>
          <span className="flex-1 min-w-0 truncate text-sm font-black text-primary">
            {estructura.nombre}
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar (Esc)"
            className="shrink-0 p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/8 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2.5">
          <EstructuraDetail estructura={estructura} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function EstructurasPage() {
  const { items, loading } = useEstructuras();
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const seleccionada = items.find((e) => e.id === seleccionadaId) ?? null;

  return (
    <div className="px-3 pb-4 pt-2">
      {loading ? (
        <p className="py-5 text-center text-micro text-primary/35">Cargando…</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.map((estructura) => (
            <button
              key={estructura.id}
              type="button"
              onClick={() => setSeleccionadaId(estructura.id)}
              title={estructura.nombre}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-micro font-bold tracking-wide transition-colors truncate max-w-full ${
                estructura.id === seleccionadaId
                  ? "text-primary border border-primary/40 ring-2 ring-primary/30"
                  : "hover:bg-primary/10 text-primary/70 border border-primary/15"
              }`}
            >
              <span className="truncate">{estructura.nombre}</span>
            </button>
          ))}
        </div>
      )}
      {seleccionada && (
        <EstructuraPanelFlotante estructura={seleccionada} onClose={() => setSeleccionadaId(null)} />
      )}
    </div>
  );
}
