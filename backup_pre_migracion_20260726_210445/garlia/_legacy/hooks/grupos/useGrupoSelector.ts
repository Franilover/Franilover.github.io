"use client";

/**
 * useGrupoSelector.ts
 * ─────────────────────
 * Carga grupos_mundo de tipo "items" filtrados por subtipo.
 * Reemplaza los hooks duplicados useTiposDeGrupoItems (subtipo "Tipo")
 * y useOrigenesDeGrupoItems (subtipo "Origen"), que eran idénticos
 * salvo por el valor de subtipo.
 *
 * Ruta destino:
 *   src/features/editorGarlia/hooks/useGrupoSelector.ts
 */

import { useEffect, useState } from "react";

import { supabase } from "@/lib/api/client/supabase";

export type GrupoTipoMin = { id: string; nombre: string };

export function useGrupoSelector(subtipo: string) {
  const [grupos, setGrupos] = useState<GrupoTipoMin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("grupos_mundo")
      .select("id, nombre")
      .eq("tipo", "items")
      .eq("subtipo", subtipo)
      .order("nombre")
      .then(({ data }) => {
        setGrupos((data ?? []).map((r: any) => ({ id: r.id, nombre: r.nombre })));
        setLoading(false);
      });
  }, [subtipo]);

  return { grupos, loading };
}
