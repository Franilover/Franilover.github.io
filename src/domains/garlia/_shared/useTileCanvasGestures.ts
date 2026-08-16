"use client";

/**
 * useTileCanvasGestures
 * ───────────────────────
 * Único dueño de los listeners de puntero/teclado sobre el canvas. Maneja
 * SIEMPRE: zoom (Ctrl+scroll), pan (drag), pinch (touch), click izquierdo
 * sobre pin/área/tile en modo lectura, y el fallback onMapClick.
 *
 * Si se le pasa `editing` (no null — ver tileCanvasEditingGestures), antes de
 * aplicar cualquier comportamiento público le da la primera oportunidad a
 * cada evento: si `editing.handleXxx(e)` devuelve true, el gesto ya fue
 * resuelto por edición y este hook no hace nada más con ese evento. Esto
 * reproduce EXACTAMENTE la cascada de prioridad de gestos que tenía el
 * UnifiedTileCanvas original (drag de vértice > drag de área > dibujo >
 * pan/click público), pero con un solo listener real por evento — sin la
 * carrera de condiciones de dos listeners independientes.
 *
 * `editing === null` (vista pública, fuera de edición) es el caso normal en
 * TileCanvasView: en ese caso este hook se comporta exactamente como el
 * pan/zoom/click de siempre, sin ninguna rama de edición evaluada.
 */

import { useEffect, useRef, useState } from "react";

import type { BaseArea, BaseMarker, BaseTile } from "./UnifiedTileCanvas";
import type { useTileCanvasEngine } from "./useTileCanvasEngine";
import type { TileCanvasEditingState } from "./tileCanvasEditingGestures";

export interface UseTileCanvasGesturesOptions<
  TTile extends BaseTile,
  TMarker extends BaseMarker,
> {
  engine: ReturnType<typeof useTileCanvasEngine<TTile, TMarker>>;
  editing: TileCanvasEditingState<TTile, TMarker> | null;

  editMode: boolean;
  selectedMarkerId: string | null;
  onMarkerClick?: (marker: TMarker) => void;

  areas: BaseArea[];
  selectedAreaId: string | null;
  onAreaClick?: (area: BaseArea) => void;

  onMapClick?: (
    x: number,
    y: number,
    tile_col?: number,
    tile_row?: number,
  ) => void;
}

export function useTileCanvasGestures<
  TTile extends BaseTile,
  TMarker extends BaseMarker,
>({
  engine,
  editing,
  editMode,
  selectedMarkerId,
  onMarkerClick,
  areas,
  selectedAreaId,
  onAreaClick,
  onMapClick,
}: UseTileCanvasGesturesOptions<TTile, TMarker>) {
  const {
    canvasRef,
    camRef,
    markDirty,
    cssToCanvasScale,
    canvasToTileInfo,
    clientToWorldPoint,
    isPointInArea,
    findMarkerAt,
    zoomAt,
  } = engine;

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, camX: 0, camY: 0 });
  const lastPinchDist = useRef<number | null>(null);
  const touchCountRef = useRef(0);
  const activeTouchPointers = useRef<Set<number>>(new Set());

  // ── editing es un objeto NUEVO en cada render de UnifiedTileCanvas (no
  // está memoizado: hoverTile/ghostHover/drawingPoints cambian con cada
  // movimiento del mouse en modo edición). Si `editing` estuviera en el
  // array de deps del useEffect de abajo, ese efecto se destruiría y
  // recrearía (remove+add de TODOS los listeners) en cada uno de esos
  // renders — perdiendo cualquier pointerdown en curso a mitad de gesto.
  // Eso es exactamente lo que causaba "hay que dar muchos clicks para que
  // tome el click": el listener que capturó el pointerdown podía ser
  // reemplazado por uno nuevo antes de que llegara su pointerup. La
  // solución es leer `editing` siempre a través de un ref actualizado en
  // cada render (sin pasar por deps), para que el useEffect que registra
  // los listeners no dependa de la identidad de `editing`. ─────────────────
  const editingRef = useRef(editing);
  editingRef.current = editing;

  // ── Mismo motivo que editingRef: onMarkerClick/onAreaClick/onMapClick
  // suelen pasarse como funciones flecha inline desde el componente padre
  // (ej. ReinoTileCanvas: `onMarkerClick={(ciudad) => onPinClick?.(ciudad)}`),
  // lo que las hace una referencia nueva en cada render del padre — sin
  // relación con si el usuario realmente clickeó algo. Si quedaran en las
  // deps del useEffect, cualquier render del padre (hover, cualquier
  // setState ajeno) recrearía los listeners a mitad de un gesto. Se leen
  // siempre a través de refs, así los listeners se registran una sola vez
  // por combinación real de editMode/áreas/etc. ────────────────────────────
  const onMarkerClickRef = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;
  const onAreaClickRef = useRef(onAreaClick);
  onAreaClickRef.current = onAreaClick;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const areasRef = useRef(areas);
  areasRef.current = areas;

  // ── Cursor público: true cuando el mouse está sobre un área o un marker
  // clickeable, en cualquier modo. Antes no existía nada calculando esto en
  // modo lectura, así que el cursor quedaba fijo en "pointer" siempre (o lo
  // que sea que herede por CSS), sin reflejar la posición real del mouse.
  // Se recalcula en cada pointermove contra la misma geometría que decide
  // el click real (isPointInArea / findMarkerAt), para que cursor y click
  // respondan siempre a exactamente lo mismo. ──────────────────────────────
  const [isHoveringClickable, setIsHoveringClickable] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Zoom: solo Ctrl+scroll (siempre, en todos los modos) ─────────────────
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY);
      markDirty();
    };

    let isPointerDown = false;
    let pointerDownCtrl = false;

    const onPointerDown = (e: PointerEvent) => {
      // ── Edición tiene primera prioridad ───────────────────────────────────
      if (editingRef.current?.handlePointerDown(e)) return;

      if (e.button !== 0 && e.pointerType !== "touch") return;

      if (e.pointerType === "touch") {
        activeTouchPointers.current.add(e.pointerId);
        if (activeTouchPointers.current.size >= 2) {
          // Segundo dedo: arranque de pinch, no de pan.
          isPointerDown = false;
          isDragging.current = false;
          return;
        }
      }

      isPointerDown = true;
      pointerDownCtrl = e.ctrlKey || e.metaKey;
      isDragging.current = false;
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        camX: camRef.current.x,
        camY: camRef.current.y,
      };
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      // ── Edición tiene primera prioridad ───────────────────────────────────
      if (editingRef.current?.handlePointerMove(e)) return;

      // Durante un pinch de 2 dedos, el pan por Pointer Events se desactiva.
      if (isPointerDown && touchCountRef.current < 2) {
        // ── Umbral de "esto ya es un drag, no un click" ─────────────────────
        // Antes: se medía dx/dy en unidades de canvas (multiplicadas por
        // `s` = cssToCanvasScale) pero se comparaba contra un umbral fijo de
        // 6. Como `s` cambia según la resolución del canvas (recortada a
        // MAX_DIM en pantallas grandes, o inflada por devicePixelRatio en
        // mobile), el umbral real en movimiento de MOUSE/DEDO variaba según
        // el dispositivo — en desktop grande equivalía a ~7px CSS reales,
        // un umbral tan bajo que el temblor natural de una mano al hacer
        // click lo superaba seguido, arrancando un "pan" no intencional
        // (exactamente el síntoma: "a veces no toma el click y encima se
        // pone en modo difícil de destrabar"). Ahora se mide el movimiento
        // en píxeles CSS reales (sin *s) contra un umbral fijo más alto
        // (10px, estándar de la industria para distinguir click de drag),
        // consistente sin importar la resolución del canvas. ───────────────
        const dxCss = e.clientX - dragStart.current.x;
        const dyCss = e.clientY - dragStart.current.y;
        if (Math.hypot(dxCss, dyCss) > 10) isDragging.current = true;
        if (isDragging.current) {
          const s = cssToCanvasScale();
          const dx = dxCss * s;
          const dy = dyCss * s;
          camRef.current = {
            ...camRef.current,
            x: dragStart.current.camX + dx,
            y: dragStart.current.camY + dy,
          };
          markDirty();
        }
      }

      // Hover de edición (tile/papelera/casilla fantasma) — solo si no se
      // está paneando, igual que el original (`!isDragging.current`).
      if (editMode && editingRef.current && !isDragging.current) {
        editingRef.current.handleHover(e);
      }

      // ── Hover público (cursor pointer/default) — misma geometría que el
      // click real: área primero (es lo único que se ve dibujado hoy), pin
      // como fallback. No corre mientras se está paneando. ─────────────────
      if (!isDragging.current) {
        let clickable = false;
        if (onAreaClickRef.current) {
          const wp = clientToWorldPoint(e.clientX, e.clientY);
          if (wp) {
            clickable = areasRef.current.some((a) => isPointInArea(wp, a));
          }
        }
        if (!clickable && findMarkerAt(e.clientX, e.clientY)) {
          clickable = true;
        }
        setIsHoveringClickable((prev) =>
          prev === clickable ? prev : clickable,
        );
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      // ── Siempre limpiar el estado de "botón apretado" del gesto público,
      // pase lo que pase con edición. Si no se limpia acá antes del early
      // return de edición, isPointerDown queda pegado en true y el próximo
      // pointermove sigue interpretando cualquier movimiento como pan,
      // aunque el botón ya esté soltado (bug: "modo movimiento" atascado). ──
      if (e.pointerType === "touch")
        activeTouchPointers.current.delete(e.pointerId);
      isPointerDown = false;
      const wasDragging = isDragging.current;
      isDragging.current = false;

      // ── Edición tiene primera prioridad ───────────────────────────────────
      if (editingRef.current?.handlePointerUp(e)) return;

      if (wasDragging) {
        return;
      }

      const withCtrl = pointerDownCtrl || e.ctrlKey || e.metaKey;
      const clientX = e.clientX;
      const clientY = e.clientY;

      // ── Prioridad de click: ÁREA primero, no marker. ──────────────────────
      // El engine ya no dibuja pines (ver comentario "Los pines... se
      // eliminaron" en useTileCanvasEngine.ts) — lo único que el usuario ve
      // en pantalla es el área (círculo/rectángulo/polígono) con su label.
      // findMarkerAt sigue haciendo hit-test contra coord_x/coord_y del
      // marker, una posición que ya no tiene ninguna representación visual
      // y que normalmente NO coincide con la geometría real del área/label
      // — por eso "clickear cerca del nombre" solo funcionaba a veces, por
      // pura coincidencia con esa posición fantasma. El área es hoy la
      // única geometría real y visible: debe revisarse primero. ────────────
      if (onAreaClickRef.current && e.button === 0) {
        const wp = clientToWorldPoint(clientX, clientY);
        if (wp) {
          const hitArea = [...areasRef.current].reverse().find((a) => isPointInArea(wp, a));
          if (hitArea) {
            onAreaClickRef.current(hitArea);
            return;
          }
        }
      }

      // ── Fallback: pin real (solo relevante si en el futuro se reintroduce
      // un marker dibujado visualmente en coord_x/coord_y). ────────────────
      const marker = findMarkerAt(clientX, clientY);
      if (marker) {
        onMarkerClickRef.current?.(marker);
        return;
      }

      // ── Fallback: notificar posición (mapa del mundo, fuera de editMode) ──
      if (!editMode) {
        const info = canvasToTileInfo(clientX, clientY);
        if (info) onMapClickRef.current?.(info.x, info.y, info.tile_col, info.tile_row);
      }
      void withCtrl; // reservado (paridad con la firma original; sin uso público hoy)
    };

    // ── Pinch zoom (touch) ────────────────────────────────────────────────
    const onTouchStart = (e: TouchEvent) => {
      touchCountRef.current = e.touches.length;
      if (e.touches.length === 2) {
        isDragging.current = false;
        lastPinchDist.current = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      touchCountRef.current = e.touches.length;
      if (e.touches.length === 2 && lastPinchDist.current !== null) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        const mid = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
        zoomAt(mid.x, mid.y, (lastPinchDist.current - dist) * 3);
        lastPinchDist.current = dist;
        markDirty();
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      touchCountRef.current = e.touches.length;
      lastPinchDist.current = null;
      if (e.touches.length === 1) {
        dragStart.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          camX: camRef.current.x,
          camY: camRef.current.y,
        };
        isDragging.current = false;
        isPointerDown = true;
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      // Mismo motivo que en onPointerUp: si no se limpia acá, un pointer
      // cancelado (ej. el navegador pierde el foco a mitad de un drag) deja
      // isPointerDown pegado en true para siempre.
      if (e.pointerType === "touch")
        activeTouchPointers.current.delete(e.pointerId);
      isPointerDown = false;
      isDragging.current = false;
      setIsHoveringClickable(false);
    };

    const onPointerLeave = () => {
      // El mouse salió del canvas: no hay nada bajo el cursor.
      setIsHoveringClickable(false);
    };

    const onContextMenu = (e: MouseEvent) => {
      if (editingRef.current?.handleContextMenu(e)) return;
    };

    const onDblClick = (e: MouseEvent) => {
      if (editingRef.current?.handleDblClick(e)) return;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (editingRef.current?.handleKeyDown(e)) return;
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("contextmenu", onContextMenu);
    canvas.addEventListener("dblclick", onDblClick);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("dblclick", onDblClick);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
    };
    // areas también se lee vía areasRef.current dentro de los handlers, no
    // hace falta como dep — evita recrear listeners si el padre pasa un
    // array de áreas con nueva referencia en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, selectedMarkerId, selectedAreaId]);

  return { isHoveringClickable };
}
