"use client";

/**
 * OrisEditor.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Detalle editable de un Oris: nombre, familia, fórmula, dominio y
 * descripción. Mismo patrón de guardado que ElementoEditor (debounce al
 * perder foco / al cambiar selects, update directo a Supabase).
 */

import { ChevronLeft, Save, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";
import { useConfirm } from "@/ui/ConfirmModal";

import { ORIS_CONFIG, ORIS_FAMILIAS, type Oris, type OrisFamilia } from "./types";

interface Props {
  oris: Oris;
  onBack: () => void;
  onActualizar: (id: string, cambios: Partial<Oris>) => void;
  onEliminar?: (id: string) => void;
}

export function OrisEditor({ oris, onBack, onActualizar, onEliminar }: Props) {
  const { confirm, ConfirmModal } = useConfirm();
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState(oris);

  useEffect(() => setLocal(oris), [oris]);

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
          #{local.orden}
        </span>

        <input
          value={local.nombre ?? ""}
          onChange={(e) => setLocal((p) => ({ ...p, nombre: e.target.value }))}
          onBlur={() => persist({ nombre: local.nombre })}
          placeholder="Nombre del Oris"
          className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
        />

        <div className="shrink-0 flex items-center gap-1.5">
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
                familia: local.familia,
                formula: local.formula,
                dominio: local.dominio,
                descripcion: local.descripcion,
              })
            }
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            <Save size={11} />
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-3 flex flex-col gap-4 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/30">
              Familia
            </label>
            <select
              value={local.familia}
              onChange={(e) => {
                const familia = e.target.value as OrisFamilia;
                setLocal((p) => ({ ...p, familia }));
                persist({ familia });
              }}
              className="bg-primary/5 rounded-lg px-2.5 py-1.5 text-sm font-bold text-primary outline-none border border-primary/10 focus:border-primary/30"
            >
              {ORIS_FAMILIAS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/30">
              Fórmula (Iums)
            </label>
            <input
              value={local.formula ?? ""}
              onChange={(e) => setLocal((p) => ({ ...p, formula: e.target.value }))}
              onBlur={() => persist({ formula: local.formula })}
              placeholder="ej. 2 Pondus + 1 Tensia"
              className="bg-primary/5 rounded-lg px-2.5 py-1.5 text-sm font-bold text-primary outline-none border border-primary/10 focus:border-primary/30 placeholder:text-primary/25"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/30">
              Dominio
            </label>
            <input
              value={local.dominio ?? ""}
              onChange={(e) => setLocal((p) => ({ ...p, dominio: e.target.value }))}
              onBlur={() => persist({ dominio: local.dominio })}
              placeholder="ej. Peso y gravedad"
              className="bg-primary/5 rounded-lg px-2.5 py-1.5 text-sm font-bold text-primary outline-none border border-primary/10 focus:border-primary/30 placeholder:text-primary/25"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/30">
            Descripción
          </label>
          <textarea
            value={local.descripcion ?? ""}
            onChange={(e) => setLocal((p) => ({ ...p, descripcion: e.target.value }))}
            onBlur={() => persist({ descripcion: local.descripcion })}
            rows={4}
            placeholder="Notas adicionales sobre este Oris…"
            className="bg-primary/5 rounded-lg px-2.5 py-1.5 text-sm text-primary outline-none border border-primary/10 focus:border-primary/30 resize-none placeholder:text-primary/25"
          />
        </div>
      </div>
    </div>
  );
}
