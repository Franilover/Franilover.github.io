"use client";

/**
 * FloraEditor mejorado (v2 — interfaz de Órganos y Procesos)
 * ───────────────────────────────────────────────────────────────────────────
 * Tres secciones principales:
 * 1. Composición general: descripción + ecosistemas donde crece.
 * 2. Órganos individuales (hoja, pétalo, raíz, fruto, tallo…) — selector
 *    real de tipo (crear y cambiar) y editor visual de fórmula química
 *    (chips + stepper sobre la Tabla Química real).
 * 3. Procesos del ciclo de vida (fotosíntesis, floración…) — selector real
 *    de tipo, editor visual de consume/produce (elemento o compuesto real
 *    + cantidad), y reorden por drag-and-drop persistido en `orden`.
 */

import {
  GripVertical,
  Leaf,
  Plus,
  Trash2,
} from "lucide-react";
import React, { useEffect, useState } from "react";

import { RichEditor } from "@/editor/lexical";
import { type SaveStatus } from "@/ui/saveStatus";

import { useCompuestos } from "@/domains/garlia/elementos/useCompuestos";
import { useElementos } from "@/domains/garlia/elementos/useElementos";
import { type Compuesto, type Elemento } from "@/domains/garlia/elementos/types";
import { ElementoPanelFlotante } from "@/domains/garlia/elementos/ElementosPage";
import { CompuestoPanelFlotante } from "@/domains/garlia/elementos/CompuestosPage";
import { SelectorImagen } from "@/domains/garlia/_shared/UIComponents";
import { EditorHeaderBar } from "@/domains/garlia/_shared/EditorHeaderBar";
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

import { SelectorFormulaOrgano, type ComponenteOrgano } from "./SelectorFormulaOrgano";
import { SelectorConsumeProduce, type ItemProceso } from "./SelectorConsumeProduce";

export function FloraEditorMejorado({
  flora: floraProp,
  onDeleted,
  onHeaderControlsChange,
}: {
  flora: Flora;
  onDeleted?: (id: string) => void;
  onHeaderControlsChange?: OnHeaderControlsChange;
}) {
  const { items: elementos, setItems: setElementos } = useElementos();
  const { items: compuestos, setItems: setCompuestos } = useCompuestos();
  const { actualizar, eliminar } = useFlora();

  const [form, setForm] = useState<Flora>(floraProp);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [ecosistemaAbierto, setEcosistemaAbierto] = useState<{
    id: string;
    anchor: HTMLElement;
  } | null>(null);
  // Panel flotante de Elemento o Compuesto, abierto al clickear un item
  // elegido en Consume/Produce o en la Fórmula química de un Órgano.
  // Un solo estado: abrir uno nuevo reemplaza el que estuviera abierto.
  const [itemAbierto, setItemAbierto] = useState<
    { tipo: "elemento" | "compuesto"; id: string } | null
  >(null);

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

  // Confirmación inline en el header compartido — ver EditorHeaderBar.
  async function eliminarFlora() {
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
                  <RichEditor
                    minHeight="8rem"
                    placeholder="Qué es, dónde crece, usos, apariencia…"
                    value={form.descripcion ?? ""}
                    onChange={(v) => setForm((f) => ({ ...f, descripcion: v }))}
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
              </div>
            )}

            {/* ── TAB: Órganos ──────────────────────────────────────────── */}
            {tabActiva === "organos" && (
              <div className="space-y-3">
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => void crearOrgano()}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary/60 hover:text-primary transition px-2 py-1 rounded hover:bg-primary/5"
                  >
                    <Plus size={14} /> Nuevo órgano
                  </button>
                </div>

                {loadingOrganosProcesos ? (
                  <p className="text-xs text-primary/40">Cargando órganos…</p>
                ) : organos.length === 0 ? (
                  <p className="text-xs text-primary/40 italic">Sin órganos. Crea uno para empezar.</p>
                ) : (
                  <div className="divide-y divide-primary/10">
                    {organos.map((organo) => (
                      <OrganoCard
                        key={organo.id}
                        organo={organo}
                        onUpdate={actualizarOrgano}
                        onDelete={() => eliminarOrgano(organo.id)}
                        compuestos={compuestos}
                        elementos={elementos}
                        onAbrirCompuesto={(id) => setItemAbierto({ tipo: "compuesto", id })}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: Procesos ────────────────────────────────────────── */}
            {tabActiva === "procesos" && (
              <div className="space-y-3">
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => void crearProceso()}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary/60 hover:text-primary transition px-2 py-1 rounded hover:bg-primary/5"
                  >
                    <Plus size={14} /> Nuevo proceso
                  </button>
                </div>

                {loadingOrganosProcesos ? (
                  <p className="text-xs text-primary/40">Cargando procesos…</p>
                ) : procesos.length === 0 ? (
                  <p className="text-xs text-primary/40 italic">Sin procesos. Crea uno para empezar.</p>
                ) : (
                  <ListaProcesosReordenable
                    procesos={procesos}
                    onUpdate={actualizarProceso}
                    onDelete={eliminarProceso}
                    onReorder={reordenarProcesos}
                    compuestos={compuestos}
                    elementos={elementos}
                    onAbrirItem={(item) => setItemAbierto({ tipo: item.tipo, id: item.id })}
                  />
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Popovers flotantes */}
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

      {/* Panel flotante de Elemento o Compuesto, abierto al clickear un item
          elegido en Consume/Produce o en la Fórmula química de un Órgano. */}
      {itemAbierto?.tipo === "elemento" &&
        (() => {
          const elemento = elementos.find((e) => e.id === itemAbierto.id);
          if (!elemento) return null;
          return (
            <ElementoPanelFlotante
              elemento={elemento}
              todosLosElementos={elementos}
              compuestos={compuestos}
              onCerrar={() => setItemAbierto(null)}
              onActualizar={(id, cambios) =>
                setElementos((prev) => prev.map((e) => (e.id === id ? { ...e, ...cambios } : e)))
              }
              onNavigateCompuesto={(compuestoId) =>
                setItemAbierto({ tipo: "compuesto", id: compuestoId })
              }
            />
          );
        })()}

      {itemAbierto?.tipo === "compuesto" &&
        (() => {
          const compuesto = compuestos.find((c) => c.id === itemAbierto.id);
          if (!compuesto) return null;
          return (
            <CompuestoPanelFlotante
              compuesto={compuesto}
              elementos={elementos}
              todosLosCompuestos={compuestos}
              onCerrar={() => setItemAbierto(null)}
              onActualizar={(id, cambios) =>
                setCompuestos((prev) => prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)))
              }
            />
          );
        })()}
    </div>
  );
}

// ── Componente auxiliar: Tarjeta de órgano ─────────────────────────────────
interface OrganoCardProps {
  organo: PlantaOrgano;
  onUpdate: (id: string, updates: Partial<PlantaOrgano>) => void;
  onDelete: () => void;
  compuestos: Compuesto[];
  elementos: Elemento[];
  onAbrirCompuesto?: (compuestoId: string) => void;
}

function OrganoCard({
  organo,
  onUpdate,
  onDelete,
  compuestos,
  elementos,
  onAbrirCompuesto,
}: OrganoCardProps) {
  function agregarComponente() {
    const componentes = (organo.componentes ?? []) as ComponenteOrgano[];
    const elegidos = new Set(componentes.map((c) => c.compuesto_id));
    const primero = compuestos.find((c) => !elegidos.has(c.id)) ?? compuestos[0];
    if (!primero) return;
    onUpdate(organo.id, {
      componentes: [...componentes, { compuesto_id: primero.id, cantidad: 1 }],
    });
  }

  return (
    <div className="group py-3 first:pt-0">
      {/* Header: nombre del órgano (texto libre) + agregar compuesto + eliminar (hover) */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <input
          className="min-w-0 flex-1 bg-transparent px-0 py-1 text-sm font-semibold text-primary/80 outline-none transition-colors placeholder:text-primary/25 placeholder:font-normal"
          placeholder="Nombre del órgano (ej: Hoja)…"
          value={organo.nombre ?? ""}
          onChange={(e) => onUpdate(organo.id, { nombre: e.target.value })}
        />
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={agregarComponente}
            disabled={compuestos.length === 0}
            title="Agregar compuesto"
            className="w-6 h-6 flex items-center justify-center rounded text-primary/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-red-500/10 text-red-500/40 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Contenido: grid de 2 columnas cuando hay ancho, sin cajas anidadas */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-x-5 gap-y-2 text-xs items-start">
        <div>
          <SelectorFormulaOrgano
            compuestos={compuestos}
            componentes={(organo.componentes ?? []) as ComponenteOrgano[]}
            onChange={(componentes) => onUpdate(organo.id, { componentes })}
            onAbrirCompuesto={onAbrirCompuesto}
            ocultarBotonAgregar
          />
        </div>

        <div>
          <textarea
            className="w-full h-full min-h-[3.5rem] bg-transparent px-0 py-1 text-primary/70 resize-none outline-none transition-colors placeholder:text-primary/25"
            placeholder="Notas del órgano…"
            value={organo.notas ?? ""}
            onChange={(e) => onUpdate(organo.id, { notas: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ── Lista de procesos reordenable (drag-and-drop nativo) ───────────────────
// Mismo mecanismo que el reorder de capítulos en EditorCapitulos.tsx:
// HTML5 DnD nativo, sin dependencias nuevas. `dragId` es el proceso que se
// está arrastrando; `overId` el que está debajo del cursor.
function ListaProcesosReordenable({
  procesos,
  onUpdate,
  onDelete,
  onReorder,
  compuestos,
  elementos,
  onAbrirItem,
}: {
  procesos: PlantaProceso[];
  onUpdate: (id: string, updates: Partial<PlantaProceso>) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  compuestos: Compuesto[];
  elementos: Elemento[];
  onAbrirItem?: (item: ItemProceso) => void;
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
    <div className="divide-y divide-primary/10">
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
            className="transition-opacity"
            style={{
              boxShadow: resaltarSoltar ? "inset 0 2px 0 0 var(--primary)" : undefined,
              opacity: arrastrando ? 0.4 : 1,
            }}
          >
            <ProcesoCard
              proceso={proceso}
              onUpdate={onUpdate}
              onDelete={() => onDelete(proceso.id)}
              compuestos={compuestos}
              elementos={elementos}
              onAbrirItem={onAbrirItem}
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
  onUpdate: (id: string, updates: Partial<PlantaProceso>) => void;
  onDelete: () => void;
  compuestos: Compuesto[];
  elementos: Elemento[];
  onAbrirItem?: (item: ItemProceso) => void;
  dragHandleProps: {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
  };
}

function ProcesoCard({
  proceso,
  onUpdate,
  onDelete,
  compuestos,
  elementos,
  onAbrirItem,
  dragHandleProps,
}: ProcesoCardProps) {
  return (
    <div className="group py-3">
      {/* Header: drag handle + nombre del proceso (texto libre) + eliminar (hover) */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span
            {...dragHandleProps}
            title="Arrastrar para reordenar"
            className="shrink-0 p-1 -ml-1 rounded cursor-grab active:cursor-grabbing text-primary/20 hover:text-primary/50 transition"
          >
            <GripVertical size={13} />
          </span>
          <input
            className="min-w-0 flex-1 bg-transparent px-0 py-1 text-sm font-semibold text-primary/80 outline-none transition-colors placeholder:text-primary/25 placeholder:font-normal"
            placeholder="Nombre del proceso (ej: Fotosíntesis)…"
            value={proceso.nombre ?? ""}
            onChange={(e) => onUpdate(proceso.id, { nombre: e.target.value })}
          />
        </div>
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-red-500/10 text-red-500/40 hover:text-red-500 transition shrink-0 opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Contenido: columna izquierda = Consume (arriba) + Produce (abajo),
          columna derecha = Descripción. Sin cajas anidadas. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-x-5 gap-y-3 text-xs items-start">
        <div className="space-y-3">
          <SelectorConsumeProduce
            label="Consume"
            items={(proceso.consume ?? []) as ItemProceso[]}
            onChange={(consume) => onUpdate(proceso.id, { consume })}
            elementos={elementos}
            compuestos={compuestos}
            onAbrirItem={onAbrirItem}
          />
          <SelectorConsumeProduce
            label="Produce"
            items={(proceso.produce ?? []) as ItemProceso[]}
            onChange={(produce) => onUpdate(proceso.id, { produce })}
            elementos={elementos}
            compuestos={compuestos}
            onAbrirItem={onAbrirItem}
          />
        </div>

        <div>
          <textarea
            className="w-full bg-transparent px-0 py-1 text-primary/70 resize-none outline-none transition-colors placeholder:text-primary/25"
            placeholder="Descripción del proceso (incluye condiciones ambientales, cuándo ocurre, etc)…"
            value={proceso.descripcion ?? ""}
            onChange={(e) => onUpdate(proceso.id, { descripcion: e.target.value })}
            rows={5}
          />
        </div>
      </div>
    </div>
  );
}

export { FloraEditorMejorado as FloraEditor };
