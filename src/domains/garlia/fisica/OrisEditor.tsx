"use client";

/**
 * OrisEditor.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Detalle editable de un Oris: nombre, familia, dominio y descripción,
 * más la composición de Iums (solo lectura, se edita a mano en la base de
 * datos). Mismo patrón de guardado que ElementoEditor (debounce al perder
 * foco / al cambiar selects, update directo a Supabase).
 */

import { ChevronLeft, Save, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";
import { useConfirm } from "@/ui/ConfirmModal";

import { IumVisual } from "./ParticulaVisual";
import { IUM_POR_ID, ORIS_CONFIG, ORIS_FAMILIAS, particulasDeOris, type Oris, type OrisFamilia } from "./types";

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
  const particulasOris = useMemo(() => particulasDeOris(iumsComposicion), [iumsComposicion]);
  // Lista de solo-lectura de los Iums presentes en la composición (con su
  // cantidad) — ya no hay selectores +/- para editarla a mano: la fuente
  // de verdad es la Fórmula de texto, iums_composicion se sincroniza desde
  // ahí (ver migración de Oris). Ordenados por cantidad desc, luego nombre.
  const iumsPresentes = useMemo(
    () =>
      Object.entries(iumsComposicion)
        .filter(([, cantidad]) => cantidad > 0)
        .map(([iumId, cantidad]) => ({ ium: IUM_POR_ID[iumId], cantidad }))
        .filter((x) => x.ium)
        .sort((a, b) => b.cantidad - a.cantidad || a.ium.nombre.localeCompare(b.ium.nombre)),
    [iumsComposicion],
  );

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
        <div className="flex flex-col items-center gap-3 p-3 rounded-lg border border-primary/10 bg-primary/[0.02]">
          <IumVisual particulas={particulasOris} size={240} />

          {iumsPresentes.length === 0 ? (
            <span className="text-micro text-primary/30">Sin Iums en la composición</span>
          ) : (
            <div className="flex flex-wrap justify-center gap-1.5">
              {iumsPresentes.map(({ ium, cantidad }) => (
                <span
                  key={ium.id}
                  className="flex items-center gap-1 px-2 py-1 rounded-md border border-primary/15 bg-primary/5 text-micro font-bold text-primary"
                >
                  {cantidad > 1 && <span className="text-primary/40">{cantidad}×</span>}
                  {ium.nombre}
                </span>
              ))}
            </div>
          )}
          <span className="text-micro text-primary/25 text-center">
            Composición fija — se editó a mano en la base de datos.
          </span>
        </div>

        <div className={`grid grid-cols-1 gap-2 ${embedded ? "" : "sm:grid-cols-2"}`}>
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
