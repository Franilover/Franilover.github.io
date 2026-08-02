"use client";

/**
 * useGruposRunas.ts
 * ────────────────────
 * Grupos de runas (tipo "runas" en grupos_mundo), usados para agrupar
 * runas en categorías libres definidas por el admin — ej. "Naturales",
 * "De fuego", "Impacto rápido" — sin que estén ligadas a ninguna regla
 * de juego particular. Es puramente organizativo/temático, análogo a
 * como useGruposCriaturas agrupa criaturas, pero para runas.
 *
 * NOTA sobre GrupoMin: existen otras definiciones del mismo nombre en el
 * repo (useGruposDelPersonaje.ts, useGruposDeLaCancion.ts,
 * useMembresiaGruposCriatura.ts, useGruposCriaturas.ts), con formas
 * ligeramente distintas. No se unificaron en este paso — queda pendiente
 * como su propio barrido.
 */

import { useEffect, useState } from "react";

import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";

export type GrupoMin = {
  id: string;
  nombre: string;
  miembro_ids: string[];
};

export function useGruposRunas() {
  const [grupos, setGrupos] = useState<GrupoMin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (db && (db as any).grupos_mundo) {
          const all = (await (db as any).grupos_mundo.toArray()) as any[];
          const local: GrupoMin[] = all
            .filter((g: any) => !g.deleted && g.tipo === "runas")
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
        .eq("tipo", "runas")
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
