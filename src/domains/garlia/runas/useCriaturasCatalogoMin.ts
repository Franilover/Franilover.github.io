"use client";

/**
 * useCriaturasCatalogoMin.ts
 * ────────────────────────────
 * Catálogo liviano de todas las criaturas (solo id/nombre/imagen), usado
 * por el buscador de "Añadir criatura" en PanelEditorSubsistema — no
 * confundir con useCriaturasCatalogo (domains/garlia/criaturas), que trae
 * el objeto Criatura completo para el listado principal del editor.
 */

import { useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import type { CriaturaMin } from "./useCriaturasPorIds";

export function useCriaturasCatalogoMin() {
  const [criaturas, setCriaturas] = useState<CriaturaMin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    void supabase
      .from("criaturas")
      .select("id, nombre, imagen_url")
      .order("nombre")
      .then(({ data }) => {
        if (cancelado) return;
        setCriaturas((data ?? []) as CriaturaMin[]);
        setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return { criaturas, loading };
}
