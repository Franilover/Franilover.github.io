"use client";

/**
 * useItemCatalogosUbicacion.ts
 * ─────────────────────────────
 * Carga los catálogos globales de reinos y ciudades.
 * Antes vivían como dos useEffect sueltos dentro de PanelTerritorio
 * y PanelCiudades respectivamente — un componente no debe fetchear.
 *
 * Migrado a useSupabaseData: gana cache Dexie + sync offline + realtime
 * en lugar del fetch directo original. Se recorta el select a los campos
 * mínimos (id, nombre[, reino_id]) para mantener el mismo shape que antes.
 *
 * Ruta destino:
 *   src/features/editorGarlia/hooks/useItemCatalogosUbicacion.ts
 */

import { useMemo } from "react";

import { useSupabaseData } from "@/hooks/data/useSupabaseData";

export type ReinoMin = { id: string; nombre: string };
export type CiudadMin = { id: string; nombre: string; reino_id?: string | null };

export function useItemCatalogosUbicacion() {
  const { data: reinosData, loading: loadingReinos } = useSupabaseData<any>(
    "reinos",
    { select: "id, nombre", order: { campo: "nombre" } },
  );
  const { data: ciudadesData } = useSupabaseData<any>("ciudades", {
    select: "id, nombre, reino_id",
    order: { campo: "nombre" },
  });

  const allReinos = useMemo<ReinoMin[]>(
    () => reinosData.map((r) => ({ id: r.id, nombre: r.nombre })),
    [reinosData],
  );
  const allCiudades = useMemo<CiudadMin[]>(
    () =>
      ciudadesData.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        reino_id: c.reino_id ?? null,
      })),
    [ciudadesData],
  );

  return { allReinos, allCiudades, loadingReinos };
}
