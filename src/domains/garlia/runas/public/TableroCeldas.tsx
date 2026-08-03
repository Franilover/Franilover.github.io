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

import type { Punto } from "../dollarOneRecognizer";

import {
  centroCelda,
  generarCeldas,
  generarGaps,
  labelCelda,
  pathCelda,
  puntosGap,
  verticesPoligono,
  type Celda,
  type FormaLimite,
  type Gap,
  type Rejilla,
} from "../formasLimite";
import { RunaThumbnail } from "../RunaThumbnail";
import type { TipoSeparador } from "../separadores";
import type { EntidadMagica } from "../types";

const TAMANO = 320;
const MARGEN = 20;

export function TableroCeldas({
  forma,
  rejilla,
  celdaActivaId,
  runaPorCelda,
  onSeleccionarCelda,
  gapActivoId,
  separadorPorGap,
  onSeleccionarGap,
}: {
  forma: FormaLimite;
  rejilla: Rejilla;
  celdaActivaId: string | null;
  /** Mapa celdaId → runa reconocida en esa celda (o null si no hay match confiable) */
  runaPorCelda: Record<string, EntidadMagica | null | undefined>;
  onSeleccionarCelda: (celda: Celda) => void;
  /** Los 3 props siguientes son opcionales — si no se pasan, no se dibujan gaps
   *  (comportamiento anterior, tableros de 1 sola sección). */
  gapActivoId?: string | null;
  separadorPorGap?: Record<string, TipoSeparador | undefined>;
  onSeleccionarGap?: (gap: Gap) => void;
}) {
  const centro = { x: TAMANO / 2, y: TAMANO / 2 };
  const radio = TAMANO / 2 - MARGEN;

  const celdas = useMemo(() => generarCeldas(rejilla), [rejilla]);
  const gaps = useMemo(() => generarGaps(rejilla), [rejilla]);

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
          const centroCeldaPos = centroCelda(celda, forma, centro, radio);
          // Thumbnail más chico cuanto más celdas hay, para que no se pisen
          // entre sí en rejillas densas (mismo criterio que el preview de combinaciones).
          const ladoThumb = Math.max(20, Math.min(52, radio / Math.max(1, rejilla.anillos + 1)));
          return (
            <g key={celda.id}>
              <polygon
                points={puntos}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeleccionarCelda(celda);
                }}
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

              {runa?.patron_trazos && (
                <g
                  transform={`translate(${(centroCeldaPos.x - ladoThumb / 2).toFixed(1)},${(centroCeldaPos.y - ladoThumb / 2).toFixed(1)})`}
                  className="pointer-events-none"
                >
                  <foreignObject width={ladoThumb} height={ladoThumb}>
                    {/* Blindaje extra: aunque el SVG interno ya centra y escala
                        su contenido vía preserveAspectRatio, este wrapper
                        garantiza que nada se salga del cuadrado asignado
                        a la celda, sea cual sea el tamaño real del trazo. */}
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      <RunaThumbnail patronTrazos={runa.patron_trazos} />
                    </div>
                  </foreignObject>
                </g>
              )}
            </g>
          );
        })}

        {onSeleccionarGap &&
          gaps.map((gap) => {
            const activo = gap.id === gapActivoId;
            const tipo = separadorPorGap?.[gap.id];
            const { interior, exterior } = puntosGap(gap, forma, centro, radio);
            return (
              <g key={gap.id}>
                {/* Línea invisible más gruesa solo para agrandar el área clickeable */}
                <line
                  x1={interior.x}
                  y1={interior.y}
                  x2={exterior.x}
                  y2={exterior.y}
                  stroke="transparent"
                  strokeWidth={14}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeleccionarGap(gap);
                  }}
                />
                {activo && (
                  <line
                    x1={interior.x}
                    y1={interior.y}
                    x2={exterior.x}
                    y2={exterior.y}
                    stroke="var(--primary)"
                    strokeWidth={4}
                    strokeLinecap="round"
                    className="cursor-pointer pointer-events-none"
                  />
                )}
                {tipo && (
                  <GlifoSeparador tipo={tipo} interior={interior} exterior={exterior} />
                )}
              </g>
            );
          })}
      </svg>

      {celdaActivaId && (
        <p className="text-micro font-black uppercase tracking-[0.25em] text-primary/40">
          Dibujando runa en: {labelCelda(celdas.find((c) => c.id === celdaActivaId)!, rejilla)}
        </p>
      )}
    </div>
  );
}

/**
 * Glifo vectorial de un separador (⟩⟩ ⟩ ⟨ |), dibujado para ocupar TODA
 * la distancia entre el centro/anillo interior y la circunferencia
 * exterior de su gap — no un texto de tamaño fijo centrado en el medio.
 *
 * Cada glifo se define en un espacio local con origen en el punto medio
 * del gap, eje Y de -1 (hacia `interior`) a +1 (hacia `exterior`). Se
 * escala en Y a la mitad de la longitud real del gap (para cubrirlo
 * entero) y un poco en X (ensanche horizontal leve), luego se rota al
 * ángulo real del gap y se traslada a su punto medio real.
 */
function GlifoSeparador({
  tipo,
  interior,
  exterior,
}: {
  tipo: TipoSeparador;
  interior: Punto;
  exterior: Punto;
}) {
  const dx = exterior.x - interior.x;
  const dy = exterior.y - interior.y;
  const largo = Math.hypot(dx, dy);
  const anguloGrados = (Math.atan2(dy, dx) * 180) / Math.PI - 90; // -90: el glifo local apunta "hacia arriba" en Y-
  const medio = { x: (interior.x + exterior.x) / 2, y: (interior.y + exterior.y) / 2 };

  const mitadLargo = largo / 2;
  const ancho = Math.min(9, largo * 0.16); // ensanche horizontal leve, proporcional pero acotado

  return (
    <g
      transform={`translate(${medio.x.toFixed(1)},${medio.y.toFixed(1)}) rotate(${anguloGrados.toFixed(1)}) scale(${ancho.toFixed(2)},${mitadLargo.toFixed(2)})`}
      className="pointer-events-none"
    >
      <path
        d={GLIFO_PATH[tipo]}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

/**
 * Paths en espacio local [-1, 1] × [-1, 1] (antes de escalar), con el
 * origen en el centro del gap. Eje Y = interior(-1)..exterior(+1)
 * (dirección radial, es la que se estira para cubrir todo el gap).
 * Eje X = dirección tangencial (hacia los costados del gap) — ahí es
 * donde el chevron apunta, siguiendo la forma original ⟩ / ⟨.
 *
 *   corta:        una línea recta de punta a punta (sin apuntar a ningún lado).
 *   continua:     chevron "⟩" — apunta hacia la derecha (visto con el
 *                 gap en la parte de arriba del tablero).
 *   continua_inv: chevron "⟨" — apunta hacia la izquierda, exactamente
 *                 invertido respecto a "continua".
 *   inicio:       doble chevron "⟩⟩", mismo sentido que "continua",
 *                 repetido dos veces a lo largo del eje Y.
 */
const GLIFO_PATH: Record<TipoSeparador, string> = {
  corta: "M 0 -1 L 0 1",
  continua: "M 0.7 -1 L -0.7 0 L 0.7 1",
  continua_inv: "M -0.7 -1 L 0.7 0 L -0.7 1",
  inicio: "M 0.7 -1 L -0.7 -0.35 L 0.7 0.3 M 0.7 0.05 L -0.7 0.7 L 0.7 1",
};
