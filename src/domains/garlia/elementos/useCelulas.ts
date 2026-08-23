"use client";

/**
 * useCelulas.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Catálogo GLOBAL de Células (tabla real "celulas") con CRUD completo —
 * crear, actualizar y eliminar una Célula suelta, sin que esté vinculada
 * todavía a ningún Tejido/Órgano.
 *
 * Hasta ahora las Células solo se creaban en cadena desde
 * useOrganoTejidos.agregarCompuesto (ver ese archivo) — este hook expone el
 * catálogo completo de forma independiente, mismo patrón que useOrganos.ts
 * (fetch con useSupabaseData) pero agregando crear/eliminar, que Órganos no
 * necesitaba tener acá porque ElementosPage.tsx ya lo hacía inline para
 * Compuestos. Acá lo encapsulamos para no repetir esa lógica en
 * BiologiaPage.tsx.
 */

import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

import { CONFIG_CELULAS, type Celula } from "@/domains/garlia/elementos/types";

export function useCelulas() {
  const { data, setData, loading } = useSupabaseData<Celula>(CONFIG_CELULAS.tabla, {
    select: CONFIG_CELULAS.select,
    order: { campo: "created_at" },
  });

  const items = useMemo(() => data, [data]);

  const [creando, setCreando] = useState(false);

  // ── Crear una Célula suelta (sin compuesto_id todavía) ──────────────────
  const crear = useCallback(async () => {
    setCreando(true);
    try {
      const { data: nueva, error } = await supabase
        .from(CONFIG_CELULAS.tabla)
        .insert([{ nombre: "Nueva célula", compuesto_id: null, estructura: [] }])
        .select()
        .single();
      if (error || !nueva) return null;
      setData((prev) => [...prev, nueva as Celula]);
      return nueva as Celula;
    } finally {
      setCreando(false);
    }
  }, [setData]);

  const actualizar = useCallback(
    async (id: string, cambios: Partial<Celula>) => {
      setData((prev) => prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)));
      const { error } = await supabase.from(CONFIG_CELULAS.tabla).update(cambios).eq("id", id);
      if (error) console.error("[useCelulas] error actualizando célula:", error);
    },
    [setData],
  );

  // ── Eliminar — solo tiene sentido si no está en uso por ningún Tejido;
  // Supabase rechaza el delete si hay FK apuntando (constraint), y ese
  // error se propaga tal cual para que la UI lo muestre. ─────────────────
  const eliminar = useCallback(
    async (id: string) => {
      const { error } = await supabase.from(CONFIG_CELULAS.tabla).delete().eq("id", id);
      if (error) {
        console.error("[useCelulas] error eliminando célula:", error);
        return { ok: false, error };
      }
      setData((prev) => prev.filter((c) => c.id !== id));
      return { ok: true, error: null };
    },
    [setData],
  );

  return { items, setItems: setData, loading, creando, crear, actualizar, eliminar };
}
