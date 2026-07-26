"use client";

/**
 * useEntidadesMagicas.ts
 * ────────────────────────
 * Catálogo de hechizos/dones/runas.
 *
 * Migrado a useSupabaseData: reemplaza el Dexie+Supabase manual por el
 * hook central (misma tabla dinámica según `modo`, mismo select de campos),
 * ganando además sync offline en cola y realtime, que la versión anterior
 * no tenía.
 *
 * Ruta destino:
 *   src/features/editorGarlia/hooks/useEntidadesMagicas.ts
 */

import { useMemo } from "react";

import { CONFIG, type EntidadMagica, type Modo } from "@/domains/garlia/_legacy/components/magia/types";
import { useSupabaseData } from "@/hooks/data/useSupabaseData";

export function useEntidadesMagicas(modo: Modo) {
  const tabla = CONFIG[modo].tabla;
  const selectFields =
    modo === "runas"
      ? "id, nombre, explicacion, imagen_url, criatura_id"
      : "id, nombre, explicacion, grupo_ids, imagen_url, criatura_id";

  const { data, setData, loading } = useSupabaseData<EntidadMagica>(tabla, {
    select: selectFields,
    order: { campo: "nombre" },
  });

  const items = useMemo(() => data, [data]);

  return { items, setItems: setData, loading };
}
