"use client";

/**
 * ReinoTileCanvas
 * ───────────────
 * Mapa de tiles para un reino individual.
 *
 * Unifica "puntos de interés" (ciudades) y "tiles" en una sola superficie
 * mediante UnifiedTileCanvas:
 *   - Click sobre un pin → lo selecciona / lo mueve si ya estaba seleccionado
 *   - Click sobre un tile existente (sin pin de por medio) → abre el picker
 *     de imagen de ese tile
 *   - Doble-click cerca de un borde exterior → crea un tile nuevo ahí,
 *     expandiendo el mapa en esa dirección
 *   - Hover sobre un tile → papelera flotante para eliminarlo
 *
 * - Carga los tiles de `reino_tiles` filtrados por reino_id
 * - Dibuja los pins de ciudades encima (coord_x/y en %, o tile_col/row + %)
 */

import { ImageIcon, Map, Plus, X } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

import type { Ciudad } from "@/domains/garlia/ciudades";
import { supabase } from "@/infra/supabase/supabase";
import {
  invalidateReinoTiles,
  loadReinoTiles,
} from "@/infra/sync/syncEngine";

import { UnifiedTileCanvas } from "@/domains/garlia/_shared/UnifiedTileCanvas";
import { TileCanvasView } from "@/domains/garlia/_shared/TileCanvasView";
import type {
  BaseArea,
  AreaTipo,
  DrawTool,
  WorldPoint,
} from "@/domains/garlia/_shared/UnifiedTileCanvas";

// Extiende Ciudad con las coordenadas de tile añadidas en la migración
type CiudadConTile = Ciudad & {
  tile_col?: number | null;
  tile_row?: number | null;
};

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type ReinoTile = {
  id: string;
  reino_id: string;
  col: number;
  row: number;
  image_url: string | null;
  label?: string | null;
};

// ─── ImagePickerModal (lazy, igual que EditorReino) ───────────────────────────
function ImagePickerModal({
  title,
  onSelect,
  onClose,
}: {
  title?: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [Picker, setPicker] = useState<React.ComponentType<any> | null>(null);
  useEffect(() => {
    void import("@/ui/SimpleImagePicker").then(
      (m) => setPicker(() => m.default),
    );
  }, []);

  return (
    <div
      className="fixed inset-0 z-80 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white-custom rounded-t-2xl sm:rounded-2xl shadow-2xl border border-primary/15 w-full sm:max-w-lg p-5 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-micro font-black uppercase tracking-[0.3em] text-primary/50 flex items-center gap-2">
            <ImageIcon size={11} /> {title ?? "Elegir imagen"}
          </h3>
          <button
            className="text-primary/30 hover:text-primary transition-colors"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        {Picker ? (
          <Picker onClose={onClose} onSelect={onSelect} />
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="w-4 h-4 border-2 border-primary/20 border-t-primary/60 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Hook: carga y gestión de tiles del reino ─────────────────────────────────
export function useReinoTiles(reinoId: string) {
  const [tiles, setTiles] = useState<ReinoTile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await loadReinoTiles(reinoId, (fresh) => {
      setTiles(fresh as ReinoTile[]);
    });
    setTiles(data as ReinoTile[]);
    setLoading(false);
  }, [reinoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addTile = async (col: number, row: number) => {
    const { data, error } = await supabase
      .from("reino_tiles")
      .insert({ reino_id: reinoId, col, row, order: tiles.length })
      .select()
      .single();
    if (!error && data) setTiles((prev) => [...prev, data as ReinoTile]);
    return !error;
  };

  const updateTileImage = async (tileId: string, image_url: string) => {
    setTiles((prev) =>
      prev.map((t) => (t.id === tileId ? { ...t, image_url } : t)),
    );
    await supabase.from("reino_tiles").update({ image_url }).eq("id", tileId);
    await invalidateReinoTiles(reinoId);
  };

  const deleteTile = async (tileId: string) => {
    setTiles((prev) => prev.filter((t) => t.id !== tileId));
    await supabase.from("reino_tiles").delete().eq("id", tileId);
    await invalidateReinoTiles(reinoId);
  };

  return {
    tiles,
    setTiles,
    loading,
    addTile,
    updateTileImage,
    deleteTile,
    reload: load,
  };
}

// ─── ReinoTileCanvas ──────────────────────────────────────────────────────────
interface ReinoTileCanvasProps {
  reinoId: string;
  detalles: CiudadConTile[];
  onDetallesChange: (d: CiudadConTile[]) => void;
  editMode?: boolean;
  tileSize?: number;
  onPinClick?: (ciudad: CiudadConTile) => void;
  /** Ciudades no descubiertas — se muestran en niebla, igual que en el mapa global. */
  hiddenMarkers?: CiudadConTile[];
  selectedMarkerId?: string | null;
  onMarkerSelect?: (id: string | null) => void;
  /** Click derecho sobre un pin → activa/desactiva el modo "mover" para ese
   * pin. Independiente de selectedMarkerId (que suele reflejar la ciudad
   * abierta en el panel lateral) — sin esto, con el panel abierto un
   * click izquierdo cualquiera en el canvas terminaba moviendo el pin. */
  onMarkerContextMenu?: (ciudad: CiudadConTile) => void;
  fondoColor?: string | null;
  isFirstOpen?: boolean;
  eyedropperActive?: boolean;
  onEyedropperPick?: (color: string) => void;
  onOpenPanel?: () => void;
  className?: string;

  // ── Áreas (círculo / rectángulo / polígono) de las ciudades del reino ──
  /** Áreas ya guardadas, a dibujar sobre el mapa (siempre, editMode o no).
   * Una ciudad con área vinculada oculta su pin (punto + etiqueta) fuera
   * de editMode — el área ya muestra su nombre, mismo criterio que el
   * mapa global. */
  areas?: BaseArea[];
  selectedAreaId?: string | null;
  onAreaSelect?: (id: string | null) => void;
  drawTool?: DrawTool;
  onAreaDrawEnd?: (tipo: AreaTipo, puntos: WorldPoint[]) => void;
  onAreaPointsChange?: (areaId: string, puntos: WorldPoint[]) => void;
  onAreaClick?: (area: BaseArea) => void;

  // ── Modo "colocar asset" (mismo mecanismo que el mapa global) ────────────
  placingAssetId?: string | null;
  onPlaceAsset?: (
    assetId: string,
    coord: { x: number; y: number; tile_col: number; tile_row: number },
  ) => void;
  /** Markers de assets colocados (castillos/árboles/etc.), ya resueltos con
   * su map_asset — ver assetMarkers en mapaGarlia.tsx. Se concatenan a los
   * markers de ciudades, no reemplazan nada. */
  extraMarkers?: any[];
  /** Id seleccionado que en realidad es un asset-placement (prefijo
   * "asset-placement:") en vez de una ciudad — mismo canal de selección
   * que selectedMarkerId, pero el padre decide a quién corresponde. */
  onSelectExtraMarker?: (id: string) => void;
  onMoveExtraMarker?: (
    id: string,
    coord: { x: number; y: number; tile_col: number; tile_row: number },
  ) => void;
}

export function ReinoTileCanvas({
  reinoId,
  detalles,
  onDetallesChange,
  editMode = false,
  tileSize = 1024,
  onPinClick,
  hiddenMarkers,
  selectedMarkerId: selectedMarkerIdProp,
  onMarkerSelect: onMarkerSelectProp,
  onMarkerContextMenu: onMarkerContextMenuProp,
  fondoColor,
  isFirstOpen,
  eyedropperActive,
  onEyedropperPick,
  onOpenPanel,
  className,
  areas = [],
  selectedAreaId = null,
  onAreaSelect,
  drawTool = null,
  onAreaDrawEnd,
  onAreaPointsChange,
  onAreaClick,
  placingAssetId = null,
  onPlaceAsset,
  extraMarkers = [],
  onSelectExtraMarker,
  onMoveExtraMarker,
}: ReinoTileCanvasProps) {
  const { tiles, loading, addTile, updateTileImage, deleteTile } =
    useReinoTiles(reinoId);

  const [selectedPinIdInternal, setSelectedPinIdInternal] = useState<
    string | null
  >(null);
  // Selección controlada opcionalmente desde afuera (igual que el mapa global,
  // que usa reinoSeleccionado?.id como selectedMarkerId).
  const selectedPinId = selectedMarkerIdProp ?? selectedPinIdInternal;
  const setSelectedPinId = onMarkerSelectProp ?? setSelectedPinIdInternal;
  const [pickerTile, setPickerTile] = useState<ReinoTile | null>(null);

  const emptyState = !loading && tiles.length === 0;

  // Una ciudad con área vinculada ya muestra su nombre fijo dentro del área
  // — el pin (punto + etiqueta) sería redundante. Se oculta fuera de
  // editMode; en edición conviene seguir viendo todos los pins para poder
  // seleccionarlos/moverlos. Mismo criterio que el mapa global.
  const ciudadIdsConArea = new Set(
    areas.map((a) => a.ciudad_id).filter((id): id is string => !!id),
  );
  const detallesSinDuplicado = editMode
    ? detalles
    : detalles.filter((d) => !ciudadIdsConArea.has(d.id));

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden">
      {editMode ? (
        <UnifiedTileCanvas<ReinoTile, CiudadConTile>
          areas={areas}
          className={className}
          drawTool={drawTool}
          editMode={true}
          eyedropperActive={eyedropperActive}
          fondoColor={fondoColor}
          hiddenMarkers={hiddenMarkers}
          isFirstOpen={isFirstOpen}
          markers={[...detallesSinDuplicado, ...extraMarkers]}
          selectedAreaId={selectedAreaId}
          selectedMarkerId={selectedPinId}
          tileSize={tileSize}
          tiles={tiles}
          onAreaDrawEnd={onAreaDrawEnd}
          onAreaClick={onAreaClick}
          onAreaPointsChange={onAreaPointsChange}
          onAreaSelect={onAreaSelect}
          onEyedropperPick={onEyedropperPick}
          onMarkerClick={(m: any) => {
            if (typeof m.id === "string" && m.id.startsWith("asset-placement:")) {
              onSelectExtraMarker?.(m.id);
              return;
            }
            onPinClick?.(m);
          }}
          onMarkerContextMenu={(m: any) => {
            if (typeof m.id === "string" && m.id.startsWith("asset-placement:")) {
              onSelectExtraMarker?.(m.id);
              return;
            }
            onMarkerContextMenuProp?.(m);
          }}
          onMarkerMove={(markerId, coord) => {
            if (markerId.startsWith("asset-placement:")) {
              onMoveExtraMarker?.(markerId, coord);
              return;
            }
            onDetallesChange(
              detalles.map((d) =>
                d.id === markerId
                  ? {
                      ...d,
                      coord_x: coord.x,
                      coord_y: coord.y,
                      tile_col: coord.tile_col,
                      tile_row: coord.tile_row,
                    }
                  : d,
              ),
            );
            setSelectedPinId(null);
          }}
          onMarkerSelect={(id) => {
            if (id && id.startsWith("asset-placement:")) {
              onSelectExtraMarker?.(id);
              return;
            }
            setSelectedPinId(id);
          }}
          onOpenPanel={onOpenPanel}
          onPlaceAsset={onPlaceAsset}
          onTileCreate={(col, row) => addTile(col, row)}
          onTileDelete={(tile) => deleteTile(tile.id)}
          onTilePick={(tile) => setPickerTile(tile)}
          placingAssetId={placingAssetId}
        />
      ) : (
        // ── Modo lectura: TileCanvasView no carga ni un byte de código de
        // edición (drag de vértices, dibujo de áreas, papelera, etc.) — solo
        // pan/zoom/click. Reduce el bundle real en las vistas donde el mapa
        // nunca se edita (o donde editMode está apagado en este render). ───
        <TileCanvasView<ReinoTile, CiudadConTile>
          areas={areas}
          className={className}
          fondoColor={fondoColor}
          hiddenMarkers={hiddenMarkers}
          markers={detallesSinDuplicado}
          tileSize={tileSize}
          tiles={tiles}
          onAreaClick={onAreaClick}
          onMarkerClick={(ciudad) => onPinClick?.(ciudad)}
        />
      )}

      {/* Estado vacío — overlay centrado sobre el canvas */}
      {emptyState && editMode && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
          <div
            className="flex flex-col items-center gap-3 px-6 py-5 rounded-2xl pointer-events-auto"
            style={{
              background: "color-mix(in srgb, var(--bg-main) 90%, transparent)",
              backdropFilter: "blur(12px)",
              border:
                "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            <Map className="text-primary/25" size={24} strokeWidth={1} />
            <p className="text-micro font-black uppercase tracking-[0.25em] text-primary/35">
              Sin tiles de mapa
            </p>
            <div className="flex gap-2">
              {(
                [
                  [0, 0],
                  [1, 0],
                  [0, 1],
                ] as [number, number][]
              ).map(([c, r]) => (
                <button
                  key={`${c}-${r}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-micro font-black uppercase tracking-widest border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/30 transition-all"
                  onClick={() => addTile(c, r)}
                >
                  <Plus size={9} /> {c},{r}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Estado vacío en modo lectura — sin botones de crear, solo el aviso */}
      {emptyState && !editMode && (
        <div className="absolute inset-0 flex items-center justify-center gap-4 pointer-events-none">
          <div
            className="flex flex-col items-center gap-2 px-6 py-5 rounded-2xl"
            style={{
              background: "color-mix(in srgb, var(--bg-main) 90%, transparent)",
              backdropFilter: "blur(12px)",
              border:
                "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            <Map className="text-primary/20" size={22} strokeWidth={1} />
            <p className="text-micro font-black uppercase tracking-[0.25em] text-primary/30">
              Este reino todavía no tiene mapa
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Image picker modal */}
      {pickerTile && (
        <ImagePickerModal
          title={`Imagen tile [${pickerTile.col}, ${pickerTile.row}]`}
          onClose={() => setPickerTile(null)}
          onSelect={(url) => {
            void updateTileImage(pickerTile.id, url);
            setPickerTile(null);
          }}
        />
      )}
    </div>
  );
}
