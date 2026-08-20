"use client";

/**
 * MineralEditor.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Editor de una entidad Mineral: nombre, imagen, descripción rica y
 * ecosistemas — mismo molde visual que FloraEditor.tsx — más Formaciones y
 * Procesos:
 *
 * - Formaciones: partes del mineral con fórmula propia, nombre libre (ej:
 *   "Veta", "Inclusión de cuarzo"…). Reemplaza la antigua composición plana
 *   de un solo nivel (`Mineral.componentes`), que se migra automáticamente
 *   a una Formación la primera vez que se abre este editor (ver
 *   useMineralFormacionesProcesos).
 *
 * - Procesos: eventos geológicos de formación/transformación, nombre libre
 *   (ej: "Cristalización", "Oxidación"…) con consume/produce — mismo shape
 *   que los Procesos de Flora, pero sin orden/secuencia: los procesos
 *   geológicos de un mineral no tienen un orden narrativo único.
 *
 * Reutiliza SelectorFormulaOrgano y SelectorConsumeProduce de Flora tal cual
 * (son genéricos, sin nada específico de planta).
 */

import { Gem, Leaf, Plus, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { RichEditor } from "@/editor/lexical";
import { SeccionEntidad } from "@/ui/SeccionEntidad";
import { type SaveStatus } from "@/ui/saveStatus";

import { useCompuestos } from "@/domains/garlia/elementos/useCompuestos";
import { useElementos } from "@/domains/garlia/elementos/useElementos";
import { CompuestoPanelFlotante } from "@/domains/garlia/elementos/CompuestosPage";
import { type Compuesto, type Elemento } from "@/domains/garlia/elementos/types";
import { SelectorImagen } from "@/domains/garlia/_shared/UIComponents";
import { EditorHeaderBar } from "@/domains/garlia/_shared/EditorHeaderBar";
import { BalanceProcesoPanel } from "@/domains/garlia/_shared/BalanceProcesoPanel";
import { AfinidadEntreEntidadesPanel } from "@/domains/garlia/_shared/AfinidadEntreEntidadesPanel";
import {
  usePublishHeaderControls,
  type OnHeaderControlsChange,
} from "@/domains/garlia/_shared/useEditorHeaderControls";

import { useMinerales } from "./useMinerales";
import { useMineralFormacionesProcesos } from "./useMineralFormacionesProcesos";
import { type Mineral, type MineralFormacion, type MineralProceso } from "./types";
import { useEcosistemas } from "@/domains/garlia/biologia/useBiologia";
import { EcosistemaPopoverContent } from "@/domains/garlia/biologia/EcosistemaPopoverContent";
import { PopoverFlotante } from "@/domains/garlia/_shared/PopoverFlotante";

import { SelectorFormulaOrgano, type ComponenteOrgano } from "@/domains/garlia/flora/SelectorFormulaOrgano";
import { SelectorConsumeProduce, type ItemProceso } from "@/domains/garlia/flora/SelectorConsumeProduce";

export function MineralEditor({
  mineral: mineralProp,
  onDeleted,
  onHeaderControlsChange,
}: {
  mineral: Mineral;
  onDeleted?: (id: string) => void;
  onHeaderControlsChange?: OnHeaderControlsChange;
}) {
  const { items: elementos } = useElementos();
  const { items: compuestos, setItems: setCompuestos } = useCompuestos();
  const { actualizar, eliminar } = useMinerales();
  const { ecosistemas, loading: loadingEcosistemas, actualizar: actualizarEcosistema } =
    useEcosistemas();

  const [form, setForm] = useState<Mineral>(mineralProp);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [editandoCompuestoId, setEditandoCompuestoId] = useState<string | null>(null);
  // Popover flotante de ecosistema — mismo patrón que el chip de Ecosistema
  // en CriaturasJerarquica/GeografiaJerarquica (PopoverFlotante anclado al
  // elemento clickeado, sin navegar a pantalla completa).
  const [ecosistemaAbierto, setEcosistemaAbierto] = useState<{
    id: string;
    anchor: HTMLElement;
  } | null>(null);
  // Último elemento DOM clickeado dentro de la barra de Ecosistemas — usado
  // como anchor del PopoverFlotante, ya que SeccionEntidad.onEntityClick
  // solo entrega el id, no el evento/elemento. Mismo patrón que FloraEditor.
  const lastEntityClickTarget = useRef<HTMLElement | null>(null);
  const asideEcosistemasRef = useRef<HTMLElement | null>(null);

  // Ecosistemas donde aparece este mineral — vínculo inverso: vive en
  // Ecosistema.mineral_ids, no en Mineral. Mismo patrón que FloraEditor.
  const ecosistemaIds = useMemo(
    () => ecosistemas.filter((e) => (e.mineral_ids ?? []).includes(form.id)).map((e) => e.id),
    [ecosistemas, form.id],
  );
  const handleToggleEcosistema = (ecosistemaId: string, add: boolean) => {
    const eco = ecosistemas.find((e) => e.id === ecosistemaId);
    if (!eco) return;
    const actuales = eco.mineral_ids ?? [];
    void actualizarEcosistema(ecosistemaId, {
      mineral_ids: add ? [...actuales, form.id] : actuales.filter((id) => id !== form.id),
    });
  };

  // Formaciones y procesos
  const {
    formaciones,
    procesos,
    loading: loadingFormacionesProcesos,
    crearFormacion,
    actualizarFormacion,
    eliminarFormacion,
    crearProceso,
    actualizarProceso,
    eliminarProceso,
  } = useMineralFormacionesProcesos(mineralProp.id, form);

  const [tabActiva, setTabActiva] = useState<"info" | "formaciones" | "procesos">("info");

  useEffect(() => {
    setForm(mineralProp);
    setStatus("idle");
  }, [mineralProp.id]);

  async function guardar(updates: Partial<Mineral>) {
    setStatus("saving");
    try {
      await actualizar(form.id, updates);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  }

  // Confirmación inline en el header compartido — ver EditorHeaderBar.
  async function eliminarMineral() {
    await eliminar(form.id);
    onDeleted?.(form.id);
  }

  const headerControls = {
    imagenUrl: form.imagen_url,
    IconoFallback: Gem,
    nombre: form.nombre ?? "",
    placeholderNombre: "Nombre del mineral",
    onChangeNombre: (nombre: string) => setForm((f) => ({ ...f, nombre })),
    onBlurNombre: () => guardar({ nombre: form.nombre }),
    status,
    onGuardar: () => guardar({ nombre: form.nombre, descripcion: form.descripcion }),
    onEliminar: eliminarMineral,
  };
  usePublishHeaderControls(headerControls, onHeaderControlsChange);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {!onHeaderControlsChange && <EditorHeaderBar controls={headerControls} />}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4">
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
              <div className="flex items-center justify-between gap-2 mb-4 border-b border-primary/10">
                <div className="flex gap-2">
                  <button
                    onClick={() => setTabActiva("info")}
                    className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                      tabActiva === "info"
                        ? "text-primary border-b-2 border-primary"
                        : "text-primary/50 hover:text-primary/70"
                    }`}
                  >
                    Info
                  </button>
                  <button
                    onClick={() => setTabActiva("formaciones")}
                    className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                      tabActiva === "formaciones"
                        ? "text-primary border-b-2 border-primary"
                        : "text-primary/50 hover:text-primary/70"
                    }`}
                  >
                    Formaciones ({formaciones.length})
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
                {tabActiva !== "info" && (
                  <button
                    onClick={() => void (tabActiva === "formaciones" ? crearFormacion() : crearProceso())}
                    title={tabActiva === "formaciones" ? "Nueva formación" : "Nuevo proceso"}
                    className="shrink-0 mb-1 w-7 h-7 flex items-center justify-center rounded-md text-primary/50 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>

              {/* ── TAB: Info ─────────────────────────────────────────────── */}
              {tabActiva === "info" && (
                <div className="flex gap-4 items-stretch">
                  <div className="flex-1 min-w-0">
                    <RichEditor
                      minHeight="8rem"
                      placeholder="Qué es, dónde se encuentra, propiedades, apariencia…"
                      value={form.descripcion ?? ""}
                      onChange={(v) => setForm((f) => ({ ...f, descripcion: v }))}
                    />
                  </div>

                  {/* Ecosistemas — barra vertical lateral, mismo patrón que
                      SeccionEntidad en FloraEditor/EditorCriatura/PanelBioma.
                      onEntityClick de SeccionEntidad solo entrega el id, no el
                      elemento clickeado — se captura acá con onClickCapture
                      para usarlo como anchor del PopoverFlotante. */}
                  <aside
                    ref={asideEcosistemasRef}
                    className="shrink-0 w-44 flex flex-col border-l overflow-y-auto"
                    style={{
                      borderColor: "color-mix(in srgb, var(--primary) 7%, transparent)",
                    }}
                    onClickCapture={(e) => {
                      lastEntityClickTarget.current = e.target as HTMLElement;
                    }}
                  >
                    <SeccionEntidad
                      allEntities={ecosistemas.map((e) => ({ id: e.id, nombre: e.nombre }))}
                      emptyLabel="Sin ecosistemas"
                      fallbackIcon={<Leaf size={14} strokeWidth={1} />}
                      fill={false}
                      icon={<Leaf size={9} />}
                      label="Ecosistemas"
                      loading={loadingEcosistemas}
                      saving={false}
                      selectedIds={ecosistemaIds}
                      onEntityClick={(id) =>
                        setEcosistemaAbierto({
                          id,
                          anchor:
                            lastEntityClickTarget.current ?? asideEcosistemasRef.current ?? document.body,
                        })
                      }
                      onToggle={handleToggleEcosistema}
                    />
                  </aside>
                </div>
              )}

              {/* ── TAB: Formaciones ──────────────────────────────────────── */}
              {tabActiva === "formaciones" && (
                <div className="space-y-3">
                  {loadingFormacionesProcesos ? (
                    <p className="text-xs text-primary/40">Cargando formaciones…</p>
                  ) : formaciones.length === 0 ? (
                    <p className="text-xs text-primary/40 italic">
                      Sin formaciones. Crea una para empezar.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
                      {formaciones.map((formacion) => (
                        <div key={formacion.id} className="border-b border-primary/10">
                          <FormacionCard
                            formacion={formacion}
                            onUpdate={actualizarFormacion}
                            onDelete={() => eliminarFormacion(formacion.id)}
                            compuestos={compuestos}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <AfinidadEntreEntidadesPanel
                    entidadId={form.id}
                    nombreEntidad={form.nombre}
                    mezcla={formaciones.flatMap((f) => f.componentes ?? [])}
                    compuestos={compuestos}
                    elementos={elementos}
                  />
                </div>
              )}

              {/* ── TAB: Procesos ────────────────────────────────────────── */}
              {tabActiva === "procesos" && (
                <div className="space-y-3">
                  {loadingFormacionesProcesos ? (
                    <p className="text-xs text-primary/40">Cargando procesos…</p>
                  ) : procesos.length === 0 ? (
                    <p className="text-xs text-primary/40 italic">
                      Sin procesos. Crea uno para empezar.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
                      {procesos.map((proceso) => (
                        <div key={proceso.id} className="border-b border-primary/10">
                          <ProcesoMineralCard
                            proceso={proceso}
                            onUpdate={actualizarProceso}
                            onDelete={() => eliminarProceso(proceso.id)}
                            compuestos={compuestos}
                            elementos={elementos}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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

// ── Componente auxiliar: Tarjeta de formación ──────────────────────────────
function FormacionCard({
  formacion,
  onUpdate,
  onDelete,
  compuestos,
}: {
  formacion: MineralFormacion;
  onUpdate: (id: string, updates: Partial<MineralFormacion>) => void;
  onDelete: () => void;
  compuestos: Compuesto[];
}) {
  return (
    <div className="group py-3">
      {/* Header: nombre de la formación (texto libre) + eliminar (hover) */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <input
          className="min-w-0 flex-1 bg-transparent px-0 py-1 text-sm font-semibold text-primary/80 outline-none transition-colors placeholder:text-primary/25 placeholder:font-normal"
          placeholder="Nombre de la formación (ej: Veta, Inclusión de cuarzo)…"
          value={formacion.nombre ?? ""}
          onChange={(e) => onUpdate(formacion.id, { nombre: e.target.value })}
        />
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-red-500/10 text-red-500/40 hover:text-red-500 transition shrink-0 opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Contenido: grid de 2 columnas cuando hay ancho, sin cajas anidadas */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-x-5 gap-y-2 text-xs items-start">
        <div>
          <SelectorFormulaOrgano
            compuestos={compuestos}
            componentes={(formacion.componentes ?? []) as ComponenteOrgano[]}
            onChange={(componentes) => onUpdate(formacion.id, { componentes })}
          />
        </div>

        <div>
          <textarea
            className="w-full h-full min-h-[3.5rem] bg-transparent px-0 py-1 text-primary/70 resize-none outline-none transition-colors placeholder:text-primary/25"
            placeholder="Notas de la formación…"
            value={formacion.notas ?? ""}
            onChange={(e) => onUpdate(formacion.id, { notas: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ── Componente auxiliar: Tarjeta de proceso geológico ──────────────────────
function ProcesoMineralCard({
  proceso,
  onUpdate,
  onDelete,
  compuestos,
  elementos,
}: {
  proceso: MineralProceso;
  onUpdate: (id: string, updates: Partial<MineralProceso>) => void;
  onDelete: () => void;
  compuestos: Compuesto[];
  elementos: Elemento[];
}) {
  return (
    <div className="group py-3">
      {/* Header: nombre del proceso (texto libre) + eliminar (hover) */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <input
          className="min-w-0 flex-1 bg-transparent px-0 py-1 text-sm font-semibold text-primary/80 outline-none transition-colors placeholder:text-primary/25 placeholder:font-normal"
          placeholder="Nombre del proceso (ej: Cristalización, Oxidación)…"
          value={proceso.nombre ?? ""}
          onChange={(e) => onUpdate(proceso.id, { nombre: e.target.value })}
        />
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-red-500/10 text-red-500/40 hover:text-red-500 transition shrink-0 opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Contenido: columna izquierda = Consume (arriba) + Produce (abajo),
          columna derecha = Descripción. Sin cajas anidadas. */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.4fr] gap-x-5 gap-y-3 text-xs items-start">
        <div className="space-y-3">
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
          <BalanceProcesoPanel
            consume={(proceso.consume ?? []) as ItemProceso[]}
            produce={(proceso.produce ?? []) as ItemProceso[]}
            compuestos={compuestos}
            elementos={elementos}
            onAutocompletar={(produce) => onUpdate(proceso.id, { produce })}
          />
        </div>

        <div>
          <textarea
            className="w-full bg-transparent px-0 py-1 text-primary/70 resize-none outline-none transition-colors placeholder:text-primary/25"
            placeholder="Descripción del proceso (incluye condiciones geológicas, cuándo ocurre, etc)…"
            value={proceso.descripcion ?? ""}
            onChange={(e) => onUpdate(proceso.id, { descripcion: e.target.value })}
            rows={5}
          />
        </div>
      </div>
    </div>
  );
}
