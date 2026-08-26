"use client";

/**
 * useFloraPorIds.ts
 * ────────────────────
 * Dado un array de ids de Flora, devuelve nombre + imagen para mostrarlas
 * como chips (p. ej. "flora de este ecosistema"). Mismo patrón que
 * useCriaturasPorIds (domains/garlia/runas).
 */

import { useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

export type FloraMin = {
  id: string;
  nombre: string;
  imagen_url: string | null;
};

export function useFloraPorIds(ids: string[]) {
  const [flora, setFlora] = useState<FloraMin[]>([]);
  const [loading, setLoading] = useState(false);

  // Clave estable para evitar refetch cuando el array cambia de referencia
  // pero no de contenido.
  const key = [...ids].sort().join(",");

  useEffect(() => {
    if (ids.length === 0) {
      setFlora([]);
      return;
    }
    let cancelado = false;
    setLoading(true);
    void supabase
      .from("organismos")
      .select("id, nombre, imagen_url")
      .eq("tipo_organismo", "vegetal")
      .in("id", ids)
      .order("nombre")
      .then(({ data }) => {
        if (cancelado) return;
        setFlora((data ?? []) as FloraMin[]);
        setLoading(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { flora, loading };
}
