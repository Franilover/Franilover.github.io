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

import { Atom, Download, Loader2, Plus } from "lucide-react";
import React, { useMemo, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import { OrisEditor } from "./OrisEditor";
import {
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
      <div className="px-3 py-1.5 bg-primary/[0.04] border-b border-primary/10">
        <p className="text-micro font-black uppercase tracking-widest text-primary/50">
          {titulo}
        </p>
      </div>
      <div className="p-2 grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
        {filas.map((f) => (
          <div
            key={f.nombre}
            className="flex flex-col gap-0.5 px-2 py-1.5 rounded-md bg-primary/[0.02] border border-primary/5"
          >
            <span className="text-xs font-bold text-primary/80 truncate">{f.nombre}</span>
            <span className="text-[10px] text-primary/45 truncate">{f.detalle}</span>
            {f.extra && <span className="text-[10px] text-primary/35 truncate">{f.extra}</span>}
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
      className={`group flex flex-col items-stretch gap-1 p-2.5 rounded-lg border transition-colors text-left ${
        seleccionado
          ? "border-primary/50 bg-primary/10 ring-2 ring-primary/40"
          : "border-primary/10 bg-primary/[0.02] hover:bg-primary/5 hover:border-primary/25"
      }`}
    >
      <span className="text-sm font-black text-primary truncate">{oris.nombre}</span>
      <span className="text-[10px] font-bold text-primary/45 truncate">{oris.formula}</span>
      <span className="text-[10px] text-primary/35 truncate">{oris.dominio}</span>
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
  if (items.length === 0) return null;
  const Icon = ORIS_FAMILIA_ICON[familia];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-primary/40">
        <Icon size={12} />
        <p className="text-micro font-black uppercase tracking-widest">{familia}</p>
      </div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
      >
        {items.map((o) => (
          <OrisCasilla
            key={o.id}
            oris={o}
            seleccionado={o.id === activoId}
            onClick={() => onSeleccionar(o.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Bloque 3: conceptos, agrupados y editables inline ─────────────────────

function ConceptoCard({
  concepto,
  onActualizar,
}: {
  concepto: FisicaConcepto;
  onActualizar: (id: string, cambios: Partial<FisicaConcepto>) => void;
}) {
  const [local, setLocal] = useState(concepto);

  async function persist(cambios: Partial<FisicaConcepto>) {
    const { error } = await supabase
      .from("fisica_conceptos")
      .update(cambios)
      .eq("id", concepto.id);
    if (!error) onActualizar(concepto.id, cambios);
  }

  return (
    <div className="rounded-lg border border-primary/10 bg-primary/[0.02] p-2.5 flex flex-col gap-1.5">
      <input
        value={local.titulo}
        onChange={(e) => setLocal((p) => ({ ...p, titulo: e.target.value }))}
        onBlur={() => persist({ titulo: local.titulo })}
        className="bg-transparent text-xs font-black text-primary/80 outline-none"
      />
      <textarea
        value={local.contenido}
        onChange={(e) => setLocal((p) => ({ ...p, contenido: e.target.value }))}
        onBlur={() => persist({ contenido: local.contenido })}
        rows={4}
        className="bg-transparent text-xs text-primary/55 leading-relaxed outline-none resize-none"
      />
    </div>
  );
}

function BloqueConceptos({
  bloque,
  items,
  onActualizar,
}: {
  bloque: string;
  items: FisicaConcepto[];
  onActualizar: (id: string, cambios: Partial<FisicaConcepto>) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-micro font-black uppercase tracking-widest text-primary/40">{bloque}</p>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
      >
        {items.map((c) => (
          <ConceptoCard key={c.id} concepto={c} onActualizar={onActualizar} />
        ))}
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

  const activoId = seleccionadoId ?? seleccionarOrisId ?? null;
  const activo = useMemo(() => oris.find((o) => o.id === activoId) ?? null, [oris, activoId]);

  const orisPorFamilia = useMemo(() => {
    const map = new Map<OrisFamilia, Oris[]>();
    for (const familia of ORIS_FAMILIAS) map.set(familia, []);
    for (const o of oris) map.get(o.familia)?.push(o);
    return map;
  }, [oris]);

  const bloquesConceptos = useMemo(() => agruparPorBloque(conceptos), [conceptos]);

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden relative">
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-primary/40">
            <Atom size={13} />
            <p className="text-micro font-black uppercase tracking-widest">
              Física · {oris.length} Oris
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => descargarDatosFisica(oris, conceptos)}
              title="Descargar todos los datos de Física (catálogos + Oris + conceptos) como JSON"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-micro font-black uppercase tracking-widest border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
            >
              <Download size={11} />
              <span className="hidden sm:inline">Descargar datos</span>
            </button>
            {onCreateOris && (
              <button
                type="button"
                disabled={creatingOris}
                onClick={onCreateOris}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {creatingOris ? <Loader2 className="animate-spin" size={11} /> : <Plus size={11} />}
                Nuevo Oris
              </button>
            )}
          </div>
        </div>

        {/* Bloque 1: catálogos fijos */}
        <div className="flex flex-col gap-3">
          <p className="text-micro font-black uppercase tracking-[0.28em] text-primary/25">
            Jerarquía · Partícula Base → Partículas → Ium → Oris
          </p>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <CatalogoCard titulo="Partícula Base" filas={PARTICULAS_BASE} />
            <CatalogoCard titulo="Partículas" filas={PARTICULAS} />
            <CatalogoCard titulo="Iums" filas={IUMS} />
          </div>
        </div>

        {/* Bloque 2: Oris por familia */}
        <div className="flex flex-col gap-3">
          {loadingOris && oris.length === 0 ? (
            <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>
          ) : oris.length === 0 ? (
            <div className="py-6 text-xs text-primary/25 text-center">
              Todavía no hay Oris cargados.
            </div>
          ) : (
            ORIS_FAMILIAS.map((familia) => (
              <GrupoOrisPorFamilia
                key={familia}
                familia={familia}
                items={orisPorFamilia.get(familia) ?? []}
                activoId={activoId}
                onSeleccionar={(id) =>
                  setSeleccionadoId((actual) => (actual === id ? null : id))
                }
              />
            ))
          )}
        </div>

        {/* Bloque 3: conceptos */}
        <div className="flex flex-col gap-4">
          <p className="text-micro font-black uppercase tracking-[0.28em] text-primary/25">
            Conceptos
          </p>
          {loadingConceptos && conceptos.length === 0 ? (
            <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>
          ) : (
            bloquesConceptos.map(({ bloque, items }) => (
              <BloqueConceptos
                key={bloque}
                bloque={bloque}
                items={items}
                onActualizar={onActualizarConcepto}
              />
            ))
          )}
        </div>
      </div>

      {/* Panel lateral: overlay + drawer a la derecha con el detalle del
          Oris seleccionado. El grid queda visible detrás, para poder
          seguir eligiendo otros Oris sin perder contexto. */}
      {activo && (
        <>
          <div
            className="absolute inset-0 z-30 md:hidden"
            style={{ background: "color-mix(in srgb, var(--primary) 20%, transparent)" }}
            onClick={() => setSeleccionadoId(null)}
          />
          <div
            className="absolute md:relative inset-y-0 right-0 z-40 flex flex-col w-full sm:w-[380px] md:w-[420px] shrink-0 border-l shadow-2xl md:shadow-none"
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
        </>
      )}
    </div>
  );
}
