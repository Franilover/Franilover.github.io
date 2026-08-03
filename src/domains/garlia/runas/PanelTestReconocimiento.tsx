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

import React, { useEffect, useMemo, useRef, useState } from "react";

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

  // El canvas de dibujo siempre cuadrado: medimos el ancho real de la
  // columna izquierda con un sentinel (igual que PanelPatronRuna) y
  // usamos ese mismo valor como alto del canvas.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [lado, setLado] = useState(220);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setLado(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  if (patrones.length === 0) {
    return (
      <p className="text-micro text-primary/25 py-3 text-center">
        Todavía no hay ningún patrón guardado para comparar.
      </p>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="sm:w-1/2 shrink-0">
        <div ref={sentinelRef} className="w-full h-0" />
        <CanvasDibujoRuna
          color={color}
          height={lado}
          resetSignal={resetSignal}
          onTrazoCompleto={probar}
        />
      </div>

      <div className="sm:w-1/2 min-w-0">
        {resultados && resultados.length > 0 && (
          <div className="space-y-1">
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

        {!resultados && (
          <p className="text-micro text-primary/25 py-3 text-center sm:text-left">
            Dibujá un trazo a la izquierda para ver el ranking acá.
          </p>
        )}
      </div>
    </div>
  );
}
