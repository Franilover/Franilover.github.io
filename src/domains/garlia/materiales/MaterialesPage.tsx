"use client";

import {
  Box,
  ChevronRight,
  Loader2,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useCompuestos } from "@/domains/garlia/elementos/useCompuestos";
import { useEstructuras } from "@/domains/garlia/elementos/useEstructuras";

import { useMaterialComponentes } from "./useMaterialComponentes";
import { useMaterialEstructuras } from "./useMaterialEstructuras";
import { useMateriales } from "./useMateriales";
import type { Material } from "./types";

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(3);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function PropertyRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-primary/10 py-2 last:border-b-0">
      <span className="text-sm text-primary/55">{label}</span>
      <span className="text-sm font-medium text-primary">{formatValue(value)}</span>
    </div>
  );
}

function MaterialProperties({ material }: { material: Material }) {
  const propiedades = material.propiedades_calculadas ?? {};
  const knownProperties = [
    ["masa", "Masa"], ["carga", "Carga"], ["rigidez", "Rigidez"],
    ["estabilidad", "Estabilidad"], ["flexibilidad", "Flexibilidad"],
    ["dureza", "Dureza"], ["conductividad", "Conductividad"], ["transparencia", "Transparencia"],
  ] as const;
  const visibles = knownProperties.filter(([key]) => propiedades[key] !== undefined);

  return (
    <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
      <div className="mb-3"><h3 className="text-sm font-semibold text-primary">Propiedades físicas</h3><p className="mt-1 text-xs text-primary/45">Calculadas por Supabase · solo lectura</p></div>
      {visibles.length === 0 ? <p className="text-sm text-primary/40">No hay propiedades calculadas disponibles.</p> : <div>{visibles.map(([key, label]) => <PropertyRow key={key} label={label} value={propiedades[key]} />)}</div>}
    </section>
  );
}

function MaterialDetail({ material }: { material: Material }) {
  const { items: componentes, loading: loadingComponentes } = useMaterialComponentes(material.id);
  const { items: estructuras, loading: loadingEstructuras } = useMaterialEstructuras(material.id);
  const { items: compuestos } = useCompuestos();
  const { items: estructurasCatalogo } = useEstructuras();

  return (
    <div className="space-y-4">
      <header className="border-b border-primary/10 pb-4">
        <div className="flex items-start gap-3"><div className="mt-0.5 rounded-lg border border-primary/15 bg-primary/5 p-2"><Box className="h-5 w-5 text-primary/70" /></div><div className="min-w-0 flex-1"><h2 className="text-xl font-semibold text-primary">{material.nombre}</h2><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-primary/45"><span>{material.tipo_material}</span><span>·</span><span>{material.estado_calculo || "sin estado"}</span></div></div></div>
        {material.descripcion && <p className="mt-4 text-sm leading-relaxed text-primary/60">{material.descripcion}</p>}
      </header>
      <MaterialProperties material={material} />
      <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4"><h3 className="text-sm font-semibold text-primary">Componentes</h3><p className="mt-1 text-xs text-primary/45">Composición normalizada del material</p>{loadingComponentes ? <div className="flex items-center gap-2 py-5 text-sm text-primary/45"><Loader2 className="h-4 w-4 animate-spin" /> Cargando componentes…</div> : componentes.length === 0 ? <p className="py-4 text-sm text-primary/40">Este material no tiene componentes registrados.</p> : <div className="mt-3 space-y-2">{componentes.map((componente) => { const compuesto = componente.componente_tipo === "compuesto" ? compuestos.find((item) => item.id === componente.componente_id) : null; return <div key={componente.id} className="rounded-lg border border-primary/10 px-3 py-2"><div className="flex items-center justify-between gap-3"><span className="text-sm text-primary">{compuesto?.nombre ?? `${componente.componente_tipo} · ${componente.componente_id.slice(0, 8)}`}</span><span className="text-xs text-primary/50">{formatValue(componente.cantidad)}{componente.unidad ? ` ${componente.unidad}` : ""}</span></div>{(componente.rol || componente.proporcion_min !== null || componente.proporcion_max !== null) && <div className="mt-1 flex flex-wrap gap-2 text-xs text-primary/40">{componente.rol && <span>{componente.rol}</span>}{componente.proporcion_min !== null && <span>mín. {formatValue(componente.proporcion_min)}</span>}{componente.proporcion_max !== null && <span>máx. {formatValue(componente.proporcion_max)}</span>}</div>}</div>; })}</div>}</section>
      <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4"><h3 className="text-sm font-semibold text-primary">Estructuras</h3><p className="mt-1 text-xs text-primary/45">Estructuras físicas utilizadas por el material</p>{loadingEstructuras ? <div className="flex items-center gap-2 py-5 text-sm text-primary/45"><Loader2 className="h-4 w-4 animate-spin" /> Cargando estructuras…</div> : estructuras.length === 0 ? <p className="py-4 text-sm text-primary/40">No hay estructuras asociadas.</p> : <div className="mt-3 space-y-2">{estructuras.map((relacion) => { const estructura = estructurasCatalogo.find((item) => item.id === relacion.estructura_id); return <div key={relacion.id} className="flex items-center justify-between rounded-lg border border-primary/10 px-3 py-2"><span className="text-sm text-primary">{estructura?.nombre ?? relacion.estructura_id.slice(0, 8)}</span><span className="text-xs text-primary/50">× {formatValue(relacion.cantidad)}</span></div>; })}</div>}</section>
      {material.notas && <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4"><h3 className="text-sm font-semibold text-primary">Notas</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-primary/55">{material.notas}</p></section>}
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

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
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
