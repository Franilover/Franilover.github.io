"use client";

/**
 * EditorCombinacionesRunas.tsx
 * ────────────────────────────
 * Panel de admin para crear/editar "combinaciones" — hechizos compuestos
 * que se activan cuando el jugador dibuja runas específicas en celdas
 * específicas del tablero de /garlia/runas (ver formasLimite.ts: Rejilla/Celda).
 *
 * Cada combinación define, por celda (identificada por su id estable
 * "s{seccion}-a{anillo}", independiente de la forma exterior elegida por
 * el jugador), qué runa debe estar dibujada ahí, y opcionalmente, por gap
 * (id estable "g{seccion}-a{anillo}"), qué separador debe estar dibujado
 * ahí. El match en la página pública es exacto en ambos (ver
 * matchCombinacion.ts): mismas celdas+runas Y mismos gaps+separadores,
 * ni de más ni de menos — así, la misma runa en la misma celda puede dar
 * resultados distintos según qué separador se dibuje entre secciones.
 *
 * Vive al lado del bloque "Forma exterior" en PanelConfigRunas: comparte
 * esa misma `rejilla` (recibida por prop, sin selector propio acá) y ese
 * mismo tablero visual — este componente es solo: dropdown para elegir
 * qué combinación editar + nombre/descripción/runa-por-celda.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/magia/EditorCombinacionesRunas.tsx
 */

import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import Image from "next/image";
import React, { useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import { generarCeldas, generarGaps, labelCelda, type Gap, type Rejilla } from "./formasLimite";
import { PickerImagenRunaBtn } from "./PickerImagenRunaBtn";
import { LABEL_SEPARADOR, SIMBOLO_SEPARADOR, TIPOS_SEPARADOR, type TipoSeparador } from "./separadores";
import type { CombinacionRuna, EntidadMagica } from "./types";

/** Etiqueta legible corta de un gap: "Sección 1 → 2 (Anillo interior)". */
function labelGap(gap: Gap, rejilla: Rejilla): string {
  const seccionParte = `Sección ${gap.seccionAntes + 1} → ${gap.seccionDespues + 1}`;
  if (rejilla.anillos <= 1) return seccionParte;
  const anilloParte =
    gap.anillo === 0
      ? "Anillo interior"
      : gap.anillo === rejilla.anillos - 1
        ? "Anillo exterior"
        : `Anillo ${gap.anillo + 1}`;
  return `${seccionParte} (${anilloParte})`;
}

export function EditorCombinacionesRunas({
  runas,
  rejilla,
  onCambiarPreview,
}: {
  runas: EntidadMagica[];
  /** Misma rejilla que "Forma exterior" — acá no hay selector propio. */
  rejilla: Rejilla;
  /**
   * Se llama en cada cambio de celdas/separadores de la combinación en
   * edición, para que el tablero compartido (en PanelConfigRunas) la
   * dibuje. `null` cuando no hay ninguna combinación en edición.
   */
  onCambiarPreview: (preview: {
    celdaRunaIds: Record<string, string>;
    separadorPorGap: Record<string, TipoSeparador | undefined>;
  } | null) => void;
}) {
  const [combinaciones, setCombinaciones] = useState<CombinacionRuna[]>([]);
  const [loading, setLoading] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // Al dejar de editar (o desmontar), limpiar el preview del tablero compartido.
  useEffect(() => {
    if (!editandoId) onCambiarPreview(null);
  }, [editandoId, onCambiarPreview]);

  useEffect(() => {
    if (cargado) return;
    let activo = true;
    const cargarCombinaciones = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("combinaciones_runas")
        .select("id, nombre, explicacion, imagen_url, celdas, separadores")
        .order("nombre");
      if (!activo) return;
      if (!error && data) setCombinaciones(data as unknown as CombinacionRuna[]);
      setLoading(false);
      setCargado(true);
    };
    void cargarCombinaciones();
    return () => {
      activo = false;
    };
  }, [cargado]);

  const crear = async () => {
    const { data, error } = await supabase
      .from("combinaciones_runas")
      .insert([{ nombre: "Nueva combinación", celdas: {}, separadores: {} }])
      .select("id, nombre, explicacion, imagen_url, celdas, separadores")
      .single();
    if (error || !data) return;
    const nueva = data as unknown as CombinacionRuna;
    setCombinaciones((prev) => [nueva, ...prev]);
    setEditandoId(nueva.id);
  };

  const editando = combinaciones.find((c) => c.id === editandoId) ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="animate-spin text-primary/20" size={18} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select
          className="flex-1 min-w-0 bg-primary/3 rounded-lg px-2 py-1.5 text-xs text-primary outline-none"
          value={editandoId ?? ""}
          onChange={(e) => setEditandoId(e.target.value || null)}
        >
          <option value="">— elegir combinación —</option>
          {combinaciones.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} ({Object.keys(c.celdas ?? {}).length} celda
              {Object.keys(c.celdas ?? {}).length === 1 ? "" : "s"}
              {Object.keys(c.separadores ?? {}).length > 0
                ? `, ${Object.keys(c.separadores ?? {}).length} separador${Object.keys(c.separadores ?? {}).length === 1 ? "" : "es"}`
                : ""}
              )
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void crear()}
          title="Nueva combinación"
          className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-micro font-black uppercase tracking-widest text-primary shrink-0"
        >
          <Plus size={12} />
        </button>
      </div>

      {!editando && (
        <p className="text-micro text-primary/25 text-center py-3">
          {combinaciones.length === 0
            ? "Sin combinaciones definidas todavía"
            : "Elegí una combinación arriba para editarla"}
        </p>
      )}

      {editando && (
        <EditorUnaCombinacion
          combinacion={editando}
          rejilla={rejilla}
          runas={runas}
          onCambiarPreview={onCambiarPreview}
          onEliminada={(id) => {
            setCombinaciones((prev) => prev.filter((c) => c.id !== id));
            setEditandoId(null);
          }}
          onGuardada={(actualizada) => {
            setCombinaciones((prev) =>
              prev.map((c) => (c.id === actualizada.id ? actualizada : c)),
            );
          }}
        />
      )}
    </div>
  );
}

function EditorUnaCombinacion({
  combinacion,
  rejilla,
  runas,
  onCambiarPreview,
  onGuardada,
  onEliminada,
}: {
  combinacion: CombinacionRuna;
  rejilla: Rejilla;
  runas: EntidadMagica[];
  onCambiarPreview: (preview: {
    celdaRunaIds: Record<string, string>;
    separadorPorGap: Record<string, TipoSeparador | undefined>;
  } | null) => void;
  onGuardada: (c: CombinacionRuna) => void;
  onEliminada: (id: string) => void;
}) {
  const [form, setForm] = useState<CombinacionRuna>(combinacion);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setForm(combinacion);
  }, [combinacion.id]);

  // El tablero compartido (en PanelConfigRunas) refleja siempre la
  // combinación que se está editando acá.
  useEffect(() => {
    onCambiarPreview({
      celdaRunaIds: form.celdas,
      separadorPorGap: form.separadores ?? {},
    });
  }, [form.celdas, form.separadores, onCambiarPreview]);

  const celdas = generarCeldas(rejilla);
  const gaps = generarGaps(rejilla);

  const asignarRunaACelda = (celdaId: string, runaId: string | null) => {
    setForm((f) => {
      const nuevasCeldas = { ...f.celdas };
      if (runaId) nuevasCeldas[celdaId] = runaId;
      else delete nuevasCeldas[celdaId];
      return { ...f, celdas: nuevasCeldas };
    });
  };

  const asignarSeparadorAGap = (gapId: string, tipo: TipoSeparador | null) => {
    setForm((f) => {
      const nuevosSeparadores = { ...(f.separadores ?? {}) };
      if (tipo) nuevosSeparadores[gapId] = tipo;
      else delete nuevosSeparadores[gapId];
      return { ...f, separadores: nuevosSeparadores };
    });
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const { error } = await supabase
        .from("combinaciones_runas")
        .update({
          nombre: form.nombre,
          explicacion: form.explicacion || null,
          imagen_url: form.imagen_url || null,
          celdas: form.celdas,
          separadores: form.separadores ?? {},
        })
        .eq("id", form.id);
      if (!error) onGuardada(form);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    await supabase.from("combinaciones_runas").delete().eq("id", form.id);
    onEliminada(form.id);
  };

  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 min-w-0 bg-transparent text-sm font-bold text-primary outline-none border-b border-primary/10 pb-1 placeholder:text-primary/25"
          placeholder="Nombre de la combinación…"
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
        />
        <PickerImagenRunaBtn
          Icon={Sparkles}
          color="var(--primary)"
          value={form.imagen_url ?? ""}
          onChange={(url) => setForm((f) => ({ ...f, imagen_url: url }))}
        />
      </div>

      {form.imagen_url && (
        <div className="w-16 h-16 rounded-lg overflow-hidden border border-primary/10">
          <Image
            alt={form.nombre}
            className="w-full h-full object-cover"
            height={64}
            src={form.imagen_url}
            width={64}
          />
        </div>
      )}

      <textarea
        className="w-full bg-primary/3 rounded-lg p-2 text-xs text-primary/70 outline-none resize-none placeholder:text-primary/25"
        placeholder="Explicación del resultado compuesto…"
        rows={2}
        value={form.explicacion ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, explicacion: e.target.value }))}
      />

      <div className="space-y-1.5">
        <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35">
          Runa por celda
        </label>
        {celdas.map((celda) => {
          // Gap "siguiente" a esta celda dentro de su mismo anillo: el que
          // arranca en esta sección (seccionAntes === celda.seccion) — así
          // queda debajo de la runa, en el mismo orden en que se recorre el anillo.
          const gapSiguiente = gaps.find(
            (g) => g.anillo === celda.anillo && g.seccionAntes === celda.seccion,
          );

          return (
            <div key={celda.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-micro text-primary/40 w-32 shrink-0 truncate">
                  {labelCelda(celda, rejilla)}
                </span>
                <select
                  className="flex-1 min-w-0 bg-primary/3 rounded-lg px-2 py-1.5 text-xs text-primary outline-none"
                  value={form.celdas[celda.id] ?? ""}
                  onChange={(e) => asignarRunaACelda(celda.id, e.target.value || null)}
                >
                  <option value="">— vacía —</option>
                  {runas.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {gapSiguiente && (
                <div className="flex justify-center">
                  <select
                    title={labelGap(gapSiguiente, rejilla)}
                    className="w-[70%] min-w-0 bg-primary/8 border border-primary/15 rounded-lg px-2 py-1 text-micro text-primary/70 outline-none text-center"
                    value={form.separadores?.[gapSiguiente.id] ?? ""}
                    onChange={(e) =>
                      asignarSeparadorAGap(
                        gapSiguiente.id,
                        (e.target.value as TipoSeparador) || null,
                      )
                    }
                  >
                    <option value="">— sin separador —</option>
                    {TIPOS_SEPARADOR.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {SIMBOLO_SEPARADOR[tipo]} {LABEL_SEPARADOR[tipo]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => void eliminar()}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-micro font-black uppercase tracking-widest border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all"
        >
          <Trash2 size={10} /> Eliminar
        </button>
        <button
          type="button"
          disabled={guardando}
          onClick={() => void guardar()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
        >
          {guardando ? <Loader2 size={10} className="animate-spin" /> : null}
          Guardar
        </button>
      </div>
    </div>
  );
}

