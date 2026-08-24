"use client";

/**
 * useOrisConIums.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Fase 3 del rediseño 1.0 — Oris.
 *
 * Reemplaza a useOris() como fuente de lectura del catálogo: en vez de
 * confiar en oris.iums_composicion (jsonb, ahora @deprecated), trae
 * oris_iums (tabla relacional, ver migración fase3_oris_iums) y
 * RECONSTRUYE el campo iums_composicion con esos datos antes de devolver
 * cada Oris. Mismo criterio que useCompuestosConElementos.ts (Fase 2):
 * particulasDeOris() y contarLetrasDeOris() (fisica/types.ts) siguen
 * recibiendo el shape Record<string, number> tal cual lo esperan, así que
 * no hace falta tocarlas.
 *
 * iums_composicion (jsonb) NO se toca ni se lee más desde acá — queda
 * como respaldo crudo en Supabase.
 */

import { useMemo } from "react";

import { useSupabaseData } from "@/infra/sync/useSupabaseData";
import { supabase } from "@/infra/supabase/supabase";

import { useOris } from "./useFisica";
import { ORIS_IUMS_CONFIG, type Oris, type OrisIumRow } from "./types";

export function useOrisConIums() {
  const { items: orisBase, setItems: setOrisBase, loading: loadingBase } = useOris();
  // Fase 8: pasa por useSupabaseData → cache offline en Dexie
  // (oris_iums ya está en DEXIE_TABLES/OFFLINE_WRITABLE, v34).
  const {
    data: filas,
    loading: loadingFilas,
  } = useSupabaseData<OrisIumRow>(ORIS_IUMS_CONFIG.tabla, {
    select: ORIS_IUMS_CONFIG.select,
  });

  const composicionPorOris = useMemo(() => {
    const mapa = new Map<string, Record<string, number>>();
    for (const fila of filas) {
      const actual = mapa.get(fila.oris_id) ?? {};
      actual[fila.ium_id] = fila.cantidad;
      mapa.set(fila.oris_id, actual);
    }
    return mapa;
  }, [filas]);

  const items = useMemo<Oris[]>(() => {
    return orisBase.map((o) => ({
      ...o,
      iums_composicion: composicionPorOris.get(o.id) ?? {},
    }));
  }, [orisBase, composicionPorOris]);

  return {
    items,
    setItems: setOrisBase,
    loading: loadingBase || loadingFilas,
  };
}

// ─── Mutaciones de composición ─────────────────────────────────────────────
// Reemplazan a "actualizar oris.iums_composicion (jsonb)" — a partir de
// Fase 3, agregar/quitar/editar un Ium de un Oris escribe en oris_iums.

export async function sincronizarIumsDeOris(
  orisId: string,
  nuevaComposicion: Record<string, number>,
): Promise<boolean> {
  const { data: actuales, error: errorLectura } = await supabase
    .from(ORIS_IUMS_CONFIG.tabla)
    .select("ium_id, cantidad")
    .eq("oris_id", orisId);

  if (errorLectura) {
    console.error("[sincronizarIumsDeOris] error leyendo estado actual:", errorLectura);
    return false;
  }

  const actualesPorIum = new Map((actuales ?? []).map((r) => [r.ium_id, r.cantidad]));
  const nuevosIds = Object.keys(nuevaComposicion);

  const aQuitar = [...actualesPorIum.keys()].filter((id) => !nuevosIds.includes(id));
  const aUpsertear = nuevosIds.filter(
    (id) => actualesPorIum.get(id) !== nuevaComposicion[id],
  );

  if (aQuitar.length > 0) {
    const { error } = await supabase
      .from(ORIS_IUMS_CONFIG.tabla)
      .delete()
      .eq("oris_id", orisId)
      .in("ium_id", aQuitar);
    if (error) {
      console.error("[sincronizarIumsDeOris] error quitando:", error);
      return false;
    }
  }

  if (aUpsertear.length > 0) {
    const { error } = await supabase.from(ORIS_IUMS_CONFIG.tabla).upsert(
      aUpsertear.map((iumId) => ({
        oris_id: orisId,
        ium_id: iumId,
        cantidad: nuevaComposicion[iumId],
      })),
      { onConflict: "oris_id,ium_id" },
    );
    if (error) {
      console.error("[sincronizarIumsDeOris] error upserteando:", error);
      return false;
    }
  }

  return true;
}
