"use client";

/**
 * MineralEditor.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Editor de una entidad Mineral: nombre, imagen, descripción rica, notas, y
 * — mismo molde que FloraEditor.tsx — Formaciones y Procesos:
 *
 * - Formaciones: partes del mineral con fórmula propia (veta, inclusión,
 *   capa, núcleo, superficie, cristal…). Reemplaza la antigua composición
 *   plana de un solo nivel (`Mineral.componentes`), que se migra
 *   automáticamente a una Formación la primera vez que se abre este editor
 *   (ver useMineralFormacionesProcesos).
 *
 * - Procesos: eventos geológicos de formación/transformación
 *   (cristalización, oxidación, metamorfismo…) con consume/produce +
 *   condiciones — mismo shape que los Procesos de Flora, pero sin
 *   orden/secuencia: los procesos geológicos de un mineral no tienen un
 *   orden narrativo único.
 *
 * Reutiliza SelectorTipo, SelectorFormulaOrgano y SelectorConsumeProduce de
 * Flora tal cual (son genéricos, sin nada específico de planta).
 */

import { Droplet, Flame, Gem, Layers, Mountain, Plus, Snowflake, Sparkle, Trash2, Waves } from "lucide-react";
import React, { useEffect, useState } from "react";

import { RichEditor } from "@/editor/lexical";
import { type SaveStatus } from "@/ui/saveStatus";

import { useCompuestos } from "@/domains/garlia/elementos/useCompuestos";
import { useElementos } from "@/domains/garlia/elementos/useElementos";
import { CompuestoPanelFlotante } from "@/domains/garlia/elementos/CompuestosPage";
import { type Compuesto, type Elemento } from "@/domains/garlia/elementos/types";
import { SelectorImagen } from "@/domains/garlia/_shared/UIComponents";
import { EditorHeaderBar } from "@/domains/garlia/_shared/EditorHeaderBar";
import {
  usePublishHeaderControls,
  type OnHeaderControlsChange,
} from "@/domains/garlia/_shared/useEditorHeaderControls";

import { useMinerales } from "./useMinerales";
import { useMineralFormacionesProcesos } from "./useMineralFormacionesProcesos";
import { type Mineral, type MineralFormacion, type MineralProceso } from "./types";
import { SelectorEcosistemasDeEntidad } from "@/domains/garlia/biologia/SelectorEcosistemasDeEntidad";
import { EcosistemaPopoverContent } from "@/domains/garlia/biologia/EcosistemaPopoverContent";
import { PopoverFlotante } from "@/domains/garlia/_shared/PopoverFlotante";

import { SelectorTipo, type OpcionTipo } from "@/domains/garlia/flora/SelectorTipo";
import { SelectorFormulaOrgano, type ComponenteOrgano } from "@/domains/garlia/flora/SelectorFormulaOrgano";
import { SelectorConsumeProduce, type ItemProceso } from "@/domains/garlia/flora/SelectorConsumeProduce";

// ─── Catálogos de tipo fijos, con icono ────────────────────────────────────

const TIPOS_FORMACION: OpcionTipo<MineralFormacion["tipo_formacion"]>[] = [
  { value: "veta", label: "Veta", icon: Layers },
  { value: "inclusion", label: "Inclusión", icon: Sparkle },
  { value: "capa", label: "Capa", icon: Layers },
  { value: "nucleo", label: "Núcleo", icon: Gem },
  { value: "superficie", label: "Superficie", icon: Mountain },
  { value: "cristal", label: "Cristal", icon: Sparkle },
  { value: "otro", label: "Otro", icon: Gem },
];

const TIPOS_PROCESO_MINERAL: OpcionTipo<MineralProceso["tipo_proceso"]>[] = [
  { value: "cristalizacion", label: "Cristalización", icon: Snowflake },
  { value: "sedimentacion", label: "Sedimentación", icon: Layers },
  { value: "metamorfismo", label: "Metamorfismo", icon: Mountain },
  { value: "oxidacion", label: "Oxidación", icon: Droplet },
  { value: "erosion", label: "Erosión", icon: Waves },
  { value: "fusion", label: "Fusión", icon: Flame },
  { value: "otro", label: "Otro", icon: Gem },
];

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
              <div className="flex gap-2 mb-4 border-b border-primary/10">
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

              {/* ── TAB: Info ─────────────────────────────────────────────── */}
              {tabActiva === "info" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35 block mb-1.5">
                      Descripción
                    </label>
                    <RichEditor
                      minHeight="10rem"
                      placeholder="Qué es, dónde se encuentra, propiedades, apariencia…"
                      value={form.descripcion ?? ""}
                      onChange={(v) => setForm((f) => ({ ...f, descripcion: v }))}
                    />
                  </div>

                  {/* Ecosistemas */}
                  <div className="pt-4 border-t border-primary/10">
                    <SelectorEcosistemasDeEntidad
                      entidadId={form.id}
                      campo="mineral_ids"
                      label="Ecosistemas donde aparece"
                      onSelectEcosistema={(id, anchor) => setEcosistemaAbierto({ id, anchor })}
                    />
                  </div>

                  {/* Notas */}
                  <div className="pt-4 border-t border-primary/10">
                    <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35 block mb-1.5">
                      Notas
                    </label>
                    <textarea
                      className="w-full min-h-[4.5rem] bg-transparent border-0 border-b border-primary/10 focus:border-primary/30 px-0 py-1.5 text-xs text-primary/70 outline-none placeholder:text-primary/30 resize-y transition-colors"
                      placeholder="Cualquier otra nota libre…"
                      value={form.notas ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                      onBlur={() => guardar({ notas: form.notas })}
                    />
                  </div>
                </div>
              )}

              {/* ── TAB: Formaciones ──────────────────────────────────────── */}
              {tabActiva === "formaciones" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary/50">FORMACIONES</span>
                    <SelectorTipo
                      variant="crear"
                      triggerLabel={
                        <span className="flex items-center gap-1.5">
                          <Plus size={14} /> Nueva formación
                        </span>
                      }
                      opciones={TIPOS_FORMACION}
                      onSelect={(tipo) => void crearFormacion(tipo)}
                    />
                  </div>

                  {loadingFormacionesProcesos ? (
                    <p className="text-xs text-primary/40">Cargando formaciones…</p>
                  ) : formaciones.length === 0 ? (
                    <p className="text-xs text-primary/40 italic">
                      Sin formaciones. Crea una para empezar.
                    </p>
                  ) : (
                    <div className="divide-y divide-primary/10">
                      {formaciones.map((formacion) => (
                        <FormacionCard
                          key={formacion.id}
                          formacion={formacion}
                          onUpdate={actualizarFormacion}
                          onDelete={() => eliminarFormacion(formacion.id)}
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
                    <span className="text-xs font-semibold text-primary/50">PROCESOS GEOLÓGICOS</span>
                    <SelectorTipo
                      variant="crear"
                      triggerLabel={
                        <span className="flex items-center gap-1.5">
                          <Plus size={14} /> Nuevo proceso
                        </span>
                      }
                      opciones={TIPOS_PROCESO_MINERAL}
                      onSelect={(tipo) => void crearProceso(tipo)}
                    />
                  </div>

                  {loadingFormacionesProcesos ? (
                    <p className="text-xs text-primary/40">Cargando procesos…</p>
                  ) : procesos.length === 0 ? (
                    <p className="text-xs text-primary/40 italic">
                      Sin procesos. Crea uno para empezar.
                    </p>
                  ) : (
                    <div className="divide-y divide-primary/10">
                      {procesos.map((proceso) => (
                        <ProcesoMineralCard
                          key={proceso.id}
                          proceso={proceso}
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
  const opcionActual = TIPOS_FORMACION.find((o) => o.value === formacion.tipo_formacion);
  const Icon = opcionActual?.icon ?? Gem;

  return (
    <div className="group py-3 first:pt-0">
      {/* Header: ícono + selector de tipo + eliminar (solo al hover) */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={13} className="shrink-0 text-primary/40" />
          <SelectorTipo
            variant="chip"
            valor={formacion.tipo_formacion}
            opciones={TIPOS_FORMACION}
            onSelect={(tipo) => onUpdate(formacion.id, { tipo_formacion: tipo })}
          />
        </div>
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-red-500/10 text-red-500/40 hover:text-red-500 transition shrink-0 opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Contenido: grid de 2 columnas cuando hay ancho, sin cajas anidadas */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-x-5 gap-y-2 text-xs items-start">
        <div>
          <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/35 block mb-1.5">
            Fórmula química
          </span>
          <SelectorFormulaOrgano
            compuestos={compuestos}
            componentes={(formacion.componentes ?? []) as ComponenteOrgano[]}
            onChange={(componentes) => onUpdate(formacion.id, { componentes })}
          />
        </div>

        <div>
          <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/35 block mb-1.5">
            Notas
          </span>
          <textarea
            className="w-full h-full min-h-[3.5rem] bg-transparent border-0 border-b border-primary/10 focus:border-primary/30 px-0 py-1 text-primary/70 resize-none outline-none transition-colors placeholder:text-primary/25"
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
    <div className="group py-3 first:pt-0">
      {/* Header: selector de tipo real + eliminar (hover) */}
      <div className="flex items-center justify-between mb-2">
        <SelectorTipo
          variant="chip"
          valor={proceso.tipo_proceso}
          opciones={TIPOS_PROCESO_MINERAL}
          onSelect={(tipo) => onUpdate(proceso.id, { tipo_proceso: tipo })}
        />
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-red-500/10 text-red-500/40 hover:text-red-500 transition shrink-0 opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Contenido: consume/produce lado a lado, condiciones + descripción
          también en columnas cuando el ancho lo permite. Sin cajas anidadas. */}
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5 gap-y-3">
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

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-x-5 gap-y-2 items-start">
          <div>
            <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/35 block mb-1">
              Condiciones
            </span>
            <input
              className="w-full bg-transparent border-0 border-b border-primary/10 focus:border-primary/30 px-0 py-1 text-primary/70 outline-none transition-colors placeholder:text-primary/25"
              placeholder='Ej: "alta presión", "calor volcánico", "millones de años"…'
              value={proceso.condiciones ?? ""}
              onChange={(e) => onUpdate(proceso.id, { condiciones: e.target.value })}
            />
          </div>

          <div>
            <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/35 block mb-1">
              Descripción
            </span>
            <textarea
              className="w-full bg-transparent border-0 border-b border-primary/10 focus:border-primary/30 px-0 py-1 text-primary/70 resize-none outline-none transition-colors placeholder:text-primary/25"
              placeholder="Descripción del proceso…"
              value={proceso.descripcion ?? ""}
              onChange={(e) => onUpdate(proceso.id, { descripcion: e.target.value })}
              rows={2}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
