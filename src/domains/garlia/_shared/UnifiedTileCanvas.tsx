"use client";

/**
 * UnifiedTileCanvas
 * ──────────────────
 * Canvas compartido entre MapaInteractivo (mundo, en reinos/public/mapaGarlia.tsx)
 * y ReinoTileCanvas (reino).
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

import { useRef, useState } from "react";

import { useTileCanvasEngine } from "./useTileCanvasEngine";
import { useTileCanvasEditingState } from "./tileCanvasEditingGestures";
import { useTileCanvasGestures } from "./useTileCanvasGestures";

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
  /** Presente solo en markers que en realidad son un asset colocado
   * (map_asset_placements) — un castillo/árbol/etc. de la librería en vez
   * de un pin de reino/ciudad. Cuando está seteado, el motor dibuja la
   * imagen en vez del pin+label estándar. */
  asset?: {
    image_url: string;
    escala: number;
    rotacion: number;
    /** Ancla 0-1 dentro de la propia imagen — normalmente 0.5,1.0 (centro-
     * abajo, como un árbol/castillo "parado" sobre el punto). */
    anchor_x: number;
    anchor_y: number;
    ancho_base: number;
    alto_base: number;
    z_index: number;
  };
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

// ─── Terreno decorativo (capa de pintura sobre tiles) ────────────────────────
/** Paleta inicial fija — agregar un color acá no requiere ninguna migración:
 * solo hay que sumar la entrada a esta lista y a TERRAIN_COLOR_HEX. */
export type TerrainColor = "verde" | "azul" | "cafe";

export const TERRAIN_COLORS: TerrainColor[] = ["verde", "azul", "cafe"];

export const TERRAIN_COLOR_HEX: Record<TerrainColor, string> = {
  verde: "#4a7c3f",
  azul: "#3f6a8c",
  cafe: "#6b5138",
};

/** Herramienta de terreno activa: pintar un color específico, o "borrador"
 * para borrar lo ya pintado. null = la herramienta no está activa (el
 * click/drag no pinta nada). */
export type TerrainTool = TerrainColor | "borrador" | null;

/** Un punto de un trazo de pincel, en coordenadas PORCENTAJE (0-100) dentro
 * del tile — mismo sistema que coord_x/coord_y de los markers, así que
 * escala igual al hacer pan/zoom sin depender de tileSize. `r` es el radio
 * del pincel en ese punto, también en % del ancho del tile. */
export type TerrainStrokePoint = { x: number; y: number; r: number };

/** Un trazo de pincel completo: una pasada continua de pointerdown a
 * pointerup. `color` es el color pintado, o "borrador" si el trazo borra
 * en vez de pintar (se dibuja con destination-out — ver drawTerrainStroke
 * en useTileCanvasEngine.ts). Se guarda como polilínea de puntos (no como
 * grilla) para poder redibujarla como curva suave en cualquier resolución
 * de pantalla. */
export type TerrainStroke = {
  /** Id local del trazo dentro del tile — solo para poder borrar/editar
   * trazos individuales a futuro; hoy no se expone ninguna UI para eso. */
  id: string;
  color: TerrainColor | "borrador";
  points: TerrainStrokePoint[];
};

/** Terreno de un tile, tal como se persiste en map_tile_terrain — 1:1 con
 * BaseTile por tile_id. `strokes` es la lista de trazos de pincel dibujados
 * sobre ese tile, en el orden en que se pintaron (así el borrador tapa
 * correctamente trazos anteriores sin importar el orden de llegada). */
export type BaseTileTerrain = {
  tile_id: string;
  strokes: TerrainStroke[];
};

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

  // ── Modo "colocar asset" (castillos/árboles/etc. de la librería) ─────────
  /** Id del map_asset elegido en el panel de librería. Mientras no sea null,
   * el próximo click en el mapa coloca una instancia nueva ahí. */
  placingAssetId?: string | null;
  onPlaceAsset?: (
    assetId: string,
    coord: { x: number; y: number; tile_col: number; tile_row: number },
  ) => void;

  // ── Terreno decorativo (verde/azul/café/etc. pintado sobre tiles) ────────
  /** Terreno ya guardado, uno por tile (map_tile_terrain) — se dibuja
   * siempre (editMode o no), igual que áreas y tiles. */
  terrain?: BaseTileTerrain[];
  /** Herramienta de terreno activa: color a pintar, o "borrador". Mientras
   * no sea null, click/arrastre sobre un tile pinta esa/s celda/s en vez de
   * hacer cualquier otra cosa (seleccionar pin, abrir picker, etc.) —
   * prioridad análoga a drawTool, pero de pintado continuo en vez de
   * figura única. */
  terrainTool?: TerrainTool;
  /** Se llama con la lista COMPLETA de trazos de un tile cada vez que el
   * trazo en curso agrega un punto nuevo (in-memory, sin golpear Supabase)
   * — el consumidor decide cuándo persistir (ver onTerrainStrokeEnd, que sí
   * debe persistir). */
  onTerrainChange?: (tileId: string, strokes: TerrainStroke[]) => void;
  /** Se llama una única vez al soltar el mouse tras un trazo de pintado
   * (aunque el trazo haya tocado varios tiles) — este es el momento de
   * persistir a Supabase, no onTerrainChange (que puede dispararse decenas
   * de veces por segundo mientras se arrastra). */
  onTerrainStrokeEnd?: (tileIds: string[]) => void;

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
  placingAssetId = null,
  onPlaceAsset,
  terrain = [],
  terrainTool = null,
  onTerrainChange,
  onTerrainStrokeEnd,
  className,
}: UnifiedTileCanvasProps<TTile, TMarker>) {
  // ── Estado de edición (hover/drawing/drawCursor) vive en refs que se
  // crean acá y se pasan tanto al motor (para dibujar) como al hook de
  // edición (para escribirlos) — evita la referencia circular de necesitar
  // "engine" para construir "editing" y "editing" para construir "engine"
  // con un solo objeto engine real (no hay dos motores ni dos canvas).
  const drawCursorRef = useRef<WorldPoint | null>(null);
  const [hoverTile, setHoverTile] = useState<TTile | null>(null);
  const [ghostHover, setGhostHover] = useState<{
    col: number;
    row: number;
  } | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<WorldPoint[]>([]);

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
    terrain,
  });
  const { canvasRef, containerRef, zoomIn, zoomOut } = engine;

  // ── Gestos de edición: siempre montado (mismo componente sirve para
  // editMode true/false, como el original), pero solo hace algo cuando el
  // orquestador de abajo le pasa eventos — cosa que solo ocurre igual en
  // ambos modos porque el propio `editing` chequea `drawTool`/etc. La vista
  // pública real (sin ningún código de edición en el bundle final) es
  // TileCanvasView, que directamente no importa este archivo. ─────────────
  const editing = useTileCanvasEditingState<TTile, TMarker>(engine, {
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
    terrain,
    terrainTool,
    onTerrainChange,
    onTerrainStrokeEnd,
    // Sink compartido: editing escribe acá, engine lee de acá.
    hoverState: [hoverTile, setHoverTile],
    ghostHoverState: [ghostHover, setGhostHover],
    drawingPointsState: [drawingPoints, setDrawingPoints],
    drawCursorRef,
  });

  // ── Único orquestador de listeners (pan/zoom/pinch/click público + edición) ──
  useTileCanvasGestures<TTile, TMarker>({
    engine,
    editing,
    editMode,
    selectedMarkerId,
    onMarkerClick,
    areas,
    selectedAreaId,
    onAreaClick,
    onMapClick,
  });

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden min-h-0 ${className ?? "relative flex-1"}`}
      style={{
        cursor: eyedropperActive
          ? "crosshair"
          : drawTool || placingAssetId || terrainTool
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

      {/* Hint de modo "colocar asset" */}
      {editMode && placingAssetId && (
        <div className="absolute top-2 left-2 z-10 pointer-events-none flex flex-col gap-1">
          <span
            className="text-micro font-bold uppercase tracking-widest px-2 py-1 rounded-lg"
            style={{
              background: "color-mix(in srgb, var(--accent) 85%, transparent)",
              color: "#fff",
            }}
          >
            Click en el mapa para colocar · Esc para cancelar
          </span>
        </div>
      )}

      {/* Hint de dibujo de área (herramienta activa) */}
      {editMode && drawTool && !placingAssetId && (
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

      {/* Hint de modo "pintar terreno" */}
      {editMode && terrainTool && !placingAssetId && !drawTool && (
        <div className="absolute top-2 left-2 z-10 pointer-events-none flex flex-col gap-1">
          <span
            className="text-micro font-bold uppercase tracking-widest px-2 py-1 rounded-lg"
            style={{
              background: "color-mix(in srgb, var(--accent) 85%, transparent)",
              color: "#fff",
            }}
          >
            {terrainTool === "borrador"
              ? "Arrastrá para borrar terreno · Click pinta el tile entero"
              : "Arrastrá para pintar terreno · Click pinta el tile entero"}
          </span>
        </div>
      )}
    </div>
  );
}
