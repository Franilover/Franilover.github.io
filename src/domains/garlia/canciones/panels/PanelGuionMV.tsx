"use client";

import {
  Film,
  Plus,
  Loader2,
  Check,
  Clock,
  Pencil,
  Trash2,
} from "lucide-react";
import React, { useState, useEffect, useCallback, useMemo } from "react";

import { useConfirm } from "@/components/ui/ConfirmModal";
import {
  TIPO_ESCENA_LABEL,
  TIPO_ESCENA_COLOR,
} from "@/domains/garlia/canciones/constants";
import {
  fmtTimeSeg,
  parseTimeSeg,
} from "@/domains/garlia/canciones/karaokeUtils";
import type {
  EscenaMV,
  Seccion,
  IdiomaKey,
} from "@/domains/garlia/canciones/types";
import { supabase } from "@/lib/api/client/supabase";

export const PanelGuionMV = ({
  cancionId,
  secciones,
  idiomaActivo,
  guionInicial,
  onGuionChange,
}: {
  cancionId: string;
  secciones: Seccion[];
  idiomaActivo: IdiomaKey;
  guionInicial: EscenaMV[] | null | undefined;
  onGuionChange: (g: EscenaMV[]) => void;
}) => {
  const [guion, setGuion] = useState<EscenaMV[]>(guionInicial || []);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formTs, setFormTs] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTipo, setFormTipo] = useState<EscenaMV["tipo"]>("escena");
  const [formOpen, setFormOpen] = useState(false);
  const { confirm, ConfirmModal } = useConfirm();

  useEffect(() => {
    setGuion(guionInicial || []);
    setEditId(null);
    setFormOpen(false);
  }, [cancionId]);

  const timestampsDisponibles = useMemo((): number[] => {
    const timingKey = `timings_${idiomaActivo}` as keyof Seccion;
    const allTimes = new Set<number>();
    for (const sec of secciones) {
      const timings = sec[timingKey] as
        | Record<string, number>
        | null
        | undefined;
      if (timings) {
        Object.values(timings).forEach((t) =>
          allTimes.add(Math.round(t * 10) / 10),
        );
      }
    }
    return Array.from(allTimes).sort((a, b) => a - b);
  }, [secciones, idiomaActivo]);

  const saveGuion = useCallback(
    async (nuevoGuion: EscenaMV[]) => {
      setSaving(true);
      try {
        const sorted = [...nuevoGuion].sort(
          (a, b) => a.timestamp_seg - b.timestamp_seg,
        );
        const { error } = await supabase
          .from("canciones")
          .update({ guion_mv: sorted })
          .eq("id", cancionId);
        if (error) throw error;
        setGuion(sorted);
        onGuionChange(sorted);
      } catch (e) {
        console.error("PanelGuionMV save:", e);
      }
      setSaving(false);
    },
    [cancionId, onGuionChange],
  );

  const handleSubmit = async () => {
    const tsRaw = parseTimeSeg(formTs);
    if (tsRaw === null || !formDesc.trim()) return;

    const nuevaEscena: EscenaMV = {
      id:
        editId || `mv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp_seg: tsRaw,
      descripcion: formDesc.trim(),
      tipo: formTipo,
    };

    const nuevoGuion = editId
      ? guion.map((e) => (e.id === editId ? nuevaEscena : e))
      : [...guion, nuevaEscena];

    await saveGuion(nuevoGuion);
    resetForm();
  };

  const handleEdit = (escena: EscenaMV) => {
    setEditId(escena.id);
    setFormTs(fmtTimeSeg(escena.timestamp_seg));
    setFormDesc(escena.descripcion);
    setFormTipo(escena.tipo);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      message: "¿Eliminar esta escena del guion?",
      danger: true,
    });
    if (!ok) return;
    await saveGuion(guion.filter((e) => e.id !== id));
  };

  const resetForm = () => {
    setEditId(null);
    setFormTs("");
    setFormDesc("");
    setFormTipo("escena");
    setFormOpen(false);
  };

  const handleTimestampClick = (ts: number) => {
    const existing = guion.find((e) => Math.abs(e.timestamp_seg - ts) < 0.5);
    if (existing) {
      handleEdit(existing);
      return;
    }
    setFormTs(fmtTimeSeg(ts));
    setEditId(null);
    setFormOpen(true);
  };

  const guionOrdenado = [...guion].sort(
    (a, b) => a.timestamp_seg - b.timestamp_seg,
  );
  const tsConEscena = new Set(guion.map((e) => Math.round(e.timestamp_seg)));

  return (
    <div className="px-8 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-micro font-black uppercase tracking-[0.3em] text-primary/35 flex items-center gap-1.5">
            <Film size={10} /> Guion del MV
          </p>
          <p className="text-micro text-primary/20 font-bold uppercase tracking-widest mt-0.5">
            {guion.length > 0
              ? `${guion.length} escena${guion.length !== 1 ? "s" : ""} · vinculadas a timestamps del karaoke`
              : "Escenas del MV vinculadas a momentos de la canción"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <Loader2 className="animate-spin text-primary/30" size={12} />
          )}
          <button
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-bg-main rounded-xl text-micro font-black uppercase tracking-widest hover:opacity-90 transition-all"
            onClick={() => {
              resetForm();
              setFormOpen(true);
            }}
          >
            <Plus size={11} /> Añadir escena
          </button>
        </div>
      </div>

      {/* Timestamps disponibles del karaoke */}
      {timestampsDisponibles.length > 0 && (
        <div className="space-y-2">
          <p className="text-micro font-black uppercase tracking-[0.3em] text-primary/25">
            Timestamps del karaoke — clic para añadir o editar escena
          </p>
          <div className="flex flex-wrap gap-1.5">
            {timestampsDisponibles.map((ts) => {
              const tienEscena = tsConEscena.has(Math.round(ts));
              return (
                <button
                  key={ts}
                  className={`font-mono text-micro font-black px-2.5 py-1 rounded-lg border transition-all ${
                    tienEscena
                      ? "bg-primary/20 text-primary border-primary/40 hover:bg-primary/30"
                      : "bg-primary/5 text-primary/40 border-primary/15 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                  }`}
                  onClick={() => handleTimestampClick(ts)}
                >
                  {fmtTimeSeg(ts)}
                  {tienEscena && <span className="ml-1 text-micro">✦</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {timestampsDisponibles.length === 0 && guion.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-primary/20 border border-dashed border-primary/10 rounded-xl">
          <Film size={36} strokeWidth={1} />
          <div className="text-center space-y-1">
            <p className="text-micro font-black uppercase tracking-widest">
              Sin escenas aún
            </p>
            <p className="text-micro font-bold uppercase tracking-widest opacity-60">
              Añade marcas de tiempo en el karaoke para usarlas como referencia,
              <br />o crea escenas manualmente con cualquier momento de la
              canción.
            </p>
          </div>
        </div>
      )}

      {/* Formulario */}
      {formOpen && (
        <div className="border border-primary/15 rounded-xl bg-primary/3 p-4 space-y-3">
          <p className="text-micro font-black uppercase tracking-[0.3em] text-primary/40">
            {editId ? "Editar escena" : "Nueva escena"}
          </p>

          <div className="flex gap-3 items-end flex-wrap">
            <div className="space-y-1.5 w-28">
              <label className="text-micro font-black uppercase text-primary/30 tracking-widest">
                Tiempo
              </label>
              <div className="relative">
                <Clock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/30 pointer-events-none"
                  size={10}
                />
                <input
                  className="w-full bg-bg-main border border-primary/20 rounded-xl pl-8 pr-3 py-2.5 text-sm font-mono font-black text-primary outline-none focus:border-primary/40 transition-colors placeholder:text-primary/20"
                  placeholder="1:12"
                  value={formTs}
                  onChange={(e) => setFormTs(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5 flex-1 min-w-0">
              <label className="text-micro font-black uppercase text-primary/30 tracking-widest">
                Tipo
              </label>
              <div className="flex gap-1 flex-wrap">
                {(Object.keys(TIPO_ESCENA_LABEL) as EscenaMV["tipo"][]).map(
                  (t) => (
                    <button
                      key={t}
                      className={`px-2.5 py-1.5 rounded-lg text-micro font-black uppercase tracking-widest border transition-all ${
                        formTipo === t
                          ? ""
                          : "border-primary/10 text-primary/30 hover:border-primary/25 hover:text-primary/60"
                      }`}
                      style={formTipo === t ? TIPO_ESCENA_COLOR[t] : undefined}
                      type="button"
                      onClick={() => setFormTipo(t)}
                    >
                      {TIPO_ESCENA_LABEL[t]}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-micro font-black uppercase text-primary/30 tracking-widest">
              Descripción
            </label>
            <textarea
              className="w-full bg-bg-main border border-primary/15 rounded-xl px-4 py-3 text-sm text-primary resize-none outline-none transition-colors placeholder:text-primary/15 leading-relaxed focus:border-primary/30"
              placeholder={
                formTipo === "escena"
                  ? "La cámara abre en un plano aéreo de la ciudad de noche…"
                  : formTipo === "camara"
                    ? "Primer plano del personaje, zoom lento hacia sus ojos…"
                    : formTipo === "efecto"
                      ? "Glitch visual, la imagen se fragmenta en píxeles…"
                      : formTipo === "transicion"
                        ? "Corte rápido al siguiente escenario, flash blanco…"
                        : "El personaje aparece caminando hacia la cámara…"
              }
              rows={3}
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter")
                  void handleSubmit();
              }}
            />
          </div>

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <button
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-bg-main rounded-xl text-micro font-black uppercase tracking-widest disabled:opacity-40 hover:opacity-90 transition-all"
              disabled={
                !formDesc.trim() ||
                !formTs.trim() ||
                parseTimeSeg(formTs) === null
              }
              type="button"
              onClick={handleSubmit}
            >
              {saving ? (
                <Loader2 className="animate-spin" size={10} />
              ) : (
                <Check size={10} />
              )}
              {editId ? "Guardar cambios" : "Añadir escena"}
            </button>
            <button
              className="px-3 py-2 rounded-xl border border-primary/15 text-micro font-black uppercase text-primary/40 hover:text-primary hover:border-primary/30 transition-all"
              type="button"
              onClick={resetForm}
            >
              Cancelar
            </button>
            <p className="text-micro text-primary/20 font-bold uppercase tracking-widest">
              Ctrl+Enter para guardar
            </p>
          </div>
        </div>
      )}

      {/* Lista de escenas */}
      {guionOrdenado.length > 0 && (
        <div className="space-y-2">
          {guionOrdenado.map((escena) => (
            <div
              key={escena.id}
              className="group flex gap-3 items-start p-3 rounded-xl border border-primary/8 hover:border-primary/15 bg-bg-main/40 hover:bg-bg-main/60 transition-all"
            >
              <div className="shrink-0 flex flex-col items-center gap-1.5 pt-0.5 min-w-[52px]">
                <span className="font-mono text-sm font-black text-primary tabular-nums">
                  {fmtTimeSeg(escena.timestamp_seg)}
                </span>
                <span
                  className="text-micro font-black uppercase px-1.5 py-0.5 rounded-md border whitespace-nowrap"
                  style={TIPO_ESCENA_COLOR[escena.tipo]}
                >
                  {TIPO_ESCENA_LABEL[escena.tipo]}
                </span>
              </div>

              <div className="w-px self-stretch bg-primary/8 shrink-0 mt-1" />

              <p className="flex-1 text-sm text-primary/70 leading-relaxed whitespace-pre-wrap min-w-0">
                {escena.descripcion}
              </p>

              <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  className="p-1.5 rounded-lg hover:bg-primary/10 text-primary/30 hover:text-primary transition-all"
                  onClick={() => handleEdit(escena)}
                >
                  <Pencil size={11} />
                </button>
                <button
                  className="p-1.5 rounded-lg hover:bg-[color-mix(in_srgb,var(--callout-danger-border)_10%,transparent)] text-primary/20 hover:text-[var(--callout-danger-border)] transition-all"
                  onClick={() => handleDelete(escena.id)}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal />
    </div>
  );
};
