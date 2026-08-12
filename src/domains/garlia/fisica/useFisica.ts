"use client";

/**
 * useFisica.ts
 * ────────────────────────
 * Datos de la tab "Física": los 9 Oris + los bloques de conceptos, cada uno
 * en su propia tabla Supabase ("oris", "fisica_conceptos"). Mismo patrón
 * que useElementos.ts — useSupabaseData con select fijo y orden por
 * "orden".
 */

import { useMemo } from "react";

import { useSupabaseData } from "@/infra/sync/useSupabaseData";

import {
  FISICA_CONCEPTOS_CONFIG,
  ORIS_CONFIG,
  PARTICULAS_CONFIG,
  type FisicaConcepto,
  type Oris,
  type Particula,
} from "./types";

export function useParticulas() {
  const { data, setData, loading } = useSupabaseData<Particula>(PARTICULAS_CONFIG.tabla, {
    select: PARTICULAS_CONFIG.select,
    order: { campo: "orden" },
  });

  const items = useMemo(() => data, [data]);

  return { items, setItems: setData, loading };
}

export function useOris() {
  const { data, setData, loading } = useSupabaseData<Oris>(ORIS_CONFIG.tabla, {
    select: ORIS_CONFIG.select,
    order: { campo: "orden" },
  });

  const items = useMemo(() => data, [data]);

  return { items, setItems: setData, loading };
}

export function useFisicaConceptos() {
  const { data, setData, loading } = useSupabaseData<FisicaConcepto>(
    FISICA_CONCEPTOS_CONFIG.tabla,
    {
      select: FISICA_CONCEPTOS_CONFIG.select,
      order: { campo: "orden" },
    },
  );

  const items = useMemo(() => data, [data]);

  return { items, setItems: setData, loading };
}
