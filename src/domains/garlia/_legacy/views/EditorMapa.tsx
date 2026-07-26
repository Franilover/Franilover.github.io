"use client";

/**
 * EditorMapa
 * ──────────
 * Panel admin para gestionar los tiles del mapa global.
 * Se importa en EditorMundo como una sección más.
 *
 * Unifica "reinos" (puntos de interés) y "tiles" en una sola superficie
 * mediante UnifiedTileCanvas:
 *   - Click sobre un reino → lo selecciona / lo mueve si ya estaba seleccionado
 *   - Click sobre un tile existente (sin reino de por medio) → abre el picker
 *     de imagen de ese tile
 *   - Doble-click cerca de un borde exterior → crea un tile nuevo ahí,
 *     expandiendo el mapa en esa dirección
 *   - Hover sobre un tile → papelera flotante para eliminarlo
 *   - Botón "+" para crear un tile en una posición arbitraria (modal)
 */

import {
  AlertCircle,
  CheckCircle2,
  ImageIcon,
  Map,
  Plus,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import SimpleImagePicker from "@/components/ui/SimpleImagePicker";
import { UnifiedTileCanvas } from "@/domains/garlia/_legacy/components/shared/UnifiedTileCanvas";
import type { MapTile } from "@/domains/garlia/_legacy/components/shared/UnifiedTileCanvas";
import { supabase } from "@/lib/api/client/supabase";
import {
  invalidateMapTiles,
  loadMapTiles,
  loadReinos,
} from "@/lib/api/client/syncEngine";

type ReinoConTile = {
  id: string;
  nombre: string;
  coord_x?: number | null;
  coord_y?: number | null;
  tile_col?: number | null;
  tile_row?: number | null;
  [key: string]: any;
};

// ─── Toast local ──────────────────────────────────────────────────────────────
function Toast({
  msg,
  ok,
  onClose,
}: {
  msg: string;
  ok: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-300 flex items-center gap-3 px-5 py-3 shadow-lg text-micro font-bold uppercase tracking-widest"
      style={{
        background: ok ? "rgba(5,150,105,0.95)" : "rgba(185,28,28,0.95)",
        color: "#fff",
        border: `1px solid ${ok ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
        borderRadius: "1px",
      }}
    >
      {ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
      {msg}
    </div>
  );
}

// ─── Hourglass ────────────────────────────────────────────────────────────────
function Hourglass({ size = 14 }: { size?: number }) {
  return (
    <svg
      fill="none"
      height={size * 1.45}
      style={{
        animation: "hg-flip 2.4s ease-in-out infinite",
        transformOrigin: "center",
        flexShrink: 0,
      }}
      viewBox="0 0 22 32"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>{`@keyframes hg-flip{0%,40%{transform:rotate(0deg)}50%,90%{transform:rotate(180deg)}100%{transform:rotate(180deg)}}`}</style>
      <rect
        fill="currentColor"
        height="2.5"
        opacity="0.7"
        rx="0"
        width="20"
        x="1"
        y="0"
      />
      <rect
        fill="currentColor"
        height="2.5"
        opacity="0.7"
        rx="0"
        width="20"
        x="1"
        y="29.5"
      />
      <path
        d="M2 2.5 L11 16 L20 2.5 Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="0.8"
      />
      <path
        d="M2 29.5 L11 16 L20 29.5 Z"
        fill="currentColor"
        fillOpacity="0.5"
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="0.8"
      />
    </svg>
  );
}

// ─── Modal para añadir tile en posición custom ────────────────────────────────
function ModalNuevoTile({
  existingPositions,
  onClose,
  onCreated,
}: {
  existingPositions: { col: number; row: number }[];
  onClose: () => void;
  onCreated: (tile: MapTile) => void;
}) {
  const [col, setCol] = useState(0);
  const [row, setRow] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isOccupied = existingPositions.some(
    (p) => p.col === col && p.row === row,
  );

  const handleCreate = async () => {
    if (isOccupied) {
      setError("Ya existe un tile en esa posición");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const maxOrder = existingPositions.length;
      const { data, error: err } = await supabase
        .from("map_tiles")
        .insert({ world_id: "garlia", col, row, order: maxOrder })
        .select()
        .single();
      if (err) throw err;
      onCreated(data as MapTile);
    } catch (e: any) {
      setError(e.message || "Error al crear el tile");
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
        className="relative w-80 p-6 flex flex-col gap-4"
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
          Nuevo Tile
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {[
            ["Columna (col)", col, setCol],
            ["Fila (row)", row, setRow],
          ].map(([lbl, val, setter]: any) => (
            <div key={lbl as string} className="flex flex-col gap-1">
              <label
                className="text-micro font-bold uppercase tracking-widest"
                style={{
                  color:
                    "color-mix(in srgb, var(--foreground) 50%, transparent)",
                }}
              >
                {lbl as string}
              </label>
              <input
                className="input-brand text-center font-black text-lg py-2"
                min={0}
                style={{ borderRadius: "1px" }}
                type="number"
                value={val as number}
                onChange={(e) =>
                  setter(Math.max(0, parseInt(e.target.value) || 0))
                }
              />
            </div>
          ))}
        </div>

        {isOccupied && (
          <p className="text-micro font-bold text-red-400">
            ⚠ [{col},{row}] ya existe
          </p>
        )}
        {error && <p className="text-micro font-bold text-red-400">{error}</p>}

        <button
          className="btn-brand w-full justify-center py-2.5 text-micro uppercase disabled:opacity-50"
          disabled={saving || isOccupied}
          onClick={handleCreate}
        >
          {saving ? <Hourglass size={11} /> : <Plus size={11} />}
          Crear
        </button>
      </div>
    </div>
  );
}

// ─── ImagePickerModal ─────────────────────────────────────────────────────────
function ImagePickerModal({
  title,
  onSelect,
  onClose,
}: {
  title?: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white-custom rounded-2xl shadow-2xl border border-primary/15 w-full max-w-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-micro font-black uppercase tracking-[0.3em] text-primary/50 flex items-center gap-2">
            <ImageIcon size={11} /> {title ?? "Imagen del tile"}
          </h3>
          <button
            className="text-primary/30 hover:text-primary transition-colors"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <SimpleImagePicker onClose={onClose} onSelect={onSelect} />
      </div>
    </div>
  );
}

// ─── Editor principal ─────────────────────────────────────────────────────────
export function EditorMapa({
  onSelectReino,
}: {
  /** Se llama con el id del reino al hacer click en su punto en el mapa */
  onSelectReino?: (reinoId: string) => void;
} = {}) {
  const [tiles, setTiles] = useState<(MapTile & { label?: string | null })[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [reinos, setReinos] = useState<ReinoConTile[]>([]);
  const [selectedReinoId, setSelectedReinoId] = useState<string | null>(null);
  const [pickerTile, setPickerTile] = useState<
    (MapTile & { label?: string | null }) | null
  >(null);

  const showToast = useCallback(
    (msg: string, ok: boolean) => setToast({ msg, ok }),
    [],
  );

  // ── Cargar tiles — Dexie-first via syncEngine ────────────────────────────
  const loadTiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadMapTiles("garlia", (fresh) => {
        setTiles(fresh as (MapTile & { label?: string | null })[]);
      });
      setTiles(data as (MapTile & { label?: string | null })[]);
    } catch {
      showToast("Error al cargar los tiles", false);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadTiles();
  }, [loadTiles]);

  // ── Cargar reinos ─────────────────────────────────────────────────────────
  useEffect(() => {
    void loadReinos((fresh) => setReinos(fresh as ReinoConTile[])).then((data) =>
      setReinos(data as ReinoConTile[]),
    );
  }, []);

  // ── Mover reino en el canvas ──────────────────────────────────────────────
  const handleMarkerMove = (
    markerId: string,
    coord: { x: number; y: number; tile_col: number; tile_row: number },
  ) => {
    const updated = {
      tile_col: coord.tile_col,
      tile_row: coord.tile_row,
      coord_x: coord.x,
      coord_y: coord.y,
    };
    setReinos((prev) =>
      prev.map((r) => (r.id === markerId ? { ...r, ...updated } : r)),
    );
    // Persistir de inmediato (antes se guardaba en lote; simplificamos al
    // unificar la vista, ya que ahora el movimiento es una acción puntual).
    supabase
      .from("reinos")
      .update({
        coord_x: updated.coord_x,
        coord_y: updated.coord_y,
        tile_col: updated.tile_col,
        tile_row: updated.tile_row,
      })
      .eq("id", markerId)
      .then(({ error }) => {
        if (error) showToast("Error al guardar posición", false);
      });
    setSelectedReinoId(null);
  };

  // ── Seleccionar imagen del picker ────────────────────────────────────────
  const handleImageSelect = async (tileId: string, image_url: string) => {
    setTiles((prev) =>
      prev.map((t) => (t.id === tileId ? { ...t, image_url } : t)),
    );
    try {
      const { error } = await supabase
        .from("map_tiles")
        .update({ image_url })
        .eq("id", tileId);
      if (error) throw error;
      await invalidateMapTiles("garlia");
      showToast("Imagen actualizada", true);
    } catch {
      showToast("Error al guardar la imagen", false);
    }
  };

  // ── Eliminar tile ─────────────────────────────────────────────────────────
  const handleDelete = async (tileId: string) => {
    if (!confirm("¿Eliminar este tile? Se perderá la referencia a la imagen."))
      return;
    try {
      await supabase.from("map_tiles").delete().eq("id", tileId);
      setTiles((prev) => prev.filter((t) => t.id !== tileId));
      await invalidateMapTiles("garlia");
      showToast("Tile eliminado", true);
    } catch {
      showToast("Error al eliminar", false);
    }
  };

  // ── Crear tile al instante (click en celda vacía / borde / modal) ────────
  const handleCreateTileAt = async (col: number, row: number) => {
    try {
      const { data, error } = await supabase
        .from("map_tiles")
        .insert({ world_id: "garlia", col, row, order: tiles.length })
        .select()
        .single();
      if (error) throw error;
      setTiles((prev) => [...prev, data as any]);
      await invalidateMapTiles("garlia");
      showToast("Tile creado", true);
    } catch {
      showToast("Error al crear tile", false);
    }
  };

  const existingPositions = tiles.map((t) => ({ col: t.col, row: t.row }));

  // Memoizado: sin esto, el filter crea un array nuevo en cada render de
  // EditorMapa (toast, modal, picker...) y eso reinicia el draw loop del
  // canvas innecesariamente.
  const markersConCoord = useMemo(
    () => reinos.filter((r) => r.coord_x != null && r.coord_y != null),
    [reinos],
  );

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&display=swap');`}</style>

      {toast && (
        <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />
      )}
      {showModal && (
        <ModalNuevoTile
          existingPositions={existingPositions}
          onClose={() => setShowModal(false)}
          onCreated={(tile) => {
            setTiles((prev) => [...prev, tile as any]);
            setShowModal(false);
            showToast("Tile creado", true);
          }}
        />
      )}
      {pickerTile && (
        <ImagePickerModal
          title={`Imagen tile [${pickerTile.col}, ${pickerTile.row}]`}
          onClose={() => setPickerTile(null)}
          onSelect={(url) => {
            void handleImageSelect(pickerTile.id, url);
            setPickerTile(null);
          }}
        />
      )}

      {/* Contenido unificado */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <span
              style={{
                color: "color-mix(in srgb, var(--accent) 40%, transparent)",
              }}
            >
              <Hourglass size={14} />
            </span>
          </div>
        ) : tiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3">
            <Map
              size={24}
              style={{
                color: "color-mix(in srgb, var(--accent) 20%, transparent)",
              }}
            />
            <button
              className="btn-brand flex items-center gap-1.5 px-3 py-2 text-micro uppercase"
              onClick={() => setShowModal(true)}
            >
              <Plus size={11} /> Primer tile
            </button>
          </div>
        ) : (
          <>
            <UnifiedTileCanvas<
              MapTile & { label?: string | null },
              ReinoConTile
            >
              editMode={true}
              markers={markersConCoord}
              selectedMarkerId={selectedReinoId}
              tiles={tiles}
              onMarkerClick={(r) => onSelectReino?.(r.id)}
              onMarkerMove={handleMarkerMove}
              onMarkerSelect={setSelectedReinoId}
              onTileCreate={handleCreateTileAt}
              onTileDelete={(tile) => handleDelete(tile.id)}
              onTilePick={(tile) => setPickerTile(tile)}
            />

            {/* Botón flotante: nuevo tile en posición custom */}
            <button
              className="absolute bottom-3 left-3 z-10 w-9 h-9 flex items-center justify-center transition-opacity hover:opacity-80"
              style={{
                borderRadius: "6px",
                background:
                  "color-mix(in srgb, var(--accent) 18%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                color: "color-mix(in srgb, var(--accent) 80%, transparent)",
                backdropFilter: "blur(10px)",
              }}
              title="Nuevo tile en posición personalizada"
              onClick={() => setShowModal(true)}
            >
              <Plus size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
