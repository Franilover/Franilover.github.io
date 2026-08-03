"use client";

/**
 * BloqueProbadorYCombinaciones
 * ───────────────────────────────────────────────────────────────────────────
 * Antes: un único bloque con dos pestañas ("Probador" / "Config"), y
 * "Config" a su vez mostraba el tablero preview + el editor de
 * combinaciones lado a lado, todo apilado debajo del grid de runas.
 *
 * Ahora ese bloque se partió en dos piezas para poder distribuirlas en
 * las dos columnas de RunasPage:
 *
 *   - <SelectorProbadorConfig>  → los botones Probador/Config y el
 *     contenido del que esté activo (el probador $1, o el tablero
 *     preview de Config). Vive en la columna 1.
 *   - <PanelCombinacionesRunas> → el editor de combinaciones en sí
 *     (antes la mitad derecha del panel de Config). Vive en la
 *     columna 2, y solo se muestra ahí cuando la sección activa es
 *     "config" (si no, esa columna la ocupa el subsistema seleccionado
 *     o el ensayo de energías).
 *
 * El estado de qué sección está activa, y el preview de la combinación
 * en edición, viven en el padre (RunasPage) para que ambas columnas
 * puedan compartirlos.
 */

import { Settings2, Wand2 } from "lucide-react";
import React from "react";

import { EditorCombinacionesRunas } from "./EditorCombinacionesRunas";
import { PanelConfigRunas, type PreviewCombinacion } from "./PanelConfigRunas";
import { PanelDetectorUnificado } from "./PanelDetectorUnificado";
import type { EntidadMagica } from "./types";
import type { ConfigRunas } from "./useConfigRunas";

export type SeccionProbadorConfig = "probador" | "config";

const SECCIONES: { key: SeccionProbadorConfig; label: string; Icon: React.ElementType }[] = [
  { key: "probador", label: "Probador", Icon: Wand2 },
  { key: "config", label: "Config", Icon: Settings2 },
];

/** Botones Probador/Config + el contenido de la sección activa. Columna 1. */
export function SelectorProbadorConfig({
  seccion,
  onCambiarSeccion,
  runas,
  configRunas,
  onActualizarConfigRunas,
  previewCombinacion,
}: {
  seccion: SeccionProbadorConfig;
  onCambiarSeccion: (seccion: SeccionProbadorConfig) => void;
  /** Catálogo completo de runas, para el probador y el tablero preview. */
  runas: EntidadMagica[];
  configRunas: ConfigRunas;
  onActualizarConfigRunas: (updates: Partial<ConfigRunas>) => void;
  previewCombinacion: PreviewCombinacion;
}) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1 px-2 py-2">
        {SECCIONES.map(({ key, label, Icon }) => {
          const activa = seccion === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onCambiarSeccion(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-micro font-bold uppercase tracking-[0.12em] transition-colors ${
                activa
                  ? "bg-primary/10 text-primary"
                  : "text-primary/40 hover:text-primary/70"
              }`}
            >
              <Icon size={11} />
              {label}
            </button>
          );
        })}
      </div>

      <div className="px-2 pb-2">
        {seccion === "probador" ? (
          <PanelDetectorUnificado runas={runas} />
        ) : (
          <PanelConfigRunas
            config={configRunas}
            onActualizar={onActualizarConfigRunas}
            runas={runas}
            previewCombinacion={previewCombinacion}
          />
        )}
      </div>
    </div>
  );
}

/**
 * El editor de combinaciones en sí — antes la mitad derecha de
 * PanelConfigRunas. Columna 2, solo mientras seccion === "config".
 */
export function PanelCombinacionesRunas({
  runas,
  onCambiarPreview,
}: {
  runas: EntidadMagica[];
  onCambiarPreview: React.ComponentProps<typeof EditorCombinacionesRunas>["onCambiarPreview"];
}) {
  return (
    <div className="rounded-2xl border border-primary/15 bg-white-custom/60 p-4">
      <p className="text-micro font-black uppercase tracking-widest text-primary/30 text-center mb-3">
        Combinaciones
      </p>
      <EditorCombinacionesRunas runas={runas} onCambiarPreview={onCambiarPreview} />
    </div>
  );
}
