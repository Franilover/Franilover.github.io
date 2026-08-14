"use client";

/**
 * MineralEditor.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Editor liviano y self-contained de una entidad Mineral: nombre, imagen,
 * descripción rica, composición de Elementos (mismo motor de afinidad.ts
 * que Criaturas/Flora, vía SelectorComposicionElementos compartido) con
 * balance por capa / reactividad / peso, y notas.
 *
 * Mismo molde que FloraEditor.tsx — ver ese archivo para el razonamiento
 * de diseño completo.
 */

import { Gem, Wand2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { RichEditor } from "@/editor/lexical";
import { useConfirm } from "@/ui/ConfirmModal";
import { type SaveStatus } from "@/ui/saveStatus";

import {
  autocompletarHastaEstable,
  calcularBalancePorCapa,
  calcularPerfilAtomico,
  calcularPeso,
  calcularReactividad,
} from "@/domains/garlia/elementos/afinidad";
import { SelectorComposicionElementos } from "@/domains/garlia/elementos/SelectorComposicionElementos";
import { useElementos } from "@/domains/garlia/elementos/useElementos";
import {
  LAYER_LABEL,
  REACTIVIDAD_LABEL,
  formatLayer,
  type ComponenteCompuesto,
  type Compuesto,
  type LayerName,
} from "@/domains/garlia/elementos/types";
import { SelectorImagen } from "@/domains/garlia/_shared/UIComponents";
import { EditorHeaderBar } from "@/domains/garlia/_shared/EditorHeaderBar";
import {
  usePublishHeaderControls,
  type OnHeaderControlsChange,
} from "@/domains/garlia/_shared/useEditorHeaderControls";

import { useMinerales } from "./useMinerales";
import { type Mineral } from "./types";
import { SelectorEcosistemasDeEntidad } from "@/domains/garlia/biologia/SelectorEcosistemasDeEntidad";

const LAYERS: LayerName[] = ["nucleo", "media", "externa"];

// ─── Barra de balance de una capa (misma pieza que en PerfilAtomicoCriaturaPanel/FloraEditor) ──
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

export function MineralEditor({
  mineral: mineralProp,
  onDeleted,
  onHeaderControlsChange,
}: {
  mineral: Mineral;
  onDeleted?: (id: string) => void;
  onHeaderControlsChange?: OnHeaderControlsChange;
}) {
  const { items: elementos, loading: loadingElementos } = useElementos();
  const { actualizar, eliminar } = useMinerales();
  const { confirm, ConfirmModal } = useConfirm();

  const [form, setForm] = useState<Mineral>(mineralProp);
  const [status, setStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    setForm(mineralProp);
    setStatus("idle");
  }, [mineralProp.id]);

  const componentes = form.componentes ?? [];

  const compuestoTemporal: Compuesto = useMemo(
    () => ({ id: form.id, nombre: form.nombre, componentes }),
    [form.id, form.nombre, componentes],
  );
  const perfilAtomico = useMemo(
    () => calcularPerfilAtomico(compuestoTemporal, elementos),
    [compuestoTemporal, elementos],
  );
  const balance = useMemo(() => calcularBalancePorCapa(perfilAtomico), [perfilAtomico]);
  const reactividad = useMemo(
    () => calcularReactividad(compuestoTemporal, elementos),
    [compuestoTemporal, elementos],
  );
  const peso = useMemo(() => calcularPeso(compuestoTemporal, elementos), [compuestoTemporal, elementos]);

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

  function cambiarComponentes(nuevos: ComponenteCompuesto[]) {
    setForm((f) => ({ ...f, componentes: nuevos }));
    void guardar({ componentes: nuevos });
  }

  function autocompletar() {
    const nuevos = autocompletarHastaEstable(componentes, elementos);
    cambiarComponentes(nuevos);
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

              {/* Composición material — reusa el motor de afinidad.ts de Elementos */}
              <div className="pt-2 border-t border-primary/10">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
                    Composición (Elementos)
                  </span>
                  {componentes.length > 0 && (
                    <button
                      type="button"
                      onClick={autocompletar}
                      title="Agregar elementos hasta cerrar el déficit de las 3 capas"
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
                    >
                      <Wand2 size={10} /> Autocompletar
                    </button>
                  )}
                </div>
                <p className="text-micro text-primary/30 mb-1.5 -mt-1">
                  Elementos de la Tabla Química que componen este mineral.
                </p>

                {loadingElementos ? (
                  <div className="py-3 text-xs text-primary/30 text-center">Cargando elementos…</div>
                ) : (
                  <SelectorComposicionElementos
                    componentes={componentes}
                    elementos={elementos}
                    onChange={cambiarComponentes}
                  />
                )}
              </div>

              {/* Balance por capa */}
              {componentes.length > 0 && (
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
                      Reactividad: <span className="text-primary/80">{REACTIVIDAD_LABEL[reactividad.nivel]}</span>
                    </span>
                    <span className="text-micro font-bold text-primary/50">
                      Peso: <span className="text-primary/80">{peso.pesoTotal} ({peso.categoria})</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Ecosistemas donde aparece este mineral — edición inversa de
                  Ecosistema.mineral_ids */}
              <div className="pt-2 border-t border-primary/10">
                <SelectorEcosistemasDeEntidad
                  entidadId={form.id}
                  campo="mineral_ids"
                  label="Ecosistemas donde aparece"
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
    </div>
  );
}
