"use client";

/**
 * useEntidadesDeCriatura.ts
 * ───────────────────────────
 * Trae los Dones, Runas, Ítems y Hechizos vinculados DIRECTAMENTE a una
 * criatura mediante la columna `criatura_id` (relación de origen/pertenencia,
 * 1 criatura → N entidades). Distinto de las relaciones many-to-many que ya
 * existen (item_crafteres, personaje_hechizos, etc.) — acá la criatura es el
 * "dueño"/origen de la entidad, no una simple asignación.
 *
 * Se usa para armar el agrupador visual "Criatura → Dones / Runas / Items /
 * Hechizos" dentro del editor de Criatura.
 *
 * Ruta destino:
 *   src/features/editorGarlia/hooks/criaturas/useEntidadesDeCriatura.ts
 */

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/api/client/supabase";

export type EntidadDeCriaturaMin = {
  id: string;
  nombre: string;
  imagen_url?: string | null;
};

type Grupos = {
  dones: EntidadDeCriaturaMin[];
  runas: EntidadDeCriaturaMin[];
  items: EntidadDeCriaturaMin[];
  hechizos: EntidadDeCriaturaMin[];
};

const EMPTY: Grupos = { dones: [], runas: [], items: [], hechizos: [] };

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
      const [{ data: dones }, { data: runas }, { data: items }, { data: hechizos }] =
        await Promise.all([
          supabase
            .from("dones")
            .select("id, nombre, imagen_url")
            .eq("criatura_id", criaturaId)
            .order("nombre"),
          supabase
            .from("runas")
            .select("id, nombre, imagen_url")
            .eq("criatura_id", criaturaId)
            .order("nombre"),
          supabase
            .from("items")
            .select("id, nombre, imagen_url")
            .eq("criatura_id", criaturaId)
            .order("nombre"),
          supabase
            .from("hechizos")
            .select("id, nombre, imagen_url")
            .eq("criatura_id", criaturaId)
            .order("nombre"),
        ]);
      setGrupos({
        dones: (dones ?? []) as EntidadDeCriaturaMin[],
        runas: (runas ?? []) as EntidadDeCriaturaMin[],
        items: (items ?? []) as EntidadDeCriaturaMin[],
        hechizos: (hechizos ?? []) as EntidadDeCriaturaMin[],
      });
    } finally {
      setLoading(false);
    }
  }, [criaturaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const total =
    grupos.dones.length +
    grupos.runas.length +
    grupos.items.length +
    grupos.hechizos.length;

  return { grupos, total, loading, reload: load };
}
