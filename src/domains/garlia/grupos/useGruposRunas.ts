"use client";

/**
 * useGruposRunas
 * ───────────────────────────────────────────────────────────────────────────
 * Grupos de runas (tabla `grupos_mundo`, tipo="runas") — antes se recibían
 * por props desde el editor externo de una runa individual (FormularioRuna),
 * que a su vez los recibía de más arriba. Ahora que la asignación de grupos
 * vive directamente en RunasPage (panel derecho, debajo de la descripción),
 * este hook los carga acá mismo.
 *
 * CRUD simple directo a Supabase, sin Dexie/offline-sync — mismo patrón que
 * useSubsistemasMagia.ts.
 */

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import type { GrupoMin } from "./types";

export function useGruposRunas() {
  const [grupos, setGrupos] = useState<GrupoMin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("grupos_mundo")
      .select("id, nombre, miembro_ids")
      .eq("tipo", "runas")
      .order("nombre", { ascending: true });

    if (!error && data) setGrupos(data as GrupoMin[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Actualiza grupo_ids de una runa Y refleja el diff en miembro_ids de
   * cada grupo afectado (misma relación N:N guardada por separado en
   * ambos lados — ver el comentario original en FormularioRuna.tsx).
   */
  const sincronizarGruposDeRuna = useCallback(
    async (runaId: string, gruposAntes: string[], gruposDespues: string[]) => {
      const originalIds = new Set(gruposAntes);
      const currentIds = new Set(gruposDespues);
      const agregados = [...currentIds].filter((id) => !originalIds.has(id));
      const quitados = [...originalIds].filter((id) => !currentIds.has(id));
      if (agregados.length === 0 && quitados.length === 0) return;

      setGrupos((prev) =>
        prev.map((g) => {
          if (agregados.includes(g.id)) {
            return g.miembro_ids.includes(runaId)
              ? g
              : { ...g, miembro_ids: [...g.miembro_ids, runaId] };
          }
          if (quitados.includes(g.id)) {
            return { ...g, miembro_ids: g.miembro_ids.filter((id) => id !== runaId) };
          }
          return g;
        }),
      );

      await Promise.all(
        [...agregados, ...quitados].map(async (grupoId) => {
          const grupo = grupos.find((g) => g.id === grupoId);
          if (!grupo) return;
          const nuevosMiembros = agregados.includes(grupoId)
            ? grupo.miembro_ids.includes(runaId)
              ? grupo.miembro_ids
              : [...grupo.miembro_ids, runaId]
            : grupo.miembro_ids.filter((id) => id !== runaId);
          await supabase
            .from("grupos_mundo")
            .update({ miembro_ids: nuevosMiembros })
            .eq("id", grupoId);
        }),
      );
    },
    [grupos],
  );

  return { grupos, loading, sincronizarGruposDeRuna, recargar: load };
}
