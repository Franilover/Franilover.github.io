"use client";

/**
 * useMineralesPorIds.ts
 * ────────────────────────
 * Dado un array de ids de Minerales, devuelve nombre + imagen para
 * mostrarlos como chips (p. ej. "minerales de este ecosistema"). Mismo
 * patrón que useCriaturasPorIds (domains/garlia/runas).
 */

import { useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

export type MineralMin = {
  id: string;
  nombre: string;
  imagen_url: string | null;
};

export function useMineralesPorIds(ids: string[]) {
  const [minerales, setMinerales] = useState<MineralMin[]>([]);
  const [loading, setLoading] = useState(false);

  // Clave estable para evitar refetch cuando el array cambia de referencia
  // pero no de contenido.
  const key = [...ids].sort().join(",");

  useEffect(() => {
    if (ids.length === 0) {
      setMinerales([]);
      return;
    }
    let cancelado = false;
    setLoading(true);
    void supabase
      .from("minerales")
      .select("id, nombre, imagen_url")
      .in("id", ids)
      .order("nombre")
      .then(({ data }) => {
        if (cancelado) return;
        setMinerales((data ?? []) as MineralMin[]);
        setLoading(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { minerales, loading };
}
