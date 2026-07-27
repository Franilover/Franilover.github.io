"use client";

/**
 * useGruposDeCriatura.ts
 * ───────────────────────
 * Dado el nombre de una especie/criatura, resuelve los grupos_mundo
 * a los que pertenece y si alguno de ellos es "mágico".
 *
 * Estrategia: Dexie primero → Supabase en background.
 *
 * Ruta: src/features/editorGarlia/hooks/useGruposDeCriatura.ts
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { isReallyOnline } from "@/hooks/data/useOfflineSync";
import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normNombre(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGruposDeCriatura(
  nombreEspecie: string | null | undefined,
): { ids: string[]; esMagico: boolean } {
  const [grupoIds, setGrupoIds] = useState<string[]>([]);
  const [esMagico, setEsMagico] = useState(false);
  const isMounted = useRef(true);

  const applyGrupos = useCallback((grupos: any[]) => {
    setGrupoIds(grupos.map((g: any) => g.id));
    setEsMagico(
      grupos.some((g: any) => normNombre(g.nombre ?? "") === "magico"),
    );
  }, []);

  const load = useCallback(async () => {
    if (!nombreEspecie?.trim()) {
      setGrupoIds([]);
      setEsMagico(false);
      return;
    }

    // ── 1. Dexie primero (instantáneo) ──────────────────────────────────────
    try {
      if (db?.criaturas && db?.grupos_mundo) {
        const todas: any[] = await db.criaturas.toArray();
        const criLocal = todas.find(
          (c: any) => normNombre(c.nombre ?? "") === normNombre(nombreEspecie),
        );
        if (criLocal?.id) {
          const gruposLocal: any[] = await db.grupos_mundo
            .where("tipo")
            .equals("criaturas")
            .toArray();
          const match = gruposLocal.filter((g: any) =>
            (g.miembro_ids ?? []).includes(criLocal.id),
          );
          if (match.length && isMounted.current) {
            applyGrupos(match);
          }
        }
      }
    } catch {}

    // ── 2. Supabase en background ────────────────────────────────────────────
    try {
      const online = await isReallyOnline();
      if (!online || !isMounted.current) return;

      const { data: cri } = await supabase
        .from("criaturas")
        .select("id")
        .ilike("nombre", nombreEspecie.trim())
        .limit(1)
        .maybeSingle();

      if (!cri?.id || !isMounted.current) return;

      const { data: grupos } = await supabase
        .from("grupos_mundo")
        .select("id, nombre, miembro_ids")
        .eq("tipo", "criaturas")
        .contains("miembro_ids", [cri.id]);

      if (isMounted.current) applyGrupos(grupos ?? []);
    } catch {}
  }, [nombreEspecie, applyGrupos]);

  useEffect(() => {
    isMounted.current = true;
    void load();
    return () => {
      isMounted.current = false;
    };
  }, [load]);

  return { ids: grupoIds, esMagico };
}
