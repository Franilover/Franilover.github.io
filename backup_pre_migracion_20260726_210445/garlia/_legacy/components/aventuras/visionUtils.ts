/**
 * visionUtils
 * ───────────────────────────────────────────────────────────────────────────
 * Line-of-sight real (raycasting) para la niebla de guerra de /aventura.
 * Todo trabaja en las mismas coordenadas lógicas (px sin escalar por zoom)
 * que pos_x/pos_y en el resto del tablero.
 *
 * Algoritmo: "ray casting a los vértices" (variante simple de shadowcasting
 * en 2D, suficiente para formas rectangulares/circulares en un tablero
 * chico). Para cada obstáculo se sacan sus segmentos; para cada vértice de
 * cada segmento se disparan 3 rayos (al vértice, y levemente rotados a cada
 * lado) desde el origen de visión; se calcula la intersección más cercana
 * de cada rayo contra TODOS los segmentos; los puntos de impacto, ordenados
 * por ángulo, forman el polígono de "lo visible" — que se puede pintar
 * directo como un <polygon> y usarlo de máscara SVG.
 */

export interface Obstaculo {
  id: string;
  forma: "rect" | "circulo";
  pos_x: number;
  pos_y: number;
  ancho: number;
  alto: number;
}

interface Punto {
  x: number;
  y: number;
}

interface Segmento {
  a: Punto;
  b: Punto;
}

/** Circulo aproximado a un polígono de N lados — así reusa la misma
 *  lógica de segmentos que un rectángulo, sin caso especial en el resto
 *  del algoritmo. 16 lados alcanza para que se vea redondo a la escala
 *  del tablero. */
const LADOS_CIRCULO = 16;

function segmentosDeObstaculo(o: Obstaculo): Segmento[] {
  if (o.forma === "circulo") {
    const cx = o.pos_x + o.ancho / 2;
    const cy = o.pos_y + o.ancho / 2;
    const r = o.ancho / 2;
    const puntos: Punto[] = [];
    for (let i = 0; i < LADOS_CIRCULO; i++) {
      const ang = (i / LADOS_CIRCULO) * Math.PI * 2;
      puntos.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
    }
    return puntos.map((p, i) => ({ a: p, b: puntos[(i + 1) % puntos.length] }));
  }
  const x0 = o.pos_x;
  const y0 = o.pos_y;
  const x1 = o.pos_x + o.ancho;
  const y1 = o.pos_y + o.alto;
  const esquinas: Punto[] = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  return esquinas.map((p, i) => ({ a: p, b: esquinas[(i + 1) % esquinas.length] }));
}

/** Borde exterior del área visible total (el "mundo" del raycasting no
 *  puede ser infinito: se acota al lienzo, si no un rayo que no pega
 *  contra nada nunca terminaría de dibujarse). */
function segmentosDeBorde(w: number, h: number): Segmento[] {
  const esquinas: Punto[] = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  return esquinas.map((p, i) => ({ a: p, b: esquinas[(i + 1) % esquinas.length] }));
}

/** Intersección rayo (origen + dirección) contra segmento a-b. Devuelve la
 *  distancia t a lo largo del rayo, o null si no intersecta.
 *
 *  BUG HISTÓRICO (niebla que "dejaba ver" o tapaba de más donde no
 *  debía): la versión anterior despejaba t1 dividiendo por r_dx (o r_dy si
 *  r_dx era 0) como paso separado después de calcular t2. Con rayos casi
 *  verticales/horizontales o segmentos muy largos (como el borde del
 *  canvas, miles de px), esa división arrastraba error de punto flotante
 *  y en algunos ángulos devolvía un t1 falso ≈0 (o negativo) para un
 *  segmento que en realidad estaba MUY lejos y en la dirección opuesta —
 *  el rayo se cortaba corto donde no debía, generando huecos en el
 *  polígono de visibilidad (se veía a través de zonas bloqueadas) o
 *  cuñas que tapaban de más.
 *
 *  Esta versión usa la parametrización estándar rayo-segmento con una
 *  sola división (mismo denominador `rxs` para t y u), que es la forma
 *  numéricamente estable de este cálculo — no hay una segunda división
 *  separada que pueda desalinearse del resultado de la primera. */
function interseccionRayo(origen: Punto, dir: Punto, seg: Segmento): number | null {
  const s = { x: seg.b.x - seg.a.x, y: seg.b.y - seg.a.y };
  const rxs = dir.x * s.y - dir.y * s.x;
  if (Math.abs(rxs) < 1e-9) return null; // paralelos (o segmento degenerado)

  const qp = { x: seg.a.x - origen.x, y: seg.a.y - origen.y };
  const t = (qp.x * s.y - qp.y * s.x) / rxs; // distancia a lo largo del rayo
  const u = (qp.x * dir.y - qp.y * dir.x) / rxs; // posición a lo largo del segmento [0,1]

  // Pequeño margen negativo en vez de comparar contra 0 exacto: evita
  // descartar por error de redondeo una intersección real justo en el
  // origen o en el borde del segmento (mismo espíritu que el EPS angular
  // que ya usa calcularPoligonoVisibilidad).
  if (t < 1e-9) return null; // detrás del origen (o en el origen mismo)
  if (u < -1e-6 || u > 1 + 1e-6) return null; // fuera del segmento

  return t;
}

/**
 * Calcula el polígono de visibilidad desde `origen` contra la lista de
 * obstáculos, acotado al rectángulo [0,0,canvasW,canvasH].
 * Devuelve los vértices en orden angular, listos para un <polygon points="...">.
 */
export function calcularPoligonoVisibilidad(
  origen: Punto,
  obstaculos: Obstaculo[],
  canvasW: number,
  canvasH: number,
): Punto[] {
  const segmentos: Segmento[] = [
    ...segmentosDeBorde(canvasW, canvasH),
    ...obstaculos.flatMap(segmentosDeObstaculo),
  ];

  // Ángulos únicos a probar: cada vértice de cada segmento, +/- un épsilon
  // angular (así el rayo "roza" el borde del obstáculo en vez de pasar
  // justo por el vértice, donde el resultado es numéricamente inestable).
  // EPS un poco más grande que antes (además del fix de interseccionRayo)
  // para tener más margen de maniobra frente a errores de redondeo en
  // canvases grandes (miles de px de segmento de borde).
  const EPS = 0.0003;
  const angulosRaw = new Set<number>();
  for (const seg of segmentos) {
    for (const p of [seg.a, seg.b]) {
      const ang = Math.atan2(p.y - origen.y, p.x - origen.x);
      angulosRaw.add(ang - EPS);
      angulosRaw.add(ang);
      angulosRaw.add(ang + EPS);
    }
  }
  // Deduplica ángulos casi idénticos (distintos vértices pueden generar el
  // mismo ángulo con un error de redondeo mínimo): sin esto, dos ángulos a
  // 1e-12 de distancia pueden calcular impactos contra segmentos distintos
  // por pura casualidad de qué segmento "gana" el mejorT en cada uno,
  // generando un zigzag espurio de 1px en el polígono. Ordenando primero,
  // alcanza con comparar cada uno contra el último aceptado.
  const angulosOrdenados = Array.from(angulosRaw).sort((a, b) => a - b);
  const angulos: number[] = [];
  const MIN_SEPARACION = 1e-7;
  for (const ang of angulosOrdenados) {
    if (angulos.length === 0 || ang - angulos[angulos.length - 1] > MIN_SEPARACION) {
      angulos.push(ang);
    }
  }

  const puntosImpacto: (Punto & { ang: number })[] = [];
  for (const ang of angulos) {
    const dir = { x: Math.cos(ang), y: Math.sin(ang) };
    let mejorT = Infinity;
    for (const seg of segmentos) {
      const t = interseccionRayo(origen, dir, seg);
      if (t !== null && t < mejorT) mejorT = t;
    }
    if (mejorT === Infinity) continue;
    puntosImpacto.push({
      x: origen.x + dir.x * mejorT,
      y: origen.y + dir.y * mejorT,
      ang,
    });
  }

  puntosImpacto.sort((a, b) => a.ang - b.ang);
  return puntosImpacto.map((p) => ({ x: p.x, y: p.y }));
}

// ── Memoria de exploración: grilla de celdas ──────────────────────────────

/** Tamaño lógico (px) de cada celda de la grilla de exploración. Más chico
 *  = memoria más precisa pero más celdas guardadas; 48px alcanza y sobra
 *  para el tamaño de token/tarjeta del tablero. */
export const GRID_SIZE = 48;

export function celdaDe(x: number, y: number): string {
  return `${Math.floor(x / GRID_SIZE)},${Math.floor(y / GRID_SIZE)}`;
}

// ── Pathfinding (movimiento con colisión) ─────────────────────────────────
// A* simple sobre la misma grilla de GRID_SIZE que ya usa la memoria de
// exploración de la niebla. Se usa para que un jugador no pueda cruzar
// clickeando "del otro lado" de una pared/río: en vez de moverlo en línea
// recta al punto clickeado, se busca el camino más corto de celda en celda
// que rodee los obstáculos, y se mueve a lo largo de ese camino.

interface CeldaXY {
  cx: number;
  cy: number;
}

/** Todas las celdas de grilla que un obstáculo ocupa (aproximado a su
 *  bounding box — alcanza para bloquear movimiento, no hace falta la
 *  precisión del raycasting de línea de visión). */
function celdasDeObstaculo(o: Obstaculo): CeldaXY[] {
  const x0 = Math.floor(o.pos_x / GRID_SIZE);
  const y0 = Math.floor(o.pos_y / GRID_SIZE);
  const x1 = Math.floor((o.pos_x + o.ancho - 1) / GRID_SIZE);
  const y1 = Math.floor((o.pos_y + o.alto - 1) / GRID_SIZE);
  const celdas: CeldaXY[] = [];
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      celdas.push({ cx, cy });
    }
  }
  return celdas;
}

/** Construye el set de celdas bloqueadas (como "cx,cy") a partir de la
 *  lista de obstáculos que bloquean movimiento. */
export function celdasBloqueadas(obstaculos: Obstaculo[]): Set<string> {
  const set = new Set<string>();
  for (const o of obstaculos) {
    for (const { cx, cy } of celdasDeObstaculo(o)) {
      set.add(`${cx},${cy}`);
    }
  }
  return set;
}

/**
 * Busca el camino más corto en la grilla (A*, 8 direcciones) desde `desde`
 * hasta `hasta` (coordenadas lógicas en px), esquivando `bloqueadas`.
 * Devuelve la lista de puntos (centros de celda, en px lógicos) del camino
 * SIN incluir el punto de partida, o `[]` si no hay camino posible (rodeado
 * por completo) o si el destino cae directo sobre una celda bloqueada (en
 * ese caso se recorta al vecino transitable más cercano al destino).
 * Acotado a un radio de búsqueda razonable alrededor del origen para no
 * explorar un tablero entero si el destino está clickeado lejísimos.
 */
export function buscarCamino(
  desde: Punto,
  hasta: Punto,
  bloqueadas: Set<string>,
  canvasW: number,
  canvasH: number,
): Punto[] {
  const startCx = Math.floor(desde.x / GRID_SIZE);
  const startCy = Math.floor(desde.y / GRID_SIZE);
  let endCx = Math.floor(hasta.x / GRID_SIZE);
  let endCy = Math.floor(hasta.y / GRID_SIZE);

  const maxCx = Math.floor(canvasW / GRID_SIZE);
  const maxCy = Math.floor(canvasH / GRID_SIZE);
  const key = (cx: number, cy: number) => `${cx},${cy}`;

  // Si el destino cae justo sobre una celda bloqueada (clickeó "dentro" de
  // la pared/río), se busca la celda transitable vecina más cercana al
  // origen — así el personaje llega hasta el borde del obstáculo en vez de
  // no moverse en absoluto.
  if (bloqueadas.has(key(endCx, endCy))) {
    let mejor: CeldaXY | null = null;
    let mejorDist = Infinity;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        const cx = endCx + dx;
        const cy = endCy + dy;
        if (cx < 0 || cy < 0 || cx > maxCx || cy > maxCy) continue;
        if (bloqueadas.has(key(cx, cy))) continue;
        const d = Math.hypot(cx - endCx, cy - endCy);
        if (d < mejorDist) {
          mejorDist = d;
          mejor = { cx, cy };
        }
      }
    }
    if (!mejor) return [];
    endCx = mejor.cx;
    endCy = mejor.cy;
  }

  if (startCx === endCx && startCy === endCy) return [];

  // Radio de búsqueda: acota el A* a un cuadrado alrededor de la línea
  // recta origen→destino (con margen), para no recorrer un tablero enorme
  // si el click cayó lejos. Suficiente margen para rodear obstáculos
  // razonablemente grandes sin perder el camino.
  const MARGEN_CELDAS = 12;
  const minCx = Math.max(0, Math.min(startCx, endCx) - MARGEN_CELDAS);
  const maxCxBusqueda = Math.min(maxCx, Math.max(startCx, endCx) + MARGEN_CELDAS);
  const minCy = Math.max(0, Math.min(startCy, endCy) - MARGEN_CELDAS);
  const maxCyBusqueda = Math.min(maxCy, Math.max(startCy, endCy) + MARGEN_CELDAS);

  const heuristica = (cx: number, cy: number) => Math.hypot(cx - endCx, cy - endCy);

  const abiertos = new Map<string, { cx: number; cy: number; f: number }>();
  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  const startKey = key(startCx, startCy);
  gScore.set(startKey, 0);
  abiertos.set(startKey, { cx: startCx, cy: startCy, f: heuristica(startCx, startCy) });

  const cerrados = new Set<string>();
  const endKey = key(endCx, endCy);

  // Límite duro de iteraciones: red de seguridad para que un caso patológico
  // (destino inalcanzable en un mapa grande) no cuelgue el navegador.
  let iteraciones = 0;
  const MAX_ITER = 4000;

  while (abiertos.size > 0 && iteraciones < MAX_ITER) {
    iteraciones++;
    let actualKey = "";
    let actual: { cx: number; cy: number; f: number } | null = null;
    for (const [k, v] of abiertos) {
      if (!actual || v.f < actual.f) {
        actual = v;
        actualKey = k;
      }
    }
    if (!actual) break;
    if (actualKey === endKey) break;
    abiertos.delete(actualKey);
    cerrados.add(actualKey);

    const vecinos = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
    ];
    for (const { dx, dy } of vecinos) {
      const ncx = actual.cx + dx;
      const ncy = actual.cy + dy;
      if (ncx < minCx || ncx > maxCxBusqueda || ncy < minCy || ncy > maxCyBusqueda) continue;
      const nKey = key(ncx, ncy);
      if (cerrados.has(nKey) || bloqueadas.has(nKey)) continue;
      // En movimiento diagonal, evita "cortar la esquina" de dos celdas
      // bloqueadas adyacentes (si no, el camino podría atravesar el
      // vértice exacto donde se tocan dos paredes en diagonal).
      if (dx !== 0 && dy !== 0) {
        if (bloqueadas.has(key(actual.cx + dx, actual.cy)) || bloqueadas.has(key(actual.cx, actual.cy + dy))) {
          continue;
        }
      }
      const costo = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1;
      const gTentativo = (gScore.get(actualKey) ?? Infinity) + costo;
      if (gTentativo < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, actualKey);
        gScore.set(nKey, gTentativo);
        abiertos.set(nKey, { cx: ncx, cy: ncy, f: gTentativo + heuristica(ncx, ncy) });
      }
    }
  }

  if (!gScore.has(endKey)) return []; // no hay camino posible

  // Reconstruye el camino de vuelta desde el destino, y lo invierte.
  const camino: CeldaXY[] = [];
  let k = endKey;
  while (k !== startKey) {
    const [cx, cy] = k.split(",").map(Number);
    camino.push({ cx, cy });
    const prev = cameFrom.get(k);
    if (!prev) break;
    k = prev;
  }
  camino.reverse();

  return camino.map(({ cx, cy }) => ({
    x: cx * GRID_SIZE + GRID_SIZE / 2,
    y: cy * GRID_SIZE + GRID_SIZE / 2,
  }));
}


/** Punto está dentro del polígono de visibilidad (ray casting par/impar). */
function puntoEnPoligono(p: Punto, poligono: Punto[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const xi = poligono[i].x;
    const yi = poligono[i].y;
    const xj = poligono[j].x;
    const yj = poligono[j].y;
    const interseca =
      yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (interseca) dentro = !dentro;
  }
  return dentro;
}

/** Todas las celdas de la grilla, dentro de un radio razonable del origen,
 *  cuyo centro cae dentro del polígono de visibilidad actual — son las
 *  que se agregan a la memoria de exploración de este jugador. */
export function celdasVisiblesEnPoligono(
  poligono: Punto[],
  canvasW: number,
  canvasH: number,
): string[] {
  if (poligono.length === 0) return [];
  const xs = poligono.map((p) => p.x);
  const ys = poligono.map((p) => p.y);
  const minX = Math.max(0, Math.floor(Math.min(...xs) / GRID_SIZE) * GRID_SIZE);
  const maxX = Math.min(canvasW, Math.ceil(Math.max(...xs) / GRID_SIZE) * GRID_SIZE);
  const minY = Math.max(0, Math.floor(Math.min(...ys) / GRID_SIZE) * GRID_SIZE);
  const maxY = Math.min(canvasH, Math.ceil(Math.max(...ys) / GRID_SIZE) * GRID_SIZE);

  const celdas: string[] = [];
  for (let x = minX; x < maxX; x += GRID_SIZE) {
    for (let y = minY; y < maxY; y += GRID_SIZE) {
      const centro = { x: x + GRID_SIZE / 2, y: y + GRID_SIZE / 2 };
      if (puntoEnPoligono(centro, poligono)) {
        celdas.push(celdaDe(centro.x, centro.y));
      }
    }
  }
  return celdas;
}
