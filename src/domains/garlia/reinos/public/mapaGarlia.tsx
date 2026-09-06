"use client";
import { AnimatePresence } from "framer-motion";
import {
  X,
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  UserX,
  User,
  BookOpen,
  BookMarked,
  Bug,
  Package,
  ImageIcon,
  Plus,
  Circle,
  Square,
  Pentagon,
  Trash2,
  Link2,
  Link2Off,
  Trees,
  Paintbrush,
  Eraser,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";

import { MotionDiv, MotionButton } from "@/ui/Motion";
import { rutaLibro, rutaLeer } from "@/domains/garlia/libros/utils/rutas";
import {
  UnifiedTileCanvas,
  type MapTile,
  type BaseArea,
  type AreaTipo,
  type DrawTool,
  type WorldPoint,
  type BaseTileTerrain,
  type TerrainTool,
  TERRAIN_COLORS,
  TERRAIN_COLOR_HEX,
} from "@/domains/garlia/_shared/UnifiedTileCanvas";
import { TileCanvasView } from "@/domains/garlia/_shared/TileCanvasView";
import { ModalDetalle } from "@/domains/garlia/perfil-jugador/PersonalComponents";
import { usePanelFlotante } from "@/domains/garlia/_shared/usePanelFlotanteStore";
import { useIsAdmin } from "@/domains/plataforma/auth/useIsAdmin";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";
import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";
import SimpleImagePicker from "@/ui/SimpleImagePicker";
import {
  invalidateMapTiles,
  loadMapAreas,
  invalidateMapAreas,
} from "@/infra/sync/syncEngine";
import { MapAssetLibraryPanel } from "@/domains/garlia/_shared/MapAssetLibraryPanel";
import {
  useMapAssetLibrary,
  useMapAssetPlacements,
  type MapAssetPlacement,
} from "@/domains/garlia/_shared/useMapAssets";

// ─── Hourglass — reemplaza Loader2 en todos los indicadores de carga ──────────
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
      <style>{`
        @keyframes hg-flip {
          0%,40%  { transform: rotate(0deg); }
          50%,90% { transform: rotate(180deg); }
          100%    { transform: rotate(180deg); }
        }
      `}</style>
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

// ─── Modal para añadir tile en posición custom (portado de EditorMapa) ────────
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
          style={{ fontFamily: "var(--font-cinzel), serif", color: "var(--foreground)" }}
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
                className="text-micro font-bold uppercase tracking-[0.15em]"
                style={{
                  color:
                    "color-mix(in srgb, var(--foreground) 50%, transparent)",
                }}
              >
                {lbl as string}
              </label>
              <input
                className="input-brand text-center font-black text-sm py-1.5"
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

// ─── ModalVincularArea ──────────────────────────────────────────────────────
// Selector reino → (opcional) ciudad de ese reino, para vincular un área
// recién dibujada o re-vincular una ya existente. "Sin vincular" es válida:
// el área queda como zona decorativa/libre en el mapa.
function ModalVincularArea({
  reinos,
  ciudades,
  initialReinoId,
  initialCiudadId,
  initialLabel,
  reinoBloqueado,
  onClose,
  onConfirm,
}: {
  reinos: any[];
  ciudades: any[];
  initialReinoId?: string | null;
  initialCiudadId?: string | null;
  initialLabel?: string;
  /** Si viene seteado, el área se está creando dentro del mapa de ese
   * reino: el selector de reino se oculta (ya lo sabemos) y se pide
   * directo la ciudad, en vez de "elegí primero un reino". */
  reinoBloqueado?: string | null;
  onClose: () => void;
  onConfirm: (
    reinoId: string | null,
    ciudadId: string | null,
    label: string,
  ) => void;
}) {
  const [reinoId, setReinoId] = useState<string | null>(
    reinoBloqueado ?? initialReinoId ?? null,
  );
  const [ciudadId, setCiudadId] = useState<string | null>(
    initialCiudadId ?? null,
  );
  const [label, setLabel] = useState(initialLabel ?? "");
  const [saving, setSaving] = useState(false);

  const ciudadesDelReino = reinoId
    ? ciudades.filter((c) => c.reino_id === reinoId)
    : [];

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(reinoId, ciudadId, label);
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
          style={{ fontFamily: "var(--font-cinzel), serif", color: "var(--foreground)" }}
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

        {reinoBloqueado ? (
          <div className="flex flex-col gap-1">
            <label
              className="text-micro font-bold uppercase tracking-[0.15em]"
              style={{
                color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
              }}
            >
              Reino
            </label>
            <div
              className="text-sm py-1.5 px-2"
              style={{
                borderRadius: "1px",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
                color: "var(--foreground)",
                opacity: 0.75,
              }}
            >
              {reinos.find((r) => r.id === reinoBloqueado)?.nombre ??
                "Este reino"}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label
              className="text-micro font-bold uppercase tracking-[0.15em]"
              style={{
                color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
              }}
            >
              Reino
            </label>
            <select
              className="input-brand text-sm py-1.5 px-2"
              style={{ borderRadius: "1px" }}
              value={reinoId ?? ""}
              onChange={(e) => {
                const val = e.target.value || null;
                setReinoId(val);
                setCiudadId(null); // cambiar de reino invalida la ciudad elegida
              }}
            >
              <option value="">— Sin vincular a un reino —</option>
              {reinos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        {reinoId && (
          <div className="flex flex-col gap-1">
            <label
              className="text-micro font-bold uppercase tracking-[0.15em]"
              style={{
                color:
                  "color-mix(in srgb, var(--foreground) 50%, transparent)",
              }}
            >
              {reinoBloqueado ? "Ciudad" : "Ciudad (opcional)"}
            </label>
            <select
              className="input-brand text-sm py-1.5 px-2"
              style={{ borderRadius: "1px" }}
              value={ciudadId ?? ""}
              onChange={(e) => setCiudadId(e.target.value || null)}
            >
              <option value="">
                {reinoBloqueado
                  ? "— Elegí una ciudad —"
                  : "— Todo el reino, sin ciudad puntual —"}
              </option>
              {ciudadesDelReino.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {ciudadesDelReino.length === 0 && (
              <p
                className="text-micro"
                style={{
                  color:
                    "color-mix(in srgb, var(--foreground) 40%, transparent)",
                }}
              >
                Este reino todavía no tiene ciudades cargadas.
              </p>
            )}
          </div>
        )}

        <button
          className="btn-brand w-full justify-center py-2.5 text-micro uppercase disabled:opacity-50"
          disabled={saving}
          onClick={handleConfirm}
        >
          {saving ? <Hourglass size={11} /> : <Link2 size={11} />}
          {reinoId || ciudadId ? "Vincular" : "Guardar sin vincular"}
        </button>
      </div>
    </div>
  );
}

// ─── ImagePickerModal para tiles (portado de EditorMapa) ──────────────────────
function TileImagePickerModal({
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
        className="bg-white-custom rounded-xl shadow-2xl border border-primary/15 w-full max-w-lg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-micro font-black uppercase tracking-[0.15em] text-primary/50 flex items-center gap-2">
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

// ─── Types ────────────────────────────────────────────────────────────────────
type EntidadModal =
  | { tipo: "personaje"; data: any }
  | { tipo: "criatura"; data: any }
  | { tipo: "item"; data: any }
  | { tipo: "item_inv"; data: any };
type ToastType = "success" | "error";

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: ToastType;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <MotionDiv
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-300 flex items-center gap-3 px-5 py-3 shadow-lg text-micro font-bold uppercase tracking-widest"
      exit={{ opacity: 0, y: 20 }}
      initial={{ opacity: 0, y: 20 }}
      style={{
        background:
          type === "success" ? "rgba(5,150,105,0.92)" : "rgba(185,28,28,0.92)",
        color: "var(--btn-text, #fff)",
        border: `1px solid ${type === "success" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
        borderRadius: "1px",
        letterSpacing: "0.15em",
      }}
    >
      {type === "success" ? (
        <CheckCircle2 size={16} />
      ) : (
        <AlertCircle size={16} />
      )}
      {message}
    </MotionDiv>
  );
}

// ─── Panel Contenido ──────────────────────────────────────────────────────────
function PanelContenido({
  editMode,
  reinoSeleccionado,
  puntoSeleccionado,
  setPuntoSeleccionado,
  setDetallesReino,
  setModifiedDetalles,
  setReinoSeleccionado,
  personajesReino,
  personajesDesbloqueados,
  handlePersonajeClick,
  _modifiedDetalles,
  isSaving,
  handleSaveChanges,
  hayPendiente,
  setReinoModificado,
  _isUploadingImg,
  _handleImageUpload,
  _imgInputRef,
  librosReino,
  _librosColeccion,
  capitulosReino,
  loadingLibros,
  personajesCiudad,
  criaturasCiudad,
  itemsCiudad,
  loadingCiudad,
  librosVinculables,
  onVincularLibro,
  onDesvincularLibro,
  vinculandoLibroId,
  personajesVinculables,
  onVincularPersonaje,
  onDesvincularPersonaje,
  vinculandoPersonajeId,
  onIniciarDibujoCiudad,
}: any) {
  const router = useRouter();
  const [buscadorLibrosOpen, setBuscadorLibrosOpen] = useState(false);
  const [busquedaLibro, setBusquedaLibro] = useState("");
  const [buscadorPersonajesOpen, setBuscadorPersonajesOpen] = useState(false);
  const [busquedaPersonaje, setBusquedaPersonaje] = useState("");
  if (editMode) {
    return (
      <div className="flex flex-col gap-4 grow">
        {/* Title with decorative line — mismo diseño que el modo público,
            pero el <h2> se reemplaza por un <input> editable en su lugar. */}
        <div className="relative mb-2">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="h-px flex-1"
              style={{
                background: `linear-gradient(to right, transparent, color-mix(in srgb, var(--accent) 40%, transparent))`,
              }}
            />
            <div
              className="w-1.5 h-1.5 rotate-45"
              style={{ background: "var(--accent)" }}
            />
            <div
              className="h-px flex-1"
              style={{
                background: `linear-gradient(to left, transparent, color-mix(in srgb, var(--accent) 40%, transparent))`,
              }}
            />
          </div>
          <input
            className="w-full bg-transparent font-bold text-2xl uppercase tracking-[0.18em] leading-none text-center outline-none"
            style={{ fontFamily: "var(--font-cinzel), serif", color: "var(--foreground)" }}
            type="text"
            value={
              puntoSeleccionado
                ? puntoSeleccionado.nombre
                : reinoSeleccionado.nombre
            }
            onChange={(e) => {
              if (puntoSeleccionado) {
                setPuntoSeleccionado({
                  ...puntoSeleccionado,
                  nombre: e.target.value,
                });
                setDetallesReino((prev: any[]) =>
                  prev.map((p) =>
                    p.id === puntoSeleccionado.id
                      ? { ...p, nombre: e.target.value }
                      : p,
                  ),
                );
                setModifiedDetalles((prev: Set<string>) =>
                  new Set(prev).add(puntoSeleccionado.id),
                );
              } else
                setReinoSeleccionado({
                  ...reinoSeleccionado,
                  nombre: e.target.value,
                });
              if (!puntoSeleccionado) setReinoModificado(true);
            }}
          />
          <div className="flex items-center gap-3 mt-2">
            <div
              className="h-px flex-1"
              style={{
                background: `linear-gradient(to right, transparent, color-mix(in srgb, var(--accent) 40%, transparent))`,
              }}
            />
            <div
              className="w-1.5 h-1.5 rotate-45"
              style={{ background: "var(--accent)" }}
            />
            <div
              className="h-px flex-1"
              style={{
                background: `linear-gradient(to left, transparent, color-mix(in srgb, var(--accent) 40%, transparent))`,
              }}
            />
          </div>
        </div>

        {/* Editar área del mapa (círculo/rectángulo/forma libre) se sacó de
            acá — quedaba duplicado con la barra de herramientas flotante
            sobre el mapa (que ya cubre reino y ciudad) y generaba errores
            por dos flujos de dibujo compitiendo entre sí. El botón de abajo
            SÍ reusa esa misma barra flotante (drawTool compartido) en vez
            de abrir un flujo propio — solo la activa con la ciudad ya
            preseleccionada, para que el admin no tenga que buscarla. */}
        {!puntoSeleccionado && onIniciarDibujoCiudad && (
          <button
            className="flex items-center justify-center gap-2 py-2.5 text-micro font-black uppercase tracking-widest transition-opacity hover:opacity-80"
            style={{
              borderRadius: "1px",
              border: "1px dashed color-mix(in srgb, var(--accent) 40%, transparent)",
              color: "var(--accent)",
            }}
            type="button"
            onClick={() => void onIniciarDibujoCiudad()}
          >
            <Plus size={12} />
            Añadir ciudad en el mapa
          </button>
        )}

        {/* Lore text — mismo marco decorativo con esquinas que el modo
            público, pero con un <textarea> editable adentro. */}
        <div
          className="relative p-5 border"
          style={{
            borderColor: "color-mix(in srgb, var(--accent) 15%, transparent)",
            background: "color-mix(in srgb, var(--primary) 8%, transparent)",
          }}
        >
          <div
            className="absolute top-0 left-0 w-3 h-3 border-t border-l"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
            }}
          />
          <div
            className="absolute top-0 right-0 w-3 h-3 border-t border-r"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
            }}
          />
          <div
            className="absolute bottom-0 left-0 w-3 h-3 border-b border-l"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
            }}
          />
          <div
            className="absolute bottom-0 right-0 w-3 h-3 border-b border-r"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
            }}
          />
          <textarea
            className="w-full bg-transparent text-sm italic leading-relaxed h-36 resize-none outline-none"
            style={{
              color: "color-mix(in srgb, var(--foreground) 70%, transparent)",
            }}
            value={
              puntoSeleccionado
                ? puntoSeleccionado.descripcion
                : reinoSeleccionado.descripcion
            }
            onChange={(e) => {
              if (puntoSeleccionado) {
                setPuntoSeleccionado({
                  ...puntoSeleccionado,
                  descripcion: e.target.value,
                });
                setDetallesReino((prev: any[]) =>
                  prev.map((p) =>
                    p.id === puntoSeleccionado.id
                      ? { ...p, descripcion: e.target.value }
                      : p,
                  ),
                );
                setModifiedDetalles((prev: Set<string>) =>
                  new Set(prev).add(puntoSeleccionado.id),
                );
              } else
                setReinoSeleccionado({
                  ...reinoSeleccionado,
                  descripcion: e.target.value,
                });
              if (!puntoSeleccionado) setReinoModificado(true);
            }}
          />
        </div>

        {/* ── Libros vinculados (solo para reinos, no para puntos de ciudad) ── */}
        {!puntoSeleccionado && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between ml-1">
              <label
                className="text-micro font-bold uppercase tracking-widest"
                style={{
                  color: "color-mix(in srgb, var(--foreground) 60%, transparent)",
                }}
              >
                <BookOpen className="inline mr-1 -mt-0.5" size={11} />
                Libros vinculados
              </label>
              <button
                className="text-micro font-bold uppercase flex items-center gap-1 px-2 py-1 transition-opacity hover:opacity-70"
                style={{ color: "var(--accent)" }}
                type="button"
                onClick={() => setBuscadorLibrosOpen((v) => !v)}
              >
                <Plus size={10} />
                Añadir
              </button>
            </div>

            {loadingLibros ? (
              <div
                className="flex justify-center py-3"
                style={{
                  color: "color-mix(in srgb, var(--accent) 50%, transparent)",
                }}
              >
                <Hourglass size={12} />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {[...(librosReino ?? []), ...(_librosColeccion ?? [])].length ===
                  0 && (
                  <p
                    className="text-micro italic px-1"
                    style={{
                      color: "color-mix(in srgb, var(--foreground) 40%, transparent)",
                    }}
                  >
                    Sin libros vinculados todavía
                  </p>
                )}
                {[...(librosReino ?? []), ...(_librosColeccion ?? [])].map(
                  (libro: any) => (
                    <div
                      key={libro.id}
                      className="flex items-center gap-2 px-3 py-2 border"
                      style={{
                        background:
                          "color-mix(in srgb, var(--primary) 8%, transparent)",
                        borderColor:
                          "color-mix(in srgb, var(--accent) 15%, transparent)",
                        borderRadius: "1px",
                      }}
                    >
                      {libro.portada_url && (
                        <img
                          alt={libro.titulo}
                          className="w-6 h-9 object-cover shrink-0"
                          src={libro.portada_url}
                        />
                      )}
                      <span
                        className="text-micro font-semibold uppercase flex-1 min-w-0 truncate"
                        style={{ color: "var(--foreground)" }}
                      >
                        {libro.titulo}
                      </span>
                      <button
                        className="shrink-0 w-6 h-6 flex items-center justify-center transition-opacity hover:opacity-70"
                        disabled={vinculandoLibroId === libro.id}
                        style={{
                          color: "color-mix(in srgb, var(--foreground) 40%, transparent)",
                        }}
                        title="Quitar vínculo con este reino"
                        type="button"
                        onClick={() => onDesvincularLibro?.(libro)}
                      >
                        {vinculandoLibroId === libro.id ? (
                          <Hourglass size={10} />
                        ) : (
                          <X size={12} />
                        )}
                      </button>
                    </div>
                  ),
                )}
              </div>
            )}

            {/* Buscador para vincular un libro existente */}
            {buscadorLibrosOpen && (
              <div
                className="flex flex-col gap-2 p-3 border mt-1"
                style={{
                  background:
                    "color-mix(in srgb, var(--bg-main) 60%, transparent)",
                  borderColor:
                    "color-mix(in srgb, var(--accent) 15%, transparent)",
                  borderRadius: "1px",
                }}
              >
                <input
                  autoFocus
                  className="input-brand text-micro px-3 py-2"
                  placeholder="Buscar libro por título…"
                  style={{ borderRadius: "1px" }}
                  type="text"
                  value={busquedaLibro}
                  onChange={(e) => setBusquedaLibro(e.target.value)}
                />
                <div
                  className="flex flex-col gap-1 max-h-40 overflow-y-auto"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {(librosVinculables ?? [])
                    .filter((l: any) =>
                      l.titulo
                        .toLowerCase()
                        .includes(busquedaLibro.toLowerCase()),
                    )
                    .filter(
                      (l: any) =>
                        !(librosReino ?? []).some((r: any) => r.id === l.id) &&
                        !(_librosColeccion ?? []).some(
                          (r: any) => r.id === l.id,
                        ),
                    )
                    .slice(0, 30)
                    .map((libro: any) => (
                      <button
                        key={libro.id}
                        className="text-left text-micro font-semibold uppercase px-2 py-1.5 transition-colors hover:opacity-70 disabled:opacity-40"
                        disabled={vinculandoLibroId === libro.id}
                        style={{ color: "var(--foreground)" }}
                        type="button"
                        onClick={() => {
                          onVincularLibro?.(libro);
                          setBusquedaLibro("");
                        }}
                      >
                        {vinculandoLibroId === libro.id ? (
                          <Hourglass size={10} />
                        ) : (
                          libro.titulo
                        )}
                      </button>
                    ))}
                  {busquedaLibro &&
                    (librosVinculables ?? []).filter((l: any) =>
                      l.titulo
                        .toLowerCase()
                        .includes(busquedaLibro.toLowerCase()),
                    ).length === 0 && (
                      <p
                        className="text-micro italic px-2 py-1"
                        style={{
                          color:
                            "color-mix(in srgb, var(--foreground) 40%, transparent)",
                        }}
                      >
                        Sin resultados
                      </p>
                    )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Habitantes del reino (solo lectura — se gestionan desde cada ciudad) ── */}
        {!puntoSeleccionado && personajesReino.length > 0 && (
          <div className="flex flex-col gap-2">
            <label
              className="text-micro font-bold uppercase tracking-widest ml-1"
              style={{
                color: "color-mix(in srgb, var(--foreground) 60%, transparent)",
              }}
            >
              <User className="inline mr-1 -mt-0.5" size={11} />
              Habitantes
            </label>
            <p
              className="text-micro italic px-1 -mt-1"
              style={{
                color: "color-mix(in srgb, var(--foreground) 40%, transparent)",
              }}
            >
              Se gestionan desde cada ciudad
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {personajesReino.map((p: any) => (
                <button
                  key={p.id}
                  className="flex items-center gap-2 px-2 py-2 border min-w-0 text-left transition-opacity hover:opacity-80"
                  style={{
                    background:
                      "color-mix(in srgb, var(--primary) 8%, transparent)",
                    borderColor:
                      "color-mix(in srgb, var(--accent) 15%, transparent)",
                    borderRadius: "1px",
                  }}
                  type="button"
                  onClick={() => handlePersonajeClick(p)}
                >
                  {p.img_url && (
                    <div
                      className="shrink-0 w-7 h-7 overflow-hidden border"
                      style={{
                        borderColor:
                          "color-mix(in srgb, var(--accent) 20%, transparent)",
                        borderRadius: "1px",
                      }}
                    >
                      <Image
                        alt={p.nombre}
                        className="w-full h-full object-cover"
                        src={p.img_url}
                      />
                    </div>
                  )}
                  <span
                    className="text-micro font-semibold uppercase flex-1 min-w-0 truncate"
                    style={{ color: "var(--foreground)" }}
                  >
                    {p.nombre}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Habitantes (solo para ciudades, no para reinos) ── */}
        {puntoSeleccionado && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between ml-1">
              <label
                className="text-micro font-bold uppercase tracking-widest"
                style={{
                  color: "color-mix(in srgb, var(--foreground) 60%, transparent)",
                }}
              >
                <User className="inline mr-1 -mt-0.5" size={11} />
                Habitantes
              </label>
              <button
                className="text-micro font-bold uppercase flex items-center gap-1 px-2 py-1 transition-opacity hover:opacity-70"
                style={{ color: "var(--accent)" }}
                type="button"
                onClick={() => setBuscadorPersonajesOpen((v) => !v)}
              >
                <Plus size={10} />
                Añadir
              </button>
            </div>

            {loadingCiudad ? (
              <div
                className="flex justify-center py-3"
                style={{
                  color: "color-mix(in srgb, var(--accent) 50%, transparent)",
                }}
              >
                <Hourglass size={12} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {(personajesCiudad ?? []).length === 0 && (
                  <p
                    className="text-micro italic px-1 col-span-2"
                    style={{
                      color: "color-mix(in srgb, var(--foreground) 40%, transparent)",
                    }}
                  >
                    Sin personajes vinculados todavía
                  </p>
                )}
                {(personajesCiudad ?? []).map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 px-2 py-2 border min-w-0"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 8%, transparent)",
                      borderColor:
                        "color-mix(in srgb, var(--accent) 15%, transparent)",
                      borderRadius: "1px",
                    }}
                  >
                    <button
                      className="flex items-center gap-2 flex-1 min-w-0 text-left transition-opacity hover:opacity-80"
                      title="Abrir editor de este personaje"
                      type="button"
                      onClick={() => handlePersonajeClick(p)}
                    >
                      {p.img_url && (
                        <div
                          className="shrink-0 w-7 h-7 overflow-hidden border"
                          style={{
                            borderColor:
                              "color-mix(in srgb, var(--accent) 20%, transparent)",
                            borderRadius: "1px",
                          }}
                        >
                          <Image
                            alt={p.nombre}
                            className="w-full h-full object-cover"
                            src={p.img_url}
                          />
                        </div>
                      )}
                      <span
                        className="text-micro font-semibold uppercase flex-1 min-w-0 truncate"
                        style={{ color: "var(--foreground)" }}
                      >
                        {p.nombre}
                      </span>
                    </button>
                    <button
                      className="shrink-0 w-5 h-5 flex items-center justify-center transition-opacity hover:opacity-70"
                      disabled={vinculandoPersonajeId === p.id}
                      style={{
                        color: "color-mix(in srgb, var(--foreground) 40%, transparent)",
                      }}
                      title="Quitar de esta ciudad"
                      type="button"
                      onClick={() => onDesvincularPersonaje?.(p)}
                    >
                      {vinculandoPersonajeId === p.id ? (
                        <Hourglass size={10} />
                      ) : (
                        <X size={12} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Buscador para vincular un personaje existente */}
            {buscadorPersonajesOpen && (
              <div
                className="flex flex-col gap-2 p-3 border mt-1"
                style={{
                  background:
                    "color-mix(in srgb, var(--bg-main) 60%, transparent)",
                  borderColor:
                    "color-mix(in srgb, var(--accent) 15%, transparent)",
                  borderRadius: "1px",
                }}
              >
                <input
                  autoFocus
                  className="input-brand text-micro px-3 py-2"
                  placeholder="Buscar personaje por nombre…"
                  style={{ borderRadius: "1px" }}
                  type="text"
                  value={busquedaPersonaje}
                  onChange={(e) => setBusquedaPersonaje(e.target.value)}
                />
                <div
                  className="flex flex-col gap-1 max-h-40 overflow-y-auto"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {(personajesVinculables ?? [])
                    .filter((p: any) =>
                      p.nombre
                        .toLowerCase()
                        .includes(busquedaPersonaje.toLowerCase()),
                    )
                    .filter(
                      (p: any) =>
                        !(personajesCiudad ?? []).some(
                          (c: any) => c.id === p.id,
                        ),
                    )
                    .slice(0, 30)
                    .map((p: any) => (
                      <button
                        key={p.id}
                        className="text-left text-micro font-semibold uppercase px-2 py-1.5 transition-colors hover:opacity-70 disabled:opacity-40"
                        disabled={vinculandoPersonajeId === p.id}
                        style={{ color: "var(--foreground)" }}
                        type="button"
                        onClick={() => {
                          onVincularPersonaje?.(p);
                          setBusquedaPersonaje("");
                        }}
                      >
                        {vinculandoPersonajeId === p.id ? (
                          <Hourglass size={10} />
                        ) : (
                          p.nombre
                        )}
                      </button>
                    ))}
                  {busquedaPersonaje &&
                    (personajesVinculables ?? []).filter((p: any) =>
                      p.nombre
                        .toLowerCase()
                        .includes(busquedaPersonaje.toLowerCase()),
                    ).length === 0 && (
                      <p
                        className="text-micro italic px-2 py-1"
                        style={{
                          color:
                            "color-mix(in srgb, var(--foreground) 40%, transparent)",
                        }}
                      >
                        Sin resultados
                      </p>
                    )}
                </div>
              </div>
            )}
          </div>
        )}

        {(isSaving || hayPendiente) && (
          <div
            className="flex items-center justify-center gap-2 text-micro uppercase py-3 mt-auto opacity-50"
            style={{ letterSpacing: "0.12em" }}
          >
            {isSaving ? (
              <>
                <Hourglass size={12} /> Guardando…
              </>
            ) : (
              <>
                <Save size={12} /> Guardado automático
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Title with decorative line */}
      <div className="relative mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="h-px flex-1"
            style={{
              background: `linear-gradient(to right, transparent, color-mix(in srgb, var(--accent) 40%, transparent))`,
            }}
          />
          <div
            className="w-1.5 h-1.5 rotate-45"
            style={{ background: "var(--accent)" }}
          />
          <div
            className="h-px flex-1"
            style={{
              background: `linear-gradient(to left, transparent, color-mix(in srgb, var(--accent) 40%, transparent))`,
            }}
          />
        </div>
        <h2
          className="font-bold text-2xl uppercase tracking-[0.18em] leading-none text-center"
          style={{ fontFamily: "var(--font-cinzel), serif", color: "var(--foreground)" }}
        >
          {puntoSeleccionado
            ? puntoSeleccionado.nombre
            : reinoSeleccionado.nombre}
        </h2>
        <div className="flex items-center gap-3 mt-2">
          <div
            className="h-px flex-1"
            style={{
              background: `linear-gradient(to right, transparent, color-mix(in srgb, var(--accent) 40%, transparent))`,
            }}
          />
          <div
            className="w-1.5 h-1.5 rotate-45"
            style={{ background: "var(--accent)" }}
          />
          <div
            className="h-px flex-1"
            style={{
              background: `linear-gradient(to left, transparent, color-mix(in srgb, var(--accent) 40%, transparent))`,
            }}
          />
        </div>
      </div>

      <div className="space-y-6 grow overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-accent/20">
        {/* Lore text */}
        <div
          className="relative p-5 border"
          style={{
            borderColor: "color-mix(in srgb, var(--accent) 15%, transparent)",
            background: "color-mix(in srgb, var(--primary) 8%, transparent)",
          }}
        >
          <div
            className="absolute top-0 left-0 w-3 h-3 border-t border-l"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
            }}
          />
          <div
            className="absolute top-0 right-0 w-3 h-3 border-t border-r"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
            }}
          />
          <div
            className="absolute bottom-0 left-0 w-3 h-3 border-b border-l"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
            }}
          />
          <div
            className="absolute bottom-0 right-0 w-3 h-3 border-b border-r"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
            }}
          />
          <p
            className="text-sm italic leading-relaxed"
            style={{
              color: "color-mix(in srgb, var(--foreground) 70%, transparent)",
            }}
          >
            &ldquo;
            {puntoSeleccionado
              ? puntoSeleccionado.descripcion
              : reinoSeleccionado.descripcion}
            &rdquo;
          </p>
        </div>

        {/* ── Habitantes de la ciudad seleccionada ── */}
        {puntoSeleccionado &&
          (loadingCiudad ? (
            <div
              className="flex justify-center py-6"
              style={{
                color: "color-mix(in srgb, var(--accent) 50%, transparent)",
              }}
            >
              <Hourglass size={14} />
            </div>
          ) : (
            <>
              {/* Personajes */}
              {personajesCiudad.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="h-px flex-1"
                      style={{
                        background:
                          "color-mix(in srgb, var(--accent) 20%, transparent)",
                      }}
                    />
                    <span
                      className="text-micro font-black uppercase tracking-[0.3em]"
                      style={{
                        color:
                          "color-mix(in srgb, var(--accent) 60%, transparent)",
                      }}
                    >
                      <User className="inline mr-1" size={8} />
                      Habitantes
                    </span>
                    <div
                      className="h-px flex-1"
                      style={{
                        background:
                          "color-mix(in srgb, var(--accent) 20%, transparent)",
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {personajesCiudad.map((p: any) => {
                      const desbloqueado =
                        editMode || personajesDesbloqueados.has(p.id);
                      return (
                        <button
                          key={p.id}
                          className="flex items-center gap-2 p-2 w-full text-left transition-all"
                          style={{
                            background: desbloqueado
                              ? "color-mix(in srgb, var(--primary) 15%, transparent)"
                              : "color-mix(in srgb, var(--bg-main) 50%, transparent)",
                            border: `1px solid ${desbloqueado ? "color-mix(in srgb, var(--accent) 20%, transparent)" : "color-mix(in srgb, var(--accent) 7%, transparent)"}`,
                            opacity: desbloqueado ? 1 : 0.5,
                            cursor: desbloqueado ? "pointer" : "default",
                          }}
                          onClick={
                            desbloqueado
                              ? () => handlePersonajeClick(p)
                              : undefined
                          }
                        >
                          <div
                            className="shrink-0 w-9 h-9 overflow-hidden flex items-center justify-center border"
                            style={{
                              borderColor: desbloqueado
                                ? "color-mix(in srgb, var(--accent) 25%, transparent)"
                                : "color-mix(in srgb, var(--accent) 8%, transparent)",
                              background:
                                "color-mix(in srgb, var(--bg-main) 80%, transparent)",
                              filter: desbloqueado
                                ? "none"
                                : "grayscale(100%) blur(2px)",
                              borderRadius: "1px",
                            }}
                          >
                            {desbloqueado && p.img_url ? (
                              <Image
                                alt={p.nombre}
                                className="w-full h-full object-cover"
                                src={p.img_url}
                              />
                            ) : (
                              <UserX
                                size={14}
                                style={{
                                  color:
                                    "color-mix(in srgb, var(--accent) 30%, transparent)",
                                }}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-micro font-semibold uppercase leading-tight truncate"
                              style={{
                                color: desbloqueado
                                  ? "var(--foreground)"
                                  : "color-mix(in srgb, var(--accent) 30%, transparent)",
                              }}
                            >
                              {desbloqueado ? p.nombre : "???"}
                            </p>
                            {p.especie && (
                              <p
                                className="text-micro mt-0.5 truncate"
                                style={{
                                  color:
                                    "color-mix(in srgb, var(--accent) 55%, transparent)",
                                }}
                              >
                                {desbloqueado ? p.especie : "Desconocido"}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Criaturas */}
              {criaturasCiudad.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="h-px flex-1"
                      style={{
                        background:
                          "color-mix(in srgb, var(--accent) 20%, transparent)",
                      }}
                    />
                    <span
                      className="text-micro font-black uppercase tracking-[0.3em]"
                      style={{
                        color:
                          "color-mix(in srgb, var(--accent) 60%, transparent)",
                      }}
                    >
                      <Bug className="inline mr-1" size={8} />
                      Criaturas avistadas
                    </span>
                    <div
                      className="h-px flex-1"
                      style={{
                        background:
                          "color-mix(in srgb, var(--accent) 20%, transparent)",
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {criaturasCiudad.map((c: any) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2.5 px-3 py-2 border"
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary) 10%, transparent)",
                          borderColor:
                            "color-mix(in srgb, var(--accent) 12%, transparent)",
                          borderRadius: "1px",
                        }}
                      >
                        <div
                          className="shrink-0 w-8 h-8 overflow-hidden border"
                          style={{
                            borderColor:
                              "color-mix(in srgb, var(--accent) 20%, transparent)",
                            background:
                              "color-mix(in srgb, var(--bg-main) 80%, transparent)",
                            borderRadius: "1px",
                          }}
                        >
                          {c.imagen_url ? (
                            <Image
                              alt={c.nombre}
                              className="w-full h-full object-cover"
                              src={c.imagen_url}
                            />
                          ) : (
                            <Bug
                              className="m-auto mt-1"
                              size={14}
                              style={{
                                color:
                                  "color-mix(in srgb, var(--accent) 40%, transparent)",
                              }}
                            />
                          )}
                        </div>
                        <p
                          className="text-micro font-semibold uppercase truncate"
                          style={{ color: "var(--foreground)" }}
                        >
                          {c.nombre}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Vacío */}
              {personajesCiudad.length === 0 &&
                criaturasCiudad.length === 0 &&
                itemsCiudad.length === 0 && (
                  <p
                    className="text-center text-micro font-black uppercase tracking-widest py-4"
                    style={{
                      color:
                        "color-mix(in srgb, var(--accent) 25%, transparent)",
                    }}
                  >
                    Sin habitantes registrados
                  </p>
                )}
            </>
          ))}

        {/* Characters grid — 2 per row, no "ver" button */}
        {!puntoSeleccionado && personajesReino.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div
                className="h-px flex-1"
                style={{
                  background:
                    "color-mix(in srgb, var(--accent) 20%, transparent)",
                }}
              />
              <span
                className="text-micro font-black uppercase tracking-[0.3em]"
                style={{
                  color: "color-mix(in srgb, var(--accent) 60%, transparent)",
                }}
              >
                Habitantes conocidos
              </span>
              <div
                className="h-px flex-1"
                style={{
                  background:
                    "color-mix(in srgb, var(--accent) 20%, transparent)",
                }}
              />
            </div>
            {/* Vista de solo lectura: reúne los habitantes de todas las
                ciudades del reino. Añadir/quitar personajes se hace siempre
                desde el panel de cada ciudad, nunca desde aquí. */}
            {editMode && (
              <p
                className="text-micro italic mb-2 px-1"
                style={{
                  color: "color-mix(in srgb, var(--foreground) 40%, transparent)",
                }}
              >
                Se gestionan desde cada ciudad
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {personajesReino.map((p: any) => {
                const desbloqueado =
                  editMode || personajesDesbloqueados.has(p.id);
                return (
                  <button
                    key={p.id}
                    className="flex items-center gap-2 p-2 w-full text-left transition-all group"
                    style={{
                      background: desbloqueado
                        ? "color-mix(in srgb, var(--primary) 15%, transparent)"
                        : "color-mix(in srgb, var(--bg-main) 50%, transparent)",
                      border: `1px solid ${desbloqueado ? "color-mix(in srgb, var(--accent) 20%, transparent)" : "color-mix(in srgb, var(--accent) 7%, transparent)"}`,
                      opacity: desbloqueado ? 1 : 0.5,
                      cursor: desbloqueado ? "pointer" : "default",
                    }}
                    onClick={
                      desbloqueado ? () => handlePersonajeClick(p) : undefined
                    }
                  >
                    {/* Avatar — izquierda */}
                    <div
                      className="shrink-0 w-10 h-10 overflow-hidden flex items-center justify-center border"
                      style={{
                        borderColor: desbloqueado
                          ? "color-mix(in srgb, var(--accent) 25%, transparent)"
                          : "color-mix(in srgb, var(--accent) 8%, transparent)",
                        background:
                          "color-mix(in srgb, var(--bg-main) 80%, transparent)",
                        filter: desbloqueado
                          ? "none"
                          : "grayscale(100%) blur(2px)",
                        borderRadius: "1px",
                      }}
                    >
                      {desbloqueado && p.img_url ? (
                        <Image
                          alt={p.nombre}
                          className="w-full h-full object-cover"
                          src={p.img_url}
                        />
                      ) : (
                        <UserX
                          size={16}
                          style={{
                            color:
                              "color-mix(in srgb, var(--accent) 30%, transparent)",
                          }}
                        />
                      )}
                    </div>
                    {/* Nombre + especie — derecha */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-micro font-semibold uppercase leading-tight truncate"
                        style={{
                          color: desbloqueado
                            ? "var(--foreground)"
                            : "color-mix(in srgb, var(--accent) 30%, transparent)",
                          textDecoration: desbloqueado
                            ? "none"
                            : "line-through",
                          textDecorationColor:
                            "color-mix(in srgb, var(--accent) 30%, transparent)",
                        }}
                      >
                        {desbloqueado ? p.nombre : "???"}
                      </p>
                      {p.especie && (
                        <p
                          className="text-micro font-medium mt-0.5 truncate"
                          style={{
                            color:
                              "color-mix(in srgb, var(--accent) 55%, transparent)",
                          }}
                        >
                          {desbloqueado ? p.especie : "Desconocido"}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Books of this kingdom */}
        {!puntoSeleccionado &&
          (loadingLibros ? (
            <div
              className="flex justify-center py-6"
              style={{
                color: "color-mix(in srgb, var(--accent) 50%, transparent)",
              }}
            >
              <Hourglass size={14} />
            </div>
          ) : (
            <>
              {/* ── Libros propiamente dichos: portada + título + sinopsis, click navega al libro ── */}
              {librosReino && librosReino.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="h-px flex-1"
                      style={{
                        background:
                          "color-mix(in srgb, var(--accent) 20%, transparent)",
                      }}
                    />
                    <span
                      className="text-micro font-black uppercase tracking-[0.3em] flex items-center gap-1.5"
                      style={{
                        color:
                          "color-mix(in srgb, var(--accent) 60%, transparent)",
                      }}
                    >
                      <BookOpen size={9} /> Libros de este reino
                    </span>
                    <div
                      className="h-px flex-1"
                      style={{
                        background:
                          "color-mix(in srgb, var(--accent) 20%, transparent)",
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    {librosReino.map((libro: any) => (
                      <button
                        key={libro.id}
                        className="flex gap-3 p-3 border w-full text-left transition-all hover:opacity-80 active:scale-[0.98]"
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary) 10%, transparent)",
                          borderColor:
                            "color-mix(in srgb, var(--accent) 15%, transparent)",
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          router.push(rutaLibro(libro.id))
                        }
                      >
                        {libro.portada_url && (
                          <img
                            alt={libro.titulo}
                            className="w-14 h-20 object-cover shrink-0"
                            src={libro.portada_url}
                            style={{ filter: "brightness(0.92)" }}
                          />
                        )}
                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                          <p
                            className="text-sm font-bold uppercase leading-tight"
                            style={{
                              color: "var(--foreground)",
                              fontFamily: "var(--font-cinzel), serif",
                            }}
                          >
                            {libro.titulo}
                          </p>
                          {libro.estado && (
                            <p
                              className="text-micro font-black uppercase"
                              style={{
                                color:
                                  "color-mix(in srgb, var(--accent) 60%, transparent)",
                                letterSpacing: "0.12em",
                              }}
                            >
                              {libro.estado}
                            </p>
                          )}
                          {libro.sinopsis && (
                            <p
                              className="text-micro italic leading-snug line-clamp-3"
                              style={{
                                color:
                                  "color-mix(in srgb, var(--foreground) 60%, transparent)",
                              }}
                            >
                              {libro.sinopsis}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Capítulos de colecciones (One Shot / Poemario), agrupados por libro ── */}
              {capitulosReino &&
                capitulosReino.length > 0 &&
                (() => {
                  // Agrupar por libro_id
                  const grupos: Record<
                    string,
                    { titulo: string; categoria: string; caps: any[] }
                  > = {};
                  for (const cap of capitulosReino) {
                    const lid = cap.libro_id ?? "sin_libro";
                    if (!grupos[lid])
                      grupos[lid] = {
                        titulo: cap.libro_titulo ?? "Sin título",
                        categoria: cap.libro_categoria ?? "",
                        caps: [],
                      };
                    grupos[lid].caps.push(cap);
                  }
                  return Object.entries(grupos).map(([libroId, grupo]) => (
                    <div key={libroId}>
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="h-px flex-1"
                          style={{
                            background:
                              "color-mix(in srgb, var(--accent) 20%, transparent)",
                          }}
                        />
                        <span
                          className="text-micro font-black uppercase tracking-[0.3em] flex items-center gap-1.5"
                          style={{
                            color:
                              "color-mix(in srgb, var(--accent) 60%, transparent)",
                          }}
                        >
                          <BookMarked size={9} />
                          {grupo.categoria && grupo.categoria !== "Libro"
                            ? grupo.categoria
                            : grupo.titulo}
                          {grupo.categoria && grupo.categoria !== "Libro" && (
                            <span className="font-normal opacity-70">
                              — {grupo.titulo}
                            </span>
                          )}
                        </span>
                        <div
                          className="h-px flex-1"
                          style={{
                            background:
                              "color-mix(in srgb, var(--accent) 20%, transparent)",
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {grupo.caps.map((cap: any) => (
                          <button
                            key={cap.id}
                            className="flex items-center gap-2 px-3 py-2.5 border w-full text-left transition-all hover:opacity-80 active:scale-[0.98]"
                            style={{
                              background:
                                "color-mix(in srgb, var(--primary) 8%, transparent)",
                              borderColor:
                                "color-mix(in srgb, var(--accent) 10%, transparent)",
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              router.push(rutaLeer(cap.libro_id, cap.id))
                            }
                          >
                            <span
                              className="text-micro font-black shrink-0 px-1.5 py-0.5"
                              style={{
                                background:
                                  "color-mix(in srgb, var(--accent) 12%, transparent)",
                                color: "var(--accent)",
                              }}
                            >
                              {cap.orden}
                            </span>
                            <p
                              className="text-micro font-semibold uppercase truncate flex-1 min-w-0"
                              style={{ color: "var(--foreground)" }}
                            >
                              {cap.titulo_capitulo ?? `Capítulo ${cap.orden}`}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
            </>
          ))}
      </div>
    </>
  );
}


// ─── Main Component ───────────────────────────────────────────────────────────
export default function MapaInteractivo({
  allowEdit = false,
  initialEditReinoId = null,
  onExitReino,
}: {
  /**
   * Habilita la UI y lógica de edición (botón "Editar Mapa", drag de
   * markers, guardado, etc). El mapa público (/garlia/mapa) SIEMPRE la
   * pasa en false — la edición vive únicamente en editorGarlia
   * (ver MapaSection), que renderiza este mismo componente con
   * allowEdit=true.
   */
  allowEdit?: boolean;
  /**
   * Si se pasa (junto con allowEdit), el componente arranca directo con
   * ese reino seleccionado, el panel abierto y editMode activo — en vez
   * de arrancar en modo lectura y requerir un click extra en "Editar
   * Mapa". Lo usa MapaSection al entrar a editar un reino puntual desde
   * EditorMapa.
   */
  initialEditReinoId?: string | null;
  /**
   * Se llama cuando el usuario sale de la vista de reino con el botón
   * "Volver" nativo (volverAlGlobal), justo después de limpiar el estado
   * interno. MapaSection lo usa para volver a su propia vista de tiles,
   * en vez de mostrar un segundo botón de volver propio.
   */
  onExitReino?: () => void;
}) {
  const isAdminAccount = useIsAdmin();
  // Aun siendo admin, sin allowEdit no hay edición: esto es lo que saca
  // toda la lógica de edición del mapa público.
  const isAdmin = allowEdit && isAdminAccount;

  // reinos con caché Dexie automático — instantáneo en visitas posteriores
  const {
    data: reinos,
    setData: setReinos,
    loading,
  } = useSupabaseData<any>("reinos");

  // isFirstOpen: true only the very first time the map is visited in this session
  const [isFirstOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const seen = sessionStorage.getItem("garlia_map_seen");
    if (!seen) {
      sessionStorage.setItem("garlia_map_seen", "1");
      return true;
    }
    return false;
  });

  const [detallesReino, setDetallesReino] = useState<any[]>([]);
  const [vistaActual, setVistaActual] = useState<"global" | "reino">("global");
  const [reinoSeleccionado, setReinoSeleccionado] = useState<any>(null);
  const [puntoSeleccionado, setPuntoSeleccionado] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);

  // editorGarlia siempre debe verse en modo edición — no hay vista de
  // "solo lectura" ahí. isAdmin se resuelve async (arranca false), así
  // que activamos editMode apenas se confirma.
  useEffect(() => {
    if (isAdmin) setEditMode(true);
  }, [isAdmin]);
  const [isSaving, setIsSaving] = useState(false);
  const [modifiedDetalles, setModifiedDetalles] = useState<Set<string>>(
    new Set(),
  );
  // Marca que reinoSeleccionado tiene cambios sin guardar (nombre,
  // descripción, coords, mapa_url). Análogo a modifiedDetalles pero para
  // el reino en sí, ya que antes se guardaba "siempre que existe" sin
  // distinguir si realmente cambió — necesario para el autosave, que solo
  // debe disparar cuando hay algo nuevo que persistir.
  const [reinoModificado, setReinoModificado] = useState(false);
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [personajesReino, setPersonajesReino] = useState<any[]>([]);
  const [personajesDesbloqueados, setPersonajesDesbloqueados] = useState<
    Set<string>
  >(new Set());
  const [reinosDesbloqueados, setReinosDesbloqueados] = useState<Set<string>>(
    new Set(),
  );
  const [ciudadesDesbloqueadas, setCiudadesDesbloqueadas] = useState<
    Set<string>
  >(new Set());
  const [modalEntidad, setModalEntidad] = useState<EntidadModal | null>(null);
  const [cancionesPersonaje, setCancionesPersonaje] = useState<any[]>([]);
  const [cargandoCanciones, setCargandoCanciones] = useState(false);
  // Books & chapters
  const [librosReino, setLibrosReino] = useState<any[]>([]);
  const [librosColeccion, setLibrosColeccion] = useState<any[]>([]); // One Shots, Poemarios, etc.
  const [capitulosReino, setCapitulosReino] = useState<any[]>([]);
  const [loadingLibros, setLoadingLibros] = useState(false);
  // Catálogo completo de libros, para el picker de "vincular libro" del panel
  // de edición del reino — se carga una sola vez en modo edición.
  const [todosLosLibros, setTodosLosLibros] = useState<any[]>([]);
  const [vinculandoLibroId, setVinculandoLibroId] = useState<string | null>(
    null,
  );
  // Habitantes de la ciudad seleccionada
  const [personajesCiudad, setPersonajesCiudad] = useState<any[]>([]);
  const [criaturasCiudad, setCriaturasCiudad] = useState<any[]>([]);
  const [itemsCiudad, setItemsCiudad] = useState<any[]>([]);
  const [loadingCiudad, setLoadingCiudad] = useState(false);
  // Catálogo completo de personajes, para el picker de "vincular personaje"
  // del panel de edición de una ciudad — se carga una sola vez en modo admin.
  const [todosLosPersonajes, setTodosLosPersonajes] = useState<any[]>([]);
  const [vinculandoPersonajeId, setVinculandoPersonajeId] = useState<
    string | null
  >(null);

  // ── Áreas del mapa (círculo/rectángulo/polígono) ──────────────────────────
  const [areas, setAreas] = useState<BaseArea[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [drawTool, setDrawTool] = useState<DrawTool>(null);
  // Cuando se termina de dibujar un área nueva, queda "pendiente de
  // vincular" hasta que el admin elige reino/ciudad (o la deja libre).
  const [areaPendiente, setAreaPendiente] = useState<{
    tipo: AreaTipo;
    puntos: WorldPoint[];
  } | null>(null);
  const [savingArea, setSavingArea] = useState(false);
  const [vinculadorAreaOpen, setVinculadorAreaOpen] = useState(false);
  // Catálogo completo de ciudades, para el selector del modal "vincular
  // área" (una ciudad de cualquier reino, no solo la del reino abierto) —
  // se carga una sola vez al entrar en modo edición, igual que
  // todosLosLibros/todosLosPersonajes.
  const [todasLasCiudades, setTodasLasCiudades] = useState<any[]>([]);

  useEffect(() => {
    void loadMapAreas("garlia", (fresh) => setAreas(fresh as BaseArea[])).then(
      (data) => setAreas(data as BaseArea[]),
    );
  }, []);

  // ── Librería de assets (castillos/árboles/etc.) e instancias colocadas ──
  // La librería (map_assets) es siempre global, sin importar si se está
  // viendo el mapa del mundo o el de un reino — solo cambia el SCOPE de las
  // instancias (map_asset_placements), que sigue el mismo criterio que
  // areas vs reino_areas: world_id cuando vistaActual === "global",
  // reino_id cuando se está dentro de un reino.
  const { assets: mapAssets, loading: loadingMapAssets, createAsset: createMapAsset } =
    useMapAssetLibrary("garlia");
  const {
    placements: assetPlacementsGlobal,
    createPlacement: createAssetPlacementGlobal,
    movePlacement: moveAssetPlacementGlobal,
    updatePlacement: updateAssetPlacementGlobal,
    deletePlacement: deleteAssetPlacementGlobal,
  } = useMapAssetPlacements({ worldId: "garlia" });
  const {
    placements: assetPlacementsReino,
    createPlacement: createAssetPlacementReino,
    movePlacement: moveAssetPlacementReino,
    updatePlacement: updateAssetPlacementReino,
    deletePlacement: deleteAssetPlacementReino,
  } = useMapAssetPlacements({
    reinoId: reinoSeleccionado?.id ?? "__none__",
  });
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);
  // Dropdown de colores de terreno (verde/azul/café/borrador) — se abre al
  // clickear el botón de pincel en la toolbar.
  const [terrainMenuOpen, setTerrainMenuOpen] = useState(false);
  const [placingAssetId, setPlacingAssetId] = useState<string | null>(null);
  const [selectedPlacementId, setSelectedPlacementId] = useState<
    string | null
  >(null);

  // Esc cancela tanto "colocar asset" como la instancia seleccionada —
  // mismo criterio que el resto de los modos de edición del mapa (ver
  // handleKeyDown en tileCanvasEditingGestures.ts, que ya cubre dibujo de
  // áreas y "marker para mover" pero no sabe nada de assets).
  useEffect(() => {
    if (!editMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (placingAssetId) setPlacingAssetId(null);
      else if (selectedPlacementId) setSelectedPlacementId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editMode, placingAssetId, selectedPlacementId]);

  const assetPlacements =
    vistaActual === "global" ? assetPlacementsGlobal : assetPlacementsReino;
  const createAssetPlacement =
    vistaActual === "global"
      ? createAssetPlacementGlobal
      : createAssetPlacementReino;
  const moveAssetPlacement =
    vistaActual === "global"
      ? moveAssetPlacementGlobal
      : moveAssetPlacementReino;
  const updateAssetPlacement =
    vistaActual === "global"
      ? updateAssetPlacementGlobal
      : updateAssetPlacementReino;
  const deleteAssetPlacement =
    vistaActual === "global"
      ? deleteAssetPlacementGlobal
      : deleteAssetPlacementReino;

  const selectedPlacement: MapAssetPlacement | null =
    assetPlacements.find((p) => p.id === selectedPlacementId) ?? null;

  const handlePlaceAsset = useCallback(
    async (
      assetId: string,
      coord: { x: number; y: number; tile_col: number; tile_row: number },
    ) => {
      const { data } = await createAssetPlacement(assetId, coord);
      setPlacingAssetId(null);
      if (data) setSelectedPlacementId(data.id);
    },
    [createAssetPlacement],
  );

  // Markers "asset" para pasarle al canvas: cada placement colocado, con el
  // map_asset correspondiente resuelto, en la forma que espera
  // BaseMarker.asset (ver UnifiedTileCanvas.tsx). Los placements sin asset
  // resoluble (borrado de la librería, id viejo) se descartan en vez de
  // romper el render.
  const assetMarkers = assetPlacements
    .map((p) => {
      const asset = mapAssets.find((a) => a.id === p.asset_id);
      if (!asset) return null;
      return {
        id: `asset-placement:${p.id}`,
        coord_x: p.coord_x,
        coord_y: p.coord_y,
        tile_col: p.tile_col,
        tile_row: p.tile_row,
        asset: {
          image_url: asset.image_url,
          escala: p.escala,
          rotacion: p.rotacion,
          anchor_x: asset.anchor_x,
          anchor_y: asset.anchor_y,
          ancho_base: asset.ancho_base,
          alto_base: asset.alto_base,
          z_index: p.z_index,
        },
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("ciudades")
      .select("id, nombre, tipo, reino_id")
      .order("nombre")
      .then(({ data, error }) => {
        if (!error && data) setTodasLasCiudades(data);
      });
  }, [isAdmin]);

  const imgInputRef = useRef<HTMLInputElement>(null);
  const currentReinoIdRef = useRef<string | null>(null);
  const showToast = (message: string, type: ToastType) =>
    setToast({ message, type });

  // ── Tiles del mapa global ────────────────────────────────────────────────────
  const [mapTiles, setMapTiles] = useState<MapTile[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // Dexie primero — render instantáneo en visitas posteriores
      try {
        if (db) {
          const local: any[] = (await (db as any).map_tiles?.toArray()) ?? [];
          const filtrados = local.filter((t: any) => t.world_id === "garlia");
          if (filtrados.length && !cancelled) {
            setMapTiles(
              filtrados.sort(
                (a: any, b: any) => a.row - b.row || a.col - b.col,
              ) as MapTile[],
            );
          }
        }
      } catch {}
      if (!navigator.onLine) return;
      // Luego Supabase — fuente de verdad
      const { data } = await supabase
        .from("map_tiles")
        .select("id, col, row, image_url, label, world_id")
        .eq("world_id", "garlia")
        .order("row")
        .order("col");
      if (!cancelled && data) {
        setMapTiles(data as MapTile[]);
        try {
          if (db) await (db as any).map_tiles?.bulkPut(data);
        } catch {}
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Terreno decorativo (verde/azul/café pintado sobre tiles) ─────────────
  // Mismo patrón que mapTiles: Dexie primero (instantáneo), luego Supabase
  // como fuente de verdad. map_tile_terrain es 1:1 con map_tiles por tile_id,
  // así que no hace falta filtrar por world_id acá — se filtra indirectamente
  // porque los tile_id de otros mundos no van a matchear ningún tile en
  // mapTiles (ver bloque de dibujo en useTileCanvasEngine.ts).
  const [mapTerrain, setMapTerrain] = useState<BaseTileTerrain[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (db) {
          const local: any[] =
            (await (db as any).map_tile_terrain?.toArray()) ?? [];
          if (local.length && !cancelled) {
            setMapTerrain(local as BaseTileTerrain[]);
          }
        }
      } catch {}
      if (!navigator.onLine) return;
      const { data } = await supabase
        .from("map_tile_terrain")
        .select("tile_id, grid_data");
      if (!cancelled && data) {
        setMapTerrain(data as BaseTileTerrain[]);
        try {
          if (db) await (db as any).map_tile_terrain?.bulkPut(data);
        } catch {}
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  // Herramienta de terreno activa (color a pintar, o "borrador"). null =
  // desactivada, igual convención que drawTool/placingAssetId.
  const [terrainTool, setTerrainTool] = useState<TerrainTool>(null);

  // onTerrainChange: se dispara decenas de veces por segundo mientras se
  // arrastra pintando — SOLO actualiza estado in-memory, nunca pega a
  // Supabase (eso es onTerrainStrokeEnd).
  const handleTerrainChange = useCallback(
    (tileId: string, gridData: string) => {
      setMapTerrain((prev) => {
        const idx = prev.findIndex((t) => t.tile_id === tileId);
        if (idx === -1) return [...prev, { tile_id: tileId, grid_data: gridData }];
        const next = [...prev];
        next[idx] = { tile_id: tileId, grid_data: gridData };
        return next;
      });
    },
    [],
  );

  // onTerrainStrokeEnd: se dispara una vez al soltar el mouse tras un trazo
  // — acá sí persistimos a Supabase (y Dexie) los tiles que cambiaron.
  const handleTerrainStrokeEnd = useCallback(
    (tileIds: string[]) => {
      void (async () => {
        try {
          setMapTerrain((current) => {
            const rows = tileIds
              .map((id) => current.find((t) => t.tile_id === id))
              .filter((t): t is BaseTileTerrain => !!t);
            if (rows.length) {
              void supabase
                .from("map_tile_terrain")
                .upsert(rows, { onConflict: "tile_id" })
                .then(({ error }) => {
                  if (error) {
                    showToast("Error al guardar el terreno", "error");
                  } else if (db) {
                    void (db as any).map_tile_terrain?.bulkPut(rows).catch(() => {});
                  }
                });
            }
            return current;
          });
        } catch {
          showToast("Error al guardar el terreno", "error");
        }
      })();
    },
    [],
  );

  // ── Gestión de tiles del mapa global (portado de EditorMapa) ─────────────────
  const [showNuevoTileModal, setShowNuevoTileModal] = useState(false);
  const [tilePickerTarget, setTilePickerTarget] = useState<MapTile | null>(
    null,
  );
  const [reinoParaMover, setReinoParaMover] = useState<string | null>(null);
  // (puntoParaMover, el análogo a reinoParaMover para ciudades DENTRO de un
  // reino, se sacó junto con ReinoTileCanvas — ver nota en reinos/
  // components/ReinoTileCanvas.tsx. Ya no tiene ningún consumidor.)

  const handleTileCreated = useCallback((tile: MapTile) => {
    setMapTiles((prev) => [...prev, tile]);
    setShowNuevoTileModal(false);
    void invalidateMapTiles("garlia");
    showToast("Tile creado", "success");
  }, []);

  const handleTileCreateAt = useCallback(
    async (col: number, row: number) => {
      try {
        const { data, error } = await supabase
          .from("map_tiles")
          .insert({ world_id: "garlia", col, row, order: mapTiles.length })
          .select()
          .single();
        if (error) throw error;
        setMapTiles((prev) => [...prev, data as MapTile]);
        await invalidateMapTiles("garlia");
        showToast("Tile creado", "success");
      } catch {
        showToast("Error al crear tile", "error");
      }
    },
    [mapTiles.length],
  );

  const handleTileDelete = useCallback(async (tileId: string) => {
    if (!confirm("¿Eliminar este tile? Se perderá la referencia a la imagen."))
      return;
    try {
      await supabase.from("map_tiles").delete().eq("id", tileId);
      setMapTiles((prev) => prev.filter((t) => t.id !== tileId));
      await invalidateMapTiles("garlia");
      showToast("Tile eliminado", "success");
    } catch {
      showToast("Error al eliminar", "error");
    }
  }, []);

  const handleTileImageSelect = useCallback(
    async (tileId: string, image_url: string) => {
      setMapTiles((prev) =>
        prev.map((t) => (t.id === tileId ? { ...t, image_url } : t)),
      );
      try {
        const { error } = await supabase
          .from("map_tiles")
          .update({ image_url })
          .eq("id", tileId);
        if (error) throw error;
        await invalidateMapTiles("garlia");
        showToast("Imagen actualizada", "success");
      } catch {
        showToast("Error al guardar la imagen", "error");
      } finally {
        setTilePickerTarget(null);
      }
    },
    [],
  );

  // ── Gestión de áreas del mapa (círculo/rectángulo/polígono) ──────────────────
  //
  // Flujo "dibujo primero, vinculo después": onAreaDrawEnd deja el área en
  // areaPendiente (sin persistir) y abre el selector de reino/ciudad. Si el
  // admin elige "sin vincular", se guarda igual (label suelto).
  //
  // Flujo "reino/ciudad primero": handleEditarAreaDe activa drawTool con un
  // reino/ciudad ya elegido guardado en areaVinculoPreseleccionado, y
  // onAreaDrawEnd salta directo al guardado sin abrir el selector.
  const [areaVinculoPreseleccionado, setAreaVinculoPreseleccionado] = useState<{
    reino_id: string | null;
    ciudad_id: string | null;
    label: string;
    color: string | null;
  } | null>(null);

  // Botón "Añadir ciudad" del panel de reino (ver panelProps más abajo):
  // crea la ciudad (con reino_id ya seteado, a diferencia del flujo
  // genérico de useCreateEntity que no lo conoce) y deja el dibujo activado
  // con esa ciudad ya preseleccionada — el admin solo dibuja el área y se
  // guarda directo, sin pasar por el selector de vínculo. Reusa el mismo
  // drawTool/onAreaDrawEnd que la barra flotante en vez de abrir un flujo de
  // dibujo paralelo (ver comentario en PanelContenido sobre por qué se sacó
  // de ahí un botón de área duplicado).
  const [creandoCiudadParaDibujo, setCreandoCiudadParaDibujo] = useState(false);
  const iniciarDibujoCiudadDelReino = useCallback(async () => {
    if (!reinoSeleccionado || creandoCiudadParaDibujo) return;
    setCreandoCiudadParaDibujo(true);
    try {
      const { data, error } = await supabase
        .from("ciudades")
        .insert({ nombre: "Nueva ciudad", reino_id: reinoSeleccionado.id })
        .select()
        .single();
      if (error || !data) {
        showToast("Error al crear la ciudad", "error");
        return;
      }
      // La agregamos ya mismo a detallesReino para que el panel/selector la
      // vean sin esperar un refetch, igual que el resto de altas optimistas.
      setDetallesReino((prev) => [...prev, data]);
      setSelectedAreaId(null);
      setAreaVinculoPreseleccionado({
        reino_id: reinoSeleccionado.id,
        ciudad_id: data.id,
        label: data.nombre,
        color: null,
      });
      setDrawTool("rectangulo");
      showToast("Ciudad creada — dibujá su área en el mapa", "success");
    } finally {
      setCreandoCiudadParaDibujo(false);
    }
  }, [reinoSeleccionado, creandoCiudadParaDibujo]);

  const persistArea = useCallback(
    async (payload: {
      tipo: AreaTipo;
      puntos: WorldPoint[];
      reino_id: string | null;
      ciudad_id: string | null;
      label: string | null;
      color: string | null;
    }) => {
      setSavingArea(true);
      try {
        const { data, error } = await supabase
          .from("map_areas")
          .insert({
            world_id: "garlia",
            tipo: payload.tipo,
            puntos: payload.puntos,
            reino_id: payload.reino_id,
            ciudad_id: payload.ciudad_id,
            label: payload.label,
            color: payload.color,
            orden: areas.length,
          })
          .select()
          .single();
        if (error) throw error;
        setAreas((prev) => [...prev, data as unknown as BaseArea]);
        await invalidateMapAreas("garlia");
        showToast("Área creada", "success");
        return data;
      } catch {
        showToast("Error al crear el área", "error");
        return null;
      } finally {
        setSavingArea(false);
        setDrawTool(null);
        setAreaPendiente(null);
        setAreaVinculoPreseleccionado(null);
      }
    },
    [areas.length],
  );

  const handleAreaDrawEnd = useCallback(
    (tipo: AreaTipo, puntos: WorldPoint[]) => {
      if (areaVinculoPreseleccionado) {
        // Ya sabemos a qué reino/ciudad va — guardamos directo.
        void persistArea({
          tipo,
          puntos,
          reino_id: areaVinculoPreseleccionado.reino_id,
          ciudad_id: areaVinculoPreseleccionado.ciudad_id,
          label: areaVinculoPreseleccionado.label || null,
          color: areaVinculoPreseleccionado.color,
        });
        return;
      }
      // Dibujo libre: dejamos pendiente y abrimos el selector de vínculo.
      setAreaPendiente({ tipo, puntos });
      setVinculadorAreaOpen(true);
      setDrawTool(null);
    },
    [areaVinculoPreseleccionado, persistArea],
  );

  const handleAreaPointsChange = useCallback(
    (areaId: string, puntos: WorldPoint[]) => {
      // Optimista en memoria; el guardado real se dispara al soltar el
      // vértice sería más chatty — en su lugar debounceamos guardando en
      // Supabase cada vez que cambian los puntos (drag genera pocos eventos
      // por soltar, uno por movimiento de mouse pero solo mientras se
      // arrastra un vértice puntual).
      setAreas((prev) =>
        prev.map((a) => (a.id === areaId ? { ...a, puntos } : a)),
      );
    },
    [],
  );

  // Al soltar el vértice (pointerup global ya lo maneja el canvas), persistimos
  // el estado final. Como no tenemos un "onVertexDragEnd" explícito, guardamos
  // con un debounce simple sobre el área seleccionada.
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
        .from("map_areas")
        .update({ puntos: area.puntos, tipo: area.tipo })
        .eq("id", area.id)
        .then(({ error }) => {
          if (error) showToast("Error al guardar el área", "error");
          else void invalidateMapAreas("garlia");
        });
    }, 500);
    return () => {
      if (areaSaveTimeoutRef.current) clearTimeout(areaSaveTimeoutRef.current);
    };
    // Solo re-disparar cuando cambian los puntos del área seleccionada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areas, selectedAreaId]);

  const handleDeleteArea = useCallback(async (areaId: string) => {
    if (!confirm("¿Eliminar esta área?")) return;
    try {
      await supabase.from("map_areas").delete().eq("id", areaId);
      setAreas((prev) => prev.filter((a) => a.id !== areaId));
      setSelectedAreaId(null);
      await invalidateMapAreas("garlia");
      showToast("Área eliminada", "success");
    } catch {
      showToast("Error al eliminar el área", "error");
    }
  }, []);

  const handleVincularAreaPendiente = useCallback(
    async (reino_id: string | null, ciudad_id: string | null, label: string) => {
      if (!areaPendiente) return;
      await persistArea({
        tipo: areaPendiente.tipo,
        puntos: areaPendiente.puntos,
        reino_id,
        ciudad_id,
        label: label || null,
        color: null,
      });
      setVinculadorAreaOpen(false);
    },
    [areaPendiente, persistArea],
  );

  const handleVincularAreaExistente = useCallback(
    async (
      areaId: string,
      reino_id: string | null,
      ciudad_id: string | null,
    ) => {
      try {
        const { error } = await supabase
          .from("map_areas")
          .update({ reino_id, ciudad_id })
          .eq("id", areaId);
        if (error) throw error;
        setAreas((prev) =>
          prev.map((a) => (a.id === areaId ? { ...a, reino_id, ciudad_id } : a)),
        );
        await invalidateMapAreas("garlia");
        showToast("Vínculo actualizado", "success");
      } catch {
        showToast("Error al vincular", "error");
      }
    },
    [],
  );

  // Mover un reino en el mapa global: seleccionar con onMarkerSelect
  // (Ctrl+click), luego onMarkerMove al soltar en la celda destino.
  const handleReinoMarkerMove = useCallback(
    (
      markerId: string,
      coord: { x: number; y: number; tile_col: number; tile_row: number },
    ) => {
      setReinos((prev) =>
        prev.map((r) =>
          r.id === markerId
            ? {
                ...r,
                coord_x: coord.x,
                coord_y: coord.y,
                tile_col: coord.tile_col,
                tile_row: coord.tile_row,
              }
            : r,
        ),
      );
      supabase
        .from("reinos")
        .update({
          coord_x: coord.x,
          coord_y: coord.y,
          tile_col: coord.tile_col,
          tile_row: coord.tile_row,
        })
        .eq("id", markerId)
        .then(({ error }) => {
          if (error) showToast("Error al guardar posición", "error");
        });
      setReinoParaMover(null);
    },
    [],
  );

  // ── Fondo color (color del mar) ──────────────────────────────────────────────
  // fondoColorGlobal: color del mapa del continente (guardado en config_mapa)
  // fondoColorReino: color del mapa del reino activo (guardado en reinos.fondo_color)
  const [fondoColorGlobal, setFondoColorGlobal] = useState<string | null>(null);
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const fondoColorInputRef = useRef<HTMLInputElement>(null);

  // Color activo según la vista actual
  const fondoColor =
    vistaActual === "reino"
      ? (reinoSeleccionado?.fondo_color ?? null)
      : fondoColorGlobal;

  // Cargar color de fondo global desde Supabase al montar.
  // maybeSingle() en vez de single(): si todavía no existe la fila
  // "fondo_color" en config_mapa (primera vez que se usa el picker), single()
  // tira error y rompe la carga; maybeSingle() devuelve data:null sin fallar.
  useEffect(() => {
    supabase
      .from("config_mapa")
      .select("value")
      .eq("key", "fondo_color")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setFondoColorGlobal(data.value);
      });
  }, []);

  // Debounce del guardado en Supabase mientras se arrastra el selector de
  // color — sin esto, cada pixel de movimiento del picker nativo dispararía
  // un request. El preview (estado local) sigue siendo instantáneo.
  const fondoColorSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const scheduleFondoColorSave = useCallback(
    (color: string) => {
      if (fondoColorSaveTimer.current)
        clearTimeout(fondoColorSaveTimer.current);
      fondoColorSaveTimer.current = setTimeout(() => {
        void handleFondoColorChange(color);
      }, 400);
    },
    // handleFondoColorChange se define más abajo pero es estable entre
    // renders para el mismo vistaActual/reinoSeleccionado — se referencia
    // vía closure, no hace falta declararla como dep porque se llama async
    // luego del timeout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleFondoColorChange = async (color: string) => {
    if (fondoColorSaveTimer.current) {
      clearTimeout(fondoColorSaveTimer.current);
      fondoColorSaveTimer.current = null;
    }
    setEyedropperActive(false);
    if (vistaActual === "reino" && reinoSeleccionado) {
      // Guardar en la columna fondo_color del reino activo
      setReinoSeleccionado((prev: any) => ({
        ...prev,
        fondo_color: color || null,
      }));
      setReinos((prev) =>
        prev.map((r) =>
          r.id === reinoSeleccionado.id
            ? { ...r, fondo_color: color || null }
            : r,
        ),
      );
      try {
        await supabase
          .from("reinos")
          .update({ fondo_color: color || null })
          .eq("id", reinoSeleccionado.id);
        showToast("Color del reino guardado", "success");
      } catch {
        showToast("Error al guardar el color", "error");
      }
    } else {
      // Guardar en config_mapa (mapa global)
      setFondoColorGlobal(color || null);
      try {
        await supabase
          .from("config_mapa")
          .upsert({ key: "fondo_color", value: color }, { onConflict: "key" });
        showToast("Color del mar guardado", "success");
      } catch {
        showToast("Error al guardar el color", "error");
      }
    }
  };

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Descubrimientos — personajes, reinos y ciudades del perfil
  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      void Promise.all([
        supabase
          .from("descubrimientos_personajes")
          .select("personaje_id")
          .eq("perfil_id", user.id),
        supabase
          .from("descubrimientos_reinos")
          .select("reino_id")
          .eq("perfil_id", user.id),
        supabase
          .from("ciudades_desbloqueadas")
          .select("ciudad_id")
          .eq("user_id", user.id),
      ]).then(([pRes, rRes, lRes]) => {
        if (pRes.data)
          setPersonajesDesbloqueados(
            new Set(pRes.data.map((r: any) => r.personaje_id)),
          );
        if (rRes.data)
          setReinosDesbloqueados(
            new Set(rRes.data.map((r: any) => r.reino_id)),
          );
        if (lRes.data)
          setCiudadesDesbloqueadas(
            new Set(lRes.data.map((r: any) => r.ciudad_id)),
          );
      });
    });
  }, []);

  // Cargar personajes, criaturas e items cuando se selecciona una ciudad
  useEffect(() => {
    if (!puntoSeleccionado) {
      setPersonajesCiudad([]);
      setCriaturasCiudad([]);
      setItemsCiudad([]);
      return;
    }
    const ciudadId = puntoSeleccionado.id;
    const currentId = ciudadId;
    setLoadingCiudad(true);

    const run = async () => {
      // 1. Dexie cache
      if (db) {
        try {
          const [cachedP, cachedC, cachedI] = await Promise.all([
            (db as any).personajes
              ?.filter((p: any) => p.ciudad_id === ciudadId && !p.deleted)
              .toArray()
              .catch(() => []) ?? [],
            (db as any).criaturas
              ?.filter((c: any) => c.ciudad_id === ciudadId && !c.deleted)
              .toArray()
              .catch(() => []) ?? [],
            (db as any).items
              ?.filter((i: any) => i.ciudad_id === ciudadId && !i.deleted)
              .toArray()
              .catch(() => []) ?? [],
          ]);
          if (currentId !== ciudadId) return;
          if (cachedP.length) setPersonajesCiudad(cachedP);
          if (cachedC.length) setCriaturasCiudad(cachedC);
          if (cachedI.length) setItemsCiudad(cachedI);
          if (!navigator.onLine) {
            setLoadingCiudad(false);
            return;
          }
        } catch {}
      }

      // 2. Supabase
      const [pRes, cRes, iRes] = await Promise.all([
        supabase
          .from("personajes")
          .select("id, nombre, img_url, especie")
          .eq("ciudad_id", ciudadId)
          .order("nombre"),
        supabase
          .from("criaturas")
          .select("id, nombre, imagen_url")
          .eq("ciudad_id", ciudadId)
          .order("nombre"),
        supabase
          .from("items")
          .select("id, nombre, imagen_url")
          .eq("ciudad_id", ciudadId)
          .order("nombre"),
      ]);
      if (currentId !== ciudadId) return;
      if (!pRes.error) setPersonajesCiudad(pRes.data ?? []);
      if (!cRes.error) setCriaturasCiudad(cRes.data ?? []);
      if (!iRes.error) setItemsCiudad(iRes.data ?? []);
      setLoadingCiudad(false);
    };
    void run();
  }, [puntoSeleccionado?.id]);

  // Ref para detectar si el usuario cambió de reino antes de que lleguen los datos

  // Carga datos del reino (ciudades, personajes, libros, capítulos) y entra
  // a su vista de detalle. Compartida por el click normal (navegación) y
  // por el arranque directo en modo edición (initialEditReinoId más abajo).
  const abrirVistaDeReino = async (
    reino: any,
    puntoInicial: any = null,
    opts: { cambiarVista?: boolean } = {},
  ) => {
    // cambiarVista=false (nuevo default): el click normal en un reino desde
    // el mapa global ya NO entra al mapa de ese reino — solo abre el panel
    // de info con sus datos (ciudades, libros, capítulos) cargados, y el
    // mapa mundial sigue siendo el que se ve. El zoom-in al mapa propio del
    // reino (ReinoTileCanvas) queda para cuando el admin lo pida
    // explícitamente (ver botón "Editar mapa del reino" en el panel).
    const cambiarVista = opts.cambiarVista ?? false;

    // Marcar qué reino estamos cargando — cualquier respuesta async va a chequear esto
    currentReinoIdRef.current = reino.id;

    // Limpiar todo inmediatamente para no mostrar datos del reino anterior.
    // Si viene un puntoInicial (ej. una ciudad), lo seteamos ya mismo para
    // no pasar por un frame intermedio de "reino sin selección" — evita el
    // parpadeo reino→ciudad al clickear un área vinculada a una ciudad.
    setReinoSeleccionado(reino);
    setPuntoSeleccionado(puntoInicial);
    if (cambiarVista) setVistaActual("reino");
    setPanelOpen(true);
    setDetallesReino([]);
    setPersonajesReino([]);
    setLibrosReino([]);
    setLibrosColeccion([]);
    setCapitulosReino([]);

    // Helper — solo aplica el set si el usuario no cambió de reino mientras esperábamos
    const apply = (fn: () => void) => {
      if (currentReinoIdRef.current === reino.id) fn();
    };

    // ── 1. Caché Dexie — mostrar lo que ya tenemos guardado ──────────────
    if (db) {
      try {
        const [cachedDetalles, _cachedLibros, _cachedCaps] = await Promise.all([
          (db as any).ciudades
            .where("reino_id")
            .equals(reino.id)
            .toArray()
            .catch(() => []) ?? [],
          db.libros
            .filter((l: any) => l.reino_id === reino.id)
            .toArray()
            .catch(() => []),
          db.capitulos
            .filter(
              (c: any) =>
                Array.isArray(c.reinos_ids) &&
                c.reinos_ids.includes(reino.id),
            )
            .toArray()
            .catch(() => []),
        ]);
        const cachedCiudadIds = cachedDetalles.map((d: any) => d.id);
        apply(async () => {
          if (cachedDetalles.length > 0)
            setDetallesReino(cachedDetalles.filter((d: any) => !d.deleted));
          // Personajes cacheados = los que ya tenemos guardados con
          // ciudad_id perteneciente a alguna ciudad cacheada de este reino.
          if (cachedCiudadIds.length > 0) {
            try {
              const cachedPersonajes = await db.personajes
                .filter((p: any) => cachedCiudadIds.includes(p.ciudad_id))
                .toArray();
              if (cachedPersonajes.length > 0)
                setPersonajesReino(cachedPersonajes);
            } catch {}
          }
          // libros y capítulos NO se aplican desde caché para evitar spoilers —
          // se esperan los datos frescos de Supabase antes de mostrarlos
        });
      } catch {
        /* caché falló — no importa, el fetch de abajo lo cubre */
      }
    }

    // ── 2. Fetch Supabase — siempre pisa el caché con datos frescos ──────
    const [detallesRes, librosRes, capitulosRes] = await Promise.all([
      supabase.from("ciudades").select("*").eq("reino_id", reino.id),
      supabase
        .from("libros")
        .select("id, titulo, portada_url, estado, categoria, sinopsis")
        .eq("reino_id", reino.id)
        .eq("visibilidad", "publico"),
      supabase
        .from("capitulos")
        .select(
          "id, titulo_capitulo, orden, libro_id, libros(titulo, tags, categoria)",
        )
        .contains("reinos_ids", [reino.id])
        .eq("visibilidad", "publico")
        .order("orden", { ascending: true }),
    ]);

    // Si el usuario ya clickeó otro reino, descartar todo
    if (currentReinoIdRef.current !== reino.id) return;

    // Aplicar resultados — siempre setear aunque sea array vacío, para no dejar datos stale
    if (!detallesRes.error) {
      setDetallesReino(detallesRes.data ?? []);
      try {
        if (db && detallesRes.data?.length)
          await (db as any).ciudades.bulkPut(detallesRes.data);
      } catch {}
    }

    // Personajes del reino = unión de los habitantes de todas sus ciudades
    // (personajes.ciudad_id), ya no por el campo de texto libre "reino".
    // Se muestran en la barra lateral del reino en modo SOLO VISTA — la
    // asignación real (añadir/quitar) se maneja siempre desde la ciudad.
    const ciudadIds = (detallesRes.data ?? []).map((c: any) => c.id);
    const personajesRes = ciudadIds.length
      ? await supabase
          .from("personajes")
          .select(
            "id, nombre, img_url, especie, ciudad_id, sobre, fecha_nacimiento",
          )
          .in("ciudad_id", ciudadIds)
          .order("nombre")
      : { data: [], error: null };

    if (!personajesRes.error) {
      setPersonajesReino(personajesRes.data ?? []);
      try {
        if (db && personajesRes.data?.length)
          await db.personajes.bulkPut(personajesRes.data);
      } catch {}
    }

    if (!librosRes.error) {
      const todos = librosRes.data ?? [];
      // "Libro" = libros propiamente dichos (portada, navega al libro)
      setLibrosReino(todos.filter((l: any) => l.categoria === "Libro"));
      // Colecciones (One Shot, Poemario, etc.) → sus capítulos se muestran en el mapa
      setLibrosColeccion(todos.filter((l: any) => l.categoria !== "Libro"));
      try {
        if (db && todos.length) await db.libros.bulkPut(todos);
      } catch {}
    }

    if (!capitulosRes.error) {
      const caps = (capitulosRes.data ?? [])
        .filter((c: any) => {
          const cat = c.libros?.categoria;
          // Solo capítulos de libros tipo colección (One Shot, Poemario, etc.), NO de Libros propiamente dichos
          return cat !== "Libro";
        })
        .map((c: any) => ({
          ...c,
          libro_titulo: c.libros?.titulo ?? null,
          libro_categoria: c.libros?.categoria ?? null,
        }));
      setCapitulosReino(caps);
      try {
        if (db && caps.length) await db.capitulos.bulkPut(caps);
      } catch {}
    }

    // Libros y capítulos ya están seteados — ocultar spinner
    if (currentReinoIdRef.current === reino.id) setLoadingLibros(false);
  };

  // Click izquierdo sobre un pin en el mapa global → abre el panel lateral
  // con la info del reino (ciudades, libros, capítulos), sin cambiar de
  // mapa — el mapa global sigue siendo el que se ve. Entrar al mapa propio
  // del reino (su grid de tiles interno) es una acción explícita aparte,
  // ver botón "Editar mapa del reino" en el panel.
  const handleReinoClick = async (reino: any) => {
    await abrirVistaDeReino(reino);
  };

  // Click derecho sobre un pin → activa/desactiva el modo "mover" para ese
  // reino (equivalente al viejo Ctrl+click, ahora accesible sin teclado).
  const handleReinoContextMenu = (reino: any) => {
    setReinoParaMover((prev) => (prev === reino.id ? null : reino.id));
  };

  // Click sobre el label/área de un reino o ciudad en el mapa global → abre
  // el panel lateral con su info, sin cambiar de mapa (mismo criterio que
  // handleReinoClick). Si el reino no fue desbloqueado por el usuario (y no
  // es admin), no abre nada — mismo criterio que oculta su pin.
  const handleAreaLabelClick = useCallback(
    async (area: BaseArea) => {
      // Ojo: un área de ciudad también trae reino_id seteado (persistArea
      // guarda ambos), así que ciudad_id se chequea primero — si no, esta
      // rama nunca se alcanza y el click siempre navega al reino.
      if (area.ciudad_id) {
        const { data: ciudad } = await supabase
          .from("ciudades")
          .select("*")
          .eq("id", area.ciudad_id)
          .maybeSingle();
        if (!ciudad) return;
        if (
          !isAdmin &&
          !(ciudad.reino_id && reinosDesbloqueados.has(ciudad.reino_id))
        )
          return;
        const reino = reinos.find((r) => r.id === ciudad.reino_id);
        if (!reino) return;
        await abrirVistaDeReino(reino);
        setPuntoSeleccionado(ciudad);
        setPanelOpen(true);
        return;
      }
      if (area.reino_id) {
        if (!isAdmin && !reinosDesbloqueados.has(area.reino_id)) return;
        const reino = reinos.find((r) => r.id === area.reino_id);
        if (reino) await handleReinoClick(reino);
        return;
      }
    },
    [reinos, isAdmin, reinosDesbloqueados],
  );

  // Vincular / desvincular un libro con el reino seleccionado — actualiza
  // libros.reino_id directamente en Supabase y refresca los estados locales.
  const handleVincularLibro = async (libro: any) => {
    if (!reinoSeleccionado) return;
    setVinculandoLibroId(libro.id);
    try {
      const { error } = await supabase
        .from("libros")
        .update({ reino_id: reinoSeleccionado.id })
        .eq("id", libro.id);
      if (error) throw error;
      const actualizado = { ...libro, reino_id: reinoSeleccionado.id };
      if (libro.categoria === "Libro") {
        setLibrosReino((prev) => [...prev, actualizado]);
      } else {
        setLibrosColeccion((prev) => [...prev, actualizado]);
      }
      showToast("Libro vinculado", "success");
    } catch {
      showToast("Error al vincular el libro", "error");
    } finally {
      setVinculandoLibroId(null);
    }
  };

  const handleDesvincularLibro = async (libro: any) => {
    setVinculandoLibroId(libro.id);
    try {
      const { error } = await supabase
        .from("libros")
        .update({ reino_id: null })
        .eq("id", libro.id);
      if (error) throw error;
      setLibrosReino((prev) => prev.filter((l) => l.id !== libro.id));
      setLibrosColeccion((prev) => prev.filter((l) => l.id !== libro.id));
      showToast("Vínculo eliminado", "success");
    } catch {
      showToast("Error al desvincular el libro", "error");
    } finally {
      setVinculandoLibroId(null);
    }
  };

  // Catálogo completo de libros para el picker — se carga una vez al entrar
  // en modo edición (admin), no bloquea el resto del mapa.
  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("libros")
      .select("id, titulo, portada_url, categoria, reino_id")
      .then(({ data, error }) => {
        if (!error && data) setTodosLosLibros(data);
      });
  }, [isAdmin]);

  // Catálogo completo de personajes para el picker de "vincular personaje" —
  // misma lógica que los libros: se carga una vez al entrar en modo admin.
  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("personajes")
      .select("id, nombre, img_url, especie, ciudad_id")
      .order("nombre")
      .then(({ data, error }) => {
        if (!error && data) setTodosLosPersonajes(data);
      });
  }, [isAdmin]);

  // Vincular / desvincular un personaje con la ciudad seleccionada —
  // actualiza personajes.ciudad_id directamente en Supabase, igual patrón
  // que handleVincularLibro/handleDesvincularLibro.
  const handleVincularPersonaje = async (personaje: any) => {
    if (!puntoSeleccionado) return;
    setVinculandoPersonajeId(personaje.id);
    try {
      const { error } = await supabase
        .from("personajes")
        .update({ ciudad_id: puntoSeleccionado.id })
        .eq("id", personaje.id);
      if (error) throw error;
      const actualizado = { ...personaje, ciudad_id: puntoSeleccionado.id };
      setPersonajesCiudad((prev) => [...prev, actualizado]);
      setTodosLosPersonajes((prev) =>
        prev.map((p) => (p.id === personaje.id ? actualizado : p)),
      );
      showToast("Personaje vinculado", "success");
    } catch {
      showToast("Error al vincular el personaje", "error");
    } finally {
      setVinculandoPersonajeId(null);
    }
  };

  const handleDesvincularPersonaje = async (personaje: any) => {
    setVinculandoPersonajeId(personaje.id);
    try {
      const { error } = await supabase
        .from("personajes")
        .update({ ciudad_id: null })
        .eq("id", personaje.id);
      if (error) throw error;
      setPersonajesCiudad((prev) =>
        prev.filter((p) => p.id !== personaje.id),
      );
      setTodosLosPersonajes((prev) =>
        prev.map((p) =>
          p.id === personaje.id ? { ...p, ciudad_id: null } : p,
        ),
      );
      showToast("Vínculo eliminado", "success");
    } catch {
      showToast("Error al desvincular el personaje", "error");
    } finally {
      setVinculandoPersonajeId(null);
    }
  };

  // Abrir un reino o ciudad ya desbloqueados cuando lo pide el
  // GlobalCommandPalette (evento "mapa-open-entity" o buzón en
  // sessionStorage si la navegación llegó recién).
  const buzonMapaProcesadoRef = useRef(false);
  useEffect(() => {
    // editar: soporte legacy del flag "editar" del evento — hoy nadie lo
    // dispara (la edición vive enteramente en editorGarlia, ver
    // MapaSection, que renderiza este componente in-place con
    // allowEdit=true en vez de navegar hasta acá). Se mantiene por si algún
    // llamador externo lo vuelve a usar; sin allowEdit, isAdmin es false y
    // esta rama nunca se activa.
    const abrirReino = async (reinoId: string, editar?: boolean) => {
      const reino = reinos.find((r) => r.id === reinoId);
      if (!reino) return false;
      if (editar && isAdmin) {
        setEditMode(true);
        setReinoSeleccionado(reino);
        setPuntoSeleccionado(null);
        setPanelOpen(true);
        return true;
      }
      await handleReinoClick(reino);
      return true;
    };

    const abrirCiudad = async (
      ciudadId: string,
      reinoIdHint?: string | null,
    ) => {
      // Buscamos primero en el reino ya cargado, si aplica
      let ciudad = detallesReino.find((d) => d.id === ciudadId);

      if (!ciudad) {
        // Traemos la ciudad directo para saber a qué reino pertenece
        const { data } = await supabase
          .from("ciudades")
          .select("*")
          .eq("id", ciudadId)
          .maybeSingle();
        if (!data) return false;
        ciudad = data;
        const reino = reinos.find(
          (r) => r.id === (reinoIdHint ?? data.reino_id),
        );
        if (!reino) return false;
        // Deep-link explícito a una ciudad puntual. Antes esto entraba al
        // mapa propio del reino (cambiarVista:true, ReinoTileCanvas) para
        // ver la ciudad en su contexto — ReinoTileCanvas quedó desactivado
        // (ver nota en reinos/components/ReinoTileCanvas.tsx), así que ahora
        // se queda en el default (false): abre el panel de info sobre el
        // mapa global, igual que el click casual sobre un reino.
        await abrirVistaDeReino(reino, null);
      }

      setPuntoSeleccionado(ciudad);
      setPanelOpen(true);
      return true;
    };

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | {
            tipo: "reino" | "ciudad";
            entidad_id: string;
            reino_id?: string | null;
            editar?: boolean;
          }
        | undefined;
      if (!detail) return;
      if (detail.tipo === "reino")
        void abrirReino(detail.entidad_id, detail.editar);
      else if (detail.tipo === "ciudad")
        void abrirCiudad(detail.entidad_id, detail.reino_id);
    };
    window.addEventListener("mapa-open-entity", handler);

    // Buzón: por si la navegación llegó antes de que "reinos" cargara.
    // Se procesa UNA sola vez (buzonMapaProcesadoRef) para no reabrir el
    // mismo reino/ciudad cada vez que "reinos" se actualiza por otro motivo
    // (por ejemplo, mientras handleReinoClick va seteando datos) — eso era
    // lo que causaba el parpadeo entre vista global y vista de reino.
    // Si el pedido es de edición (pending.editar) esperamos también a que
    // isAdmin se resuelva (arranca en false y se confirma async), para no
    // perder el flag "editar" por una carrera con useIsAdmin.
    if (!buzonMapaProcesadoRef.current && reinos.length) {
      let raw: string | null = null;
      try {
        raw = sessionStorage.getItem("mapa-pending-open-entity");
      } catch {}
      let pendingEditar = false;
      if (raw) {
        try {
          pendingEditar = !!JSON.parse(raw).editar;
        } catch {}
      }
      if (!pendingEditar || isAdmin) {
        buzonMapaProcesadoRef.current = true;
        void (async () => {
          try {
            if (!raw) return;
            const pending = JSON.parse(raw) as {
              tipo: "reino" | "ciudad";
              entidad_id: string;
              reino_id?: string | null;
              editar?: boolean;
              ts: number;
            };
            sessionStorage.removeItem("mapa-pending-open-entity");
            // Ignorar solicitudes viejas (>10s) para no reabrir algo obsoleto
            if (Date.now() - pending.ts >= 10000) return;
            if (pending.tipo === "reino")
              await abrirReino(pending.entidad_id, pending.editar);
            else await abrirCiudad(pending.entidad_id, pending.reino_id);
          } catch {}
        })();
      }
    }

    return () => window.removeEventListener("mapa-open-entity", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reinos, isAdmin]);

  // ── initialEditReinoId: entrar directo en modo edición con un reino ──────
  // puntual ya seleccionado. Es una entrada explícita (querystring/deep-link),
  // no el click normal sobre un reino en el mapa global. Antes pasaba
  // cambiarVista:true para abrir su mapa propio (ReinoTileCanvas); ese canvas
  // quedó desactivado (ver nota en reinos/components/ReinoTileCanvas.tsx), así
  // que ahora se apoya en el default (false) de abrirVistaDeReino: entra en
  // modo edición con el panel del reino abierto sobre el mapa global.
  const initialEditAppliedRef = useRef(false);
  useEffect(() => {
    if (initialEditAppliedRef.current) return;
    if (!allowEdit || !initialEditReinoId) return;
    if (!isAdmin) return; // isAdmin se resuelve async; esperamos a que esté confirmado
    const reino = reinos.find((r) => r.id === initialEditReinoId);
    if (!reino) return; // esperamos a que "reinos" cargue
    initialEditAppliedRef.current = true;
    setEditMode(true);
    void abrirVistaDeReino(reino, null);
  }, [allowEdit, initialEditReinoId, isAdmin, reinos]);

  const abrirPanelFlotante = usePanelFlotante((s) => s.abrir);

  const handlePersonajeClick = async (p: any) => {
    // En modo edición, un click sobre un personaje abre directamente el
    // editor completo (mismo panel flotante global que usan
    // Ciudad/Reino/Criatura/Item editors — usePanelFlotante), en vez del
    // modal de solo lectura que ven los jugadores.
    if (editMode) {
      if (p.id) abrirPanelFlotante("personaje", p.id);
      return;
    }
    setCancionesPersonaje([]);
    setModalEntidad({
      tipo: "personaje",
      data: {
        tipo: "personaje",
        entidad_id: p.id,
        nombre: p.nombre,
        imagen_url: p.img_url,
        descripcion: p.sobre,
        reino: p.reino,
        especie: p.especie,
        fecha_descubrimiento: "",
      },
    });
    if (!p.id) return;
    setCargandoCanciones(true);
    try {
      const { data, error } = await supabase
        .from("canciones")
        .select("id, titulo, portada_url, info_cancion, personaje_id")
        .eq("personaje_id", p.id)
        .eq("visible", true);
      if (!error && data) setCancionesPersonaje(data);
    } catch (err) {
      console.warn("[Mapa] Error cargando canciones:", err);
    } finally {
      setCargandoCanciones(false);
    }
  };

  const handleMapClick = (
    x: number,
    y: number,
    tile_col?: number,
    tile_row?: number,
  ) => {
    if (!editMode) return;
    if (puntoSeleccionado) {
      setPuntoSeleccionado({ ...puntoSeleccionado, coord_x: x, coord_y: y });
      setDetallesReino((prev) =>
        prev.map((p) =>
          p.id === puntoSeleccionado.id ? { ...p, coord_x: x, coord_y: y } : p,
        ),
      );
      setModifiedDetalles((prev) => new Set(prev).add(puntoSeleccionado.id));
    } else if (reinoSeleccionado && vistaActual === "global") {
      setReinoSeleccionado({
        ...reinoSeleccionado,
        coord_x: x,
        coord_y: y,
        tile_col: tile_col ?? reinoSeleccionado.tile_col ?? null,
        tile_row: tile_row ?? reinoSeleccionado.tile_row ?? null,
      });
      setReinos((prev) =>
        prev.map((r) =>
          r.id === reinoSeleccionado.id
            ? {
                ...r,
                coord_x: x,
                coord_y: y,
                tile_col: tile_col ?? r.tile_col ?? null,
                tile_row: tile_row ?? r.tile_row ?? null,
              }
            : r,
        ),
      );
      setReinoModificado(true);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !reinoSeleccionado) return;
    setIsUploadingImg(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `mapas/reino_${reinoSeleccionado.id}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("wiki")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from("wiki")
        .getPublicUrl(path);
      const mapa_url = urlData.publicUrl;
      const { error: updateError } = await supabase
        .from("reinos")
        .update({ mapa_url })
        .eq("id", reinoSeleccionado.id);
      if (updateError) throw updateError;
      setReinoSeleccionado({ ...reinoSeleccionado, mapa_url });
      setReinos((prev) =>
        prev.map((r) =>
          r.id === reinoSeleccionado.id ? { ...r, mapa_url } : r,
        ),
      );
      showToast("Imagen actualizada", "success");
    } catch {
      showToast("Error al subir la imagen", "error");
    } finally {
      setIsUploadingImg(false);
      if (imgInputRef.current) imgInputRef.current.value = "";
    }
  };

  const handleSaveChanges = async (opts?: { silent?: boolean }) => {
    setIsSaving(true);
    try {
      if (vistaActual === "reino" && modifiedDetalles.size > 0) {
        const toSave = detallesReino.filter((p) => modifiedDetalles.has(p.id));
        await Promise.all(
          toSave.map((p) =>
            supabase
              .from("ciudades")
              .update({
                nombre: p.nombre,
                descripcion: p.descripcion,
                coord_x: p.coord_x,
                coord_y: p.coord_y,
                tile_col: p.tile_col ?? null,
                tile_row: p.tile_row ?? null,
              })
              .eq("id", p.id),
          ),
        );
        setModifiedDetalles(new Set());
      } else if (
        reinoSeleccionado &&
        vistaActual === "global" &&
        reinoModificado
      ) {
        const { error } = await supabase
          .from("reinos")
          .update({
            nombre: reinoSeleccionado.nombre,
            descripcion: reinoSeleccionado.descripcion,
            coord_x: reinoSeleccionado.coord_x,
            coord_y: reinoSeleccionado.coord_y,
            tile_col: reinoSeleccionado.tile_col ?? null,
            tile_row: reinoSeleccionado.tile_row ?? null,
          })
          .eq("id", reinoSeleccionado.id);
        if (error) throw error;
        setReinos((prev) =>
          prev.map((r) =>
            r.id === reinoSeleccionado.id ? reinoSeleccionado : r,
          ),
        );
        setReinoModificado(false);
      } else {
        setIsSaving(false);
        return; // nada que guardar — evita el toast "Cambios guardados" en falso
      }
      if (!opts?.silent) showToast("Cambios guardados", "success");
    } catch {
      showToast("No se pudieron guardar los cambios", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Autosave ──────────────────────────────────────────────────────────
  // Reemplaza el botón "Guardar" manual: cada cambio (nombre, descripción,
  // mover un pin/reino) dispara este efecto; se debounce 1s desde el
  // último cambio para no guardar en cada tecla, y es silencioso (sin
  // toast) salvo que falle, para no interrumpir mientras se edita texto.
  const hayPendiente =
    editMode && (modifiedDetalles.size > 0 || reinoModificado);
  useEffect(() => {
    if (!hayPendiente) return;
    const timer = setTimeout(() => {
      void handleSaveChanges({ silent: true });
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modifiedDetalles, reinoSeleccionado, reinoModificado, editMode]);

  const volverAlGlobal = () => {
    setVistaActual("global");
    setReinoSeleccionado(null);
    setPuntoSeleccionado(null);
    setDetallesReino([]);
    setPersonajesReino([]);
    setLibrosReino([]);
    setLibrosColeccion([]);
    setCapitulosReino([]);
    setLoadingLibros(false);
    setModifiedDetalles(new Set());
    setPanelOpen(false);
    onExitReino?.();
  };

  // Visible markers: admins ven todos los reinos; usuarios solo los que desbloquearon
  const visibleMarkers =
    vistaActual === "global"
      ? reinos.filter((r) => (isAdmin ? true : reinosDesbloqueados.has(r.id)))
      : detallesReino.filter((l) =>
          isAdmin ? true : ciudadesDesbloqueadas.has(l.id),
        );

  // En la vista global, un reino con un área vinculada ya muestra su nombre
  // fijo dentro del área — el pin (punto + píldora) sería redundante. Solo
  // se ocultan fuera de editMode: en edición conviene seguir viendo todos
  // los pins para poder seleccionarlos/moverlos.
  const reinoIdsConArea = new Set(
    areas.map((a) => a.reino_id).filter((id): id is string => !!id),
  );
  const visibleMarkersSinDuplicado =
    vistaActual === "global" && !editMode
      ? visibleMarkers.filter((m) => !reinoIdsConArea.has(m.id))
      : visibleMarkers;

  // Áreas del mapa global tal como se muestran: si el reino vinculado no
  // fue desbloqueado (y el usuario no es admin), se ve la forma pero sin
  // nombre ni click — mismo criterio que oculta el pin de ese reino.
  const areasParaMostrar =
    vistaActual === "global" && !editMode && !isAdmin
      ? areas.map((a) =>
          a.reino_id && !reinosDesbloqueados.has(a.reino_id)
            ? { ...a, label: null }
            : a,
        )
      : areas;

  // (areasDelReinoParaMostrar / areasDelReino / ciudadIdsDelReino — áreas de
  // las ciudades del reino abierto, mismo criterio que areasParaMostrar pero
  // por ciudad_id — se sacaron junto con ReinoTileCanvas, su único
  // consumidor. Ver nota en reinos/components/ReinoTileCanvas.tsx.)

  // hiddenMarkers: para usuarios son los marcadores no desbloqueados (se muestran en niebla)
  const hiddenMarkers =
    vistaActual === "global"
      ? isAdmin
        ? []
        : reinos.filter((r) => !reinosDesbloqueados.has(r.id))
      : isAdmin
        ? []
        : detallesReino.filter((l) => !ciudadesDesbloqueadas.has(l.id));

  const _currentImage =
    vistaActual === "reino" && reinoSeleccionado?.mapa_url
      ? reinoSeleccionado.mapa_url
      : "/dibujos/reinos/mapa.png";

  const panelProps = {
    editMode,
    reinoSeleccionado,
    puntoSeleccionado,
    setPuntoSeleccionado,
    setDetallesReino,
    setModifiedDetalles,
    setReinoSeleccionado,
    personajesReino,
    personajesDesbloqueados,
    handlePersonajeClick,
    modifiedDetalles,
    isSaving,
    handleSaveChanges,
    hayPendiente,
    setReinoModificado,
    isUploadingImg,
    handleImageUpload,
    imgInputRef,
    librosReino,
    librosColeccion,
    capitulosReino,
    loadingLibros,
    personajesCiudad,
    criaturasCiudad,
    itemsCiudad,
    loadingCiudad,
    librosVinculables: todosLosLibros,
    onVincularLibro: handleVincularLibro,
    onDesvincularLibro: handleDesvincularLibro,
    vinculandoLibroId,
    personajesVinculables: todosLosPersonajes,
    onVincularPersonaje: handleVincularPersonaje,
    onDesvincularPersonaje: handleDesvincularPersonaje,
    vinculandoPersonajeId,
    // Botón "Añadir ciudad" del panel de reino — activa la herramienta de
    // dibujo ya existente (barra flotante) con el reino actual
    // preseleccionado, para no duplicar el flujo de dibujo.
    onIniciarDibujoCiudad: iniciarDibujoCiudadDelReino,
  };

  // Solo bloquea la UI si no hay absolutamente ningún dato todavía (primera carga ever)
  if (loading && reinos.length === 0)
    return (
      <div
        className="fixed inset-0 md:left-[68px]"
        style={{ background: fondoColor || "var(--bg-main)" }}
      />
    );

  return (
    <div
      className="fixed inset-0 flex overflow-hidden md:left-[68px]"
      style={{
        background: fondoColor || "var(--bg-main)",
        transition: "background 0.5s ease",
      }}
    >
      {modalEntidad && (
        <ModalDetalle
          canciones={cancionesPersonaje}
          cargandoCanciones={cargandoCanciones}
          entidad={modalEntidad}
          onClose={() => {
            setModalEntidad(null);
            setCancionesPersonaje([]);
          }}
        />
      )}

      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>

      {/* ── MAP AREA ──
          Siempre w-full: la barra lateral (desktop) se superpone con
          position:absolute en vez de empujar como hermano flex — así el
          contenedor del canvas nunca cambia de tamaño al abrir/cerrar el
          panel, y el ResizeObserver del motor de tiles no dispara ningún
          resize (que antes producía el flash negro / recentrado). */}
      <div className="relative flex-1 min-h-0 overflow-hidden w-full pb-14 md:pb-0">
        {isAdmin && (
          <div
            className="absolute z-70 flex gap-2"
            style={{
              top:
                !panelOpen && (reinoSeleccionado || puntoSeleccionado)
                  ? "3rem"
                  : "1rem",
              right: "1rem",
              transition: "top 0.2s ease",
            }}
          >
            {editMode && (isSaving || hayPendiente) && (
              <div
                className="flex items-center gap-2 px-4 py-2 text-micro font-semibold uppercase tracking-widest transition-all"
                style={{
                  background: "color-mix(in srgb, var(--bg-menu) 90%, transparent)",
                  color: isSaving
                    ? "var(--accent)"
                    : "color-mix(in srgb, var(--foreground) 45%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--primary) 20%, transparent)",
                  borderRadius: "2px",
                  letterSpacing: "0.12em",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                }}
              >
                {isSaving ? <Hourglass size={14} /> : <Save size={14} />}
                {isSaving ? "Guardando…" : "Guardado automático"}
              </div>
            )}
          </div>
        )}

        <AnimatePresence>
          {vistaActual === "reino" && (
            <MotionButton
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 text-micro font-semibold uppercase tracking-widest transition-colors"
              exit={{ opacity: 0, x: -20 }}
              initial={{ opacity: 0, x: -20 }}
              style={{
                background:
                  "color-mix(in srgb, var(--bg-menu) 88%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
                color: "var(--accent)",
                borderRadius: "2px",
                letterSpacing: "0.12em",
                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }}
              onClick={volverAlGlobal}
            >
              <ArrowLeft size={14} /> Volver
            </MotionButton>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!panelOpen && (reinoSeleccionado || puntoSeleccionado) && (
            <MotionButton
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-4 z-50 flex items-center gap-2.5 px-3 py-2 text-micro font-bold uppercase transition-all"
              exit={{ opacity: 0, x: 20 }}
              initial={{ opacity: 0, x: 20 }}
              style={{
                right: "1rem",
                background:
                  "color-mix(in srgb, var(--bg-menu) 92%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
                color: "var(--accent)",
                borderRadius: "2px",
                letterSpacing: "0.12em",
                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }}
              onClick={() => setPanelOpen(true)}
            >
              <BookOpen size={13} />
              <span
                className="max-w-[120px] truncate"
                style={{ fontFamily: "var(--font-cinzel), serif" }}
              >
                {puntoSeleccionado?.nombre ?? reinoSeleccionado?.nombre}
              </span>
            </MotionButton>
          )}
        </AnimatePresence>

        {/* ── FONDO COLOR PICKER (edit mode only) ── */}
        {isAdmin && editMode && (
          <div
            className="absolute bottom-[calc(56px+0.75rem)] md:bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2"
            style={{
              background: "color-mix(in srgb, var(--bg-menu) 94%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
              borderRadius: "2px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
              backdropFilter: "blur(4px)",
            }}
          >
            {/* Label */}
            <span
              className="text-micro font-black uppercase tracking-widest whitespace-nowrap"
              style={{ color: "var(--accent)", letterSpacing: "0.15em" }}
            >
              {vistaActual === "reino" ? "Color Fondo Reino" : "Color Mar"}
            </span>

            {/* Color swatch — opens native color picker */}
            <div className="relative">
              <button
                className="w-7 h-7 border-2 transition-all"
                style={{
                  background: fondoColor || "var(--bg-main)",
                  borderColor:
                    "color-mix(in srgb, var(--accent) 50%, transparent)",
                  borderRadius: "1px",
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.2)",
                }}
                title="Elegir color manual"
                onClick={() => fondoColorInputRef.current?.click()}
              />
              <input
                ref={fondoColorInputRef}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                type="color"
                value={fondoColor || "#5a8fa8"}
                onBlur={(e) => handleFondoColorChange(e.target.value)}
                onChange={(e) => {
                  // Preview en tiempo real + guardado con debounce — antes
                  // esto solo actualizaba el estado local y dependía de
                  // onBlur (poco confiable con el picker nativo de color)
                  // para persistir, así que el color a veces no se guardaba.
                  const color = e.target.value;
                  if (vistaActual === "reino" && reinoSeleccionado) {
                    setReinoSeleccionado((prev: any) => ({
                      ...prev,
                      fondo_color: color,
                    }));
                    setReinos((prev) =>
                      prev.map((r) =>
                        r.id === reinoSeleccionado.id
                          ? { ...r, fondo_color: color }
                          : r,
                      ),
                    );
                  } else {
                    setFondoColorGlobal(color);
                  }
                  scheduleFondoColorSave(color);
                }}
              />
            </div>

            {/* Eyedropper button */}
            <button
              className="w-7 h-7 flex items-center justify-center border transition-all"
              style={{
                background: eyedropperActive
                  ? "color-mix(in srgb, var(--accent) 30%, transparent)"
                  : "color-mix(in srgb, var(--primary) 15%, transparent)",
                borderColor: eyedropperActive
                  ? "var(--accent)"
                  : "color-mix(in srgb, var(--primary) 30%, transparent)",
                color: eyedropperActive
                  ? "var(--accent)"
                  : "color-mix(in srgb, var(--foreground) 60%, transparent)",
                borderRadius: "1px",
              }}
              title="Cuentagotas — click en el mapa para samplear"
              onClick={() => setEyedropperActive((v) => !v)}
            >
              {/* Eyedropper SVG icon */}
              <svg
                fill="none"
                height="13"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="13"
              >
                <path d="m2 22 1-1h3l9-9" />
                <path d="M3 21v-3l9-9" />
                <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8-1.6 1.6" />
              </svg>
            </button>

            {/* Reset */}
            {fondoColor && (
              <button
                className="w-7 h-7 flex items-center justify-center border transition-all"
                style={{
                  background:
                    "color-mix(in srgb, var(--primary) 10%, transparent)",
                  borderColor:
                    "color-mix(in srgb, var(--primary) 25%, transparent)",
                  color:
                    "color-mix(in srgb, var(--foreground) 45%, transparent)",
                  borderRadius: "1px",
                }}
                title="Resetear a color del tema"
                onClick={() => handleFondoColorChange("")}
              >
                <X size={10} />
              </button>
            )}

            {/* Eyedropper hint */}
            {eyedropperActive && (
              <span
                className="text-micro font-semibold uppercase animate-pulse whitespace-nowrap"
                style={{ color: "var(--accent)", letterSpacing: "0.1em" }}
              >
                Clickeá el mapa
              </span>
            )}
          </div>
        )}

        {vistaActual === "global" ? (
          <>
            {editMode ? (
              <UnifiedTileCanvas
                areas={areasParaMostrar}
                className="absolute inset-0"
                drawTool={drawTool}
                editMode={true}
                eyedropperActive={eyedropperActive}
                fondoColor={fondoColor}
                hiddenMarkers={hiddenMarkers}
                isFirstOpen={isFirstOpen}
                markers={[
                  ...visibleMarkersSinDuplicado,
                  ...hiddenMarkers,
                  ...assetMarkers,
                ]}
                placingAssetId={placingAssetId}
                selectedAreaId={selectedAreaId}
                selectedMarkerId={
                  selectedPlacementId
                    ? `asset-placement:${selectedPlacementId}`
                    : (reinoParaMover ?? null)
                }
                tiles={mapTiles}
                onAreaClick={(area) => void handleAreaLabelClick(area)}
                onAreaDrawEnd={handleAreaDrawEnd}
                onAreaPointsChange={handleAreaPointsChange}
                onAreaSelect={setSelectedAreaId}
                onEyedropperPick={handleFondoColorChange}
                onMapClick={handleMapClick}
                onMarkerClick={(m: any) => {
                  if (typeof m.id === "string" && m.id.startsWith("asset-placement:")) {
                    setSelectedPlacementId(m.id.slice("asset-placement:".length));
                    return;
                  }
                  void handleReinoClick(m);
                }}
                onMarkerContextMenu={(m: any) => {
                  if (typeof m.id === "string" && m.id.startsWith("asset-placement:")) {
                    const placementId = m.id.slice("asset-placement:".length);
                    setSelectedPlacementId((prev) =>
                      prev === placementId ? null : placementId,
                    );
                    setReinoParaMover(null);
                    return;
                  }
                  handleReinoContextMenu(m);
                }}
                onMarkerMove={(markerId, coord) => {
                  if (markerId.startsWith("asset-placement:")) {
                    void moveAssetPlacement(
                      markerId.slice("asset-placement:".length),
                      coord,
                    );
                    return;
                  }
                  handleReinoMarkerMove(markerId, coord);
                }}
                onMarkerSelect={(id) => {
                  if (id && id.startsWith("asset-placement:")) {
                    setSelectedPlacementId(id.slice("asset-placement:".length));
                    setReinoParaMover(null);
                    return;
                  }
                  setSelectedPlacementId(null);
                  setReinoParaMover(id);
                }}
                onOpenPanel={
                  isMobile && reinoSeleccionado
                    ? () => setPanelOpen(true)
                    : undefined
                }
                onPlaceAsset={handlePlaceAsset}
                onTerrainChange={handleTerrainChange}
                onTerrainStrokeEnd={handleTerrainStrokeEnd}
                onTileCreate={handleTileCreateAt}
                onTileDelete={(tile) => void handleTileDelete(tile.id)}
                onTilePick={(tile) => setTilePickerTarget(tile)}
                terrain={mapTerrain}
                terrainTool={terrainTool}
              />
            ) : (
              // ── Modo lectura: TileCanvasView, sin código de edición en el
              // bundle (drag de vértices, dibujo, papelera, etc.). ─────────
              <TileCanvasView
                areas={areasParaMostrar}
                className="absolute inset-0"
                fondoColor={fondoColor}
                hiddenMarkers={hiddenMarkers}
                markers={[...visibleMarkersSinDuplicado, ...assetMarkers]}
                terrain={mapTerrain}
                tiles={mapTiles}
                onAreaClick={(area) => void handleAreaLabelClick(area)}
                onMapClick={handleMapClick}
                onMarkerClick={(m: any) => {
                  // Los assets colocados (castillos/árboles/etc.) no son
                  // reinos — un click sobre ellos en modo lectura no navega
                  // a ningún lado (mismo criterio que en modo edición, ver
                  // el onMarkerClick de arriba, solo que acá no hay nada que
                  // seleccionar).
                  if (typeof m.id === "string" && m.id.startsWith("asset-placement:")) {
                    return;
                  }
                  void handleReinoClick(m);
                }}
              />
            )}

            {editMode && (
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
                onClick={() => setShowNuevoTileModal(true)}
              >
                <Plus size={14} />
              </button>
            )}
          </>
        ) : (
          // Rama "vistaActual === 'reino'": inalcanzable en runtime.
          // abrirVistaDeReino ya no llama setVistaActual("reino") en ningún
          // call-site (cambiarVista siempre queda en el default false — ver
          // comentarios en abrirVistaDeReino y en sus dos call-sites). El
          // mapa propio de un reino (ReinoTileCanvas) quedó desactualizado
          // frente a este mapa global y se desactivó por completo — ver
          // nota al tope de reinos/components/ReinoTileCanvas.tsx. El JSX
          // que renderizaba ese canvas (con toda su lógica de detalles/
          // assets/áreas del reino) se sacó de acá junto con este cambio; si
          // en algún momento vuelve a hacer falta un mapa propio por reino,
          // conviene revisar primero si tiene sentido reconstruirlo desde
          // cero en vez de reactivar este componente.
          null
        )}

        {/* ── Panel de librería de assets / controles de la instancia ── */}
        {editMode && (
          <MapAssetLibraryPanel
            assets={mapAssets}
            loadingAssets={loadingMapAssets}
            open={assetLibraryOpen || !!selectedPlacementId}
            placingAssetId={placingAssetId}
            selectedPlacement={selectedPlacement}
            onCancelPlacing={() => setPlacingAssetId(null)}
            onClose={() => {
              setAssetLibraryOpen(false);
              setPlacingAssetId(null);
              setSelectedPlacementId(null);
            }}
            onCreateAsset={createMapAsset}
            onDeletePlacement={(id) => {
              void deleteAssetPlacement(id);
              setSelectedPlacementId(null);
            }}
            onDeselectPlacement={() => setSelectedPlacementId(null)}
            onStartPlacing={(assetId) => {
              setSelectedPlacementId(null);
              setPlacingAssetId((prev) => (prev === assetId ? null : assetId));
            }}
            onUpdatePlacement={(id, patch) => void updateAssetPlacement(id, patch)}
          />
        )}

        {/* ── Barra de herramientas: dibujar áreas — global y reino ── */}
        {editMode && (
          <div
            className="absolute bottom-3 left-14 z-10 flex items-center gap-1 px-1.5 py-1.5"
            style={{
              borderRadius: "8px",
              background: "color-mix(in srgb, var(--bg-menu) 90%, transparent)",
              border: "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
              backdropFilter: "blur(10px)",
            }}
          >
            <button
              className="w-8 h-8 flex items-center justify-center transition-colors"
              style={{
                borderRadius: "6px",
                background: assetLibraryOpen ? "var(--accent)" : "transparent",
                color: assetLibraryOpen ? "#fff" : "var(--accent)",
              }}
              title="Librería de assets (castillos, árboles, etc.)"
              onClick={() => {
                setDrawTool(null);
                setSelectedAreaId(null);
                setAreaVinculoPreseleccionado(null);
                setAssetLibraryOpen((prev) => !prev);
                setTerrainTool(null);
                setTerrainMenuOpen(false);
              }}
            >
              <Trees size={14} />
            </button>

            {/* ── Terreno decorativo: botón que abre el dropdown de colores ── */}
            <div className="relative">
              <button
                className="w-8 h-8 flex items-center justify-center transition-colors"
                style={{
                  borderRadius: "6px",
                  background: terrainTool ? "var(--accent)" : "transparent",
                  color: terrainTool ? "#fff" : "var(--accent)",
                }}
                title="Pintar terreno (verde/azul/café)"
                onClick={() => {
                  setDrawTool(null);
                  setSelectedAreaId(null);
                  setAreaVinculoPreseleccionado(null);
                  setAssetLibraryOpen(false);
                  setPlacingAssetId(null);
                  setTerrainMenuOpen((prev) => !prev);
                }}
              >
                <Paintbrush size={14} />
              </button>

              {terrainMenuOpen && (
                <div
                  className="absolute bottom-full left-0 mb-2 flex items-center gap-1 px-1.5 py-1.5 z-20"
                  style={{
                    borderRadius: "8px",
                    background:
                      "color-mix(in srgb, var(--bg-menu) 95%, transparent)",
                    border:
                      "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  {TERRAIN_COLORS.map((color) => (
                    <button
                      key={color}
                      className="w-7 h-7 flex items-center justify-center transition-transform hover:scale-110"
                      style={{
                        borderRadius: "5px",
                        background: TERRAIN_COLOR_HEX[color],
                        border:
                          terrainTool === color
                            ? "2px solid var(--accent)"
                            : "2px solid transparent",
                      }}
                      title={color}
                      onClick={() =>
                        setTerrainTool((prev) => (prev === color ? null : color))
                      }
                    />
                  ))}
                  <div
                    className="w-px h-5 mx-0.5"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 25%, transparent)",
                    }}
                  />
                  <button
                    className="w-7 h-7 flex items-center justify-center transition-colors"
                    style={{
                      borderRadius: "5px",
                      background:
                        terrainTool === "borrador"
                          ? "var(--accent)"
                          : "color-mix(in srgb, var(--primary) 12%, transparent)",
                      color:
                        terrainTool === "borrador" ? "#fff" : "var(--accent)",
                    }}
                    title="Borrador de terreno"
                    onClick={() =>
                      setTerrainTool((prev) =>
                        prev === "borrador" ? null : "borrador",
                      )
                    }
                  >
                    <Eraser size={13} />
                  </button>
                </div>
              )}
            </div>

            <div
              className="w-px h-5 mx-0.5"
              style={{
                background: "color-mix(in srgb, var(--primary) 25%, transparent)",
              }}
            />

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
                  background:
                    drawTool === tool
                      ? "var(--accent)"
                      : "transparent",
                  color: drawTool === tool ? "#fff" : "var(--accent)",
                }}
                title={title}
                onClick={() => {
                  setSelectedAreaId(null);
                  setAreaVinculoPreseleccionado(null);
                  setDrawTool((prev) => (prev === tool ? null : tool));
                  setTerrainTool(null);
                  setTerrainMenuOpen(false);
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
                  title="Vincular esta área a un reino/ciudad"
                  onClick={() => setVinculadorAreaOpen(true)}
                >
                  {areas.find((a) => a.id === selectedAreaId)?.reino_id ||
                  areas.find((a) => a.id === selectedAreaId)?.ciudad_id ? (
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
      </div>

      {/* ── SIDE PANEL (desktop) ──
          Se superpone al mapa (position:absolute, no ocupa espacio en el
          flex) para que el contenedor del canvas nunca se resize al
          abrir/cerrar — eso es lo que producía el flash negro y el
          recentrado. Antes era un hermano flex con `width` animado que
          angostaba el mapa de verdad. */}
      <AnimatePresence>
        {!isMobile && panelOpen && (reinoSeleccionado || puntoSeleccionado) && (
          <MotionDiv
            animate={{ x: 0, opacity: 1 }}
            className="absolute top-0 right-0 bottom-0 z-40 overflow-hidden"
            exit={{ x: 380, opacity: 0 }}
            initial={{ x: 380, opacity: 0 }}
            style={{
              width: 380,
              background: "var(--white-custom)",
              borderLeft:
                "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
              boxShadow: "-20px 0 60px rgba(0,0,0,0.4)",
            }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 50%, transparent), transparent)",
              }}
            />
            <button
              className="absolute top-4 right-4 z-10 w-7 h-7 flex items-center justify-center transition-colors border"
              style={{
                background:
                  "color-mix(in srgb, var(--bg-main) 80%, transparent)",
                borderColor:
                  "color-mix(in srgb, var(--primary) 20%, transparent)",
                color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
                borderRadius: "1px",
              }}
              onClick={() => {
                setPanelOpen(false);
                setPuntoSeleccionado(null);
              }}
            >
              <X size={12} />
            </button>
            <div className="p-8 pt-10 flex flex-col gap-4 h-full overflow-y-auto">
              <PanelContenido {...panelProps} />
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>

      {/* ── BOTTOM PANEL (mobile) ── */}
      <AnimatePresence>
        {isMobile && panelOpen && (reinoSeleccionado || puntoSeleccionado) && (
          <MotionDiv
            animate={{ y: 0 }}
            className="fixed left-0 right-0 z-999 overflow-hidden"
            exit={{ y: "100%" }}
            initial={{ y: "100%" }}
            style={{
              bottom: "56px",
              background: "var(--white-custom)",
              borderTop:
                "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
              maxHeight: "60dvh",
              boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
            }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 60%, transparent), transparent)",
              }}
            />
            <div className="flex justify-center pt-3 pb-1">
              <div
                className="w-10 h-0.5"
                style={{
                  background:
                    "color-mix(in srgb, var(--primary) 30%, transparent)",
                }}
              />
            </div>
            <button
              className="absolute top-3 right-4 w-7 h-7 flex items-center justify-center transition-colors"
              style={{
                color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
              }}
              onClick={() => {
                setPanelOpen(false);
                setPuntoSeleccionado(null);
              }}
            >
              <X size={14} />
            </button>
            <div
              className="px-6 pb-8 pt-2 overflow-y-auto flex flex-col gap-4"
              style={{ maxHeight: "calc(65dvh - 40px)" }}
            >
              <PanelContenido {...panelProps} />
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>

      {showNuevoTileModal && (
        <ModalNuevoTile
          existingPositions={mapTiles.map((t) => ({
            col: t.col,
            row: t.row,
          }))}
          onClose={() => setShowNuevoTileModal(false)}
          onCreated={handleTileCreated}
        />
      )}

      {tilePickerTarget && (
        <TileImagePickerModal
          onClose={() => setTilePickerTarget(null)}
          onSelect={(url) => void handleTileImageSelect(tilePickerTarget.id, url)}
        />
      )}

      {vinculadorAreaOpen && (areaPendiente || selectedAreaId) && (
        <ModalVincularArea
          ciudades={todasLasCiudades}
          initialCiudadId={
            areaPendiente
              ? null
              : (areas.find((a) => a.id === selectedAreaId)?.ciudad_id ??
                null)
          }
          initialLabel={
            areaPendiente
              ? ""
              : (areas.find((a) => a.id === selectedAreaId)?.label ?? "")
          }
          initialReinoId={
            areaPendiente
              ? (vistaActual !== "global" ? (reinoSeleccionado?.id ?? null) : null)
              : (areas.find((a) => a.id === selectedAreaId)?.reino_id ??
                null)
          }
          reinoBloqueado={
            areaPendiente && vistaActual !== "global"
              ? (reinoSeleccionado?.id ?? null)
              : null
          }
          reinos={reinos}
          onClose={() => {
            setVinculadorAreaOpen(false);
            setAreaPendiente(null);
          }}
          onConfirm={async (reinoId, ciudadId, label) => {
            if (areaPendiente) {
              await handleVincularAreaPendiente(reinoId, ciudadId, label);
            } else if (selectedAreaId) {
              await handleVincularAreaExistente(
                selectedAreaId,
                reinoId,
                ciudadId,
              );
              if (label) {
                await supabase
                  .from("map_areas")
                  .update({ label })
                  .eq("id", selectedAreaId);
                setAreas((prev) =>
                  prev.map((a) =>
                    a.id === selectedAreaId ? { ...a, label } : a,
                  ),
                );
                await invalidateMapAreas("garlia");
              }
              setVinculadorAreaOpen(false);
            }
          }}
        />
      )}
    </div>
  );
}
