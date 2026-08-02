"use client";

/**
 * useRunas.ts
 * ────────────────────────
 * Catálogo de runas.
 *
 * Antes era useEntidadesMagicas.ts y recibía un `modo` (hechizos/dones/
 * runas) para elegir tabla y campos a fetchear. Ahora que solo queda
 * Runas, la tabla y los campos son fijos.
 *
 * Usa useSupabaseData: sync offline en cola + realtime.
 */

import { useMemo } from "react";

import { CONFIG, type EntidadMagica } from "@/domains/garlia/runas/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export function useRunas() {
  const { data, setData, loading } = useSupabaseData<EntidadMagica>(CONFIG.tabla, {
    select: "id, nombre, explicacion, patron_trazos, grupo_ids",
    order: { campo: "nombre" },
  });

  const items = useMemo(() => data, [data]);

  return { items, setItems: setData, loading };
}
