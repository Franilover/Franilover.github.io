"use client";

/**
 * useEntidadesDeCriatura.ts
 * ───────────────────────────
 * Trae los Ítems vinculados DIRECTAMENTE a una criatura mediante la columna
 * `criatura_id` (relación de origen/pertenencia, 1 criatura → N items).
 * Distinto de las relaciones many-to-many que ya existen — acá la criatura
 * es el "dueño"/origen del item, no una simple asignación.
 *
 * Se usa para armar el agrupador visual "Criatura → Items" dentro del editor
 * de Criatura.
 *
 * Ruta destino:
 *   src/features/editorGarlia/hooks/criaturas/useEntidadesDeCriatura.ts
 */

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

export type EntidadDeCriaturaMin = {
  id: string;
  nombre: string;
  imagen_url?: string | null;
};

type Grupos = {
  items: EntidadDeCriaturaMin[];
};

const EMPTY: Grupos = { items: [] };

export function useEntidadesDeCriatura(criaturaId: string) {
  const [grupos, setGrupos] = useState<Grupos>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!criaturaId) {
      setGrupos(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: items } = await supabase
        .from("items")
        .select("id, nombre, imagen_url")
        .eq("criatura_id", criaturaId)
        .order("nombre");
      setGrupos({
        items: (items ?? []) as EntidadDeCriaturaMin[],
      });
    } finally {
      setLoading(false);
    }
  }, [criaturaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = grupos.items.length;

  return { grupos, total, loading, reload: load };
}
