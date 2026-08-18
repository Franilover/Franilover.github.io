"use client";

/**
 * FloraEditor mejorado
 * ───────────────────────────────────────────────────────────────────────────
 * Ahora con tres secciones principales:
 * 1. Composición general (campo legado, mantener compatibilidad)
 * 2. Órganos individuales (hoja, pétalo, raíz, fruto, tallo)
 * 3. Procesos del ciclo de vida (fotosíntesis, floración, fructificación, etc)
 */

import { Leaf, Plus, Trash2, ChevronDown } from "lucide-react";
import React, { useEffect, useState } from "react";

import { RichEditor } from "@/editor/lexical";
import { useConfirm } from "@/ui/ConfirmModal";
import { type SaveStatus } from "@/ui/saveStatus";

import { useCompuestos } from "@/domains/garlia/elementos/useCompuestos";
import { useElementos } from "@/domains/garlia/elementos/useElementos";
import { CompuestoPanelFlotante } from "@/domains/garlia/elementos/CompuestosPage";
import { type Compuesto } from "@/domains/garlia/elementos/types";
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
  } = usePlantaOrganosProcesos(flora.id);

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

  function cambiarComposicion(composicion: ComposicionEntrada[]) {
    setForm((f) => ({ ...f, composicion }));
    void guardar({ composicion });
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
          {/* Layout principal: imagen + descripción */}
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

            {/* Columna derecha: descripción */}
            <div className="flex-1 min-w-0">
              <div className="space-y-1.5">
                <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35">
                  Descripción
                </label>
                <RichEditor
                  minHeight="8rem"
                  placeholder="Qué es, dónde crece, usos, apariencia…"
                  value={form.descripcion ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, descripcion: v }))}
                />
              </div>
            </div>
          </div>

          {/* ── TABS ──────────────────────────────────────────────────────── */}
          <div className="border-t border-primary/10 pt-4">
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
                  <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-2">
                    Composición (Compuestos)
                  </span>
                  <p className="text-micro text-primary/30 mb-3">
                    Compuestos de la Tabla Química que forman esta planta, por parte.
                  </p>

                  <SelectorComposicionMultiple
                    composicion={form.composicion ?? []}
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
                  <button
                    onClick={async () => {
                      const tiposDisponibles = [
                        "hoja",
                        "petalo",
                        "raiz",
                        "fruto",
                        "tallo",
                        "semilla",
                        "corteza",
                        "otro",
                      ] as const;
                      // En producción, usar un selector modal
                      const tipo = tiposDisponibles[0];
                      await crearOrgano(tipo);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-primary/10 hover:bg-primary/20 text-primary/70 hover:text-primary transition"
                  >
                    <Plus size={14} /> Nuevo órgano
                  </button>
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
                  <button
                    onClick={async () => {
                      const tipo = "fotosintesis" as const;
                      await crearProceso(tipo);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-primary/10 hover:bg-primary/20 text-primary/70 hover:text-primary transition"
                  >
                    <Plus size={14} /> Nuevo proceso
                  </button>
                </div>

                {loadingOrganosProcesos ? (
                  <p className="text-xs text-primary/40">Cargando procesos…</p>
                ) : procesos.length === 0 ? (
                  <p className="text-xs text-primary/40 italic">Sin procesos. Crea uno para empezar.</p>
                ) : (
                  <div className="space-y-2">
                    {procesos.map((proceso) => (
                      <ProcesoCard
                        key={proceso.id}
                        proceso={proceso}
                        isExpanded={expandidosProcesos.has(proceso.id)}
                        onToggle={() => {
                          setExpandidosProcesos((prev) => {
                            const next = new Set(prev);
                            if (next.has(proceso.id)) next.delete(proceso.id);
                            else next.add(proceso.id);
                            return next;
                          });
                        }}
                        onUpdate={actualizarProceso}
                        onDelete={() => eliminarProceso(proceso.id)}
                        compuestos={compuestos}
                        elementos={elementos}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
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
  onUpdate: (id: string, updates: any) => void;
  onDelete: () => void;
  compuestos: Compuesto[];
}

function OrganoCard({
  organo,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  compuestos,
}: OrganoCardProps) {
  return (
    <div className="border border-primary/10 rounded-lg bg-primary/[0.02] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-primary/[0.05] transition"
      >
        <span className="flex items-center gap-2">
          <ChevronDown
            size={14}
            className={`transition ${isExpanded ? "rotate-180" : ""}`}
          />
          <span className="text-xs font-semibold text-primary/70 capitalize">
            {organo.tipo_organo}
          </span>
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 rounded hover:bg-red-500/10 text-red-500/50 hover:text-red-500 transition"
        >
          <Trash2 size={14} />
        </button>
      </button>

      {isExpanded && (
        <div className="px-3 py-2 border-t border-primary/10 space-y-2 text-xs">
          <textarea
            className="w-full bg-primary/[0.02] border border-primary/10 rounded px-2 py-1 text-primary/70 resize-none"
            placeholder="Notas del órgano…"
            value={organo.notas ?? ""}
            onChange={(e) =>
              onUpdate(organo.id, { notas: e.target.value })
            }
            rows={2}
          />
          <div className="text-primary/50 italic">
            Fórmula: {organo.componentes ? JSON.stringify(organo.componentes) : "Sin definir"}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente auxiliar: Tarjeta de proceso ────────────────────────────────
interface ProcesoCardProps {
  proceso: PlantaProceso;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, updates: any) => void;
  onDelete: () => void;
  compuestos: Compuesto[];
  elementos: any[];
}

function ProcesoCard({
  proceso,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  compuestos,
}: ProcesoCardProps) {
  return (
    <div className="border border-primary/10 rounded-lg bg-primary/[0.02] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-primary/[0.05] transition"
      >
        <span className="flex items-center gap-2">
          <ChevronDown
            size={14}
            className={`transition ${isExpanded ? "rotate-180" : ""}`}
          />
          <span className="text-xs font-semibold text-primary/70 capitalize">
            {proceso.tipo_proceso}
          </span>
          {proceso.condiciones && (
            <span className="text-xs text-primary/40">({proceso.condiciones})</span>
          )}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 rounded hover:bg-red-500/10 text-red-500/50 hover:text-red-500 transition"
        >
          <Trash2 size={14} />
        </button>
      </button>

      {isExpanded && (
        <div className="px-3 py-2 border-t border-primary/10 space-y-2 text-xs">
          <textarea
            className="w-full bg-primary/[0.02] border border-primary/10 rounded px-2 py-1 text-primary/70 resize-none"
            placeholder="Descripción del proceso…"
            value={proceso.descripcion ?? ""}
            onChange={(e) =>
              onUpdate(proceso.id, { descripcion: e.target.value })
            }
            rows={2}
          />
          <div className="text-primary/50 italic">
            Consume: {proceso.consume ? JSON.stringify(proceso.consume) : "—"}
          </div>
          <div className="text-primary/50 italic">
            Produce: {proceso.produce ? JSON.stringify(proceso.produce) : "—"}
          </div>
        </div>
      )}
    </div>
  );
}
