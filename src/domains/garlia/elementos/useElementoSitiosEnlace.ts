"use client";

/**
 * useElementoSitiosEnlace.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Sitios de enlace de un Elemento (tabla "elemento_sitios_enlace"): cada fila
 * es un sitio individual (numero_sitio) con su geometría, afinidad,
 * capacidad, selectividad y saturación — poblados/recalculados en Supabase
 * (propagar_elemento_a_sitios + calcular_propiedades_sitio), nunca escritos
 * desde el frontend. Solo lectura, mismo criterio que las Propiedades
 * físicas de ElementoEditor.
 *
 * Liviano y sin cache Dexie (como useCelulasDeUnCompuesto): se resuelve en
 * vivo contra Supabase cada vez que cambia elementoId.
 */

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

/** Fila cruda tal cual vive en Supabase (tabla "elemento_sitios_enlace"). */
export interface ElementoSitioEnlace {
  id: string;
  elemento_id: string;
  tipo: string;
  cantidad: number;
  afinidad: number | null;
  capacidad: number | null;
  selectividad: number | null;
  saturacion: number | null;
  polaridad: number | null;
  estado: string | null;
  numero_sitio: number | null;
  geometria_clave: string | null;
  rigidez_emergente: number | null;
}

export const CONFIG_ELEMENTO_SITIOS_ENLACE = {
  tabla: "elemento_sitios_enlace",
  select:
    "id, elemento_id, tipo, cantidad, afinidad, capacidad, selectividad, saturacion, polaridad, estado, numero_sitio, geometria_clave, rigidez_emergente",
};

export function useElementoSitiosEnlace(elementoId: string | null) {
  const [items, setItems] = useState<ElementoSitioEnlace[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!elementoId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data, error } = await supabase
      .from(CONFIG_ELEMENTO_SITIOS_ENLACE.tabla)
      .select(CONFIG_ELEMENTO_SITIOS_ENLACE.select)
      .eq("elemento_id", elementoId)
      .order("numero_sitio", { ascending: true });

    if (error || !data) {
      setItems([]);
      setLoading(false);
      return;
    }

    setItems(data as unknown as ElementoSitioEnlace[]);
    setLoading(false);
  }, [elementoId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, load };
}
