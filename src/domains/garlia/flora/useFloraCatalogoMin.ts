"use client";

/**
 * useFloraCatalogoMin.ts
 * ────────────────────────
 * Catálogo liviano de toda la Flora (solo id/nombre/imagen), usado por
 * el buscador "Añadir flora" en SelectorFloraMulti — mismo patrón que
 * useCriaturasCatalogoMin (domains/garlia/runas).
 */

import { useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import type { FloraMin } from "./useFloraPorIds";

export function useFloraCatalogoMin() {
  const [flora, setFlora] = useState<FloraMin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    void supabase
      .from("organismos")
      .select("id, nombre, imagen_url")
      .eq("tipo_organismo", "vegetal")
      .order("nombre")
      .then(({ data }) => {
        if (cancelado) return;
        setFlora((data ?? []) as FloraMin[]);
        setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return { flora, loading };
}
