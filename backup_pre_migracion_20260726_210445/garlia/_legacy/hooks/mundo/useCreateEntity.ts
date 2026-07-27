"use client";

/**
 * useCreateEntity
 * ───────────────────────────────────────────────────────────────────────────
 * Antes: createAndOpen() insertaba directo en supabase.from(tabla) con un
 * cliente crudo, y luego handleCreated hacía un enrutamiento manual según
 * si la tab era "de mundo" o standalone. Ahora: un solo lugar, tipado, que
 * sabe la tabla de cada sección y navega usando el store en vez de un
 * side-channel de callbacks.
 */

import { useCallback } from "react";

import { supabase } from "@/lib/api/client/supabase";

import { useMundoNavigation, type SectionKey } from "./useMundoNavigationStore";

const SECTION_TABLE: Partial<Record<SectionKey, string>> = {
  personajes: "personajes",
  criaturas: "criaturas",
  items: "items",
  reinos: "reinos",
  ciudades: "ciudades",
};

const PLACEHOLDER_NAME: Partial<Record<SectionKey, string>> = {
  personajes: "Nuevo personaje",
  criaturas: "Nueva criatura",
  items: "Nuevo objeto",
  reinos: "Nuevo reino",
  ciudades: "Nueva ciudad",
};

export function useCreateEntity() {
  const openEntity = useMundoNavigation((s) => s.openEntity);

  return useCallback(
    async (rawSection: string) => {
      const section = rawSection as SectionKey;
      const tabla = SECTION_TABLE[section];
      if (!tabla) return;

      const nombre = PLACEHOLDER_NAME[section] ?? "Nueva entrada";
      try {
        const { data, error } = await supabase
          .from(tabla)
          .insert([{ nombre }])
          .select()
          .single();
        if (error) throw error;
        openEntity(section, data.id);
      } catch (e) {
        console.error(`[useCreateEntity] error creando en '${tabla}':`, e);
      }
    },
    [openEntity],
  );
}
