"use client";

/**
 * FloraEditor.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Editor liviano y self-contained de una entidad Flora: nombre, imagen,
 * descripción rica, composición material con una o varias partes (cada una
 * referenciando un Compuesto del catálogo de Elementos + una etiqueta libre
 * que explica dónde/por qué aplica, ej. "Tronco", "Hojas"), y notas.
 *
 * Molde: liviano como ItemEditor/EcosistemaEditor, no tan pesado como
 * EditorCriatura.tsx (sin personajes/reinos/ítems/grupos/D&D).
 */

import { Leaf } from "lucide-react";
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
import { type Flora } from "./types";
import { SelectorEcosistemasDeEntidad } from "@/domains/garlia/biologia/SelectorEcosistemasDeEntidad";

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

              {/* Composición material — puede tener varias partes hechas de
                  compuestos distintos (ej: "Madera" en el tronco, "Resina"
                  en la savia), cada una con su propia etiqueta */}
              <div className="pt-2 border-t border-primary/10">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
                    Composición (Compuestos)
                  </span>
                </div>
                <p className="text-micro text-primary/30 mb-1.5 -mt-1">
                  Compuestos de la Tabla Química que forman esta planta, por parte
                  (tronco, hojas, raíz…).
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
