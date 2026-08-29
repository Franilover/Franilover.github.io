"use client";

/**
 * TriangleATS.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * VIS-02 — Espacio Tesis / Antítesis / Síntesis (A/T/S), doc maestro
 * "Garlia_Visualizador_TODOS_LOS_DISENOS", Parte 3.
 *
 * "El triángulo no es el protagonista. El protagonista es el espacio que
 * existe dentro de él." — cada vértice es una letra pura (T, A, S); la
 * posición de una entidad dentro del triángulo representa visualmente su
 * composición A/T/S real.
 *
 * Regla crítica del docx (punto 5): "Frontend NO calcula la posición
 * conceptual. El frontend recibe T, A, S y solo representa la
 * transformación (T,A,S) → posición visual." Este componente NO decide qué
 * significa "mucho T" o "equilibrado" — solo recibe conteos {A,T,S} ya
 * reales (via contarLetrasDeIum/contarLetrasDeOris/fórmula de partícula,
 * todas funciones de dominio existentes, cero cálculo nuevo) y aplica una
 * transformación puramente geométrica: coordenadas baricéntricas. Esa
 * transformación (T,A,S)→(x,y) sí es "matemática y puramente gráfica"
 * (docx, mismo punto), así que vive acá, no en el motor.
 *
 * No es lo mismo que ParticulaNodo (VIS-01, punto 4: partícula = "○" con
 * identidad de color). Este es otro visualizador: un mapa donde CUALQUIER
 * entidad (partícula, IUM u Oris) se posiciona según su propio A/T/S.
 */

import React, { useMemo, useState } from "react";

export interface LetrasATS {
  A: number;
  T: number;
  S: number;
}

export interface EntidadATS {
  id: string;
  label: string;
  sublabel?: string;
  letras: LetrasATS;
  /** Punto 4 del docx: "las partículas también pueden aparecer" —
   *  componentes opcionales superpuestos alrededor del núcleo de una
   *  entidad compuesta (ej. las partículas reales de un IUM/Oris). */
  componentes?: { label: string; letras: LetrasATS }[];
}

const SIZE = 380;
const PAD = 56;
// Vértices del triángulo — T arriba, A abajo-izquierda, S abajo-derecha.
// El orden es arbitrario (el docx no fija una disposición geométrica
// específica, solo pide que T/A/S sean los 3 vértices), pero se mantiene
// fijo y consistente en todo el visualizador.
const V_T = { x: SIZE / 2, y: PAD };
const V_A = { x: PAD * 0.55, y: SIZE - PAD * 0.65 };
const V_S = { x: SIZE - PAD * 0.55, y: SIZE - PAD * 0.65 };

/** Punto 5 del docx: transformación puramente gráfica (T,A,S) → posición
 *  visual, vía coordenadas baricéntricas. Si las 3 letras son 0 (entidad
 *  sin composición conocida), cae en el centroide — no se inventa un sesgo
 *  hacia ningún vértice que el dato real no respalde. */
function posicionEnTriangulo(letras: LetrasATS): { x: number; y: number } {
  const total = letras.A + letras.T + letras.S;
  if (total <= 0) {
    return {
      x: (V_T.x + V_A.x + V_S.x) / 3,
      y: (V_T.y + V_A.y + V_S.y) / 3,
    };
  }
  const wT = letras.T / total;
  const wA = letras.A / total;
  const wS = letras.S / total;
  return {
    x: wT * V_T.x + wA * V_A.x + wS * V_S.x,
    y: wT * V_T.y + wA * V_A.y + wS * V_S.y,
  };
}

/** Punto 6 del docx: "gradiente espacial — un campo sutil que sugiere tres
 *  regiones de influencia, sin implicar un campo físico real". Tres
 *  gradientes radiales suaves centrados en cada vértice, mezclándose hacia
 *  el centro. */
function CampoGradiente() {
  return (
    <>
      <defs>
        <radialGradient id="ats-grad-t" cx={V_T.x / SIZE} cy={V_T.y / SIZE} r="0.62">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ats-grad-a" cx={V_A.x / SIZE} cy={V_A.y / SIZE} r="0.62">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ats-grad-s" cx={V_S.x / SIZE} cy={V_S.y / SIZE} r="0.62">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <polygon points={`${V_T.x},${V_T.y} ${V_A.x},${V_A.y} ${V_S.x},${V_S.y}`} fill="url(#ats-grad-t)" />
      <polygon points={`${V_T.x},${V_T.y} ${V_A.x},${V_A.y} ${V_S.x},${V_S.y}`} fill="url(#ats-grad-a)" />
      <polygon points={`${V_T.x},${V_T.y} ${V_A.x},${V_A.y} ${V_S.x},${V_S.y}`} fill="url(#ats-grad-s)" />
    </>
  );
}

export interface TriangleATSProps {
  /** Entidades ya resueltas con su A/T/S real — nunca calculado acá. */
  entidades: EntidadATS[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Ciencia: punto 14 del docx — misma representación, más profundidad
   *  de información (conteos exactos junto a la etiqueta). */
  modoCiencia?: boolean;
  className?: string;
}

export function TriangleATS({
  entidades,
  selectedId = null,
  onSelect,
  modoCiencia = false,
  className,
}: TriangleATSProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const posiciones = useMemo(
    () => new Map(entidades.map((e) => [e.id, posicionEnTriangulo(e.letras)])),
    [entidades],
  );

  const activo = entidades.find((e) => e.id === (hoverId ?? selectedId)) ?? null;
  const posComponentes = useMemo(() => {
    if (!activo?.componentes?.length) return [];
    // Punto 4 del docx: cada partícula/componente puede tener su propia
    // posición — se reusa la misma transformación baricéntrica, con un
    // pequeño jitter determinístico (por índice) solo quando dos
    // componentes caen exactamente en el mismo punto, para que no se
    // tapen entre sí. El jitter es puramente visual, no altera qué A/T/S
    // real tiene cada componente.
    const vistos = new Map<string, number>();
    return activo.componentes.map((c) => {
      const base = posicionEnTriangulo(c.letras);
      const key = `${Math.round(base.x)}-${Math.round(base.y)}`;
      const n = vistos.get(key) ?? 0;
      vistos.set(key, n + 1);
      const angle = (n * Math.PI * 2) / 7;
      const jitter = n === 0 ? 0 : 6 + n * 2;
      return { ...c, x: base.x + Math.cos(angle) * jitter, y: base.y + Math.sin(angle) * jitter };
    });
  }, [activo]);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width="100%"
      height="auto"
      role="img"
      aria-label="Mapa de composición Tesis / Antítesis / Síntesis"
      className={className}
    >
      <CampoGradiente />

      {/* El triángulo-mapa en sí: un contorno fino, nunca "el protagonista"
          (docx punto 1) — solo un marco de referencia. */}
      <polygon
        points={`${V_T.x},${V_T.y} ${V_A.x},${V_A.y} ${V_S.x},${V_S.y}`}
        fill="none"
        strokeWidth={1.5}
        style={{ stroke: "color-mix(in srgb, var(--primary) 30%, transparent)" }}
      />

      {/* Etiquetas de vértice: T / A / S. */}
      <text x={V_T.x} y={V_T.y - 16} textAnchor="middle" fontSize={13} fontWeight={900} style={{ fill: "#b91c1c" }}>
        T
      </text>
      <text x={V_A.x - 14} y={V_A.y + 20} textAnchor="middle" fontSize={13} fontWeight={900} style={{ fill: "#15803d" }}>
        A
      </text>
      <text x={V_S.x + 14} y={V_S.y + 20} textAnchor="middle" fontSize={13} fontWeight={900} style={{ fill: "#1d4ed8" }}>
        S
      </text>

      {/* Componentes superpuestos de la entidad activa (docx punto 4) — se
          dibujan primero, por debajo del núcleo, como "aquello que la
          compone y la empuja" hacia su posición. */}
      {posComponentes.map((c, i) => (
        <g key={`${c.label}-${i}`} style={{ transition: "transform 260ms ease, opacity 260ms ease" }}>
          <circle cx={c.x} cy={c.y} r={4} strokeWidth={1} style={{ fill: "color-mix(in srgb, var(--primary) 20%, transparent)", stroke: "color-mix(in srgb, var(--primary) 55%, transparent)" }} />
          <title>{`${c.label} (${c.letras.A}A ${c.letras.T}T ${c.letras.S}S)`}</title>
        </g>
      ))}

      {/* Núcleo (◎) de cada entidad — punto 3 del docx: "no un punto plano,
          presencia visual". Aura sutil alrededor cuando la entidad tiene
          distribución (componentes) conocida. */}
      {entidades.map((e) => {
        const pos = posiciones.get(e.id)!;
        const isSelected = selectedId === e.id;
        const isHovered = hoverId === e.id;
        const emphasized = isSelected || isHovered;
        const total = e.letras.A + e.letras.T + e.letras.S;
        return (
          <g
            key={e.id}
            transform={`translate(${pos.x}, ${pos.y})`}
            onMouseEnter={() => setHoverId(e.id)}
            onMouseLeave={() => setHoverId(null)}
            onClick={() => onSelect?.(e.id)}
            style={{ cursor: onSelect ? "pointer" : "default", transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)" }}
          >
            {e.componentes?.length ? (
              <circle
                r={emphasized ? 15 : 12}
                style={{
                  fill: "color-mix(in srgb, var(--accent) 12%, transparent)",
                  transition: "r 200ms ease",
                }}
              />
            ) : null}
            <circle
              r={emphasized ? 7 : 5.5}
              strokeWidth={emphasized ? 2 : 1.5}
              style={{
                fill: total > 0 ? "color-mix(in srgb, var(--accent) 55%, var(--primary))" : "color-mix(in srgb, var(--primary) 25%, transparent)",
                stroke: emphasized ? "var(--accent)" : "color-mix(in srgb, var(--primary) 60%, transparent)",
                transition: "r 200ms ease, stroke 150ms ease",
              }}
            />
            <text
              y={emphasized ? -18 : -14}
              textAnchor="middle"
              fontSize={emphasized ? 11 : 9.5}
              fontWeight={emphasized ? 900 : 700}
              style={{ fill: "var(--primary)", opacity: emphasized ? 0.95 : 0.55, transition: "opacity 150ms ease, font-size 150ms ease" }}
            >
              {e.label}
            </text>
            {modoCiencia && emphasized ? (
              <text y={emphasized ? -6 : -2} textAnchor="middle" fontSize={8.5} style={{ fill: "var(--primary)", opacity: 0.5 }}>
                {e.letras.A}A · {e.letras.T}T · {e.letras.S}S
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
