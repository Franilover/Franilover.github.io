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

import React from "react";

export type LetraATS = "A" | "T" | "S";

export const LETRA_COLOR: Record<LetraATS, { bg: string; border: string; fg: string }> = {
  A: { bg: "color-mix(in srgb, #22c55e 18%, transparent)", border: "#22c55e", fg: "#15803d" },
  T: { bg: "color-mix(in srgb, #ef4444 18%, transparent)", border: "#ef4444", fg: "#b91c1c" },
  S: { bg: "color-mix(in srgb, #3b82f6 18%, transparent)", border: "#3b82f6", fg: "#1d4ed8" },
};

export const LETRA_NOMBRE: Record<LetraATS, string> = {
  A: "Tesis",
  T: "Antítesis",
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
          strokeDasharray="3 4"
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
 * anillo alrededor, una por una (no agregadas como arcos) — cada Partícula
 * es su propio círculo de 3 tercios A/T/S en miniatura, con la cantidad
 * como badge si se repite. Reemplaza a LetrasVisual para este caso: acá
 * se ven las Partículas reales que componen el Ium, no solo el conteo
 * agregado de letras sueltas.
 */
export function IumVisual({
  particulas,
  size = 160,
  className,
}: {
  /** Partículas componentes con su fórmula A/T/S y cuántas veces aparece,
   *  ej. Fluxor → [{ nombre: "Cinética", formula: "TTT", cantidad: 2 }, { nombre: "Masa", formula: "AAA", cantidad: 1 }]. */
  particulas: { nombre: string; formula: string; cantidad: number }[];
  size?: number;
  className?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const orbitR = size * 0.34;
  const particleR = size * 0.155;

  if (particulas.length === 0) {
    return (
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className} role="img" aria-label="Sin composición">
        <circle
          cx={cx}
          cy={cy}
          r={orbitR}
          strokeDasharray="3 4"
          strokeWidth={1.5}
          style={{ fill: "none", stroke: "color-mix(in srgb, var(--primary) 20%, transparent)" }}
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Composición del Ium"
    >
      {/* Anillo orbital: solo el trazo, igual que las capas de AtomoVisual. */}
      <circle
        cx={cx}
        cy={cy}
        r={orbitR}
        fill="none"
        strokeDasharray="2 4"
        strokeWidth={1}
        style={{ stroke: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
      />

      {particulas.map((p, i) => {
        const angulo = (i / particulas.length) * Math.PI * 2 - Math.PI / 2;
        const px = cx + Math.cos(angulo) * orbitR;
        const py = cy + Math.sin(angulo) * orbitR;
        const letras = p.formula
          .toUpperCase()
          .split("")
          .filter(esLetraATS) as LetraATS[];
        // 3 tercios en miniatura, mismo criterio que ParticulaVisual: cada
        // letra de la fórmula ocupa su propio sector de 120°, con su
        // letra sola (no las 3 juntas) para que quepa en el círculo chico.
        const anguloTercio = (Math.PI * 2) / 3;
        const miniFont = particleR * 0.62;
        return (
          <g key={`${p.nombre}-${i}`}>
            <title>{`${p.nombre} (${p.formula})${p.cantidad > 1 ? ` ×${p.cantidad}` : ""}`}</title>
            {letras.map((letra, j) => {
              const aIni = -Math.PI / 2 + j * anguloTercio;
              const aFin = aIni + anguloTercio;
              const aMedio = (aIni + aFin) / 2;
              const color = LETRA_COLOR[letra];
              const labelR = particleR * 0.55;
              return (
                <g key={j}>
                  <path
                    d={sectorPath(px, py, particleR, aIni, aFin)}
                    strokeWidth={1}
                    style={{ fill: color.bg, stroke: color.border }}
                  />
                  <text
                    x={px + labelR * Math.cos(aMedio)}
                    y={py + labelR * Math.sin(aMedio)}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={miniFont}
                    fontWeight={900}
                    style={{ fill: color.fg }}
                  >
                    {letra}
                  </text>
                </g>
              );
            })}
            <circle cx={px} cy={py} r={particleR} fill="none" strokeWidth={1} style={{ stroke: "var(--bg-main)" }} />
            {p.cantidad > 1 && (
              <g>
                <circle
                  cx={px + particleR * 0.78}
                  cy={py - particleR * 0.78}
                  r={particleR * 0.42}
                  style={{ fill: "var(--primary)" }}
                />
                <text
                  x={px + particleR * 0.78}
                  y={py - particleR * 0.78}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={particleR * 0.5}
                  fontWeight={900}
                  style={{ fill: "var(--btn-text)" }}
                >
                  {p.cantidad}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Centro: punto de anclaje visual, igual que el núcleo de AtomoVisual. */}
      <circle cx={cx} cy={cy} r={size * 0.05} style={{ fill: "color-mix(in srgb, var(--primary) 25%, transparent)" }} />
    </svg>
  );
}
