"use client";

/**
 * TableroAventura
 * ───────────────────────────────────────────────────────────────────────────
 * Pizarrón libre: cada entidad de la aventura es una tarjeta (imagen grande +
 * texto al lado) que se puede arrastrar a cualquier posición (x, y libres,
 * no grid fijo). Se usa en dos modos:
 *
 *   - editable=true  (admin, AventuraSection): el DM puede arrastrar cada
 *     tarjeta para reordenar/reubicar el tablero. Al soltar, persiste
 *     pos_x/pos_y vía onMove.
 *   - editable=false (público, /garlia/aventura): mismas posiciones, solo
 *     lectura — clickeable para abrir el detalle.
 *
 * Las posiciones son coordenadas libres en píxeles dentro de un lienzo con
 * scroll (no un grid). Si un item no tiene pos_x/pos_y todavía (recién
 * agregado), se le asigna una posición en cascada automática.
 */

import { BookOpen, UserRound } from "lucide-react";
import React, { useId, useMemo, useRef, useState } from "react";

import {
  calcularPoligonoVisibilidad,
  celdaDe,
  celdasVisiblesEnPoligono,
  GRID_SIZE,
  type Obstaculo,
} from "./visionUtils";

const CANVAS_MIN_W = 1400;
const CANVAS_MIN_H = 900;

/**
 * Tamaño estándar de tarjeta, compartido entre admin y público para que el
 * tablero se vea (y se posicione) exactamente igual en los dos lados.
 * Si necesitás otro tamaño en algún lugar, mejor ajustar esto que pasar
 * valores sueltos — así no se vuelven a desincronizar.
 */
export const TABLERO_CARD_SIZE = { width: 360, height: 140, imageWidth: 140 };

/** Tamaño del círculo-ficha (token) del propio personaje del jugador en el
 *  pizarrón — mismo diámetro tanto si tiene foto como si muestra el ícono
 *  de persona por defecto. */
export const TABLERO_TOKEN_SIZE = 64;

/** Tamaño mínimo al que se puede achicar una tarjeta con el handle de resize. */
const MIN_RESIZE_W = 140;
const MIN_RESIZE_H = 90;

export interface TableroItem {
  id: string;
  nombre: string;
  imagen_url: string | null;
  subtitulo?: string | null;
  pos_x: number | null;
  pos_y: number | null;
  destacado?: boolean;
  /** Tamaño custom en px lógicos (sin escalar por zoom). Si están seteados,
   *  reemplazan a cardWidth/cardHeight para ESTA tarjeta puntual — así un
   *  reino se puede agrandar/achicar sin afectar al resto del tablero. */
  ancho?: number | null;
  alto?: number | null;
  /** Si está seteado, la tarjeta se dibuja con un indicador de "contenida
   *  dentro de" otra entidad (ej. un personaje dentro de un reino). Solo
   *  afecta al render (borde/badge) — el posicionamiento sigue siendo
   *  libre en coordenadas absolutas del canvas. */
  contenedorId?: string | null;
  /** Nombre del grupo/horda al que pertenece (ej. "Horda de goblins").
   *  Items que comparten el mismo grupoNombre se dibujan como un solo
   *  bloque apilado (una tarjeta "líder" al frente + un par de bordes
   *  detrás simulando profundidad + contador ×N), en vez de una tarjeta
   *  por cada uno. Solo afecta al render — cada item sigue existiendo por
   *  separado en los datos y se puede arrastrar fuera del grupo. */
  grupoNombre?: string | null;
}

export interface TableroObstaculo extends Obstaculo {
  tipo: "pared" | "rio" | "bosque";
  /** Si es false, el obstáculo es puramente decorativo: se dibuja igual
   *  pero no bloquea line-of-sight en el cálculo de niebla. */
  bloqueaVision: boolean;
}

const OBSTACULO_ESTILO: Record<TableroObstaculo["tipo"], { fill: string; stroke: string }> = {
  pared: { fill: "rgba(120,113,108,0.55)", stroke: "rgba(87,83,78,0.8)" },
  rio: { fill: "rgba(59,130,246,0.35)", stroke: "rgba(37,99,235,0.7)" },
  bosque: { fill: "rgba(34,197,94,0.35)", stroke: "rgba(21,128,61,0.7)" },
};

interface TableroAventuraProps {
  /** Formas obstructoras (paredes/ríos/bosques) del tablero. Se dibujan
   *  debajo de las tarjetas; si nieblaOrigenId está seteado, además
   *  bloquean line-of-sight para calcular la niebla. */
  obstaculos?: TableroObstaculo[];
  /** Si se pasan (junto con `editable`), cada obstáculo se puede
   *  arrastrar/redimensionar igual que una tarjeta — pensado para el
   *  editor del DM. */
  onMoveObstaculo?: (id: string, x: number, y: number) => void;
  onResizeObstaculo?: (id: string, ancho: number, alto: number) => void;
  onClickObstaculo?: (id: string) => void;
  /** Id del item (típicamente el token del propio jugador) desde donde se
   *  calcula la niebla de guerra. Si es null/undefined, no se dibuja
   *  niebla (el DM, por ejemplo, siempre ve todo). */
  nieblaOrigenId?: string | null;
  /** Celdas de grilla ya exploradas alguna vez (se pintan atenuadas/gris
   *  en vez de negro total, aunque no estén visibles ahora mismo). */
  celdasExploradas?: Set<string>;
  /** Se llama cada vez que se recalcula el polígono de visión, con las
   *  celdas que quedaron visibles ahora — para persistir la memoria de
   *  exploración. */
  onCeldasVisibles?: (celdas: string[]) => void;
  items: TableroItem[];
  editable?: boolean;
  onMove?: (id: string, x: number, y: number) => void;
  onClickItem?: (id: string) => void;
  /** Mantener presionada una tarjeta/token (sin arrastrar) más de
   *  LONG_PRESS_MS: pensado para "ver descripción" sin disparar la acción
   *  normal de onClickItem (ej. entrar en combate). Si se pasa, un click
   *  corto sigue llamando a onClickItem como siempre; solo la presión
   *  larga dispara esto en su lugar. */
  onLongPressItem?: (id: string) => void;
  /** Se dispara al soltar una tarjeta arrastrada (editable=true) sobre
   *  otra tarjeta distinta — sus áreas se solapan lo suficiente al momento
   *  de soltar. Pensado para "arrastrar una criatura sobre otra para
   *  agruparlas en una horda". No interfiere con onMove: si hay
   *  solapamiento se llama a onDropOnItem en vez de onMove (agrupar tiene
   *  prioridad sobre reposicionar libremente encima de otra tarjeta). */
  onDropOnItem?: (draggedId: string, targetId: string) => void;
  /** Se dispara al soltar una tarjeta arrastrada dentro del ÁREA de otra
   *  tarjeta más grande (ej. un personaje soltado sobre un reino
   *  agrandado) — tiene prioridad sobre onDropOnItem (agrupar) y onMove.
   *  Distinto de onDropOnItem: ese es "tarjetas del mismo tamaño que se
   *  tocan" (agrupar en horda); esto es "una tarjeta más chica quedó
   *  geométricamente adentro de una más grande" (contener). Si no se
   *  pasa, cae al comportamiento anterior (onDropOnItem / onMove). */
  onDropInsideContainer?: (draggedId: string, containerId: string) => void;
  /** Al soltar el handle de resize de una tarjeta: nuevo ancho/alto en px
   *  lógicos (ya clampeados a un mínimo razonable). Si se pasa, cualquier
   *  tarjeta no-destacada muestra un handle de resize en su esquina
   *  inferior-derecha (solo en editable). */
  onResizeItem?: (id: string, ancho: number, alto: number) => void;
  /** Click en un punto vacío del lienzo (fuera de cualquier tarjeta):
   *  reporta la posición lógica (ya dividida por zoom, mismas unidades
   *  que pos_x/pos_y). Se usa para "mover con un click" — el jugador
   *  clickea el pizarrón y su ficha salta ahí. No interfiere con el
   *  drag del DM ni con onClickItem de las tarjetas. */
  onCanvasClick?: (x: number, y: number) => void;
  renderBadge?: (item: TableroItem) => React.ReactNode;
  emptyHint?: string;
  /** Ancho de cada tarjeta en px. Default 260 (admin); usar ~360 en público. */
  cardWidth?: number;
  /** Alto de cada tarjeta en px. Default 96 (admin); usar ~140 en público. */
  cardHeight?: number;
  /** Ancho de la imagen dentro de la tarjeta en px. Default = cardHeight. */
  imageWidth?: number;
  /** Zoom del pizarrón completo (1 = 100%). A diferencia de cardWidth/
   *  cardHeight (que cambian el tamaño real de cada tarjeta y su layout
   *  interno), esto escala el lienzo entero con CSS transform: todas las
   *  tarjetas y sus posiciones relativas quedan intactas, solo cambia
   *  cuánto ocupan en pantalla — como el zoom de un mapa. */
  zoom?: number;
  /** Si se pasa, el lienzo se mantiene centrado en este item (típicamente
   *  la propia ficha del jugador): al montar, al cambiar el zoom, y cada
   *  vez que el item se mueve (moverPosicion vía click u onMove), el
   *  scroll se reajusta para que quede en el centro del viewport. No pelea
   *  con el pan manual del usuario en otros momentos — solo re-centra en
   *  esos triggers puntuales, no en cada scroll. */
  centrarEnId?: string | null;
  /** Si es true, arrastrar una tarjeta/token (y el click-to-move del
   *  jugador) queda "imantado" a una grilla de `gridSize` px en vez de
   *  quedar en cualquier posición libre. Además evita actualizar el
   *  estado en cada pixel de movimiento (solo al cruzar una celda), que
   *  es la causa real de la traba/tirones al arrastrar: bastante menos
   *  renders por segundo durante el drag. Default true. */
  snapToGrid?: boolean;
  /** Tamaño de celda en px lógicos cuando snapToGrid está activo. Default
   *  = GRID_SIZE (48px), el mismo tamaño de celda que usa la memoria de
   *  exploración de la niebla — así el movimiento y lo que se "recuerda"
   *  como visto quedan alineados 1 a 1. */
  gridSize?: number;
}

/** Asigna una posición en cascada a los items que todavía no tienen pos_x/pos_y. */
function usePosicionesResueltas(items: TableroItem[], cardW: number, cardH: number) {
  return useMemo(() => {
    let cascadeIndex = 0;
    return items.map((item) => {
      if (item.pos_x !== null && item.pos_y !== null) return item;
      const col = cascadeIndex % 4;
      const row = Math.floor(cascadeIndex / 4);
      cascadeIndex += 1;
      return {
        ...item,
        pos_x: Math.round((24 + col * (cardW + 24)) / GRID_SIZE) * GRID_SIZE,
        pos_y: Math.round((24 + row * (cardH + 24)) / GRID_SIZE) * GRID_SIZE,
      };
    });
  }, [items, cardW, cardH]);
}

export function TableroAventura({
  items,
  editable = false,
  onMove,
  onClickItem,
  onLongPressItem,
  onDropOnItem,
  onDropInsideContainer,
  onResizeItem,
  onCanvasClick,
  renderBadge,
  emptyHint = "Todavía no hay nada aquí.",
  cardWidth = TABLERO_CARD_SIZE.width,
  cardHeight = TABLERO_CARD_SIZE.height,
  imageWidth,
  zoom = 1,
  centrarEnId = null,
  obstaculos = [],
  onMoveObstaculo,
  onResizeObstaculo,
  onClickObstaculo,
  nieblaOrigenId = null,
  celdasExploradas,
  onCeldasVisibles,
  snapToGrid = true,
  gridSize = GRID_SIZE,
}: TableroAventuraProps) {
  const CARD_W = cardWidth;
  const CARD_H = cardHeight;
  const IMG_W = imageWidth ?? TABLERO_CARD_SIZE.imageWidth;
  const resueltos = usePosicionesResueltas(items, CARD_W, CARD_H);
  const containerRef = useRef<HTMLDivElement>(null);
  // IDs únicos para las <mask> de la niebla: si en algún momento hay más
  // de un TableroAventura montado a la vez (o React re-monta uno sin
  // limpiar bien el anterior), un id fijo tipo "niebla-mask-..." podía
  // colisionar entre ambos SVGs y hacer que la máscara de un tablero
  // "se robara" el recorte de visibilidad del otro — otra forma en la que
  // la niebla podía terminar mostrando de más. Con useId cada instancia
  // tiene su propio par de ids, sin importar cuántas haya en la página.
  const maskIdBase = useId();
  const maskIdNuncaVisto = `niebla-mask-nunca-visto-${maskIdBase}`;
  const maskIdPenumbra = `niebla-mask-penumbra-${maskIdBase}`;
  const [dragId, setDragId] = useState<string | null>(null);
  const dragOffset = useRef({ dx: 0, dy: 0 });
  const [livePos, setLivePos] = useState<Record<string, { x: number; y: number }>>({});
  const [dragMoved, setDragMoved] = useState(false);
  // ── Resize: mientras se arrastra el handle de una tarjeta, el tamaño en
  // vivo se guarda acá (mismo patrón que livePos para posición) y recién
  // se persiste vía onResizeItem al soltar.
  const [resizeId, setResizeId] = useState<string | null>(null);
  const [liveSize, setLiveSize] = useState<Record<string, { w: number; h: number }>>({});
  const resizeStart = useRef({ w: 0, h: 0, clientX: 0, clientY: 0 });

  // ── Drag/resize de obstáculos: mismo patrón que items (live state +
  // persistir al soltar), en variables propias para no pisar el drag de
  // tarjetas — un obstáculo y una tarjeta nunca se arrastran a la vez. ──
  const [obsDragId, setObsDragId] = useState<string | null>(null);
  const [obsLivePos, setObsLivePos] = useState<Record<string, { x: number; y: number }>>({});
  const obsDragOffset = useRef({ dx: 0, dy: 0 });
  const [obsDragMoved, setObsDragMoved] = useState(false);
  const [obsResizeId, setObsResizeId] = useState<string | null>(null);
  const [obsLiveSize, setObsLiveSize] = useState<Record<string, { w: number; h: number }>>({});
  const obsResizeStart = useRef({ w: 0, h: 0, clientX: 0, clientY: 0 });

  /** Tamaño efectivo (ya resuelto) de un item: usa su tamaño en vivo si se
   *  está redimensionando ahora mismo, si no su ancho/alto custom guardado,
   *  y si no el tamaño estándar de tarjeta. Los tokens (destacado) ignoran
   *  todo esto — mantienen siempre TABLERO_TOKEN_SIZE. */
  const tamanoEfectivo = (item: TableroItem): { w: number; h: number } => {
    if (item.destacado) return { w: TABLERO_TOKEN_SIZE, h: TABLERO_TOKEN_SIZE };
    const live = liveSize[item.id];
    if (live) return { w: live.w, h: live.h };
    const w = item.ancho ?? (item.imagen_url ? CARD_H : CARD_W);
    const h = item.alto ?? CARD_H;
    return { w, h };
  };
  // ── Long press: si el pointer se mantiene quieto (sin drag) sobre una
  // tarjeta/token por LONG_PRESS_MS, se dispara onLongPressItem en vez de
  // la acción normal de click. Se cancela si hay drag o si se suelta
  // antes. `longPressFiredRef` evita que handlePointerUp además ejecute
  // el onClickItem normal cuando ya disparamos el long press.
  const LONG_PRESS_MS = 500;
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const dragMovedRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const canvasW = Math.max(
    CANVAS_MIN_W,
    ...resueltos.map((i) => (i.pos_x ?? 0) + tamanoEfectivo(i).w + 60),
  );
  const canvasH = Math.max(
    CANVAS_MIN_H,
    ...resueltos.map((i) => (i.pos_y ?? 0) + tamanoEfectivo(i).h + 60),
  );

  /** Redondea una coordenada a la grilla activa. Además de "imantar" el
   *  movimiento, esto es lo que corta la traba real: sin esto, cada
   *  pixel de pointermove dispara un setState + re-render completo del
   *  tablero; con el snap, solo se actualiza el estado (y por lo tanto
   *  se re-renderiza) al cruzar el borde de una celda — muchísimas menos
   *  actualizaciones por segundo mientras se arrastra. */
  const snap = (v: number) => (snapToGrid ? Math.round(v / gridSize) * gridSize : v);

  /** Tamaño efectivo de un obstáculo (usa el tamaño en vivo si se está
   *  redimensionando ahora mismo). */
  const tamanoObstaculo = (o: TableroObstaculo): { w: number; h: number } => {
    const live = obsLiveSize[o.id];
    if (live) return { w: live.w, h: live.h };
    return { w: o.ancho, h: o.alto };
  };

  // ── Polígono de visibilidad (niebla): se recalcula cada vez que cambia
  // el origen (posición del token) o los obstáculos. Solo tiene sentido
  // si se pasó nieblaOrigenId (el DM no lo pasa nunca — siempre ve todo). ──
  const origenNiebla = nieblaOrigenId ? resueltos.find((i) => i.id === nieblaOrigenId) : undefined;
  const origenX = origenNiebla ? (livePos[origenNiebla.id]?.x ?? origenNiebla.pos_x ?? 0) : null;
  const origenY = origenNiebla ? (livePos[origenNiebla.id]?.y ?? origenNiebla.pos_y ?? 0) : null;

  const poligonoVisible = useMemo(() => {
    if (!nieblaOrigenId || origenX === null || origenY === null || !origenNiebla) return null;
    const centroX = origenX + (origenNiebla.destacado ? 0 : tamanoEfectivo(origenNiebla).w / 2);
    const centroY = origenY + (origenNiebla.destacado ? 0 : tamanoEfectivo(origenNiebla).h / 2);
    return calcularPoligonoVisibilidad(
      { x: centroX, y: centroY },
      obstaculos
        .filter((o) => o.bloqueaVision)
        .map((o) => ({
          id: o.id,
          forma: o.forma,
          pos_x: obsLivePos[o.id]?.x ?? o.pos_x,
          pos_y: obsLivePos[o.id]?.y ?? o.pos_y,
          ancho: tamanoObstaculo(o).w,
          alto: tamanoObstaculo(o).h,
        })),
      canvasW,
      canvasH,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nieblaOrigenId, origenX, origenY, obstaculos, obsLivePos, obsLiveSize, canvasW, canvasH]);

  // Reporta las celdas recién visibles al padre (para que persista la
  // memoria de exploración) cada vez que el polígono cambia de verdad.
  React.useEffect(() => {
    if (!poligonoVisible || !onCeldasVisibles) return;
    const celdas = celdasVisiblesEnPoligono(poligonoVisible, canvasW, canvasH);
    onCeldasVisibles(celdas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poligonoVisible]);

  // ── Auto-centrado en el propio personaje ──────────────────────────────
  // Mantiene al jugador siempre orientado: su ficha queda en el centro del
  // viewport sin importar cuánto haga zoom o hacia dónde se mueva. Se
  // re-centra en tres momentos puntuales (no en cada scroll, para no pelear
  // con un pan manual que el usuario quisiera hacer mientras mira el
  // pizarrón): al montar/cambiar de item objetivo, cuando cambia el zoom,
  // y cuando el item objetivo cambia de posición lógica (se movió, sea por
  // click propio o porque llegó por realtime).
  const itemCentrado = centrarEnId
    ? resueltos.find((i) => i.id === centrarEnId)
    : undefined;
  const centroX = itemCentrado?.pos_x ?? null;
  const centroY = itemCentrado?.pos_y ?? null;

  React.useEffect(() => {
    return () => clearLongPressTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Limpia liveSize apenas el tamaño persistido (item.ancho/alto) coincide
  // con lo que ya mostrábamos en vivo — así no queda un tamaño "fantasma"
  // colgado para siempre si el padre no vuelve a renderizar por alguna razón.
  React.useEffect(() => {
    setLiveSize((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of Object.keys(prev)) {
        if (id === resizeId) continue; // sigue en curso, no tocar
        const item = items.find((i) => i.id === id);
        if (!item) continue;
        if (item.ancho === prev[id].w && item.alto === prev[id].h) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [items, resizeId]);

  React.useEffect(() => {
    if (!centrarEnId || centroX === null || centroY === null) return;
    const el = containerRef.current;
    if (!el) return;
    // Coordenadas del punto lógico ya escaladas al espacio de pantalla
    // (mismo espacio en el que vive el scroll), igual que en
    // handlePointerMove/onCanvasClick.
    const targetLeft = centroX * zoom - el.clientWidth / 2;
    const targetTop = centroY * zoom - el.clientHeight / 2;
    el.scrollTo({
      left: Math.max(0, targetLeft),
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centrarEnId, centroX, centroY, zoom]);


  // ── Drop target durante el arrastre: se recalcula en cada render
  // mientras se arrastra (livePos cambia) — así la tarjeta objetivo se
  // resalta ANTES de soltar, dándole feedback visual al DM de "esto se va
  // a agrupar si soltás acá". handlePointerUp reutiliza este mismo valor
  // al soltar, así no hay dos implementaciones del cálculo de solapamiento
  // que puedan desincronizarse.
  const dragItem = dragId ? resueltos.find((i) => i.id === dragId) : undefined;

  // ── "Contener": el centro de la tarjeta arrastrada cae DENTRO del
  // rectángulo de otra tarjeta (típicamente un reino agrandado). Tiene
  // prioridad sobre "agrupar" (dropTargetId más abajo) porque es una
  // relación distinta y más específica — solo aplica si esa otra tarjeta
  // es geométricamente más grande que la arrastrada, si no cualquier par
  // de tarjetas del mismo tamaño que se solapan "contendría" a la otra.
  const containerTargetId = useMemo(() => {
    if (!dragId || !dragItem || !onDropInsideContainer || dragItem.destacado) return null;
    const live = livePos[dragId];
    if (!live) return null;
    const dragSize = tamanoEfectivo(dragItem);
    const centerX = live.x + dragSize.w / 2;
    const centerY = live.y + dragSize.h / 2;
    const objetivo = resueltos.find((other) => {
      if (other.id === dragId || other.destacado) return false;
      const otherSize = tamanoEfectivo(other);
      // El contenedor tiene que ser sensiblemente más grande — si no,
      // cualquier tarjeta normal "contendría" a otra tarjeta normal.
      if (otherSize.w < dragSize.w * 1.15 || otherSize.h < dragSize.h * 1.15) return false;
      const ox = other.pos_x ?? 0;
      const oy = other.pos_y ?? 0;
      return (
        centerX >= ox && centerX <= ox + otherSize.w &&
        centerY >= oy && centerY <= oy + otherSize.h
      );
    });
    return objetivo?.id ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId, dragItem, livePos, resueltos, onDropInsideContainer, liveSize, CARD_W, CARD_H]);

  const dropTargetId = useMemo(() => {
    if (!dragId || !dragItem || !onDropOnItem || containerTargetId) return null;
    const live = livePos[dragId];
    if (!live) return null;
    const centerX = live.x + (dragItem.destacado ? 0 : CARD_W / 2);
    const centerY = live.y + (dragItem.destacado ? 0 : CARD_H / 2);
    const objetivo = resueltos.find((other) => {
      if (other.id === dragId) return false;
      const ox = (other.pos_x ?? 0) + (other.destacado ? 0 : CARD_W / 2);
      const oy = (other.pos_y ?? 0) + (other.destacado ? 0 : CARD_H / 2);
      const radio =
        (dragItem.destacado ? TABLERO_TOKEN_SIZE / 2 : CARD_W / 2) +
        (other.destacado ? TABLERO_TOKEN_SIZE / 2 : CARD_W / 2);
      return Math.hypot(centerX - ox, centerY - oy) < radio * 0.6;
    });
    return objetivo?.id ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId, dragItem, livePos, resueltos, onDropOnItem, containerTargetId, CARD_W, CARD_H]);

  // Para el highlight visual, cualquiera de los dos cuenta como "hay un
  // objetivo resaltado ahora mismo".
  const highlightTargetId = containerTargetId ?? dropTargetId;

  // ── Agrupar visualmente por grupoNombre ────────────────────────────────
  // Varias criaturas con el mismo grupoNombre (horda) se dibujan como un
  // solo bloque: una tarjeta "líder" (la primera del grupo, en orden de
  // aparición en `items`) al frente, con un par de bordes apilados detrás
  // simulando profundidad y un contador ×N — en vez de una tarjeta suelta
  // por cada miembro. El resto de los miembros del grupo no se dibujan
  // como tarjetas propias (se "esconden" del render), pero siguen
  // existiendo normalmente en los datos: se puede seguir arrastrando la
  // tarjeta líder, y el resto de los miembros mantiene su posición real
  // (por si el DM alguna vez los desagrupa). No aplica a tokens
  // (destacado). Si un item está siendo arrastrado/redimensionado ahora
  // mismo, momentáneamente se "despega" del stack para poder sacarlo del
  // grupo o reordenarlo sin que el resto del bloque se mueva con él.
  const liderPorGrupo = useMemo(() => {
    const mapa = new Map<string, string>(); // grupoNombre -> id de la líder
    for (const item of resueltos) {
      if (item.destacado || !item.grupoNombre) continue;
      if (!mapa.has(item.grupoNombre)) mapa.set(item.grupoNombre, item.id);
    }
    return mapa;
  }, [resueltos]);

  const tamanoGrupo = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const item of resueltos) {
      if (item.destacado || !item.grupoNombre) continue;
      conteo.set(item.grupoNombre, (conteo.get(item.grupoNombre) ?? 0) + 1);
    }
    return conteo;
  }, [resueltos]);

  /** Un item se dibuja "suelto" (fuera del stack) si: no tiene grupo, es
   *  la líder de su grupo, o se está arrastrando/redimensionando ahora
   *  mismo (para no perder de vista lo que se está manipulando). El resto
   *  de los miembros del grupo se saltea en el render principal. */
  const esMiembroOcultoDeGrupo = (item: TableroItem) => {
    if (item.destacado || !item.grupoNombre) return false;
    if (dragId === item.id || resizeId === item.id) return false;
    return liderPorGrupo.get(item.grupoNombre) !== item.id;
  };

  const handlePointerDown = (e: React.PointerEvent, item: TableroItem) => {
    // En modo público (no editable) igual necesitamos trackear el
    // pointer down→up para poder distinguir "click" de "arrastre" y
    // abrir el modal de detalle — solo se salta la lógica de mover.
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const rect = target.getBoundingClientRect();
    dragOffset.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setDragId(item.id);
    setDragMoved(false);

    longPressFiredRef.current = false;
    dragMovedRef.current = false;
    if (onLongPressItem) {
      clearLongPressTimer();
      longPressTimerRef.current = setTimeout(() => {
        // Si para entonces ya se movió (drag), no cuenta como long press.
        if (dragMovedRef.current) return;
        longPressFiredRef.current = true;
        onLongPressItem(item.id);
      }, LONG_PRESS_MS);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragId || !containerRef.current || !editable) return;
    const canvasRect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const scrollTop = containerRef.current.scrollTop;
    // clientX/Y, canvasRect y scroll están todos en píxeles de pantalla
    // (ya escalados por el zoom, porque el lienzo interno tiene
    // transform: scale). Se resta todo en ese mismo espacio y recién al
    // final se divide por zoom para volver a las coordenadas lógicas
    // (sin escalar) en las que se guardan pos_x/pos_y.
    const x = (e.clientX - canvasRect.left + scrollLeft - dragOffset.current.dx) / zoom;
    const y = (e.clientY - canvasRect.top + scrollTop - dragOffset.current.dy) / zoom;
    const clampedX = snap(Math.max(0, x));
    const clampedY = snap(Math.max(0, y));
    // Evita el setState (y el re-render) si el snap dio la misma celda
    // que ya teníamos — la causa principal de la traba era actualizar
    // estado en CADA pixel; esto lo corta del todo.
    const anterior = livePos[dragId];
    if (anterior && anterior.x === clampedX && anterior.y === clampedY) {
      clearLongPressTimer();
      return;
    }
    setLivePos((prev) => ({ ...prev, [dragId]: { x: clampedX, y: clampedY } }));
    setDragMoved(true);
    dragMovedRef.current = true;
    clearLongPressTimer();
  };

  const handlePointerUp = (e: React.PointerEvent, item: TableroItem) => {
    if (dragId !== item.id) return;
    const target = e.currentTarget as HTMLElement;
    target.releasePointerCapture(e.pointerId);
    const final = livePos[item.id];
    // Ambos targets ya están calculados con la misma posición livePos que
    // estamos por soltar (se recalculan en cada render mientras se
    // arrastra) — los leemos ahora, antes de limpiar el drag, para no
    // duplicar la lógica geométrica acá. containerTargetId tiene prioridad
    // sobre dropTargetId (contener > agrupar > mover libre).
    const contenedorId = containerTargetId;
    const objetivoId = dropTargetId;
    setDragId(null);
    clearLongPressTimer();
    if (final && dragMoved) {
      if (contenedorId) {
        onDropInsideContainer?.(item.id, contenedorId);
        // Además reposiciona la tarjeta donde se soltó (dentro del
        // contenedor), igual que un movimiento normal.
        onMove?.(item.id, Math.round(final.x), Math.round(final.y));
      } else if (objetivoId) {
        // Soltó sobre otra tarjeta/token: se interpreta como "agrupar",
        // no como reposicionar libremente encima de ella.
        onDropOnItem?.(item.id, objetivoId);
      } else {
        onMove?.(item.id, Math.round(final.x), Math.round(final.y));
      }
    } else if (!dragMoved && !longPressFiredRef.current) {
      // Si el long press ya se disparó (mantuvo presionado), no
      // ejecutamos también el click normal al soltar.
      onClickItem?.(item.id);
    }
    longPressFiredRef.current = false;
    setLivePos((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
  };

  // ── Resize: arrastrar el handle de la esquina inferior-derecha de una
  // tarjeta. Mismo patrón que el drag de posición (live state + persistir
  // al soltar), pero en un eje aparte para no pisar dragId/livePos. ──
  const handleResizePointerDown = (e: React.PointerEvent, item: TableroItem) => {
    if (!editable || !onResizeItem) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const size = tamanoEfectivo(item);
    resizeStart.current = { w: size.w, h: size.h, clientX: e.clientX, clientY: e.clientY };
    setResizeId(item.id);
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!resizeId) return;
    const dx = (e.clientX - resizeStart.current.clientX) / zoom;
    const dy = (e.clientY - resizeStart.current.clientY) / zoom;
    const w = Math.max(MIN_RESIZE_W, Math.round(resizeStart.current.w + dx));
    const h = Math.max(MIN_RESIZE_H, Math.round(resizeStart.current.h + dy));
    setLiveSize((prev) => ({ ...prev, [resizeId]: { w, h } }));
  };

  const handleResizePointerUp = (e: React.PointerEvent, item: TableroItem) => {
    if (resizeId !== item.id) return;
    const target = e.currentTarget as HTMLElement;
    target.releasePointerCapture(e.pointerId);
    const final = liveSize[item.id];
    setResizeId(null);
    if (final) {
      onResizeItem?.(item.id, final.w, final.h);
    }
    // Nota: no borramos liveSize acá — se queda como "tamaño en vivo"
    // hasta que el prop item.ancho/alto se actualice tras persistir (así
    // no hay un parpadeo de vuelta al tamaño viejo mientras el request
    // está en curso). Se limpia solo cuando cambian los items reales.
  };

  // ── Handlers de obstáculos: drag de posición y resize, mismo patrón
  // que las tarjetas pero en su propio namespace de estado. ──
  const handleObsPointerDown = (e: React.PointerEvent, o: TableroObstaculo) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const rect = target.getBoundingClientRect();
    obsDragOffset.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setObsDragId(o.id);
    setObsDragMoved(false);
  };

  const handleObsPointerMove = (e: React.PointerEvent) => {
    if (!obsDragId || !containerRef.current || !editable) return;
    const canvasRect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const scrollTop = containerRef.current.scrollTop;
    const x = (e.clientX - canvasRect.left + scrollLeft - obsDragOffset.current.dx) / zoom;
    const y = (e.clientY - canvasRect.top + scrollTop - obsDragOffset.current.dy) / zoom;
    const clampedX = snap(Math.max(0, x));
    const clampedY = snap(Math.max(0, y));
    const anterior = obsLivePos[obsDragId];
    if (anterior && anterior.x === clampedX && anterior.y === clampedY) return;
    setObsLivePos((prev) => ({ ...prev, [obsDragId]: { x: clampedX, y: clampedY } }));
    setObsDragMoved(true);
  };

  const handleObsPointerUp = (e: React.PointerEvent, o: TableroObstaculo) => {
    if (obsDragId !== o.id) return;
    const target = e.currentTarget as HTMLElement;
    target.releasePointerCapture(e.pointerId);
    const final = obsLivePos[o.id];
    setObsDragId(null);
    if (final && obsDragMoved) {
      onMoveObstaculo?.(o.id, Math.round(final.x), Math.round(final.y));
    } else if (!obsDragMoved) {
      onClickObstaculo?.(o.id);
    }
    setObsLivePos((prev) => {
      const next = { ...prev };
      delete next[o.id];
      return next;
    });
  };

  const handleObsResizePointerDown = (e: React.PointerEvent, o: TableroObstaculo) => {
    if (!editable || !onResizeObstaculo) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const size = tamanoObstaculo(o);
    obsResizeStart.current = { w: size.w, h: size.h, clientX: e.clientX, clientY: e.clientY };
    setObsResizeId(o.id);
  };

  const handleObsResizePointerMove = (e: React.PointerEvent) => {
    if (!obsResizeId) return;
    const dx = (e.clientX - obsResizeStart.current.clientX) / zoom;
    const dy = (e.clientY - obsResizeStart.current.clientY) / zoom;
    const w = Math.max(40, Math.round(obsResizeStart.current.w + dx));
    const h = Math.max(40, Math.round(obsResizeStart.current.h + dy));
    setObsLiveSize((prev) => ({ ...prev, [obsResizeId]: { w, h } }));
  };

  const handleObsResizePointerUp = (e: React.PointerEvent, o: TableroObstaculo) => {
    if (obsResizeId !== o.id) return;
    const target = e.currentTarget as HTMLElement;
    target.releasePointerCapture(e.pointerId);
    const final = obsLiveSize[o.id];
    setObsResizeId(null);
    if (final) onResizeObstaculo?.(o.id, final.w, final.h);
  };

  if (items.length === 0 && obstaculos.length === 0) {
    return (
      <div className="py-16 text-center text-xs text-primary/30">{emptyHint}</div>
    );
  }

  const celdaVisualBg = snapToGrid ? gridSize : 40;
  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-h-0 min-w-0 overflow-auto rounded-xl"
      style={{
        touchAction: editable ? "none" : "pan-x pan-y",
      }}
    >
      {/* ── Wrapper de tamaño real: mismo ancho/alto que ocupa el lienzo
          escalado en pantalla, para que el scroll del contenedor sepa
          cuánto hay que scrollear. El lienzo interno (tamaño lógico, sin
          escalar) se encoge/agranda visualmente con transform: scale —
          las tarjetas y sus posiciones no cambian, solo el zoom. ── */}
      <div style={{ width: canvasW * zoom, height: canvasH * zoom }}>
        <div
          className="relative"
          style={{
            width: canvasW,
            height: canvasH,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            cursor: onCanvasClick ? "crosshair" : undefined,
            // ── Cuadrícula de fondo, alineada 1:1 con las celdas de
            // click/snap: antes vivía en el contenedor con scroll (fuera
            // del transform: scale), así que al hacer scroll o zoom se
            // desincronizaba del contenido — cada cuadrito visual no
            // coincidía con el lugar real donde caía el click. Viviendo
            // acá, en el mismo lienzo lógico que arranca en (0,0) y que
            // el click usa para calcular sus coordenadas (antes de
            // dividir por zoom), la grilla queda pegada 1 a 1 a
            // gridSize — cada cuadrito ES una celda de movimiento. Se
            // ancla explícitamente a 0 0 (backgroundPosition) para que
            // no dependa del scroll del contenedor.
            background:
              `repeating-linear-gradient(0deg, transparent, transparent ${celdaVisualBg - 1}px, color-mix(in srgb, var(--primary) 6%, transparent) ${celdaVisualBg}px), repeating-linear-gradient(90deg, transparent, transparent ${celdaVisualBg - 1}px, color-mix(in srgb, var(--primary) 6%, transparent) ${celdaVisualBg}px)`,
            backgroundPosition: "0 0",
          }}
          onClick={(e) => {
            // Solo cuenta como "click en el lienzo" si el click no vino
            // burbujeado desde una tarjeta (e.target sería ese div hijo,
            // no este contenedor). Las tarjetas ya paran la propagación
            // en pointerdown/up, pero este chequeo es la red de seguridad
            // real para no mover la ficha al clickear encima de otra cosa.
            if (!onCanvasClick || e.target !== e.currentTarget) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / zoom;
            const y = (e.clientY - rect.top) / zoom;
            onCanvasClick(snap(Math.max(0, x)), snap(Math.max(0, y)));
          }}
        >
        {/* ── Capa de obstáculos: debajo de las tarjetas, un <div> por
            obstáculo (no SVG, para poder reusar el mismo patrón de
            pointer-events que las tarjetas y el handle de resize). ── */}
        {obstaculos.map((o) => {
          const live = obsLivePos[o.id];
          const x = live?.x ?? o.pos_x;
          const y = live?.y ?? o.pos_y;
          const size = tamanoObstaculo(o);
          const estilo = OBSTACULO_ESTILO[o.tipo];
          const isDraggingThis = obsDragId === o.id;
          const isResizingThis = obsResizeId === o.id;
          return (
            <div
              key={o.id}
              onPointerDown={(e) => handleObsPointerDown(e, o)}
              onPointerMove={handleObsPointerMove}
              onPointerUp={(e) => handleObsPointerUp(e, o)}
              className="group absolute select-none"
              style={{
                left: x,
                top: y,
                width: size.w,
                height: size.h,
                background: estilo.fill,
                border: `2px solid ${estilo.stroke}`,
                borderRadius: o.forma === "circulo" ? "50%" : 10,
                cursor: editable ? (isDraggingThis ? "grabbing" : "grab") : "default",
                touchAction: editable ? "none" : undefined,
                zIndex: isDraggingThis || isResizingThis ? 25 : 0,
                boxShadow: isDraggingThis || isResizingThis ? "0 8px 20px rgba(0,0,0,0.18)" : undefined,
              }}
            >
              {editable && onResizeObstaculo && (
                <div
                  onPointerDown={(e) => handleObsResizePointerDown(e, o)}
                  onPointerMove={handleObsResizePointerMove}
                  onPointerUp={(e) => handleObsResizePointerUp(e, o)}
                  title="Arrastrar para cambiar el tamaño"
                  className="absolute bottom-0 right-0 w-5 h-5 flex items-end justify-end p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    cursor: "nwse-resize",
                    touchAction: "none",
                    zIndex: 26,
                    opacity: isResizingThis ? 1 : undefined,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRight: "2.5px solid rgba(0,0,0,0.5)",
                      borderBottom: "2.5px solid rgba(0,0,0,0.5)",
                      borderBottomRightRadius: 3,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {resueltos.map((item) => {
          const live = livePos[item.id];
          // Se alinea a la grilla al dibujar, aunque pos_x/pos_y hayan
          // quedado guardados en una posición libre de antes de que
          // existiera el snap (reinos/criaturas viejos, cascada inicial,
          // etc.) — así todo el tablero se ve prolijamente alineado sin
          // tener que re-guardar cada item.
          const x = snap(live?.x ?? item.pos_x ?? 0);
          const y = snap(live?.y ?? item.pos_y ?? 0);
          const isDraggingThis = dragId === item.id;

          // ── Token circular: la propia ficha del jugador. pos_x/pos_y
          // guardan el CENTRO del círculo (no la esquina como las
          // tarjetas normales), así que al clickear el pizarrón el
          // círculo queda centrado justo en el punto clickeado — se
          // resta la mitad del diámetro acá, en el único lugar que
          // dibuja el token, para no tener que ajustar la lógica de
          // click/drag en ningún otro lado.
          //
          // El nombre va en una etiqueta aparte debajo del círculo, en un
          // wrapper sin overflow-hidden (el círculo sí lo tiene, para
          // recortar la imagen) — así el texto no queda recortado. Los
          // handlers de pointer siguen solo en el círculo: el wrapper es
          // puramente de layout, no agranda el área de drag. ──
          if (item.destacado) {
            const size = TABLERO_TOKEN_SIZE;
            const esDropTarget = dropTargetId === item.id;
            return (
              <div
                key={item.id}
                className="absolute flex flex-col items-center select-none"
                style={{
                  left: x - size / 2,
                  top: y - size / 2,
                  width: size,
                  zIndex: isDraggingThis ? 30 : item.contenedorId ? 5 : 2,
                }}
              >
                <div
                  onPointerDown={(e) => handlePointerDown(e, item)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={(e) => handlePointerUp(e, item)}
                  title={item.nombre}
                  className="group rounded-full overflow-hidden flex items-center justify-center shrink-0"
                  style={{
                    width: size,
                    height: size,
                    background: item.imagen_url
                      ? undefined
                      : "color-mix(in srgb, var(--primary) 12%, transparent)",
                    border: esDropTarget
                      ? "2.5px dashed #22c55e"
                      : "2.5px solid var(--primary)",
                    cursor: editable ? (isDraggingThis ? "grabbing" : "grab") : "pointer",
                    touchAction: "manipulation",
                    boxShadow: esDropTarget
                      ? "0 0 0 4px rgba(34,197,94,0.25)"
                      : isDraggingThis
                        ? "0 10px 24px rgba(0,0,0,0.22)"
                        : "0 2px 6px rgba(0,0,0,0.15)",
                    transition: isDraggingThis ? "none" : "box-shadow 0.15s ease, border-color 0.15s ease",
                  }}
                >
                  {item.imagen_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imagen_url}
                      alt={item.nombre}
                      draggable={false}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  ) : (
                    <UserRound
                      size={Math.round(size * 0.55)}
                      style={{ color: "var(--primary)" }}
                    />
                  )}
                </div>
                <span
                  className="mt-1 px-1.5 py-0.5 rounded-full text-micro font-bold truncate text-center pointer-events-none"
                  style={{
                    maxWidth: size + 40,
                    color: "var(--primary)",
                    background: "color-mix(in srgb, var(--white-custom) 85%, transparent)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                  }}
                >
                  {item.nombre}
                </span>
              </div>
            );
          }

          // Miembro de un grupo/horda que no es la líder: no se dibuja como
          // tarjeta propia (queda "escondido" detrás de la líder, ver
          // stack más abajo), salvo que se lo esté arrastrando/
          // redimensionando ahora mismo.
          if (esMiembroOcultoDeGrupo(item)) return null;

          const tieneImagen = !!item.imagen_url;
          const size = tamanoEfectivo(item);
          // Con imagen: tarjeta cuadrada por default (imagen ocupa todo el
          // cuadro), nombre y tipo abajo superpuestos con degradé, ej.
          // "Personaje | Abel". Sin imagen: layout anterior, imagen
          // placeholder a la izquierda + texto. Si el item tiene un
          // ancho custom (ej. un reino agrandado), se respeta ese ancho
          // en vez de forzar el cuadrado.
          const cardStyleWidth = item.ancho != null ? size.w : tieneImagen ? size.h : size.w;
          const cardStyleHeight = size.h;
          const esDropTarget = dropTargetId === item.id;
          const esContainerTarget = containerTargetId === item.id;
          const isResizingThis = resizeId === item.id;
          const esResizable = editable && !!onResizeItem && !item.destacado;
          // ── Stack visual del grupo: si esta tarjeta es la líder de un
          // grupo con más de un miembro, se dibujan 1-2 "bordes fantasma"
          // detrás (offset diagonal fijo, mismo tamaño) simulando un mazo
          // de cartas apilado, más un contador ×N en la esquina —
          // puramente decorativo, no son elementos interactivos propios. ──
          const tamanoDelGrupo = item.grupoNombre ? (tamanoGrupo.get(item.grupoNombre) ?? 1) : 1;
          const esLiderDeGrupo = item.grupoNombre
            ? liderPorGrupo.get(item.grupoNombre) === item.id && tamanoDelGrupo > 1
            : false;
          const capasStack = Math.min(tamanoDelGrupo - 1, 2);
          // Offset diagonal fijo de cada capa fantasma detrás de la líder
          // (en px lógicos, sin escalar por zoom — el <div> del canvas ya
          // aplica el transform: scale a todo el árbol).
          const STACK_OFFSET = 7;
          return (
            <React.Fragment key={item.id}>
              {esLiderDeGrupo &&
                Array.from({ length: capasStack }).map((_, i) => {
                  // Se dibujan de atrás hacia adelante (la más alejada
                  // primero) para que la de más arriba en z-index quede
                  // justo debajo de la tarjeta líder real.
                  const capa = capasStack - i;
                  return (
                    <div
                      key={`${item.id}-stack-${capa}`}
                      aria-hidden
                      className="absolute rounded-2xl border pointer-events-none"
                      style={{
                        left: x + capa * STACK_OFFSET,
                        top: y + capa * STACK_OFFSET,
                        width: cardStyleWidth,
                        height: cardStyleHeight,
                        background: "var(--white-custom)",
                        borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
                        borderWidth: 1,
                        opacity: 1 - capa * 0.18,
                        zIndex: (isDraggingThis || isResizingThis ? 30 : 1) - capa,
                      }}
                    />
                  );
                })}
              <div
                onPointerDown={(e) => handlePointerDown(e, item)}
                onPointerMove={handlePointerMove}
                onPointerUp={(e) => handlePointerUp(e, item)}
                className={`group absolute overflow-hidden select-none ${
                  tieneImagen
                    ? esContainerTarget || esDropTarget
                      ? "rounded-2xl border shadow-sm"
                      : ""
                    : "rounded-2xl border shadow-sm flex items-stretch gap-3"
                }`}
                style={{
                  left: x,
                  top: y,
                  width: cardStyleWidth,
                  height: cardStyleHeight,
                  background: tieneImagen ? undefined : "var(--white-custom)",
                  borderColor:
                    tieneImagen && !esContainerTarget && !esDropTarget
                      ? undefined
                      : esContainerTarget
                        ? "#3b82f6"
                        : esDropTarget
                          ? "#22c55e"
                          : "color-mix(in srgb, var(--primary) 12%, transparent)",
                  borderWidth: tieneImagen && !esContainerTarget && !esDropTarget ? 0 : esContainerTarget || esDropTarget ? 2 : 1,
                  borderStyle: esContainerTarget || esDropTarget ? "dashed" : "solid",
                  cursor: editable ? (isDraggingThis ? "grabbing" : "grab") : "pointer",
                  touchAction: "manipulation",
                  // Un item "contenido" dentro de un reino (contenedorId)
                  // siempre se dibuja por encima del reino que lo alberga
                  // — si no, al ser ambas tarjetas normales, el orden de
                  // superposición dependería del orden de `items` y el
                  // reino agrandado podía terminar tapando lo que tiene
                  // adentro. zIndex 5 > el 1 base de una tarjeta suelta
                  // (y de un reino, que no tiene contenedorId propio),
                  // pero sigue por debajo de drag/resize (30).
                  zIndex: isDraggingThis || isResizingThis ? 30 : item.contenedorId ? 5 : 1,
                  boxShadow: esContainerTarget
                    ? "0 0 0 4px rgba(59,130,246,0.22)"
                    : esDropTarget
                      ? "0 0 0 4px rgba(34,197,94,0.2)"
                      : isDraggingThis || isResizingThis
                        ? "0 10px 24px rgba(0,0,0,0.18)"
                        : tieneImagen
                          ? undefined
                          : "0 1px 3px rgba(0,0,0,0.06)",
                  transition:
                    isDraggingThis || isResizingThis
                      ? "none"
                      : "box-shadow 0.15s ease, border-color 0.15s ease",
                }}
              >
                {/* Contador ×N del grupo/horda: solo en la tarjeta líder
                    de un grupo con más de un miembro — comunica de un
                    vistazo "esto es un bloque de varias criaturas", sin
                    tener que abrir el detalle de cada una. */}
                {esLiderDeGrupo && (
                  <div
                    className="absolute -top-1.5 -right-1.5 z-20 min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-micro font-black pointer-events-none"
                    style={{
                      background: "var(--primary)",
                      color: "var(--white-custom)",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                    }}
                    title={`Grupo: ${item.grupoNombre} (${tamanoDelGrupo})`}
                  >
                    ×{tamanoDelGrupo}
                  </div>
                )}
              {/* Indicador de "está contenida dentro de un reino/otra
                  entidad" — solo un pequeño badge, no cambia el layout. */}
              {item.contenedorId && (
                <div
                  className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded-full text-micro font-bold pointer-events-none"
                  style={{
                    background: "rgba(59,130,246,0.85)",
                    color: "white",
                  }}
                  title="Dentro de un reino"
                >
                  ⛺
                </div>
              )}
              {tieneImagen ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imagen_url!}
                    alt={item.nombre}
                    title={item.nombre}
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  />
                  {renderBadge && (
                    <div className="absolute top-1 right-1">{renderBadge(item)}</div>
                  )}
                </>
              ) : (
                <>
                  <div
                    className="relative h-full shrink-0 bg-primary/5 overflow-hidden"
                    style={{ width: IMG_W }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <BookOpen size={18} className="text-primary/20" />
                    </div>
                    {renderBadge && (
                      <div className="absolute top-1 right-1">{renderBadge(item)}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center py-2 pr-3 gap-0.5">
                    {item.subtitulo && (
                      <span className="text-micro font-black uppercase tracking-widest text-primary/35 truncate">
                        {item.subtitulo}
                      </span>
                    )}
                    <h3
                      className="font-serif italic text-primary truncate"
                      style={{ fontSize: cardStyleHeight >= 130 ? "1.1rem" : undefined }}
                    >
                      {item.nombre}
                    </h3>
                  </div>
                </>
              )}

              {/* ── Handle de resize: esquina inferior-derecha, solo
                  visible en editable y con onResizeItem provisto. Un
                  drag propio, aparte del de posición, para no confundir
                  "mover" con "agrandar". Se muestra al hacer hover sobre
                  la tarjeta (group-hover) para no ensuciar el tablero. ── */}
              {esResizable && (
                <div
                  onPointerDown={(e) => handleResizePointerDown(e, item)}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={(e) => handleResizePointerUp(e, item)}
                  title="Arrastrar para cambiar el tamaño"
                  className="absolute bottom-0 right-0 w-5 h-5 flex items-end justify-end p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    cursor: "nwse-resize",
                    touchAction: "none",
                    zIndex: 20,
                    opacity: isResizingThis ? 1 : undefined,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRight: "2.5px solid var(--primary)",
                      borderBottom: "2.5px solid var(--primary)",
                      borderBottomRightRadius: 3,
                    }}
                  />
                </div>
              )}
              </div>
            </React.Fragment>
          );
        })}

        {/* ── Niebla de guerra: SVG a pantalla completa del lienzo, encima
            de todo. Capa 1 = negro total sobre lo nunca visto; capa 2 =
            gris semitransparente ("penumbra") sobre lo explorado antes
            pero no visible ahora; ambas tienen un <mask> que recorta el
            polígono de visibilidad actual (ahí no se pinta nada, queda
            clarito). Solo se dibuja si hay un origen de niebla. ── */}
        {nieblaOrigenId && poligonoVisible && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width={canvasW}
            height={canvasH}
            style={{ zIndex: 40 }}
          >
            <defs>
              {/* Máscara del negro total: blanco = pintar negro (nunca
                  visto); negro = ocultar el negro (visible ahora o ya
                  explorado antes). */}
              <mask id={maskIdNuncaVisto}>
                <rect x={0} y={0} width={canvasW} height={canvasH} fill="white" />
                <polygon
                  points={poligonoVisible.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="black"
                />
                {celdasExploradas &&
                  Array.from(celdasExploradas).map((celda) => {
                    const [cx, cy] = celda.split(",").map(Number);
                    return (
                      <rect
                        key={celda}
                        x={cx * GRID_SIZE}
                        y={cy * GRID_SIZE}
                        width={GRID_SIZE + 1}
                        height={GRID_SIZE + 1}
                        fill="black"
                      />
                    );
                  })}
              </mask>
              {/* Máscara de la penumbra: blanco solo sobre celdas
                  exploradas, y se le resta (negro) el polígono visible
                  ahora — así el gris queda exactamente en "visto antes,
                  pero no ahora". */}
              <mask id={maskIdPenumbra}>
                <rect x={0} y={0} width={canvasW} height={canvasH} fill="black" />
                {celdasExploradas &&
                  Array.from(celdasExploradas).map((celda) => {
                    const [cx, cy] = celda.split(",").map(Number);
                    return (
                      <rect
                        key={celda}
                        x={cx * GRID_SIZE}
                        y={cy * GRID_SIZE}
                        width={GRID_SIZE + 1}
                        height={GRID_SIZE + 1}
                        fill="white"
                      />
                    );
                  })}
                <polygon
                  points={poligonoVisible.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="black"
                />
              </mask>
            </defs>
            {/* Penumbra gris: solo sobre lo ya explorado y no visible ahora. */}
            <rect
              x={0}
              y={0}
              width={canvasW}
              height={canvasH}
              fill="rgba(10,10,15,0.55)"
              mask={`url(#${maskIdPenumbra})`}
            />
            {/* Negro total: todo lo que nunca se exploró ni es visible ahora. */}
            <rect
              x={0}
              y={0}
              width={canvasW}
              height={canvasH}
              fill="black"
              mask={`url(#${maskIdNuncaVisto})`}
              opacity={0.97}
            />
          </svg>
        )}
        </div>
      </div>
    </div>
  );
}
