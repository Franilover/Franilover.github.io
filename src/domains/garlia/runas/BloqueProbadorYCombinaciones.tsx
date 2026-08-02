"use client";

/**
 * BloqueProbadorYCombinaciones
 * ───────────────────────────────────────────────────────────────────────────
 * Antes SubBloqueProbador y EditorCombinacionesRunas se mostraban lado a
 * lado, cada uno en su mitad. Ahora conviven como un solo bloque con un
 * selector de sección (pestañas) arriba, mostrando una sección a la vez —
 * estética más uniforme, sin dividir la pantalla en dos columnas.
 */

import { Sparkles, Wand2 } from "lucide-react";
import React, { useState } from "react";

import { EditorCombinacionesRunas } from "./EditorCombinacionesRunas";
import { PanelTestReconocimiento } from "./PanelTestReconocimiento";
import type { EntidadMagica } from "./types";

type Seccion = "probador" | "combinaciones";

const SECCIONES: { key: Seccion; label: string; Icon: React.ElementType }[] = [
  { key: "probador", label: "Probador", Icon: Wand2 },
  { key: "combinaciones", label: "Combinaciones", Icon: Sparkles },
];

export function BloqueProbadorYCombinaciones({
  runas,
}: {
  /** Catálogo completo de runas, para el probador y el editor de combinaciones. */
  runas: EntidadMagica[];
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
        ) : (
          <EditorCombinacionesRunas runas={runas} />
        )}
      </div>
    </div>
  );
}
