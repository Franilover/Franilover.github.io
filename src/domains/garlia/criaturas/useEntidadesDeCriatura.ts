"use client";

/**
 * useEntidadesDeCriatura.ts
 * ───────────────────────────
 * Trae las entidades vinculadas a una criatura para el agrupador visual
 * "Criatura → Entidades" del editor de Criatura:
 *   - Ítems: vínculo DIRECTO vía columna `criatura_id` (1 criatura → N items;
 *     acá la criatura es el "dueño"/origen del item).
 *   - Flora / Minerales: NO tienen columna directa a criatura_id — viven en
 *     `Ecosistema.flora_ids` / `Ecosistema.mineral_ids` (jsonb). Se muestran
 *     acá, al mismo nivel que Items, la Flora/Minerales de todo Ecosistema
 *     cuyo `criatura_ids` incluya a esta criatura (solo lectura — la edición
 *     del vínculo vive en PanelEcosistema).
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
  flora: EntidadDeCriaturaMin[];
  minerales: EntidadDeCriaturaMin[];
};

const EMPTY: Grupos = { items: [], flora: [], minerales: [] };

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
      const [{ data: items }, { data: ecosistemas }] = await Promise.all([
        supabase
          .from("items")
          .select("id, nombre, imagen_url")
          .eq("criatura_id", criaturaId)
          .order("nombre"),
        // criatura_ids es jsonb array — contains busca por pertenencia.
        supabase
          .from("ecosistemas")
          .select("flora_ids, mineral_ids")
          .contains("criatura_ids", JSON.stringify([criaturaId])),
      ]);

      const floraIds = Array.from(
        new Set((ecosistemas ?? []).flatMap((e: any) => (e.flora_ids ?? []) as string[])),
      );
      const mineralIds = Array.from(
        new Set((ecosistemas ?? []).flatMap((e: any) => (e.mineral_ids ?? []) as string[])),
      );

      const [{ data: flora }, { data: minerales }] = await Promise.all([
        floraIds.length
          ? supabase
              .from("organismos")
              .select("id, nombre, imagen_url")
              .eq("tipo_organismo", "vegetal")
              .in("id", floraIds)
              .order("nombre")
          : Promise.resolve({ data: [] as EntidadDeCriaturaMin[] }),
        mineralIds.length
          ? supabase.from("minerales").select("id, nombre, imagen_url").in("id", mineralIds).order("nombre")
          : Promise.resolve({ data: [] as EntidadDeCriaturaMin[] }),
      ]);

      setGrupos({
        items: (items ?? []) as EntidadDeCriaturaMin[],
        flora: (flora ?? []) as EntidadDeCriaturaMin[],
        minerales: (minerales ?? []) as EntidadDeCriaturaMin[],
      });
    } finally {
      setLoading(false);
    }
  }, [criaturaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = grupos.items.length + grupos.flora.length + grupos.minerales.length;

  return { grupos, total, loading, reload: load };
}
