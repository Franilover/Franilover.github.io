"use client";

import {
  Box,
  ChevronRight,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { PropiedadesFisicasGenerico } from "@/domains/garlia/_shared/GridPropiedadesCalculadas";
import { useCompuestos } from "@/domains/garlia/elementos/useCompuestos";
import { useEstructuras } from "@/domains/garlia/elementos/useEstructuras";

import { useMaterialComponentes } from "./useMaterialComponentes";
import { useMaterialEstructuras } from "./useMaterialEstructuras";
import { useMateriales } from "./useMateriales";
import { usePerfilReactivoMaterial } from "./usePerfilReactivoMaterial";
import type { Material } from "./types";

/** Etiqueta legible para el origen de una propiedad física (ver
 *  documentacion_sistema "Fuente por propiedad en Material v187", orden
 *  421). No es un cálculo: es texto de presentación 1:1 sobre el valor
 *  que Supabase ya entrega en propiedades_calculadas.fuente_fisica. */
function etiquetaFuenteFisica(fuente: string | undefined): string | null {
  switch (fuente) {
    case "composicion":
      return "por composición";
    case "estructura":
      return "por estructura";
    case "estructura_y_composicion":
      return "estructura + composición";
    default:
      return fuente ?? null;
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(3);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/** Etiquetas legibles para los ejes del Perfil Reactivo Emergente V2. */
const EJES_PERFIL_REACTIVO = [
  ["afinidad_reactiva", "Afinidad reactiva"],
  ["dinamismo_reactivo", "Dinamismo reactivo"],
  ["estabilidad_reactiva", "Estabilidad reactiva"],
  ["conductividad_reactiva", "Conductividad reactiva"],
  ["actividad_catalitica_reactiva", "Actividad catalítica"],
  ["potencial_transicion_reactivo", "Potencial de transición"],
  ["potencial_transformacion_reactiva", "Potencial de transformación"],
] as const;

/**
 * Perfil Reactivo Emergente V2 (documentacion_sistema, orden 1101).
 *
 * No es una lista de etiquetas manuales tipo "inflamable/explosivo": son
 * ejes derivados de la microestructura del material, pensados para ser
 * consumidos por condiciones de procesos/reacciones/fenómenos. Cuando el
 * material no tiene desglose microscópico suficiente, el estado es
 * "insuficiente_informacion" y NO se muestra un perfil inventado — eso es
 * información propia del canon, no un vacío de UI.
 */
function MaterialPerfilReactivo({ materialId }: { materialId: string }) {
  const { item, loading } = usePerfilReactivoMaterial(materialId);

  return (
    <div className="flex flex-col gap-1.5 min-w-0 p-2">
      <div className="flex items-center gap-1.5">
        <Sparkles size={11} className="text-primary/40 shrink-0" />
        <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
          Perfil reactivo
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-1.5 py-2 text-micro text-primary/40">
          <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
        </div>
      ) : !item || item.estado !== "derivado_microestructura" || !item.perfil ? (
        <p className="py-1 text-micro text-primary/30">
          Información insuficiente: sin desglose microscópico suficiente todavía.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {EJES_PERFIL_REACTIVO.filter(([key]) => item.perfil?.[key] !== undefined).map(([key, label]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-1 min-w-0 px-2 py-1.5"
            >
              <span className="text-micro font-bold text-primary/50 truncate">{label}</span>
              <span className="text-micro font-black text-primary/70 tabular-nums shrink-0">
                {formatValue(item.perfil?.[key])}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MaterialDetail({ material }: { material: Material }) {
  const { items: componentes, loading: loadingComponentes } = useMaterialComponentes(material.id);
  const { items: estructuras, loading: loadingEstructuras } = useMaterialEstructuras(material.id);
  const { items: compuestos } = useCompuestos();
  const { items: estructurasCatalogo } = useEstructuras();

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-micro text-primary/40">
            <span className="rounded px-1.5 py-0.5 bg-primary/5 font-bold">{material.tipo_material}</span>
            <span className="rounded px-1.5 py-0.5 bg-primary/5 font-bold">
              {material.estado_calculo || "sin estado"}
            </span>
          </div>
          {material.descripcion && (
            <p className="mt-1.5 text-xs leading-relaxed text-primary/55">{material.descripcion}</p>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 items-start">
        <div className="flex flex-col gap-2 min-w-0">
          {(() => {
            const propiedades = material.propiedades_calculadas ?? {};
            const fuente = etiquetaFuenteFisica(propiedades.fuente_fisica as string | undefined);
            return (
              <>
                {fuente && (
                  <div className="flex justify-end">
                    <span
                      title="Origen de estos valores: composición química y/o estructura física del material"
                      className="shrink-0 rounded-full border border-primary/15 bg-primary/5 px-2 py-0.5 text-micro font-semibold text-primary/60"
                    >
                      {fuente}
                    </span>
                  </div>
                )}
                <PropiedadesFisicasGenerico propiedades={propiedades} columnas={2} />
              </>
            );
          })()}
          <MaterialPerfilReactivo materialId={material.id} />
        </div>

        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex flex-col gap-1.5 min-w-0 p-2">
            <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
              Componentes
            </span>
            {loadingComponentes ? (
              <div className="flex items-center gap-1.5 py-2 text-micro text-primary/40">
                <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
              </div>
            ) : componentes.length === 0 ? (
              <p className="py-1 text-micro text-primary/30">Sin componentes registrados.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {componentes.map((componente) => {
                  const compuesto =
                    componente.componente_tipo === "compuesto"
                      ? compuestos.find((item) => item.id === componente.componente_id)
                      : null;
                  return (
                    <div key={componente.id} className="px-2 py-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-micro font-bold text-primary/70 truncate">
                          {compuesto?.nombre ?? `${componente.componente_tipo} · ${componente.componente_id.slice(0, 8)}`}
                        </span>
                        <span className="text-micro text-primary/45 shrink-0">
                          {formatValue(componente.cantidad)}
                          {componente.unidad ? ` ${componente.unidad}` : ""}
                        </span>
                      </div>
                      {(componente.rol || componente.proporcion_min !== null || componente.proporcion_max !== null) && (
                        <div className="mt-0.5 flex flex-wrap gap-1.5 text-micro text-primary/35">
                          {componente.rol && <span>{componente.rol}</span>}
                          {componente.proporcion_min !== null && <span>mín. {formatValue(componente.proporcion_min)}</span>}
                          {componente.proporcion_max !== null && <span>máx. {formatValue(componente.proporcion_max)}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 min-w-0 p-2">
            <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
              Estructuras
            </span>
            {loadingEstructuras ? (
              <div className="flex items-center gap-1.5 py-2 text-micro text-primary/40">
                <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
              </div>
            ) : estructuras.length === 0 ? (
              <p className="py-1 text-micro text-primary/30">Sin estructuras asociadas.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {estructuras.map((relacion) => {
                  const estructura = estructurasCatalogo.find((item) => item.id === relacion.estructura_id);
                  return (
                    <div
                      key={relacion.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-primary/10 px-2 py-1"
                    >
                      <span className="text-micro font-bold text-primary/70 truncate">
                        {estructura?.nombre ?? relacion.estructura_id.slice(0, 8)}
                      </span>
                      <span className="text-micro text-primary/45 shrink-0">× {formatValue(relacion.cantidad)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {material.notas && (
            <div className="flex flex-col gap-1.5 min-w-0 p-2">
              <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                Notas
              </span>
              <p className="whitespace-pre-wrap text-micro leading-relaxed text-primary/50">{material.notas}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Mismo diseño que CompuestoCasilla (elementos/CompuestosPage.tsx): chip
 *  compacto rounded-full, px-2.5 py-1, text-micro font-bold tracking-wide,
 *  mismos estados seleccionado/hover. */
function MaterialPill({ material, selected, onClick }: { material: Material; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={material.nombre}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-micro font-bold tracking-wide transition-colors truncate max-w-full ${
        selected
          ? "text-primary border border-primary/40 ring-2 ring-primary/30"
          : "hover:bg-primary/10 text-primary/70 border border-primary/15"
      }`}
    >
      <span className="truncate">{material.nombre}</span>
    </button>
  );
}

/**
 * Panel flotante de Materiales — mismo shell exacto que ElementosPage /
 * CompuestosPage (createPortal a document.body, fixed inset-0 z-[9999],
 * backdrop con blur, contenedor w-full h-full max-w-6xl rounded-2xl con
 * animación popIn, header shrink-0 con caja de ícono + botón cerrar, cuerpo
 * flex-1 min-h-0 overflow-y-auto). Materiales es de solo lectura
 * (propiedades_calculadas viene de Supabase), así que no se replica el
 * sistema headerControls editable/guardable — se usa siempre el header
 * "default" (caja de ícono) que Elemento/Compuesto muestran cuando no hay
 * headerControls.
 */
function MaterialEditorFlotante({ material, onClose }: { material: Material; onClose: () => void }) {
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
            {material.nombre}
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
          <MaterialDetail material={material} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function MaterialesPage() {
  const { items: materiales, loading } = useMateriales();
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const seleccionado = materiales.find((material) => material.id === seleccionadoId) ?? null;

  return (
    <div className="px-3 pb-4 pt-2">
      {loading ? (
        <p className="py-5 text-center text-micro text-primary/35">Cargando…</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {materiales.map((material) => (
            <MaterialPill
              key={material.id}
              material={material}
              selected={material.id === seleccionadoId}
              onClick={() => setSeleccionadoId(material.id)}
            />
          ))}
        </div>
      )}
      {seleccionado && (
        <MaterialEditorFlotante material={seleccionado} onClose={() => setSeleccionadoId(null)} />
      )}
    </div>
  );
}

export default MaterialesPage;
