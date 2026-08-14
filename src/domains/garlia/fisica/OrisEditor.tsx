"use client";

/**
 * OrisEditor.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Detalle editable de un Oris: nombre, familia, fórmula, dominio y
 * descripción. Mismo patrón de guardado que ElementoEditor (debounce al
 * perder foco / al cambiar selects, update directo a Supabase).
 */

import { ChevronLeft, Minus, Plus, Save, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";
import { useConfirm } from "@/ui/ConfirmModal";

import { LetrasVisual } from "./ParticulaVisual";
import { IUMS, ORIS_CONFIG, ORIS_FAMILIAS, contarLetrasDeOris, type Oris, type OrisFamilia } from "./types";

interface Props {
  oris: Oris;
  onBack: () => void;
  onActualizar: (id: string, cambios: Partial<Oris>) => void;
  onEliminar?: (id: string) => void;
  /** Cuando se renderiza dentro de la vista de familia (varios apilados):
   *  oculta el botón "volver" individual, ya que ahí se vuelve una sola vez
   *  desde el header de la familia. */
  embedded?: boolean;
}

export function OrisEditor({ oris, onBack, onActualizar, onEliminar, embedded }: Props) {
  const { confirm, ConfirmModal } = useConfirm();
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState(oris);

  useEffect(() => setLocal(oris), [oris]);

  const iumsComposicion = local.iums_composicion ?? {};
  const conteoLetras = useMemo(() => contarLetrasDeOris(iumsComposicion), [iumsComposicion]);

  function cambiarCantidadIum(iumId: string, delta: number) {
    const actual = iumsComposicion[iumId] ?? 0;
    const siguiente = Math.max(0, actual + delta);
    const nuevaComposicion = { ...iumsComposicion };
    if (siguiente === 0) {
      delete nuevaComposicion[iumId];
    } else {
      nuevaComposicion[iumId] = siguiente;
    }
    setLocal((p) => ({ ...p, iums_composicion: nuevaComposicion }));
    void persist({ iums_composicion: nuevaComposicion });
  }

  async function persist(cambios: Partial<Oris>) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from(ORIS_CONFIG.tabla)
        .update(cambios)
        .eq("id", oris.id);
      if (error) throw error;
      onActualizar(oris.id, cambios);
    } catch (e) {
      console.error("[OrisEditor] error guardando:", e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <ConfirmModal />
      <div
        style={{ background: "var(--bg-main)" }}
        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 border-b border-primary/10"
      >
        {!embedded && (
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
          >
            <ChevronLeft size={12} />
          </button>
        )}

        <span className="shrink-0 text-micro font-black uppercase tracking-widest text-primary/30 px-1.5 py-0.5 rounded border border-primary/15">
          #{local.orden}
        </span>

        <input
          value={local.nombre ?? ""}
          onChange={(e) => setLocal((p) => ({ ...p, nombre: e.target.value }))}
          onBlur={() => persist({ nombre: local.nombre })}
          placeholder="Nombre del Oris"
          className="flex-1 min-w-0 bg-transparent text-micro font-black text-primary outline-none placeholder:text-primary/25"
        />

        <div className="shrink-0 flex items-center gap-1">
          {onEliminar && (
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({
                  title: "Eliminar Oris",
                  message: `¿Eliminar "${local.nombre}"? Esta acción no se puede deshacer.`,
                });
                if (ok) onEliminar(oris.id);
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
                familia: local.familia,
                formula: local.formula,
                dominio: local.dominio,
                descripcion: local.descripcion,
              })
            }
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wide bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            <Save size={10} />
            {saving ? "…" : "Guardar"}
          </button>
        </div>
      </div>

      <div className={`flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto ${embedded ? "p-2" : "p-2.5"}`}>
        <div className="flex flex-col sm:flex-row gap-3 items-center sm:items-start p-2.5 rounded-lg border border-primary/10 bg-primary/[0.02]">
          <div className="shrink-0 flex flex-col items-center gap-1">
            <LetrasVisual conteo={conteoLetras} size={110} />
            <span className="text-micro text-primary/30">
              {conteoLetras.A + conteoLetras.T + conteoLetras.S === 0
                ? "Sin Iums"
                : `${conteoLetras.A}A · ${conteoLetras.T}T · ${conteoLetras.S}S`}
            </span>
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-1.5 w-full">
            <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
              Composición (Iums)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {IUMS.map((ium) => {
                const cantidad = iumsComposicion[ium.id] ?? 0;
                return (
                  <div
                    key={ium.id}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-left transition-all ${
                      cantidad > 0
                        ? "border-primary/25 bg-primary/5"
                        : "border-primary/10 bg-transparent"
                    }`}
                  >
                    <span className="flex-1 min-w-0 text-micro font-bold text-primary truncate">
                      {ium.nombre}
                    </span>
                    <button
                      type="button"
                      onClick={() => cambiarCantidadIum(ium.id, -1)}
                      disabled={cantidad === 0}
                      className="flex items-center justify-center w-4 h-4 rounded text-primary/40 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <Minus size={9} />
                    </button>
                    <span className="w-3 text-center text-micro font-black text-primary tabular-nums">
                      {cantidad}
                    </span>
                    <button
                      type="button"
                      onClick={() => cambiarCantidadIum(ium.id, 1)}
                      className="flex items-center justify-center w-4 h-4 rounded text-primary/40 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                    >
                      <Plus size={9} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={`grid grid-cols-1 gap-2 ${embedded ? "" : "sm:grid-cols-3"}`}>
          <div className="flex flex-col gap-0.5">
            <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
              Familia
            </label>
            <select
              value={local.familia}
              onChange={(e) => {
                const familia = e.target.value as OrisFamilia;
                setLocal((p) => ({ ...p, familia }));
                persist({ familia });
              }}
              className="bg-primary/5 rounded-md px-2 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30"
            >
              {ORIS_FAMILIAS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
              Fórmula (texto libre)
            </label>
            <input
              value={local.formula ?? ""}
              onChange={(e) => setLocal((p) => ({ ...p, formula: e.target.value }))}
              onBlur={() => persist({ formula: local.formula })}
              placeholder="ej. 2 Pondus + 1 Tensia (solo lore, no afecta el gráfico)"
              className="bg-primary/5 rounded-md px-2 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30 placeholder:text-primary/25"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
              Dominio
            </label>
            <input
              value={local.dominio ?? ""}
              onChange={(e) => setLocal((p) => ({ ...p, dominio: e.target.value }))}
              onBlur={() => persist({ dominio: local.dominio })}
              placeholder="ej. Peso y gravedad"
              className="bg-primary/5 rounded-md px-2 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30 placeholder:text-primary/25"
            />
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
            Descripción
          </label>
          <textarea
            value={local.descripcion ?? ""}
            onChange={(e) => setLocal((p) => ({ ...p, descripcion: e.target.value }))}
            onBlur={() => persist({ descripcion: local.descripcion })}
            rows={4}
            placeholder="Notas adicionales sobre este Oris…"
            className="bg-primary/5 rounded-md px-2 py-1 text-micro text-primary outline-none border border-primary/10 focus:border-primary/30 resize-none placeholder:text-primary/25"
          />
        </div>
      </div>
    </div>
  );
}
