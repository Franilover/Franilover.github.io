"use client";

/**
 * ParticulaVisual.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Gráficos circulares para el sistema de Física (Tesis/Antítesis/Síntesis),
 * paralelos a AtomoVisual (elementos/ElementoEditor.tsx) pero para la
 * jerarquía Partícula → Ium → Oris:
 *
 *   - ParticulaVisual: una Partícula (fórmula de 3 letras A/T/S, ej. "SAT")
 *     como círculo partido en 3 tercios iguales (120° cada uno), cada
 *     tercio con su letra — el diseño "casilla de tabla periódica" pedido.
 *   - LetrasVisual: un Ium o un Oris, cuya composición no son 3 letras
 *     fijas sino una bolsa de letras A/T/S de tamaño variable (ej. Fluxor =
 *     2×Cinética(TTT) + 1×Masa(AAA) = 6T + 3A). Se dibuja como el mismo
 *     círculo pero con arcos proporcionales al conteo de cada letra en vez
 *     de tercios iguales.
 *
 * Ambos comparten color/tipografía con el resto de Física para que el ojo
 * los lea como la misma familia visual.
 */

import React, { useState } from "react";
import { PARTICULA_INITIAL } from "./types";

export type LetraATS = "A" | "T" | "S";

export const LETRA_COLOR: Record<LetraATS, { bg: string; border: string; fg: string }> = {
  // Antes 18% de mezcla (casi transparente): sobre fondos variados el
  // relleno se perdía y las letras quedaban con poco contraste. Subido a
  // 85% para un fondo prácticamente plano/sólido que resalte la letra
  // (fg) con claridad, sin perder el tinte semántico por letra.
  A: { bg: "color-mix(in srgb, #22c55e 85%, white)", border: "#22c55e", fg: "#ffffff" },
  T: { bg: "color-mix(in srgb, #ef4444 85%, white)", border: "#ef4444", fg: "#ffffff" },
  S: { bg: "color-mix(in srgb, #3b82f6 85%, white)", border: "#3b82f6", fg: "#ffffff" },
};

export const LETRA_NOMBRE: Record<LetraATS, string> = {
  T: "Tesis",
  A: "Antítesis",
  S: "Síntesis",
};

function esLetraATS(c: string): c is LetraATS {
  return c === "A" || c === "T" || c === "S";
}

/** Convierte una fórmula tipo "SAT" en su conteo de letras {A, T, S}. */
export function contarLetras(formula: string): Record<LetraATS, number> {
  const out: Record<LetraATS, number> = { A: 0, T: 0, S: 0 };
  for (const c of formula.toUpperCase()) {
    if (esLetraATS(c)) out[c] += 1;
  }
  return out;
}

function sectorPath(cx: number, cy: number, r: number, anguloIni: number, anguloFin: number): string {
  // Sector de pizza desde el centro, entre dos ángulos (radianes).
  const x1 = cx + r * Math.cos(anguloIni);
  const y1 = cy + r * Math.sin(anguloIni);
  const x2 = cx + r * Math.cos(anguloFin);
  const y2 = cy + r * Math.sin(anguloFin);
  const largo = anguloFin - anguloIni > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largo} 1 ${x2} ${y2} Z`;
}

/**
 * Círculo de una Partícula: siempre 3 tercios iguales (120° cada uno),
 * uno por letra de la fórmula, en el orden en que aparecen. Fórmulas con
 * menos de 3 letras (ej. Partícula Base: solo "A", "T" o "S") se dibujan
 * como círculo completo de un solo color.
 */
export function ParticulaVisual({
  formula,
  size = 96,
  className,
}: {
  /** Fórmula de hasta 3 letras A/T/S, ej. "SAT", "AAA", o solo "A". */
  formula: string;
  size?: number;
  className?: string;
}) {
  const letras = formula
    .toUpperCase()
    .split("")
    .filter(esLetraATS) as LetraATS[];

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const fontSize = size * 0.22;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`Partícula ${formula}`}
    >
      {letras.length <= 1 ? (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            strokeWidth={2}
            style={{
              fill: letras[0] ? LETRA_COLOR[letras[0]].bg : "color-mix(in srgb, var(--primary) 10%, transparent)",
              stroke: letras[0] ? LETRA_COLOR[letras[0]].border : "var(--primary)",
            }}
          />
          {letras[0] && (
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={fontSize}
              fontWeight={900}
              style={{ fill: LETRA_COLOR[letras[0]].fg }}
            >
              {letras[0]}
            </text>
          )}
        </>
      ) : (
        letras.map((letra, i) => {
          const anguloTercio = (Math.PI * 2) / 3;
          const anguloIni = -Math.PI / 2 + i * anguloTercio;
          const anguloFin = anguloIni + anguloTercio;
          const anguloMedio = (anguloIni + anguloFin) / 2;
          const color = LETRA_COLOR[letra];
          const labelR = r * 0.6;
          return (
            <g key={i}>
              <path
                d={sectorPath(cx, cy, r, anguloIni, anguloFin)}
                strokeWidth={1.5}
                style={{ fill: color.bg, stroke: color.border }}
              />
              <text
                x={cx + labelR * Math.cos(anguloMedio)}
                y={cy + labelR * Math.sin(anguloMedio)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontSize}
                fontWeight={900}
                style={{ fill: color.fg }}
              >
                {letra}
              </text>
            </g>
          );
        })
      )}
      <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={2} style={{ stroke: "var(--bg-main)" }} opacity={0.001} />
    </svg>
  );
}

/**
 * Círculo de un Ium (o de un Oris, que es una mezcla de Iums): recibe un
 * conteo total de letras {A, T, S} — típicamente la suma de las fórmulas
 * de todas las Partículas que lo componen — y dibuja arcos proporcionales
 * al peso de cada letra, en vez de tercios fijos. Con 0 letras se ve como
 * un círculo vacío (placeholder).
 */
export function LetrasVisual({
  conteo,
  size = 120,
  className,
}: {
  conteo: Record<LetraATS, number>;
  size?: number;
  className?: string;
}) {
  const total = conteo.A + conteo.T + conteo.S;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const fontSize = size * 0.13;

  if (total === 0) {
    return (
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className} role="img" aria-label="Sin composición">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          strokeWidth={1.5}
          style={{ fill: "color-mix(in srgb, var(--primary) 4%, transparent)", stroke: "color-mix(in srgb, var(--primary) 20%, transparent)" }}
        />
      </svg>
    );
  }

  const orden: LetraATS[] = ["A", "T", "S"];
  let anguloActual = -Math.PI / 2;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className} role="img" aria-label="Composición A/T/S">
      {orden.map((letra) => {
        const n = conteo[letra];
        if (n === 0) return null;
        const anguloSector = (n / total) * Math.PI * 2;
        const anguloIni = anguloActual;
        const anguloFin = anguloActual + anguloSector;
        anguloActual = anguloFin;
        const anguloMedio = (anguloIni + anguloFin) / 2;
        const color = LETRA_COLOR[letra];
        const labelR = r * 0.62;
        // Sectores muy angostos (una sola letra entre muchas) esconden el
        // número para no saturar; el resto muestra "nA" (cantidad+letra).
        const mostrarLabel = anguloSector > 0.35;
        return (
          <g key={letra}>
            <path
              d={sectorPath(cx, cy, r, anguloIni, anguloFin)}
              strokeWidth={1.5}
              style={{ fill: color.bg, stroke: color.border }}
            />
            {mostrarLabel && (
              <text
                x={cx + labelR * Math.cos(anguloMedio)}
                y={cy + labelR * Math.sin(anguloMedio)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontSize}
                fontWeight={900}
                style={{ fill: color.fg }}
              >
                {n}{letra}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Suma varios conteos de letras en uno solo (ej. varias Partículas de un Ium). */
export function sumarConteos(...conteos: Record<LetraATS, number>[]): Record<LetraATS, number> {
  const out: Record<LetraATS, number> = { A: 0, T: 0, S: 0 };
  for (const c of conteos) {
    out.A += c.A;
    out.T += c.T;
    out.S += c.S;
  }
  return out;
}

/**
 * Círculo de un Ium (o de un Oris), en el mismo estilo que AtomoVisual de
 * Elementos: un centro y sus Partículas componentes distribuidas en un
 * anillo alrededor, una por una (no agregadas como arcos ni agrupadas por
 * cantidad) — cada Partícula repetida se dibuja como su propio círculo
 * individual, sin badge de cantidad. Reemplaza a LetrasVisual para este
 * caso: acá se ven siempre las Partículas reales que componen el Ium, no
 * un conteo agregado.
 *
 * Tiene un botón flotante en la esquina (mismo patrón que un toggle de
 * capa) para alternar cada círculo entre dos modos:
 *   - "ats" (default): 3 tercios A/T/S en miniatura, igual que ParticulaVisual.
 *   - "inicial": círculo sólido con la inicial de la Partícula (ej. "C" de
 *     Cinética) — mismo criterio que PARTICLE_INITIAL en Elementos.
 */
export function IumVisual({
  particulas,
  size = 160,
  className,
  showToggle = true,
}: {
  /** Partículas componentes ya expandidas (una entrada por unidad), con su
   *  fórmula A/T/S, ej. Fluxor → [{ nombre: "Cinética", formula: "TTT" }, { nombre: "Cinética", formula: "TTT" }, { nombre: "Masa", formula: "AAA" }]. */
  particulas: { nombre: string; formula: string }[];
  size?: number;
  className?: string;
  /** Si es false, no renderiza el botón flotante de alternar modo (ats/inicial).
   *  Default true — no cambia el comportamiento de los usos existentes. */
  showToggle?: boolean;
}) {
  const [modo, setModo] = useState<"ats" | "inicial">("ats");
  const cx = size / 2;
  const cy = size / 2;
  const orbitR = size * 0.34;
  const particleR = size * 0.155;

  return (
    <div className={`relative inline-block ${className ?? ""}`} style={{ width: size, height: size }}>
      {showToggle && particulas.length > 0 && (
        <button
          type="button"
          onClick={() => setModo((m) => (m === "ats" ? "inicial" : "ats"))}
          title={modo === "ats" ? "Mostrar iniciales de las Partículas" : "Mostrar letras A/T/S"}
          className="absolute bottom-0.5 right-0.5 z-10 flex items-center justify-center rounded-full border shadow-sm cursor-pointer transition-transform hover:scale-110"
          style={{
            width: Math.max(20, size * 0.15),
            height: Math.max(20, size * 0.15),
            fontSize: Math.max(9, size * 0.075),
            fontWeight: 900,
            background: "var(--primary)",
            color: "var(--btn-text)",
            borderColor: "color-mix(in srgb, var(--primary) 90%, black)",
          }}
        >
          {modo === "ats" ? "Aa" : "∆"}
        </button>
      )}

      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={modo === "ats" ? "Composición A/T/S del Ium" : "Iniciales de Partículas del Ium"}
      >
        {particulas.length === 0 ? (
          <circle
            cx={cx}
            cy={cy}
            r={orbitR}
            strokeWidth={1.5}
            style={{ fill: "none", stroke: "color-mix(in srgb, var(--primary) 20%, transparent)" }}
          />
        ) : (
          <>
            {/* Anillo orbital: solo el trazo, igual que las capas de AtomoVisual. */}
            <circle
              cx={cx}
              cy={cy}
              r={orbitR}
              fill="none"
              strokeWidth={1}
              style={{ stroke: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
            />

            {particulas.map((p, i) => {
              const angulo = (i / particulas.length) * Math.PI * 2 - Math.PI / 2;
              const px = cx + Math.cos(angulo) * orbitR;
              const py = cy + Math.sin(angulo) * orbitR;

              if (modo === "inicial") {
                // Modo iniciales: círculo sólido de un color por Partícula
                // (derivado de --primary/--accent) con su letra corta.
                const idx = Object.keys(PARTICULA_INITIAL).indexOf(p.nombre);
                const base = idx % 2 === 0 ? "--primary" : "--accent";
                const mix = 55 + ((idx * 11) % 30);
                const initFont = particleR * 0.85;
                return (
                  <g key={`${p.nombre}-${i}`}>
                    <title>{p.nombre}</title>
                    <circle
                      cx={px}
                      cy={py}
                      r={particleR}
                      strokeWidth={1.5}
                      style={{
                        fill: `color-mix(in srgb, var(${base}) ${mix}%, var(--bg-main))`,
                        stroke: `color-mix(in srgb, var(${base}) 90%, black)`,
                      }}
                    />
                    <text
                      x={px}
                      y={py}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={initFont}
                      fontWeight={900}
                      style={{ fill: "var(--btn-text)" }}
                    >
                      {PARTICULA_INITIAL[p.nombre] ?? p.nombre[0]}
                    </text>
                  </g>
                );
              }

              // Antes: sectores de 120° dibujados a mano acá mismo (mini
              // versión propia de ParticulaVisual, con menos nitidez —
              // stroke más fino, sin el circulito de máscara antialiasing
              // que usa el visor de Partículas real). Ahora se reusa
              // ParticulaVisual tal cual (mismo componente que el visor de
              // Partículas), vía foreignObject, para que cada Partícula
              // dentro del Ium se vea idéntica a como se ve en su propio
              // visor — mismo trazo, mismo criterio de sectores/letra única.
              return (
                <g key={`${p.nombre}-${i}`}>
                  <title>{`${p.nombre} (${p.formula})`}</title>
                  <foreignObject x={px - particleR} y={py - particleR} width={particleR * 2} height={particleR * 2}>
                    <ParticulaVisual formula={p.formula} size={particleR * 2} />
                  </foreignObject>
                </g>
              );
            })}

            {/* Centro: punto de anclaje visual, igual que el núcleo de AtomoVisual. */}
            <circle cx={cx} cy={cy} r={size * 0.05} style={{ fill: "color-mix(in srgb, var(--primary) 25%, transparent)" }} />
          </>

        )}
      </svg>
    </div>
  );
}
