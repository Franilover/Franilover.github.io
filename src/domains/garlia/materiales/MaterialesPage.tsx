"use client";

import {
  Box,
  ChevronRight,
  Loader2,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  propiedadesCalculadasGenerico,
  TarjetaPropiedadesFisicas,
} from "@/domains/garlia/_shared/GridPropiedadesCalculadas";
import { useCompuestos } from "@/domains/garlia/elementos/useCompuestos";
import { useEstructuras } from "@/domains/garlia/elementos/useEstructuras";
import type { PropiedadCalculada } from "@/domains/garlia/elementos/types";

import { useValoresDerivadosDeEntidad } from "@/domains/garlia/visualizador/useVisualizadorData";

import { useMaterialComponentes } from "./useMaterialComponentes";
import { useMaterialEstructuras } from "./useMaterialEstructuras";
import { useMateriales } from "./useMateriales";
import { usePerfilReactivoMaterial } from "./usePerfilReactivoMaterial";
import type { PerfilReactivoMaterial, Material } from "./types";

/** Mismo lenguaje visual que las filas de carga/vacío del Visualizador
 *  (VisualizadorPage.tsx LoadingRow/EmptyRow) — duplicado acá deliberadamente
 *  en vez de importado, porque son componentes internos no exportados de esa
 *  página y Materiales no debe acoplarse a su módulo completo. */
function LoadingRow() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-primary/10 p-5 text-xs font-bold text-primary/35">
      <span className="h-2 w-2 animate-pulse rounded-full bg-primary/40" />
      Cargando datos reales desde Supabase…
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-primary/15 p-5 text-xs leading-5 text-primary/40">
      {children}
    </div>
  );
}

/**
 * "Valores derivados reales" — fuente canónica valores_propiedades_derivadas
 * (documentacion_sistema #280), vía useValoresDerivadosDeEntidad. Mismo
 * componente/diseño que ya usa el Visualizador (TarjetaValoresDerivados en
 * VisualizadorPage.tsx): una línea por propiedad con barra de proporción
 * cuando trae rango_min/rango_max real, delegando el render a
 * TarjetaPropiedadesFisicas — el mismo lenguaje visual que "Propiedades
 * físicas" acá abajo. Duplicado en vez de importado por la misma razón que
 * LoadingRow/EmptyRow: es un componente interno no exportado de
 * VisualizadorPage.tsx.
 */
function TarjetaValoresDerivadosMaterial({ materialId, materialNombre }: { materialId: string | null; materialNombre?: string }) {
  const { items, loading } = useValoresDerivadosDeEntidad("material", materialId);

  if (!materialId) return <EmptyRow>Selecciona un material para ver sus propiedades derivadas reales.</EmptyRow>;
  if (loading) return <LoadingRow />;
  if (items.length === 0)
    return (
      <EmptyRow>
        {materialNombre ?? "Este material"} no tiene valores calculados en valores_propiedades_derivadas todavía.
      </EmptyRow>
    );

  const propiedades: PropiedadCalculada[] = items.map((v) => {
    const min = v.propiedad.rango_min;
    const max = v.propiedad.rango_max;
    const conRango = min !== null && max !== null && (max as number) > (min as number);
    return {
      clave: v.propiedad.clave,
      label: v.propiedad.nombre,
      valor: v.valor.toLocaleString("es-CL", { maximumFractionDigits: 4 }),
      proporcion: conRango
        ? Math.max(0, Math.min(1, (v.valor - (min as number)) / ((max as number) - (min as number))))
        : undefined,
      descripcion: v.propiedad.descripcion ?? "",
      formula: v.propiedad.formula ?? undefined,
    };
  });

  return <TarjetaPropiedadesFisicas propiedades={propiedades} columnas={2} />;
}

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

/** Ejes del Perfil Reactivo Emergente V2, con etiqueta y descripción — mismo
 *  criterio que las listas MAGNITUDES/INDICES de propiedadesCalculadasGenerico
 *  (elementos/types.ts / GridPropiedadesCalculadas.tsx), para que estos ejes
 *  se muestren como PropiedadCalculada más y compartan el diseño exacto de
 *  "Propiedades físicas" (TarjetaPropiedadesFisicas) en vez de un bloque
 *  aparte con su propio grid. Todos son índices [0,1] → llevan barra de
 *  proporción igual que estabilidad/rigidez/etc. */
const EJES_PERFIL_REACTIVO: { clave: string; label: string; descripcion: string }[] = [
  { clave: "afinidad_reactiva", label: "Afinidad reactiva", descripcion: "Qué tan bien tiende a acoplarse/reaccionar con otras sustancias." },
  { clave: "dinamismo_reactivo", label: "Dinamismo reactivo", descripcion: "Qué tan activa/cambiante es la microestructura reactiva del material." },
  { clave: "estabilidad_reactiva", label: "Estabilidad reactiva", descripcion: "Qué tan resistente es a iniciar o sostener una reacción." },
  { clave: "conductividad_reactiva", label: "Conductividad reactiva", descripcion: "Facilidad para propagar una influencia reactiva a través del material." },
  { clave: "actividad_catalitica_reactiva", label: "Actividad catalítica", descripcion: "Capacidad de acelerar/facilitar reacciones sin consumirse." },
  { clave: "potencial_transicion_reactivo", label: "Potencial de transición", descripcion: "Qué tan propenso está el material a cambiar de estado o forma." },
  { clave: "potencial_transformacion_reactiva", label: "Potencial de transformación", descripcion: "Qué tan propenso está el material a transformarse en algo distinto." },
];

/**
 * Traduce el Perfil Reactivo Emergente V2 (documentacion_sistema, orden
 * 1101; fuente real: vista v_perfil_reactivo_material, ver
 * usePerfilReactivoMaterial) al mismo shape PropiedadCalculada que usa
 * TarjetaPropiedadesFisicas — pedido explícito: mismo diseño que
 * "Propiedades físicas" en vez de un bloque "Perfil reactivo" aparte.
 *
 * No es una lista de etiquetas manuales tipo "inflamable/explosivo": son
 * ejes derivados de la microestructura del material. Cuando el material no
 * tiene desglose microscópico suficiente (estado !== "derivado_microestructura")
 * devuelve [] — información propia del canon, no se inventa un perfil ni se
 * fuerza a cero.
 */
function propiedadesDePerfilReactivo(
  item: PerfilReactivoMaterial | null,
): PropiedadCalculada[] {
  if (!item || item.estado !== "derivado_microestructura" || !item.perfil) return [];

  const prop = (v: number | null | undefined) =>
    typeof v === "number" ? Math.max(0, Math.min(1, v)) : undefined;
  const fmt = (v: number | null | undefined) => (typeof v === "number" ? v.toFixed(3) : null);

  return EJES_PERFIL_REACTIVO.filter((eje) => item.perfil?.[eje.clave] !== undefined).map((eje) => {
    const v = item.perfil?.[eje.clave] as number | undefined;
    return {
      clave: `pr_${eje.clave}`,
      label: eje.label,
      valor: fmt(v),
      proporcion: prop(v),
      descripcion: eje.descripcion,
    };
  });
}

function MaterialDetail({ material }: { material: Material }) {
  const { items: componentes, loading: loadingComponentes } = useMaterialComponentes(material.id);
  const { items: estructuras, loading: loadingEstructuras } = useMaterialEstructuras(material.id);
  const { items: compuestos } = useCompuestos();
  const { items: estructurasCatalogo } = useEstructuras();
  const { item: perfilReactivo, loading: loadingPerfilReactivo } = usePerfilReactivoMaterial(material.id);

  // Propiedades físicas (jsonb propiedades_calculadas, vía
  // propiedadesCalculadasGenerico) + Perfil Reactivo Emergente V2 (vista
  // v_perfil_reactivo_material, vía propiedadesDePerfilReactivo) fundidos en
  // una sola lista — pedido explícito: mismo diseño de tarjeta para ambos,
  // como ya se hizo con "Estabilidad — detalle" en CompuestoEditor. Mientras
  // el perfil reactivo sigue cargando no se agregan sus filas todavía, para
  // no mostrar "sin dato" un instante y después aparecer.
  const propiedades = material.propiedades_calculadas ?? {};
  const propiedadesCombinadas = [
    ...propiedadesCalculadasGenerico(propiedades),
    ...(loadingPerfilReactivo ? [] : propiedadesDePerfilReactivo(perfilReactivo)),
  ];
  const fuente = etiquetaFuenteFisica(propiedades.fuente_fisica as string | undefined);

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
          <TarjetaPropiedadesFisicas propiedades={propiedadesCombinadas} columnas={2} />

          <div className="flex flex-col gap-1.5 min-w-0 p-2">
            <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
              Valores derivados reales
            </span>
            <TarjetaValoresDerivadosMaterial materialId={material.id} materialNombre={material.nombre} />
          </div>
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
