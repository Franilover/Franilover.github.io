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
