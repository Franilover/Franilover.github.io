"use client";

/**
 * useGuardarCumpleanos.ts
 * ─────────────────────────
 * Guarda la fecha de nacimiento de un personaje (Supabase + Dexie).
 *
 * Ruta: src/features/editorGarlia/hooks/useGuardarCumpleanos.ts
 */

import { useState } from "react";

import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";

export function useGuardarCumpleanos(
  personajeId: string,
  onFechaNacimientoChange?: (dia: number | null) => void,
) {
  const [saving, setSaving] = useState(false);

  const guardar = async (dia: number): Promise<boolean> => {
    setSaving(true);
    let ok = false;
    try {
      await (supabase as any)
        .from("personajes")
        .update({ fecha_nacimiento: dia })
        .eq("id", personajeId);
      try {
        const existing = await (db as any)?.personajes?.get(personajeId);
        if (existing) {
          await (db as any)?.personajes?.put({
            ...existing,
            fecha_nacimiento: dia,
          });
        }
      } catch {}
      onFechaNacimientoChange?.(dia);
      ok = true;
    } catch {}
    setSaving(false);
    return ok;
  };

  return { guardar, saving };
}
