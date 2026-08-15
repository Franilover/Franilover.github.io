"use client";

/**
 * MineralEditor.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Editor liviano y self-contained de una entidad Mineral: nombre, imagen,
 * descripción rica, composición material con una o varias partes (cada una
 * referenciando un Compuesto del catálogo de Elementos + una etiqueta libre
 * que explica dónde/por qué aplica, ej. "Veta principal", "Superficie"), y
 * notas.
 *
 * Mismo molde que FloraEditor.tsx — ver ese archivo para el razonamiento
 * de diseño completo.
 */

import { Gem } from "lucide-react";
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

import { useMinerales } from "./useMinerales";
import { type Mineral } from "./types";
import { SelectorEcosistemasDeEntidad } from "@/domains/garlia/biologia/SelectorEcosistemasDeEntidad";
import { EcosistemaPopoverContent } from "@/domains/garlia/biologia/EcosistemaPopoverContent";
import { PopoverFlotante } from "@/domains/garlia/_shared/PopoverFlotante";

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
  const { items: compuestos, setItems: setCompuestos, loading: loadingCompuestos } = useCompuestos();
  const { actualizar, eliminar } = useMinerales();
  const { confirm, ConfirmModal } = useConfirm();

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

  function cambiarComposicion(composicion: ComposicionEntrada[]) {
    setForm((f) => ({ ...f, composicion }));
    void guardar({ composicion });
  }

  function onCompuestoCreado(nuevo: Compuesto) {
    setCompuestos((prev) => [...prev, nuevo]);
  }

  async function eliminarMineral() {
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
                  placeholder="Qué es, dónde se encuentra, propiedades, apariencia…"
                  value={form.descripcion ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, descripcion: v }))}
                />
              </div>

              {/* Composición material — puede tener varias partes hechas de
                  compuestos distintos (ej: "Cuarzo" en la veta principal,
                  "Óxido" en la superficie), cada una con su propia etiqueta */}
              <div className="pt-2 border-t border-primary/10">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
                    Composición (Compuestos)
                  </span>
                </div>
                <p className="text-micro text-primary/30 mb-1.5 -mt-1">
                  Compuestos de la Tabla Química que forman este mineral, por parte
                  (veta, superficie, núcleo…).
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

              {/* Ecosistemas donde aparece este mineral — edición inversa de
                  Ecosistema.mineral_ids */}
              <div className="pt-2 border-t border-primary/10">
                <SelectorEcosistemasDeEntidad
                  entidadId={form.id}
                  campo="mineral_ids"
                  label="Ecosistemas donde aparece"
                  onSelectEcosistema={(id, anchor) => setEcosistemaAbierto({ id, anchor })}
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
