"use client";

/**
 * useFormacionVetas.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Espejo de useOrganoTejidos.ts (cache-first vía Dexie, ver ese archivo para
 * el razonamiento completo). Cadena real en Supabase:
 *   Formacion → formacion_vetas (proporcion) → Veta → Grano → Compuesto
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";
import { db } from "@/infra/supabase/db";

import {
  CONFIG_GRANOS,
  CONFIG_VETAS,
  type FormacionVeta,
  type Grano,
  type Veta,
} from "@/domains/garlia/elementos/types";

// ── Cache-first: leer/escribir Dexie para formacion_vetas/vetas/granos ────
async function leerVinculosDeDexie(formacionId: string): Promise<FormacionVeta[]> {
  try {
    if (!db) return [];
    const rows = await db.formacion_vetas
      .where("formacion_id")
      .equals(formacionId)
      .toArray();
    return rows as unknown as FormacionVeta[];
  } catch {
    return [];
  }
}

async function leerVetasDeDexie(ids: string[]): Promise<Record<string, Veta>> {
  const out: Record<string, Veta> = {};
  if (!db || ids.length === 0) return out;
  try {
    const rows = await db.vetas.bulkGet(ids);
    for (const r of rows) if (r) out[(r as unknown as Veta).id] = r as unknown as Veta;
  } catch {}
  return out;
}

async function leerGranosDeDexie(ids: string[]): Promise<Record<string, Grano>> {
  const out: Record<string, Grano> = {};
  if (!db || ids.length === 0) return out;
  try {
    const rows = await db.granos.bulkGet(ids);
    for (const r of rows) if (r) out[(r as unknown as Grano).id] = r as unknown as Grano;
  } catch {}
  return out;
}

async function guardarEnDexie(
  vinculos: FormacionVeta[],
  vetas: Veta[],
  granos: Grano[],
) {
  try {
    if (!db) return;
    if (vinculos.length) await db.formacion_vetas.bulkPut(vinculos as any[]);
    if (vetas.length) await db.vetas.bulkPut(vetas as any[]);
    if (granos.length) await db.granos.bulkPut(granos as any[]);
  } catch (e) {
    console.warn("[useFormacionVetas] no se pudo guardar en Dexie:", e);
  }
}

/** Una fila de la fórmula de una Formación, ya resuelta: vínculo + veta + grano. */
export interface VetaDeFormacion {
  /** Id de la fila puente formacion_vetas — necesario para desvincular. */
  vinculo_id: string;
  formacion_id: string;
  veta_id: string;
  /** Alias de veta_id — mismo campo que espera FilaFormulaTejido para
   *  no reofrecer esta Veta en el picker de "usar existente". */
  tejido_o_veta_id: string;
  grano_id: string | null;
  /** Alias de grano_id — id de catálogo donde vive compuesto_id (shape
   *  compartido con TejidoDeOrgano, ver FilaFormulaTejido). */
  catalogo_id: string | null;
  /** Nombre propio del Grano (columna `nombre` de la tabla granos) — lo
   *  que debe mostrar la fila "hecho de", NO el nombre del Compuesto: la
   *  cadena real es Veta → Grano → Compuesto, y la fila de fórmula no
   *  debe saltearse el nivel Grano. */
  catalogo_nombre: string | null;
  proporcion: string | null;
  nombre: string;
  funcion: string | null;
  notas: string | null;
  compuesto_id: string | null;
}

export function useFormacionVetas(formacionId: string | null) {
  const [vinculos, setVinculos] = useState<FormacionVeta[]>([]);
  const [vetas, setVetas] = useState<Record<string, Veta>>({});
  const [granos, setGranos] = useState<Record<string, Grano>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!formacionId) {
      setVinculos([]);
      setVetas({});
      setGranos({});
      setLoading(false);
      return;
    }

    // ── Paso 1: pintar de inmediato con lo que ya haya en Dexie ──────────
    const vinculosLocales = await leerVinculosDeDexie(formacionId);
    if (vinculosLocales.length > 0) {
      setVinculos(vinculosLocales);
      const vetaIdsLocales = vinculosLocales.map((v) => v.veta_id);
      const vetasLocales = await leerVetasDeDexie(vetaIdsLocales);
      setVetas(vetasLocales);
      const granoIdsLocales = Object.values(vetasLocales)
        .map((v) => v.grano_id)
        .filter((id): id is string => !!id);
      const granosLocales = await leerGranosDeDexie(granoIdsLocales);
      setGranos(granosLocales);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // ── Paso 2: revalidar contra Supabase en segundo plano ────────────────
    const { data: vinculoData, error: vinculoError } = await supabase
      .from("formacion_vetas")
      .select("*")
      .eq("formacion_id", formacionId)
      .order("created_at", { ascending: true });

    if (vinculoError || !vinculoData) {
      if (vinculosLocales.length === 0) setVinculos([]);
      setLoading(false);
      return;
    }
    setVinculos(vinculoData as FormacionVeta[]);

    const vetaIds = (vinculoData as FormacionVeta[]).map((v) => v.veta_id);
    if (vetaIds.length === 0) {
      setVetas({});
      setGranos({});
      setLoading(false);
      void guardarEnDexie(vinculoData as FormacionVeta[], [], []);
      return;
    }

    const { data: vetaData } = await supabase
      .from(CONFIG_VETAS.tabla)
      .select(CONFIG_VETAS.select)
      .in("id", vetaIds);

    const vetasPorId: Record<string, Veta> = {};
    for (const v of (vetaData ?? []) as unknown as Veta[]) vetasPorId[v.id] = v;
    setVetas(vetasPorId);

    const granoIds = Object.values(vetasPorId)
      .map((v) => v.grano_id)
      .filter((id): id is string => !!id);

    if (granoIds.length === 0) {
      setGranos({});
      setLoading(false);
      void guardarEnDexie(vinculoData as FormacionVeta[], Object.values(vetasPorId), []);
      return;
    }

    const { data: granoData } = await supabase
      .from(CONFIG_GRANOS.tabla)
      .select(CONFIG_GRANOS.select)
      .in("id", granoIds);

    const granosPorId: Record<string, Grano> = {};
    for (const g of (granoData ?? []) as unknown as Grano[]) granosPorId[g.id] = g;
    setGranos(granosPorId);

    setLoading(false);
    void guardarEnDexie(
      vinculoData as FormacionVeta[],
      Object.values(vetasPorId),
      Object.values(granosPorId),
    );
  }, [formacionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<VetaDeFormacion[]>(() => {
    return vinculos
      .map((v) => {
        const veta = vetas[v.veta_id];
        if (!veta) return null;
        const grano = veta.grano_id ? granos[veta.grano_id] : undefined;
        return {
          vinculo_id: v.id,
          formacion_id: v.formacion_id,
          veta_id: v.veta_id,
          tejido_o_veta_id: v.veta_id,
          grano_id: veta.grano_id,
          catalogo_id: veta.grano_id,
          catalogo_nombre: grano?.nombre ?? null,
          proporcion: v.proporcion,
          nombre: veta.nombre,
          funcion: veta.funcion,
          notas: veta.notas,
          compuesto_id: grano?.compuesto_id ?? null,
        };
      })
      .filter((v): v is VetaDeFormacion => v !== null);
  }, [vinculos, vetas, granos]);

  const agregarCompuesto = useCallback(
    async (compuestoId: string) => {
      if (!formacionId) return null;

      const { data: nuevoGrano, error: errorGrano } = await supabase
        .from(CONFIG_GRANOS.tabla)
        .insert([{ nombre: "", compuesto_id: compuestoId, estructura: [] }])
        .select()
        .single();
      if (errorGrano || !nuevoGrano) return null;

      const { data: nuevaVeta, error: errorVeta } = await supabase
        .from(CONFIG_VETAS.tabla)
        .insert([{ nombre: "", grano_id: (nuevoGrano as Grano).id, estructura: [] }])
        .select()
        .single();
      if (errorVeta || !nuevaVeta) return null;

      const { data: vinculo, error: errorVinculo } = await supabase
        .from("formacion_vetas")
        .insert([{ formacion_id: formacionId, veta_id: (nuevaVeta as Veta).id }])
        .select()
        .single();
      if (errorVinculo || !vinculo) return null;

      setVetas((prev) => ({ ...prev, [(nuevaVeta as Veta).id]: nuevaVeta as Veta }));
      setGranos((prev) => ({ ...prev, [(nuevoGrano as Grano).id]: nuevoGrano as Grano }));
      setVinculos((prev) => [...prev, vinculo as FormacionVeta]);
      void guardarEnDexie([vinculo as FormacionVeta], [nuevaVeta as Veta], [nuevoGrano as Grano]);
      return vinculo as FormacionVeta;
    },
    [formacionId],
  );

  // ── Crear una Veta nueva en el catálogo global (con nombre, sin Grano
  // todavía) y vincularla de una — flujo "Agregar" unificado con reutilizar,
  // contraparte de vincularExistente cuando la Veta buscada no existe. ──
  const crearYVincular = useCallback(
    async (nombre: string) => {
      if (!formacionId) return null;

      const { data: nuevaVeta, error: errorVeta } = await supabase
        .from(CONFIG_VETAS.tabla)
        .insert([{ nombre, grano_id: null, estructura: [] }])
        .select()
        .single();
      if (errorVeta || !nuevaVeta) return null;

      const veta = nuevaVeta as Veta;
      setVetas((prev) => ({ ...prev, [veta.id]: veta }));
      void guardarEnDexie([], [veta], []);

      const { data: vinculo, error: errorVinculo } = await supabase
        .from("formacion_vetas")
        .insert([{ formacion_id: formacionId, veta_id: veta.id }])
        .select()
        .single();
      if (errorVinculo || !vinculo) return null;

      setVinculos((prev) => [...prev, vinculo as FormacionVeta]);
      void guardarEnDexie([vinculo as FormacionVeta], [], []);
      return vinculo as FormacionVeta;
    },
    [formacionId],
  );

  // ── Vincular una Veta YA EXISTENTE (de cualquier otra Formación) sin
  // crear Grano/Veta nuevos — reutilización real, contraparte de agregarCompuesto.
  const vincularExistente = useCallback(
    async (vetaId: string) => {
      if (!formacionId) return null;

      const { data: vinculo, error: errorVinculo } = await supabase
        .from("formacion_vetas")
        .insert([{ formacion_id: formacionId, veta_id: vetaId }])
        .select()
        .single();
      if (errorVinculo || !vinculo) return null;

      if (!vetas[vetaId]) {
        const { data: vetaData } = await supabase
          .from(CONFIG_VETAS.tabla)
          .select(CONFIG_VETAS.select)
          .eq("id", vetaId)
          .single();
        if (vetaData) {
          const veta = vetaData as unknown as Veta;
          setVetas((prev) => ({ ...prev, [veta.id]: veta }));
          void guardarEnDexie([], [veta], []);
          if (veta.grano_id && !granos[veta.grano_id]) {
            const { data: granoData } = await supabase
              .from(CONFIG_GRANOS.tabla)
              .select(CONFIG_GRANOS.select)
              .eq("id", veta.grano_id)
              .single();
            if (granoData) {
              const grano = granoData as unknown as Grano;
              setGranos((prev) => ({ ...prev, [grano.id]: grano }));
              void guardarEnDexie([], [], [grano]);
            }
          }
        }
      }

      setVinculos((prev) => [...prev, vinculo as FormacionVeta]);
      void guardarEnDexie([vinculo as FormacionVeta], [], []);
      return vinculo as FormacionVeta;
    },
    [formacionId, vetas, granos],
  );

  const actualizarCompuesto = useCallback(async (granoId: string, compuestoId: string) => {
    setGranos((prev) => {
      if (!prev[granoId]) return prev;
      const actualizado = { ...prev[granoId], compuesto_id: compuestoId };
      void guardarEnDexie([], [], [actualizado]);
      return { ...prev, [granoId]: actualizado };
    });
    const { error } = await supabase
      .from(CONFIG_GRANOS.tabla)
      .update({ compuesto_id: compuestoId })
      .eq("id", granoId);
    if (error) console.error("[useFormacionVetas] error actualizando grano:", error);
  }, []);

  // ── Editar el nombre propio de la Veta (columna nombre de la tabla vetas,
  // distinta del Compuesto que la compone) ───────────────────────────────
  const actualizarNombre = useCallback(async (vetaId: string, nombre: string) => {
    setVetas((prev) => {
      if (!prev[vetaId]) return prev;
      const actualizada = { ...prev[vetaId], nombre };
      void guardarEnDexie([], [actualizada], []);
      return { ...prev, [vetaId]: actualizada };
    });
    const { error } = await supabase
      .from(CONFIG_VETAS.tabla)
      .update({ nombre })
      .eq("id", vetaId);
    if (error) console.error("[useFormacionVetas] error actualizando nombre de la veta:", error);
  }, []);

  const actualizarProporcion = useCallback(async (vinculoId: string, proporcion: string) => {
    setVinculos((prev) => {
      const next = prev.map((v) => (v.id === vinculoId ? { ...v, proporcion } : v));
      const actualizado = next.find((v) => v.id === vinculoId);
      if (actualizado) void guardarEnDexie([actualizado], [], []);
      return next;
    });
    const { error } = await supabase
      .from("formacion_vetas")
      .update({ proporcion })
      .eq("id", vinculoId);
    if (error) console.error("[useFormacionVetas] error actualizando proporción:", error);
  }, []);

  const quitarCompuesto = useCallback(async (vinculoId: string) => {
    setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
    try {
      if (db) await db.formacion_vetas.delete(vinculoId);
    } catch {}
    await supabase.from("formacion_vetas").delete().eq("id", vinculoId);
  }, []);

  return {
    items,
    loading,
    agregarCompuesto,
    vincularExistente,
    crearYVincular,
    actualizarCompuesto,
    actualizarNombre,
    actualizarProporcion,
    quitarCompuesto,
    load,
  };
}
