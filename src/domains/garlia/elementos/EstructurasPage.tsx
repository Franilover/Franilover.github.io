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
    <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
      <h3 className="text-sm font-semibold text-primary">Compuestos</h3>
      <p className="mt-1 text-xs text-primary/45">Composición de la que se deriva esta estructura</p>
      {loading ? (
        <div className="flex items-center gap-2 py-5 text-sm text-primary/45">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando compuestos…
        </div>
      ) : items.length === 0 ? (
        <p className="py-4 text-sm text-primary/40">Sin compuestos asociados.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div
              key={item.vinculo_id}
              className="flex items-center justify-between gap-3 rounded-lg border border-primary/10 px-3 py-2"
            >
              <span className="text-sm text-primary">{item.compuesto.nombre}</span>
              <span className="text-xs text-primary/50">
                {item.rol ?? ""}
                {item.proporcion != null ? ` · ${item.proporcion}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EstructuraDetail({ estructura }: { estructura: Estructura }) {
  const propiedades = estructura.propiedades_calculadas ?? {};
  const estadoCalculo = estructura.estado_calculo ?? "pendiente";

  return (
    <div className="space-y-4">
      <header className="border-b border-primary/10 pb-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg border border-primary/15 bg-primary/5 p-2">
            <Box className="h-5 w-5 text-primary/70" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-primary">{estructura.nombre}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-primary/45">
              {estructura.tipo && <span>{estructura.tipo}</span>}
              <span>{ESTADO_LABEL[estadoCalculo] ?? estadoCalculo}</span>
            </div>
          </div>
        </div>
        {estructura.descripcion && (
          <p className="mt-4 text-sm leading-relaxed text-primary/60">{estructura.descripcion}</p>
        )}
        {estructura.funcion && (
          <p className="mt-2 text-sm leading-relaxed text-primary/50">
            <span className="font-semibold text-primary/60">Función: </span>
            {estructura.funcion}
          </p>
        )}
      </header>

      <PropiedadesFisicasGenerico propiedades={propiedades} columnas={3} />
      <ComposicionEstructuraBloque estructuraId={estructura.id} />

      {estructura.notas && (
        <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
          <h3 className="text-sm font-semibold text-primary">Notas</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-primary/55">
            {estructura.notas}
          </p>
        </section>
      )}
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

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
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
