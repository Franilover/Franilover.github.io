"use client";

/**
 * FloraEditor.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Editor liviano y self-contained de una entidad Flora: nombre, imagen,
 * descripción rica, composición material referenciando un Compuesto del
 * catálogo de Elementos (compuesto_id — elegido/creado vía SelectorCompuesto,
 * en vez de armar elementos sueltos uno a uno) con balance por capa /
 * reactividad / peso, y notas.
 *
 * Molde: liviano como ItemEditor/EcosistemaEditor, no tan pesado como
 * EditorCriatura.tsx (sin personajes/reinos/ítems/grupos/D&D).
 */

import { Leaf } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { RichEditor } from "@/editor/lexical";
import { useConfirm } from "@/ui/ConfirmModal";
import { type SaveStatus } from "@/ui/saveStatus";

import {
  calcularBalancePorCapa,
  calcularPerfilAtomico,
  calcularPeso,
  calcularReactividad,
} from "@/domains/garlia/elementos/afinidad";
import { useCompuestos } from "@/domains/garlia/elementos/useCompuestos";
import { useElementos } from "@/domains/garlia/elementos/useElementos";
import { CompuestoPanelFlotante } from "@/domains/garlia/elementos/CompuestosPage";
import {
  LAYER_LABEL,
  REACTIVIDAD_LABEL,
  formatLayer,
  type Compuesto,
  type LayerName,
} from "@/domains/garlia/elementos/types";
import { SelectorImagen } from "@/domains/garlia/_shared/UIComponents";
import { EditorHeaderBar } from "@/domains/garlia/_shared/EditorHeaderBar";
import { SelectorCompuesto } from "@/domains/garlia/_shared/SelectorCompuesto";
import {
  usePublishHeaderControls,
  type OnHeaderControlsChange,
} from "@/domains/garlia/_shared/useEditorHeaderControls";

import { useFlora } from "./useFlora";
import { type Flora } from "./types";
import { SelectorEcosistemasDeEntidad } from "@/domains/garlia/biologia/SelectorEcosistemasDeEntidad";

const LAYERS: LayerName[] = ["nucleo", "media", "externa"];

// ─── Barra de balance de una capa (misma pieza que en PerfilAtomicoCriaturaPanel) ──
function BarraCapa({
  layer,
  perfil,
  total,
  capacidad,
}: {
  layer: LayerName;
  perfil: Record<string, number | undefined>;
  total: number;
  capacidad: number;
}) {
  const balance = total - capacidad;
  const pct = capacidad > 0 ? Math.min(100, (total / capacidad) * 100) : 0;

  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-micro font-black uppercase tracking-wide text-primary/50">
          {LAYER_LABEL[layer]}
        </span>
        <span className="text-micro font-bold text-primary/40">
          {total}/{capacidad}{" "}
          {balance === 0 ? "(saturada)" : balance > 0 ? `(+${balance})` : `(${balance})`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-primary/8 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            balance < 0 ? "bg-amber-400/60" : balance > 0 ? "bg-accent/60" : "bg-emerald-400/60"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-micro text-primary/35 mt-0.5 block">{formatLayer(perfil)}</span>
    </div>
  );
}

export function FloraEditor({
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

  useEffect(() => {
    setForm(floraProp);
    setStatus("idle");
  }, [floraProp.id]);

  const compuestoElegido = useMemo(
    () => compuestos.find((c) => c.id === form.compuesto_id) ?? null,
    [compuestos, form.compuesto_id],
  );
  const perfilAtomico = useMemo(
    () => (compuestoElegido ? calcularPerfilAtomico(compuestoElegido, elementos) : null),
    [compuestoElegido, elementos],
  );
  const balance = useMemo(
    () => (perfilAtomico ? calcularBalancePorCapa(perfilAtomico) : null),
    [perfilAtomico],
  );
  const reactividad = useMemo(
    () => (compuestoElegido ? calcularReactividad(compuestoElegido, elementos) : null),
    [compuestoElegido, elementos],
  );
  const peso = useMemo(
    () => (compuestoElegido ? calcularPeso(compuestoElegido, elementos) : null),
    [compuestoElegido, elementos],
  );

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

  function cambiarCompuesto(compuestoId: string | null) {
    setForm((f) => ({ ...f, compuesto_id: compuestoId }));
    void guardar({ compuesto_id: compuestoId });
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
    // Flora autoguarda el nombre on-blur (comportamiento previo) además de
    // permitir Guardar explícito para el resto de campos.
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
          <div className="flex flex-col sm:flex-row gap-5">
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

            {/* Columna derecha: descripción + composición + notas */}
            <div className="flex-1 min-w-0 space-y-4">
              <div className="space-y-1.5">
                <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35">
                  Descripción
                </label>
                <RichEditor
                  minHeight="10rem"
                  placeholder="Qué es, dónde crece, usos, apariencia…"
                  value={form.descripcion ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, descripcion: v }))}
                />
              </div>

              {/* Composición material — ahora se elige/crea un Compuesto del
                  catálogo en vez de armar elementos sueltos uno a uno */}
              <div className="pt-2 border-t border-primary/10">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
                    Composición (Compuesto)
                  </span>
                </div>
                <p className="text-micro text-primary/30 mb-1.5 -mt-1">
                  Compuesto de la Tabla Química que forma esta planta.
                </p>

                <SelectorCompuesto
                  compuestos={compuestos}
                  loadingCompuestos={loadingCompuestos}
                  compuestoId={form.compuesto_id}
                  onChange={cambiarCompuesto}
                  onCompuestoCreado={onCompuestoCreado}
                  onEditarCompuesto={setEditandoCompuestoId}
                />
              </div>

              {/* Balance por capa del compuesto elegido */}
              {compuestoElegido && balance && perfilAtomico && (
                <div className="p-3 rounded-xl border border-primary/10 bg-primary/[0.02]">
                  {LAYERS.map((layer) => {
                    const b = balance.find((x) => x.layer === layer)!;
                    return (
                      <BarraCapa
                        key={layer}
                        layer={layer}
                        perfil={perfilAtomico[layer]}
                        total={b.total}
                        capacidad={b.capacidad}
                      />
                    );
                  })}

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-primary/10">
                    <span className="text-micro font-bold text-primary/50">
                      Reactividad:{" "}
                      <span className="text-primary/80">
                        {reactividad ? REACTIVIDAD_LABEL[reactividad.nivel] : "—"}
                      </span>
                    </span>
                    <span className="text-micro font-bold text-primary/50">
                      Peso:{" "}
                      <span className="text-primary/80">
                        {peso ? `${peso.pesoTotal} (${peso.categoria})` : "—"}
                      </span>
                    </span>
                  </div>
                </div>
              )}

              {/* Ecosistemas donde crece esta planta — edición inversa de
                  Ecosistema.flora_ids */}
              <div className="pt-2 border-t border-primary/10">
                <SelectorEcosistemasDeEntidad
                  entidadId={form.id}
                  campo="flora_ids"
                  label="Ecosistemas donde crece"
                />
              </div>

              {/* Notas libres */}
              <div className="space-y-1.5">
                <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35">
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
    </div>
  );
}
