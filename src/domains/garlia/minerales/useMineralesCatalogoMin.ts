"use client";

/**
 * useMineralesCatalogoMin.ts
 * ─────────────────────────────
 * Catálogo liviano de todos los Minerales (solo id/nombre/imagen), usado
 * por el buscador "Añadir mineral" en SelectorMineralesMulti — mismo
 * patrón que useCriaturasCatalogoMin (domains/garlia/runas).
 */

import { useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import type { MineralMin } from "./useMineralesPorIds";

export function useMineralesCatalogoMin() {
  const [minerales, setMinerales] = useState<MineralMin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    void supabase
      .from("minerales")
      .select("id, nombre, imagen_url")
      .order("nombre")
      .then(({ data }) => {
        if (cancelado) return;
        setMinerales((data ?? []) as MineralMin[]);
        setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return { minerales, loading };
}
