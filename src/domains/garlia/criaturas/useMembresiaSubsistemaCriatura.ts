"use client";

/**
 * useMembresiaSubsistemaCriatura.ts
 * ───────────────────────────────────
 * Relación N-N entre criaturas y subsistemas mágicos (Luminia, Sintonía,
 * Litonio, Fitonio, Hemonia…), guardada igual que `grupos_mundo`: un array
 * `criatura_ids: string[]` directo en la fila del subsistema
 * (`subsistemas_magia.criatura_ids`), en vez de una tabla puente aparte.
 *
 * A diferencia de la clasificación (Hábitat/Inteligencia/…, que es
 * "1 grupo por subtipo"), una criatura puede pertenecer a UN solo
 * subsistema mágico a la vez — es su "escuela" de magia — así que el
 * selector es simple (un valor, no multi-selección).
 *
 * Requiere una columna nueva en Supabase:
 *   alter table subsistemas_magia
 *     add column criatura_ids uuid[] not null default '{}';
 *
 * Ruta destino:
 *   src/features/editorGarlia/hooks/criaturas/useMembresiaSubsistemaCriatura.ts
 */

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

export type SubsistemaMin = {
  id: string;
  nombre: string;
  criatura_ids: string[];
};

export function useMembresiaSubsistemaCriatura(criaturaId: string) {
  const [todosSubsistemas, setTodosSubsistemas] = useState<SubsistemaMin[]>(
    [],
  );
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!criaturaId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("subsistemas_magia")
        .select("id, nombre, criatura_ids")
        .order("orden", { ascending: true });
      setTodosSubsistemas((data ?? []) as SubsistemaMin[]);
    } catch {}
    setLoading(false);
  }, [criaturaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const subsistemaActual =
    todosSubsistemas.find((s) =>
      (s.criatura_ids ?? []).includes(criaturaId),
    ) ?? null;

  // Asigna la criatura a `subsistemaId`, quitándola de cualquier otro
  // subsistema al que perteneciera antes (pertenencia exclusiva).
  const setSubsistema = useCallback(
    async (subsistemaId: string | null) => {
      const anterior = todosSubsistemas.find((s) =>
        (s.criatura_ids ?? []).includes(criaturaId),
      );

      const updates: { id: string; criatura_ids: string[] }[] = [];

      if (anterior && anterior.id !== subsistemaId) {
        updates.push({
          id: anterior.id,
          criatura_ids: (anterior.criatura_ids ?? []).filter(
            (id) => id !== criaturaId,
          ),
        });
      }

      if (subsistemaId) {
        const destino = todosSubsistemas.find((s) => s.id === subsistemaId);
        if (destino && !(destino.criatura_ids ?? []).includes(criaturaId)) {
          updates.push({
            id: destino.id,
            criatura_ids: [...(destino.criatura_ids ?? []), criaturaId],
          });
        }
      }

      if (updates.length === 0) return;

      // Optimista
      setTodosSubsistemas((prev) =>
        prev.map((s) => {
          const u = updates.find((x) => x.id === s.id);
          return u ? { ...s, criatura_ids: u.criatura_ids } : s;
        }),
      );

      await Promise.all(
        updates.map((u) =>
          supabase
            .from("subsistemas_magia")
            .update({ criatura_ids: u.criatura_ids })
            .eq("id", u.id),
        ),
      );
    },
    [criaturaId, todosSubsistemas],
  );

  return {
    subsistemaActual,
    todosSubsistemas,
    loading,
    setSubsistema,
    reload: load,
  };
}
