/**
 * formasLimite.ts
 * ─────────────────
 * Helpers geométricos para las "formas límite" que el jugador puede
 * elegir en /garlia/runas antes de dibujar: un marco (círculo o
 * polígono regular de N lados) que sirve como guía visual y como
 * límite duro — el trazo se recorta para no poder salir de la forma.
 *
 * La forma es puramente una restricción de dibujo; no participa del
 * reconocimiento en sí (eso sigue siendo solo el trazo, comparado
 * contra todas las runas vía dollarOneRecognizer.ts).
 *
 * Ruta destino:
 *   src/features/editorGarlia/lib/formasLimite.ts
 */

import type { Punto } from "./dollarOneRecognizer";

export type TipoForma = "circulo" | "poligono";

export type FormaLimite = {
  tipo: TipoForma;
  /** Solo aplica si tipo === "poligono". 3 = triángulo, 4 = cuadrado, etc. */
  lados: number;
};

export const FORMA_CIRCULO: FormaLimite = { tipo: "circulo", lados: 0 };
export const FORMA_CUADRADO: FormaLimite = { tipo: "poligono", lados: 4 };
export const FORMA_TRIANGULO: FormaLimite = { tipo: "poligono", lados: 3 };

export const MIN_LADOS = 3;
export const MAX_LADOS = 10;

/**
 * Vértices de un polígono regular de `lados` lados, centrado en `centro`
 * con radio `radio`. Empieza apuntando hacia arriba (como un triángulo
 * o cuadrado "de pie") para que se vea prolijo.
 */
export function verticesPoligono(
  lados: number,
  centro: Punto,
  radio: number,
): Punto[] {
  const puntos: Punto[] = [];
  const offset = -Math.PI / 2; // primer vértice apuntando hacia arriba
  for (let i = 0; i < lados; i++) {
    const angulo = offset + (i * 2 * Math.PI) / lados;
    puntos.push({
      x: centro.x + radio * Math.cos(angulo),
      y: centro.y + radio * Math.sin(angulo),
    });
  }
  return puntos;
}

/** ¿El punto p está dentro (o sobre el borde) del polígono convexo dado por sus vértices? */
function dentroDePoligono(p: Punto, vertices: Punto[]): boolean {
  // Como todos los polígonos regulares acá son convexos, alcanza con
  // chequear que p esté del mismo lado (sentido horario) de cada arista.
  let signo = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const cruz = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cruz !== 0) {
      const s = cruz > 0 ? 1 : -1;
      if (signo === 0) signo = s;
      else if (s !== signo) return false;
    }
  }
  return true;
}

/**
 * Proyecta un punto fuera del polígono hacia el borde más cercano,
 * a lo largo del segmento centro→punto (clamp radial simple: funciona
 * bien para polígonos regulares convexos centrados).
 */
function clampAPoligono(p: Punto, centro: Punto, vertices: Punto[]): Punto {
  if (dentroDePoligono(p, vertices)) return p;
  // Buscamos la intersección del rayo centro→p con el borde del polígono.
  const dx = p.x - centro.x;
  const dy = p.y - centro.y;
  let mejorT = 1;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const t = interseccionRayoSegmento(centro, { x: dx, y: dy }, a, b);
    if (t !== null && t < mejorT) mejorT = t;
  }
  return { x: centro.x + dx * mejorT, y: centro.y + dy * mejorT };
}

/** t tal que centro + t*dir cae sobre el segmento a-b, con 0<=t<=1, o null si no hay intersección en ese rango. */
function interseccionRayoSegmento(
  origen: Punto,
  dir: Punto,
  a: Punto,
  b: Punto,
): number | null {
  const v1x = origen.x - a.x;
  const v1y = origen.y - a.y;
  const v2x = b.x - a.x;
  const v2y = b.y - a.y;
  const v3x = -dir.y;
  const v3y = dir.x;
  const denom = v2x * v3x + v2y * v3y;
  if (Math.abs(denom) < 1e-10) return null;
  const t1 = (v2x * v1y - v2y * v1x) / denom;
  const t2 = (v1x * v3x + v1y * v3y) / denom;
  if (t1 >= 0 && t2 >= 0 && t2 <= 1) return t1;
  return null;
}

/**
 * Restringe un punto para que quede dentro (o sobre el borde) de la
 * forma límite dada, centrada en `centro` con radio `radio`.
 */
export function clampAForma(
  p: Punto,
  forma: FormaLimite,
  centro: Punto,
  radio: number,
): Punto {
  if (forma.tipo === "circulo") {
    const dx = p.x - centro.x;
    const dy = p.y - centro.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= radio) return p;
    const factor = radio / dist;
    return { x: centro.x + dx * factor, y: centro.y + dy * factor };
  }
  const vertices = verticesPoligono(forma.lados, centro, radio);
  return clampAPoligono(p, centro, vertices);
}

export const NOMBRE_FORMA: Record<TipoForma, string> = {
  circulo: "Círculo",
  poligono: "Polígono",
};

export function labelForma(forma: FormaLimite): string {
  if (forma.tipo === "circulo") return "Círculo";
  if (forma.lados === 3) return "Triángulo";
  if (forma.lados === 4) return "Cuadrado";
  if (forma.lados === 5) return "Pentágono";
  if (forma.lados === 6) return "Hexágono";
  return `Polígono de ${forma.lados} lados`;
}

/* ────────────────────────────────────────────────────────────────────────
 * Rejilla: secciones × anillos
 * ────────────────────────────────────────────────────────────────────────
 * Divide la forma exterior en celdas combinando:
 *   - `secciones`: cuántas cuñas radiales iguales (1 = sin dividir)
 *   - `anillos`: cuántos anillos concéntricos (1 = sin dividir)
 *
 * Cada celda es una "cuña de anillo": la intersección entre un rango
 * angular (sección) y un rango radial (anillo). El jugador dibuja una
 * runa distinta en cada celda; para simplificar la UX, cada celda usa
 * su propio mini-canvas independiente en vez de clampear geometrías de
 * cuña-de-anillo dentro de un único canvas grande (ver RunasDibujo.tsx
 * y TableroCeldas.tsx).
 * ──────────────────────────────────────────────────────────────────── */

export const MIN_SECCIONES = 1;
export const MAX_SECCIONES = 8;
export const MIN_ANILLOS = 1;
export const MAX_ANILLOS = 4;

export type Rejilla = {
  secciones: number;
  anillos: number;
};

export const REJILLA_SIMPLE: Rejilla = { secciones: 1, anillos: 1 };

export function esRejillaSimple(r: Rejilla): boolean {
  return r.secciones <= 1 && r.anillos <= 1;
}

export type Celda = {
  /** Id estable, ej. "s0-a1" (sección 0, anillo 1). Independiente del orden visual. */
  id: string;
  seccion: number; // índice 0-based
  anillo: number; // índice 0-based, 0 = más interno
  /** Ángulo de inicio/fin de la cuña, en radianes, offset -90° (igual que verticesPoligono). */
  anguloInicio: number;
  anguloFin: number;
  /** Radio interior/exterior de este anillo, como fracción del radio total (0..1). */
  radioInicioFrac: number;
  radioFinFrac: number;
};

/** Genera la lista de celdas para una rejilla secciones×anillos, en orden anillo-externo→interno, sección en sentido horario. */
export function generarCeldas(rejilla: Rejilla): Celda[] {
  const { secciones, anillos } = rejilla;
  const celdas: Celda[] = [];
  const offset = -Math.PI / 2;
  for (let a = 0; a < anillos; a++) {
    const radioInicioFrac = a / anillos;
    const radioFinFrac = (a + 1) / anillos;
    for (let s = 0; s < secciones; s++) {
      const anguloInicio = offset + (s * 2 * Math.PI) / secciones;
      const anguloFin = offset + ((s + 1) * 2 * Math.PI) / secciones;
      celdas.push({
        id: `s${s}-a${a}`,
        seccion: s,
        anillo: a,
        anguloInicio,
        anguloFin,
        radioInicioFrac,
        radioFinFrac,
      });
    }
  }
  return celdas;
}

/**
 * Etiqueta legible corta para una celda, útil en UI de admin/tablero.
 * Ej: "Centro" (única celda, sin rejilla), "Sección 2, Anillo 1".
 */
export function labelCelda(celda: Celda, rejilla: Rejilla): string {
  if (esRejillaSimple(rejilla)) return "Centro";
  const partes: string[] = [];
  if (rejilla.secciones > 1) partes.push(`Sección ${celda.seccion + 1}`);
  if (rejilla.anillos > 1) {
    partes.push(
      celda.anillo === 0 && rejilla.anillos > 1
        ? "Anillo interior"
        : celda.anillo === rejilla.anillos - 1
          ? "Anillo exterior"
          : `Anillo ${celda.anillo + 1}`,
    );
  }
  return partes.join(", ") || "Centro";
}

/**
 * Puntos SVG (como string "x,y x,y ...") del contorno de una celda,
 * dado el centro y radio totales del tablero y la forma exterior elegida.
 * Para simplificar el trazado con formas poligonales, aproximamos el
 * arco de cada anillo con puntos interpolados sobre el borde real del
 * polígono (no un arco circular) para que el anillo exterior coincida
 * exactamente con el marco guía de la forma elegida.
 */
export function pathCelda(
  celda: Celda,
  forma: FormaLimite,
  centro: Punto,
  radio: number,
): string {
  const SEGMENTOS_POR_CELDA = forma.tipo === "circulo" ? 24 : 6;
  const puntoEnBorde = (angulo: number, radioFrac: number): Punto => {
    const r = radio * radioFrac;
    if (forma.tipo === "circulo") {
      return { x: centro.x + r * Math.cos(angulo), y: centro.y + r * Math.sin(angulo) };
    }
    return puntoSobrePoligonoEnAngulo(angulo, forma.lados, centro, r);
  };

  // Si la celda cubre el círculo entero (rejilla con 1 sola sección), el
  // ángulo de inicio y de fin son el mismo punto — no hay que repetirlo al
  // final del arco, o el <polygon> dibuja ese punto de cierre como si fuera
  // una arista real (se ve como una línea radial de más, cuando en realidad
  // no hay ninguna sección vecina de la que separarse).
  const esCirculoCompleto = celda.anguloFin - celda.anguloInicio >= 2 * Math.PI - 1e-6;
  const segmentos = esCirculoCompleto ? SEGMENTOS_POR_CELDA - 1 : SEGMENTOS_POR_CELDA;

  const arcoExterior: Punto[] = [];
  const arcoInterior: Punto[] = [];
  for (let i = 0; i <= segmentos; i++) {
    const t = i / segmentos;
    const ang = celda.anguloInicio + t * (celda.anguloFin - celda.anguloInicio);
    arcoExterior.push(puntoEnBorde(ang, celda.radioFinFrac));
    if (celda.radioInicioFrac > 0) arcoInterior.push(puntoEnBorde(ang, celda.radioInicioFrac));
  }

  const contorno: Punto[] =
    celda.radioInicioFrac > 0 ? [...arcoExterior, ...arcoInterior.reverse()] : [...arcoExterior, centro];

  return contorno.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

/* ────────────────────────────────────────────────────────────────────────
 * Gaps: líneas divisorias entre celdas consecutivas de un mismo anillo
 * ────────────────────────────────────────────────────────────────────────
 * Un anillo con `secciones` celdas tiene `secciones` gaps (cíclico: el
 * último conecta con el primero). Cada gap es la línea radial que separa
 * la celda `s` de la celda `s+1` dentro de ese anillo — ahí es donde el
 * jugador dibuja el separador (ver separadores.ts).
 * ──────────────────────────────────────────────────────────────────── */

export type Gap = {
  /** Id estable, ej. "g0-a1": gap entre sección 0 y 1, anillo 1. */
  id: string;
  anillo: number;
  /** Índice de la celda "antes" del gap dentro del anillo (0-based, cíclico). */
  seccionAntes: number;
  /** Índice de la celda "después" del gap (seccionAntes + 1, mod secciones). */
  seccionDespues: number;
  angulo: number; // radianes, misma convención que anguloInicio/Fin de Celda
  radioInicioFrac: number;
  radioFinFrac: number;
};

/** Genera los gaps de todos los anillos de una rejilla. Si secciones <= 1 no hay gaps (no hay nada que separar). */
export function generarGaps(rejilla: Rejilla): Gap[] {
  const { secciones, anillos } = rejilla;
  if (secciones <= 1) return [];
  const gaps: Gap[] = [];
  const offset = -Math.PI / 2;
  for (let a = 0; a < anillos; a++) {
    const radioInicioFrac = a / anillos;
    const radioFinFrac = (a + 1) / anillos;
    for (let s = 0; s < secciones; s++) {
      const angulo = offset + (s * 2 * Math.PI) / secciones;
      gaps.push({
        id: `g${s}-a${a}`,
        anillo: a,
        seccionAntes: (s - 1 + secciones) % secciones,
        seccionDespues: s,
        angulo,
        radioInicioFrac,
        radioFinFrac,
      });
    }
  }
  return gaps;
}

/** Extremos (interior, exterior) del segmento de línea de un gap, en coordenadas del tablero. */
export function puntosGap(
  gap: Gap,
  forma: FormaLimite,
  centro: Punto,
  radio: number,
): { interior: Punto; exterior: Punto } {
  const puntoEnBorde = (radioFrac: number): Punto => {
    const r = radio * radioFrac;
    if (forma.tipo === "circulo") {
      return {
        x: centro.x + r * Math.cos(gap.angulo),
        y: centro.y + r * Math.sin(gap.angulo),
      };
    }
    return puntoSobrePoligonoEnAngulo(gap.angulo, forma.lados, centro, r);
  };
  return {
    interior: puntoEnBorde(gap.radioInicioFrac),
    exterior: puntoEnBorde(gap.radioFinFrac),
  };
}

/** Centro aproximado de una celda (para ubicar su mini-canvas o preview), en coordenadas del tablero. */
export function centroCelda(
  celda: Celda,
  forma: FormaLimite,
  centro: Punto,
  radio: number,
): Punto {
  const anguloMedio = (celda.anguloInicio + celda.anguloFin) / 2;
  const radioMedioFrac = (celda.radioInicioFrac + celda.radioFinFrac) / 2;
  const r = radio * radioMedioFrac;
  if (forma.tipo === "circulo") {
    return { x: centro.x + r * Math.cos(anguloMedio), y: centro.y + r * Math.sin(anguloMedio) };
  }
  return puntoSobrePoligonoEnAngulo(anguloMedio, forma.lados, centro, r);
}

/** Punto sobre el borde de un polígono regular, en la dirección angular dada (no necesariamente un vértice). */
function puntoSobrePoligonoEnAngulo(
  angulo: number,
  lados: number,
  centro: Punto,
  radio: number,
): Punto {
  if (radio <= 0) return { ...centro };
  // Usamos un radio "de sobra" para el polígono guía y buscamos dónde el
  // rayo centro→ángulo cruza ese polígono grande, luego interpolamos
  // linealmente esa distancia por la fracción de radio pedida — como los
  // polígonos regulares acá son homotecias del mismo centro, esto da el
  // punto correcto sobre el polígono escalado al radio pedido.
  const verticesUnitarios = verticesPoligono(lados, centro, radio);
  const dir = { x: Math.cos(angulo), y: Math.sin(angulo) };
  for (let i = 0; i < verticesUnitarios.length; i++) {
    const a = verticesUnitarios[i];
    const b = verticesUnitarios[(i + 1) % verticesUnitarios.length];
    const t = interseccionRayoSegmento(centro, dir, a, b);
    if (t !== null) {
      return { x: centro.x + dir.x * t, y: centro.y + dir.y * t };
    }
  }
  return { x: centro.x + radio * dir.x, y: centro.y + radio * dir.y };
}
