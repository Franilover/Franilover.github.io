"use client";

/**
 * useMapAssets
 * ─────────────
 * Estado + I/O de la librería de assets reutilizables (castillos, árboles,
 * montañas, ríos...) y sus instancias colocadas en el mapa (map_asset_-
 * placements). Sigue el mismo patrón que useReinoTiles: fetch Dexie-first
 * vía syncEngine, mutaciones optimistas + Supabase + invalidación de caché.
 *
 * Un solo hook cubre AMBOS scopes (mundo global y reino interno) porque la
 * librería (map_assets) es siempre global — no tiene sentido duplicarla — y
 * las instancias (map_asset_placements) sí son scoped, pero comparten toda
 * la lógica de mutación salvo qué columna llenar (world_id vs reino_id).
 */

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";
import {
  loadMapAssets,
  loadMapAssetPlacements,
  loadReinoAssetPlacements,
  invalidateMapAssetPlacements,
  invalidateReinoAssetPlacements,
} from "@/infra/sync/syncEngine";

export type MapAsset = {
  id: string;
  world_id: string;
  nombre: string;
  categoria: string;
  image_url: string;
  ancho_base: number;
  alto_base: number;
  anchor_x: number;
  anchor_y: number;
};

export type MapAssetPlacement = {
  id: string;
  asset_id: string;
  world_id: string | null;
  reino_id: string | null;
  tile_col: number;
  tile_row: number;
  coord_x: number;
  coord_y: number;
  escala: number;
  rotacion: number;
  z_index: number;
};

/** Librería completa de assets disponibles (catálogo, no instancias). */
export function useMapAssetLibrary(worldId: string = "garlia") {
  const [assets, setAssets] = useState<MapAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadMapAssets(worldId, (fresh) => {
      if (!cancelled) setAssets(fresh as MapAsset[]);
    }).then((data) => {
      if (!cancelled) {
        setAssets(data as MapAsset[]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [worldId]);

  return { assets, loading };
}

interface UseMapAssetPlacementsOpts {
  /** Exactamente uno de los dos — mismo scope que la tabla en Supabase. */
  worldId?: string;
  reinoId?: string;
}

/**
 * Instancias colocadas en un scope dado (mundo o reino). Expone helpers de
 * mutación optimista: crear al colocar, mover/escalar/rotar desde el panel
 * de controles, eliminar.
 */
export function useMapAssetPlacements({
  worldId,
  reinoId,
}: UseMapAssetPlacementsOpts) {
  const [placements, setPlacements] = useState<MapAssetPlacement[]>([]);
  const [loading, setLoading] = useState(true);

  const scopeKey = worldId ? `world:${worldId}` : `reino:${reinoId}`;

  const load = useCallback(async () => {
    setLoading(true);
    const data = worldId
      ? await loadMapAssetPlacements(worldId, (fresh) =>
          setPlacements(fresh as MapAssetPlacement[]),
        )
      : await loadReinoAssetPlacements(reinoId as string, (fresh) =>
          setPlacements(fresh as MapAssetPlacement[]),
        );
    setPlacements(data as MapAssetPlacement[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const invalidate = useCallback(async () => {
    if (worldId) await invalidateMapAssetPlacements(worldId);
    else await invalidateReinoAssetPlacements(reinoId as string);
  }, [worldId, reinoId]);

  /** Crea una instancia nueva del asset elegido en (tile_col, tile_row, x%, y%). */
  const createPlacement = useCallback(
    async (
      assetId: string,
      coord: { x: number; y: number; tile_col: number; tile_row: number },
    ) => {
      const row: Partial<MapAssetPlacement> = {
        asset_id: assetId,
        world_id: worldId ?? null,
        reino_id: worldId ? null : (reinoId as string),
        tile_col: coord.tile_col,
        tile_row: coord.tile_row,
        coord_x: coord.x,
        coord_y: coord.y,
        escala: 1,
        rotacion: 0,
        z_index: 0,
      };
      const { data, error } = await supabase
        .from("map_asset_placements")
        .insert(row)
        .select()
        .single();
      if (!error && data) {
        setPlacements((prev) => [...prev, data as MapAssetPlacement]);
        await invalidate();
      }
      return { data: data as MapAssetPlacement | null, error };
    },
    [worldId, reinoId, invalidate],
  );

  /** Mueve una instancia ya colocada (drag heredado del sistema de markers). */
  const movePlacement = useCallback(
    async (
      placementId: string,
      coord: { x: number; y: number; tile_col: number; tile_row: number },
    ) => {
      setPlacements((prev) =>
        prev.map((p) =>
          p.id === placementId
            ? {
                ...p,
                coord_x: coord.x,
                coord_y: coord.y,
                tile_col: coord.tile_col,
                tile_row: coord.tile_row,
              }
            : p,
        ),
      );
      await supabase
        .from("map_asset_placements")
        .update({
          coord_x: coord.x,
          coord_y: coord.y,
          tile_col: coord.tile_col,
          tile_row: coord.tile_row,
        })
        .eq("id", placementId);
      await invalidate();
    },
    [invalidate],
  );

  /** Actualiza escala/rotación/z_index (sliders del panel de controles). */
  const updatePlacement = useCallback(
    async (
      placementId: string,
      patch: Partial<Pick<MapAssetPlacement, "escala" | "rotacion" | "z_index">>,
    ) => {
      setPlacements((prev) =>
        prev.map((p) => (p.id === placementId ? { ...p, ...patch } : p)),
      );
      await supabase.from("map_asset_placements").update(patch).eq("id", placementId);
      await invalidate();
    },
    [invalidate],
  );

  const deletePlacement = useCallback(
    async (placementId: string) => {
      setPlacements((prev) => prev.filter((p) => p.id !== placementId));
      await supabase.from("map_asset_placements").delete().eq("id", placementId);
      await invalidate();
    },
    [invalidate],
  );

  return {
    placements,
    loading,
    createPlacement,
    movePlacement,
    updatePlacement,
    deletePlacement,
    reload: load,
  };
}
