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
  IUMS_CONFIG,
  ORIS_CONFIG,
  PARTICULAS_BASE_CONFIG,
  PARTICULAS_CONFIG,
  type FisicaConcepto,
  type Ium,
  type Oris,
  type Particula,
  type ParticulaBase,
} from "./types";

export function useParticulasBase() {
  const { data, setData, loading } = useSupabaseData<ParticulaBase>(PARTICULAS_BASE_CONFIG.tabla, {
    select: PARTICULAS_BASE_CONFIG.select,
    order: { campo: "orden" },
  });

  const items = useMemo(() => data, [data]);

  return { items, setItems: setData, loading };
}

export function useIums() {
  const { data, setData, loading } = useSupabaseData<Ium>(IUMS_CONFIG.tabla, {
    select: IUMS_CONFIG.select,
    order: { campo: "orden" },
  });

  const items = useMemo(() => data, [data]);

  return { items, setItems: setData, loading };
}

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
