"use client";

/**
 * PanelConfigRunas.tsx
 * ──────────────────────
 * Panel de admin para la config global de runas:
 *   1. Rejilla oficial (secciones × anillos) y forma exterior — antes
 *      era un selector libre que el jugador manejaba en la página
 *      pública; ahora lo fija el admin acá y el jugador solo dibuja.
 *   2. Plantillas de trazo de los 4 separadores (⟩⟩ ⟩ ⟨ |). Vienen con
 *      un trazo de fábrica (ver separadores.ts) pero el admin puede
 *      redibujar cualquiera de los 4 acá, con el mismo canvas que usa
 *      PanelPatronRuna para las runas.
 *
 * Vive en RunasPage.tsx, junto a las demás herramientas globales del
 * sistema de runas (probador, combinaciones).
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/magia/PanelConfigRunas.tsx
 */

import { ChevronDown, RotateCcw, Settings2, Sparkles } from "lucide-react";
import React, { useRef, useState } from "react";

import { CanvasDibujoRuna } from "./CanvasDibujoRuna";
import type { Punto } from "./dollarOneRecognizer";
import { EditorCombinacionesRunas } from "./EditorCombinacionesRunas";
import { MAX_ANILLOS, MAX_SECCIONES, MIN_ANILLOS, MIN_SECCIONES } from "./formasLimite";
import {
  LABEL_SEPARADOR,
  PLANTILLAS_SEPARADOR_DEFAULT,
  SIMBOLO_SEPARADOR,
  TIPOS_SEPARADOR,
  type TipoSeparador,
} from "./separadores";
import { SelectorFormaLimite } from "./public/SelectorFormaLimite";
import { TableroCeldas } from "./public/TableroCeldas";
import type { EntidadMagica } from "./types";
import type { ConfigRunas } from "./useConfigRunas";

export function PanelConfigRunas({
  config,
  onActualizar,
  runas,
}: {
  config: ConfigRunas;
  onActualizar: (updates: Partial<ConfigRunas>) => void;
  /** Catálogo de runas, para el selector "runa por celda" de combinaciones. */
  runas: EntidadMagica[];
}) {
  // Gap activo compartido entre los dos tableros (izquierda: "Forma
  // exterior"; derecha: preview dentro de Combinaciones) y estado en vivo
  // de la combinación que se está editando a la derecha — así ambos
  // tableros muestran y editan exactamente los mismos separadores.
  const [gapActivoId, setGapActivoId] = useState<string | null>(null);
  const [estadoCombinacionActiva, setEstadoCombinacionActiva] = useState<{
    celdas: Record<string, string>;
    separadores: Record<string, TipoSeparador>;
  } | null>(null);
  const asignarSeparadorRef = useRef<((gapId: string, tipo: TipoSeparador | null) => void) | null>(
    null,
  );
  const [plantillasAbiertas, setPlantillasAbiertas] = useState(false);

  const separadorPorGap: Record<string, TipoSeparador | undefined> =
    estadoCombinacionActiva?.separadores ?? {};
  const hayCombinacionActiva = estadoCombinacionActiva !== null;

  const runasPorId = React.useMemo(() => new Map(runas.map((r) => [r.id, r])), [runas]);
  const runaPorCeldaActiva: Record<string, EntidadMagica | null | undefined> = React.useMemo(() => {
    if (!estadoCombinacionActiva) return {};
    const mapa: Record<string, EntidadMagica | null | undefined> = {};
    for (const [celdaId, runaId] of Object.entries(estadoCombinacionActiva.celdas)) {
      mapa[celdaId] = runasPorId.get(runaId) ?? null;
    }
    return mapa;
  }, [estadoCombinacionActiva, runasPorId]);

  return (
    <div className="rounded-2xl border border-primary/15 bg-white-custom/60 p-4 space-y-5">
      <div className="flex items-center gap-1.5 text-micro font-black uppercase tracking-[0.3em] text-primary/40">
        <Settings2 size={12} /> Config del tablero
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-3">
          <p className="text-micro font-black uppercase tracking-widest text-primary/30">
            Forma exterior
          </p>
          <SelectorFormaLimite
            value={config.forma}
            onChange={(forma) => onActualizar({ forma })}
          />
          <div className="flex justify-center">
            <div className="w-full max-w-[220px]">
              <TableroCeldas
                forma={config.forma}
                rejilla={config.rejilla}
                celdaActivaId={null}
                runaPorCelda={runaPorCeldaActiva}
                onSeleccionarCelda={() => {}}
                gapActivoId={gapActivoId}
                separadorPorGap={separadorPorGap}
                onSeleccionarGap={(gap) =>
                  setGapActivoId((actual) => (actual === gap.id ? null : gap.id))
                }
              />
            </div>
          </div>
          <p className="text-micro text-primary/30 text-center">
            {hayCombinacionActiva
              ? "Vinculado a la combinación que estás editando a la derecha: runas y separadores se ven acá."
              : "Elegí una combinación en el panel de la derecha para ver y editar sus separadores acá."}
          </p>
          {gapActivoId && (
            <div className="flex items-center justify-center gap-2 pt-1">
              {TIPOS_SEPARADOR.map((tipo) => {
                const activo = separadorPorGap[gapActivoId] === tipo;
                return (
                  <button
                    key={tipo}
                    type="button"
                    title={LABEL_SEPARADOR[tipo]}
                    disabled={!hayCombinacionActiva}
                    onClick={() =>
                      asignarSeparadorRef.current?.(gapActivoId, activo ? null : tipo)
                    }
                    className="flex flex-col items-center gap-0.5 w-14 py-1.5 rounded-xl border transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      background: activo
                        ? "var(--primary)"
                        : "color-mix(in srgb, var(--primary) 6%, transparent)",
                      borderColor: activo
                        ? "var(--primary)"
                        : "color-mix(in srgb, var(--primary) 20%, transparent)",
                      color: activo ? "var(--btn-text)" : "var(--primary)",
                    }}
                  >
                    <span className="text-sm font-black leading-none">
                      {SIMBOLO_SEPARADOR[tipo]}
                    </span>
                    <span className="text-[8px] font-bold uppercase tracking-wide leading-none">
                      {LABEL_SEPARADOR[tipo]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-micro font-black uppercase tracking-widest text-primary/30">
                {config.rejilla.secciones === 1
                  ? "1 sección"
                  : `${config.rejilla.secciones} secciones`}
              </label>
              <input
                className="w-full accent-[var(--primary)]"
                max={MAX_SECCIONES}
                min={MIN_SECCIONES}
                type="range"
                value={config.rejilla.secciones}
                onChange={(e) =>
                  onActualizar({
                    rejilla: { ...config.rejilla, secciones: Number(e.target.value) },
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-micro font-black uppercase tracking-widest text-primary/30">
                {config.rejilla.anillos === 1
                  ? "1 anillo"
                  : `${config.rejilla.anillos} anillos`}
              </label>
              <input
                className="w-full accent-[var(--primary)]"
                max={MAX_ANILLOS}
                min={MIN_ANILLOS}
                type="range"
                value={config.rejilla.anillos}
                onChange={(e) =>
                  onActualizar({
                    rejilla: { ...config.rejilla, anillos: Number(e.target.value) },
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 sm:border-l sm:border-primary/10 sm:pl-5">
          <p className="flex items-center gap-1.5 text-micro font-black uppercase tracking-widest text-primary/30">
            <Sparkles size={11} /> Combinaciones
          </p>
          <EditorCombinacionesRunas
            runas={runas}
            rejilla={config.rejilla}
            gapActivoId={gapActivoId}
            onSeleccionarGap={setGapActivoId}
            onEstadoEdicionChange={setEstadoCombinacionActiva}
            asignarSeparadorRef={asignarSeparadorRef}
          />
        </div>
      </div>

      <div className="border-t border-primary/10 pt-3">
        <button
          type="button"
          onClick={() => setPlantillasAbiertas((v) => !v)}
          className="w-full flex items-center justify-between gap-2"
        >
          <span className="text-micro font-black uppercase tracking-widest text-primary/30">
            Plantillas de separador
          </span>
          <ChevronDown
            size={14}
            className="text-primary/30 transition-transform"
            style={{ transform: plantillasAbiertas ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>
        {plantillasAbiertas && (
          <div className="space-y-3 pt-3">
            <p className="text-micro text-primary/30 -mt-1">
              El jugador dibuja uno de estos 4 símbolos sobre cada línea que
              separa dos celdas de un anillo. Redibujá cualquiera para
              cambiar cómo se reconoce.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {TIPOS_SEPARADOR.map((tipo) => (
                <PlantillaSeparadorItem
                  key={tipo}
                  tipo={tipo}
                  trazoCustom={config.plantillas_separadores?.[tipo]?.[0] ?? null}
                  onChange={(trazo) => {
                    const actuales = { ...(config.plantillas_separadores ?? {}) };
                    if (trazo) actuales[tipo] = [trazo];
                    else delete actuales[tipo];
                    onActualizar({ plantillas_separadores: actuales });
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlantillaSeparadorItem({
  tipo,
  trazoCustom,
  onChange,
}: {
  tipo: TipoSeparador;
  trazoCustom: Punto[] | null;
  onChange: (trazo: Punto[] | null) => void;
}) {
  const [resetSignal, setResetSignal] = useState(0);

  const trazoActual = trazoCustom ?? PLANTILLAS_SEPARADOR_DEFAULT[tipo];
  const esCustom = trazoCustom !== null;

  return (
    <div className="rounded-xl border border-primary/15 p-2 space-y-2">
      <p className="text-micro font-black text-center text-primary/50">
        {SIMBOLO_SEPARADOR[tipo]} {LABEL_SEPARADOR[tipo]}
      </p>
      <CanvasDibujoRuna
        height={140}
        resetSignal={resetSignal}
        trazoInicial={trazoActual}
        onTrazoCompleto={(puntos) => onChange(puntos)}
      />
      <div className="flex items-center justify-center gap-3 text-micro">
        <button
          type="button"
          className="text-primary/40 hover:text-primary font-black uppercase tracking-widest"
          onClick={() => setResetSignal((s) => s + 1)}
        >
          Limpiar
        </button>
        {esCustom && (
          <button
            type="button"
            className="flex items-center gap-0.5 text-primary/40 hover:text-red-400 font-black uppercase tracking-widest"
            onClick={() => {
              onChange(null);
              setResetSignal((s) => s + 1);
            }}
          >
            <RotateCcw size={9} /> Original
          </button>
        )}
      </div>
    </div>
  );
}
