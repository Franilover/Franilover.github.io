"use client";

/**
 * FisicaPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Vista de la tab "Física" (Energías Universales).
 *
 * Layout de 2 columnas fijas (reemplaza el panel modal flotante anterior):
 *   - Columna izquierda: navegación — catálogos fijos (compactos), Oris
 *     agrupados por familia y Conceptos agrupados por bloque, todo en una
 *     lista scrolleable de filas clickeables.
 *   - Columna derecha: editor de lo seleccionado (Oris o Concepto), fijo
 *     y siempre visible junto a la lista — sin overlay ni modal, sin perder
 *     contexto de qué más hay para editar.
 *
 * En mobile (breakpoint sm) colapsa a una sola columna: se ve la lista, y
 * al seleccionar algo se reemplaza por el editor con un botón "volver".
 *
 * Todo el contenido variable (Oris, conceptos) vive en Supabase — tablas
 * "oris" y "fisica_conceptos", separadas de "elementos".
 */

import { Atom, ChevronLeft, Download, Info, Loader2, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { RichEditor } from "@/editor/lexical";
import { supabase } from "@/infra/supabase/supabase";
import { useConfirm } from "@/ui/ConfirmModal";
import { PopoverFlotante } from "@/domains/garlia/_shared/PopoverFlotante";

import { OrisEditor } from "./OrisEditor";
import {
  FISICA_CONCEPTOS_CONFIG,
  IUMS,
  ORIS_FAMILIAS,
  ORIS_FAMILIA_ICON,
  PARTICULAS_BASE,
  agruparPorBloque,
  particulaAFilaCatalogo,
  type FilaCatalogo,
  type FisicaConcepto,
  type Oris,
  type OrisFamilia,
  type Particula,
} from "./types";
import { PanelEditorSubsistema } from "@/domains/garlia/runas/BloqueSubsistemasMagia";
import type { SubsistemaMagia } from "@/domains/garlia/runas/useSubsistemasMagia";

interface Props {
  particulas: Particula[];
  loadingParticulas?: boolean;

  oris: Oris[];
  loadingOris?: boolean;
  creatingOris?: boolean;
  onCreateOris?: () => void;
  onActualizarOris: (id: string, cambios: Partial<Oris>) => void;
  onEliminarOris?: (id: string) => void;
  seleccionarOrisId?: string | null;

  conceptos: FisicaConcepto[];
  loadingConceptos?: boolean;
  onActualizarConcepto: (id: string, cambios: Partial<FisicaConcepto>) => void;

  /**
   * Inserta en Supabase un lote de Oris y/o conceptos nuevos (sin id) y
   * devuelve cuántos quedaron guardados en total. El botón "Subir JSON"
   * llama a esto tras parsear el archivo — mismo espíritu que
   * onImportarElementos en elementos/ElementosPage.tsx.
   */
  onImportarFisica?: (
    orisNuevos: Omit<Oris, "id">[],
    conceptosNuevos: Omit<FisicaConcepto, "id">[],
  ) => Promise<number>;
  /**
   * Actualiza en Supabase un lote de Oris y/o conceptos ya existentes
   * (coincidencia por nombre en Oris, por bloque+titulo en conceptos) —
   * upsert en vez de saltarlos. Devuelve cuántos quedaron actualizados
   * en total.
   */
  onActualizarVariosFisica?: (
    orisActualizar: (Partial<Oris> & { id: string })[],
    conceptosActualizar: (Partial<FisicaConcepto> & { id: string })[],
  ) => Promise<number>;

  /** Subsistemas de Magia — cuarto ítem de la barra lateral de Física. */
  subsistemas: SubsistemaMagia[];
  loadingSubsistemas?: boolean;
  creandoSubsistema?: boolean;
  onCrearSubsistema: (nombre: string) => Promise<SubsistemaMagia | null>;
  onActualizarSubsistema: (id: string, updates: Partial<SubsistemaMagia>) => void;
  onEliminarSubsistema: (id: string) => void;
  /** Se dispara al clickear una criatura dentro del editor de subsistema. */
  onSelectCriatura?: (id: string) => void;
}

/** Qué está activo en el editor de la columna derecha. */
type Seleccion =
  | { tipo: "oris"; id: string }
  | { tipo: "concepto"; id: string }
  | { tipo: "subsistema"; id: string }
  | { tipo: "todos-oris" }
  | { tipo: "todas-bases" }
  | { tipo: "todos-conceptos" }
  | { tipo: "todos-subsistemas" }
  | null;

// ─── Descarga: todo el contenido de Física en un solo JSON ────────────────
function descargarDatosFisica(particulas: Particula[], oris: Oris[], conceptos: FisicaConcepto[]) {
  const payload = {
    exportado_en: new Date().toISOString(),
    particula_base: PARTICULAS_BASE,
    particulas,
    iums: IUMS,
    oris,
    conceptos,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fisica-energias-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Subida: leer un JSON con el mismo formato exportado (oris + conceptos)
// y devolver los registros nuevos listos para insertar. No toca Supabase
// directamente — eso lo hace el caller (BloqueFisica en RunasPage), mismo
// espíritu que parsearArchivoElementosJSON en elementos/ElementosPage.tsx.
export interface ImportacionFisica {
  orisNuevos: Omit<Oris, "id">[];
  /** Oris del archivo que coinciden por nombre con uno existente: se actualizan en vez de saltarse. */
  orisActualizar: (Partial<Oris> & { id: string })[];
  conceptosNuevos: Omit<FisicaConcepto, "id">[];
  /** Conceptos del archivo que coinciden por (bloque, titulo) con uno existente: se actualizan. */
  conceptosActualizar: (Partial<FisicaConcepto> & { id: string })[];
}

export function parsearArchivoFisicaJSON(
  raw: string,
  orisExistentes: Oris[],
  conceptosExistentes: FisicaConcepto[] = [],
): ImportacionFisica {
  const data = JSON.parse(raw);
  const listaOris: unknown[] = Array.isArray(data?.oris) ? data.oris : [];
  const listaConceptos: unknown[] = Array.isArray(data?.conceptos) ? data.conceptos : [];

  if (listaOris.length === 0 && listaConceptos.length === 0) {
    throw new Error('El JSON debe traer al menos una de las claves "oris" o "conceptos" con arreglos.');
  }

  const orisPorNombre = new Map(orisExistentes.map((o) => [o.nombre, o]));
  const orisNuevos: Omit<Oris, "id">[] = [];
  const orisActualizar: (Partial<Oris> & { id: string })[] = [];

  for (const item of listaOris) {
    const o = item as Partial<Oris>;
    if (!o.nombre || !o.familia) {
      throw new Error(`Oris inválido (falta nombre o familia): ${JSON.stringify(o).slice(0, 120)}`);
    }
    const datos = {
      orden: o.orden ?? 0,
      nombre: o.nombre,
      familia: o.familia,
      formula: o.formula ?? "",
      dominio: o.dominio ?? "",
      descripcion: o.descripcion ?? null,
    };
    const existente = orisPorNombre.get(o.nombre);
    if (existente) {
      orisActualizar.push({ id: existente.id, ...datos });
    } else {
      orisNuevos.push(datos);
    }
  }

  // Los conceptos no tienen un campo único natural — se identifican por la
  // combinación (bloque, titulo), igual que se agrupan visualmente.
  const conceptosPorClave = new Map(
    conceptosExistentes.map((c) => [`${c.bloque}\u0000${c.titulo}`, c]),
  );
  const conceptosNuevos: Omit<FisicaConcepto, "id">[] = [];
  const conceptosActualizar: (Partial<FisicaConcepto> & { id: string })[] = [];

  for (const item of listaConceptos) {
    const c = item as Partial<FisicaConcepto>;
    if (!c.titulo || !c.bloque) {
      throw new Error(`Concepto inválido (falta titulo o bloque): ${JSON.stringify(c).slice(0, 120)}`);
    }
    const datos = {
      orden: c.orden ?? 0,
      bloque: c.bloque,
      titulo: c.titulo,
      contenido: c.contenido ?? "",
    };
    const existente = conceptosPorClave.get(`${c.bloque}\u0000${c.titulo}`);
    if (existente) {
      conceptosActualizar.push({ id: existente.id, ...datos });
    } else {
      conceptosNuevos.push(datos);
    }
  }

  return { orisNuevos, orisActualizar, conceptosNuevos, conceptosActualizar };
}

// ─── Filas de navegación (columna izquierda) ───────────────────────────────


function catalogosBases(
  particulas: Particula[],
): { key: "particula-base" | "particulas" | "iums"; titulo: string; filas: FilaCatalogo[] }[] {
  return [
    { key: "particula-base", titulo: "Partícula Base", filas: PARTICULAS_BASE },
    {
      key: "particulas",
      titulo: "Partículas",
      filas: particulas.map(particulaAFilaCatalogo),
    },
    { key: "iums", titulo: "Iums", filas: IUMS },
  ];
}

/** Texto de la Ley de Equivalencia Rotacional, mostrado en el popover junto
 *  a "Partículas · N" — mismo contenido que el registro en fisica_conceptos
 *  ("Partículas teóricas descartadas"), resumido para lectura rápida. */
const LEY_EQUIVALENCIA_ROTACIONAL = {
  titulo: "Ley de Equivalencia Rotacional",
  contenido:
    "Del espacio completo de 27 combinaciones de Tesis/Antítesis/Síntesis (3³), solo 11 son partículas distintas. " +
    "Las 16 restantes son rotaciones de esas 11 — la misma partícula vista desde otro punto de inicio de su ciclo " +
    "A→T→S (ej. ATA y TAT son rotaciones de TAA/ATT), igual que un espín ↑/↓ no son dos partículas sino dos estados " +
    "del mismo grado de libertad. Se exploraron como candidatas independientes y se descartaron el 12/08/2026 tras " +
    "confirmar que ningún elemento del mundo las usaba: las 11 originales ya cubren el espacio completo de clases " +
    "de equivalencia rotacional del sistema.",
};

function BasesRowTitle({
  titulo,
  cantidad,
  mostrarInfo,
}: {
  titulo: string;
  cantidad: number;
  /** Si true, muestra el ícono de info con el popover de la Ley de
   *  Equivalencia Rotacional — solo aplica al bloque "Partículas". */
  mostrarInfo?: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <div className="flex items-center gap-1">
      <p className="text-micro font-black uppercase tracking-[0.2em]">
        {titulo} · {cantidad}
      </p>
      {mostrarInfo && (
        <>
          <button
            type="button"
            onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
            title="Por qué son solo 11 partículas"
            className="flex items-center justify-center w-4 h-4 rounded-full text-primary/30 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
          >
            <Info size={11} />
          </button>
          <PopoverFlotante anchor={anchor} onClose={() => setAnchor(null)} width={340} maxHeight={280}>
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-black uppercase tracking-wide text-primary">
                {LEY_EQUIVALENCIA_ROTACIONAL.titulo}
              </p>
              <p className="text-xs text-primary/70 leading-relaxed">
                {LEY_EQUIVALENCIA_ROTACIONAL.contenido}
              </p>
            </div>
          </PopoverFlotante>
        </>
      )}
    </div>
  );
}

function TodasLasBasesView({
  particulas,
  onBack,
}: {
  particulas: Particula[];
  onBack: () => void;
}) {
  const catalogos = catalogosBases(particulas);
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 flex flex-col gap-4">
        {catalogos.map(({ key, titulo, filas }, idx) => (
          <div key={key} className="flex flex-col gap-2">
            <div
              className={`flex items-center gap-1.5 text-primary/50 pb-1.5 ${
                idx > 0 ? "pt-2 border-t border-primary/10" : ""
              }`}
            >
              <BasesRowTitle titulo={titulo} cantidad={filas.length} mostrarInfo={key === "particulas"} />
            </div>

            <div
              className={`grid grid-cols-1 sm:grid-cols-2 gap-2 items-start ${
                key === "particula-base" ? "lg:grid-cols-3" : "lg:grid-cols-4"
              }`}
            >
              {filas.map((f) => (
                <div
                  key={f.nombre}
                  className="flex flex-col gap-1 px-2.5 py-2 rounded-lg border border-primary/10 bg-primary/[0.02]"
                >
                  <span className="text-micro font-black text-primary">{f.nombre}</span>
                  <span className="text-xs text-primary/60 leading-snug">{f.detalle}</span>
                  {f.extra && <span className="text-xs text-primary/40 leading-snug">{f.extra}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Vista de todos los Oris agrupados por familia (Mecánica / Energética /
 * Biológica), en la columna derecha. Cada familia es un bloque con título
 * y separador; dentro, sus Oris se muestran como tarjetas compactas con
 * nombre + dominio — clickeables para abrir el editor completo en un
 * panel flotante centrado (mismo patrón que Elementos/Biología), en vez
 * de mostrar el editor entero embebido en la grilla.
 */
function TodosLosOrisView({
  orisPorFamilia,
  onBack,
  onActualizarOris,
  onEliminarOris,
}: {
  orisPorFamilia: Map<OrisFamilia, Oris[]>;
  onBack: () => void;
  onActualizarOris: (id: string, cambios: Partial<Oris>) => void;
  onEliminarOris?: (id: string) => void;
}) {
  const [orisAbiertoId, setOrisAbiertoId] = useState<string | null>(null);
  const totalOris = ORIS_FAMILIAS.reduce((acc, f) => acc + (orisPorFamilia.get(f)?.length ?? 0), 0);

  const orisAbierto = useMemo(() => {
    if (!orisAbiertoId) return null;
    for (const familia of ORIS_FAMILIAS) {
      const encontrado = orisPorFamilia.get(familia)?.find((o) => o.id === orisAbiertoId);
      if (encontrado) return encontrado;
    }
    return null;
  }, [orisAbiertoId, orisPorFamilia]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 flex flex-col gap-4">
        {ORIS_FAMILIAS.map((familia, idx) => {
          const items = orisPorFamilia.get(familia) ?? [];
          const Icon = ORIS_FAMILIA_ICON[familia];
          return (
            <div key={familia} className="flex flex-col gap-2">
              <div
                className={`flex items-center gap-1.5 text-primary/50 pb-1.5 ${
                  idx > 0 ? "pt-2 border-t border-primary/10" : ""
                }`}
              >
                <Icon size={13} />
                <p className="text-micro font-black uppercase tracking-[0.2em]">
                  {familia} · {items.length}
                </p>
              </div>

              {items.length === 0 ? (
                <div className="py-6 text-micro text-primary/25 text-center border border-dashed border-primary/10 rounded-md">
                  Sin Oris en esta familia
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 items-start">
                  {items.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setOrisAbiertoId(o.id)}
                      className="flex flex-col gap-1 px-3 py-2.5 rounded-lg border border-primary/10 bg-primary/[0.02] text-left hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer"
                    >
                      <span className="text-base font-black text-primary truncate">{o.nombre}</span>
                      <span className="text-sm text-primary/50 truncate">{o.dominio || "Sin dominio"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {orisAbierto && (
        <OrisPanelFlotante
          oris={orisAbierto}
          onCerrar={() => setOrisAbiertoId(null)}
          onActualizar={onActualizarOris}
          onEliminar={
            onEliminarOris
              ? (id) => {
                  onEliminarOris(id);
                  setOrisAbiertoId(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

/**
 * Panel flotante centrado para editar un Oris — mismo patrón visual que
 * ElementoPanelFlotante (Química) y CladoPanelFlotante (Biología): modal
 * grande con backdrop blur, Escape para cerrar, bloqueo de scroll del
 * fondo. Envuelve el OrisEditor existente (embedded, sin su propio botón
 * volver) dentro del modal.
 */
function OrisPanelFlotante({
  oris,
  onCerrar,
  onActualizar,
  onEliminar,
}: {
  oris: Oris;
  onCerrar: () => void;
  onActualizar: (id: string, cambios: Partial<Oris>) => void;
  onEliminar?: (id: string) => void;
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
        className="w-full h-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: "var(--bg-main)",
          border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
          animation: "popIn 160ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div
          className="shrink-0 flex items-center gap-3 px-4 py-3 border-b"
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
            <Atom className="text-primary/50" size={12} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
              Oris · vista rápida
            </p>
            <p className="text-xs font-bold text-primary truncate">{oris.nombre}</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar (Esc)"
            className="shrink-0 p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/8 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <OrisEditor oris={oris} onBack={onCerrar} onActualizar={onActualizar} onEliminar={onEliminar} embedded />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Vista de todos los Conceptos en la columna derecha, agrupados por
 * bloque. Mismo patrón que TodasLasBasesView / TodosLosOrisView: cada
 * bloque es una sección con título y separador horizontal, apilados uno
 * arriba del otro; los conceptos dentro de cada bloque van en columna
 * única (una lista vertical), ya que cada uno lleva su editor de texto
 * enriquecido y necesita ancho completo.
 */
function TodosLosConceptosView({
  bloques,
  onBack,
  onActualizarConcepto,
  onEliminarConcepto,
  onAgregarConcepto,
  agregandoConceptoDe,
  mostrarInputSeccion,
  nuevaSeccionNombre,
  onCambiarNuevaSeccionNombre,
  onConfirmarNuevaSeccion,
  onCancelarNuevaSeccion,
  onAbrirNuevaSeccion,
  creandoSeccion,
}: {
  bloques: { bloque: string; items: FisicaConcepto[] }[];
  onBack: () => void;
  onActualizarConcepto: (id: string, cambios: Partial<FisicaConcepto>) => void;
  onEliminarConcepto?: (id: string) => void;
  onAgregarConcepto?: (bloque: string) => void;
  agregandoConceptoDe?: string | null;
  mostrarInputSeccion: boolean;
  nuevaSeccionNombre: string;
  onCambiarNuevaSeccionNombre: (v: string) => void;
  onConfirmarNuevaSeccion: () => void;
  onCancelarNuevaSeccion: () => void;
  onAbrirNuevaSeccion: () => void;
  creandoSeccion?: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div
        style={{ background: "var(--bg-main)" }}
        className="shrink-0 flex items-center justify-end gap-1.5 px-2.5 py-1.5 border-b border-primary/10"
      >
        {mostrarInputSeccion ? (
          <div className="flex items-center gap-1 min-w-0">
            <input
              autoFocus
              value={nuevaSeccionNombre}
              onChange={(e) => onCambiarNuevaSeccionNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onConfirmarNuevaSeccion();
                if (e.key === "Escape") onCancelarNuevaSeccion();
              }}
              placeholder="Nombre de la sección…"
              className="w-40 min-w-0 bg-primary/5 rounded px-1.5 py-0.5 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30 placeholder:text-primary/25"
            />
            <button
              type="button"
              disabled={creandoSeccion || !nuevaSeccionNombre.trim()}
              onClick={onConfirmarNuevaSeccion}
              className="shrink-0 flex items-center justify-center w-5 h-5 rounded text-primary/40 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer disabled:opacity-50"
            >
              {creandoSeccion ? <Loader2 className="animate-spin" size={10} /> : "✓"}
            </button>
            <button
              type="button"
              onClick={onCancelarNuevaSeccion}
              className="shrink-0 flex items-center justify-center w-5 h-5 rounded text-primary/30 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAbrirNuevaSeccion}
            title="Añadir nueva sección de conceptos"
            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide text-primary/40 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
          >
            <Plus size={11} />
            Sección
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 flex flex-col gap-4">
        {bloques.length === 0 ? (
          <div className="py-8 text-micro text-primary/25 text-center border border-dashed border-primary/10 rounded-md">
            Sin conceptos todavía
          </div>
        ) : (
          bloques.map(({ bloque, items }, idx) => {
            return (
            <div key={bloque} className="flex flex-col gap-2">
              <div
                className={`flex items-center justify-between gap-1.5 text-primary/50 pb-1.5 ${
                  idx > 0 ? "pt-2 border-t border-primary/10" : ""
                }`}
              >
                <p className="text-micro font-black uppercase tracking-[0.2em]">
                  {bloque} · {items.length}
                </p>
                {onAgregarConcepto && (
                  <button
                    type="button"
                    disabled={agregandoConceptoDe === bloque}
                    onClick={() => onAgregarConcepto(bloque)}
                    title={`Añadir concepto en "${bloque}"`}
                    className="shrink-0 flex items-center justify-center w-5 h-5 rounded text-primary/30 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {agregandoConceptoDe === bloque ? (
                      <Loader2 className="animate-spin" size={10} />
                    ) : (
                      <Plus size={11} />
                    )}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-6 items-start">
                {items.map((c) => (
                  <ConceptoEditor
                    key={c.id}
                    concepto={c}
                    onBack={onBack}
                    onActualizar={onActualizarConcepto}
                    onEliminar={onEliminarConcepto}
                    embedded
                  />
                ))}
              </div>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Detalle editable de un concepto, para la columna derecha. Mismo patrón
 * de header que OrisEditor (volver + guardado al perder foco / on change),
 * pero sin fila de metadatos — un concepto es solo título + contenido.
 */
function ConceptoEditor({
  concepto,
  onBack,
  onActualizar,
  onEliminar,
  embedded,
}: {
  concepto: FisicaConcepto;
  onBack: () => void;
  onActualizar: (id: string, cambios: Partial<FisicaConcepto>) => void;
  onEliminar?: (id: string) => void;
  /** Cuando se renderiza dentro de la vista de todos los conceptos (varios
   *  apilados): oculta el botón "volver" individual y usa un editor más
   *  bajo, ya que ahí se vuelve una sola vez desde el header general. */
  embedded?: boolean;
}) {
  const { confirm, ConfirmModal } = useConfirm();
  const [local, setLocal] = useState(concepto);
  // Último `contenido` (y demás campos) que ESTE editor mandó a persist(),
  // justo antes de confirmar. Mismo patrón que lastSavedContentRef en
  // EditorCapitulos.tsx: sin esto, el useEffect de abajo no puede
  // distinguir un refresh externo real (otra pestaña, otro dispositivo)
  // del eco del propio persist() — que sube por onActualizar/
  // setConceptosLocal y vuelve como una nueva identidad de `concepto`,
  // pisando `local` con un valor potencialmente más viejo que lo que el
  // usuario ya siguió escribiendo mientras el guardado estaba en vuelo.
  // Esto es lo que causaba el salto de cursor al tipear.
  const lastSavedRef = useRef<FisicaConcepto>(concepto);

  useEffect(() => {
    if (
      concepto.id === lastSavedRef.current.id &&
      concepto.titulo === lastSavedRef.current.titulo &&
      concepto.contenido === lastSavedRef.current.contenido
    ) {
      // Eco del propio guardado: ya lo tenemos reflejado en `local`
      // (posiblemente con texto más nuevo que el usuario tipeó después de
      // que este guardado arrancara) — no lo pisamos.
      return;
    }
    setLocal(concepto);
    lastSavedRef.current = concepto;
  }, [concepto]);

  async function persist(cambios: Partial<FisicaConcepto>) {
    const { error } = await supabase
      .from("fisica_conceptos")
      .update(cambios)
      .eq("id", concepto.id);
    if (!error) {
      // Marcar ANTES de onActualizar: ese callback termina generando la
      // nueva prop `concepto` que dispara el useEffect de arriba — hace
      // falta que lastSavedRef ya refleje este guardado para que se
      // reconozca como eco propio.
      lastSavedRef.current = { ...lastSavedRef.current, ...cambios };
      onActualizar(concepto.id, cambios);
    }
  }

  // Debounce del guardado de contenido: antes, persist({contenido: v}) se
  // llamaba en CADA tecla (ver onChange de RichEditor más abajo), lo que
  // disparaba un UPDATE a Supabase por letra tipeada. Además de ser
  // innecesariamente costoso, con red variable el orden de resolución de
  // esos UPDATEs en paralelo no está garantizado — el mismo problema que
  // describe el comentario de doSave/isSavingRef en EditorCapitulos.tsx.
  // Un guardado que resuelve tarde y pisa uno más nuevo es otra vía posible
  // hacia el mismo síntoma (cursor saltando / texto retrocediendo).
  const persistContenidoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pendingContenidoRef = useRef<string | null>(null);
  function persistContenidoDebounced(v: string) {
    pendingContenidoRef.current = v;
    if (persistContenidoTimerRef.current) {
      clearTimeout(persistContenidoTimerRef.current);
    }
    persistContenidoTimerRef.current = setTimeout(() => {
      const val = pendingContenidoRef.current;
      pendingContenidoRef.current = null;
      if (val !== null) void persist({ contenido: val });
    }, 800);
  }
  useEffect(() => {
    return () => {
      if (persistContenidoTimerRef.current) {
        clearTimeout(persistContenidoTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className={
        embedded
          ? "group flex flex-col gap-2 pb-6 border-b border-primary/10"
          : "flex-1 flex flex-col min-h-0 overflow-hidden"
      }
    >
      <ConfirmModal />
      <div
        className={
          embedded
            ? "shrink-0 flex items-center gap-1.5"
            : "shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 border-b border-primary/10"
        }
        style={embedded ? undefined : { background: "var(--bg-main)" }}
      >
        {!embedded && (
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
          >
            <ChevronLeft size={12} />
          </button>
        )}

        {!embedded && (
          <span className="shrink-0 text-micro font-black uppercase tracking-widest text-primary/30 px-1.5 py-0.5 rounded border border-primary/15">
            {concepto.bloque}
          </span>
        )}

        <input
          value={local.titulo}
          onChange={(e) => setLocal((p) => ({ ...p, titulo: e.target.value }))}
          onBlur={() => persist({ titulo: local.titulo })}
          placeholder="Título del concepto"
          className={
            embedded
              ? "flex-1 min-w-0 bg-transparent text-sm font-black uppercase tracking-[0.1em] text-primary/70 outline-none placeholder:text-primary/25 placeholder:normal-case placeholder:font-normal"
              : "flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
          }
        />

        {onEliminar && (
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: "Eliminar concepto",
                message: `¿Eliminar "${local.titulo || "Sin título"}"? Esta acción no se puede deshacer.`,
              });
              if (ok) onEliminar(concepto.id);
            }}
            className={
              embedded
                ? "shrink-0 flex items-center justify-center w-6 h-6 rounded text-primary/0 group-hover:text-primary/30 hover:!text-red-400 transition-all cursor-pointer"
                : "shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all cursor-pointer"
            }
            title="Eliminar concepto"
          >
            <Trash2 size={embedded ? 12 : 11} />
          </button>
        )}
      </div>

      <div className={embedded ? "" : "flex-1 min-h-0 p-2.5 overflow-y-auto"}>
        <div className="text-sm">
          <RichEditor
            minHeight={embedded ? "6rem" : "16rem"}
            placeholder="Contenido del concepto…"
            value={local.contenido}
            onChange={(v) => {
              setLocal((p) => ({ ...p, contenido: v }));
              persistContenidoDebounced(v);
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Vista de grid de chips de Subsistemas de Magia (columna derecha). */
function TodosLosSubsistemasView({
  subsistemas,
  loading,
  creating,
  onBack,
  onCrear,
  onSelect,
}: {
  subsistemas: SubsistemaMagia[];
  loading?: boolean;
  creating?: boolean;
  onBack: () => void;
  onCrear: (nombre: string) => Promise<SubsistemaMagia | null>;
  onSelect: (id: string) => void;
}) {
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [creandoAbierto, setCreandoAbierto] = useState(false);

  const handleCrear = async () => {
    const nombre = nombreNuevo.trim();
    if (!nombre) return;
    const nuevo = await onCrear(nombre);
    setNombreNuevo("");
    setCreandoAbierto(false);
    if (nuevo) onSelect(nuevo.id);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div
        style={{ background: "var(--bg-main)" }}
        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 border-b border-primary/10"
      >
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
        >
          <ChevronLeft size={12} />
        </button>
        <span className="flex-1 min-w-0 text-sm font-black text-primary flex items-center gap-1.5">
          <Sparkles size={13} className="text-accent/60" />
          Subsistemas de Magia
        </span>
        <button
          type="button"
          onClick={() => setCreandoAbierto((o) => !o)}
          title="Añadir subsistema"
          className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md text-primary/40 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
        >
          <Plus size={12} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2.5">
        {creandoAbierto && (
          <div className="flex items-center gap-1.5 mb-3">
            <input
              autoFocus
              className="flex-1 min-w-0 bg-primary/[0.02] border border-primary/10 rounded-lg px-2.5 py-1.5 text-xs text-primary/80 outline-none placeholder:text-primary/30 focus:border-primary/25"
              placeholder="Nombre del subsistema (ej. Luminia)…"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCrear();
                if (e.key === "Escape") setCreandoAbierto(false);
              }}
            />
            <button
              type="button"
              disabled={!nombreNuevo.trim() || creating}
              onClick={() => void handleCrear()}
              className="shrink-0 text-micro font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-primary text-bg-main hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Crear
            </button>
          </div>
        )}

        {loading ? (
          <div className="w-full py-6 text-xs text-primary/30 text-center">Cargando…</div>
        ) : subsistemas.length === 0 ? (
          <p className="text-xs text-primary/25 italic py-2">Sin subsistemas todavía</p>
        ) : (
          <div className="flex flex-wrap items-start gap-2">
            {subsistemas.map((s) => {
              const totalFilas =
                (s.canales?.length ?? 0) + (s.filtros?.length ?? 0) + (s.complementos?.length ?? 0);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelect(s.id)}
                  className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border border-primary/10 bg-primary/[0.02] hover:bg-primary/5 hover:border-primary/25 transition-colors text-left min-w-[140px] max-w-[220px]"
                >
                  <span className="flex items-center gap-1.5 text-xs font-bold text-primary/80 truncate w-full">
                    <Sparkles size={11} className="text-accent/60 shrink-0" />
                    {s.nombre || "Sin nombre"}
                  </span>
                  {s.descripcion ? (
                    <span className="text-micro text-primary/40 line-clamp-2 leading-snug">
                      {s.descripcion}
                    </span>
                  ) : (
                    <span className="text-micro text-primary/25 italic">Sin descripción</span>
                  )}
                  {totalFilas > 0 && (
                    <span className="text-micro font-bold text-primary/30 uppercase tracking-wide">
                      {totalFilas} {totalFilas === 1 ? "fila" : "filas"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Estado vacío de la columna derecha cuando no hay nada seleccionado. */
function EditorVacio() {
  return (
    <div className="flex-1 hidden sm:flex flex-col items-center justify-center gap-2 text-primary/25">
      <Sparkles size={20} />
      <p className="text-micro font-black uppercase tracking-widest">
        Elegí un Oris o un Concepto para editar
      </p>
    </div>
  );
}

// ─── Página principal ───────────────────────────────────────────────────────

export function FisicaPage({
  particulas,
  loadingParticulas,
  oris,
  loadingOris,
  creatingOris,
  onCreateOris,
  onActualizarOris,
  onEliminarOris,
  seleccionarOrisId,
  conceptos,
  loadingConceptos,
  onActualizarConcepto,
  onImportarFisica,
  onActualizarVariosFisica,
  subsistemas,
  loadingSubsistemas,
  creandoSubsistema,
  onCrearSubsistema,
  onActualizarSubsistema,
  onEliminarSubsistema,
  onSelectCriatura,
}: Props) {
  const [seleccion, setSeleccion] = useState<Seleccion>(
    seleccionarOrisId ? { tipo: "oris", id: seleccionarOrisId } : null,
  );
  const [conceptosLocal, setConceptosLocal] = useState<FisicaConcepto[]>(conceptos);
  useEffect(() => setConceptosLocal(conceptos), [conceptos]);

  useEffect(() => {
    if (seleccionarOrisId) setSeleccion({ tipo: "oris", id: seleccionarOrisId });
  }, [seleccionarOrisId]);

  const [agregandoConceptoDe, setAgregandoConceptoDe] = useState<string | null>(null);
  const [creandoSeccion, setCreandoSeccion] = useState(false);
  const [nuevaSeccionNombre, setNuevaSeccionNombre] = useState("");
  const [mostrarInputSeccion, setMostrarInputSeccion] = useState(false);

  // ── Subida de JSON (mismo patrón que "Subir JSON" en Elementos) ─────────
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const [mensajeImportacion, setMensajeImportacion] = useState<string | null>(null);

  async function handleArchivoSeleccionado(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo || !onImportarFisica) return;

    setImportando(true);
    setMensajeImportacion(null);
    try {
      const texto = await archivo.text();
      const { orisNuevos, orisActualizar, conceptosNuevos, conceptosActualizar } = parsearArchivoFisicaJSON(
        texto,
        oris,
        conceptosLocal,
      );

      const partes: string[] = [];

      if (orisNuevos.length > 0 || conceptosNuevos.length > 0) {
        const insertados = await onImportarFisica(orisNuevos, conceptosNuevos);
        partes.push(`${insertados} registro${insertados === 1 ? "" : "s"} nuevo${insertados === 1 ? "" : "s"} importado${insertados === 1 ? "" : "s"}`);
      }

      if (orisActualizar.length > 0 || conceptosActualizar.length > 0) {
        if (onActualizarVariosFisica) {
          const actualizados = await onActualizarVariosFisica(orisActualizar, conceptosActualizar);
          partes.push(`${actualizados} registro${actualizados === 1 ? "" : "s"} existente${actualizados === 1 ? "" : "s"} actualizado${actualizados === 1 ? "" : "s"}`);
        } else {
          const total = orisActualizar.length + conceptosActualizar.length;
          partes.push(`${total} ya exist${total === 1 ? "e" : "en"} y no se actualiz${total === 1 ? "ó" : "aron"} (falta onActualizarVariosFisica)`);
        }
      }

      if (partes.length === 0) partes.push("El archivo no traía registros.");
      setMensajeImportacion(partes.join(" · "));
    } catch (err) {
      console.error("[FisicaPage] error importando JSON:", err);
      setMensajeImportacion(err instanceof Error ? `Error: ${err.message}` : "Error al leer el archivo.");
    } finally {
      setImportando(false);
    }
  }

  async function handleAgregarConcepto(bloque: string) {
    setAgregandoConceptoDe(bloque);
    try {
      const orden =
        Math.max(0, ...conceptosLocal.filter((c) => c.bloque === bloque).map((c) => c.orden)) + 1;
      const { data, error } = await supabase
        .from(FISICA_CONCEPTOS_CONFIG.tabla)
        .insert([{ bloque, titulo: "Nuevo concepto", contenido: "", orden }])
        .select()
        .single();
      if (error) throw error;
      const nuevo = data as FisicaConcepto;
      setConceptosLocal((prev) => [...prev, nuevo]);
      setSeleccion({ tipo: "concepto", id: nuevo.id });
    } catch (e) {
      console.error("[FisicaPage] error creando concepto:", e);
    } finally {
      setAgregandoConceptoDe(null);
    }
  }

  async function handleCrearSeccion() {
    const nombre = nuevaSeccionNombre.trim();
    if (!nombre) return;
    setCreandoSeccion(true);
    try {
      const { data, error } = await supabase
        .from(FISICA_CONCEPTOS_CONFIG.tabla)
        .insert([{ bloque: nombre, titulo: "Nuevo concepto", contenido: "", orden: 1 }])
        .select()
        .single();
      if (error) throw error;
      const nuevo = data as FisicaConcepto;
      setConceptosLocal((prev) => [...prev, nuevo]);
      setSeleccion({ tipo: "concepto", id: nuevo.id });
      setNuevaSeccionNombre("");
      setMostrarInputSeccion(false);
    } catch (e) {
      console.error("[FisicaPage] error creando sección:", e);
    } finally {
      setCreandoSeccion(false);
    }
  }

  async function handleEliminarConcepto(id: string) {
    try {
      const { error } = await supabase
        .from(FISICA_CONCEPTOS_CONFIG.tabla)
        .delete()
        .eq("id", id);
      if (error) throw error;
      setConceptosLocal((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error("[FisicaPage] error eliminando concepto:", e);
    }
  }

  const orisActivo = useMemo(
    () => (seleccion?.tipo === "oris" ? oris.find((o) => o.id === seleccion.id) ?? null : null),
    [oris, seleccion],
  );

  const conceptoActivo = useMemo(
    () =>
      seleccion?.tipo === "concepto"
        ? conceptosLocal.find((c) => c.id === seleccion.id) ?? null
        : null,
    [conceptosLocal, seleccion],
  );

  const subsistemaActivo = useMemo(
    () =>
      seleccion?.tipo === "subsistema"
        ? subsistemas.find((s) => s.id === seleccion.id) ?? null
        : null,
    [subsistemas, seleccion],
  );

  const orisPorFamilia = useMemo(() => {
    const map = new Map<OrisFamilia, Oris[]>();
    for (const familia of ORIS_FAMILIAS) map.set(familia, []);
    for (const o of oris) map.get(o.familia)?.push(o);
    return map;
  }, [oris]);

  const bloquesConceptos = useMemo(() => agruparPorBloque(conceptosLocal), [conceptosLocal]);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Barra superior de navegación (mismo patrón que SubTabsElementos en
          Química): tabs para Bases / Oris / Conceptos / Subsistemas, en vez
          de la columna lateral que había antes. */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 pt-2 pb-1.5 border-b border-primary/10">
        <div className="flex items-center gap-1 flex-wrap">
          {(
            [
              { tipo: "todas-bases" as const, label: `Bases · ${PARTICULAS_BASE.length + particulas.length + IUMS.length}`, Icon: null as typeof Atom | null, onAdd: undefined as (() => void) | undefined, addPending: undefined as boolean | undefined },
              { tipo: "todos-oris" as const, label: `Oris · ${oris.length}`, Icon: Atom, onAdd: onCreateOris, addPending: creatingOris },
              { tipo: "todos-conceptos" as const, label: `Conceptos · ${conceptosLocal.length}`, Icon: null, onAdd: undefined, addPending: undefined },
              { tipo: "todos-subsistemas" as const, label: `Subsistemas de Magia · ${subsistemas.length}`, Icon: Sparkles, onAdd: undefined, addPending: undefined },
            ]
          ).map(({ tipo, label, Icon, onAdd, addPending }) => {
            const activo =
              seleccion?.tipo === tipo ||
              (tipo === "todos-oris" && seleccion?.tipo === "oris") ||
              (tipo === "todos-conceptos" && seleccion?.tipo === "concepto") ||
              (tipo === "todos-subsistemas" && seleccion?.tipo === "subsistema");
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => setSeleccion({ tipo } as Seleccion)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide transition-all cursor-pointer ${
                  activo
                    ? "bg-primary/10 text-primary"
                    : "text-primary/40 hover:text-primary/70 hover:bg-primary/5"
                }`}
              >
                {Icon && <Icon size={11} />}
                {label}
                {onAdd && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdd();
                    }}
                    title="Nuevo Oris"
                    className="flex items-center justify-center w-4 h-4 rounded text-primary/30 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {addPending ? <Loader2 className="animate-spin" size={9} /> : <Plus size={10} />}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="shrink-0 flex items-center gap-0.5">
          {onImportarFisica && (
            <>
              <input
                ref={inputArchivoRef}
                type="file"
                accept="application/json,.json"
                onChange={handleArchivoSeleccionado}
                className="hidden"
              />
              <button
                type="button"
                disabled={importando}
                onClick={() => inputArchivoRef.current?.click()}
                title='Subir un JSON con Oris y/o conceptos: crea los nuevos y actualiza los existentes (mismo formato que "Descargar datos")'
                className="flex items-center justify-center w-5 h-5 rounded-md text-primary/40 hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {importando ? <Loader2 className="animate-spin" size={10} /> : <Upload size={10} />}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => descargarDatosFisica(particulas, oris, conceptosLocal)}
            title="Descargar todos los datos de Física (catálogos + Oris + conceptos) como JSON"
            className="flex items-center justify-center w-5 h-5 rounded-md text-primary/40 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
          >
            <Download size={10} />
          </button>
        </div>
      </div>

      {mensajeImportacion && (
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 border-b border-primary/10 text-micro text-primary/60 bg-primary/[0.03]">
          <span className="min-w-0">{mensajeImportacion}</span>
          <button
            type="button"
            onClick={() => setMensajeImportacion(null)}
            className="shrink-0 text-primary/30 hover:text-primary/60 cursor-pointer"
            title="Cerrar"
          >
            <X size={10} />
          </button>
        </div>
      )}

      {/* Contenido: ocupa todo el ancho ahora que no hay columna lateral. */}
      <div className="flex-1 min-h-0 flex flex-col min-w-0">
        {orisActivo ? (
          <OrisEditor
            oris={orisActivo}
            onBack={() => setSeleccion({ tipo: "todos-oris" })}
            onActualizar={onActualizarOris}
            onEliminar={
              onEliminarOris
                ? (id) => {
                    onEliminarOris(id);
                    setSeleccion({ tipo: "todos-oris" });
                  }
                : undefined
            }
          />
        ) : seleccion?.tipo === "todos-oris" ? (
          <TodosLosOrisView
            orisPorFamilia={orisPorFamilia}
            onBack={() => setSeleccion(null)}
            onActualizarOris={onActualizarOris}
            onEliminarOris={onEliminarOris}
          />
        ) : seleccion?.tipo === "todas-bases" ? (
          <TodasLasBasesView particulas={particulas} onBack={() => setSeleccion(null)} />
        ) : seleccion?.tipo === "todos-conceptos" ? (
          <TodosLosConceptosView
            bloques={bloquesConceptos}
            onBack={() => setSeleccion(null)}
            onActualizarConcepto={(id, cambios) => {
              setConceptosLocal((prev) =>
                prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)),
              );
              onActualizarConcepto(id, cambios);
            }}
            onEliminarConcepto={handleEliminarConcepto}
            onAgregarConcepto={handleAgregarConcepto}
            agregandoConceptoDe={agregandoConceptoDe}
            mostrarInputSeccion={mostrarInputSeccion}
            nuevaSeccionNombre={nuevaSeccionNombre}
            onCambiarNuevaSeccionNombre={setNuevaSeccionNombre}
            onConfirmarNuevaSeccion={handleCrearSeccion}
            onCancelarNuevaSeccion={() => {
              setMostrarInputSeccion(false);
              setNuevaSeccionNombre("");
            }}
            onAbrirNuevaSeccion={() => setMostrarInputSeccion(true)}
            creandoSeccion={creandoSeccion}
          />
        ) : conceptoActivo ? (
          <ConceptoEditor
            concepto={conceptoActivo}
            onBack={() => setSeleccion({ tipo: "todos-conceptos" })}
            onActualizar={(id, cambios) => {
              setConceptosLocal((prev) =>
                prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)),
              );
              onActualizarConcepto(id, cambios);
            }}
            onEliminar={(id) => {
              handleEliminarConcepto(id);
              setSeleccion({ tipo: "todos-conceptos" });
            }}
          />
        ) : seleccion?.tipo === "todos-subsistemas" ? (
          <TodosLosSubsistemasView
            subsistemas={subsistemas}
            loading={loadingSubsistemas}
            creating={creandoSubsistema}
            onBack={() => setSeleccion(null)}
            onCrear={onCrearSubsistema}
            onSelect={(id) => setSeleccion({ tipo: "subsistema", id })}
          />
        ) : subsistemaActivo ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-2.5">
            <PanelEditorSubsistema
              subsistema={subsistemaActivo}
              onVolver={() => setSeleccion({ tipo: "todos-subsistemas" })}
              onSave={(updates) => onActualizarSubsistema(subsistemaActivo.id, updates)}
              onDelete={() => {
                onEliminarSubsistema(subsistemaActivo.id);
                setSeleccion({ tipo: "todos-subsistemas" });
              }}
              onSelectCriatura={onSelectCriatura}
            />
          </div>
        ) : (
          <EditorVacio />
        )}
      </div>
    </div>
  );
}
