"use client";

/**
 * useGruposCriaturas.ts
 * ────────────────────────
 * Grupos de criaturas (tipo "criaturas" en grupos_mundo), usados para
 * asignar a qué grupos puede pertenecer un hechizo/don.
 *
 * Ruta destino:
 *   src/features/editorGarlia/hooks/useGruposCriaturas.ts
 */

import { useEffect, useState } from "react";

import { type GrupoMin } from "@/domains/garlia/_legacy/components/magia/types";
import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";


export function useGruposCriaturas() {
  const [grupos, setGrupos] = useState<GrupoMin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (db && (db as any).grupos_mundo) {
          const all = (await (db as any).grupos_mundo.toArray()) as any[];
          const local: GrupoMin[] = all
            .filter((g: any) => !g.deleted && g.tipo === "criaturas")
            .map((g: any) => ({
              id: g.id,
              nombre: g.nombre,
              miembro_ids: g.miembro_ids ?? [],
            }));
          if (local.length && !cancelled) {
            setGrupos(local);
            setLoading(false);
          }
        }
      } catch {}

      if (!navigator.onLine) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("grupos_mundo")
        .select("id, nombre, miembro_ids")
        .eq("tipo", "criaturas")
        .order("nombre");
      if (cancelled) return;
      const result: GrupoMin[] = (data ?? []).map((r: any) => ({
        id: r.id,
        nombre: r.nombre,
        miembro_ids: r.miembro_ids ?? [],
      }));
      setGrupos(result);
      setLoading(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { grupos, loading };
}
