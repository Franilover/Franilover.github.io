"use client";

/**
 * BloqueProbadorYCombinaciones
 * ───────────────────────────────────────────────────────────────────────────
 * Dos pestañas: "Probador" (test de reconocimiento $1) y "Config"
 * (config del tablero — forma/rejilla/separadores — más el editor de
 * combinaciones de runas, ambos apilados en esa misma pestaña).
 */

import { Settings2, Wand2 } from "lucide-react";
import React, { useState } from "react";

import { PanelConfigRunas } from "./PanelConfigRunas";
import { PanelTestFormaLibre } from "./PanelTestFormaLibre";
import { PanelTestReconocimiento } from "./PanelTestReconocimiento";
import type { EntidadMagica } from "./types";
import type { ConfigRunas } from "./useConfigRunas";

type Seccion = "probador" | "config";

const SECCIONES: { key: Seccion; label: string; Icon: React.ElementType }[] = [
  { key: "probador", label: "Probador", Icon: Wand2 },
  { key: "config", label: "Config", Icon: Settings2 },
];

export function BloqueProbadorYCombinaciones({
  runas,
  configRunas,
  onActualizarConfigRunas,
}: {
  /** Catálogo completo de runas, para el probador y el editor de combinaciones. */
  runas: EntidadMagica[];
  configRunas: ConfigRunas;
  onActualizarConfigRunas: (updates: Partial<ConfigRunas>) => void;
}) {
  const [seccion, setSeccion] = useState<Seccion>("probador");

  return (
    <div>
      <div className="flex items-center justify-center gap-1 px-2 py-2">
        {SECCIONES.map(({ key, label, Icon }) => {
          const activa = seccion === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSeccion(key)}
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
          <div className="space-y-6">
            <PanelTestReconocimiento runas={runas} trazosActuales={[]} />
            <div className="pt-4 border-t border-primary/10">
              <PanelTestFormaLibre />
            </div>
          </div>
        ) : (
          <PanelConfigRunas config={configRunas} onActualizar={onActualizarConfigRunas} runas={runas} />
        )}
      </div>
    </div>
  );
}
