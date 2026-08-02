"use client";

/**
 * PanelTestReconocimiento.tsx
 * ──────────────────────────────
 * Sub-panel de PanelPatronRuna: permite al admin dibujar un trazo de
 * prueba y ver contra qué runas matchea el reconocedor $1, con el
 * ranking de scores completo — sirve para detectar ambigüedades entre
 * runas parecidas (ej. dos runas que confunden al reconocedor) sin
 * tener que ir a la página pública a probar.
 *
 * Recibe el catálogo completo de runas (con sus patron_trazos ya
 * guardados en DB) más, opcionalmente, los trazos que se están editando
 * en memoria para la runa actual (todavía no guardados) para que el
 * test sea útil también antes de apretar "Guardar".
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/magia/PanelTestReconocimiento.tsx
 */

import React, { useMemo, useState } from "react";

import { CanvasDibujoRuna } from "./CanvasDibujoRuna";
import {
  reconocerRuna,
  type Punto,
  type PatronRuna,
  type ResultadoReconocimiento,
} from "./dollarOneRecognizer";
import type { EntidadMagica } from "./types";

export function PanelTestReconocimiento({
  runas,
  runaActualId,
  trazosActuales,
  color = "var(--primary)",
}: {
  runas: EntidadMagica[];
  /** id de la runa que se está editando ahora, para poder rotularla como "(sin guardar)" */
  runaActualId?: string;
  /** trazos en memoria de la runa actual, todavía no persistidos */
  trazosActuales: Punto[][];
  color?: string;
}) {
  const [resetSignal, setResetSignal] = useState(0);
  const [resultados, setResultados] = useState<ResultadoReconocimiento[] | null>(null);

  const patrones: PatronRuna[] = useMemo(() => {
    return runas
      .map((r) => ({
        runaId: r.id,
        nombre: r.nombre || "(sin nombre)",
        trazos: r.id === runaActualId ? trazosActuales : ((r.patron_trazos as Punto[][]) ?? []),
      }))
      .filter((p) => p.trazos.length > 0);
  }, [runas, runaActualId, trazosActuales]);

  const probar = (puntos: Punto[]) => {
    setResultados(reconocerRuna(puntos, patrones));
  };

  const limpiarResultados = () => {
    setResultados(null);
    setResetSignal((s) => s + 1);
  };

  return (
    <div className="space-y-2">
      {patrones.length === 0 ? (
        <p className="text-micro text-primary/25 py-3 text-center">
          Todavía no hay ningún patrón guardado para comparar.
        </p>
      ) : (
        <>
          <CanvasDibujoRuna
            color={color}
            height={160}
            resetSignal={resetSignal}
            onTrazoCompleto={probar}
          />

          {resultados && resultados.length > 0 && (
            <div className="space-y-1 pt-1">
              {resultados.slice(0, 5).map((r, idx) => (
                <div
                  key={r.runaId}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-micro"
                  style={{
                    background:
                      idx === 0
                        ? "color-mix(in srgb, var(--primary) 10%, transparent)"
                        : "transparent",
                    border:
                      idx === 0
                        ? "1px solid color-mix(in srgb, var(--primary) 25%, transparent)"
                        : "1px solid transparent",
                  }}
                >
                  <span
                    className={`font-black w-6 text-center shrink-0 ${idx === 0 ? "text-primary" : "text-primary/30"}`}
                  >
                    {idx + 1}
                  </span>
                  <span className={`flex-1 truncate ${idx === 0 ? "font-bold text-primary" : "text-primary/50"}`}>
                    {r.nombre}
                    {r.runaId === runaActualId ? " (esta runa)" : ""}
                  </span>
                  <div className="w-16 h-1.5 rounded-full bg-primary/10 overflow-hidden shrink-0">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(r.score * 100)}%`,
                        background: idx === 0 ? "var(--primary)" : "color-mix(in srgb, var(--primary) 50%, transparent)",
                      }}
                    />
                  </div>
                  <span className="text-primary/30 w-9 text-right shrink-0 tabular-nums">
                    {Math.round(r.score * 100)}%
                  </span>
                </div>
              ))}
              <button
                type="button"
                className="text-micro font-black uppercase tracking-widest text-primary/30 hover:text-primary/60 transition-colors pt-1"
                onClick={limpiarResultados}
              >
                Limpiar prueba
              </button>
            </div>
          )}

          {resultados && resultados.length === 0 && (
            <p className="text-micro text-primary/25 pt-1">Sin resultados.</p>
          )}
        </>
      )}
    </div>
  );
}
