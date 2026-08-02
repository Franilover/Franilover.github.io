"use client";

/**
 * TableroCeldas.tsx
 * ───────────────────
 * Tablero SVG que muestra la forma exterior elegida (círculo/polígono)
 * dividida en celdas según la rejilla (secciones × anillos). Cada celda
 * es clickeable: al tocarla, queda "activa" para dibujar ahí (ver
 * RunasDibujo.tsx, que muestra el canvas de la celda activa debajo).
 *
 * Las celdas que ya tienen una runa reconocida muestran su miniatura
 * (imagen) o, si no tiene imagen, sus iniciales, como feedback visual
 * de qué ya se dibujó y qué falta.
 *
 * Ruta destino:
 *   src/features/garliaPublic/runas/TableroCeldas.tsx
 */

import React, { useMemo } from "react";

import {
  generarCeldas,
  labelCelda,
  pathCelda,
  verticesPoligono,
  type Celda,
  type FormaLimite,
  type Rejilla,
} from "../formasLimite";
import type { EntidadMagica } from "../types";

const TAMANO = 320;
const MARGEN = 20;

export function TableroCeldas({
  forma,
  rejilla,
  celdaActivaId,
  runaPorCelda,
  onSeleccionarCelda,
}: {
  forma: FormaLimite;
  rejilla: Rejilla;
  celdaActivaId: string | null;
  /** Mapa celdaId → runa reconocida en esa celda (o null si no hay match confiable) */
  runaPorCelda: Record<string, EntidadMagica | null | undefined>;
  onSeleccionarCelda: (celda: Celda) => void;
}) {
  const centro = { x: TAMANO / 2, y: TAMANO / 2 };
  const radio = TAMANO / 2 - MARGEN;

  const celdas = useMemo(() => generarCeldas(rejilla), [rejilla]);

  const marcoExterior = useMemo(() => {
    if (forma.tipo === "circulo") return null;
    return verticesPoligono(forma.lados, centro, radio)
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
  }, [forma, centro.x, centro.y, radio]);

  return (
    <div className="w-full flex flex-col items-center gap-1.5">
      <svg
        viewBox={`0 0 ${TAMANO} ${TAMANO}`}
        className="w-full max-w-[320px] aspect-square"
        role="group"
        aria-label="Tablero de celdas para dibujar runas"
      >
        {/* Marco guía exterior, decorativo, va debajo de las celdas */}
        {forma.tipo === "circulo" ? (
          <circle
            cx={centro.x}
            cy={centro.y}
            r={radio}
            fill="none"
            stroke="color-mix(in srgb, var(--primary) 15%, transparent)"
            strokeWidth={1.5}
          />
        ) : (
          <polygon
            points={marcoExterior ?? ""}
            fill="none"
            stroke="color-mix(in srgb, var(--primary) 15%, transparent)"
            strokeWidth={1.5}
          />
        )}

        {celdas.map((celda) => {
          const activa = celda.id === celdaActivaId;
          const runa = runaPorCelda[celda.id];
          const tieneDibujo = runa !== undefined;
          const puntos = pathCelda(celda, forma, centro, radio);
          return (
            <g key={celda.id}>
              <polygon
                points={puntos}
                onClick={() => onSeleccionarCelda(celda)}
                className="cursor-pointer transition-colors"
                fill={
                  activa
                    ? "color-mix(in srgb, var(--primary) 22%, transparent)"
                    : tieneDibujo
                      ? "color-mix(in srgb, var(--primary) 10%, transparent)"
                      : "color-mix(in srgb, var(--primary) 3%, transparent)"
                }
                stroke={
                  activa
                    ? "var(--primary)"
                    : "color-mix(in srgb, var(--primary) 18%, transparent)"
                }
                strokeWidth={activa ? 2 : 1}
              >
                <title>{labelCelda(celda, rejilla)}</title>
              </polygon>
            </g>
          );
        })}
      </svg>

      {celdaActivaId && (
        <p className="text-micro font-black uppercase tracking-[0.25em] text-primary/40">
          Dibujando en: {labelCelda(celdas.find((c) => c.id === celdaActivaId)!, rejilla)}
        </p>
      )}
    </div>
  );
}
