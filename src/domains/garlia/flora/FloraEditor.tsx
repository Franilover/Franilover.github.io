"use client";

/**
 * FloraEditor mejorado (v2 — interfaz de Órganos y Procesos)
 * ───────────────────────────────────────────────────────────────────────────
 * Tres secciones principales:
 * 1. Composición general (campo legado, mantener compatibilidad)
 * 2. Órganos individuales (hoja, pétalo, raíz, fruto, tallo…) — ahora con
 *    selector real de tipo (crear y cambiar) y editor visual de fórmula
 *    química (chips + stepper sobre la Tabla Química real, en vez de un
 *    textarea con JSON.stringify crudo).
 * 3. Procesos del ciclo de vida (fotosíntesis, floración…) — selector real
 *    de tipo, editor visual de consume/produce (elemento o compuesto real
 *    + cantidad), y reorden por drag-and-drop persistido en `orden`.
 */

import {
  Beaker,
  ChevronDown,
  Droplet,
  Flower2,
  GripVertical,
  Leaf,
  Plus,
  Sprout,
  TreeDeciduous,
  Trash2,
  Wind,
} from "lucide-react";
import React, { useEffect, useState } from "react";

import { RichEditor } from "@/editor/lexical";
import { useConfirm } from "@/ui/ConfirmModal";
import { type SaveStatus } from "@/ui/saveStatus";

import { useCompuestos } from "@/domains/garlia/elementos/useCompuestos";
import { useElementos } from "@/domains/garlia/elementos/useElementos";
import { CompuestoPanelFlotante } from "@/domains/garlia/elementos/CompuestosPage";
import { type Compuesto, type Elemento } from "@/domains/garlia/elementos/types";
import { SelectorImagen } from "@/domains/garlia/_shared/UIComponents";
import { EditorHeaderBar } from "@/domains/garlia/_shared/EditorHeaderBar";
import {
  SelectorComposicionMultiple,
  type ComposicionEntrada,
} from "@/domains/garlia/_shared/SelectorComposicionMultiple";
import {
  usePublishHeaderControls,
  type OnHeaderControlsChange,
} from "@/domains/garlia/_shared/useEditorHeaderControls";

import { useFlora } from "./useFlora";
import { usePlantaOrganosProcesos } from "./usePlantaOrganosProcesos";
import { type Flora, type PlantaOrgano, type PlantaProceso } from "./types";
import { SelectorEcosistemasDeEntidad } from "@/domains/garlia/biologia/SelectorEcosistemasDeEntidad";
import { EcosistemaPopoverContent } from "@/domains/garlia/biologia/EcosistemaPopoverContent";
import { PopoverFlotante } from "@/domains/garlia/_shared/PopoverFlotante";

import { SelectorTipo, type OpcionTipo } from "./SelectorTipo";
import { SelectorFormulaOrgano, type ComponenteOrgano } from "./SelectorFormulaOrgano";
import { SelectorConsumeProduce, type ItemProceso } from "./SelectorConsumeProduce";

// ─── Catálogos de tipo fijos, con icono ────────────────────────────────────

const TIPOS_ORGANO: OpcionTipo<PlantaOrgano["tipo_organo"]>[] = [
  { value: "hoja", label: "Hoja", icon: Leaf },
  { value: "petalo", label: "Pétalo", icon: Flower2 },
  { value: "raiz", label: "Raíz", icon: Sprout },
  { value: "fruto", label: "Fruto", icon: Droplet },
  { value: "tallo", label: "Tallo", icon: TreeDeciduous },
  { value: "semilla", label: "Semilla", icon: Sprout },
  { value: "corteza", label: "Corteza", icon: TreeDeciduous },
  { value: "otro", label: "Otro", icon: Leaf },
];

const TIPOS_PROCESO: OpcionTipo<PlantaProceso["tipo_proceso"]>[] = [
  { value: "germinacion", label: "Germinación", icon: Sprout },
  { value: "fotosintesis", label: "Fotosíntesis", icon: Wind },
  { value: "floracion", label: "Floración", icon: Flower2 },
  { value: "fructificacion", label: "Fructificación", icon: Droplet },
  { value: "marchitamiento", label: "Marchitamiento", icon: Leaf },
  { value: "otro", label: "Otro", icon: Beaker },
];

export function FloraEditorMejorado({
  flora: floraProp,
  onDeleted,
  onHeaderControlsChange,
}: {
  flora: Flora;
  onDeleted?: (id: string) => void;
  onHeaderControlsChange?: OnHeaderControlsChange;
}) {
  const { items: elementos } = useElementos();
  const { items: compuestos, setItems: setCompuestos, loading: loadingCompuestos } = useCompuestos();
  const { actualizar, eliminar } = useFlora();
  const { confirm, ConfirmModal } = useConfirm();

  const [form, setForm] = useState<Flora>(floraProp);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [editandoCompuestoId, setEditandoCompuestoId] = useState<string | null>(null);
  const [ecosistemaAbierto, setEcosistemaAbierto] = useState<{
    id: string;
    anchor: HTMLElement;
  } | null>(null);

  // Órganos y procesos
  const {
    organos,
    procesos,
    loading: loadingOrganosProcesos,
    crearOrgano,
    actualizarOrgano,
    eliminarOrgano,
    crearProceso,
    actualizarProceso,
    eliminarProceso,
    reordenarProcesos,
  } = usePlantaOrganosProcesos(floraProp.id);

  const [tabActiva, setTabActiva] = useState<"composicion" | "organos" | "procesos">(
    "composicion",
  );
  const [expandidosOrganos, setExpandidosOrganos] = useState<Set<string>>(new Set());
  const [expandidosProcesos, setExpandidosProcesos] = useState<Set<string>>(new Set());

  useEffect(() => {
    setForm(floraProp);
    setStatus("idle");
  }, [floraProp.id]);

  async function guardar(updates: Partial<Flora>) {
    setStatus("saving");
    try {
      await actualizar(form.id, updates);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  }

  function cambiarComposicion(componentes: ComposicionEntrada[]) {
    setForm((f) => ({ ...f, componentes }));
    void guardar({ componentes });
  }

  function onCompuestoCreado(nuevo: Compuesto) {
    setCompuestos((prev) => [...prev, nuevo]);
  }

  async function eliminarFlora() {
    const ok = await confirm({
      message: `¿Eliminar "${form.nombre}"?`,
      danger: true,
    });
    if (!ok) return;
    await eliminar(form.id);
    onDeleted?.(form.id);
  }

  const headerControls = {
    imagenUrl: form.imagen_url,
    IconoFallback: Leaf,
    nombre: form.nombre ?? "",
    placeholderNombre: "Nombre de la planta",
    onChangeNombre: (nombre: string) => setForm((f) => ({ ...f, nombre })),
    onBlurNombre: () => guardar({ nombre: form.nombre }),
    status,
    onGuardar: () => guardar({ nombre: form.nombre, descripcion: form.descripcion }),
    onEliminar: eliminarFlora,
  };
  usePublishHeaderControls(headerControls, onHeaderControlsChange);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <ConfirmModal />

      {!onHeaderControlsChange && <EditorHeaderBar controls={headerControls} />}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4">
          {/* Layout principal: imagen + tabs */}
          <div className="flex flex-col sm:flex-row gap-5 mb-6">
            {/* Columna izquierda: imagen */}
            <div className="w-full sm:w-72 sm:shrink-0">
              <SelectorImagen
                aspect="square"
                label="Imagen"
                value={form.imagen_url ?? ""}
                onChange={(url) => {
                  setForm((f) => ({ ...f, imagen_url: url }));
                  void guardar({ imagen_url: url });
                }}
              />
            </div>

            {/* Columna derecha: tabs */}
            <div className="flex-1 min-w-0">
              {/* ── TABS ──────────────────────────────────────────────────── */}
              <div className="flex gap-2 mb-4 border-b border-primary/10">
              <button
                onClick={() => setTabActiva("composicion")}
                className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  tabActiva === "composicion"
                    ? "text-primary border-b-2 border-primary"
                    : "text-primary/50 hover:text-primary/70"
                }`}
              >
                Composición
              </button>
              <button
                onClick={() => setTabActiva("organos")}
                className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  tabActiva === "organos"
                    ? "text-primary border-b-2 border-primary"
                    : "text-primary/50 hover:text-primary/70"
                }`}
              >
                Órganos ({organos.length})
              </button>
              <button
                onClick={() => setTabActiva("procesos")}
                className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  tabActiva === "procesos"
                    ? "text-primary border-b-2 border-primary"
                    : "text-primary/50 hover:text-primary/70"
                }`}
              >
                Procesos ({procesos.length})
              </button>
            </div>

            {/* ── TAB: Composición ──────────────────────────────────────── */}
            {tabActiva === "composicion" && (
              <div className="space-y-4">
                <div>
                  <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35 block mb-1.5">
                    Descripción
                  </label>
                  <RichEditor
                    minHeight="8rem"
                    placeholder="Qué es, dónde crece, usos, apariencia…"
                    value={form.descripcion ?? ""}
                    onChange={(v) => setForm((f) => ({ ...f, descripcion: v }))}
                  />
                </div>

                <div>
                  <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-2">
                    Composición (Compuestos)
                  </span>
                  <p className="text-micro text-primary/30 mb-3">
                    Compuestos de la Tabla Química que forman esta planta, por parte.
                  </p>

                  <SelectorComposicionMultiple
                    composicion={form.componentes ?? []}
                    onChange={cambiarComposicion}
                    compuestos={compuestos}
                    elementos={elementos}
                    loadingCompuestos={loadingCompuestos}
                    onCompuestoCreado={onCompuestoCreado}
                    onEditarCompuesto={setEditandoCompuestoId}
                  />
                </div>

                {/* Ecosistemas */}
                <div className="pt-4 border-t border-primary/10">
                  <SelectorEcosistemasDeEntidad
                    entidadId={form.id}
                    campo="flora_ids"
                    label="Ecosistemas donde crece"
                    onSelectEcosistema={(id, anchor) => setEcosistemaAbierto({ id, anchor })}
                  />
                </div>

                {/* Notas */}
                <div className="pt-4 border-t border-primary/10">
                  <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35 block mb-1.5">
                    Notas
                  </label>
                  <textarea
                    className="w-full min-h-[4.5rem] bg-primary/[0.02] border border-primary/10 rounded-lg px-2.5 py-1.5 text-xs text-primary/70 outline-none placeholder:text-primary/30 resize-y"
                    placeholder="Cualquier otra nota libre…"
                    value={form.notas ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                    onBlur={() => guardar({ notas: form.notas })}
                  />
                </div>
              </div>
            )}

            {/* ── TAB: Órganos ──────────────────────────────────────────── */}
            {tabActiva === "organos" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary/50">ÓRGANOS</span>
                  <SelectorTipo
                    variant="crear"
                    triggerLabel={
                      <span className="flex items-center gap-1.5">
                        <Plus size={14} /> Nuevo órgano
                      </span>
                    }
                    opciones={TIPOS_ORGANO}
                    onSelect={(tipo) => void crearOrgano(tipo)}
                  />
                </div>

                {loadingOrganosProcesos ? (
                  <p className="text-xs text-primary/40">Cargando órganos…</p>
                ) : organos.length === 0 ? (
                  <p className="text-xs text-primary/40 italic">Sin órganos. Crea uno para empezar.</p>
                ) : (
                  <div className="space-y-2">
                    {organos.map((organo) => (
                      <OrganoCard
                        key={organo.id}
                        organo={organo}
                        isExpanded={expandidosOrganos.has(organo.id)}
                        onToggle={() => {
                          setExpandidosOrganos((prev) => {
                            const next = new Set(prev);
                            if (next.has(organo.id)) next.delete(organo.id);
                            else next.add(organo.id);
                            return next;
                          });
                        }}
                        onUpdate={actualizarOrgano}
                        onDelete={() => eliminarOrgano(organo.id)}
                        compuestos={compuestos}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: Procesos ────────────────────────────────────────── */}
            {tabActiva === "procesos" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary/50">PROCESOS DEL CICLO</span>
                  <SelectorTipo
                    variant="crear"
                    triggerLabel={
                      <span className="flex items-center gap-1.5">
                        <Plus size={14} /> Nuevo proceso
                      </span>
                    }
                    opciones={TIPOS_PROCESO}
                    onSelect={(tipo) => void crearProceso(tipo)}
                  />
                </div>

                {loadingOrganosProcesos ? (
                  <p className="text-xs text-primary/40">Cargando procesos…</p>
                ) : procesos.length === 0 ? (
                  <p className="text-xs text-primary/40 italic">Sin procesos. Crea uno para empezar.</p>
                ) : (
                  <ListaProcesosReordenable
                    procesos={procesos}
                    expandidos={expandidosProcesos}
                    setExpandidos={setExpandidosProcesos}
                    onUpdate={actualizarProceso}
                    onDelete={eliminarProceso}
                    onReorder={reordenarProcesos}
                    compuestos={compuestos}
                    elementos={elementos}
                  />
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Popovers flotantes */}
      {editandoCompuestoId && (
        <CompuestoPanelFlotante
          compuesto={compuestos.find((c) => c.id === editandoCompuestoId)!}
          elementos={elementos}
          todosLosCompuestos={compuestos}
          onCerrar={() => setEditandoCompuestoId(null)}
          onActualizar={(id, cambios) =>
            setCompuestos((prev) => prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)))
          }
        />
      )}

      {ecosistemaAbierto && (
        <PopoverFlotante
          anchor={ecosistemaAbierto.anchor}
          onClose={() => setEcosistemaAbierto(null)}
          width={640}
          maxHeight={560}
          centerVertically
          centerHorizontally
        >
          <EcosistemaPopoverContent
            ecosistemaId={ecosistemaAbierto.id}
            onClose={() => setEcosistemaAbierto(null)}
          />
        </PopoverFlotante>
      )}
    </div>
  );
}

// ── Componente auxiliar: Tarjeta de órgano ─────────────────────────────────
interface OrganoCardProps {
  organo: PlantaOrgano;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, updates: Partial<PlantaOrgano>) => void;
  onDelete: () => void;
  compuestos: Compuesto[];
}

function OrganoCard({ organo, isExpanded, onToggle, onUpdate, onDelete, compuestos }: OrganoCardProps) {
  const opcionActual = TIPOS_ORGANO.find((o) => o.value === organo.tipo_organo);
  const Icon = opcionActual?.icon ?? Leaf;

  return (
    <div className="border border-primary/10 rounded-lg bg-primary/[0.02] overflow-hidden">
      <div className="w-full px-3 py-2 flex items-center justify-between hover:bg-primary/[0.05] transition">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <ChevronDown
            size={14}
            className={`shrink-0 transition ${isExpanded ? "rotate-180" : ""}`}
          />
          <Icon size={13} className="shrink-0 text-primary/40" />
        </button>

        <div className="flex items-center gap-2">
          <SelectorTipo
            variant="chip"
            valor={organo.tipo_organo}
            opciones={TIPOS_ORGANO}
            onSelect={(tipo) => onUpdate(organo.id, { tipo_organo: tipo })}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded hover:bg-red-500/10 text-red-500/50 hover:text-red-500 transition"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 py-2.5 border-t border-primary/10 space-y-3 text-xs">
          <div>
            <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1.5">
              Fórmula química
            </span>
            <SelectorFormulaOrgano
              compuestos={compuestos}
              componentes={(organo.componentes ?? []) as ComponenteOrgano[]}
              onChange={(componentes) => onUpdate(organo.id, { componentes })}
            />
          </div>

          <div>
            <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1">
              Notas
            </span>
            <textarea
              className="w-full bg-primary/[0.02] border border-primary/10 rounded px-2 py-1 text-primary/70 resize-none outline-none"
              placeholder="Notas del órgano…"
              value={organo.notas ?? ""}
              onChange={(e) => onUpdate(organo.id, { notas: e.target.value })}
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Lista de procesos reordenable (drag-and-drop nativo) ───────────────────
// Mismo mecanismo que el reorder de capítulos en EditorCapitulos.tsx:
// HTML5 DnD nativo, sin dependencias nuevas. `dragId` es el proceso que se
// está arrastrando; `overId` el que está debajo del cursor.
function ListaProcesosReordenable({
  procesos,
  expandidos,
  setExpandidos,
  onUpdate,
  onDelete,
  onReorder,
  compuestos,
  elementos,
}: {
  procesos: PlantaProceso[];
  expandidos: Set<string>;
  setExpandidos: React.Dispatch<React.SetStateAction<Set<string>>>;
  onUpdate: (id: string, updates: Partial<PlantaProceso>) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  compuestos: Compuesto[];
  elementos: Elemento[];
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const ordenados = [...procesos].sort((a, b) => a.orden - b.orden);

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const fromIdx = ordenados.findIndex((p) => p.id === dragId);
    const toIdx = ordenados.findIndex((p) => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const reordenados = [...ordenados];
    const [moved] = reordenados.splice(fromIdx, 1);
    reordenados.splice(toIdx, 0, moved);
    onReorder(reordenados.map((p) => p.id));
    setDragId(null);
    setOverId(null);
  }

  return (
    <div className="space-y-2">
      {ordenados.map((proceso) => {
        const arrastrando = dragId === proceso.id;
        const resaltarSoltar = overId === proceso.id && dragId !== proceso.id;
        return (
          <div
            key={proceso.id}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragId && dragId !== proceso.id) setOverId(proceso.id);
            }}
            onDragLeave={() => setOverId((cur) => (cur === proceso.id ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(proceso.id);
            }}
            className={`transition-all ${resaltarSoltar ? "translate-y-0.5" : ""}`}
            style={{
              outline: resaltarSoltar
                ? "2px solid color-mix(in srgb, var(--primary) 40%, transparent)"
                : undefined,
              outlineOffset: 2,
              borderRadius: 8,
              opacity: arrastrando ? 0.4 : 1,
            }}
          >
            <ProcesoCard
              proceso={proceso}
              isExpanded={expandidos.has(proceso.id)}
              onToggle={() => {
                setExpandidos((prev) => {
                  const next = new Set(prev);
                  if (next.has(proceso.id)) next.delete(proceso.id);
                  else next.add(proceso.id);
                  return next;
                });
              }}
              onUpdate={onUpdate}
              onDelete={() => onDelete(proceso.id)}
              compuestos={compuestos}
              elementos={elementos}
              dragHandleProps={{
                draggable: true,
                onDragEnd: () => {
                  setDragId(null);
                  setOverId(null);
                },
                onDragStart: (e: React.DragEvent) => {
                  setDragId(proceso.id);
                  e.dataTransfer.effectAllowed = "move";
                },
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Componente auxiliar: Tarjeta de proceso ────────────────────────────────
interface ProcesoCardProps {
  proceso: PlantaProceso;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, updates: Partial<PlantaProceso>) => void;
  onDelete: () => void;
  compuestos: Compuesto[];
  elementos: Elemento[];
  dragHandleProps: {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
  };
}

function ProcesoCard({
  proceso,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  compuestos,
  elementos,
  dragHandleProps,
}: ProcesoCardProps) {
  return (
    <div className="border border-primary/10 rounded-lg bg-primary/[0.02] overflow-hidden">
      <div className="w-full px-2 py-2 flex items-center justify-between hover:bg-primary/[0.05] transition">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {/* Handle de drag — visible siempre, mismo espíritu que
              EditorCapitulos (evita arrastrar accidentalmente desde
              cualquier punto de la tarjeta). */}
          <span
            {...dragHandleProps}
            title="Arrastrar para reordenar"
            className="shrink-0 p-1 rounded cursor-grab active:cursor-grabbing text-primary/25 hover:text-primary/50 transition"
          >
            <GripVertical size={13} />
          </span>

          <button onClick={onToggle} className="flex items-center gap-2 flex-1 min-w-0 text-left">
            <ChevronDown
              size={14}
              className={`shrink-0 transition ${isExpanded ? "rotate-180" : ""}`}
            />
            {proceso.condiciones && (
              <span className="text-xs text-primary/40 truncate">({proceso.condiciones})</span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <SelectorTipo
            variant="chip"
            valor={proceso.tipo_proceso}
            opciones={TIPOS_PROCESO}
            onSelect={(tipo) => onUpdate(proceso.id, { tipo_proceso: tipo })}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded hover:bg-red-500/10 text-red-500/50 hover:text-red-500 transition"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 py-2.5 border-t border-primary/10 space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectorConsumeProduce
              label="Consume"
              items={(proceso.consume ?? []) as ItemProceso[]}
              onChange={(consume) => onUpdate(proceso.id, { consume })}
              elementos={elementos}
              compuestos={compuestos}
            />
            <SelectorConsumeProduce
              label="Produce"
              items={(proceso.produce ?? []) as ItemProceso[]}
              onChange={(produce) => onUpdate(proceso.id, { produce })}
              elementos={elementos}
              compuestos={compuestos}
            />
          </div>

          <div>
            <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1">
              Condiciones
            </span>
            <input
              className="w-full bg-primary/[0.02] border border-primary/10 rounded px-2 py-1 text-primary/70 outline-none"
              placeholder='Ej: "luz solar directa", "solo en primavera"…'
              value={proceso.condiciones ?? ""}
              onChange={(e) => onUpdate(proceso.id, { condiciones: e.target.value })}
            />
          </div>

          <div>
            <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1">
              Descripción
            </span>
            <textarea
              className="w-full bg-primary/[0.02] border border-primary/10 rounded px-2 py-1 text-primary/70 resize-none outline-none"
              placeholder="Descripción del proceso…"
              value={proceso.descripcion ?? ""}
              onChange={(e) => onUpdate(proceso.id, { descripcion: e.target.value })}
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export { FloraEditorMejorado as FloraEditor };
