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
  pathPreviewSeparador,
  type TipoSeparador,
} from "./separadores";
import { SelectorFormaLimite } from "./public/SelectorFormaLimite";
import type { ConfigRunas } from "./useConfigRunas";

export function PanelConfigRunas({
  config,
  onActualizar,
}: {
  config: ConfigRunas;
  onActualizar: (updates: Partial<ConfigRunas>) => void;
}) {
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
  const [editando, setEditando] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  const trazoActual = trazoCustom ?? PLANTILLAS_SEPARADOR_DEFAULT[tipo];
  const esCustom = trazoCustom !== null;

  if (editando) {
    return (
      <div className="col-span-2 rounded-xl border border-primary/20 p-2 space-y-2">
        <p className="text-micro font-black text-center text-primary/50">
          {SIMBOLO_SEPARADOR[tipo]} {LABEL_SEPARADOR[tipo]}
        </p>
        <CanvasDibujoRuna
          height={140}
          resetSignal={resetSignal}
          trazoInicial={trazoActual}
          onTrazoCompleto={(puntos) => {
            onChange(puntos);
            setEditando(false);
          }}
        />
        <div className="flex items-center justify-center gap-3 text-micro">
          <button
            type="button"
            className="text-primary/40 hover:text-primary font-black uppercase tracking-widest"
            onClick={() => setResetSignal((s) => s + 1)}
          >
            Limpiar
          </button>
          <button
            type="button"
            className="text-primary/40 hover:text-primary font-black uppercase tracking-widest"
            onClick={() => setEditando(false)}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      className="flex flex-col items-center gap-1 rounded-xl border border-primary/15 hover:border-primary/40 p-2 transition-colors"
    >
      <svg viewBox="0 0 100 100" className="w-12 h-12">
        <polyline
          points={pathPreviewSeparador(trazoActual)}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-micro font-black text-primary/50">
        {LABEL_SEPARADOR[tipo]}
      </span>
      {esCustom && (
        <span
          className="flex items-center gap-0.5 text-[9px] text-primary/30 hover:text-red-400"
          onClick={(e) => {
            e.stopPropagation();
            onChange(null);
          }}
        >
          <RotateCcw size={8} /> Original
        </span>
      )}
    </button>
  );
}
