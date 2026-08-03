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
import React, { useEffect, useMemo, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import {
  FORMA_CIRCULO,
  centroCelda,
  generarCeldas,
  generarGaps,
  labelCelda,
  pathCelda,
  puntosGap,
  type Celda,
  type Gap,
  type Rejilla,
} from "./formasLimite";
import { PickerImagenRunaBtn } from "./PickerImagenRunaBtn";
import { RunaThumbnail } from "./RunaThumbnail";
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
  gapActivoId = null,
  onSeleccionarGap,
  onEstadoEdicionChange,
  asignarSeparadorRef,
}: {
  runas: EntidadMagica[];
  /** Misma rejilla que "Forma exterior" — acá no hay selector propio. */
  rejilla: Rejilla;
  /**
   * Gap actualmente activo (seleccionado desde el tablero de "Forma
   * exterior", a la izquierda) — controlado desde el padre para que
   * ambos tableros resalten el mismo gap.
   */
  gapActivoId?: string | null;
  onSeleccionarGap?: (gapId: string | null) => void;
  /**
   * Notifica al padre el estado en vivo de la combinación que se está
   * editando (celdas + separadores), para que el tablero de la izquierda
   * pueda mostrar los mismos separadores sin duplicar el form acá.
   * Se llama con `null` cuando no hay ninguna combinación en edición.
   */
  onEstadoEdicionChange?: (estado: { celdas: Record<string, string>; separadores: Record<string, TipoSeparador> } | null) => void;
  /**
   * El padre recibe acá una función para asignar separador a un gap
   * directamente sobre la combinación en edición — así el tablero de la
   * izquierda edita el mismo estado que el panel de combinaciones, sin
   * que ninguno de los dos posea "la verdad" por separado.
   */
  asignarSeparadorRef?: React.MutableRefObject<((gapId: string, tipo: TipoSeparador | null) => void) | null>;
}) {
  const [combinaciones, setCombinaciones] = useState<CombinacionRuna[]>([]);
  const [loading, setLoading] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!editando) onEstadoEdicionChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando?.id]);

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
          gapActivoId={gapActivoId}
          onSeleccionarGap={onSeleccionarGap}
          onEstadoEdicionChange={onEstadoEdicionChange}
          asignarSeparadorRef={asignarSeparadorRef}
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
  gapActivoId = null,
  onSeleccionarGap,
  onEstadoEdicionChange,
  asignarSeparadorRef,
  onGuardada,
  onEliminada,
}: {
  combinacion: CombinacionRuna;
  rejilla: Rejilla;
  runas: EntidadMagica[];
  gapActivoId?: string | null;
  onSeleccionarGap?: (gapId: string | null) => void;
  onEstadoEdicionChange?: (estado: { celdas: Record<string, string>; separadores: Record<string, TipoSeparador> } | null) => void;
  asignarSeparadorRef?: React.MutableRefObject<((gapId: string, tipo: TipoSeparador | null) => void) | null>;
  onGuardada: (c: CombinacionRuna) => void;
  onEliminada: (id: string) => void;
}) {
  const [form, setForm] = useState<CombinacionRuna>(combinacion);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setForm(combinacion);
  }, [combinacion.id]);

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

  // Expone asignarSeparadorAGap al padre (vía ref) para que el tablero de
  // "Forma exterior", a la izquierda, pueda editar el mismo estado sin que
  // este componente deje de ser quien lo posee.
  useEffect(() => {
    if (asignarSeparadorRef) asignarSeparadorRef.current = asignarSeparadorAGap;
    return () => {
      if (asignarSeparadorRef) asignarSeparadorRef.current = null;
    };
  });

  // Notifica al padre el estado en vivo (celdas + separadores) cada vez
  // que cambia, para que el tablero izquierdo se mantenga sincronizado.
  useEffect(() => {
    onEstadoEdicionChange?.({ celdas: form.celdas, separadores: form.separadores ?? {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.celdas, form.separadores]);


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

      <TableroCombinacion
        celdas={celdas}
        gaps={gaps}
        rejilla={rejilla}
        celdaRunaIds={form.celdas}
        separadorPorGap={form.separadores ?? {}}
        runas={runas}
        gapActivoId={gapActivoId}
        onSeleccionarGap={(gapId) => onSeleccionarGap?.(gapId === gapActivoId ? null : gapId)}
      />

      <div className="space-y-1.5">
        <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35">
          Runa por celda
        </label>
        {celdas.map((celda) => (
          <div key={celda.id} className="flex items-center gap-2">
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
        ))}
      </div>

      {gaps.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35">
            Separador por gap
          </label>
          <p className="text-micro text-primary/25">
            Cada separador distinto cuenta como una combinación distinta con las mismas runas.
          </p>
          {gaps.map((gap) => (
            <div
              key={gap.id}
              className="flex items-center gap-2 -mx-1 px-1 py-0.5 rounded-lg transition-colors"
              style={{
                background:
                  gap.id === gapActivoId
                    ? "color-mix(in srgb, var(--primary) 10%, transparent)"
                    : "transparent",
              }}
            >
              <span className="text-micro text-primary/40 w-32 shrink-0 truncate">
                {labelGap(gap, rejilla)}
              </span>
              <select
                className="flex-1 min-w-0 bg-primary/3 rounded-lg px-2 py-1.5 text-xs text-primary outline-none"
                value={form.separadores?.[gap.id] ?? ""}
                onFocus={() => onSeleccionarGap?.(gap.id)}
                onChange={(e) => {
                  asignarSeparadorAGap(gap.id, (e.target.value as TipoSeparador) || null);
                  onSeleccionarGap?.(gap.id);
                }}
              >
                <option value="">— cualquiera / sin exigir —</option>
                {TIPOS_SEPARADOR.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {SIMBOLO_SEPARADOR[tipo]} {LABEL_SEPARADOR[tipo]}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

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

/**
 * TableroCombinacion
 * ────────────────────
 * Vista previa del tablero (círculo dividido en celdas según `rejilla`,
 * igual que en la página pública) donde cada celda muestra el trazo
 * (RunaThumbnail) de la runa que se le asignó en el <select> de abajo.
 * Puramente visual — el estado sigue viviendo en `form.celdas` del
 * padre; esto solo lee `celdaRunaIds` para renderizar el preview.
 */
const TAMANO_TABLERO = 220;
const MARGEN_TABLERO = 14;

function TableroCombinacion({
  celdas,
  gaps,
  rejilla,
  celdaRunaIds,
  separadorPorGap,
  runas,
  gapActivoId = null,
  onSeleccionarGap,
}: {
  celdas: Celda[];
  gaps: Gap[];
  rejilla: Rejilla;
  /** Mapa celdaId → runaId, tal como se guarda en la combinación. */
  celdaRunaIds: Record<string, string>;
  /** Mapa gapId → separador exigido, tal como se guarda en la combinación. */
  separadorPorGap: Record<string, TipoSeparador | undefined>;
  runas: EntidadMagica[];
  gapActivoId?: string | null;
  onSeleccionarGap?: (gapId: string) => void;
}) {
  const runasPorId = useMemo(() => new Map(runas.map((r) => [r.id, r])), [runas]);

  const centro = { x: TAMANO_TABLERO / 2, y: TAMANO_TABLERO / 2 };
  const radio = TAMANO_TABLERO / 2 - MARGEN_TABLERO;

  // Tamaño del thumbnail de trazo dentro de cada celda: más chico cuanto
  // más celdas hay, para que no se pisen entre sí en rejillas densas.
  const ladoThumb = Math.max(24, Math.min(60, radio / Math.max(1, rejilla.anillos + 1)));

  return (
    <div className="flex flex-col items-center gap-1.5 py-1">
      <svg
        viewBox={`0 0 ${TAMANO_TABLERO} ${TAMANO_TABLERO}`}
        className="w-full max-w-[220px] aspect-square"
        role="img"
        aria-label="Vista previa del tablero de la combinación"
      >
        <circle
          cx={centro.x}
          cy={centro.y}
          r={radio}
          fill="none"
          stroke="color-mix(in srgb, var(--primary) 15%, transparent)"
          strokeWidth={1.5}
        />

        {celdas.map((celda) => {
          const runaId = celdaRunaIds[celda.id];
          const runa = runaId ? runasPorId.get(runaId) : undefined;
          const puntos = pathCelda(celda, FORMA_CIRCULO, centro, radio);
          const centroCeldaPos = centroCelda(celda, FORMA_CIRCULO, centro, radio);

          return (
            <g key={celda.id}>
              <polygon
                points={puntos}
                fill={
                  runa
                    ? "color-mix(in srgb, var(--primary) 10%, transparent)"
                    : "color-mix(in srgb, var(--primary) 3%, transparent)"
                }
                stroke="color-mix(in srgb, var(--primary) 18%, transparent)"
                strokeWidth={1}
              >
                <title>{labelCelda(celda, rejilla)}</title>
              </polygon>

              {runa?.patron_trazos && (
                <g
                  transform={`translate(${(centroCeldaPos.x - ladoThumb / 2).toFixed(1)},${(centroCeldaPos.y - ladoThumb / 2).toFixed(1)})`}
                  className="pointer-events-none"
                >
                  <foreignObject width={ladoThumb} height={ladoThumb}>
                    <RunaThumbnail patronTrazos={runa.patron_trazos} />
                  </foreignObject>
                </g>
              )}
            </g>
          );
        })}

        {gaps.map((gap) => {
          const tipo = separadorPorGap[gap.id];
          const activo = gap.id === gapActivoId;
          const { interior, exterior } = puntosGap(gap, FORMA_CIRCULO, centro, radio);
          return (
            <g key={gap.id}>
              {/* Línea invisible más gruesa solo para agrandar el área clickeable */}
              <line
                x1={interior.x}
                y1={interior.y}
                x2={exterior.x}
                y2={exterior.y}
                stroke="transparent"
                strokeWidth={14}
                className={onSeleccionarGap ? "cursor-pointer" : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeleccionarGap?.(gap.id);
                }}
              />
              {activo && (
                <line
                  x1={interior.x}
                  y1={interior.y}
                  x2={exterior.x}
                  y2={exterior.y}
                  stroke="var(--primary)"
                  strokeWidth={4}
                  strokeLinecap="round"
                  className="pointer-events-none"
                />
              )}
              {tipo && (
                <GlifoSeparadorPreview tipo={tipo} interior={interior} exterior={exterior} />
              )}
            </g>
          );
        })}
      </svg>
      <p className="text-micro text-primary/25 text-center">
        Vista previa — el trazo y los separadores se actualizan al elegir abajo
      </p>
    </div>
  );
}

/**
 * Glifo vectorial de un separador (⟩⟩ ⟩ ⟨ |), escalado para cubrir todo
 * el gap entre `interior` y `exterior`. Copia reducida (solo lectura,
 * sin interacción) del mismo dibujo que usa TableroCeldas.tsx en la
 * página pública — se duplica acá en vez de importarse desde /public
 * para no acoplar el editor de admin a ese módulo.
 */
function GlifoSeparadorPreview({
  tipo,
  interior,
  exterior,
}: {
  tipo: TipoSeparador;
  interior: { x: number; y: number };
  exterior: { x: number; y: number };
}) {
  const dx = exterior.x - interior.x;
  const dy = exterior.y - interior.y;
  const largo = Math.hypot(dx, dy);
  const anguloGrados = (Math.atan2(dy, dx) * 180) / Math.PI - 90;
  const medio = { x: (interior.x + exterior.x) / 2, y: (interior.y + exterior.y) / 2 };
  const mitadLargo = largo / 2;
  const ancho = Math.min(9, largo * 0.16);

  return (
    <g
      transform={`translate(${medio.x.toFixed(1)},${medio.y.toFixed(1)}) rotate(${anguloGrados.toFixed(1)}) scale(${ancho.toFixed(2)},${mitadLargo.toFixed(2)})`}
      className="pointer-events-none"
    >
      <path
        d={GLIFO_PATH_PREVIEW[tipo]}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

const GLIFO_PATH_PREVIEW: Record<TipoSeparador, string> = {
  corta: "M 0 -1 L 0 1",
  continua: "M 0.7 -1 L -0.7 0 L 0.7 1",
  continua_inv: "M -0.7 -1 L 0.7 0 L -0.7 1",
  inicio: "M 0.7 -1 L -0.7 -0.35 L 0.7 0.3 M 0.7 0.05 L -0.7 0.7 L 0.7 1",
};
