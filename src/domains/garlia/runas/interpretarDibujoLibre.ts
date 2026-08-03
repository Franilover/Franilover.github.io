/**
 * interpretarDibujoLibre.ts
 * ────────────────────────────
 * Parte 2 del plan, sub-problema final: toma TODOS los trazos que el
 * jugador dibujó en un único canvas libre (sin tablero de celdas, sin
 * selectores) y arma directamente el mapa celdaId→runaId + gapId→separador
 * que espera matchCombinacion.ts — el mismo formato que antes se armaba
 * a mano tocando celdas una por una en TableroCeldas.tsx.
 *
 * Solo soporta 1 anillo por ahora (ver nota en detectarFormaLibre.ts:
 * la detección de anillos concéntricos queda para una iteración futura;
 * acá directamente no se contempla — toda celda vive en el único anillo
 * 0..1 de radio completo).
 *
 * Flujo, en dos pasadas sobre los mismos trazos:
 *
 *   1. detectarFormaLibre(trazos) → contorno (círculo/N-lados) + cuántas
 *      líneas radiales separaron secciones. De ahí sale `forma` y
 *      `rejilla.secciones` — el "tablero" que el jugador dibujó, en vez
 *      de uno fijo elegido de antemano.
 *
 *   2. Con esa rejilla ya inferida, generamos las celdas/gaps esperados
 *      (formasLimite.ts) y clasificamos cada trazo que NO fue ni
 *      contorno ni línea de sección (los "ignorados" de la pasada 1):
 *      según su posición (ángulo respecto al centro detectado), cada uno
 *      cae en el "cuerpo" de una celda o cerca de la línea de un gap.
 *      Los de celda se comparan contra las runas guardadas; los de gap,
 *      contra los 4 patrones de separador. Ambos vía el mismo motor $1
 *      (reconocerRuna) que ya se usaba con el tablero de selectores.
 *
 * Ruta destino:
 *   src/features/garliaPublic/runas/interpretarDibujoLibre.ts
 */

import {
  detectarFormaLibre,
  type FormaDetectada,
  type TrazoLibre,
} from "./deteccionFormaLibre";
import { reconocerRuna, type PatronRuna, type Punto, type ResultadoReconocimiento } from "./dollarOneRecognizer";
import { generarCeldas, generarGaps, type Celda, type FormaLimite, type Gap, type Rejilla } from "./formasLimite";
import { patronesSeparadores, type TipoSeparador } from "./separadores";
import type { EntidadMagica } from "./types";

export type ResultadoCelda = {
  celda: Celda;
  ranking: ResultadoReconocimiento[];
  mejorMatch: EntidadMagica | null;
};

export type ResultadoGap = {
  gap: Gap;
  ranking: ResultadoReconocimiento[];
  tipo: TipoSeparador | null;
};

export type InterpretacionDibujoLibre = {
  /** Forma+rejilla que el jugador dibujó (contorno + Nº de secciones). */
  forma: FormaLimite;
  rejilla: Rejilla;
  /** Confianza de la lectura del contorno/secciones (ver FormaDetectada.confianza). */
  confianzaForma: number;
  centro: Punto;
  radio: number;
  /** Resultado de reconocimiento por celda, solo para las celdas que tuvieron algún trazo asignado. */
  resultadosPorCelda: Record<string, ResultadoCelda>;
  /** Resultado de reconocimiento por gap, solo para gaps con algún trazo asignado. Vacío si secciones <= 1 (no hay gaps). */
  resultadosPorGap: Record<string, ResultadoGap>;
  /** Mapa listo para pasarle a buscarCombinacion: celdaId → runaId (solo celdas con match confiable). */
  celdaRunaId: Record<string, string>;
  /** Mapa listo para pasarle a buscarCombinacion: gapId → tipo (solo gaps con match confiable). */
  separadorPorGap: Record<string, TipoSeparador | undefined>;
  /** Trazos que ni siquiera se pudieron ubicar en una celda o gap (debug/feedback). Normalmente vacío. */
  trazosSinUbicar: TrazoLibre[];
};

// Mismo umbral que ya se usaba en RunasDibujo.tsx con el tablero de
// selectores — se mantiene acá para no bajar la exigencia solo porque
// ahora el trazo llega por una vía distinta.
const UMBRAL_CONFIANZA = 0.72;

function angulo(p: Punto, centro: Punto): number {
  return Math.atan2(p.y - centro.y, p.x - centro.x);
}

/** Distancia angular circular mínima entre dos ángulos, siempre en [0, π]. */
function distanciaAngular(a: number, b: number): number {
  let d = Math.abs(a - b);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d;
}

/** Punto "representativo" de un trazo para decidir a qué celda/gap pertenece: su centroide. */
function centroideTrazo(trazo: TrazoLibre): Punto {
  const x = trazo.reduce((s, p) => s + p.x, 0) / trazo.length;
  const y = trazo.reduce((s, p) => s + p.y, 0) / trazo.length;
  return { x, y };
}

/**
 * ¿A qué celda pertenece este trazo, dado su centroide? Con 1 solo
 * anillo, cada celda es una cuña angular de radio completo — alcanza
 * con encontrar en qué rango [anguloInicio, anguloFin) cae el ángulo
 * del centroide respecto al centro del tablero detectado.
 */
function celdaParaAngulo(anguloPunto: number, celdas: Celda[]): Celda {
  // Normalizamos todo a [0, 2π) para no lidiar con el wraparound de
  // atan2 (-π..π) contra rangos que puedan cruzar por π.
  const dosPi = 2 * Math.PI;
  const norm = (a: number) => ((a % dosPi) + dosPi) % dosPi;
  const objetivo = norm(anguloPunto);

  for (const celda of celdas) {
    const inicio = norm(celda.anguloInicio);
    const fin = norm(celda.anguloFin);
    if (inicio <= fin) {
      if (objetivo >= inicio && objetivo < fin) return celda;
    } else {
      // La cuña cruza el punto de wraparound (ej. de 350° a 10°).
      if (objetivo >= inicio || objetivo < fin) return celda;
    }
  }
  // Fallback defensivo (no debería pasar con rangos que cubren 2π
  // exactos, pero por errores de punto flotante en el borde exacto de
  // una cuña): la celda cuyo centro angular está más cerca.
  return celdas.reduce((mejor, c) => {
    const centroC = norm((c.anguloInicio + c.anguloFin) / 2);
    const centroMejor = norm((mejor.anguloInicio + mejor.anguloFin) / 2);
    return distanciaAngular(objetivo, centroC) < distanciaAngular(objetivo, centroMejor) ? c : mejor;
  });
}

/** ¿El gap más cercano a este ángulo, y a qué tan cerca (en radianes)? */
function gapMasCercano(anguloPunto: number, gaps: Gap[]): { gap: Gap; distancia: number } | null {
  if (gaps.length === 0) return null;
  let mejor = gaps[0];
  let mejorDist = distanciaAngular(anguloPunto, gaps[0].angulo);
  for (const gap of gaps.slice(1)) {
    const d = distanciaAngular(anguloPunto, gap.angulo);
    if (d < mejorDist) {
      mejorDist = d;
      mejor = gap;
    }
  }
  return { gap: mejor, distancia: mejorDist };
}

/**
 * Qué tan angosta, en radianes, es la franja alrededor de la línea de
 * un gap que cuenta como "este trazo es un separador de este gap" en
 * vez de "este trazo es parte del cuerpo de una celda". Se deriva del
 * ancho angular de una celda: una franja de ~30% del ancho de celda a
 * cada lado del gap dejar margen para trazos de separador dibujados un
 * poco corridos, sin invadir tanto que empiece a robarle área al centro
 * de celdas angostas (muchas secciones).
 */
function calcularFranjaGap(rejilla: Rejilla): number {
  if (rejilla.secciones <= 1) return 0;
  const anchoCelda = (2 * Math.PI) / rejilla.secciones;
  return Math.min(anchoCelda * 0.3, (12 * Math.PI) / 180); // tope duro de 12°, además del 30% relativo
}

/**
 * Punto de entrada: recibe todos los trazos del canvas libre y el
 * catálogo de runas, y devuelve la interpretación completa lista para
 * pasarle el resultado (`celdaRunaId`, `separadorPorGap`) a
 * buscarCombinacion(). Devuelve `null` si ni siquiera se pudo detectar
 * un contorno (mismo caso que detectarFormaLibre devolviendo null).
 */
export function interpretarDibujoLibre(
  trazos: TrazoLibre[],
  runas: EntidadMagica[],
  plantillasSeparadores?: Parameters<typeof patronesSeparadores>[0],
): InterpretacionDibujoLibre | null {
  const deteccion: FormaDetectada | null = detectarFormaLibre(trazos);
  if (!deteccion) return null;

  const rejilla: Rejilla = { secciones: deteccion.secciones, anillos: 1 };
  const celdas = generarCeldas(rejilla);
  const gaps = generarGaps(rejilla);
  const franjaGap = calcularFranjaGap(rejilla);

  const patronesRuna: PatronRuna[] = runas
    .map((r) => ({ runaId: r.id, nombre: r.nombre, trazos: r.patron_trazos ?? [] }))
    .filter((p) => p.trazos.length > 0);
  const patronesGap: PatronRuna[] = patronesSeparadores(plantillasSeparadores);

  // Trazos candidatos a "contenido" (runa o separador): todo lo que NO
  // fue clasificado como contorno ni como línea de sección en la pasada
  // 1 — esos ya cumplieron su rol estructural y no vuelven a evaluarse acá.
  const indicesEstructurales = new Set<number>([
    deteccion.indiceContorno,
    ...deteccion.indicesSecciones,
  ]);
  const trazosContenido = trazos
    .map((trazo, indice) => ({ trazo, indice }))
    .filter(({ indice }) => !indicesEstructurales.has(indice));

  const trazosPorCelda = new Map<string, TrazoLibre[]>();
  const trazosPorGap = new Map<string, TrazoLibre[]>();
  const trazosSinUbicar: TrazoLibre[] = [];

  for (const { trazo } of trazosContenido) {
    if (trazo.length < 2) continue;
    const centroideP = centroideTrazo(trazo);
    const anguloP = angulo(centroideP, deteccion.centro);

    const cercano = gapMasCercano(anguloP, gaps);
    if (cercano && cercano.distancia <= franjaGap) {
      const lista = trazosPorGap.get(cercano.gap.id) ?? [];
      lista.push(trazo);
      trazosPorGap.set(cercano.gap.id, lista);
      continue;
    }

    const celda = celdaParaAngulo(anguloP, celdas);
    if (!celda) {
      trazosSinUbicar.push(trazo);
      continue;
    }
    const lista = trazosPorCelda.get(celda.id) ?? [];
    lista.push(trazo);
    trazosPorCelda.set(celda.id, lista);
  }

  // Si una celda recibió más de un trazo (el jugador re-trazó la runa,
  // o dibujó la runa en más de un gesto), los evaluamos todos contra el
  // motor $1 y nos quedamos con el mejor score individual — no se
  // concatenan los trazos entre sí, cada uno compite por su cuenta.
  const resultadosPorCelda: Record<string, ResultadoCelda> = {};
  const celdaRunaId: Record<string, string> = {};
  for (const celda of celdas) {
    const trazosCelda = trazosPorCelda.get(celda.id);
    if (!trazosCelda || trazosCelda.length === 0) continue;
    if (patronesRuna.length === 0) continue;

    let mejorRanking: ResultadoReconocimiento[] = [];
    for (const trazo of trazosCelda) {
      const ranking = reconocerRuna(trazo, patronesRuna);
      if (ranking[0] && (!mejorRanking[0] || ranking[0].score > mejorRanking[0].score)) {
        mejorRanking = ranking;
      }
    }
    const top = mejorRanking[0];
    const mejorMatch =
      top && top.score >= UMBRAL_CONFIANZA
        ? (runas.find((r) => r.id === top.runaId) ?? null)
        : null;
    resultadosPorCelda[celda.id] = { celda, ranking: mejorRanking, mejorMatch };
    if (mejorMatch) celdaRunaId[celda.id] = mejorMatch.id;
  }

  const resultadosPorGap: Record<string, ResultadoGap> = {};
  const separadorPorGap: Record<string, TipoSeparador | undefined> = {};
  for (const gap of gaps) {
    const trazosGap = trazosPorGap.get(gap.id);
    if (!trazosGap || trazosGap.length === 0) continue;

    let mejorRanking: ResultadoReconocimiento[] = [];
    for (const trazo of trazosGap) {
      const ranking = reconocerRuna(trazo, patronesGap);
      if (ranking[0] && (!mejorRanking[0] || ranking[0].score > mejorRanking[0].score)) {
        mejorRanking = ranking;
      }
    }
    const top = mejorRanking[0];
    const tipo = top && top.score >= UMBRAL_CONFIANZA ? (top.runaId as TipoSeparador) : null;
    resultadosPorGap[gap.id] = { gap, ranking: mejorRanking, tipo };
    if (tipo) separadorPorGap[gap.id] = tipo;
  }

  return {
    forma: deteccion.forma,
    rejilla,
    confianzaForma: deteccion.confianza,
    centro: deteccion.centro,
    radio: deteccion.radio,
    resultadosPorCelda,
    resultadosPorGap,
    celdaRunaId,
    separadorPorGap,
    trazosSinUbicar,
  };
}
