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

import { RotateCcw, Settings2 } from "lucide-react";
import React, { useState } from "react";

import { CanvasDibujoRuna } from "./CanvasDibujoRuna";
import type { Punto } from "./dollarOneRecognizer";
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
import type { ConfigRunas } from "./useConfigRunas";

export function PanelConfigRunas({
  config,
  onActualizar,
}: {
  config: ConfigRunas;
  onActualizar: (updates: Partial<ConfigRunas>) => void;
}) {
  // Estado puramente local, solo para TESTEAR cómo se ve un separador en un
  // gap del preview — nunca se guarda en Supabase ni pisa `plantillas_separadores`.
  // Si el admin sale de la pestaña o recarga, se pierde (a propósito).
  const [gapActivoId, setGapActivoId] = useState<string | null>(null);
  const [separadorPorGapTest, setSeparadorPorGapTest] = useState<
    Record<string, TipoSeparador | undefined>
  >({});

  return (
    <div className="rounded-2xl border border-primary/15 bg-white-custom/60 p-4 space-y-5">
      <div className="flex items-center gap-1.5 text-micro font-black uppercase tracking-[0.3em] text-primary/40">
        <Settings2 size={12} /> Config del tablero
      </div>

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
              runaPorCelda={{}}
              onSeleccionarCelda={() => {}}
              gapActivoId={gapActivoId}
              separadorPorGap={separadorPorGapTest}
              onSeleccionarGap={(gap) =>
                setGapActivoId((actual) => (actual === gap.id ? null : gap.id))
              }
            />
          </div>
        </div>
        <p className="text-micro text-primary/30 text-center">
          Solo para probar cómo se ve — esto no guarda nada todavía.
        </p>
        {gapActivoId && (
          <div className="flex items-center justify-center gap-2 pt-1">
            {TIPOS_SEPARADOR.map((tipo) => {
              const activo = separadorPorGapTest[gapActivoId] === tipo;
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
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
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

      <div className="space-y-3 pt-1 border-t border-primary/10">
        <p className="text-micro font-black uppercase tracking-widest text-primary/30 pt-3">
          Plantillas de separador
        </p>
        <p className="text-micro text-primary/30 -mt-2">
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
