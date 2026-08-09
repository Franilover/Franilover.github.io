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
type Seleccion = { tipo: "oris"; id: string } | { tipo: "concepto"; id: string } | null;

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

// ─── Catálogos fijos, versión compacta para la columna angosta ────────────

function CatalogoCardMini({ titulo, filas }: { titulo: string; filas: FilaCatalogo[] }) {
  return (
    <details className="rounded-lg border border-primary/10 overflow-hidden group">
      <summary className="px-2 py-1.5 bg-primary/[0.04] cursor-pointer select-none flex items-center justify-between">
        <span className="text-micro font-black uppercase tracking-widest text-primary/50">
          {titulo}
        </span>
        <span className="text-micro text-primary/30 group-open:rotate-90 transition-transform">
          ›
        </span>
      </summary>
      <div className="p-1.5 flex flex-col gap-1 border-t border-primary/10">
        {filas.map((f) => (
          <div key={f.nombre} className="flex flex-col gap-0 px-1.5 py-1 rounded-md bg-primary/[0.02]">
            <span className="text-micro font-bold text-primary/80 truncate">{f.nombre}</span>
            <span className="text-micro text-primary/45 truncate">{f.detalle}</span>
            {f.extra && <span className="text-micro text-primary/35 truncate">{f.extra}</span>}
          </div>
        ))}
      </div>
    </details>
  );
}

// ─── Filas de navegación (columna izquierda) ───────────────────────────────

function OrisFila({
  oris,
  seleccionado,
  onClick,
}: {
  oris: Oris;
  seleccionado?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-stretch gap-0 px-2 py-1.5 rounded-md border text-left transition-colors ${
        seleccionado
          ? "border-primary/50 bg-primary/10"
          : "border-transparent hover:bg-primary/5 hover:border-primary/15"
      }`}
    >
      <span className="text-micro font-black text-primary truncate">{oris.nombre}</span>
      <span className="text-micro text-primary/40 truncate">
        {oris.formula} · {oris.dominio}
      </span>
    </button>
  );
}

function GrupoOrisPorFamilia({
  familia,
  items,
  activoId,
  onSeleccionar,
}: {
  familia: OrisFamilia;
  items: Oris[];
  activoId?: string | null;
  onSeleccionar: (id: string) => void;
}) {
  const Icon = ORIS_FAMILIA_ICON[familia];
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-1.5 text-primary/40 px-2 pt-1">
        <Icon size={11} />
        <p className="text-micro font-black uppercase tracking-widest">{familia}</p>
      </div>
      <div className="flex flex-col gap-0.5">
        {items.length === 0 ? (
          <div className="mx-2 py-2 text-micro text-primary/25 text-center border border-dashed border-primary/10 rounded-md">
            Sin Oris
          </div>
        ) : (
          items.map((o) => (
            <OrisFila
              key={o.id}
              oris={o}
              seleccionado={o.id === activoId}
              onClick={() => onSeleccionar(o.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ConceptoFila({
  concepto,
  seleccionado,
  onClick,
}: {
  concepto: FisicaConcepto;
  seleccionado?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-stretch gap-0 px-2 py-1.5 rounded-md border text-left transition-colors ${
        seleccionado
          ? "border-primary/50 bg-primary/10"
          : "border-transparent hover:bg-primary/5 hover:border-primary/15"
      }`}
    >
      <span className="text-micro font-black text-primary/80 truncate">
        {concepto.titulo || "Sin título"}
      </span>
      <span className="text-micro text-primary/40 truncate">
        {concepto.contenido?.replace(/<[^>]+>/g, "").slice(0, 60) || "Sin contenido…"}
      </span>
    </button>
  );
}

function BloqueConceptos({
  bloque,
  items,
  activoId,
  onSeleccionar,
  onAgregarConcepto,
  agregandoConcepto,
}: {
  bloque: string;
  items: FisicaConcepto[];
  activoId?: string | null;
  onSeleccionar: (id: string) => void;
  onAgregarConcepto?: (bloque: string) => void;
  agregandoConcepto?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between gap-1 px-2 pt-1">
        <p className="text-micro font-black uppercase tracking-widest text-primary/40 truncate">
          {bloque}
        </p>
        {onAgregarConcepto && (
          <button
            type="button"
            disabled={agregandoConcepto}
            onClick={() => onAgregarConcepto(bloque)}
            title={`Añadir concepto en "${bloque}"`}
            className="shrink-0 flex items-center justify-center w-4 h-4 rounded text-primary/30 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer disabled:opacity-50"
          >
            {agregandoConcepto ? (
              <Loader2 className="animate-spin" size={9} />
            ) : (
              <Plus size={10} />
            )}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        {items.map((c) => (
          <ConceptoFila
            key={c.id}
            concepto={c}
            seleccionado={c.id === activoId}
            onClick={() => onSeleccionar(c.id)}
          />
        ))}
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
}: {
  concepto: FisicaConcepto;
  onBack: () => void;
  onActualizar: (id: string, cambios: Partial<FisicaConcepto>) => void;
  onEliminar?: (id: string) => void;
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
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <ConfirmModal />
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

      <div className="flex-1 min-h-0 p-2.5 overflow-y-auto">
        <div className="text-sm">
          <RichEditor
            minHeight="16rem"
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
        className={`w-full sm:w-72 md:w-80 shrink-0 sm:flex flex-col min-h-0 overflow-hidden border-r border-primary/10 ${
          hayAlgoSeleccionado ? "hidden" : "flex"
        }`}
      >
        <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-primary/10">
          <div className="flex items-center gap-1.5 text-primary/40">
            <Atom size={12} />
            <p className="text-micro font-black uppercase tracking-widest">
              Física · {oris.length} Oris
            </p>
          </div>
          <button
            type="button"
            onClick={() => descargarDatosFisica(oris, conceptosLocal)}
            title="Descargar todos los datos de Física (catálogos + Oris + conceptos) como JSON"
            className="flex items-center justify-center w-6 h-6 rounded-md text-primary/40 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
          >
            <Download size={11} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-3">
          {/* Catálogos fijos — compactos, colapsables */}
          <div className="flex flex-col gap-1">
            <CatalogoCardMini titulo="Partícula Base" filas={PARTICULAS_BASE} />
            <CatalogoCardMini titulo="Partículas" filas={PARTICULAS} />
            <CatalogoCardMini titulo="Iums" filas={IUMS} />
          </div>

          {/* Oris por familia */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-1">
              <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/25">
                Oris
              </p>
              {onCreateOris && (
                <button
                  type="button"
                  disabled={creatingOris}
                  onClick={onCreateOris}
                  title="Nuevo Oris"
                  className="flex items-center justify-center w-4 h-4 rounded text-primary/30 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer disabled:opacity-50"
                >
                  {creatingOris ? <Loader2 className="animate-spin" size={9} /> : <Plus size={10} />}
                </button>
              )}
            </div>
            {loadingOris && oris.length === 0 ? (
              <div className="py-4 text-micro text-primary/30 text-center">Cargando…</div>
            ) : (
              ORIS_FAMILIAS.map((familia) => (
                <GrupoOrisPorFamilia
                  key={familia}
                  familia={familia}
                  items={orisPorFamilia.get(familia) ?? []}
                  activoId={orisActivo?.id ?? null}
                  onSeleccionar={(id) => setSeleccion({ tipo: "oris", id })}
                />
              ))
            )}
          </div>

          {/* Conceptos por bloque */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-1 gap-2">
              <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/25">
                Conceptos
              </p>
              {mostrarInputSeccion ? (
                <div className="flex items-center gap-1 min-w-0">
                  <input
                    autoFocus
                    value={nuevaSeccionNombre}
                    onChange={(e) => setNuevaSeccionNombre(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCrearSeccion();
                      if (e.key === "Escape") {
                        setMostrarInputSeccion(false);
                        setNuevaSeccionNombre("");
                      }
                    }}
                    placeholder="Nombre…"
                    className="w-full min-w-0 bg-primary/5 rounded px-1.5 py-0.5 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30 placeholder:text-primary/25"
                  />
                  <button
                    type="button"
                    disabled={creandoSeccion || !nuevaSeccionNombre.trim()}
                    onClick={handleCrearSeccion}
                    className="shrink-0 flex items-center justify-center w-4 h-4 rounded text-primary/40 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {creandoSeccion ? <Loader2 className="animate-spin" size={9} /> : "✓"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarInputSeccion(false);
                      setNuevaSeccionNombre("");
                    }}
                    className="shrink-0 flex items-center justify-center w-4 h-4 rounded text-primary/30 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMostrarInputSeccion(true)}
                  title="Añadir nueva sección de conceptos"
                  className="shrink-0 flex items-center justify-center w-4 h-4 rounded text-primary/30 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                >
                  <Plus size={10} />
                </button>
              )}
            </div>
            {loadingConceptos && conceptosLocal.length === 0 ? (
              <div className="py-4 text-micro text-primary/30 text-center">Cargando…</div>
            ) : (
              bloquesConceptos.map(({ bloque, items }) => (
                <BloqueConceptos
                  key={bloque}
                  bloque={bloque}
                  items={items}
                  activoId={conceptoActivo?.id ?? null}
                  onSeleccionar={(id) => setSeleccion({ tipo: "concepto", id })}
                  onAgregarConcepto={handleAgregarConcepto}
                  agregandoConcepto={agregandoConceptoDe === bloque}
                />
              ))
            )}
          </div>
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
