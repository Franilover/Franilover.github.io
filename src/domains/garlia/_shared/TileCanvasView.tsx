"use client";

/**
 * TileCanvasView
 * ────────────────
 * Vista de SOLO LECTURA del canvas de tiles: pan, zoom (Ctrl+scroll), pinch
 * (touch), click sobre un pin (abre info) o sobre un área (navega al reino/
 * ciudad vinculado). Nada más.
 *
 * A diferencia de UnifiedTileCanvas, este componente NO importa ni referencia
 * ningún código de edición (ni tileCanvasEditingGestures ni sus tipos) — el
 * árbol de imports de este archivo es 100% lectura. Es lo que corresponde
 * usar en cualquier lugar donde el mapa se muestra pero no se edita (ej. el
 * mapa del mundo público, vistas de "solo ver" de un reino).
 *
 * Para edición, usar UnifiedTileCanvas con editMode=true (o el futuro
 * EditableTileCanvas, que compone lo mismo con una API más chica).
 */

import { useTileCanvasEngine } from "./useTileCanvasEngine";
import { useTileCanvasGestures } from "./useTileCanvasGestures";
import type { BaseArea, BaseMarker, BaseTile, BaseTileTerrain } from "./UnifiedTileCanvas";

interface TileCanvasViewProps<
  TTile extends BaseTile,
  TMarker extends BaseMarker,
> {
  tiles: TTile[];
  markers: TMarker[];
  hiddenMarkers?: TMarker[];
  tileSize?: number;
  fondoColor?: string | null;

  /** Click izquierdo simple sobre un pin → normalmente abre su panel de info. */
  onMarkerClick?: (marker: TMarker) => void;

  /** Áreas a dibujar sobre el mapa (círculo/rectángulo/polígono), ya guardadas. */
  areas?: BaseArea[];
  /** Click izquierdo sobre el label/forma de un área → navega al reino/ciudad
   * vinculado. No hay selección de vértices ni edición de forma acá. */
  onAreaClick?: (area: BaseArea) => void;

  /** Terreno decorativo (verde/azul/café/etc.) ya guardado, uno por tile —
   * se dibuja siempre, igual que en UnifiedTileCanvas (ver BaseTileTerrain). */
  terrain?: BaseTileTerrain[];

  /** Click en cualquier punto del mapa que no cayó en pin ni área. */
  onMapClick?: (
    x: number,
    y: number,
    tile_col?: number,
    tile_row?: number,
  ) => void;

  className?: string;
}

export function TileCanvasView<
  TTile extends BaseTile,
  TMarker extends BaseMarker,
>({
  tiles,
  markers,
  hiddenMarkers = [],
  tileSize = 1024,
  fondoColor,
  onMarkerClick,
  areas = [],
  onAreaClick,
  terrain = [],
  onMapClick,
  className,
}: TileCanvasViewProps<TTile, TMarker>) {
  // ── Motor compartido: cámara, coordenadas, composición de tiles, render loop ──
  // editMode siempre false acá: el motor nunca dibuja grilla fantasma,
  // papelera, ni vértices de área editables — esas ramas del render loop
  // están gateadas por su propio prop `editMode`, que este componente fija
  // en false de forma permanente (no es un toggle en runtime).
  const engine = useTileCanvasEngine<TTile, TMarker>({
    tiles,
    markers,
    hiddenMarkers,
    tileSize,
    editMode: false,
    fondoColor,
    selectedMarkerId: null,
    areas,
    selectedAreaId: null,
    drawTool: null,
    drawingPoints: [],
    drawCursorRef: EMPTY_DRAW_CURSOR_REF,
    hoverTile: null,
    ghostHover: null,
    terrain,
  });
  const { canvasRef, containerRef, zoomIn, zoomOut } = engine;

  // ── Único orquestador de gestos, sin `editing` (null) → nunca evalúa ni
  // importa una sola línea de lógica de edición. ───────────────────────────
  useTileCanvasGestures<TTile, TMarker>({
    engine,
    editing: null,
    editMode: false,
    selectedMarkerId: null,
    onMarkerClick,
    areas,
    selectedAreaId: null,
    onAreaClick,
    onMapClick,
  });

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden min-h-0 ${className ?? "relative flex-1"}`}
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
    </div>
  );
}

// Ref constante, estable entre renders — el motor solo LEE drawCursorRef acá
// (nunca hay dibujo en curso en modo lectura), así que no hace falta un
// useRef por instancia; un módulo-level object cumple el mismo contrato.
const EMPTY_DRAW_CURSOR_REF = { current: null };
