"use client";

/**
 * EditorCombinacionesRunas.tsx
 * ────────────────────────────
 * Panel de admin para crear/editar "combinaciones" — hechizos compuestos
 * que se activan cuando el jugador dibuja runas específicas en celdas
 * específicas del tablero de /garlia/runas (ver formasLimite.ts: Rejilla/Celda).
 *
 * Cada combinación define su propia forma exterior y rejilla (secciones ×
 * anillos) — antes esto era una config global única que el admin fijaba
 * para todos los jugadores; ahora cada combinación arma su propio tablero,
 * porque distintos hechizos compuestos pueden necesitar formas distintas.
 *
 * Además define, por celda (identificada por su id estable "s{seccion}-a{anillo}",
 * independiente de la forma exterior elegida), qué runa debe estar
 * dibujada ahí, y opcionalmente, por gap (id estable "g{seccion}-a{anillo}"),
 * qué separador debe estar dibujado ahí. El match en la página pública es
 * exacto en todo (ver matchCombinacion.ts): misma forma+rejilla, mismas
 * celdas+runas Y mismos gaps+separadores, ni de más ni de menos.
 *
 * Vive al lado del tablero compartido en PanelConfigRunas: ese tablero
 * refleja siempre la forma+rejilla de la combinación en edición acá (vía
 * `onCambiarPreview`) — este componente ahora también trae su propio
 * selector de forma/rejilla, deshabilitado si no hay combinación elegida.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/magia/EditorCombinacionesRunas.tsx
 */

import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import Image from "next/image";
import React, { useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import {
  FORMA_CIRCULO,
  generarCeldas,
  generarGaps,
  labelCelda,
  MAX_ANILLOS,
  MAX_SECCIONES,
  MIN_ANILLOS,
  MIN_SECCIONES,
  REJILLA_SIMPLE,
  type FormaLimite,
  type Gap,
  type Rejilla,
} from "./formasLimite";
import { PickerImagenRunaBtn } from "./PickerImagenRunaBtn";
import { SelectorFormaLimite } from "./public/SelectorFormaLimite";
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
  onCambiarPreview,
}: {
  runas: EntidadMagica[];
  /**
   * Se llama en cada cambio de forma/rejilla/celdas/separadores de la
   * combinación en edición, para que el tablero compartido (en
   * PanelConfigRunas) la dibuje. `null` cuando no hay ninguna combinación
   * en edición.
   */
  onCambiarPreview: (preview: {
    forma: FormaLimite;
    rejilla: Rejilla;
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
        .select("id, nombre, explicacion, imagen_url, forma, rejilla, celdas, separadores")
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
      .insert([
        {
          nombre: "Nueva combinación",
          forma: FORMA_CIRCULO,
          rejilla: REJILLA_SIMPLE,
          celdas: {},
          separadores: {},
        },
      ])
      .select("id, nombre, explicacion, imagen_url, forma, rejilla, celdas, separadores")
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

/** Purga de un mapa celdaId/gapId → algo, las claves que no existen en la nueva rejilla. */
function purgarClavesHuerfanas<T>(
  mapa: Record<string, T>,
  idsValidos: Set<string>,
): Record<string, T> {
  const limpio: Record<string, T> = {};
  for (const [id, v] of Object.entries(mapa)) {
    if (idsValidos.has(id)) limpio[id] = v;
  }
  return limpio;
}

function EditorUnaCombinacion({
  combinacion,
  runas,
  onCambiarPreview,
  onGuardada,
  onEliminada,
}: {
  combinacion: CombinacionRuna;
  runas: EntidadMagica[];
  onCambiarPreview: (preview: {
    forma: FormaLimite;
    rejilla: Rejilla;
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
  // forma+rejilla+celdas+separadores de la combinación que se está
  // editando acá.
  useEffect(() => {
    onCambiarPreview({
      forma: form.forma,
      rejilla: form.rejilla,
      celdaRunaIds: form.celdas,
      separadorPorGap: form.separadores ?? {},
    });
  }, [form.forma, form.rejilla, form.celdas, form.separadores, onCambiarPreview]);

  const celdas = generarCeldas(form.rejilla);
  const gaps = generarGaps(form.rejilla);

  // Al cambiar secciones/anillos, purgamos celdas/gaps asignados que ya
  // no existen en la nueva rejilla (evita ids huérfanos tipo "s3-a2" si
  // ahora solo hay 2 secciones).
  const cambiarRejilla = (rejilla: Rejilla) => {
    setForm((f) => {
      const idsCeldasValidas = new Set(generarCeldas(rejilla).map((c) => c.id));
      const idsGapsValidos = new Set(generarGaps(rejilla).map((g) => g.id));
      return {
        ...f,
        rejilla,
        celdas: purgarClavesHuerfanas(f.celdas, idsCeldasValidas),
        separadores: purgarClavesHuerfanas(f.separadores ?? {}, idsGapsValidos),
      };
    });
  };

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
          forma: form.forma,
          rejilla: form.rejilla,
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

      <div className="space-y-2 border-t border-primary/10 pt-2">
        <p className="text-micro font-black uppercase tracking-widest text-primary/30 text-center">
          Forma de esta combinación
        </p>
        <SelectorFormaLimite
          value={form.forma}
          onChange={(forma) => setForm((f) => ({ ...f, forma }))}
        />

        <div className="space-y-1.5 pt-1">
          <label className="text-micro font-black uppercase tracking-widest text-primary/30">
            {form.rejilla.secciones === 1
              ? "1 sección"
              : `${form.rejilla.secciones} secciones`}
          </label>
          <input
            className="w-full accent-[var(--primary)]"
            max={MAX_SECCIONES}
            min={MIN_SECCIONES}
            type="range"
            value={form.rejilla.secciones}
            onChange={(e) =>
              cambiarRejilla({ ...form.rejilla, secciones: Number(e.target.value) })
            }
          />
        </div>

        <div className="space-y-1.5 pt-1">
          <label className="text-micro font-black uppercase tracking-widest text-primary/30">
            {form.rejilla.anillos === 1 ? "1 anillo" : `${form.rejilla.anillos} anillos`}
          </label>
          <input
            className="w-full accent-[var(--primary)]"
            max={MAX_ANILLOS}
            min={MIN_ANILLOS}
            type="range"
            value={form.rejilla.anillos}
            onChange={(e) => cambiarRejilla({ ...form.rejilla, anillos: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
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
                  {labelCelda(celda, form.rejilla)}
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
                    title={labelGap(gapSiguiente, form.rejilla)}
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

