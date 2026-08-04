"use client";

/**
 * PanelConfigRunas.tsx
 * ──────────────────────
 * Panel de admin para la config global de runas:
 *   1. Tablero de forma/rejilla — ya no hay una rejilla oficial única:
 *      cada combinación define la suya propia (ver types.ts,
 *      EditorCombinacionesRunas.tsx). Este tablero es un preview
 *      de solo lectura de la combinación en edición (al lado); los
 *      controles reales de forma/secciones/anillos viven en
 *      EditorCombinacionesRunas.tsx, junto al resto del form de esa
 *      combinación. Si no hay ninguna combinación en edición, el
 *      tablero muestra un aviso en vez de un círculo vacío.
 *   2. Plantillas de trazo de los 4 separadores (⟩⟩ ⟩ ⟨ |). Vienen con
 *      un trazo de fábrica (ver separadores.ts) pero el admin puede
 *      redibujar cualquiera de los 4 acá, con el mismo canvas que usa
 *      PanelPatronRuna para las runas. Esto sigue siendo global (no hay
 *      "un separador por combinación").
 *
 * Vive en RunasPage.tsx, junto a las demás herramientas globales del
 * sistema de runas (probador, combinaciones).
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/magia/PanelConfigRunas.tsx
 */

import { ChevronDown, RotateCcw } from "lucide-react";
import React, { useMemo, useState } from "react";

import { CanvasDibujoRuna } from "./CanvasDibujoRuna";
import type { Punto } from "./dollarOneRecognizer";
import { FORMA_CIRCULO, labelForma as labelFormaCorta, REJILLA_SIMPLE, type FormaLimite, type Rejilla } from "./formasLimite";
import {
  LABEL_SEPARADOR,
  PLANTILLAS_SEPARADOR_DEFAULT,
  SIMBOLO_SEPARADOR,
  TIPOS_SEPARADOR,
  type TipoSeparador,
} from "./separadores";
import { TableroCeldas } from "./public/TableroCeldas";
import type { EntidadMagica } from "./types";
import type { ConfigRunas } from "./useConfigRunas";

export type PreviewCombinacion = {
  forma: FormaLimite;
  rejilla: Rejilla;
  celdaRunaIds: Record<string, string>;
  separadorPorGap: Record<string, TipoSeparador | undefined>;
} | null;

export function PanelConfigRunas({
  config,
  onActualizar,
  runas,
  previewCombinacion,
}: {
  config: ConfigRunas;
  onActualizar: (updates: Partial<ConfigRunas>) => void;
  /** Catálogo de runas, para el selector "runa por celda" de combinaciones. */
  runas: EntidadMagica[];
  /**
   * Preview de la combinación en edición (levantado al padre para que el
   * editor de combinaciones, ahora en otra columna, pueda escribirlo).
   * `null` cuando no hay ninguna combinación en edición — en ese caso el
   * tablero muestra un aviso en vez de un círculo vacío editable.
   */
  previewCombinacion: PreviewCombinacion;
}) {
  const [plantillasAbiertas, setPlantillasAbiertas] = useState(false);

  const runasPorId = useMemo(() => new Map(runas.map((r) => [r.id, r])), [runas]);
  const runaPorCelda = useMemo(() => {
    if (!previewCombinacion) return {};
    const mapa: Record<string, EntidadMagica | null | undefined> = {};
    for (const [celdaId, runaId] of Object.entries(previewCombinacion.celdaRunaIds)) {
      mapa[celdaId] = runasPorId.get(runaId) ?? null;
    }
    return mapa;
  }, [previewCombinacion, runasPorId]);

  const separadorPorGap = previewCombinacion?.separadorPorGap ?? {};
  const formaPreview = previewCombinacion?.forma ?? FORMA_CIRCULO;
  const rejillaPreview = previewCombinacion?.rejilla ?? REJILLA_SIMPLE;
  const hayComboEnEdicion = previewCombinacion !== null;

  return (
    <div className="rounded-2xl border border-primary/15 bg-white-custom/60 p-4 space-y-5">
      <div className="space-y-3">
        <div className="flex justify-center">
          <div className="w-full max-w-[340px]">
            <TableroCeldas
              forma={formaPreview}
              rejilla={rejillaPreview}
              celdaActivaId={null}
              runaPorCelda={runaPorCelda}
              onSeleccionarCelda={() => {}}
              separadorPorGap={separadorPorGap}
            />
          </div>
        </div>

        {!hayComboEnEdicion ? (
          <p className="text-micro text-primary/30 text-center">
            Elegí una combinación para definir su forma
          </p>
        ) : (
          <p className="text-micro text-primary/30 text-center">
            {labelFormaCorta(formaPreview)} · {rejillaPreview.secciones}×
            {rejillaPreview.anillos}
          </p>
        )}
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
