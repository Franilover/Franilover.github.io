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

import { ChevronLeft, Save, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";
import { useConfirm } from "@/ui/ConfirmModal";

import {
  ELEMENT_FAMILIES,
  LAYER_LABEL,
  PARTICLE_TYPES,
  type Elemento,
  type ElementFamily,
  type LayerName,
  type ParticleMap,
} from "./types";

interface Props {
  elemento: Elemento;
  onBack: () => void;
  onActualizar: (id: string, cambios: Partial<Elemento>) => void;
  onEliminar?: (id: string) => void;
}

export function ElementoEditor({ elemento, onBack, onActualizar, onEliminar }: Props) {
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

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <ConfirmModal />
      {/* Header */}
      <div
        style={{ background: "var(--bg-main)" }}
        className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-primary/10"
      >
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
        >
          <ChevronLeft size={14} />
        </button>

        <span className="shrink-0 text-micro font-black uppercase tracking-widest text-primary/30 px-1.5 py-0.5 rounded border border-primary/15">
          #{local.numero_atomico}
        </span>

        <input
          value={local.nombre ?? ""}
          onChange={(e) => setLocal((p) => ({ ...p, nombre: e.target.value }))}
          onBlur={() => persist({ nombre: local.nombre })}
          placeholder="Nombre del elemento"
          className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
        />

        <input
          value={local.simbolo ?? ""}
          onChange={(e) => setLocal((p) => ({ ...p, simbolo: e.target.value }))}
          onBlur={() => persist({ simbolo: local.simbolo })}
          placeholder="Sm"
          maxLength={3}
          className="shrink-0 w-14 text-center bg-primary/5 rounded-lg px-2 py-1 text-xs font-black text-primary outline-none placeholder:text-primary/25 border border-primary/10"
        />

        <div className="shrink-0 flex items-center gap-1.5">
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
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all cursor-pointer"
            >
              <Trash2 size={11} />
              <span className="hidden md:inline">Eliminar</span>
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
                es_noble: local.es_noble,
                notas: local.notas,
                nucleo: local.nucleo,
                media: local.media,
                externa: local.externa,
              })
            }
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            <Save size={11} />
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 p-3 flex flex-col gap-4 overflow-y-auto">
        {/* Metadatos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/30">
              Número atómico
            </label>
            <input
              type="number"
              value={local.numero_atomico}
              onChange={(e) =>
                setLocal((p) => ({ ...p, numero_atomico: Number(e.target.value) }))
              }
              onBlur={() => persist({ numero_atomico: local.numero_atomico })}
              className="bg-primary/5 rounded-lg px-2.5 py-1.5 text-sm font-bold text-primary outline-none border border-primary/10 focus:border-primary/30"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/30">
              Familia
            </label>
            <select
              value={local.familia}
              onChange={(e) => {
                const familia = e.target.value as ElementFamily;
                setLocal((p) => ({ ...p, familia }));
                persist({ familia });
              }}
              className="bg-primary/5 rounded-lg px-2.5 py-1.5 text-sm font-bold text-primary outline-none border border-primary/10 focus:border-primary/30"
            >
              {ELEMENT_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/30">
              Noble
            </label>
            <button
              type="button"
              onClick={() => {
                const es_noble = !local.es_noble;
                setLocal((p) => ({ ...p, es_noble }));
                persist({ es_noble });
              }}
              className={`rounded-lg px-2.5 py-1.5 text-sm font-bold outline-none border transition-all cursor-pointer ${
                local.es_noble
                  ? "bg-primary text-btn-text border-primary"
                  : "bg-primary/5 text-primary/50 border-primary/10 hover:border-primary/30"
              }`}
            >
              {local.es_noble ? "Sí, es noble" : "No es noble"}
            </button>
          </div>
        </div>

        {/* Notas */}
        <div className="flex flex-col gap-1">
          <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/30">
            Notas
          </label>
          <textarea
            value={local.notas ?? ""}
            onChange={(e) => setLocal((p) => ({ ...p, notas: e.target.value }))}
            onBlur={() => persist({ notas: local.notas })}
            rows={2}
            placeholder="Descripción del elemento…"
            className="bg-primary/5 rounded-lg px-2.5 py-1.5 text-sm text-primary outline-none border border-primary/10 focus:border-primary/30 resize-none placeholder:text-primary/25"
          />
        </div>

        {/* Capas */}
        <div className="flex flex-col gap-3">
          <p className="text-micro font-black uppercase tracking-[0.28em] text-primary/25">
            Capas atómicas
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(["nucleo", "media", "externa"] as LayerName[]).map((layer) => (
              <div
                key={layer}
                className="rounded-xl border border-primary/10 bg-primary/[0.03] p-3 flex flex-col gap-2"
              >
                <p className="text-micro font-black uppercase tracking-widest text-primary/40">
                  {LAYER_LABEL[layer]}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {PARTICLE_TYPES.map((particle) => {
                    const value = local[layer]?.[particle] ?? 0;
                    return (
                      <div key={particle} className="flex items-center gap-1.5">
                        <span className="flex-1 min-w-0 truncate text-[10px] font-bold text-primary/50">
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
                          className="w-12 shrink-0 text-center bg-primary/5 rounded-md px-1 py-0.5 text-xs font-bold text-primary outline-none border border-primary/10 focus:border-primary/30"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
