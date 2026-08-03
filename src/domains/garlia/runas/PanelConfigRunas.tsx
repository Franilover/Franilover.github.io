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
import React, { useCallback, useMemo, useState } from "react";

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
  // Estado puramente local, solo para TESTEAR cómo se ve un separador en un
  // gap del preview — nunca se guarda en Supabase ni pisa `plantillas_separadores`.
  // Si el admin sale de la pestaña o recarga, se pierde (a propósito).
  const [gapActivoId, setGapActivoId] = useState<string | null>(null);
  const [separadorPorGapTest, setSeparadorPorGapTest] = useState<
    Record<string, TipoSeparador | undefined>
  >({});
  const [plantillasAbiertas, setPlantillasAbiertas] = useState(false);

  // Preview de la combinación que se está editando en EditorCombinacionesRunas
  // (al lado). Este tablero es el único que renderiza runas + separadores;
  // el editor de combinaciones solo tiene los selectores.
  const [previewCombinacion, setPreviewCombinacion] = useState<{
    celdaRunaIds: Record<string, string>;
    separadorPorGap: Record<string, TipoSeparador | undefined>;
  } | null>(null);
  const onCambiarPreview = useCallback(
    (preview: typeof previewCombinacion) => setPreviewCombinacion(preview),
    [],
  );

  const runasPorId = useMemo(() => new Map(runas.map((r) => [r.id, r])), [runas]);
  const runaPorCelda = useMemo(() => {
    if (!previewCombinacion) return {};
    const mapa: Record<string, EntidadMagica | null | undefined> = {};
    for (const [celdaId, runaId] of Object.entries(previewCombinacion.celdaRunaIds)) {
      mapa[celdaId] = runasPorId.get(runaId) ?? null;
    }
    return mapa;
  }, [previewCombinacion, runasPorId]);

  // Mientras se edita una combinación, el tablero muestra sus separadores;
  // si no, sigue disponible el modo de prueba libre de separadorPorGapTest.
  const separadorPorGapMostrado = previewCombinacion
    ? previewCombinacion.separadorPorGap
    : separadorPorGapTest;

  return (
    <div className="rounded-2xl border border-primary/15 bg-white-custom/60 p-4 space-y-5">
      <div className="flex items-center gap-1.5 text-micro font-black uppercase tracking-[0.3em] text-primary/40">
        <Settings2 size={12} /> Config del tablero
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-3">
          <div className="flex justify-center">
            <div className="w-full max-w-[220px]">
              <TableroCeldas
                forma={config.forma}
                rejilla={config.rejilla}
                celdaActivaId={null}
                runaPorCelda={runaPorCelda}
                onSeleccionarCelda={() => {}}
                gapActivoId={gapActivoId}
                separadorPorGap={separadorPorGapMostrado}
                onSeleccionarGap={(gap) =>
                  setGapActivoId((actual) => (actual === gap.id ? null : gap.id))
                }
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <SelectorFormaLimite
              value={config.forma}
              onChange={(forma) => onActualizar({ forma })}
            />
          </div>

          <div className="space-y-1.5 pt-1">
            {!previewCombinacion && gapActivoId ? (
              <div className="flex items-center justify-center gap-2">
                {TIPOS_SEPARADOR.map((tipo) => {
                  const activo = separadorPorGapMostrado[gapActivoId] === tipo;
                  return (
                    <button
                      key={tipo}
                      type="button"
                      title={LABEL_SEPARADOR[tipo]}
                      onClick={() =>
                        setSeparadorPorGapTest((prev) => ({
                          ...prev,
                          [gapActivoId]: tipo,
                        }))
                      }
                      className="flex flex-col items-center gap-0.5 w-14 py-1.5 rounded-xl border transition-all"
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
            ) : !previewCombinacion ? (
              <p className="text-micro text-primary/25 text-center">
                Tocá un gap del tablero de arriba para elegir su separador
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5 pt-1">
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

          <div className="space-y-1.5 pt-1">
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

        <div className="space-y-3 sm:border-l sm:border-primary/10 sm:pl-5">
          <p className="flex items-center gap-1.5 text-micro font-black uppercase tracking-widest text-primary/30">
            <Sparkles size={11} /> Combinaciones
          </p>
          <EditorCombinacionesRunas
            runas={runas}
            rejilla={config.rejilla}
            onCambiarPreview={onCambiarPreview}
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
