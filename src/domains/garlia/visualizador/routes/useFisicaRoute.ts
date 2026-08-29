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

import { useEffect, useMemo, useState } from "react";

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

  // orisSelId ahora SIEMPRE se fija a un id concreto en cuanto hay datos
  // (ver efecto abajo), nunca se deja en null "de forma permanente" salvo
  // mientras oris todavía no cargó. Esto es lo que corrige el bug de
  // "cambia de Oris solo": antes, mientras el usuario no clickeaba un
  // chip, orisSel se recalculaba en CADA render como oris[0] — así que
  // cualquier refetch/remount que reemplazara el array `oris` por una
  // nueva referencia (aunque el contenido lógico fuera el mismo) podía
  // hacer que, momentáneamente, oris[0] no fuera el mismo Oris que el
  // usuario venía viendo (ej. mientras Dexie/offline sync repobla la
  // lista en varios pasos). Al fijar el id explícitamente una sola vez
  // (con `useEffect`, no en cada render), la selección deja de depender
  // de la identidad del array en renders posteriores.
  const [orisSelId, setOrisSelId] = useState<string | null>(null);
  const [iumSelId, setIumSelId] = useState<string | null>(null);

  const loading = loadingIums || loadingOris;

  useEffect(() => {
    if (oris.length === 0) return;
    const sigueExistiendo = orisSelId !== null && oris.some((o) => o.id === orisSelId);
    if (!sigueExistiendo) {
      // Cubre dos casos con la misma regla: (1) todavía no hay selección
      // (orisSelId null) y (2) el Oris que el usuario tenía elegido fue
      // eliminado/dejó de venir en la lista — en ambos, se fija de forma
      // explícita al primero disponible, UNA vez, no en cada render.
      setOrisSelId(oris[0].id);
    }
  }, [oris, orisSelId]);

  const iumPorId = useMemo(() => {
    const mapa: Record<string, FilaIum> = {};
    for (const i of iums) mapa[i.id] = iumAFilaIum(i);
    return mapa;
  }, [iums]);

  const orisSel = useMemo(
    () => oris.find((o) => o.id === orisSelId) ?? null,
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
