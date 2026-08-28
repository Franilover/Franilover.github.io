"use client";

/**
 * useFisicaRoute.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Perspectiva FÍSICA del Visualizador: Partícula (A/T/S) → IUM → Oris.
 *
 * Esto es una ruta distinta de la perspectiva ALQUÍMICA (useAlquimiaRoute.ts,
 * Partícula química → capa → Elemento). Ambas comparten el vocabulario base
 * de 11 Partículas de Química, pero NO son el mismo camino y este hook no
 * las mezcla — ver PerspectivaSwitcher.tsx.
 *
 * Cero matemática nueva: reusa tal cual
 *   - useIums() / useOrisConIums() (fisica/useFisica.ts, fisica/useOrisConIums.ts)
 *   - particulasDeIum, contarLetrasDeIum, particulasDeOris, contarLetrasDeOris
 *     (fisica/types.ts)
 * Este archivo solo selecciona un Oris/Ium activo y arma el shape que
 * StructureCanvas/Inspector/TraceView necesitan para pintarlo.
 */

import { useMemo, useState } from "react";

import { useIums } from "@/domains/garlia/fisica/useFisica";
import { useOrisConIums } from "@/domains/garlia/fisica/useOrisConIums";
import {
  contarLetrasDeIum,
  contarLetrasDeOris,
  iumAFilaIum,
  particulasDeIum,
  particulasDeOris,
  type FilaIum,
  type Ium,
  type Oris,
} from "@/domains/garlia/fisica/types";

export interface FisicaRouteState {
  loading: boolean;
  empty: boolean;
  /** Siempre null hoy: useIums()/useOrisConIums() (fisica/useFisica.ts,
   *  fisica/useOrisConIums.ts) no propagan el error de useSupabaseData
   *  hacia afuera — es un patrón compartido por esos hooks y por otros
   *  consumidores fuera de visualizador/ (FisicaPage, etc.), así que no
   *  se corrige acá para no arriesgar romper esas 12+ secciones. Riesgo
   *  documentado, no resuelto — ver auditoría VIS-01. */
  error: null;

  iums: Ium[];
  oris: Oris[];

  orisSel: Oris | null;
  setOrisSelId: (id: string | null) => void;

  iumSel: Ium | null;
  setIumSelId: (id: string | null) => void;

  iumPorId: Record<string, FilaIum>;

  /** Partículas reales (expandidas) del Ium seleccionado — nivel intermedio. */
  particulasDelIumSel: { nombre: string; formula: string }[];
  /** Conteo A/T/S del Ium seleccionado. */
  letrasIumSel: { A: number; T: number; S: number };

  /** Partículas reales (expandidas) del Oris seleccionado, vía sus IUMs. */
  particulasDelOrisSel: { nombre: string; formula: string }[];
  /** Conteo A/T/S del Oris seleccionado. */
  letrasOrisSel: { A: number; T: number; S: number };
}

export function useFisicaRoute(): FisicaRouteState {
  const { items: iums, loading: loadingIums } = useIums();
  const { items: oris, loading: loadingOris } = useOrisConIums();

  const [orisSelId, setOrisSelId] = useState<string | null>(null);
  const [iumSelId, setIumSelId] = useState<string | null>(null);

  const loading = loadingIums || loadingOris;

  const iumPorId = useMemo(() => {
    const mapa: Record<string, FilaIum> = {};
    for (const i of iums) mapa[i.id] = iumAFilaIum(i);
    return mapa;
  }, [iums]);

  const orisSel = useMemo(
    () => (orisSelId ? oris.find((o) => o.id === orisSelId) ?? null : oris[0] ?? null),
    [oris, orisSelId],
  );

  const iumSel = useMemo(
    () => (iumSelId ? iums.find((i) => i.id === iumSelId) ?? null : null),
    [iums, iumSelId],
  );

  const particulasDelIumSel = useMemo(
    () => (iumSel ? particulasDeIum(iumAFilaIum(iumSel)) : []),
    [iumSel],
  );

  const letrasIumSel = useMemo(
    () => (iumSel ? contarLetrasDeIum(iumAFilaIum(iumSel)) : { A: 0, T: 0, S: 0 }),
    [iumSel],
  );

  const particulasDelOrisSel = useMemo(
    () => (orisSel ? particulasDeOris(orisSel.iums_composicion, iumPorId) : []),
    [orisSel, iumPorId],
  );

  const letrasOrisSel = useMemo(
    () => (orisSel ? contarLetrasDeOris(orisSel.iums_composicion, iumPorId) : { A: 0, T: 0, S: 0 }),
    [orisSel, iumPorId],
  );

  return {
    loading,
    empty: !loading && oris.length === 0,
    error: null,
    iums,
    oris,
    orisSel,
    setOrisSelId,
    iumSel,
    setIumSelId,
    iumPorId,
    particulasDelIumSel,
    letrasIumSel,
    particulasDelOrisSel,
    letrasOrisSel,
  };
}
