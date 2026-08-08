"use client";

/**
 * ElementoEditor.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Detalle editable de un Elemento: número atómico, nombre, símbolo, familia,
 * noble sí/no, notas, y las 3 capas (núcleo/media/externa) — cada una con
 * un input numérico por tipo de partícula (0 = no aparece en la capa).
 *
 * Guardado con debounce simple al perder foco (blur) / al cambiar selects,
 * mismo criterio que el resto de editores del panel admin: update directo
 * a Supabase + propagación al estado del padre via onActualizar.
 */

import { ChevronLeft, Save, Sparkles, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";
import { useConfirm } from "@/ui/ConfirmModal";

import {
  calcularParticulaDominante,
  generarDescripcionElemento,
  ordenarElementosPorAfinidad,
} from "./afinidad";
import {
  AFINIDAD_LABEL,
  ELEMENT_FAMILIES,
  ESTADOS_ELEMENTO,
  LAYER_LABEL,
  PARTICLE_TYPES,
  type Elemento,
  type ElementFamily,
  type EstadoElemento,
  type LayerName,
  type ParticleMap,
  type TipoAfinidad,
} from "./types";

interface Props {
  elemento: Elemento;
  todosLosElementos?: Elemento[];
  onBack: () => void;
  onActualizar: (id: string, cambios: Partial<Elemento>) => void;
  onEliminar?: (id: string) => void;
}

const AFINIDAD_COLOR: Record<TipoAfinidad, string> = {
  complementa: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  compite: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  saturado: "text-primary/40 bg-primary/5 border-primary/10",
  estable: "text-primary/30 bg-primary/[0.02] border-primary/10",
};

export function ElementoEditor({
  elemento,
  todosLosElementos,
  onBack,
  onActualizar,
  onEliminar,
}: Props) {
  const { confirm, ConfirmModal } = useConfirm();
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState(elemento);

  useEffect(() => setLocal(elemento), [elemento]);

  async function persist(cambios: Partial<Elemento>) {
    setSaving(true);
    try {
      const { error } = await supabase.from("elementos").update(cambios).eq("id", elemento.id);
      if (error) throw error;
      onActualizar(elemento.id, cambios);
    } catch (e) {
      console.error("[ElementoEditor] error guardando:", e);
    } finally {
      setSaving(false);
    }
  }

  function setLayerValue(layer: LayerName, particle: string, value: number) {
    const current: ParticleMap = { ...(local[layer] || {}) };
    if (value > 0) current[particle as keyof ParticleMap] = value;
    else delete current[particle as keyof ParticleMap];
    setLocal((prev) => ({ ...prev, [layer]: current }));
  }

  // Descripción auto-generada: se recalcula sola a partir de familia +
  // capas + estado, no hay campo manual que mantener.
  const descripcion = useMemo(() => generarDescripcionElemento(local), [local]);

  // Partícula(s) dominante(s): la(s) de mayor cantidad sumando las 3 capas.
  const dominantes = useMemo(() => calcularParticulaDominante(local), [local]);

  // Afinidad con el resto de la tabla — misma lógica que compuestos, pero
  // comparando elementos sueltos entre sí (sirve antes de armar un
  // compuesto, para saber qué pareja tiene sentido combinar).
  const afinidades = useMemo(
    () =>
      todosLosElementos ? ordenarElementosPorAfinidad(local, todosLosElementos) : [],
    [local, todosLosElementos],
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <ConfirmModal />
      {/* Header */}
      <div
        style={{ background: "var(--bg-main)" }}
        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 border-b border-primary/10"
      >
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
        >
          <ChevronLeft size={12} />
        </button>

        <span className="shrink-0 text-micro font-black uppercase tracking-widest text-primary/30 px-1.5 py-0.5 rounded border border-primary/15">
          #{local.numero_atomico}
        </span>

        <input
          value={local.nombre ?? ""}
          onChange={(e) => setLocal((p) => ({ ...p, nombre: e.target.value }))}
          onBlur={() => persist({ nombre: local.nombre })}
          placeholder="Nombre del elemento"
          className="flex-1 min-w-0 bg-transparent text-micro font-black text-primary outline-none placeholder:text-primary/25"
        />

        <input
          value={local.simbolo ?? ""}
          onChange={(e) => setLocal((p) => ({ ...p, simbolo: e.target.value }))}
          onBlur={() => persist({ simbolo: local.simbolo })}
          placeholder="Sm"
          maxLength={3}
          className="shrink-0 w-10 text-center bg-primary/5 rounded-md px-1 py-0.5 text-micro font-black text-primary outline-none placeholder:text-primary/25 border border-primary/10"
        />

        <div className="shrink-0 flex items-center gap-1">
          {onEliminar && (
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({
                  title: "Eliminar elemento",
                  message: `¿Eliminar "${local.nombre}" de la tabla? Esta acción no se puede deshacer.`,
                });
                if (ok) onEliminar(elemento.id);
              }}
              className="flex items-center justify-center w-6 h-6 rounded-md border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all cursor-pointer"
              title="Eliminar"
            >
              <Trash2 size={11} />
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              persist({
                nombre: local.nombre,
                simbolo: local.simbolo,
                familia: local.familia,
                estado: local.estado,
                es_noble: local.es_noble,
                notas: local.notas,
                nucleo: local.nucleo,
                media: local.media,
                externa: local.externa,
              })
            }
            className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            <Save size={10} />
            {saving ? "…" : "Guardar"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 p-2.5 flex flex-col gap-3 overflow-y-auto">
        {/* Metadatos */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-0.5">
            <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
              N° atómico
            </label>
            <input
              type="number"
              value={local.numero_atomico}
              onChange={(e) =>
                setLocal((p) => ({ ...p, numero_atomico: Number(e.target.value) }))
              }
              onBlur={() => persist({ numero_atomico: local.numero_atomico })}
              className="bg-primary/5 rounded-md px-2 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
              Familia
            </label>
            <select
              value={local.familia}
              onChange={(e) => {
                const familia = e.target.value as ElementFamily;
                setLocal((p) => ({ ...p, familia }));
                persist({ familia });
              }}
              className="bg-primary/5 rounded-md px-2 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30"
            >
              {ELEMENT_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
              Estado
            </label>
            <select
              value={local.estado ?? ""}
              onChange={(e) => {
                const estado = (e.target.value || null) as EstadoElemento | null;
                setLocal((p) => ({ ...p, estado }));
                persist({ estado });
              }}
              className="bg-primary/5 rounded-md px-2 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30"
            >
              <option value="">—</option>
              {ESTADOS_ELEMENTO.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
              Noble
            </label>
            <button
              type="button"
              onClick={() => {
                const es_noble = !local.es_noble;
                setLocal((p) => ({ ...p, es_noble }));
                persist({ es_noble });
              }}
              className={`rounded-md px-2 py-1 text-micro font-bold outline-none border transition-all cursor-pointer truncate ${
                local.es_noble
                  ? "bg-primary text-btn-text border-primary"
                  : "bg-primary/5 text-primary/50 border-primary/10 hover:border-primary/30"
              }`}
            >
              {local.es_noble ? "Sí" : "No"}
            </button>
          </div>
        </div>

        {/* Descripción auto-generada: se recalcula sola a partir de
            familia + capas + estado, sin campo manual que mantener. */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/25">
              Rol
            </p>
            {dominantes.length > 0 && (
              <span
                title="Partícula(s) dominante(s)"
                className="text-micro font-bold text-accent/70 bg-accent/10 rounded px-1.5 py-0.5"
              >
                {dominantes.map((d) => d.particula).join(" / ")}
              </span>
            )}
          </div>
          <div className="rounded-lg border border-primary/10 bg-primary/[0.02] px-2 py-1.5 flex flex-col gap-1">
            <p className="text-micro font-black text-primary/70">{descripcion.rol}</p>
            <p className="text-micro text-primary/50 leading-relaxed">{descripcion.texto}</p>
          </div>
        </div>

        {/* Notas */}
        <div className="flex flex-col gap-0.5">
          <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
            Notas
          </label>
          <textarea
            value={local.notas ?? ""}
            onChange={(e) => setLocal((p) => ({ ...p, notas: e.target.value }))}
            onBlur={() => persist({ notas: local.notas })}
            rows={2}
            placeholder="Descripción del elemento…"
            className="bg-primary/5 rounded-md px-2 py-1 text-micro text-primary outline-none border border-primary/10 focus:border-primary/30 resize-none placeholder:text-primary/25"
          />
        </div>

        {/* Capas: filas apiladas en vez de 3 tarjetas con borde propio —
            un solo contenedor con separadores finos entre filas, para
            aprovechar mejor el ancho del panel lateral. */}
        <div className="flex flex-col gap-1.5">
          <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/25">
            Capas atómicas
          </p>
          <div className="rounded-lg border border-primary/10 overflow-hidden">
            {(["nucleo", "media", "externa"] as LayerName[]).map((layer, i) => (
              <div
                key={layer}
                className={`flex items-center gap-1.5 px-2 py-1.5 ${
                  i > 0 ? "border-t border-primary/10" : ""
                } bg-primary/[0.02]`}
              >
                <span className="shrink-0 w-6 text-micro font-black text-primary/35">
                  {LAYER_LABEL[layer].slice(0, 1)}
                </span>
                <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1">
                  {PARTICLE_TYPES.map((particle) => {
                    const value = local[layer]?.[particle] ?? 0;
                    return (
                      <div
                        key={particle}
                        className="shrink-0 flex items-center gap-1 bg-primary/5 rounded-md pl-1.5 pr-0.5 py-0.5 border border-primary/10 focus-within:border-primary/30"
                      >
                        <span className="text-micro font-bold text-primary/45 whitespace-nowrap">
                          {particle}
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={value}
                          onChange={(e) =>
                            setLayerValue(layer, particle, Math.max(0, Number(e.target.value)))
                          }
                          onBlur={() => persist({ [layer]: local[layer] } as Partial<Elemento>)}
                          className="w-7 shrink-0 text-center bg-transparent text-micro font-bold text-primary outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Afinidad con el resto de la tabla — mismo cálculo que entre
            compuestos, pero comparando elementos sueltos entre sí. */}
        {todosLosElementos && todosLosElementos.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-1 text-micro font-black uppercase tracking-[0.2em] text-primary/25">
              <Sparkles size={10} />
              Afinidad con otros elementos
            </p>
            <div className="flex flex-col gap-1">
              {afinidades.map(({ elemento: otro, afinidad }) => (
                <div
                  key={otro.id}
                  className={`flex flex-col gap-0.5 px-2 py-1.5 rounded-md border ${AFINIDAD_COLOR[afinidad.tipo]}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-micro font-black truncate">
                      {otro.simbolo || "??"} · {otro.nombre}
                    </span>
                    <span className="shrink-0 text-micro font-black uppercase tracking-wide">
                      {AFINIDAD_LABEL[afinidad.tipo]}
                    </span>
                  </div>
                  <p className="text-micro opacity-80 leading-snug">{afinidad.motivo}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
