"use client";

/**
 * tileCanvasEditingGestures
 * ──────────────────────────
 * Lógica de gestos de EDICIÓN (mover pines, crear/editar tiles, papelera,
 * dibujo y edición de áreas) como funciones puras — sin addEventListener
 * propio. El único dueño de los listeners reales es useTileCanvasGestures
 * (el orquestador); este módulo solo decide, dado un evento, si hay algo de
 * edición que hacer, lo hace, y devuelve `true` si "consumió" el gesto (para
 * que el orquestador no seá lo interprete también como pan/click público).
 *
 * Por qué así y no un hook con sus propios listeners: pointerdown/move/up
 * necesitan una ÚNICA cascada de prioridad (drag de vértice > drag de área >
 * dibujo > pan), igual que en el UnifiedTileCanvas original. Dos listeners
 * independientes sobre el mismo evento no pueden garantizar esa prioridad
 * sin acoplarse entre sí (stopPropagation, orden de registro, etc.) — un
 * único listener que consulta a este módulo primero sí puede.
 *
 * Se instancia una sola vez por render vía useTileCanvasEditingState (hook
 * de estado, sin listeners) y sus funciones se llaman desde el orquestador.
 */

import { useEffect, useRef, useState, type MutableRefObject } from "react";

import type {
  AreaTipo,
  BaseArea,
  BaseMarker,
  BaseTile,
  DrawTool,
  WorldPoint,
} from "./UnifiedTileCanvas";
import type { useTileCanvasEngine } from "./useTileCanvasEngine";

type StateTuple<T> = [T, (v: T) => void];

export interface TileCanvasEditingProps<
  TTile extends BaseTile,
  TMarker extends BaseMarker,
> {
  /** Sinks compartidos con el motor de render — editing escribe, engine lee.
   * Se crean en el componente padre (una sola vez) para que el mismo objeto
   * `engine` sirva tanto de fuente de coordenadas para editing como de
   * consumidor de sus resultados, sin necesitar dos instancias del motor. */
  hoverState: StateTuple<TTile | null>;
  ghostHoverState: StateTuple<{ col: number; row: number } | null>;
  drawingPointsState: StateTuple<WorldPoint[]>;
  drawCursorRef: MutableRefObject<WorldPoint | null>;

  editMode: boolean;
  selectedMarkerId: string | null;
  onMarkerSelect: (id: string | null) => void;
  onMarkerMove: (
    markerId: string,
    coord: { x: number; y: number; tile_col: number; tile_row: number },
  ) => void;
  onMarkerContextMenu?: (marker: TMarker) => void;

  onTilePick: (tile: TTile) => void;
  onTileDelete: (tile: TTile) => void;
  onTileCreate: (col: number, row: number) => void;

  eyedropperActive?: boolean;
  onEyedropperPick?: (color: string) => void;

  areas: BaseArea[];
  selectedAreaId: string | null;
  onAreaSelect?: (id: string | null) => void;
  drawTool: DrawTool;
  onAreaDrawEnd?: (tipo: AreaTipo, puntos: WorldPoint[]) => void;
  onAreaPointsChange?: (areaId: string, puntos: WorldPoint[]) => void;

  /** Modo "colocar asset" activo (id del map_asset elegido en el panel de
   * librería). Cuando no es null, un click en terreno vacío no se descarta
   * como en el flujo normal: crea un map_asset_placement ahí mismo. */
  placingAssetId?: string | null;
  onPlaceAsset?: (
    assetId: string,
    coord: { x: number; y: number; tile_col: number; tile_row: number },
  ) => void;
}

/**
 * Hook de ESTADO puro (sin listeners) para los gestos de edición: refs y
 * useState que el orquestador necesita leer/escribir, más los handlers en sí
 * (funciones que el orquestador llama desde sus propios listeners).
 */
export function useTileCanvasEditingState<
  TTile extends BaseTile,
  TMarker extends BaseMarker,
>(
  engine: ReturnType<typeof useTileCanvasEngine<TTile, TMarker>>,
  props: TileCanvasEditingProps<TTile, TMarker>,
) {
  const {
    hoverState: [hoverTile, setHoverTile],
    ghostHoverState: [ghostHover, setGhostHover],
    drawingPointsState: [drawingPoints, setDrawingPoints],
    drawCursorRef,
    editMode,
    selectedMarkerId,
    onMarkerSelect,
    onMarkerMove,
    onMarkerContextMenu,
    onTilePick,
    onTileDelete,
    onTileCreate,
    eyedropperActive,
    onEyedropperPick,
    areas,
    selectedAreaId,
    onAreaSelect,
    drawTool,
    onAreaDrawEnd,
    onAreaPointsChange,
    placingAssetId,
    onPlaceAsset,
  } = props;

  const {
    canvasRef,
    camRef,
    ghostGridRef,
    trashRectRef,
    markDirty,
    cssToCanvasScale,
    worldToLocal,
    canvasToTileInfo,
    clientToWorldPoint,
    findTileAt,
    toTileUnits,
    fromTileUnits,
    isPointInArea,
    findMarkerAt,
  } = engine;

  const [markerParaMoverId, setMarkerParaMoverId] = useState<string | null>(
    null,
  );
  const markerParaMoverIdRef = useRef<string | null>(null);
  markerParaMoverIdRef.current = markerParaMoverId;

  // Flag interno, SIEMPRE separado de selectedMarkerId: solo se activa por
  // una acción explícita (Ctrl+click o click derecho), nunca por una
  // selección normal de marker (que abre el panel). Antes, cuando el
  // consumidor pasaba onMarkerContextMenu, "para mover" reusaba
  // selectedMarkerId directamente — y como selectedMarkerId también cambia
  // al simplemente abrir/seleccionar una ciudad (onMarkerSelect), CUALQUIER
  // click izquierdo posterior con una ciudad ya seleccionada terminaba
  // moviéndola en vez de solo paniar el mapa.
  const armadoParaMoverRef = useRef(false);

  // El orquestador (useTileCanvasGestures) escribe acá en cada pointermove
  // si hubo pan en curso. Sirve para que "mover marker" nunca se dispare
  // como efecto colateral de haber arrastrado el mapa — solo debe aplicar
  // en un click limpio (down+up sin desplazamiento).
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!editMode) {
      setMarkerParaMoverId(null);
      armadoParaMoverRef.current = false;
    }
  }, [editMode]);

  const hoverTileRef = useRef<TTile | null>(hoverTile);
  hoverTileRef.current = hoverTile;
  const ghostHoverRef = useRef<{ col: number; row: number } | null>(ghostHover);
  ghostHoverRef.current = ghostHover;

  const drawingPointsRef = useRef<WorldPoint[]>(drawingPoints);
  drawingPointsRef.current = drawingPoints;
  const isDrawingDragRef = useRef(false);

  const draggingVertexRef = useRef<{ areaId: string; index: number } | null>(
    null,
  );
  const draggingAreaRef = useRef<{
    areaId: string;
    startWorld: WorldPoint;
    originalPuntos: WorldPoint[];
  } | null>(null);
  const areaDragMovedRef = useRef(false);

  useEffect(() => {
    drawingPointsRef.current = [];
    setDrawingPoints([]);
    isDrawingDragRef.current = false;
    markDirty();
  }, [drawTool, markDirty]);

  const VERTEX_HIT_RADIUS = 12;
  const findVertexAt = (clientX: number, clientY: number) => {
    const canvas2 = canvasRef.current;
    if (!canvas2 || !selectedAreaId) return null;
    const area = areas.find((a) => a.id === selectedAreaId);
    if (!area) return null;
    const rect = canvas2.getBoundingClientRect();
    const s = cssToCanvasScale();
    const px = (clientX - rect.left) * s;
    const py = (clientY - rect.top) * s;
    const { x: cx, y: cy, scale } = camRef.current;
    for (let i = 0; i < area.puntos.length; i++) {
      const { lx, ly } = worldToLocal(area.puntos[i], scale);
      if (Math.hypot(px - (cx + lx), py - (cy + ly)) < VERTEX_HIT_RADIUS) {
        return { areaId: area.id, index: i };
      }
    }
    return null;
  };

  const EDGE_HIT_RADIUS = 8;
  const findEdgeAt = (clientX: number, clientY: number) => {
    const canvas2 = canvasRef.current;
    if (!canvas2 || !selectedAreaId) return null;
    const area = areas.find((a) => a.id === selectedAreaId);
    if (!area || area.tipo !== "poligono" || area.puntos.length < 2)
      return null;
    const rect = canvas2.getBoundingClientRect();
    const s = cssToCanvasScale();
    const px = (clientX - rect.left) * s;
    const py = (clientY - rect.top) * s;
    const { x: cx, y: cy, scale } = camRef.current;
    const screenPts = area.puntos.map((p) => {
      const { lx, ly } = worldToLocal(p, scale);
      return { x: cx + lx, y: cy + ly };
    });
    const n = screenPts.length;
    for (let i = 0; i < n; i++) {
      const a = screenPts[i];
      const b = screenPts[(i + 1) % n];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      const t =
        lenSq === 0
          ? 0
          : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lenSq));
      const projX = a.x + t * dx;
      const projY = a.y + t * dy;
      const dist = Math.hypot(px - projX, py - projY);
      if (dist < EDGE_HIT_RADIUS) {
        return { areaId: area.id, insertAfterIndex: i };
      }
    }
    return null;
  };

  /** Devuelve true si consumió el pointerdown (el orquestador no debe
   * arrancar un pan en ese caso). Mismo orden que el original. */
  const handlePointerDown = (e: PointerEvent): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    if (e.button === 2 && !drawTool) {
      const wp = clientToWorldPoint(e.clientX, e.clientY);
      if (wp) {
        const hitArea = [...areas].reverse().find((a) => isPointInArea(wp, a));
        if (hitArea) {
          draggingAreaRef.current = {
            areaId: hitArea.id,
            startWorld: wp,
            originalPuntos: hitArea.puntos,
          };
          areaDragMovedRef.current = false;
          canvas.setPointerCapture(e.pointerId);
        }
      }
      return true; // botón derecho: siempre lo maneja edición, nunca el pan
    }

    if (e.button !== 0 && e.pointerType !== "touch") return false;

    if (!drawTool && selectedAreaId) {
      const v = findVertexAt(e.clientX, e.clientY);
      if (v) {
        draggingVertexRef.current = v;
        canvas.setPointerCapture(e.pointerId);
        return true;
      }

      const edge = findEdgeAt(e.clientX, e.clientY);
      if (edge) {
        const wp = clientToWorldPoint(e.clientX, e.clientY);
        if (wp) {
          const area = areas.find((a) => a.id === edge.areaId);
          if (area) {
            const nuevosPuntos = [
              ...area.puntos.slice(0, edge.insertAfterIndex + 1),
              wp,
              ...area.puntos.slice(edge.insertAfterIndex + 1),
            ];
            onAreaPointsChange?.(edge.areaId, nuevosPuntos);
            draggingVertexRef.current = {
              areaId: edge.areaId,
              index: edge.insertAfterIndex + 1,
            };
            canvas.setPointerCapture(e.pointerId);
            markDirty();
          }
        }
        return true;
      }
    }

    if (drawTool === "circulo" || drawTool === "rectangulo") {
      const wp = clientToWorldPoint(e.clientX, e.clientY);
      if (wp) {
        drawingPointsRef.current = [wp];
        setDrawingPoints([wp]);
        isDrawingDragRef.current = true;
        canvas.setPointerCapture(e.pointerId);
        markDirty();
      }
      return true;
    }

    if (drawTool === "poligono") {
      const wp = clientToWorldPoint(e.clientX, e.clientY);
      if (wp) {
        const next = [...drawingPointsRef.current, wp];
        drawingPointsRef.current = next;
        setDrawingPoints(next);
        markDirty();
      }
      return true;
    }

    return false; // nada de edición matcheó: el orquestador arranca el pan
  };

  /** Devuelve true si consumió el pointermove (bloquea el pan/hover público). */
  const handlePointerMove = (e: PointerEvent): boolean => {
    if (draggingAreaRef.current) {
      const wp = clientToWorldPoint(e.clientX, e.clientY);
      if (wp) {
        const { areaId, startWorld, originalPuntos } = draggingAreaRef.current;
        const startU = toTileUnits(startWorld);
        const nowU = toTileUnits(wp);
        const dux = nowU.ux - startU.ux;
        const duy = nowU.uy - startU.uy;
        if (Math.hypot(dux, duy) > 0.001) areaDragMovedRef.current = true;
        if (areaDragMovedRef.current) {
          const nuevosPuntos = originalPuntos.map((p) => {
            const u = toTileUnits(p);
            return fromTileUnits(u.ux + dux, u.uy + duy);
          });
          onAreaPointsChange?.(areaId, nuevosPuntos);
          markDirty();
        }
      }
      return true;
    }

    if (draggingVertexRef.current) {
      const wp = clientToWorldPoint(e.clientX, e.clientY);
      if (wp) {
        const { areaId, index } = draggingVertexRef.current;
        const area = areas.find((a) => a.id === areaId);
        if (area) {
          const nuevosPuntos = area.puntos.map((p, i) => (i === index ? wp : p));
          onAreaPointsChange?.(areaId, nuevosPuntos);
          markDirty();
        }
      }
      return true;
    }

    if (drawTool) {
      const wp = clientToWorldPoint(e.clientX, e.clientY);
      drawCursorRef.current = wp;
      markDirty();
      return true;
    }

    return false; // el orquestador sigue con pan + hover
  };

  /** Hover de tile/casilla fantasma — solo se llama cuando el orquestador
   * determinó que no hay pan en curso (mismo `!isDragging.current` del
   * original, ahora vive del lado del orquestador). */
  const handleHover = (e: PointerEvent) => {
    const info = canvasToTileInfo(e.clientX, e.clientY);
    const tile = info ? findTileAt(info.tile_col, info.tile_row) : null;
    if (tile?.id !== hoverTileRef.current?.id) {
      hoverTileRef.current = tile;
      setHoverTile(tile);
      markDirty();
    }
    if (info && !tile) {
      const ghost = ghostGridRef.current;
      const inZone =
        ghost &&
        info.tile_col >= ghost.gMinCol &&
        info.tile_col <= ghost.gMaxCol &&
        info.tile_row >= ghost.gMinRow &&
        info.tile_row <= ghost.gMaxRow &&
        !ghost.tileSet.has(`${info.tile_col},${info.tile_row}`);
      if (inZone) {
        const g = ghostHoverRef.current;
        if (!g || g.col !== info.tile_col || g.row !== info.tile_row) {
          ghostHoverRef.current = { col: info.tile_col, row: info.tile_row };
          setGhostHover({ col: info.tile_col, row: info.tile_row });
          markDirty();
        }
      } else if (ghostHoverRef.current) {
        ghostHoverRef.current = null;
        setGhostHover(null);
        markDirty();
      }
    } else if (ghostHoverRef.current) {
      ghostHoverRef.current = null;
      setGhostHover(null);
      markDirty();
    }
  };

  /** Devuelve true si consumió el pointerup. */
  const handlePointerUp = (e: PointerEvent): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    if (draggingAreaRef.current) {
      draggingAreaRef.current = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
      return true;
    }

    if (draggingVertexRef.current) {
      draggingVertexRef.current = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
      return true;
    }

    if (isDrawingDragRef.current) {
      isDrawingDragRef.current = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
      const wp = clientToWorldPoint(e.clientX, e.clientY);
      const start = drawingPointsRef.current[0];
      if (wp && start && (drawTool === "circulo" || drawTool === "rectangulo")) {
        onAreaDrawEnd?.(drawTool, [start, wp]);
      }
      drawingPointsRef.current = [];
      setDrawingPoints([]);
      drawCursorRef.current = null;
      markDirty();
      return true;
    }

    if (drawTool === "poligono") return true; // click simple dibujando: no pan/pin

    if (drawTool) return true; // otra herramienta activa sin drag: nada más

    const withCtrl = e.ctrlKey || e.metaKey;
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (eyedropperActive) {
      const ctx2 = canvas.getContext("2d");
      if (ctx2) {
        const rect2 = canvas.getBoundingClientRect();
        const s2 = cssToCanvasScale();
        const [r, g, b] = ctx2.getImageData(
          Math.round((clientX - rect2.left) * s2),
          Math.round((clientY - rect2.top) * s2),
          1,
          1,
        ).data;
        onEyedropperPick?.(
          "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join(""),
        );
      }
      return true;
    }

    // Si hubo arrastre (pan), no es un click de "colocar marker" — el pan
    // ya movió el mapa, esto no debe interpretarse como mover el marker.
    // El estado "para mover" se mantiene armado para el próximo click real.
    // CRÍTICO: exigimos armadoParaMoverRef (siempre por acción explícita:
    // Ctrl+click o contextmenu) — nunca alcanza con que selectedMarkerId
    // no sea null, porque eso también pasa con solo tener una ciudad
    // seleccionada/abierta en el panel, sin intención de moverla.
    const idParaMover = onMarkerContextMenu
      ? selectedMarkerId
      : markerParaMoverIdRef.current;
    if (idParaMover && armadoParaMoverRef.current && !isDraggingRef.current) {
      const info = canvasToTileInfo(clientX, clientY);
      if (info) {
        onMarkerMove(idParaMover, {
          x: info.x,
          y: info.y,
          tile_col: info.tile_col,
          tile_row: info.tile_row,
        });
      }
      if (!onMarkerContextMenu) setMarkerParaMoverId(null);
      armadoParaMoverRef.current = false;
      return true;
    }

    {
      const trash = trashRectRef.current;
      const rect = canvas.getBoundingClientRect();
      const s3 = cssToCanvasScale();
      const px = (clientX - rect.left) * s3;
      const py = (clientY - rect.top) * s3;
      if (
        trash &&
        px >= trash.x &&
        px <= trash.x + trash.w &&
        py >= trash.y &&
        py <= trash.y + trash.h
      ) {
        onTileDelete(trash.tile);
        return true;
      }
    }

    // ── Modo "colocar asset": un click en terreno (con o sin área/asset
    // encima) coloca el asset elegido ahí. Prioridad alta a propósito —
    // mientras el modo está activo, el click sirve para colocar, no para
    // abrir el panel de lo que esté debajo del cursor. Se descarta si cayó
    // afuera de cualquier tile (canvasToTileInfo null), igual que el resto
    // de las interacciones que necesitan una celda válida.
    if (placingAssetId && onPlaceAsset) {
      const info = canvasToTileInfo(clientX, clientY);
      if (info) {
        onPlaceAsset(placingAssetId, {
          x: info.x,
          y: info.y,
          tile_col: info.tile_col,
          tile_row: info.tile_row,
        });
      }
      return true;
    }

    // ── Click sobre un pin: Ctrl+click arma "para mover"; sin Ctrl, lo deja
    // pasar (return false) para que el orquestador abra el panel de info
    // (mismo onMarkerClick que en modo público). ──────────────────────────
    const marker = findMarkerAt(clientX, clientY);
    if (marker && withCtrl) {
      const current = onMarkerContextMenu
        ? selectedMarkerId
        : markerParaMoverIdRef.current;
      const next = marker.id === current ? null : marker.id;
      if (!onMarkerContextMenu) setMarkerParaMoverId(next);
      armadoParaMoverRef.current = next !== null;
      onMarkerSelect(next);
      return true;
    }
    if (marker) return false;

    const info = canvasToTileInfo(clientX, clientY);
    const tile = info ? findTileAt(info.tile_col, info.tile_row) : null;
    if (tile) {
      if (withCtrl) {
        onTilePick(tile);
        return true;
      }
      // Sin Ctrl: si hay un área (ciudad) dibujada sobre este tile, no es
      // edición de terreno — dejamos pasar (return false) para que el
      // orquestador público maneje el click de área/panel, igual que con
      // un marker. Solo tragamos el click si es terreno vacío de verdad.
      const wp = clientToWorldPoint(clientX, clientY);
      const hitArea = wp
        ? [...areas].reverse().find((a) => isPointInArea(wp, a))
        : null;
      if (hitArea) return false;
      return true; // terreno puro sin área encima: no es click público
    }

    if (info && withCtrl && ghostGridRef.current) {
      const { gMinCol, gMinRow, gMaxCol, gMaxRow, tileSet } = ghostGridRef.current;
      const { tile_col: col, tile_row: row } = info;
      const inGhostZone =
        col >= gMinCol &&
        col <= gMaxCol &&
        row >= gMinRow &&
        row <= gMaxRow &&
        !tileSet.has(`${col},${row}`);
      if (inGhostZone) {
        onTileCreate(col, row);
        return true;
      }
    }

    return false; // nada de edición aplicó: el orquestador puede hacer su fallback público
  };

  /** Devuelve true si consumió el contextmenu (click derecho). */
  const handleContextMenu = (e: MouseEvent): boolean => {
    if (areaDragMovedRef.current) {
      e.preventDefault();
      areaDragMovedRef.current = false;
      return true;
    }

    const marker = findMarkerAt(e.clientX, e.clientY);
    if (marker) {
      e.preventDefault();
      if (onMarkerContextMenu) {
        // El toggle real (armar/desarmar) vive en el callback externo
        // (mapaGarlia.tsx). Acá solo reflejamos: si después de este
        // contextmenu selectedMarkerId sigue siendo este marker, fue un
        // "armado"; si el callback ya lo desarmó, no. Como el callback
        // corre síncronamente antes del próximo render, chequeamos contra
        // el valor previo para decidir el nuevo estado del flag.
        const wasArmedForThisMarker =
          armadoParaMoverRef.current && selectedMarkerId === marker.id;
        onMarkerContextMenu(marker);
        armadoParaMoverRef.current = !wasArmedForThisMarker;
      } else {
        const next =
          marker.id === markerParaMoverIdRef.current ? null : marker.id;
        setMarkerParaMoverId(next);
        armadoParaMoverRef.current = next !== null;
        onMarkerSelect(next);
      }
      return true;
    }

    if (!drawTool && onAreaSelect) {
      const wp = clientToWorldPoint(e.clientX, e.clientY);
      if (wp) {
        const hitArea = [...areas].reverse().find((a) => isPointInArea(wp, a));
        if (hitArea) {
          e.preventDefault();
          onAreaSelect(hitArea.id === selectedAreaId ? null : hitArea.id);
          return true;
        }
      }
    }
    return false;
  };

  const handleDblClick = (e: MouseEvent): boolean => {
    if (drawTool !== "poligono") return false;
    e.preventDefault();
    const pts = drawingPointsRef.current;
    if (pts.length >= 3) {
      onAreaDrawEnd?.("poligono", pts);
    }
    drawingPointsRef.current = [];
    setDrawingPoints([]);
    drawCursorRef.current = null;
    markDirty();
    return true;
  };

  const handleKeyDown = (e: KeyboardEvent): boolean => {
    if (e.key === "Escape") {
      // Cancela cualquier estado "armado" pendiente: dibujo de polígono en
      // curso y/o marker en modo mover (Ctrl+click). Antes Escape solo
      // limpiaba el dibujo, así que un marker "para mover" quedaba pegado
      // sin forma de cancelarlo sin moverlo.
      let handled = false;
      if (drawTool && drawingPointsRef.current.length > 0) {
        drawingPointsRef.current = [];
        setDrawingPoints([]);
        drawCursorRef.current = null;
        markDirty();
        handled = true;
      }
      const idParaMoverActual = onMarkerContextMenu
        ? selectedMarkerId
        : markerParaMoverIdRef.current;
      if (idParaMoverActual !== null && armadoParaMoverRef.current) {
        if (!onMarkerContextMenu) setMarkerParaMoverId(null);
        armadoParaMoverRef.current = false;
        onMarkerSelect(null);
        handled = true;
      }
      return handled;
    }
    if (!drawTool) return false;
    if (e.key === "Enter" && drawTool === "poligono") {
      const pts = drawingPointsRef.current;
      if (pts.length >= 3) onAreaDrawEnd?.("poligono", pts);
      drawingPointsRef.current = [];
      setDrawingPoints([]);
      drawCursorRef.current = null;
      markDirty();
      return true;
    }
    return false;
  };

  return {
    hoverTile,
    ghostHover,
    drawingPoints,
    drawCursorRef,
    markerParaMoverId,
    isDraggingRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleHover,
    handleContextMenu,
    handleDblClick,
    handleKeyDown,
  };
}

export type TileCanvasEditingState<
  TTile extends BaseTile,
  TMarker extends BaseMarker,
> = ReturnType<typeof useTileCanvasEditingState<TTile, TMarker>>;
