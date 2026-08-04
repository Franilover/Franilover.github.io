/**
 * deteccionFormaLibre.ts
 * ────────────────────────
 * Parte 2 del plan "forma/rejilla por combinación + dibujo libre del
 * jugador" — sub-problemas 1 y 2 (contorno + secciones). Anillos (sub-
 * problema 3) queda para una siguiente iteración, con umbrales propios,
 * una vez validado esto con dibujos reales.
 *
 * A diferencia de dollarOneRecognizer.ts (que compara UN trazo cerrado
 * contra plantillas), acá el jugador dibuja VARIOS trazos con roles
 * estructurales distintos — un contorno, y opcionalmente líneas
 * radiales — y hay que interpretarlos geométricamente, no contra una
 * plantilla fija.
 *
 * Estrategia, en dos pasos:
 *
 *   1. Contorno: se toma el trazo cerrado más grande (mayor área) de
 *      todos los trazos dibujados. Se calcula su centro y se mide el
 *      radio en función del ángulo. Si el radio es ~constante →
 *      círculo. Si tiene N mínimos/máximos periódicos → polígono de N
 *      lados. "Cerrado" se define con tolerancia: el punto final debe
 *      estar cerca del inicial relativo al tamaño del trazo — un
 *      dedo en mobile no cierra un círculo exactamente.
 *
 *   2. Secciones: cada trazo que NO es el contorno se evalúa como
 *      posible línea radial — un trazo aproximadamente recto que va
 *      desde cerca del centro hacia el borde (o cruza por el centro,
 *      de borde a borde). La cantidad de líneas radiales encontradas
 *      define `secciones` (si hay 0, `secciones = 1`: sin dividir).
 *
 * Ninguno de los umbrales acá es definitivo — están comentados con la
 * intención de cada uno para que sea fácil recalibrarlos una vez que
 * haya dibujos reales de prueba (mano/dedo en mobile es más ruidoso
 * que mouse en desktop).
 *
 * Ruta destino:
 *   src/features/garliaPublic/runas/deteccionFormaLibre.ts
 */

import type { Punto } from "./dollarOneRecognizer";
import { FORMA_CIRCULO, type FormaLimite } from "./formasLimite";

export type TrazoLibre = Punto[];

export type FormaDetectada = {
  forma: FormaLimite;
  /** Centro estimado del contorno, en las mismas coordenadas que los trazos de entrada. */
  centro: Punto;
  /** Radio promedio estimado del contorno. */
  radio: number;
  /** Cuántas líneas radiales se interpretaron como separadores de sección. */
  secciones: number;
  /**
   * Qué tan confiable es la lectura, 0 a 1. Pensado para decidir si
   * mostrarle al jugador "interpretamos: círculo, 3 secciones" con
   * confianza, o pedirle que redibuje. No es un score estadístico
   * riguroso — es una heurística simple (ver calcularConfianza).
   */
  confianza: number;
  /** Cuál de los trazos de entrada se interpretó como el contorno (índice en la lista original). */
  indiceContorno: number;
  /** Índices de los trazos interpretados como líneas radiales de sección. */
  indicesSecciones: number[];
  /** Trazos que no se pudieron clasificar como contorno ni como sección — se ignoran, pero se listan para debug/feedback. */
  indicesIgnorados: number[];
};

function distancia(a: Punto, b: Punto): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function longitud(trazo: TrazoLibre): number {
  let d = 0;
  for (let i = 1; i < trazo.length; i++) d += distancia(trazo[i - 1], trazo[i]);
  return d;
}

function centroide(trazo: TrazoLibre): Punto {
  const x = trazo.reduce((s, p) => s + p.x, 0) / trazo.length;
  const y = trazo.reduce((s, p) => s + p.y, 0) / trazo.length;
  return { x, y };
}

/** Área con la fórmula del "shoelace" (asume trazo aprox. cerrado). Siempre positiva. */
function areaAproximada(trazo: TrazoLibre): number {
  let area = 0;
  for (let i = 0; i < trazo.length; i++) {
    const a = trazo[i];
    const b = trazo[(i + 1) % trazo.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/**
 * ¿Este trazo está "cerrado"? — el punto final vuelve a estar cerca del
 * inicial, en relación al tamaño del propio trazo (no un umbral fijo en
 * píxeles: un círculo grande y uno chico deben tolerar el mismo % de
 * imprecisión relativa).
 */
const TOLERANCIA_CIERRE = 0.25; // el gap final-inicio puede ser hasta 25% del "radio" del trazo
function estaCerrado(trazo: TrazoLibre): boolean {
  if (trazo.length < 8) return false;
  const inicio = trazo[0];
  const fin = trazo[trazo.length - 1];
  const c = centroide(trazo);
  const radioAprox = trazo.reduce((s, p) => s + distancia(p, c), 0) / trazo.length;
  if (radioAprox < 1e-6) return false;
  return distancia(inicio, fin) <= radioAprox * TOLERANCIA_CIERRE;
}

/**
 * Elige, entre todos los trazos, el que mejor pinta tiene de ser el
 * contorno exterior: debe estar cerrado, y entre los cerrados se toma
 * el de mayor área (un separador radial no es un trazo cerrado, así
 * que ya queda afuera por el primer filtro casi siempre; el área es
 * desempate si hubiera más de un trazo cerrado, ej. el jugador re-trazó
 * el contorno duplicado sin querer).
 */
function elegirContorno(trazos: TrazoLibre[]): number | null {
  let mejorIndice: number | null = null;
  let mejorArea = -Infinity;
  trazos.forEach((trazo, i) => {
    if (!estaCerrado(trazo)) return;
    const area = areaAproximada(trazo);
    if (area > mejorArea) {
      mejorArea = area;
      mejorIndice = i;
    }
  });
  return mejorIndice;
}

const NUM_MUESTRAS_RADIO = 72; // cada 5°

/** Muestrea el radio del contorno en `n` ángulos equiespaciados alrededor del centro. */
function muestrearRadioPorAngulo(
  trazo: TrazoLibre,
  centro: Punto,
  n: number,
): number[] {
  // Para cada muestra angular, tomamos el punto del trazo más cercano a
  // ese ángulo (no una intersección exacta — alcanza para el propósito
  // de detectar forma, y es robusto a que el trazo no sea perfectamente
  // estrella-convexo respecto del centro).
  const angulos = trazo.map((p) => Math.atan2(p.y - centro.y, p.x - centro.x));
  const radios = trazo.map((p) => distancia(p, centro));

  const muestras: number[] = [];
  for (let i = 0; i < n; i++) {
    const anguloObjetivo = -Math.PI + (i / n) * 2 * Math.PI;
    let mejorIdx = 0;
    let mejorDiff = Infinity;
    for (let j = 0; j < angulos.length; j++) {
      let diff = Math.abs(angulos[j] - anguloObjetivo);
      if (diff > Math.PI) diff = 2 * Math.PI - diff; // distancia angular circular
      if (diff < mejorDiff) {
        mejorDiff = diff;
        mejorIdx = j;
      }
    }
    muestras.push(radios[mejorIdx]);
  }
  return muestras;
}

/**
 * Clasifica el contorno como círculo o polígono de N lados, a partir de
 * su perfil radio(ángulo).
 *
 * Círculo: el radio es ~constante en todos los ángulos (baja desviación
 * relativa). Polígono regular de N lados: el radio tiene exactamente N
 * mínimos locales (los puntos medios de cada lado, más cerca del
 * centro) y N máximos locales (los vértices, más lejos) — se cuentan
 * los mínimos vía cruces de la señal suavizada por debajo de su propio
 * promedio, ya que contar picos crudos es muy sensible al ruido de un
 * trazo a mano.
 */
const UMBRAL_DESVIACION_CIRCULO = 0.09; // desviación relativa (std/mean) por debajo de esto = círculo
const MIN_LADOS_DETECTABLES = 3;
const MAX_LADOS_DETECTABLES = 10;

function detectarFormaContorno(muestras: number[]): { forma: FormaLimite; confianzaForma: number } {
  const media = muestras.reduce((s, r) => s + r, 0) / muestras.length;
  const varianza = muestras.reduce((s, r) => s + (r - media) ** 2, 0) / muestras.length;
  const desviacionRelativa = Math.sqrt(varianza) / (media || 1);

  if (desviacionRelativa < UMBRAL_DESVIACION_CIRCULO) {
    // Cuanto menor la desviación, más confiado el círculo.
    const confianzaForma = Math.max(0, 1 - desviacionRelativa / UMBRAL_DESVIACION_CIRCULO);
    return { forma: FORMA_CIRCULO, confianzaForma };
  }

  // Suavizado simple (media móvil) para no contar mínimos espurios por
  // el temblor del trazo, antes de contar cuántas veces la señal cruza
  // por debajo de su propio promedio (cada cruce descendente = un lado).
  const suavizado = suavizarSenal(muestras, 3);
  const promedioSuavizado = suavizado.reduce((s, r) => s + r, 0) / suavizado.length;

  let cruces = 0;
  for (let i = 0; i < suavizado.length; i++) {
    const actual = suavizado[i];
    const siguiente = suavizado[(i + 1) % suavizado.length];
    if (actual >= promedioSuavizado && siguiente < promedioSuavizado) cruces++;
  }

  const lados = Math.min(MAX_LADOS_DETECTABLES, Math.max(MIN_LADOS_DETECTABLES, cruces));
  // Confianza más floja acá: contar lados de un polígono dibujado a mano
  // es más ruidoso que distinguir "es o no es círculo". Si `cruces` cayó
  // fuera del rango detectable, ya perdimos precisión.
  const confianzaForma = cruces >= MIN_LADOS_DETECTABLES && cruces <= MAX_LADOS_DETECTABLES ? 0.7 : 0.4;
  return { forma: { tipo: "poligono", lados }, confianzaForma };
}

function suavizarSenal(valores: number[], radioVentana: number): number[] {
  const n = valores.length;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let suma = 0;
    let cuenta = 0;
    for (let k = -radioVentana; k <= radioVentana; k++) {
      suma += valores[(i + k + n) % n];
      cuenta++;
    }
    out.push(suma / cuenta);
  }
  return out;
}

/**
 * ¿Este trazo (que no es el contorno) tiene pinta de línea radial de
 * sección? Se evalúan dos formas válidas de trazarla:
 *   - del centro hacia el borde (empieza cerca del centro)
 *   - de borde a borde, cruzando cerca del centro (el jugador la trazó
 *     completa de punta a punta en vez de solo la mitad)
 * En ambos casos, exigimos que el trazo sea razonablemente recto
 * (poca curvatura) — si no, es más probable que sea ruido o un trazo
 * mal interpretado como línea.
 */
const TOLERANCIA_CERCA_CENTRO = 0.35; // qué tan cerca del centro cuenta como "empieza/pasa por el centro", relativo al radio
const TOLERANCIA_RECTITUD = 0.85; // longitud recta (extremo a extremo) / longitud recorrida del trazo — 1.0 = perfectamente recta

function esLineaRadial(trazo: TrazoLibre, centro: Punto, radio: number): boolean {
  if (trazo.length < 2) return false;
  const inicio = trazo[0];
  const fin = trazo[trazo.length - 1];
  const largoRecorrido = longitud(trazo);
  const largoRecto = distancia(inicio, fin);
  if (largoRecorrido < 1e-6) return false;

  const rectitud = largoRecto / largoRecorrido;
  if (rectitud < TOLERANCIA_RECTITUD) return false;

  const distInicioCentro = distancia(inicio, centro);
  const distFinCentro = distancia(fin, centro);
  const umbralCentro = radio * TOLERANCIA_CERCA_CENTRO;

  // Caso "centro → borde": un extremo está cerca del centro y el otro
  // lejos (hacia el borde).
  const centroABorde =
    (distInicioCentro <= umbralCentro && distFinCentro > umbralCentro) ||
    (distFinCentro <= umbralCentro && distInicioCentro > umbralCentro);
  if (centroABorde) return true;

  // Caso "borde a borde pasando por el centro": el punto del trazo más
  // cercano al centro está efectivamente cerca, y ambos extremos están
  // lejos (son los dos bordes).
  const distanciaMinAlCentro = Math.min(...trazo.map((p) => distancia(p, centro)));
  const ambosLejos = distInicioCentro > umbralCentro && distFinCentro > umbralCentro;
  return ambosLejos && distanciaMinAlCentro <= umbralCentro;
}

/**
 * Agrupa líneas radiales que quedaron muy cerca en ángulo (el jugador
 * "repasó" la misma línea con dos gestos) para no contarlas dos veces.
 */
const TOLERANCIA_ANGULO_DUPLICADO = (10 * Math.PI) / 180; // 10°

function anguloLinea(trazo: TrazoLibre, centro: Punto): number {
  // Ángulo del extremo más lejano al centro (el que está "sobre el
  // borde"), que es más estable que promediar todo el trazo.
  const extremoLejano = trazo.reduce((mejor, p) =>
    distancia(p, centro) > distancia(mejor, centro) ? p : mejor,
  );
  return Math.atan2(extremoLejano.y - centro.y, extremoLejano.x - centro.x);
}

function agruparAngulosCercanos(angulos: number[]): number {
  if (angulos.length === 0) return 0;
  const ordenados = [...angulos].sort((a, b) => a - b);
  let grupos = 1;
  for (let i = 1; i < ordenados.length; i++) {
    if (ordenados[i] - ordenados[i - 1] > TOLERANCIA_ANGULO_DUPLICADO) grupos++;
  }
  // Chequeo cíclico: el último y el primero también pueden ser "el mismo"
  // grupo si el círculo se cierra justo ahí.
  if (
    grupos > 1 &&
    2 * Math.PI - (ordenados[ordenados.length - 1] - ordenados[0]) <= TOLERANCIA_ANGULO_DUPLICADO
  ) {
    grupos--;
  }
  return grupos;
}

const MAX_SECCIONES_DETECTABLES = 8;

/**
 * Punto de entrada: recibe todos los trazos que el jugador dibujó (en
 * el orden en que los dibujó, sin importar) y devuelve la interpretación
 * geométrica, o `null` si no se pudo identificar ni un contorno.
 */
export function detectarFormaLibre(trazos: TrazoLibre[]): FormaDetectada | null {
  const trazosValidos = trazos.filter((t) => t.length >= 2);
  if (trazosValidos.length === 0) return null;

  const indiceContorno = elegirContorno(trazosValidos);
  if (indiceContorno === null) return null;

  const contorno = trazosValidos[indiceContorno];
  const centro = centroide(contorno);
  const radioPromedio = contorno.reduce((s, p) => s + distancia(p, centro), 0) / contorno.length;

  const muestras = muestrearRadioPorAngulo(contorno, centro, NUM_MUESTRAS_RADIO);
  const { forma, confianzaForma } = detectarFormaContorno(muestras);

  const indicesSecciones: number[] = [];
  const indicesIgnorados: number[] = [];
  const angulosLineas: number[] = [];

  trazosValidos.forEach((trazo, i) => {
    if (i === indiceContorno) return;
    if (esLineaRadial(trazo, centro, radioPromedio)) {
      indicesSecciones.push(i);
      angulosLineas.push(anguloLinea(trazo, centro));
    } else {
      indicesIgnorados.push(i);
    }
  });

  const secciones = Math.max(
    1,
    Math.min(MAX_SECCIONES_DETECTABLES, agruparAngulosCercanos(angulosLineas)),
  );

  // Confianza global: promedio pesado entre qué tan clara fue la forma
  // del contorno y qué tan "limpias" fueron las líneas de sección
  // (menos trazos ignorados = más limpio). Es una heurística para UI,
  // no una medida estadística — ver FormaDetectada.confianza.
  const totalNoContorno = trazosValidos.length - 1;
  const proporcionLimpia =
    totalNoContorno === 0 ? 1 : indicesSecciones.length / totalNoContorno;
  const confianza = 0.6 * confianzaForma + 0.4 * proporcionLimpia;

  return {
    forma,
    centro,
    radio: radioPromedio,
    secciones,
    confianza,
    indiceContorno,
    indicesSecciones,
    indicesIgnorados,
  };
}
