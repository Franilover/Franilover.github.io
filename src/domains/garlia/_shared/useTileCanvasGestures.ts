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

import { useEffect, useRef } from "react";

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
      if (editing?.handlePointerDown(e)) return;

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
      if (editing?.handlePointerMove(e)) return;

      // Durante un pinch de 2 dedos, el pan por Pointer Events se desactiva.
      if (isPointerDown && touchCountRef.current < 2) {
        const s = cssToCanvasScale();
        const dx = (e.clientX - dragStart.current.x) * s;
        const dy = (e.clientY - dragStart.current.y) * s;
        if (Math.hypot(dx, dy) > 6) isDragging.current = true;
        if (isDragging.current) {
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
      if (editMode && editing && !isDragging.current) {
        editing.handleHover(e);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      // ── Edición tiene primera prioridad ───────────────────────────────────
      if (editing?.handlePointerUp(e)) return;

      if (e.pointerType === "touch")
        activeTouchPointers.current.delete(e.pointerId);
      isPointerDown = false;
      if (isDragging.current) {
        isDragging.current = false;
        return;
      }

      const withCtrl = pointerDownCtrl || e.ctrlKey || e.metaKey;
      const clientX = e.clientX;
      const clientY = e.clientY;

      // ── Click izquierdo sobre un área → navega al reino/ciudad vinculado.
      if (onAreaClick && e.button === 0) {
        const wp = clientToWorldPoint(clientX, clientY);
        if (wp) {
          const hitArea = [...areas].reverse().find((a) => isPointInArea(wp, a));
          if (hitArea) {
            onAreaClick(hitArea);
            return;
          }
        }
      }

      // ── Click sobre un pin → abre el panel de info ───────────────────────
      const marker = findMarkerAt(clientX, clientY);
      if (marker) {
        onMarkerClick?.(marker);
        return;
      }

      // ── Fallback: notificar posición (mapa del mundo, fuera de editMode) ──
      if (!editMode) {
        const info = canvasToTileInfo(clientX, clientY);
        if (info) onMapClick?.(info.x, info.y, info.tile_col, info.tile_row);
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
      if (e.pointerType === "touch")
        activeTouchPointers.current.delete(e.pointerId);
    };

    const onContextMenu = (e: MouseEvent) => {
      if (editing?.handleContextMenu(e)) return;
    };

    const onDblClick = (e: MouseEvent) => {
      if (editing?.handleDblClick(e)) return;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (editing?.handleKeyDown(e)) return;
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
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
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("dblclick", onDblClick);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editMode,
    editing,
    selectedMarkerId,
    areas,
    selectedAreaId,
    onAreaClick,
    onMarkerClick,
    onMapClick,
  ]);
}
