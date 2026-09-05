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

import { Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

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
  selectedPlacement,
  onUpdatePlacement,
  onDeletePlacement,
  onDeselectPlacement,
}: MapAssetLibraryPanelProps) {
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);

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
          {/* ── Filtro de categoría ──────────────────────────────────── */}
          {categorias.length > 1 && (
            <div className="flex gap-1.5 px-3 py-2 overflow-x-auto shrink-0">
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
            </div>
          )}

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
