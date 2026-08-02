"use client";

/**
 * useCriaturasPorIds.ts
 * ───────────────────────
 * Dado un array de ids de criaturas, devuelve nombre + imagen para
 * mostrarlas como chips (p. ej. "criaturas que usan este subsistema
 * mágico" dentro de PanelEditorSubsistema).
 */

import { useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

export type CriaturaMin = {
  id: string;
  nombre: string;
  imagen_url: string | null;
};

export function useCriaturasPorIds(ids: string[]) {
  const [criaturas, setCriaturas] = useState<CriaturaMin[]>([]);
  const [loading, setLoading] = useState(false);

  // Clave estable para evitar refetch cuando el array cambia de referencia
  // pero no de contenido.
  const key = [...ids].sort().join(",");

  useEffect(() => {
    if (ids.length === 0) {
      setCriaturas([]);
      return;
    }
    let cancelado = false;
    setLoading(true);
    void supabase
      .from("criaturas")
      .select("id, nombre, imagen_url")
      .in("id", ids)
      .order("nombre")
      .then(({ data }) => {
        if (cancelado) return;
        setCriaturas((data ?? []) as CriaturaMin[]);
        setLoading(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { criaturas, loading };
}
