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

import { Atom, ChevronLeft, Download, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { RichEditor } from "@/editor/lexical";
import { supabase } from "@/infra/supabase/supabase";
import { useConfirm } from "@/ui/ConfirmModal";

import { OrisEditor } from "./OrisEditor";
import {
  FISICA_CONCEPTOS_CONFIG,
  IUMS,
  ORIS_FAMILIAS,
  ORIS_FAMILIA_ICON,
  PARTICULAS,
  PARTICULAS_BASE,
  agruparPorBloque,
  type FilaCatalogo,
  type FisicaConcepto,
  type Oris,
  type OrisFamilia,
} from "./types";

interface Props {
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
}

/** Qué está activo en el editor de la columna derecha. */
type Seleccion =
  | { tipo: "oris"; id: string }
  | { tipo: "concepto"; id: string }
  | { tipo: "todos-oris" }
  | { tipo: "todas-bases" }
  | { tipo: "todos-conceptos" }
  | null;

// ─── Descarga: todo el contenido de Física en un solo JSON ────────────────
function descargarDatosFisica(oris: Oris[], conceptos: FisicaConcepto[]) {
  const payload = {
    exportado_en: new Date().toISOString(),
    particula_base: PARTICULAS_BASE,
    particulas: PARTICULAS,
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

// ─── Filas de navegación (columna izquierda) ───────────────────────────────


const CATALOGOS_BASES: { key: "particula-base" | "particulas" | "iums"; titulo: string; filas: FilaCatalogo[] }[] =
  [
    { key: "particula-base", titulo: "Partícula Base", filas: PARTICULAS_BASE },
    { key: "particulas", titulo: "Partículas", filas: PARTICULAS },
    { key: "iums", titulo: "Iums", filas: IUMS },
  ];

function TodasLasBasesView({ onBack }: { onBack: () => void }) {
  const total = CATALOGOS_BASES.reduce((acc, c) => acc + c.filas.length, 0);
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
        <p className="text-micro font-black uppercase tracking-widest text-primary">
          Bases · {total}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 flex flex-col gap-4">
        {CATALOGOS_BASES.map(({ key, titulo, filas }, idx) => (
          <div key={key} className="flex flex-col gap-2">
            <div
              className={`flex items-center gap-1.5 text-primary/50 pb-1.5 ${
                idx > 0 ? "pt-2 border-t border-primary/10" : ""
              }`}
            >
              <p className="text-micro font-black uppercase tracking-[0.2em]">
                {titulo} · {filas.length}
              </p>
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
 * y separador; dentro, sus Oris se acomodan en 3 columnas para aprovechar
 * el espacio horizontal.
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
  const totalOris = ORIS_FAMILIAS.reduce((acc, f) => acc + (orisPorFamilia.get(f)?.length ?? 0), 0);
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
        <Atom size={12} className="shrink-0 text-primary/40" />
        <p className="text-micro font-black uppercase tracking-widest text-primary">
          Oris · {totalOris}
        </p>
      </div>

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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 items-start">
                  {items.map((o) => (
                    <div key={o.id} className="rounded-lg border border-primary/10 overflow-hidden">
                      <OrisEditor
                        oris={o}
                        onBack={onBack}
                        onActualizar={onActualizarOris}
                        onEliminar={onEliminarOris}
                        embedded
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
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
  const total = bloques.reduce((acc, b) => acc + b.items.length, 0);
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
        <p className="flex-1 min-w-0 text-micro font-black uppercase tracking-widest text-primary">
          Conceptos · {total}
        </p>

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
          bloques.map(({ bloque, items }, idx) => (
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 items-start">
                {items.map((c) => (
                  <div key={c.id} className="rounded-lg border border-primary/10 overflow-hidden">
                    <ConceptoEditor
                      concepto={c}
                      onBack={onBack}
                      onActualizar={onActualizarConcepto}
                      onEliminar={onEliminarConcepto}
                      embedded
                    />
                  </div>
                ))}
              </div>
            </div>
          ))
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

  useEffect(() => setLocal(concepto), [concepto]);

  async function persist(cambios: Partial<FisicaConcepto>) {
    const { error } = await supabase
      .from("fisica_conceptos")
      .update(cambios)
      .eq("id", concepto.id);
    if (!error) onActualizar(concepto.id, cambios);
  }

  return (
    <div className={embedded ? "flex flex-col overflow-hidden" : "flex-1 flex flex-col min-h-0 overflow-hidden"}>
      <ConfirmModal />
      <div
        style={{ background: "var(--bg-main)" }}
        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 border-b border-primary/10"
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

        <span className="shrink-0 text-micro font-black uppercase tracking-widest text-primary/30 px-1.5 py-0.5 rounded border border-primary/15">
          {concepto.bloque}
        </span>

        <input
          value={local.titulo}
          onChange={(e) => setLocal((p) => ({ ...p, titulo: e.target.value }))}
          onBlur={() => persist({ titulo: local.titulo })}
          placeholder="Título del concepto"
          className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
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
            className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all cursor-pointer"
            title="Eliminar concepto"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>

      <div className={embedded ? "p-2.5" : "flex-1 min-h-0 p-2.5 overflow-y-auto"}>
        <div className="text-sm">
          <RichEditor
            minHeight={embedded ? "8rem" : "16rem"}
            placeholder="Contenido del concepto…"
            value={local.contenido}
            onChange={(v) => {
              setLocal((p) => ({ ...p, contenido: v }));
              persist({ contenido: v });
            }}
          />
        </div>
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

  const orisPorFamilia = useMemo(() => {
    const map = new Map<OrisFamilia, Oris[]>();
    for (const familia of ORIS_FAMILIAS) map.set(familia, []);
    for (const o of oris) map.get(o.familia)?.push(o);
    return map;
  }, [oris]);

  const bloquesConceptos = useMemo(() => agruparPorBloque(conceptosLocal), [conceptosLocal]);

  const hayAlgoSeleccionado = seleccion !== null;

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      {/* Columna izquierda: navegación. En mobile se oculta si hay algo
          seleccionado, para dejarle todo el espacio al editor. */}
      <div
        className={`w-full sm:w-56 md:w-60 shrink-0 sm:flex flex-col min-h-0 overflow-hidden border-r border-primary/10 ${
          hayAlgoSeleccionado ? "hidden" : "flex"
        }`}
      >
        <div className="shrink-0 flex items-center justify-between px-2 py-1.5 border-b border-primary/10">
          <div className="flex items-center gap-1 text-primary/40">
            <Atom size={11} />
            <p className="text-micro font-black uppercase tracking-widest">
              Física · {oris.length}
            </p>
          </div>
          <button
            type="button"
            onClick={() => descargarDatosFisica(oris, conceptosLocal)}
            title="Descargar todos los datos de Física (catálogos + Oris + conceptos) como JSON"
            className="flex items-center justify-center w-5 h-5 rounded-md text-primary/40 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
          >
            <Download size={10} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-1.5 flex flex-col gap-1.5">
          {/* Bases — botón único, abre los 3 catálogos en la columna derecha */}
          <button
            type="button"
            onClick={() => setSeleccion({ tipo: "todas-bases" })}
            className={`flex items-center justify-between px-1.5 py-1.5 rounded-lg border transition-colors ${
              seleccion?.tipo === "todas-bases"
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-primary/10 bg-primary/[0.04] text-primary/50 hover:bg-primary/[0.07]"
            }`}
          >
            <span className="text-micro font-black uppercase tracking-[0.2em]">
              Bases · {PARTICULAS_BASE.length + PARTICULAS.length + IUMS.length}
            </span>
          </button>

          {/* Oris — botón único, abre las 3 familias en la columna derecha */}
          <button
            type="button"
            onClick={() => setSeleccion({ tipo: "todos-oris" })}
            className={`flex items-center justify-between px-1.5 py-1.5 rounded-lg border transition-colors ${
              seleccion?.tipo === "todos-oris"
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-primary/10 bg-primary/[0.04] text-primary/50 hover:bg-primary/[0.07]"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Atom size={11} />
              <span className="text-micro font-black uppercase tracking-[0.2em]">
                Oris · {oris.length}
              </span>
            </div>
            {onCreateOris && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateOris();
                }}
                title="Nuevo Oris"
                className="flex items-center justify-center w-4 h-4 rounded text-primary/30 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer disabled:opacity-50"
              >
                {creatingOris ? <Loader2 className="animate-spin" size={9} /> : <Plus size={10} />}
              </span>
            )}
          </button>

          {/* Conceptos — botón único, abre los bloques en la columna derecha */}
          <button
            type="button"
            onClick={() => setSeleccion({ tipo: "todos-conceptos" })}
            className={`flex items-center justify-between px-1.5 py-1.5 rounded-lg border transition-colors ${
              seleccion?.tipo === "todos-conceptos"
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-primary/10 bg-primary/[0.04] text-primary/50 hover:bg-primary/[0.07]"
            }`}
          >
            <span className="text-micro font-black uppercase tracking-[0.2em]">
              Conceptos · {conceptosLocal.length}
            </span>
          </button>
        </div>
      </div>

      {/* Columna derecha: editor fijo. En mobile ocupa toda la pantalla
          cuando hay algo seleccionado; en desktop siempre está visible. */}
      <div
        className={`flex-1 min-h-0 flex-col min-w-0 ${hayAlgoSeleccionado ? "flex" : "hidden sm:flex"}`}
      >
        {orisActivo ? (
          <OrisEditor
            oris={orisActivo}
            onBack={() => setSeleccion(null)}
            onActualizar={onActualizarOris}
            onEliminar={
              onEliminarOris
                ? (id) => {
                    onEliminarOris(id);
                    setSeleccion(null);
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
          <TodasLasBasesView onBack={() => setSeleccion(null)} />
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
            onBack={() => setSeleccion(null)}
            onActualizar={(id, cambios) => {
              setConceptosLocal((prev) =>
                prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)),
              );
              onActualizarConcepto(id, cambios);
            }}
            onEliminar={(id) => {
              handleEliminarConcepto(id);
              setSeleccion(null);
            }}
          />
        ) : (
          <EditorVacio />
        )}
      </div>
    </div>
  );
}
