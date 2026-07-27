"use client";

/**
 * usePersonajesDeCriatura.ts
 * ───────────────────────────
 * Gestiona qué personajes tienen esta criatura como especie:
 * carga inicial (Dexie → Supabase) + toggle para añadir/quitar.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/criaturas/usePersonajesDeCriatura.ts
 */

import { useEffect, useState } from "react";

import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";

type PersonajeMin = { id: string; nombre: string; img_url?: string | null };

export function usePersonajesDeCriatura(
  criaturaId: string,
  nombreCriatura: string,
) {
  const [personajes, setPersonajes] = useState<PersonajeMin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);

    const run = async () => {
      // 1. Dexie primero — filtrar por especie en memoria
      try {
        if (db) {
          const todas: any[] = (await (db as any).personajes?.toArray()) ?? [];
          const local = todas.filter(
            (p: any) =>
              p.especie?.toLowerCase() === nombreCriatura?.toLowerCase() &&
              !p.deleted,
          );
          if (local.length) {
            setPersonajes(
              local.map((p: any) => ({
                id: p.id,
                nombre: p.nombre,
                img_url: p.img_url ?? null,
              })),
            );
            setLoading(false);
            if (!navigator.onLine) return;
          }
        }
      } catch {}

      if (!navigator.onLine) {
        setLoading(false);
        return;
      }

      // 2. Supabase en background
      const { data } = await supabase
        .from("personajes")
        .select("id, nombre, img_url")
        .eq("especie", nombreCriatura)
        .order("nombre");
      setPersonajes(data ?? []);
      setLoading(false);
    };

    void run();
  }, [nombreCriatura]);

  const toggle = async (
    id: string,
    add: boolean,
    nombreCriaturaActual: string,
    allPersonajes: PersonajeMin[],
  ) => {
    setSaving(true);
    if (add) {
      await supabase
        .from("personajes")
        .update({ especie: nombreCriaturaActual })
        .eq("id", id);
      const p = allPersonajes.find((p) => p.id === id);
      if (p) setPersonajes((prev) => [...prev, p]);
    } else {
      await supabase.from("personajes").update({ especie: null }).eq("id", id);
      setPersonajes((prev) => prev.filter((p) => p.id !== id));
    }
    setSaving(false);
  };

  return { personajes, loading, saving, toggle };
}
