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

import {
  Circle,
  ImageIcon,
  Link2,
  Link2Off,
  Map,
  Pentagon,
  Plus,
  Square,
  Trash2,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import type { Ciudad } from "@/domains/garlia/ciudades";
import { supabase } from "@/infra/supabase/supabase";
import {
  invalidateReinoAreas,
  invalidateReinoTiles,
  loadReinoAreas,
  loadReinoTiles,
} from "@/infra/sync/syncEngine";

import { UnifiedTileCanvas } from "@/domains/garlia/_shared/UnifiedTileCanvas";
import type {
  AreaTipo,
  BaseArea,
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

// ─── Hook: carga y gestión de áreas del reino ─────────────────────────────────
function useReinoAreas(reinoId: string) {
  const [areas, setAreas] = useState<BaseArea[]>([]);

  useEffect(() => {
    void loadReinoAreas(reinoId, (fresh) => setAreas(fresh as BaseArea[])).then(
      (data) => setAreas(data as BaseArea[]),
    );
  }, [reinoId]);

  const persistArea = useCallback(
    async (payload: {
      tipo: AreaTipo;
      puntos: WorldPoint[];
      ciudad_id: string | null;
      label: string | null;
      color: string | null;
    }) => {
      try {
        const { data, error } = await supabase
          .from("reino_areas")
          .insert({
            reino_id: reinoId,
            tipo: payload.tipo,
            puntos: payload.puntos,
            ciudad_id: payload.ciudad_id,
            label: payload.label,
            color: payload.color,
            orden: areas.length,
          })
          .select()
          .single();
        if (error) throw error;
        setAreas((prev) => [...prev, data as unknown as BaseArea]);
        await invalidateReinoAreas(reinoId);
        return data;
      } catch {
        return null;
      }
    },
    [reinoId, areas.length],
  );

  const updateAreaPoints = useCallback(
    (areaId: string, puntos: WorldPoint[]) => {
      setAreas((prev) =>
        prev.map((a) => (a.id === areaId ? { ...a, puntos } : a)),
      );
    },
    [],
  );

  const vincularCiudad = useCallback(
    async (areaId: string, ciudadId: string | null, label: string) => {
      const { error } = await supabase
        .from("reino_areas")
        .update({ ciudad_id: ciudadId, label: label || null })
        .eq("id", areaId);
      if (error) return false;
      setAreas((prev) =>
        prev.map((a) =>
          a.id === areaId ? { ...a, ciudad_id: ciudadId, label } : a,
        ),
      );
      await invalidateReinoAreas(reinoId);
      return true;
    },
    [reinoId],
  );

  const deleteArea = useCallback(
    async (areaId: string) => {
      const { error } = await supabase
        .from("reino_areas")
        .delete()
        .eq("id", areaId);
      if (error) return false;
      setAreas((prev) => prev.filter((a) => a.id !== areaId));
      await invalidateReinoAreas(reinoId);
      return true;
    },
    [reinoId],
  );

  return { areas, setAreas, persistArea, updateAreaPoints, vincularCiudad, deleteArea };
}

// ─── ModalVincularAreaCiudad ───────────────────────────────────────────────────
// Versión simplificada del vinculador del mapa global: acá el reino ya está
// implícito (es el reino abierto), así que solo se elige la ciudad.
function ModalVincularAreaCiudad({
  ciudades,
  initialCiudadId,
  initialLabel,
  onClose,
  onConfirm,
}: {
  ciudades: CiudadConTile[];
  initialCiudadId?: string | null;
  initialLabel?: string;
  onClose: () => void;
  onConfirm: (ciudadId: string | null, label: string) => void | Promise<void>;
}) {
  const [ciudadId, setCiudadId] = useState<string | null>(
    initialCiudadId ?? null,
  );
  const [label, setLabel] = useState(initialLabel ?? "");
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(ciudadId, label);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="relative w-96 p-6 flex flex-col gap-4"
        style={{
          background: "var(--white-custom)",
          border:
            "1px solid color-mix(in srgb, var(--primary) 20%, transparent)",
          borderRadius: "2px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-3 right-3 opacity-50 hover:opacity-100"
          onClick={onClose}
        >
          <X size={14} />
        </button>

        <h3
          className="font-black uppercase text-sm tracking-[0.15em]"
          style={{ fontFamily: "'Cinzel', serif", color: "var(--foreground)" }}
        >
          Vincular área
        </h3>

        <div className="flex flex-col gap-1">
          <label
            className="text-micro font-bold uppercase tracking-[0.15em]"
            style={{
              color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
            }}
          >
            Nombre del área
          </label>
          <input
            className="input-brand text-sm py-1.5 px-2"
            placeholder="Opcional — se muestra sobre la forma"
            style={{ borderRadius: "1px" }}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="text-micro font-bold uppercase tracking-[0.15em]"
            style={{
              color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
            }}
          >
            Ciudad
          </label>
          <select
            className="input-brand text-sm py-1.5 px-2"
            style={{ borderRadius: "1px" }}
            value={ciudadId ?? ""}
            onChange={(e) => setCiudadId(e.target.value || null)}
          >
            <option value="">— Sin vincular a una ciudad —</option>
            {ciudades.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          {ciudades.length === 0 && (
            <p
              className="text-micro"
              style={{
                color: "color-mix(in srgb, var(--foreground) 40%, transparent)",
              }}
            >
              Este reino todavía no tiene ciudades cargadas.
            </p>
          )}
        </div>

        <button
          className="btn-brand w-full justify-center py-2.5 text-micro uppercase disabled:opacity-50"
          disabled={saving}
          onClick={handleConfirm}
        >
          {ciudadId ? <Link2 size={11} /> : <Link2Off size={11} />}
          {saving
            ? "Guardando…"
            : ciudadId
              ? "Vincular"
              : "Guardar sin vincular"}
        </button>
      </div>
    </div>
  );
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

  // ── Áreas del mapa interno del reino (círculo/rectángulo/polígono) ────────
  const { areas, persistArea, updateAreaPoints, vincularCiudad, deleteArea } =
    useReinoAreas(reinoId);
  const [drawTool, setDrawTool] = useState<DrawTool>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [areaPendiente, setAreaPendiente] = useState<{
    tipo: AreaTipo;
    puntos: WorldPoint[];
  } | null>(null);
  const [vinculadorAreaOpen, setVinculadorAreaOpen] = useState(false);

  // Debounce del guardado de puntos al arrastrar un vértice/mover el área —
  // mismo patrón que el mapa global (no hay "onVertexDragEnd" explícito).
  const areaSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  useEffect(() => {
    if (!selectedAreaId) return;
    const area = areas.find((a) => a.id === selectedAreaId);
    if (!area) return;
    if (areaSaveTimeoutRef.current) clearTimeout(areaSaveTimeoutRef.current);
    areaSaveTimeoutRef.current = setTimeout(() => {
      void supabase
        .from("reino_areas")
        .update({ puntos: area.puntos, tipo: area.tipo })
        .eq("id", area.id);
    }, 500);
    return () => {
      if (areaSaveTimeoutRef.current) clearTimeout(areaSaveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areas, selectedAreaId]);

  const handleAreaDrawEnd = useCallback((tipo: AreaTipo, puntos: WorldPoint[]) => {
    setAreaPendiente({ tipo, puntos });
    setVinculadorAreaOpen(true);
    setDrawTool(null);
  }, []);

  const handleDeleteArea = useCallback(
    async (areaId: string) => {
      if (!confirm("¿Eliminar esta área?")) return;
      const ok = await deleteArea(areaId);
      if (ok) setSelectedAreaId(null);
    },
    [deleteArea],
  );

  // Click sobre la pill/relleno de un área vinculada a una ciudad (fuera de
  // edición) → abre esa ciudad, mismo comportamiento que tenía el pin.
  const handleAreaClick = useCallback(
    (area: BaseArea) => {
      if (!area.ciudad_id) return;
      const ciudad = detalles.find((d) => d.id === area.ciudad_id);
      if (ciudad) onPinClick?.(ciudad);
    },
    [detalles, onPinClick],
  );

  // IDs de ciudad que ya tienen un área vinculada — su pin deja de dibujarse
  // fuera de edición (el área+pill ya muestra el nombre), igual que en el
  // mapa global.
  const ciudadIdsConArea = new Set(
    areas.map((a) => a.ciudad_id).filter((id): id is string => !!id),
  );
  const detallesSinDuplicado = editMode
    ? detalles
    : detalles.filter((d) => !ciudadIdsConArea.has(d.id));
  const hiddenMarkersSinDuplicado = editMode
    ? hiddenMarkers
    : hiddenMarkers?.filter((d) => !ciudadIdsConArea.has(d.id));

  const emptyState = !loading && tiles.length === 0;

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden">
      <UnifiedTileCanvas<ReinoTile, CiudadConTile>
        areas={areas}
        className={className}
        drawTool={editMode ? drawTool : null}
        editMode={editMode}
        eyedropperActive={eyedropperActive}
        fondoColor={fondoColor}
        hiddenMarkers={hiddenMarkersSinDuplicado}
        isFirstOpen={isFirstOpen}
        markers={detallesSinDuplicado}
        selectedAreaId={editMode ? selectedAreaId : null}
        selectedMarkerId={selectedPinId}
        tileSize={tileSize}
        tiles={tiles}
        onAreaClick={handleAreaClick}
        onAreaDrawEnd={handleAreaDrawEnd}
        onAreaPointsChange={updateAreaPoints}
        onAreaSelect={setSelectedAreaId}
        onEyedropperPick={onEyedropperPick}
        onMarkerClick={(ciudad) => onPinClick?.(ciudad)}
        onMarkerContextMenu={onMarkerContextMenuProp}
        onMarkerMove={(markerId, coord) => {
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
        onMarkerSelect={setSelectedPinId}
        onOpenPanel={onOpenPanel}
        onTileCreate={(col, row) => addTile(col, row)}
        onTileDelete={(tile) => deleteTile(tile.id)}
        onTilePick={(tile) => setPickerTile(tile)}
      />

      {/* ── Barra de herramientas: dibujar áreas ── */}
      {editMode && !emptyState && (
        <div
          className="absolute bottom-3 left-3 z-10 flex items-center gap-1 px-1.5 py-1.5"
          style={{
            borderRadius: "8px",
            background: "color-mix(in srgb, var(--bg-menu) 90%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
            backdropFilter: "blur(10px)",
          }}
        >
          {(
            [
              { tool: "circulo" as const, Icon: Circle, title: "Dibujar círculo" },
              { tool: "rectangulo" as const, Icon: Square, title: "Dibujar rectángulo" },
              { tool: "poligono" as const, Icon: Pentagon, title: "Dibujar forma libre" },
            ]
          ).map(({ tool, Icon, title }) => (
            <button
              key={tool}
              className="w-8 h-8 flex items-center justify-center transition-colors"
              style={{
                borderRadius: "6px",
                background: drawTool === tool ? "var(--accent)" : "transparent",
                color: drawTool === tool ? "#fff" : "var(--accent)",
              }}
              title={title}
              onClick={() => {
                setSelectedAreaId(null);
                setDrawTool((prev) => (prev === tool ? null : tool));
              }}
            >
              <Icon size={14} />
            </button>
          ))}

          {selectedAreaId && !drawTool && (
            <>
              <div
                className="w-px h-5 mx-0.5"
                style={{
                  background:
                    "color-mix(in srgb, var(--primary) 25%, transparent)",
                }}
              />
              <button
                className="w-8 h-8 flex items-center justify-center"
                style={{ borderRadius: "6px", color: "var(--accent)" }}
                title="Vincular esta área a una ciudad"
                onClick={() => setVinculadorAreaOpen(true)}
              >
                {areas.find((a) => a.id === selectedAreaId)?.ciudad_id ? (
                  <Link2 size={14} />
                ) : (
                  <Link2Off size={14} />
                )}
              </button>
              <button
                className="w-8 h-8 flex items-center justify-center"
                style={{ borderRadius: "6px", color: "#ef4444" }}
                title="Eliminar área"
                onClick={() => void handleDeleteArea(selectedAreaId)}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
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

      {/* Vincular área (círculo/rectángulo/polígono) recién dibujada o
          seleccionada, a una ciudad de este reino */}
      {vinculadorAreaOpen && (areaPendiente || selectedAreaId) && (
        <ModalVincularAreaCiudad
          ciudades={detalles}
          initialCiudadId={
            areaPendiente
              ? null
              : (areas.find((a) => a.id === selectedAreaId)?.ciudad_id ?? null)
          }
          initialLabel={
            areaPendiente
              ? ""
              : (areas.find((a) => a.id === selectedAreaId)?.label ?? "")
          }
          onClose={() => {
            setVinculadorAreaOpen(false);
            setAreaPendiente(null);
          }}
          onConfirm={async (ciudadId, label) => {
            if (areaPendiente) {
              await persistArea({
                tipo: areaPendiente.tipo,
                puntos: areaPendiente.puntos,
                ciudad_id: ciudadId,
                label: label || null,
                color: null,
              });
              setAreaPendiente(null);
            } else if (selectedAreaId) {
              await vincularCiudad(selectedAreaId, ciudadId, label);
            }
            setVinculadorAreaOpen(false);
          }}
        />
      )}
    </div>
  );
}
