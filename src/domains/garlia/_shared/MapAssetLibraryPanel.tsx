"use client";

/**
 * MapAssetLibraryPanel
 * ──────────────────────
 * Panel flotante de la toolbar de edición del mapa:
 *   - Grilla de assets disponibles (imagen + nombre + categoría) → click
 *     activa "modo colocar" con ese asset (placingAssetId en el padre).
 *   - Si hay una instancia colocada seleccionada, muestra sliders de
 *     escala/rotación y un botón eliminar en vez de la grilla.
 *
 * No sabe nada de Supabase — todo I/O vive en useMapAssets (el padre).
 */

import { ImageIcon, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import SimpleImagePicker from "@/ui/SimpleImagePicker";

import type { MapAsset, MapAssetPlacement } from "./useMapAssets";

interface MapAssetLibraryPanelProps {
  assets: MapAsset[];
  loadingAssets: boolean;
  /** null = panel cerrado. */
  open: boolean;
  onClose: () => void;

  placingAssetId: string | null;
  onStartPlacing: (assetId: string) => void;
  onCancelPlacing: () => void;

  /** Alta de un asset nuevo en la librería — se llama después de elegir la
   * imagen (mismo picker que los tiles) y completar nombre/categoría en el
   * modal de info. ancho_base/alto_base ya vienen calculados. */
  onCreateAsset: (input: {
    nombre: string;
    categoria: string;
    image_url: string;
    ancho_base: number;
    alto_base: number;
  }) => Promise<{ data: MapAsset | null; error: any }>;

  /** Instancia colocada actualmente seleccionada en el canvas (si hay). */
  selectedPlacement: MapAssetPlacement | null;
  onUpdatePlacement: (
    placementId: string,
    patch: Partial<Pick<MapAssetPlacement, "escala" | "rotacion" | "z_index">>,
  ) => void;
  onDeletePlacement: (placementId: string) => void;
  onDeselectPlacement: () => void;
}

export function MapAssetLibraryPanel({
  assets,
  loadingAssets,
  open,
  onClose,
  placingAssetId,
  onStartPlacing,
  onCancelPlacing,
  onCreateAsset,
  selectedPlacement,
  onUpdatePlacement,
  onDeletePlacement,
  onDeselectPlacement,
}: MapAssetLibraryPanelProps) {
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);
  // Flujo de alta: 1) elegir imagen (picker) → 2) completar nombre/categoría
  // (modal de info, con dimensiones ya detectadas). Dos pasos separados en
  // vez de un solo modal con upload inline porque SimpleImagePicker ya es
  // el picker "grande" (biblioteca completa) que se usa para tiles — no
  // tiene sentido duplicar esa UI acá adentro.
  const [pickingImage, setPickingImage] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);

  const categorias = useMemo(
    () => [...new Set(assets.map((a) => a.categoria))].sort(),
    [assets],
  );
  const assetsFiltrados = categoriaFiltro
    ? assets.filter((a) => a.categoria === categoriaFiltro)
    : assets;

  if (!open) return null;


  return (
    <div
      className="absolute top-12 left-2 z-20 w-64 max-h-[70%] flex flex-col overflow-hidden"
      style={{
        background: "var(--white-custom)",
        border: "1px solid color-mix(in srgb, var(--primary) 20%, transparent)",
        borderRadius: "8px",
        boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2.5 shrink-0"
        style={{
          borderBottom:
            "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
        }}
      >
        <h3
          className="text-micro font-black uppercase tracking-[0.15em]"
          style={{ color: "var(--foreground)" }}
        >
          {selectedPlacement ? "Asset seleccionado" : "Librería de assets"}
        </h3>
        <button
          className="opacity-50 hover:opacity-100 transition-opacity"
          onClick={onClose}
        >
          <X size={13} />
        </button>
      </div>

      {/* ── Controles de la instancia seleccionada ─────────────────────── */}
      {selectedPlacement ? (
        <div className="p-3 flex flex-col gap-4">
          <SliderControl
            label="Escala"
            max={4}
            min={0.1}
            step={0.05}
            value={selectedPlacement.escala}
            valueLabel={`${Math.round(selectedPlacement.escala * 100)}%`}
            onChange={(v) =>
              onUpdatePlacement(selectedPlacement.id, { escala: v })
            }
          />
          <SliderControl
            label="Rotación"
            max={180}
            min={-180}
            step={1}
            value={selectedPlacement.rotacion}
            valueLabel={`${Math.round(selectedPlacement.rotacion)}°`}
            onChange={(v) =>
              onUpdatePlacement(selectedPlacement.id, { rotacion: v })
            }
          />
          <SliderControl
            label="Orden (z-index)"
            max={10}
            min={-10}
            step={1}
            value={selectedPlacement.z_index}
            valueLabel={`${selectedPlacement.z_index}`}
            onChange={(v) =>
              onUpdatePlacement(selectedPlacement.id, { z_index: Math.round(v) })
            }
          />

          <div className="flex gap-2 pt-1">
            <button
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-micro font-black uppercase tracking-widest"
              style={{
                borderRadius: "6px",
                background: "color-mix(in srgb, #ef4444 15%, transparent)",
                color: "#ef4444",
              }}
              onClick={() => onDeletePlacement(selectedPlacement.id)}
            >
              <Trash2 size={12} /> Eliminar
            </button>
            <button
              className="flex-1 py-2 text-micro font-black uppercase tracking-widest"
              style={{
                borderRadius: "6px",
                background:
                  "color-mix(in srgb, var(--primary) 10%, transparent)",
                color: "var(--foreground)",
              }}
              onClick={onDeselectPlacement}
            >
              Listo
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Filtro de categoría + botón "+" para dar de alta un asset ── */}
          <div className="flex items-center gap-1.5 px-3 py-2 shrink-0">
            <div className="flex gap-1.5 overflow-x-auto flex-1">
              {categorias.length > 1 && (
                <>
                  <CategoriaChip
                    active={categoriaFiltro === null}
                    label="Todos"
                    onClick={() => setCategoriaFiltro(null)}
                  />
                  {categorias.map((cat) => (
                    <CategoriaChip
                      key={cat}
                      active={categoriaFiltro === cat}
                      label={cat}
                      onClick={() => setCategoriaFiltro(cat)}
                    />
                  ))}
                </>
              )}
            </div>
            <button
              className="w-6 h-6 flex items-center justify-center shrink-0 transition-colors"
              style={{
                borderRadius: "999px",
                background: "var(--accent)",
                color: "#fff",
              }}
              title="Añadir asset nuevo a la librería"
              onClick={() => setPickingImage(true)}
            >
              <Plus size={13} />
            </button>
          </div>

          {/* ── Modo colocar activo: hint + cancelar ────────────────────── */}
          {placingAssetId && (
            <div
              className="mx-3 mb-2 px-2.5 py-2 flex items-center justify-between shrink-0"
              style={{
                borderRadius: "6px",
                background:
                  "color-mix(in srgb, var(--accent) 15%, transparent)",
              }}
            >
              <span
                className="text-micro font-bold"
                style={{ color: "var(--accent)" }}
              >
                Click en el mapa para colocar
              </span>
              <button
                className="text-micro font-black uppercase opacity-70 hover:opacity-100"
                style={{ color: "var(--accent)" }}
                onClick={onCancelPlacing}
              >
                Cancelar
              </button>
            </div>
          )}

          {/* ── Grilla de assets ─────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-3 pt-1">
            {loadingAssets ? (
              <p className="text-micro opacity-50 text-center py-6">
                Cargando…
              </p>
            ) : assetsFiltrados.length === 0 ? (
              <p className="text-micro opacity-50 text-center py-6">
                Sin assets todavía. Subilos por SQL a map_assets.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {assetsFiltrados.map((asset) => (
                  <button
                    key={asset.id}
                    className="flex flex-col items-center gap-1 p-1.5 transition-all"
                    style={{
                      borderRadius: "6px",
                      background:
                        placingAssetId === asset.id
                          ? "color-mix(in srgb, var(--accent) 25%, transparent)"
                          : "color-mix(in srgb, var(--primary) 6%, transparent)",
                      border:
                        placingAssetId === asset.id
                          ? "1px solid var(--accent)"
                          : "1px solid transparent",
                    }}
                    title={asset.nombre}
                    onClick={() => onStartPlacing(asset.id)}
                  >
                    <img
                      alt={asset.nombre}
                      className="w-full aspect-square object-contain"
                      src={asset.image_url}
                    />
                    <span
                      className="text-[9px] font-bold uppercase tracking-wide truncate w-full text-center"
                      style={{ color: "var(--foreground)" }}
                    >
                      {asset.nombre}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Paso 1: elegir imagen (mismo picker que los tiles) ──────────── */}
      {pickingImage && (
        <div
          className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setPickingImage(false)}
        >
          <div
            className="bg-white-custom rounded-xl shadow-2xl border border-primary/15 w-full max-w-lg p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-micro font-black uppercase tracking-[0.15em] text-primary/50 flex items-center gap-2">
                <ImageIcon size={11} /> Imagen del asset
              </h3>
              <button
                className="text-primary/30 hover:text-primary transition-colors"
                onClick={() => setPickingImage(false)}
              >
                <X size={16} />
              </button>
            </div>
            <SimpleImagePicker
              onClose={() => setPickingImage(false)}
              onSelect={(url: string) => {
                setPickingImage(false);
                setPendingImageUrl(url);
              }}
            />
          </div>
        </div>
      )}

      {/* ── Paso 2: nombre + categoría, con dimensiones auto-detectadas ─── */}
      {pendingImageUrl && (
        <NewAssetInfoModal
          imageUrl={pendingImageUrl}
          categoriasExistentes={categorias}
          onCancel={() => setPendingImageUrl(null)}
          onConfirm={async (info) => {
            const { data } = await onCreateAsset({
              image_url: pendingImageUrl,
              ...info,
            });
            setPendingImageUrl(null);
            // Deja el asset recién creado listo para colocar, ahorrando el
            // click extra de buscarlo en la grilla — mismo criterio que
            // handlePlaceAsset en mapaGarlia.tsx, que hace lo análogo
            // seleccionando el placement recién creado.
            if (data) onStartPlacing(data.id);
          }}
        />
      )}
    </div>
  );
}

// ─── NewAssetInfoModal ──────────────────────────────────────────────────────
// Pide nombre + categoría para el asset recién elegido. Las dimensiones
// naturales (ancho_base/alto_base) se detectan solas cargando la imagen en
// un <img> oculto — el usuario nunca tiene que medir el PNG a mano.
function NewAssetInfoModal({
  imageUrl,
  categoriasExistentes,
  onCancel,
  onConfirm,
}: {
  imageUrl: string;
  categoriasExistentes: string[];
  onCancel: () => void;
  onConfirm: (info: {
    nombre: string;
    categoria: string;
    ancho_base: number;
    alto_base: number;
  }) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState(categoriasExistentes[0] ?? "");
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const puedeConfirmar = nombre.trim() !== "" && categoria.trim() !== "" && !!dims;

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm p-5 flex flex-col gap-4"
        style={{
          background: "var(--white-custom)",
          border: "1px solid color-mix(in srgb, var(--primary) 20%, transparent)",
          borderRadius: "10px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3
            className="text-micro font-black uppercase tracking-[0.15em]"
            style={{ color: "var(--foreground)" }}
          >
            Nuevo asset
          </h3>
          <button
            className="opacity-50 hover:opacity-100 transition-opacity"
            onClick={onCancel}
          >
            <X size={14} />
          </button>
        </div>

        {/* Preview + detección de dimensiones. La imagen visible es un
            <img> normal (con dims ya calculadas se ve al toque); la carga
            para MEDIR pasa siempre por un Image() nuevo en el onLoad de
            abajo, así funciona aunque el navegador cachee distinto. */}
        <div
          className="w-full aspect-video flex items-center justify-center overflow-hidden"
          style={{
            borderRadius: "8px",
            background: "color-mix(in srgb, var(--primary) 6%, transparent)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="preview"
            className="max-w-full max-h-full object-contain"
            src={imageUrl}
            onLoad={(e) => {
              const img = e.currentTarget;
              setDims({ w: img.naturalWidth, h: img.naturalHeight });
            }}
          />
        </div>
        <p
          className="text-micro font-bold uppercase tracking-widest text-center opacity-50 -mt-2"
          style={{ color: "var(--foreground)" }}
        >
          {dims ? `${dims.w} × ${dims.h}px` : "Detectando tamaño…"}
        </p>

        <div className="flex flex-col gap-1">
          <label
            className="text-micro font-bold uppercase tracking-[0.15em] opacity-50"
            style={{ color: "var(--foreground)" }}
          >
            Nombre
          </label>
          <input
            autoFocus
            className="input-brand text-sm py-1.5 px-2"
            placeholder="Ej: Castillo de piedra"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="text-micro font-bold uppercase tracking-[0.15em] opacity-50"
            style={{ color: "var(--foreground)" }}
          >
            Categoría
          </label>
          <input
            className="input-brand text-sm py-1.5 px-2"
            list="map-asset-categorias"
            placeholder="Ej: castillo, arbol, montania…"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          />
          {/* Autocompletado con las categorías ya usadas — sigue siendo
              texto libre (ver comentario en map_assets.sql sobre por qué
              categoria no es un enum), esto solo evita crear "arbol" y
              "árbol" por accidente. */}
          <datalist id="map-asset-categorias">
            {categoriasExistentes.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
        </div>

        <button
          className="btn-brand w-full justify-center py-2.5 text-micro uppercase disabled:opacity-50"
          disabled={!puedeConfirmar || saving}
          onClick={async () => {
            if (!dims) return;
            setSaving(true);
            onConfirm({
              nombre: nombre.trim(),
              categoria: categoria.trim(),
              ancho_base: dims.w,
              alto_base: dims.h,
            });
          }}
        >
          {saving ? "Guardando…" : "Añadir a la librería"}
        </button>
      </div>
    </div>
  );
}

function CategoriaChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest whitespace-nowrap shrink-0"
      style={{
        borderRadius: "999px",
        background: active
          ? "var(--accent)"
          : "color-mix(in srgb, var(--primary) 10%, transparent)",
        color: active ? "#fff" : "var(--foreground)",
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function SliderControl({
  label,
  value,
  valueLabel,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label
          className="text-micro font-bold uppercase tracking-widest opacity-60"
          style={{ color: "var(--foreground)" }}
        >
          {label}
        </label>
        <span
          className="text-micro font-black"
          style={{ color: "var(--accent)" }}
        >
          {valueLabel}
        </span>
      </div>
      <input
        className="w-full accent-[var(--accent)]"
        max={max}
        min={min}
        step={step}
        type="range"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
