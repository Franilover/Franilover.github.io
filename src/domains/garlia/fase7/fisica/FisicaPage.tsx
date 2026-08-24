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

import { ChevronLeft, Download, Info, Loader2, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { RichEditor } from "@/editor/lexical";
import { supabase } from "@/infra/supabase/supabase";
import { useConfirm } from "@/ui/ConfirmModal";
import { PopoverFlotante } from "@/domains/garlia/_shared/PopoverFlotante";

import { OrisEditor } from "./OrisEditor";
import { IumVisual, ParticulaVisual } from "./ParticulaVisual";
import {
  FISICA_CONCEPTOS_CONFIG,
  agruparPorBloque,
  iumAFilaIum,
  orisAFilaCatalogo,
  particulaAFilaCatalogo,
  particulaBaseAFilaCatalogo,
  particulasDeIum,
  type FilaCatalogo,
  type FilaIum,
  type FilaParticulaBase,
  type FisicaConcepto,
  type Ium,
  type Oris,
  type Particula,
  type ParticulaBase,
} from "./types";
import type { Formacion, Reaccion } from "@/domains/garlia/elementos/types";
import { PanelEditorSubsistema } from "@/domains/garlia/runas/BloqueSubsistemasMagia";
import type { SubsistemaMagia } from "@/domains/garlia/runas/useSubsistemasMagia";

import { GridCatalogoGrupo } from "@/domains/garlia/_shared/GridCatalogoGrupo";
import { useCompuestosConElementos } from "@/domains/garlia/elementos/useCompuestosConElementos";
import { useElementos } from "@/domains/garlia/elementos/useElementos";
import { useFormaciones } from "@/domains/garlia/elementos/useFormaciones";
import { useReacciones } from "@/domains/garlia/elementos/useReacciones";
import { CompuestoPanelFlotante } from "@/domains/garlia/elementos/CompuestosPage";
import { CatalogoVetasFisica } from "./CatalogoVetasFisica";

/** Adapta un SubsistemaMagia al shape FilaCatalogo — vive acá (no en
 *  types.ts de física) para no acoplar ese módulo al dominio "runas". */
function subsistemaAFilaCatalogo(s: SubsistemaMagia): FilaCatalogo {
  return { nombre: s.nombre || "Sin nombre", detalle: s.descripcion || "Sin descripción" };
}

interface Props {
  particulaBase: ParticulaBase[];
  loadingParticulaBase?: boolean;

  particulas: Particula[];
  loadingParticulas?: boolean;

  iums: Ium[];
  loadingIums?: boolean;

  oris: Oris[];
  loadingOris?: boolean;
  creatingOris?: boolean;
  onCreateOris?: () => void;
  onActualizarOris: (id: string, cambios: Partial<Oris>) => void;
  onEliminarOris?: (id: string) => void;
  seleccionarOrisId?: string | null;
  /**
   * Notifica cada vez que cambia el Oris abierto en el panel (o se
   * cierra, con null) — usado por RunasPage para persistir el último
   * Oris visto en useMagiaSeccionStore y reabrirlo tras un refresh.
   * Solo cubre el caso "oris" (no concepto/subsistema/todas-bases), que
   * es el único con deep-link de entrada hoy (seleccionarOrisId).
   */
  onOrisSeleccionadoChange?: (id: string | null) => void;

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

/**
 * Qué está activo en el editor de la columna derecha. "todas-bases" es la
 * pantalla por defecto: columna izquierda con los catálogos (Partícula
 * Base, Partículas, Iums, Oris, Subsistemas) y columna derecha con
 * Conceptos — sin sistema de grupos/tabs, todo vive en una sola vista.
 */
type Seleccion =
  | { tipo: "oris"; id: string }
  | { tipo: "concepto"; id: string }
  | { tipo: "subsistema"; id: string }
  | { tipo: "todas-bases" }
  | null;

// ─── Descarga: todo el contenido de Física en un solo JSON ────────────────
function descargarDatosFisica(
  particulaBase: ParticulaBase[],
  particulas: Particula[],
  iums: Ium[],
  oris: Oris[],
  conceptos: FisicaConcepto[],
) {
  const payload = {
    exportado_en: new Date().toISOString(),
    particula_base: particulaBase,
    particulas,
    iums,
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
      iums_composicion: o.iums_composicion ?? {},
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


type ClaveCatalogo = "particula-base" | "particulas" | "iums" | "oris" | "subsistemas";

function catalogosBases(
  particulaBase: ParticulaBase[],
  particulas: Particula[],
  iums: Ium[],
  oris: Oris[],
  subsistemas: SubsistemaMagia[],
): { key: ClaveCatalogo; titulo: string; filas: FilaCatalogo[] }[] {
  return [
    {
      key: "particula-base",
      titulo: "Partícula Base",
      filas: particulaBase.map(particulaBaseAFilaCatalogo),
    },
    {
      key: "particulas",
      titulo: "Partículas",
      filas: particulas.map(particulaAFilaCatalogo),
    },
    { key: "iums", titulo: "Iums", filas: iums.map(iumAFilaIum) },
    { key: "oris", titulo: "Oris", filas: oris.map(orisAFilaCatalogo) },
    { key: "subsistemas", titulo: "Subsistemas", filas: subsistemas.map(subsistemaAFilaCatalogo) },
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
  particulaBase,
  particulas,
  iums,
  oris,
  subsistemas,
  onActualizarOris,
  onEliminarOris,
  onActualizarSubsistema,
  onEliminarSubsistema,
  onSelectCriatura,
  onCrearSubsistema,
  creandoSubsistema,
}: {
  particulaBase: ParticulaBase[];
  particulas: Particula[];
  iums: Ium[];
  oris: Oris[];
  subsistemas: SubsistemaMagia[];
  onActualizarOris: (id: string, cambios: Partial<Oris>) => void;
  onEliminarOris?: (id: string) => void;
  onActualizarSubsistema: (id: string, updates: Partial<SubsistemaMagia>) => void;
  onEliminarSubsistema: (id: string) => void;
  onSelectCriatura?: (id: string) => void;
  onCrearSubsistema: (nombre: string) => Promise<SubsistemaMagia | null>;
  creandoSubsistema?: boolean;
}) {
  const catalogos = catalogosBases(particulaBase, particulas, iums, oris, subsistemas);

  // ── Formaciones y Habilidades: catálogos propios, debajo de Subsistemas ──
  // Formaciones = tabla real "formaciones" (mismo catálogo que Minerales e
  // Items). Ya no tiene columna `componentes` — la fórmula vive vía
  // Vetas/Granos. Habilidades = tabla real "reacciones" (mismo catálogo que
  // usan Procesos de Flora/Minerales y Habilidades de Items — el nombre
  // "procesos_reacciones" nunca existió como tabla). Self-contained, mismo
  // espíritu que el resto de Física: trae sus propios datos acá en vez de
  // subirlos como props hasta RunasPage.
  const { items: catalogoFormaciones, setItems: setCatalogoFormaciones } = useFormaciones();
  const { items: reaccionesCatalogo, setItems: setReaccionesCatalogo } = useReacciones();
  const { items: compuestosCatalogo, setItems: setCompuestosCatalogo } = useCompuestosConElementos();
  const { items: elementosCatalogo } = useElementos();

  // Click en un Compuesto (desde Granos/Vetas, Formaciones o Habilidades)
  // abre acá su editor completo — mismo patrón que BiologiaPage/FloraEditor.
  const [compuestoAbiertoId, setCompuestoAbiertoId] = useState<string | null>(null);
  // Navegación controlada desde el breadcrumb "Veta → Formación" / "Grano →
  // Formación" de CatalogoVetasFisica — al elegir una Formación, este id le
  // llega a GridCatalogoGrupo (abrirIdExterno) para abrir su editor
  // flotante, mismo patrón que organoAAbrirId en BiologiaPage.
  const [formacionAAbrirId, setFormacionAAbrirId] = useState<string | null>(null);

  async function actualizarFormacion(id: string, cambios: Partial<Formacion>) {
    setCatalogoFormaciones((prev) => prev.map((g) => (g.id === id ? { ...g, ...cambios } : g)));
    const { error } = await supabase.from("formaciones").update(cambios).eq("id", id);
    if (error) console.error("[FisicaPage] error guardando formación:", error);
  }

  async function actualizarHabilidad(id: string, cambios: Partial<Reaccion>) {
    setReaccionesCatalogo((prev) => prev.map((r) => (r.id === id ? { ...r, ...cambios } : r)));
    const { error } = await supabase.from("reacciones").update(cambios).eq("id", id);
    if (error) console.error("[FisicaPage] error guardando habilidad:", error);
  }

  const [nombreNuevoSubsistema, setNombreNuevoSubsistema] = useState("");
  const [creandoAbierto, setCreandoAbierto] = useState(false);
  // Cuando se crea un subsistema nuevo, abrimos su popover automáticamente
  // anclado a la fila donde estaba el input de creación (no hay tarjeta
  // propia todavía en ese frame) — se guarda el id para que BasesItemCard
  // lo detecte y se auto-abra apenas aparece en la lista.
  const [autoAbrirSubsistemaId, setAutoAbrirSubsistemaId] = useState<string | null>(null);

  const handleCrearSubsistema = async () => {
    const nombre = nombreNuevoSubsistema.trim();
    if (!nombre) return;
    const nuevo = await onCrearSubsistema(nombre);
    setNombreNuevoSubsistema("");
    setCreandoAbierto(false);
    if (nuevo) setAutoAbrirSubsistemaId(nuevo.id);
  };

  return (
    <div className="shrink-0 flex flex-col">
      <div className="p-2.5 flex flex-col gap-4">
        {catalogos.map(({ key, titulo, filas }, idx) => (
          <div key={key} className="flex flex-col gap-2">
            <div
              className={`flex items-center justify-between gap-1.5 text-primary/50 pb-1.5 ${
                idx > 0 ? "pt-2 border-t border-primary/10" : ""
              }`}
            >
              <BasesRowTitle titulo={titulo} cantidad={filas.length} mostrarInfo={key === "particulas"} />
              {key === "subsistemas" && (
                <button
                  type="button"
                  onClick={() => setCreandoAbierto((o) => !o)}
                  title="Añadir subsistema"
                  className="shrink-0 flex items-center justify-center w-5 h-5 rounded-md text-primary/40 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
                >
                  <Plus size={11} />
                </button>
              )}
            </div>

            {key === "subsistemas" && creandoAbierto && (
              <div className="flex items-center gap-1.5 -mt-1 mb-1">
                <input
                  autoFocus
                  className="flex-1 min-w-0 bg-primary/[0.02] border border-primary/10 rounded-lg px-2.5 py-1.5 text-xs text-primary/80 outline-none placeholder:text-primary/30 focus:border-primary/25"
                  placeholder="Nombre del subsistema (ej. Luminia)…"
                  value={nombreNuevoSubsistema}
                  onChange={(e) => setNombreNuevoSubsistema(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCrearSubsistema();
                    if (e.key === "Escape") setCreandoAbierto(false);
                  }}
                />
                <button
                  type="button"
                  disabled={!nombreNuevoSubsistema.trim() || creandoSubsistema}
                  onClick={() => void handleCrearSubsistema()}
                  className="shrink-0 text-micro font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-primary text-bg-main hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  Crear
                </button>
              </div>
            )}

            {filas.length === 0 ? (
              <div className="py-4 text-micro text-primary/25 text-center border border-dashed border-primary/10 rounded-md">
                Sin {titulo.toLowerCase()} todavía
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 items-start">
                {filas.map((f, i) => {
                  const original = key === "oris" ? oris[i] : key === "subsistemas" ? subsistemas[i] : null;
                  return (
                    <BasesItemCard
                      key={f.nombre + i}
                      fila={f}
                      bloque={key}
                      original={key === "oris" ? (original as Oris) : undefined}
                      originalSubsistema={key === "subsistemas" ? (original as SubsistemaMagia) : undefined}
                      onActualizarOris={onActualizarOris}
                      onEliminarOris={onEliminarOris}
                      onActualizarSubsistema={onActualizarSubsistema}
                      onEliminarSubsistema={onEliminarSubsistema}
                      onSelectCriatura={onSelectCriatura}
                      autoAbrir={
                        key === "subsistemas" && original
                          ? (original as SubsistemaMagia).id === autoAbrirSubsistemaId
                          : false
                      }
                      onAutoAbierto={() => setAutoAbrirSubsistemaId(null)}
                      oris={key === "subsistemas" ? oris : undefined}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {/* Granos y Vetas — catálogo global de composición, mismo patrón que
            CatalogoTejidosBiologia en Biología: dos grids navegables con
            editor propio, arriba de Formaciones (que se arman a partir de
            Vetas vía formacion_vetas, ver useFormacionVetas.ts). */}
        <div className="flex flex-col gap-2 pt-2 border-t border-primary/10">
          <CatalogoVetasFisica
            compuestos={compuestosCatalogo}
            onAbrirCompuesto={(id) => setCompuestoAbiertoId(id)}
            onAbrirFormacion={(id) => setFormacionAAbrirId(id)}
          />
        </div>

        {/* Formaciones y Habilidades — catálogos globales, mismo patrón que
            los bloques de arriba pero usando el editor flotante completo
            (GrupoCompuestoPanelFlotante / ReaccionPanelFlotante) en vez del
            popover liviano de BasesItemCard, ya que acá el contenido
            (fórmula de compuestos, consume/produce) es más rico. */}
        <div className="flex flex-col gap-2 pt-2 border-t border-primary/10">
          <GridCatalogoGrupo
            modo="grupo"
            titulo="Formaciones"
            icono="formacion"
            items={catalogoFormaciones}
            compuestos={compuestosCatalogo}
            onActualizar={actualizarFormacion}
            onAbrirCompuesto={(id) => setCompuestoAbiertoId(id)}
            abrirIdExterno={formacionAAbrirId}
            onAbrirIdExternoConsumido={() => setFormacionAAbrirId(null)}
          />
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-primary/10">
          <GridCatalogoGrupo
            modo="reaccion"
            titulo="Habilidades"
            items={reaccionesCatalogo}
            compuestos={compuestosCatalogo}
            elementos={elementosCatalogo}
            onActualizar={actualizarHabilidad}
            onAbrirItem={(item) => {
              if (item.tipo === "compuesto") setCompuestoAbiertoId(item.id);
            }}
          />
        </div>
      </div>

      {compuestoAbiertoId &&
        (() => {
          const compuesto = compuestosCatalogo.find((c) => c.id === compuestoAbiertoId);
          if (!compuesto) return null;
          return (
            <CompuestoPanelFlotante
              compuesto={compuesto}
              elementos={elementosCatalogo}
              todosLosCompuestos={compuestosCatalogo}
              onCerrar={() => setCompuestoAbiertoId(null)}
              onActualizar={(id, cambios) =>
                setCompuestosCatalogo((prev) =>
                  prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)),
                )
              }
            />
          );
        })()}
    </div>
  );
}

/**
 * Tarjeta compacta de una fila de catálogo base (partícula, IUM, Oris,
 * Subsistema, etc.): muestra solo el nombre. Por defecto, al hacer click
 * abre un popover flotante anclado a la tarjeta con el detalle completo —
 * y, para Partícula Base/Partículas/Iums, su gráfico A/T/S arriba del
 * detalle (círculo de 3 tercios para Base/Partículas vía ParticulaVisual;
 * para Iums, sus Partículas componentes orbitando un centro vía
 * IumVisual — mismo patrón que AtomoVisual en Elementos). Si se pasa
 * `onClick`, ese comportamiento se reemplaza y el click abre el editor
 * completo en la columna derecha (usado por Oris y Subsistemas, cuyo
 * gráfico —si aplica— vive dentro de ese editor, no acá).
 */
function BasesItemCard({
  fila,
  bloque,
  original,
  originalSubsistema,
  onActualizarOris,
  onEliminarOris,
  onActualizarSubsistema,
  onEliminarSubsistema,
  onSelectCriatura,
  autoAbrir,
  onAutoAbierto,
  oris,
}: {
  fila: FilaCatalogo;
  bloque: ClaveCatalogo;
  /** Fila cruda de Supabase — solo presente para "oris", donde hace falta
   *  el objeto completo (no el FilaCatalogo resumido) para abrir OrisEditor
   *  dentro del popover flotante. */
  original?: Oris;
  /** Ídem para "subsistemas": objeto completo para abrir PanelEditorSubsistema
   *  dentro de su propio popover flotante. */
  originalSubsistema?: SubsistemaMagia;
  onActualizarOris?: (id: string, cambios: Partial<Oris>) => void;
  onEliminarOris?: (id: string) => void;
  onActualizarSubsistema?: (id: string, updates: Partial<SubsistemaMagia>) => void;
  onEliminarSubsistema?: (id: string) => void;
  onSelectCriatura?: (id: string) => void;
  /** true en el primer render de la tarjeta de un subsistema recién creado
   *  desde el buscador de "Añadir subsistema" — no hay click del usuario
   *  todavía, así que la tarjeta se auto-abre usando su propio botón como
   *  ancla apenas se monta. */
  autoAbrir?: boolean;
  onAutoAbierto?: () => void;
  /** Catálogo de Oris — solo se usa cuando bloque === "subsistemas", para
   *  que PanelEditorSubsistema pueda resolver "canaliza" a un Oris real. */
  oris?: Oris[];
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const conVisual = bloque === "particula-base" || bloque === "particulas" || bloque === "iums";
  const esOris = bloque === "oris" && !!original;
  const esSubsistema = bloque === "subsistemas" && !!originalSubsistema;

  useEffect(() => {
    if (autoAbrir && botonRef.current) {
      setAnchor(botonRef.current);
      onAutoAbierto?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAbrir]);

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className={`w-full flex items-center px-2.5 py-2 rounded-lg border text-left transition-all cursor-pointer ${
          anchor
            ? "border-primary/30 bg-primary/5"
            : "border-primary/10 bg-primary/[0.02] hover:border-primary/25 hover:bg-primary/5"
        }`}
      >
        <span className="text-micro font-black text-primary truncate">{fila.nombre}</span>
      </button>
      {esOris ? (
        <PopoverFlotante anchor={anchor} onClose={() => setAnchor(null)} width={560} maxHeight={520}>
          <OrisEditor
            oris={original!}
            embedded
            onBack={() => setAnchor(null)}
            onActualizar={onActualizarOris ?? (() => {})}
            onEliminar={
              onEliminarOris
                ? (id) => {
                    onEliminarOris(id);
                    setAnchor(null);
                  }
                : undefined
            }
          />
        </PopoverFlotante>
      ) : esSubsistema ? (
        <PopoverFlotante anchor={anchor} onClose={() => setAnchor(null)} width={420} maxHeight={560}>
          <PanelEditorSubsistema
            subsistema={originalSubsistema!}
            onVolver={() => setAnchor(null)}
            onSave={(updates) => onActualizarSubsistema?.(originalSubsistema!.id, updates)}
            onDelete={() => {
              onEliminarSubsistema?.(originalSubsistema!.id);
              setAnchor(null);
            }}
            onSelectCriatura={onSelectCriatura}
            oris={oris}
          />
        </PopoverFlotante>
      ) : (
        <PopoverFlotante
          anchor={anchor}
          onClose={() => setAnchor(null)}
          width={conVisual ? 420 : 280}
          maxHeight={340}
        >
          {conVisual ? (
            <div className="flex flex-row gap-3">
              <div className="shrink-0 flex items-center justify-center w-[140px]">
                {bloque === "iums" ? (
                  <IumVisual particulas={particulasDeIum(fila as FilaIum)} size={140} />
                ) : bloque === "particula-base" ? (
                  <ParticulaVisual formula={(fila as FilaParticulaBase).letra} size={88} />
                ) : (
                  // "particulas": particulaAFilaCatalogo pone la fórmula (ej. "SAT") en detalle.
                  <ParticulaVisual formula={fila.detalle} size={88} />
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <p className="text-xs font-black uppercase tracking-wide text-primary">{fila.nombre}</p>
                <p className="text-xs text-primary/70 leading-relaxed">{fila.detalle}</p>
                {fila.extra && <p className="text-xs text-primary/40 leading-relaxed">{fila.extra}</p>}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-black uppercase tracking-wide text-primary">{fila.nombre}</p>
              <p className="text-xs text-primary/70 leading-relaxed">{fila.detalle}</p>
              {fila.extra && <p className="text-xs text-primary/40 leading-relaxed">{fila.extra}</p>}
            </div>
          )}
        </PopoverFlotante>
      )}
    </>
  );
}

/**
 * Vista de todos los Conceptos en la columna derecha, agrupados por
 * bloque. Mismo patrón que TodasLasBasesView: cada
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
    <div className="shrink-0 flex flex-col">
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

      <div className="p-2.5 flex flex-col gap-4">
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

              <div className="grid grid-cols-1 gap-y-6 items-start">
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

      <div
        className={
          embedded
            ? "max-h-[40vh] overflow-y-auto"
            : "flex-1 min-h-0 overflow-y-auto p-2.5"
        }
      >
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

// ─── Página principal ───────────────────────────────────────────────────────

export function FisicaPage({
  particulaBase,
  loadingParticulaBase,
  particulas,
  loadingParticulas,
  iums,
  loadingIums,
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
  onOrisSeleccionadoChange,
}: Props) {
  const [seleccion, setSeleccionRaw] = useState<Seleccion>(
    seleccionarOrisId ? { tipo: "oris", id: seleccionarOrisId } : null,
  );
  // Notifica hacia afuera (RunasPage → useMagiaSeccionStore) solo cuando
  // el Oris seleccionado cambia — no cuando se selecciona un concepto,
  // subsistema o "todas-bases", que no tienen deep-link propio hoy.
  const setSeleccion = (valor: Seleccion | ((actual: Seleccion) => Seleccion)) => {
    setSeleccionRaw((actual) => {
      const nuevo = typeof valor === "function" ? valor(actual) : valor;
      if (onOrisSeleccionadoChange) {
        if (nuevo?.tipo === "oris") onOrisSeleccionadoChange(nuevo.id);
        else if (actual?.tipo === "oris") onOrisSeleccionadoChange(null);
      }
      return nuevo;
    });
  };
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

  // Ancla "fantasma" para el popover de Oris cuando se abre por deep-link
  // (seleccionarOrisId) en vez de por click en una tarjeta: no hay un
  // elemento real que originó la apertura, así que se usa un div oculto
  // fijo en el centro de la pantalla + modo backdrop (fondo oscurecido)
  // para que igual se vea como panel flotante y cierre al clickear afuera.
  // Se guarda en estado (no solo ref) para que el primer render, donde el
  // ref todavía es null, se corrija apenas el div fantasma se monta.
  const [anchorFantasma, setAnchorFantasma] = useState<HTMLDivElement | null>(null);

  const conceptoActivo = useMemo(
    () =>
      seleccion?.tipo === "concepto"
        ? conceptosLocal.find((c) => c.id === seleccion.id) ?? null
        : null,
    [conceptosLocal, seleccion],
  );

  const bloquesConceptos = useMemo(() => agruparPorBloque(conceptosLocal), [conceptosLocal]);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Ancla fantasma + popover flotante de Oris cuando se abre por
          deep-link (seleccionarOrisId), fuera del flujo de columnas —
          las tarjetas de la lista abren su propio popover anclado a sí
          mismas (ver BasesItemCard), este es solo el caso sin tarjeta. */}
      <div ref={setAnchorFantasma} className="fixed top-1/2 left-1/2 w-px h-px pointer-events-none" />
      {orisActivo && (
        <PopoverFlotante
          anchor={anchorFantasma}
          onClose={() => setSeleccion({ tipo: "todas-bases" })}
          width={560}
          maxHeight={520}
          centerVertically
          centerHorizontally
          backdrop
        >
          <OrisEditor
            oris={orisActivo}
            embedded
            onBack={() => setSeleccion({ tipo: "todas-bases" })}
            onActualizar={onActualizarOris}
            onEliminar={
              onEliminarOris
                ? (id) => {
                    onEliminarOris(id);
                    setSeleccion({ tipo: "todas-bases" });
                  }
                : undefined
            }
          />
        </PopoverFlotante>
      )}

      {/* Barra superior: solo acciones de import/export — sin tabs ni
          grupos, todo vive en una única vista de 2 columnas. */}
      <div className="shrink-0 flex flex-col gap-1 px-3 pt-2 pb-1.5 border-b border-primary/10">
        <div className="flex items-center justify-end gap-2">
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
              onClick={() => descargarDatosFisica(particulaBase, particulas, iums, oris, conceptosLocal)}
              title="Descargar todos los datos de Física (catálogos + Oris + conceptos) como JSON"
              className="flex items-center justify-center w-5 h-5 rounded-md text-primary/40 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
            >
              <Download size={10} />
            </button>
          </div>
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
        {conceptoActivo ? (
          <ConceptoEditor
            concepto={conceptoActivo}
            onBack={() => setSeleccion({ tipo: "todas-bases" })}
            onActualizar={(id, cambios) => {
              setConceptosLocal((prev) =>
                prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)),
              );
              onActualizarConcepto(id, cambios);
            }}
            onEliminar={(id) => {
              handleEliminarConcepto(id);
              setSeleccion({ tipo: "todas-bases" });
            }}
          />
        ) : (
          <div className="flex-1 min-h-0 flex flex-row">
            <div className="w-1/2 min-w-0 min-h-0 overflow-y-auto border-r border-primary/10">
              <TodasLasBasesView
                particulaBase={particulaBase}
                particulas={particulas}
                iums={iums}
                oris={oris}
                subsistemas={subsistemas}
                onActualizarOris={onActualizarOris}
                onEliminarOris={onEliminarOris}
                onActualizarSubsistema={onActualizarSubsistema}
                onEliminarSubsistema={onEliminarSubsistema}
                onSelectCriatura={onSelectCriatura}
                onCrearSubsistema={onCrearSubsistema}
                creandoSubsistema={creandoSubsistema}
              />
            </div>
            <div className="w-1/2 min-w-0 min-h-0 overflow-y-auto">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
