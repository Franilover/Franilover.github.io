"use client";

/**
 * BloqueProbadorYCombinaciones
 * ───────────────────────────────────────────────────────────────────────────
 * Antes SubBloqueProbador y EditorCombinacionesRunas se mostraban lado a
 * lado, cada uno en su mitad. Ahora conviven como un solo bloque con un
 * selector de sección (pestañas) arriba, mostrando una sección a la vez —
 * estética más uniforme, sin dividir la pantalla en dos columnas.
 */

import { Settings2, Sparkles, Wand2 } from "lucide-react";
import React, { useState } from "react";

import { EditorCombinacionesRunas } from "./EditorCombinacionesRunas";
import { PanelConfigRunas } from "./PanelConfigRunas";
import { PanelTestReconocimiento } from "./PanelTestReconocimiento";
import type { EntidadMagica } from "./types";
import type { ConfigRunas } from "./useConfigRunas";

type Seccion = "probador" | "combinaciones" | "config";

const SECCIONES: { key: Seccion; label: string; Icon: React.ElementType }[] = [
  { key: "probador", label: "Probador", Icon: Wand2 },
  { key: "combinaciones", label: "Combinaciones", Icon: Sparkles },
  { key: "config", label: "Config del tablero", Icon: Settings2 },
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
          <PanelTestReconocimiento runas={runas} trazosActuales={[]} />
        ) : seccion === "combinaciones" ? (
          <EditorCombinacionesRunas runas={runas} />
        ) : (
          <PanelConfigRunas config={configRunas} onActualizar={onActualizarConfigRunas} />
        )}
      </div>
    </div>
  );
}
