"use client";

/**
 * FisicaPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Vista de la tab "Física" (Energías Universales), pensada para aprovechar
 * el espacio en bloques en vez de texto corrido de ensayo:
 *
 *   1. Catálogos fijos (Partícula Base / Partículas / Iums) — constantes,
 *      referencia rápida, sin CRUD.
 *   2. Grid de Oris agrupado por familia (Mecánica/Energética/Biológica) —
 *      editable, con detalle inline al seleccionar uno (mismo patrón que
 *      ElementosPage/RunasPage).
 *   3. Conceptos (Vacío/Garin/Eterium, Manifestaciones, etc.) agrupados por
 *      bloque en tarjetas cortas — editable inline.
 *
 * Todo el contenido variable (Oris, conceptos) vive en Supabase — tablas
 * "oris" y "fisica_conceptos", separadas de "elementos".
 */

import { Atom, ChevronLeft, Download, Loader2, Plus, Trash2 } from "lucide-react";
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

// ─── Descarga: todo el contenido de Física en un solo JSON ────────────────
// Incluye los catálogos fijos (Partícula Base/Partículas/Iums, que no
// tienen tabla propia) + los datos de Supabase (Oris, Conceptos), para
// mandar el archivo completo y editar todo junto de una.
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

// ─── Bloque 1: catálogos fijos ─────────────────────────────────────────────

function CatalogoCard({ titulo, filas }: { titulo: string; filas: FilaCatalogo[] }) {
  return (
    <div className="rounded-lg border border-primary/10 overflow-hidden">
      <div className="px-2 py-1 bg-primary/[0.04] border-b border-primary/10">
        <p className="text-micro font-black uppercase tracking-widest text-primary/50">
          {titulo}
        </p>
      </div>
      <div className="p-1.5 grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
        {filas.map((f) => (
          <div
            key={f.nombre}
            className="flex flex-col gap-0.5 px-1.5 py-1 rounded-md bg-primary/[0.02] border border-primary/5"
          >
            <span className="text-micro font-bold text-primary/80 truncate">{f.nombre}</span>
            <span className="text-micro text-primary/45 truncate">{f.detalle}</span>
            {f.extra && <span className="text-micro text-primary/35 truncate">{f.extra}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bloque 2: grid de Oris ─────────────────────────────────────────────────

function OrisCasilla({
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
      className={`group flex flex-col items-stretch gap-0.5 p-1.5 rounded-md border transition-colors text-left ${
        seleccionado
          ? "border-primary/50 bg-primary/10 ring-2 ring-primary/40"
          : "border-primary/10 bg-primary/[0.02] hover:bg-primary/5 hover:border-primary/25"
      }`}
    >
      <span className="text-micro font-black text-primary truncate">{oris.nombre}</span>
      <span className="text-micro font-bold text-primary/45 truncate">{oris.formula}</span>
      <span className="text-micro text-primary/35 truncate">{oris.dominio}</span>
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
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-1.5 text-primary/40">
        <Icon size={12} />
        <p className="text-micro font-black uppercase tracking-widest">{familia}</p>
      </div>
      <div className="flex flex-col gap-1">
        {items.length === 0 ? (
          <div className="py-3 text-micro text-primary/25 text-center border border-dashed border-primary/10 rounded-md">
            Sin Oris
          </div>
        ) : (
          items.map((o) => (
            <OrisCasilla
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

// ─── Bloque 3: conceptos, agrupados por bloque; editables en modal ─────────

/**
 * Casilla resumen: título + preview del contenido truncado. Ya no es
 * editable inline — al hacer click abre el detalle en el panel flotante
 * centrado (mismo patrón que Oris), para no perder el contexto de la
 * grilla al editar un texto largo.
 */
function ConceptoCasilla({
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
      className={`flex flex-col items-stretch gap-1 p-2 rounded-lg border text-left transition-colors ${
        seleccionado
          ? "border-primary/50 bg-primary/10 ring-2 ring-primary/40"
          : "border-primary/10 bg-primary/[0.02] hover:bg-primary/5 hover:border-primary/25"
      }`}
    >
      <span className="text-sm font-black text-primary/80 truncate">
        {concepto.titulo || "Sin título"}
      </span>
      <span className="text-sm text-primary/45 leading-relaxed line-clamp-2">
        {concepto.contenido || "Sin contenido…"}
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-micro font-black uppercase tracking-widest text-primary/40">
          {bloque}
        </p>
        {onAgregarConcepto && (
          <button
            type="button"
            disabled={agregandoConcepto}
            onClick={() => onAgregarConcepto(bloque)}
            title={`Añadir concepto en "${bloque}"`}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-micro font-black uppercase tracking-wide border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {agregandoConcepto ? (
              <Loader2 className="animate-spin" size={9} />
            ) : (
              <Plus size={9} />
            )}
            <span className="hidden sm:inline">Concepto</span>
          </button>
        )}
      </div>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
      >
        {items.map((c) => (
          <ConceptoCasilla
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
 * Detalle editable de un concepto, para el panel flotante centrado.
 * Mismo patrón de header que OrisEditor/ElementoEditor (volver + guardado
 * al perder foco), pero sin fila de metadatos — un concepto es solo
 * título + contenido largo.
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
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [conceptoSeleccionadoId, setConceptoSeleccionadoId] = useState<string | null>(null);
  const [conceptosLocal, setConceptosLocal] = useState<FisicaConcepto[]>(conceptos);
  useEffect(() => setConceptosLocal(conceptos), [conceptos]);

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
      setConceptoSeleccionadoId(nuevo.id);
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
      setConceptoSeleccionadoId(nuevo.id);
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

  const activoId = seleccionadoId ?? seleccionarOrisId ?? null;
  const activo = useMemo(() => oris.find((o) => o.id === activoId) ?? null, [oris, activoId]);

  const conceptoActivo = useMemo(
    () => conceptosLocal.find((c) => c.id === conceptoSeleccionadoId) ?? null,
    [conceptosLocal, conceptoSeleccionadoId],
  );

  const orisPorFamilia = useMemo(() => {
    const map = new Map<OrisFamilia, Oris[]>();
    for (const familia of ORIS_FAMILIAS) map.set(familia, []);
    for (const o of oris) map.get(o.familia)?.push(o);
    return map;
  }, [oris]);

  const bloquesConceptos = useMemo(() => agruparPorBloque(conceptosLocal), [conceptosLocal]);

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden relative">
      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-primary/40">
            <Atom size={12} />
            <p className="text-micro font-black uppercase tracking-widest">
              Física · {oris.length} Oris
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => descargarDatosFisica(oris, conceptosLocal)}
              title="Descargar todos los datos de Física (catálogos + Oris + conceptos) como JSON"
              className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
            >
              <Download size={10} />
              <span className="hidden sm:inline">Descargar datos</span>
            </button>
            {onCreateOris && (
              <button
                type="button"
                disabled={creatingOris}
                onClick={onCreateOris}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {creatingOris ? <Loader2 className="animate-spin" size={10} /> : <Plus size={10} />}
                Nuevo Oris
              </button>
            )}
          </div>
        </div>

        {/* Bloque 1: catálogos fijos */}
        <div className="flex flex-col gap-2">
          <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/25">
            Jerarquía · Partícula Base → Partículas → Ium → Oris
          </p>
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
            <CatalogoCard titulo="Partícula Base" filas={PARTICULAS_BASE} />
            <CatalogoCard titulo="Partículas" filas={PARTICULAS} />
            <CatalogoCard titulo="Iums" filas={IUMS} />
          </div>
        </div>

        {/* Bloque 2: Oris por familia — 3 columnas lado a lado (Mecánica |
            Energética | Biológica), cada una con sus Oris apilados
            verticalmente adentro. En pantallas angostas colapsa a 1
            columna para no aplastar el contenido. */}
        <div className="flex flex-col gap-2">
          {loadingOris && oris.length === 0 ? (
            <div className="py-6 text-micro text-primary/30 text-center">Cargando…</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              {ORIS_FAMILIAS.map((familia) => (
                <GrupoOrisPorFamilia
                  key={familia}
                  familia={familia}
                  items={orisPorFamilia.get(familia) ?? []}
                  activoId={activoId}
                  onSeleccionar={(id) =>
                    setSeleccionadoId((actual) => (actual === id ? null : id))
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Bloque 3: conceptos */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/25">
              Conceptos
            </p>
            {mostrarInputSeccion ? (
              <div className="flex items-center gap-1">
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
                  placeholder="Nombre de la sección…"
                  className="bg-primary/5 rounded-md px-2 py-0.5 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30 placeholder:text-primary/25"
                />
                <button
                  type="button"
                  disabled={creandoSeccion || !nuevaSeccionNombre.trim()}
                  onClick={handleCrearSeccion}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-micro font-black uppercase tracking-wide bg-primary text-btn-text hover:bg-primary/90 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {creandoSeccion ? <Loader2 className="animate-spin" size={9} /> : "Crear"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarInputSeccion(false);
                    setNuevaSeccionNombre("");
                  }}
                  className="px-1.5 py-0.5 rounded-md text-micro font-bold text-primary/40 hover:text-primary/70 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMostrarInputSeccion(true)}
                title="Añadir nueva sección de conceptos"
                className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
              >
                <Plus size={10} />
                <span className="hidden sm:inline">Nueva sección</span>
              </button>
            )}
          </div>
          {loadingConceptos && conceptosLocal.length === 0 ? (
            <div className="py-6 text-micro text-primary/30 text-center">Cargando…</div>
          ) : (
            bloquesConceptos.map(({ bloque, items }) => (
              <BloqueConceptos
                key={bloque}
                bloque={bloque}
                items={items}
                activoId={conceptoSeleccionadoId}
                onSeleccionar={(id) =>
                  setConceptoSeleccionadoId((actual) => (actual === id ? null : id))
                }
                onAgregarConcepto={handleAgregarConcepto}
                agregandoConcepto={agregandoConceptoDe === bloque}
              />
            ))
          )}
        </div>
      </div>

      {/* Panel flotante centrado: overlay clickeable + tarjeta con margen a
          los lados (no ocupa toda la pantalla) para poder salir tocando
          afuera sin sensación de estar atrapado. El grid queda debajo,
          visible detrás del overlay. */}
      {activo && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-8 md:p-12">
          <div
            className="absolute inset-0 bg-primary/10 backdrop-blur-sm"
            onClick={() => setSeleccionadoId(null)}
          />
          <div
            className="relative z-10 flex flex-col w-full max-w-xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] rounded-[var(--radius-card)] border shadow-2xl overflow-hidden"
            style={{
              background: "var(--white-custom, var(--bg-main))",
              borderColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
            }}
          >
            <OrisEditor
              oris={activo}
              onBack={() => setSeleccionadoId(null)}
              onActualizar={onActualizarOris}
              onEliminar={
                onEliminarOris
                  ? (id) => {
                      onEliminarOris(id);
                      setSeleccionadoId(null);
                    }
                  : undefined
              }
            />
          </div>
        </div>
      )}

      {/* Panel flotante centrado del concepto — mismo patrón que el de
          Oris arriba (overlay clickeable + tarjeta con margen). */}
      {conceptoActivo && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-8 md:p-12">
          <div
            className="absolute inset-0 bg-primary/10 backdrop-blur-sm"
            onClick={() => setConceptoSeleccionadoId(null)}
          />
          <div
            className="relative z-10 flex flex-col w-full max-w-xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] rounded-[var(--radius-card)] border shadow-2xl overflow-hidden"
            style={{
              background: "var(--white-custom, var(--bg-main))",
              borderColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
            }}
          >
            <ConceptoEditor
              concepto={conceptoActivo}
              onBack={() => setConceptoSeleccionadoId(null)}
              onActualizar={(id, cambios) => {
                setConceptosLocal((prev) =>
                  prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)),
                );
                onActualizarConcepto(id, cambios);
              }}
              onEliminar={(id) => {
                handleEliminarConcepto(id);
                setConceptoSeleccionadoId(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
