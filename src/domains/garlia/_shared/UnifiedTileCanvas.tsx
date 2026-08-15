"use client";

/**
 * UnifiedTileCanvas
 * ──────────────────
 * Canvas compartido entre EditorMapa (mundo) y ReinoTileCanvas (reino).
 * Une "puntos de interés" + "tiles" en una sola superficie:
 *
 *   - Pan / zoom (rueda + drag, pinch en touch)
 *   - Dibuja los tiles compuestos en un OffscreenCanvas
 *   - Dibuja marcadores (pins) encima, con su label
 *   - Click contextual:
 *       1. Si hay un pin seleccionado     → lo mueve a la posición tocada
 *       2. Si el click cae en la papelera flotante de un tile (hover)
 *                                          → confirma + elimina ese tile
 *       3. Si el click cae sobre un pin   → lo selecciona
 *       4. Si cae dentro de un tile       → abre el picker de imagen
 *       5. Si cae fuera de cualquier tile → no hace nada
 *   - Ctrl+click en casilla fantasma → crea tile nuevo en esa posición
 *     (las coordenadas son cartesianas: soporta negativos en todas direcciones)
 *   - Hover sobre un tile → muestra una papelera pequeña en su esquina
 *     superior derecha para eliminarlo
 *
 * Este componente NO sabe nada de Supabase: todo I/O se delega a props.
 */

import { useEffect, useRef, useState } from "react";

import { useTileCanvasEngine } from "./useTileCanvasEngine";

// ─── Tipos compartidos ────────────────────────────────────────────────────────
export type BaseTile = {
  id: string;
  col: number;
  row: number;
  image_url: string | null;
  label?: string | null;
};

/** Alias de BaseTile para compatibilidad con código existente */
export type MapTile = BaseTile;

export type BaseMarker = {
  id: string;
  nombre?: string;
  name?: string;
  coord_x?: number | null;
  coord_y?: number | null;
  tile_col?: number | null;
  tile_row?: number | null;
  oculto?: boolean;
};

/** Punto en coordenadas "mundo": col/row absoluto de tile + offset 0-100
 * dentro de ese tile (mismo sistema que coord_x/coord_y de los markers).
 * Se guarda así (y no en col+localX/localY por separado) para poder
 * serializar un área completa como un array plano en la columna `puntos`
 * de map_areas. */
export type WorldPoint = { col: number; row: number; x: number; y: number };

export type AreaTipo = "circulo" | "rectangulo" | "poligono";

export type BaseArea = {
  id: string;
  tipo: AreaTipo;
  /** Para círculo: [centro, puntoDeRadio]. Para rectángulo: [esquinaA,
   * esquinaB]. Para polígono: N vértices (mínimo 3). */
  puntos: WorldPoint[];
  color?: string | null;
  label?: string | null;
  reino_id?: string | null;
  ciudad_id?: string | null;
};

/** Herramienta de dibujo activa. null = no se está dibujando nada. */
export type DrawTool = "circulo" | "rectangulo" | "poligono" | null;

interface UnifiedTileCanvasProps<
  TTile extends BaseTile,
  TMarker extends BaseMarker,
> {
  tiles: TTile[];
  markers: TMarker[];
  hiddenMarkers?: TMarker[];
  tileSize?: number;
  editMode: boolean;

  // ── Marcadores ──────────────────────────────────────────────────────────
  selectedMarkerId?: string | null;
  onMarkerSelect: (id: string | null) => void;
  onMarkerMove: (
    markerId: string,
    coord: { x: number; y: number; tile_col: number; tile_row: number },
  ) => void;
  onMarkerClick?: (marker: TMarker) => void;
  /** Click derecho sobre un pin → activa/desactiva el modo "mover" para ese pin. */
  onMarkerContextMenu?: (marker: TMarker) => void;

  // ── Tiles ───────────────────────────────────────────────────────────────
  /** Abre el picker de imagen para el tile indicado (existente). */
  onTilePick: (tile: TTile) => void;
  /** Elimina el tile indicado (ya confirmado). */
  onTileDelete: (tile: TTile) => void;
  /** Crea un tile nuevo en (col, row). El sistema soporta negativos. */
  onTileCreate: (col: number, row: number) => void;

  // ── Extras opcionales (usados por el mapa del mundo) ─────────────────────
  fondoColor?: string | null;
  isFirstOpen?: boolean;
  eyedropperActive?: boolean;
  onEyedropperPick?: (color: string) => void;
  onMapClick?: (
    x: number,
    y: number,
    tile_col?: number,
    tile_row?: number,
  ) => void;
  onOpenPanel?: () => void;

  // ── Áreas (círculo / rectángulo / polígono) ───────────────────────────────
  /** Áreas ya guardadas, a dibujar sobre el mapa (siempre, editMode o no). */
  areas?: BaseArea[];
  /** Área seleccionada — se resalta y sus vértices se pueden arrastrar. */
  selectedAreaId?: string | null;
  onAreaSelect?: (id: string | null) => void;
  /** Herramienta activa: si no es null, el próximo click/drag empieza (o
   * continúa, para polígono) un dibujo nuevo. */
  drawTool?: DrawTool;
  /** Se llama con los puntos finales apenas el dibujo se completa (soltar
   * el mouse en círculo/rectángulo, o doble-click / Enter en polígono). */
  onAreaDrawEnd?: (tipo: AreaTipo, puntos: WorldPoint[]) => void;
  /** El usuario arrastró un vértice de un área ya existente (edición). */
  onAreaPointsChange?: (areaId: string, puntos: WorldPoint[]) => void;
  /** Click izquierdo sobre el label (texto) de un área — normalmente usado
   * para navegar al reino/ciudad al que esa área está vinculada. */
  onAreaClick?: (area: BaseArea) => void;

  className?: string;
}

export function UnifiedTileCanvas<
  TTile extends BaseTile,
  TMarker extends BaseMarker,
>({
  tiles,
  markers,
  hiddenMarkers = [],
  tileSize = 1024,
  editMode,
  selectedMarkerId = null,
  onMarkerSelect,
  onMarkerMove,
  onMarkerClick,
  onMarkerContextMenu,
  onTilePick,
  onTileDelete,
  onTileCreate,
  fondoColor,
  isFirstOpen: _isFirstOpen,
  eyedropperActive,
  onEyedropperPick,
  onMapClick,
  onOpenPanel: _onOpenPanel,
  areas = [],
  selectedAreaId = null,
  onAreaSelect,
  drawTool = null,
  onAreaDrawEnd,
  onAreaPointsChange,
  onAreaClick,
  className,
}: UnifiedTileCanvasProps<TTile, TMarker>) {
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, camX: 0, camY: 0 });
  const lastPinchDist = useRef<number | null>(null);
  // Cantidad de touches activos — usado para que el pan por Pointer Events no
  // pelee con el pinch-zoom por Touch Events durante un gesto de 2 dedos.
  const touchCountRef = useRef(0);
  // pointerIds de dedos activos, seguidos directo desde Pointer Events (sin
  // depender del evento touchstart nativo, que no siempre llega al mismo
  // tiempo que pointerdown — esa carrera era la causa del salto al segundo
  // toque).
  const activeTouchPointers = useRef<Set<number>>(new Set());

  // Tile bajo el cursor (para mostrar la papelera flotante)
  const [hoverTile, setHoverTile] = useState<TTile | null>(null);
  const hoverTileRef = useRef<TTile | null>(null);

  // Marker "armado" para moverse — SOLO se activa con Ctrl+click o click
  // derecho sobre un pin (ver más abajo). Es independiente de
  // selectedMarkerId (prop), que el padre suele setear también cuando el
  // panel de info de ese pin está abierto — si usáramos selectedMarkerId
  // acá, con el panel abierto cualquier click izquierdo en el canvas
  // movería el pin sin que el usuario lo pidiera. markerParaMoverId es el
  // único que dispara "depositar el pin en la posición clickeada".
  const [markerParaMoverId, setMarkerParaMoverId] = useState<string | null>(
    null,
  );
  const markerParaMoverIdRef = useRef<string | null>(null);
  markerParaMoverIdRef.current = markerParaMoverId;

  useEffect(() => {
    if (!editMode) setMarkerParaMoverId(null);
  }, [editMode]);

  // Casilla fantasma bajo el cursor (col/row de celda vacía en editMode)
  const ghostHoverRef = useRef<{ col: number; row: number } | null>(null);
  const [ghostHover, setGhostHover] = useState<{
    col: number;
    row: number;
  } | null>(null);

  // ── Dibujo de áreas ────────────────────────────────────────────────────────
  // Puntos "mundo" acumulados del dibujo en curso. Círculo/rectángulo usan
  // drag (2 puntos); polígono acumula un punto por click hasta doble-click.
  const drawingPointsRef = useRef<WorldPoint[]>([]);
  const [drawingPoints, setDrawingPoints] = useState<WorldPoint[]>([]);
  // Posición actual del mouse en coords mundo, para previsualizar el
  // segmento/figura mientras se dibuja (círculo/rectángulo en drag, o el
  // próximo lado de un polígono).
  const drawCursorRef = useRef<WorldPoint | null>(null);
  const isDrawingDragRef = useRef(false);

  // Índice de vértice de un área existente que se está arrastrando
  // (edición post-creación). areaId + índice dentro de puntos[].
  const draggingVertexRef = useRef<{ areaId: string; index: number } | null>(
    null,
  );

  // Click derecho + mantener + arrastrar sobre un área → mueve la forma
  // completa (traslada todos sus puntos), sin pisar la selección de
  // vértices existente (esa sigue siendo click derecho suelto + izquierdo
  // sobre un vértice). Guardamos los puntos originales y el punto mundo
  // donde arrancó el drag para calcular el delta en cada pointermove.
  const draggingAreaRef = useRef<{
    areaId: string;
    startWorld: WorldPoint;
    originalPuntos: WorldPoint[];
  } | null>(null);
  const areaDragMovedRef = useRef(false);

  // ── Motor compartido: cámara, coordenadas, composición de tiles, render loop ──
  const engine = useTileCanvasEngine<TTile, TMarker>({
    tiles,
    markers,
    hiddenMarkers,
    tileSize,
    editMode,
    fondoColor,
    selectedMarkerId,
    areas,
    selectedAreaId,
    drawTool,
    drawingPoints,
    drawCursorRef,
    hoverTile,
    ghostHover,
  });
  const {
    canvasRef,
    containerRef,
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
    zoomAt,
    zoomIn,
    zoomOut,
    minCol,
    minRow,
  } = engine;

  useEffect(() => {
    // Cambiar de herramienta (o desactivarla) cancela cualquier dibujo en curso.
    drawingPointsRef.current = [];
    setDrawingPoints([]);
    isDrawingDragRef.current = false;
    markDirty();
  }, [drawTool, markDirty]);

  // ── Detectar borde para doble-click de expansión ─────────────────────────
  // ── Eventos ───────────────────────────────────────────────────────────────
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

    // ── Pan: drag con click presionado (sin modificador) ──────────────────────
    let isPointerDown = false;
    let pointerDownCtrl = false;

    // Radio de tolerancia (px de pantalla) para agarrar un vértice existente.
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

    // Distancia de tolerancia (px de pantalla) para "pegarle" a un borde
    // entre dos vértices consecutivos y así insertar un punto nuevo ahí.
    const EDGE_HIT_RADIUS = 8;

    // Solo aplica a polígonos: círculo/rectángulo no tienen "bordes entre
    // vértices" en el sentido editable (se convierten a polígono primero,
    // vía el botón flotante, antes de poder agregarles puntos).
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
        // Distancia punto-segmento
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lenSq));
        const projX = a.x + t * dx;
        const projY = a.y + t * dy;
        const dist = Math.hypot(px - projX, py - projY);
        if (dist < EDGE_HIT_RADIUS) {
          return { areaId: area.id, insertAfterIndex: i };
        }
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      // ── Click derecho + mantener sobre un área (editMode, sin herramienta
      // de dibujo activa) → arranca el drag para mover la forma completa.
      // No reemplaza la selección por click derecho suelto (eso lo maneja
      // onContextMenu más abajo); acá solo armamos el posible drag, y si
      // el mouse nunca se mueve lo suficiente, dejamos que el contextmenu
      // nativo siga su curso normal (selección de área para vértices).
      if (e.button === 2 && editMode && !drawTool) {
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
        return;
      }

      if (e.button !== 0 && e.pointerType !== "touch") return;

      // ── Arrastrar un vértice del área seleccionada (editMode, sin herramienta activa) ──
      if (editMode && !drawTool && selectedAreaId) {
        const v = findVertexAt(e.clientX, e.clientY);
        if (v) {
          draggingVertexRef.current = v;
          canvas.setPointerCapture(e.pointerId);
          return;
        }

        // ── Click en el borde entre dos vértices → insertar uno nuevo ahí ──
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
              // Queda agarrado el punto recién insertado, así el mismo
              // gesto de click+drag lo puede acomodar sin soltar el mouse.
              draggingVertexRef.current = {
                areaId: edge.areaId,
                index: edge.insertAfterIndex + 1,
              };
              canvas.setPointerCapture(e.pointerId);
              markDirty();
            }
          }
          return;
        }
      }

      // ── Dibujo: círculo/rectángulo arrancan con drag ────────────────────────
      if (editMode && (drawTool === "circulo" || drawTool === "rectangulo")) {
        const wp = clientToWorldPoint(e.clientX, e.clientY);
        if (wp) {
          drawingPointsRef.current = [wp];
          setDrawingPoints([wp]);
          isDrawingDragRef.current = true;
          canvas.setPointerCapture(e.pointerId);
          markDirty();
        }
        return;
      }

      // ── Dibujo: polígono acumula un vértice por click ───────────────────────
      if (editMode && drawTool === "poligono") {
        const wp = clientToWorldPoint(e.clientX, e.clientY);
        if (wp) {
          const next = [...drawingPointsRef.current, wp];
          drawingPointsRef.current = next;
          setDrawingPoints(next);
          markDirty();
        }
        return;
      }

      if (e.pointerType === "touch") {
        activeTouchPointers.current.add(e.pointerId);
        if (activeTouchPointers.current.size >= 2) {
          // Segundo dedo tocando: es el arranque de un pinch, no de un pan.
          // No reseteamos dragStart ni capturamos el pointer — si no, el
          // primer dedo (que sigue moviéndose y generando sus propios
          // pointermove) calcularía su delta contra la posición del segundo
          // dedo y el mapa "saltaría" de golpe.
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
      // ── Arrastrando un área completa (click derecho mantenido) ─────────────
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
        return;
      }

      // ── Arrastrando un vértice de área existente ────────────────────────────
      if (draggingVertexRef.current) {
        const wp = clientToWorldPoint(e.clientX, e.clientY);
        if (wp) {
          const { areaId, index } = draggingVertexRef.current;
          const area = areas.find((a) => a.id === areaId);
          if (area) {
            const nuevosPuntos = area.puntos.map((p, i) =>
              i === index ? wp : p,
            );
            onAreaPointsChange?.(areaId, nuevosPuntos);
            markDirty();
          }
        }
        return;
      }

      // ── Dibujando (drag de círculo/rectángulo, o preview de polígono) ──────
      if (editMode && drawTool) {
        const wp = clientToWorldPoint(e.clientX, e.clientY);
        drawCursorRef.current = wp;
        markDirty();
        return;
      }

      // Durante un pinch de 2 dedos, el pan por Pointer Events se desactiva
      // — si no, pelea con el zoomAt del pinch (ver onTouchStart/Move/End) y
      // al levantar un dedo el mapa "salta" a la posición corrupta.
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

      // Hover en editMode: tile existente (papelera) y casilla fantasma (Ctrl)
      if (editMode && !isDragging.current) {
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
              ghostHoverRef.current = {
                col: info.tile_col,
                row: info.tile_row,
              };
              setGhostHover({ col: info.tile_col, row: info.tile_row });
              markDirty();
            }
          } else if (ghostHoverRef.current) {
            ghostHoverRef.current = null;
            setGhostHover(null);
            markDirty();
          }
        } else {
          if (ghostHoverRef.current) {
            ghostHoverRef.current = null;
            setGhostHover(null);
            markDirty();
          }
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      // ── Soltar el drag de área completa (click derecho) ─────────────────────
      if (draggingAreaRef.current) {
        draggingAreaRef.current = null;
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {}
        return;
      }

      // ── Soltar un vértice arrastrado ────────────────────────────────────────
      if (draggingVertexRef.current) {
        draggingVertexRef.current = null;
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {}
        return;
      }

      // ── Terminar el drag de círculo/rectángulo ──────────────────────────────
      if (editMode && isDrawingDragRef.current) {
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
        return;
      }

      if (e.pointerType === "touch")
        activeTouchPointers.current.delete(e.pointerId);
      isPointerDown = false;
      if (isDragging.current) {
        isDragging.current = false;
        return;
      }

      // ── Polígono: click sencillo mientras se dibuja no dispara pan/pin ──────
      if (editMode && drawTool === "poligono") {
        return;
      }

      const withCtrl = pointerDownCtrl || e.ctrlKey || e.metaKey;
      const clientX = e.clientX;
      const clientY = e.clientY;

      // ── Eyedropper (siempre tiene prioridad) ────────────────────────────────
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
            "#" +
              [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join(""),
          );
        }
        return;
      }

      // ── Si hay pin armado para moverse → depositarlo ─────────────────────
      // Dos fuentes posibles, según quién controla el modo "mover":
      //   - markerParaMoverIdRef (interno): cuando el padre NO pasa
      //     onMarkerContextMenu (ej. ReinoTileCanvas) — ahí selectedMarkerId
      //     puede venir seteado solo porque el panel de detalle de ese pin
      //     está abierto, y no debe interpretarse como "listo para moverse".
      //   - selectedMarkerId (prop): cuando el padre SÍ pasa
      //     onMarkerContextMenu (ej. mapa global, con reinoParaMover) — ahí
      //     el padre garantiza que selectedMarkerId solo se setea vía ese
      //     handler, así que es seguro usarlo directo como "para mover".
      const idParaMover = onMarkerContextMenu
        ? selectedMarkerId
        : markerParaMoverIdRef.current;
      if (editMode && idParaMover) {
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
        return;
      }

      // ── Click en la papelera flotante (solo editMode) ────────────────────────
      if (editMode) {
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
          return;
        }
      }

      // ── Click izquierdo sobre un área (en cualquier punto de la forma,
      // no solo el texto) → navega al reino/ciudad vinculado. La edición
      // de la forma (mover vértices / arrastrar el área) se activa con
      // click derecho — ver onContextMenu más abajo. Chequeamos e.button
      // acá porque pointerup no distingue el botón por sí solo.
      if (!drawTool && onAreaClick && e.button === 0) {
        const wp = clientToWorldPoint(clientX, clientY);
        if (wp) {
          const hitArea = [...areas].reverse().find((a) => isPointInArea(wp, a));
          if (hitArea) {
            onAreaClick(hitArea);
            return;
          }
        }
      }

      // ── Click sobre un pin ───────────────────────────────────────────────────
      const marker = findMarkerAt(clientX, clientY);
      if (marker) {
        if (withCtrl && editMode) {
          // Ctrl + click en pin → armarlo para moverlo (atajo de teclado,
          // se mantiene por compatibilidad además del click derecho). Misma
          // dualidad que en "depositar": si el padre controla su propio
          // onMarkerContextMenu, solo avisamos vía onMarkerSelect y es el
          // padre quien decide selectedMarkerId; si no, lo armamos acá.
          const current = onMarkerContextMenu
            ? selectedMarkerId
            : markerParaMoverIdRef.current;
          const next = marker.id === current ? null : marker.id;
          if (!onMarkerContextMenu) setMarkerParaMoverId(next);
          onMarkerSelect(next);
        } else {
          // Click izquierdo simple en pin → siempre abre el panel de info
          onMarkerClick?.(marker);
        }
        return;
      }

      // ── Click en tile existente (solo editMode + Ctrl) ───────────────────────
      if (editMode) {
        const info = canvasToTileInfo(clientX, clientY);
        const tile = info ? findTileAt(info.tile_col, info.tile_row) : null;
        if (tile) {
          if (withCtrl) onTilePick(tile); // Ctrl → picker de imagen
          // sin Ctrl sobre tile existente → nada
          return;
        }

        // ── Click en casilla fantasma (solo Ctrl) → crear tile en el borde ──────
        if (info && !tile && withCtrl && ghostGridRef.current) {
          const { gMinCol, gMinRow, gMaxCol, gMaxRow, tileSet } =
            ghostGridRef.current;
          const { tile_col: col, tile_row: row } = info;
          // Solo permitir si está dentro del anillo de "+" (1 casilla alrededor)
          const inGhostZone =
            col >= gMinCol &&
            col <= gMaxCol &&
            row >= gMinRow &&
            row <= gMaxRow &&
            !tileSet.has(`${col},${row}`);
          if (inGhostZone) {
            onTileCreate(col, row);
          }
          return;
        }
      }

      // ── Fallback: notificar posición (mapa del mundo, fuera de editMode) ─────
      if (!editMode) {
        const info = canvasToTileInfo(clientX, clientY);
        if (info) onMapClick?.(info.x, info.y, info.tile_col, info.tile_row);
      }
    };

    // ── Pinch zoom (touch, sin restricción de Ctrl en táctil) ────────────────
    const onTouchStart = (e: TouchEvent) => {
      touchCountRef.current = e.touches.length;
      if (e.touches.length === 2) {
        // Arranca un pinch: cancelamos cualquier pan en curso para que no
        // pelee con el zoom mientras haya 2 dedos.
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
        // Quedó 1 dedo tras un pinch: reiniciamos el punto de referencia del
        // pan con la posición ACTUAL de ese dedo — si no, el pan retoma
        // desde un dragStart viejo (mezclado entre los dos dedos) y el mapa
        // "salta" en una dirección al soltar.
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

    // ── Click derecho sobre un pin → activa/desactiva modo mover ────────────
    const onContextMenu = (e: MouseEvent) => {
      if (!editMode) return;

      // Si el botón derecho terminó en un drag real (mover la forma
      // completa), no togglear la selección — solo queremos el efecto de
      // mover, no que además se seleccione/deseleccione el área.
      if (areaDragMovedRef.current) {
        e.preventDefault();
        areaDragMovedRef.current = false;
        return;
      }

      const marker = findMarkerAt(e.clientX, e.clientY);
      if (marker) {
        e.preventDefault();
        if (onMarkerContextMenu) {
          // El padre maneja su propio estado externo de "para mover" (ej.
          // mapa global con reinoParaMover) — delegamos 100%.
          onMarkerContextMenu(marker);
        } else {
          // Sin handler del padre (ej. ReinoTileCanvas): armamos el pin acá
          // mismo con el estado interno, independiente de selectedMarkerId.
          const next =
            marker.id === markerParaMoverIdRef.current ? null : marker.id;
          setMarkerParaMoverId(next);
          onMarkerSelect(next);
        }
        return;
      }

      // ── Click derecho sobre un área → la selecciona para editar (mover
      // vértices / arrastrar la forma). El izquierdo, en cambio, navega
      // al reino/ciudad vinculado (ver onAreaClick más arriba). ─────────
      if (!drawTool && onAreaSelect) {
        const wp = clientToWorldPoint(e.clientX, e.clientY);
        if (wp) {
          const hitArea = [...areas].reverse().find((a) => isPointInArea(wp, a));
          if (hitArea) {
            e.preventDefault();
            onAreaSelect(hitArea.id === selectedAreaId ? null : hitArea.id);
          }
        }
      }
    };

    // ── Doble-click → cerrar el polígono en curso ────────────────────────────
    const onDblClick = (e: MouseEvent) => {
      if (!editMode || drawTool !== "poligono") return;
      e.preventDefault();
      const pts = drawingPointsRef.current;
      if (pts.length >= 3) {
        onAreaDrawEnd?.("poligono", pts);
      }
      drawingPointsRef.current = [];
      setDrawingPoints([]);
      drawCursorRef.current = null;
      markDirty();
    };

    // ── Enter cierra el polígono, Escape cancela el dibujo en curso ─────────
    const onKeyDown = (e: KeyboardEvent) => {
      if (!editMode || !drawTool) return;
      if (e.key === "Enter" && drawTool === "poligono") {
        const pts = drawingPointsRef.current;
        if (pts.length >= 3) onAreaDrawEnd?.("poligono", pts);
        drawingPointsRef.current = [];
        setDrawingPoints([]);
        drawCursorRef.current = null;
        markDirty();
      } else if (e.key === "Escape") {
        drawingPointsRef.current = [];
        setDrawingPoints([]);
        drawCursorRef.current = null;
        markDirty();
      }
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
    selectedMarkerId,
    markers,
    hiddenMarkers,
    tiles,
    minCol,
    minRow,
    onMarkerContextMenu,
    areas,
    selectedAreaId,
    drawTool,
    onAreaSelect,
    onAreaDrawEnd,
    onAreaPointsChange,
    onAreaClick,
  ]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden min-h-0 ${className ?? "relative flex-1"}`}
      style={{
        cursor: eyedropperActive
          ? "crosshair"
          : drawTool
            ? "crosshair"
            : selectedMarkerId
              ? "crosshair"
              : hoverTile || ghostHover
                ? "pointer"
                : "default",
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none w-full h-full"
      />

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
        {[
          { l: "+", fn: zoomIn },
          { l: "−", fn: zoomOut },
        ].map(({ l, fn }) => (
          <button
            key={l}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-black shadow transition-all"
            style={{
              background: "color-mix(in srgb, var(--primary) 80%, transparent)",
              color: "#fff",
            }}
            onClick={fn}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Cancelar selección de pin */}
      {selectedMarkerId && (
        <button
          className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-micro font-black uppercase"
          style={{
            background:
              "color-mix(in srgb, var(--foreground) 70%, transparent)",
            color: "#fff",
          }}
          onClick={() => onMarkerSelect(null)}
        >
          Cancelar
        </button>
      )}

      {/* No tiles warning */}
      {tiles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p
            className="text-micro font-black uppercase tracking-widest opacity-30"
            style={{ color: "var(--foreground)" }}
          >
            Sin tiles configurados
          </p>
        </div>
      )}

      {/* Hints (solo editMode, con tiles) */}
      {editMode && tiles.length > 0 && !drawTool && (
        <div className="absolute top-2 left-2 z-10 pointer-events-none flex flex-col gap-1">
          <span
            className="text-micro font-bold uppercase tracking-widest px-2 py-1 rounded-lg"
            style={{
              background: "color-mix(in srgb, var(--bg-main) 85%, transparent)",
              color: "color-mix(in srgb, var(--foreground) 35%, transparent)",
            }}
          >
            Click derecho en un pin para moverlo · Ctrl + click para editar tile · Ctrl + scroll para zoom
          </span>
        </div>
      )}

      {/* Hint de dibujo de área (herramienta activa) */}
      {editMode && drawTool && (
        <div className="absolute top-2 left-2 z-10 pointer-events-none flex flex-col gap-1">
          <span
            className="text-micro font-bold uppercase tracking-widest px-2 py-1 rounded-lg"
            style={{
              background: "color-mix(in srgb, var(--accent) 85%, transparent)",
              color: "#fff",
            }}
          >
            {drawTool === "poligono"
              ? "Click para agregar vértices · Doble-click o Enter para cerrar · Esc para cancelar"
              : "Arrastrá para dibujar el área"}
          </span>
        </div>
      )}
    </div>
  );
}
