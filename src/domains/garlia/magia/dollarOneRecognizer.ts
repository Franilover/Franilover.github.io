/**
 * dollarOneRecognizer.ts
 * ────────────────────────
 * Implementación del algoritmo "$1 Unistroke Recognizer"
 * (Wobbrock, Wilson & Li, 2007 — https://depts.washington.edu/acelab/proj/dollar/index.html).
 *
 * Reconoce qué símbolo dibujó un usuario comparando el trazo contra
 * un set de plantillas ("patrones") ya guardadas, sin necesidad de
 * machine learning ni dependencias externas.
 *
 * Cómo funciona, a grandes rasgos:
 *   1. Se resamplea el trazo a N puntos equiespaciados (para que no
 *      importe la velocidad ni la cantidad de puntos capturados).
 *   2. Se rota para que el ángulo entre el centroide y el primer
 *      punto sea 0° (indiferencia a rotación inicial).
 *   3. Se escala a un cuadrado y se centra en el origen (indiferencia
 *      a tamaño y posición).
 *   4. Se compara contra cada plantilla probando pequeñas rotaciones
 *      (Golden Section Search) y se toma la de menor distancia.
 *
 * Cada "runa" puede tener varios patrones (varios trazos de ejemplo);
 * se compara contra todos y se toma el mejor match global.
 *
 * Ruta destino:
 *   src/features/editorGarlia/lib/dollarOneRecognizer.ts
 */

export type Punto = { x: number; y: number };

/** Patrón de referencia: una runa puede tener 1 o más trazos-ejemplo. */
export type PatronRuna = {
  runaId: string;
  nombre: string;
  trazos: Punto[][];
};

export type ResultadoReconocimiento = {
  runaId: string;
  nombre: string;
  /** 0 a 1, cuanto más alto mejor coincidencia */
  score: number;
};

const NUM_PUNTOS = 64;
const CUADRADO_TAMANO = 250;
const ORIGEN: Punto = { x: 0, y: 0 };
const ANGULO_RANGO = 45; // grados, rango total de rotación a probar
const PHI = 0.5 * (-1 + Math.sqrt(5)); // razón áurea, para Golden Section Search

function distancia(a: Punto, b: Punto): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function longitudTrazo(puntos: Punto[]): number {
  let d = 0;
  for (let i = 1; i < puntos.length; i++) d += distancia(puntos[i - 1], puntos[i]);
  return d;
}

/** Resamplea a exactamente n puntos equiespaciados a lo largo del trazo. */
function resamplear(puntos: Punto[], n: number): Punto[] {
  if (puntos.length < 2) return puntos;
  const intervalo = longitudTrazo(puntos) / (n - 1);
  if (intervalo === 0) return Array(n).fill(puntos[0]);

  let D = 0;
  const nuevos: Punto[] = [{ ...puntos[0] }];
  const copia = puntos.map((p) => ({ ...p }));

  for (let i = 1; i < copia.length; i++) {
    const d = distancia(copia[i - 1], copia[i]);
    if (D + d >= intervalo) {
      const qx = copia[i - 1].x + ((intervalo - D) / d) * (copia[i].x - copia[i - 1].x);
      const qy = copia[i - 1].y + ((intervalo - D) / d) * (copia[i].y - copia[i - 1].y);
      const q = { x: qx, y: qy };
      nuevos.push(q);
      copia.splice(i, 0, q);
      D = 0;
    } else {
      D += d;
    }
  }
  // Por redondeos de punto flotante a veces falta el último punto
  while (nuevos.length < n) nuevos.push({ ...copia[copia.length - 1] });
  return nuevos.slice(0, n);
}

function centroide(puntos: Punto[]): Punto {
  const x = puntos.reduce((s, p) => s + p.x, 0) / puntos.length;
  const y = puntos.reduce((s, p) => s + p.y, 0) / puntos.length;
  return { x, y };
}

function rotarPor(puntos: Punto[], radianes: number): Punto[] {
  const c = centroide(puntos);
  const cos = Math.cos(radianes);
  const sin = Math.sin(radianes);
  return puntos.map((p) => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }));
}

function rotarAAnguloCero(puntos: Punto[]): Punto[] {
  const c = centroide(puntos);
  const angulo = Math.atan2(c.y - puntos[0].y, c.x - puntos[0].x);
  return rotarPor(puntos, -angulo);
}

function escalarACuadrado(puntos: Punto[], tamano: number): Punto[] {
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  return puntos.map((p) => ({
    x: (p.x - minX) * (tamano / w),
    y: (p.y - minY) * (tamano / h),
  }));
}

function trasladarAOrigen(puntos: Punto[], origen: Punto): Punto[] {
  const c = centroide(puntos);
  return puntos.map((p) => ({ x: p.x - c.x + origen.x, y: p.y - c.y + origen.y }));
}

/** Normaliza un trazo crudo a la forma canónica usada para comparar. */
export function normalizarTrazo(puntosCrudos: Punto[]): Punto[] {
  if (puntosCrudos.length < 2) return puntosCrudos;
  let p = resamplear(puntosCrudos, NUM_PUNTOS);
  p = rotarAAnguloCero(p);
  p = escalarACuadrado(p, CUADRADO_TAMANO);
  p = trasladarAOrigen(p, ORIGEN);
  return p;
}

function distanciaPromedioPorPunto(a: Punto[], b: Punto[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += distancia(a[i], b[i]);
  return d / a.length;
}

function distanciaConRotacion(
  puntos: Punto[],
  plantilla: Punto[],
  anguloInicial: number,
): number {
  const desde = -anguloInicial;
  const hasta = anguloInicial;
  const umbral = 0.1; // grados en radianes

  let x1 = PHI * desde + (1 - PHI) * hasta;
  let f1 = distanciaPromedioPorPunto(rotarPor(puntos, x1), plantilla);
  let x2 = (1 - PHI) * desde + PHI * hasta;
  let f2 = distanciaPromedioPorPunto(rotarPor(puntos, x2), plantilla);

  while (Math.abs(hasta - desde) > umbral) {
    if (f1 < f2) {
      hasta = x2;
      x2 = x1;
      f2 = f1;
      x1 = PHI * desde + (1 - PHI) * hasta;
      f1 = distanciaPromedioPorPunto(rotarPor(puntos, x1), plantilla);
    } else {
      desde = x1;
      x1 = x2;
      f1 = f2;
      x2 = (1 - PHI) * desde + PHI * hasta;
      f2 = distanciaPromedioPorPunto(rotarPor(puntos, x2), plantilla);
    }
  }
  return Math.min(f1, f2);
}

/**
 * Compara un trazo crudo (ya normalizado o no) contra un set de patrones
 * y devuelve el ranking de coincidencias, de mejor a peor.
 *
 * @param puntosCrudos trazo del usuario, en coordenadas de pantalla
 * @param patrones     catálogo de runas con sus trazos de referencia
 */
export function reconocerRuna(
  puntosCrudos: Punto[],
  patrones: PatronRuna[],
): ResultadoReconocimiento[] {
  if (puntosCrudos.length < 2 || patrones.length === 0) return [];

  const candidato = normalizarTrazo(puntosCrudos);
  const mitadDiagonal = 0.5 * Math.hypot(CUADRADO_TAMANO, CUADRADO_TAMANO);
  const anguloInicialRad = (ANGULO_RANGO * Math.PI) / 180;

  const resultados: ResultadoReconocimiento[] = [];

  for (const patron of patrones) {
    let mejorDistancia = Infinity;
    for (const trazoRef of patron.trazos) {
      if (trazoRef.length < 2) continue;
      const plantilla = normalizarTrazo(trazoRef);
      const d = distanciaConRotacion(candidato, plantilla, anguloInicialRad);
      if (d < mejorDistancia) mejorDistancia = d;
    }
    if (mejorDistancia === Infinity) continue;
    const score = Math.max(0, 1 - mejorDistancia / mitadDiagonal);
    resultados.push({ runaId: patron.runaId, nombre: patron.nombre, score });
  }

  return resultados.sort((a, b) => b.score - a.score);
}

/** Suaviza levemente un trazo capturado (media móvil), opcional antes de usarlo. */
export function suavizarTrazo(puntos: Punto[]): Punto[] {
  if (puntos.length < 3) return puntos;
  const out: Punto[] = [puntos[0]];
  for (let i = 1; i < puntos.length - 1; i++) {
    out.push({
      x: (puntos[i - 1].x + puntos[i].x + puntos[i + 1].x) / 3,
      y: (puntos[i - 1].y + puntos[i].y + puntos[i + 1].y) / 3,
    });
  }
  out.push(puntos[puntos.length - 1]);
  return out;
}

/** Ángulo mínimo de rotación configurado (expuesto por si se quiere reusar el paso "resamplear + normalizar" en otro lado). */
export const CONFIG_RECONOCEDOR = {
  NUM_PUNTOS,
  CUADRADO_TAMANO,
};
