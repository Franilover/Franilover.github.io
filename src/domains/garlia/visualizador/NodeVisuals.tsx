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
  // Fondo subido de 18% → 32% de mezcla: el relleno de las partículas y
  // del anillo A/T/S se veía demasiado tenue/lavado, sobre todo en el
  // nodo Oris (CentroGravedadNodo), que además ahora es más grande y esa
  // debilidad se notaba más. El borde queda al 100% del color puro, sin
  // cambios, para no perder el contraste que ya funcionaba bien.
  A: { bg: "color-mix(in srgb, #22c55e 32%, transparent)", border: "#22c55e", fg: "#15803d" },
  T: { bg: "color-mix(in srgb, #ef4444 32%, transparent)", border: "#ef4444", fg: "#b91c1c" },
  S: { bg: "color-mix(in srgb, #3b82f6 32%, transparent)", border: "#3b82f6", fg: "#1d4ed8" },
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
 * Punto 4 del docx: "Cada partícula tiene identidad". El boceto del
 * documento usa "○" como notación genérica de "esto es una partícula" en
 * el diagrama ASCII — no significa que todas deban renderizarse
 * literalmente idénticas. La identidad real de cada partícula (más allá
 * de su nombre/código, que ya se muestran como texto en StructureCanvas)
 * es su composición A/T/S — así que el propio círculo la refleja: color
 * dominante según qué letra pesa más en la fórmula, y un pequeño anillo
 * partido en tercios reales (no siempre 3 iguales) que muestra la mezcla
 * exacta de A/T/S de ESA partícula. Dos partículas con fórmula distinta
 * (ej. "TTT" vs "AAA" vs "SAT") ahora se ven visiblemente distintas.
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
  const conteo = contarLetrasNodo(formula);
  const total = conteo.A + conteo.T + conteo.S;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const ringWidth = Math.max(2, size * 0.1);
  const innerR = r - ringWidth;

  // Letra dominante: la más frecuente en la fórmula, para el color de
  // fondo del núcleo. Empate → se usa la primera letra de la fórmula.
  let dominante: LetraATS = letras[0] ?? "A";
  (["A", "T", "S"] as LetraATS[]).forEach((l) => {
    if (conteo[l] > conteo[dominante]) dominante = l;
  });
  const colorDominante = LETRA_COLOR[dominante];

  let anguloActual = -Math.PI / 2;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className} role="img" aria-label={`Partícula ${formula}`}>
      {/* Núcleo: color de la letra dominante — distingue de un vistazo si
          la partícula es mayormente Antítesis/Tesis/Síntesis. */}
      <circle cx={cx} cy={cy} r={innerR} strokeWidth={1.5} style={{ fill: colorDominante.bg, stroke: colorDominante.border }} />

      {/* Anillo exterior: partido según la composición REAL de la fórmula
          (no tercios iguales por defecto) — ej. "TTT" es un anillo
          enteramente rojo, "SAT" son 3 tercios de colores distintos. */}
      {total > 0 &&
        letras.map((letra, i) => {
          if (letras.length <= 1) return null; // 1 sola letra: el núcleo ya la muestra, el anillo sería redundante
          const anguloSector = (Math.PI * 2) / letras.length;
          const anguloIni = anguloActual;
          const anguloFin = anguloActual + anguloSector;
          anguloActual = anguloFin;
          const color = LETRA_COLOR[letra];
          return <path key={i} d={ringSectorPath(cx, cy, r, innerR, anguloIni, anguloFin)} strokeWidth={0.75} style={{ fill: color.bg, stroke: color.border }} />;
        })}

      <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={1.5} style={{ stroke: "color-mix(in srgb, var(--primary) 55%, transparent)" }} />
    </svg>
  );
}

/** Path de un sector de anillo (entre radio interno y externo), para el
 *  borde de composición A/T/S de ParticulaNodo. */
function ringSectorPath(cx: number, cy: number, rOuter: number, rInner: number, anguloIni: number, anguloFin: number): string {
  const p = (r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x1, y1] = p(rOuter, anguloIni);
  const [x2, y2] = p(rOuter, anguloFin);
  const [x3, y3] = p(rInner, anguloFin);
  const [x4, y4] = p(rInner, anguloIni);
  const largo = anguloFin - anguloIni > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${largo} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${largo} 0 ${x4} ${y4} Z`;
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
        <circle cx={cx} cy={cy} r={orbitR} fill="none" strokeWidth={1.5} style={{ stroke: "color-mix(in srgb, var(--primary) 32%, transparent)" }} />
      ) : (
        <>
          {/* Anillo orbital de referencia. Sigue siendo sutil a propósito
              (punto 5 del docx: la posición es visual, no una geometría
              física real) pero subido de 12% → 22% — al tamaño más grande
              del nodo Oris, el anillo casi no se distinguía del fondo. */}
          <circle cx={cx} cy={cy} r={orbitR} fill="none" strokeWidth={1} style={{ stroke: "color-mix(in srgb, var(--primary) 22%, transparent)" }} />

          {particulas.map((p, i) => {
            const angulo = (i / particulas.length) * Math.PI * 2 - Math.PI / 2;
            const px = cx + Math.cos(angulo) * orbitR;
            const py = cy + Math.sin(angulo) * orbitR;
            // Misma identidad visual que ParticulaNodo: color según la
            // letra dominante de SU fórmula real, no un mismo tono fijo
            // para todas (antes eran indistinguibles entre sí).
            const conteo = contarLetrasNodo(p.formula);
            let dominante: LetraATS = "A";
            (["A", "T", "S"] as LetraATS[]).forEach((l) => {
              if (conteo[l] > conteo[dominante]) dominante = l;
            });
            const color = LETRA_COLOR[dominante];
            return (
              <g key={`${p.nombre}-${i}`}>
                <title>{`${p.nombre} (${p.formula})`}</title>
                <circle cx={px} cy={py} r={particleR} strokeWidth={1} style={{ fill: color.bg, stroke: color.border }} />
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
