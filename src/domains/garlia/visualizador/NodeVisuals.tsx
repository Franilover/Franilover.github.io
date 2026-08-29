"use client";

/**
 * NodeVisuals.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Formas de nodo propias del Visualizador (VIS-01), construidas desde cero
 * dentro de visualizador/ — sin importar ni reutilizar componentes de
 * fisica/ParticulaVisual.tsx (ParticulaVisual, IumVisual, LetrasVisual). Esos
 * son el diseño antiguo de otra sección; el docx maestro pide formas propias
 * por tipo de nodo, distintivas e integradas al canvas orbital, no un círculo
 * genérico compartido.
 *
 * Tres formas, una por tipo de nodo del docx (Parte 2 — VIS-01):
 *
 *   - ParticulaNodo   (punto 4: "cada partícula tiene identidad") — casilla
 *     partida en tercios A/T/S, uno por letra de la fórmula.
 *   - CentroGravedad  (punto 2: "el IUM como centro de gravedad") — núcleo
 *     ✦ con las partículas reales que lo componen orbitando en un anillo
 *     propio. Sirve para IUM y para Oris (ambos son "una bolsa de
 *     partículas" en el modelo — mismo tratamiento visual, distinto rótulo).
 *   - ElementoNodo    (punto 9: "no aparece como una etiqueta; tiene forma
 *     propia... la composición microscópica alimenta la forma") — ◈ cuyos
 *     3 gajos (núcleo/media/externa) tienen tamaño proporcional al total
 *     real de partículas en esa capa. Sin datos, un gajo queda en 0 — nunca
 *     se inventa una magnitud que no venga del backend.
 *
 * Todas reciben solo datos ya resueltos por los hooks de ruta (fórmulas,
 * conteos, totales por capa) — ninguna calcula reglas de dominio, solo
 * dibuja lo que le pasan.
 */

import React from "react";

export type LetraATS = "A" | "T" | "S";

export const LETRA_COLOR: Record<LetraATS, { bg: string; border: string; fg: string }> = {
  A: { bg: "color-mix(in srgb, #22c55e 18%, transparent)", border: "#22c55e", fg: "#15803d" },
  T: { bg: "color-mix(in srgb, #ef4444 18%, transparent)", border: "#ef4444", fg: "#b91c1c" },
  S: { bg: "color-mix(in srgb, #3b82f6 18%, transparent)", border: "#3b82f6", fg: "#1d4ed8" },
};

function esLetraATS(c: string): c is LetraATS {
  return c === "A" || c === "T" || c === "S";
}

/** Convierte una fórmula tipo "SAT" en su conteo de letras {A, T, S}. */
export function contarLetrasNodo(formula: string): Record<LetraATS, number> {
  const out: Record<LetraATS, number> = { A: 0, T: 0, S: 0 };
  for (const c of formula.toUpperCase()) {
    if (esLetraATS(c)) out[c] += 1;
  }
  return out;
}

function sectorPath(cx: number, cy: number, r: number, anguloIni: number, anguloFin: number): string {
  const x1 = cx + r * Math.cos(anguloIni);
  const y1 = cy + r * Math.sin(anguloIni);
  const x2 = cx + r * Math.cos(anguloFin);
  const y2 = cy + r * Math.sin(anguloFin);
  const largo = anguloFin - anguloIni > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largo} 1 ${x2} ${y2} Z`;
}

/**
 * Punto 4 del docx: "Cada partícula tiene identidad". Casilla circular
 * partida en tercios (120° cada uno), uno por letra A/T/S de la fórmula —
 * la misma idea de "casilla de tabla periódica" pedida en la especificación,
 * reconstruida acá para no depender de fisica/.
 */
export function ParticulaNodo({
  formula,
  size = 40,
  className,
}: {
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
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className} role="img" aria-label={`Partícula ${formula}`}>
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
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fontWeight={900} style={{ fill: LETRA_COLOR[letras[0]].fg }}>
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
              <path d={sectorPath(cx, cy, r, anguloIni, anguloFin)} strokeWidth={1.5} style={{ fill: color.bg, stroke: color.border }} />
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
    </svg>
  );
}

/**
 * Punto 2 del docx: "el IUM es visualmente el lugar donde ocurre la
 * organización" — un centro de gravedad (✦), con las partículas reales que
 * lo componen distribuidas en un anillo propio alrededor. Se usa tanto para
 * IUM como para Oris (ambos son, en el modelo, una bolsa de partículas de
 * distinto nivel) — mismo tratamiento visual, distinto rótulo/contexto.
 */
export function CentroGravedadNodo({
  particulas,
  size = 96,
  className,
}: {
  /** Partículas reales que componen este centro, ya expandidas. */
  particulas: { nombre: string; formula: string }[];
  size?: number;
  className?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const orbitR = size * 0.36;
  const particleR = size * 0.14;
  const starR = size * 0.09;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className} role="img" aria-label="Centro de gravedad">
      {particulas.length === 0 ? (
        <circle cx={cx} cy={cy} r={orbitR} fill="none" strokeWidth={1.5} style={{ stroke: "color-mix(in srgb, var(--primary) 20%, transparent)" }} />
      ) : (
        <>
          {/* Anillo orbital de referencia, muy sutil (punto 5 del docx: la
              posición es visual, no una geometría física real). */}
          <circle cx={cx} cy={cy} r={orbitR} fill="none" strokeWidth={1} style={{ stroke: "color-mix(in srgb, var(--primary) 12%, transparent)" }} />

          {particulas.map((p, i) => {
            const angulo = (i / particulas.length) * Math.PI * 2 - Math.PI / 2;
            const px = cx + Math.cos(angulo) * orbitR;
            const py = cy + Math.sin(angulo) * orbitR;
            const letras = p.formula
              .toUpperCase()
              .split("")
              .filter(esLetraATS) as LetraATS[];
            const anguloTercio = (Math.PI * 2) / 3;
            const miniFont = particleR * 0.62;
            return (
              <g key={`${p.nombre}-${i}`}>
                <title>{`${p.nombre} (${p.formula})`}</title>
                {letras.length <= 1 ? (
                  <circle
                    cx={px}
                    cy={py}
                    r={particleR}
                    strokeWidth={1}
                    style={{
                      fill: letras[0] ? LETRA_COLOR[letras[0]].bg : "color-mix(in srgb, var(--primary) 10%, transparent)",
                      stroke: letras[0] ? LETRA_COLOR[letras[0]].border : "var(--primary)",
                    }}
                  />
                ) : (
                  letras.map((letra, j) => {
                    const aIni = -Math.PI / 2 + j * anguloTercio;
                    const aFin = aIni + anguloTercio;
                    const aMedio = (aIni + aFin) / 2;
                    const color = LETRA_COLOR[letra];
                    const labelR = particleR * 0.55;
                    return (
                      <g key={j}>
                        <path d={sectorPath(px, py, particleR, aIni, aFin)} strokeWidth={1} style={{ fill: color.bg, stroke: color.border }} />
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
                  })
                )}
                <circle cx={px} cy={py} r={particleR} fill="none" strokeWidth={1} style={{ stroke: "var(--bg-main)" }} />
              </g>
            );
          })}
        </>
      )}

      {/* Núcleo ✦: el centro de gravedad propiamente dicho. */}
      <path
        d={starPath(cx, cy, starR, starR * 0.42)}
        style={{ fill: "color-mix(in srgb, var(--accent) 55%, var(--primary))", stroke: "color-mix(in srgb, var(--accent) 90%, black)" }}
        strokeWidth={1}
      />
    </svg>
  );
}

/** Estrella de 4 puntas simple para el núcleo ✦ del centro de gravedad. */
function starPath(cx: number, cy: number, rOuter: number, rInner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const angulo = (Math.PI / 4) * i - Math.PI / 2;
    const x = cx + r * Math.cos(angulo);
    const y = cy + r * Math.sin(angulo);
    pts.push(`${x} ${y}`);
  }
  return `M ${pts[0]} L ${pts.slice(1).join(" L ")} Z`;
}

/**
 * Punto 9 del docx: "El Elemento... no aparece simplemente como una
 * etiqueta; tiene forma propia... la composición microscópica alimenta la
 * forma". Forma ◈ (rombo) dividida en 3 gajos — núcleo / media / externa —
 * cuyo tamaño angular es proporcional al total real de partículas en esa
 * capa. Una capa vacía (total 0) no ocupa gajo — nunca se infla una
 * magnitud que el backend no dio.
 */
export function ElementoNodo({
  capas,
  size = 64,
  className,
}: {
  /** Las 3 capas reales del Elemento, con su total ya calculado. */
  capas: { capa: "nucleo" | "media" | "externa"; total: number }[];
  size?: number;
  className?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  const COLOR_CAPA: Record<string, { bg: string; border: string }> = {
    nucleo: { bg: "color-mix(in srgb, var(--accent) 30%, transparent)", border: "color-mix(in srgb, var(--accent) 80%, black)" },
    media: { bg: "color-mix(in srgb, var(--primary) 22%, transparent)", border: "color-mix(in srgb, var(--primary) 75%, black)" },
    externa: { bg: "color-mix(in srgb, var(--primary) 10%, transparent)", border: "color-mix(in srgb, var(--primary) 45%, black)" },
  };

  const totalGeneral = capas.reduce((acc, c) => acc + c.total, 0);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className} role="img" aria-label="Elemento">
      {totalGeneral === 0 ? (
        // Sin composición conocida: rombo vacío, nunca se reparte en
        // tercios iguales por defecto (eso sería inventar una magnitud).
        <path
          d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`}
          strokeWidth={1.5}
          style={{ fill: "color-mix(in srgb, var(--primary) 6%, transparent)", stroke: "color-mix(in srgb, var(--primary) 25%, transparent)" }}
        />
      ) : (
        (() => {
          let anguloActual = -Math.PI / 2;
          return capas.map((c) => {
            if (c.total === 0) return null;
            const anguloSector = (c.total / totalGeneral) * Math.PI * 2;
            const anguloIni = anguloActual;
            const anguloFin = anguloActual + anguloSector;
            anguloActual = anguloFin;
            const color = COLOR_CAPA[c.capa];
            return <path key={c.capa} d={sectorPath(cx, cy, r, anguloIni, anguloFin)} strokeWidth={1.5} style={{ fill: color.bg, stroke: color.border }} />;
          });
        })()
      )}
      {/* Marco romboidal por encima de los gajos, para que se lea como una
          única forma (◈) y no como un pastel genérico. */}
      <path
        d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`}
        fill="none"
        strokeWidth={1.5}
        style={{ stroke: "color-mix(in srgb, var(--accent) 60%, black)" }}
      />
    </svg>
  );
}
