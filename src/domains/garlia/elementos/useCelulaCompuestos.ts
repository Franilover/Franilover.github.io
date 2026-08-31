"use client";

/**
 * useCelulaCompuestos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Resuelve los Compuestos vinculados a UNA Célula — tabla puente
 * `celula_compuestos` (nueva, migración ago-2026, reemplaza a la vieja
 * `celulas.compuesto_id` 1:1). De qué materiales está hecha la célula misma
 * (membrana, citoplasma, matriz interna, etc.) — una Célula real puede usar
 * varios Compuestos a la vez, no uno solo.
 *
 * @deprecated celula_compuestos quedó vacía (0 filas) desde la migración de
 * estructuras — la fuente de verdad pasó a ser celula_estructuras (ver
 * useCelulaEstructuras.ts). Se conserva y se le agrega cache Dexie por
 * completitud porque useOrganoTejidos.ts todavía la usa vía
 * CONFIG_CELULA_COMPUESTOS (agregarCompuesto → crea el vínculo acá).
 *
 * v42: cache-first vía Dexie, mismo patrón que useSistemaOrganos.ts
 * (celula_compuestos ya está en DEXIE_TABLES).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";
import { db } from "@/infra/supabase/db";

import {
  CONFIG_CELULA_COMPUESTOS,
  CONFIG_COMPUESTOS,
  type CelulaCompuesto,
  type Compuesto,
} from "@/domains/garlia/elementos/types";

// ── Cache-first: leer/escribir Dexie ───────────────────────────────────────
async function leerVinculosDeDexie(celulaId: string): Promise<CelulaCompuesto[]> {
  try {
    if (!db) return [];
    const rows = await db.celula_compuestos
      .where("celula_id")
      .equals(celulaId)
      .toArray();
    return rows as unknown as CelulaCompuesto[];
  } catch {
    return [];
  }
}

async function leerCompuestosDeDexie(ids: string[]): Promise<Record<string, Compuesto>> {
  const out: Record<string, Compuesto> = {};
  if (!db || ids.length === 0) return out;
  try {
    const rows = await db.compuestos.bulkGet(ids);
    for (const r of rows) if (r) out[(r as unknown as Compuesto).id] = r as unknown as Compuesto;
  } catch {}
  return out;
}

async function guardarEnDexie(vinculos: CelulaCompuesto[], compuestos: Compuesto[]) {
  try {
    if (!db) return;
    if (vinculos.length) await db.celula_compuestos.bulkPut(vinculos as any[]);
    if (compuestos.length) await db.compuestos.bulkPut(compuestos as any[]);
  } catch (e) {
    console.warn("[useCelulaCompuestos] no se pudo guardar en Dexie:", e);
  }
}

export interface CompuestoDeCelula {
  vinculo_id: string;
  celula_id: string;
  compuesto_id: string;
  rol: string | null;
  proporcion: string | null;
  compuesto: Compuesto;
}

export function useCelulaCompuestos(celulaId: string | null) {
  const [vinculos, setVinculos] = useState<CelulaCompuesto[]>([]);
  const [compuestos, setCompuestos] = useState<Record<string, Compuesto>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!celulaId) {
      setVinculos([]);
      setCompuestos({});
      setLoading(false);
      return;
    }

    // ── Paso 1: pintar de inmediato con lo que ya haya en Dexie ──────────
    const vinculosLocales = await leerVinculosDeDexie(celulaId);
    if (vinculosLocales.length > 0) {
      setVinculos(vinculosLocales);
      const compuestoIdsLocales = vinculosLocales.map((v) => v.compuesto_id);
      const compuestosLocales = await leerCompuestosDeDexie(compuestoIdsLocales);
      setCompuestos(compuestosLocales);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // ── Paso 2: revalidar contra Supabase en segundo plano ────────────────
    const { data: vinculoData, error: vinculoError } = await supabase
      .from(CONFIG_CELULA_COMPUESTOS.tabla)
      .select(CONFIG_CELULA_COMPUESTOS.select)
      .eq("celula_id", celulaId)
      .order("created_at", { ascending: true });

    if (vinculoError || !vinculoData) {
      if (vinculosLocales.length === 0) {
        setVinculos([]);
        setCompuestos({});
      }
      setLoading(false);
      return;
    }
    setVinculos(vinculoData as unknown as CelulaCompuesto[]);

    const compuestoIds = (vinculoData as unknown as CelulaCompuesto[]).map((v) => v.compuesto_id);
    if (compuestoIds.length === 0) {
      setCompuestos({});
      setLoading(false);
      void guardarEnDexie(vinculoData as unknown as CelulaCompuesto[], []);
      return;
    }

    const { data: compuestoData } = await supabase
      .from(CONFIG_COMPUESTOS.tabla)
      .select(CONFIG_COMPUESTOS.select)
      .in("id", compuestoIds);

    const compuestosPorId: Record<string, Compuesto> = {};
    for (const c of (compuestoData ?? []) as unknown as Compuesto[]) compuestosPorId[c.id] = c;
    setCompuestos(compuestosPorId);
    setLoading(false);
    void guardarEnDexie(
      vinculoData as unknown as CelulaCompuesto[],
      Object.values(compuestosPorId),
    );
  }, [celulaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<CompuestoDeCelula[]>(() => {
    return vinculos
      .map((v) => {
        const compuesto = compuestos[v.compuesto_id];
        if (!compuesto) return null;
        return {
          vinculo_id: v.id,
          celula_id: v.celula_id,
          compuesto_id: v.compuesto_id,
          rol: v.rol,
          proporcion: v.proporcion,
          compuesto,
        };
      })
      .filter((c): c is CompuestoDeCelula => c !== null);
  }, [vinculos, compuestos]);

  const vincularExistente = useCallback(
    async (compuestoId: string, rol?: string) => {
      if (!celulaId) return null;
      const { data: vinculo, error } = await supabase
        .from(CONFIG_CELULA_COMPUESTOS.tabla)
        .insert([{ celula_id: celulaId, compuesto_id: compuestoId, rol: rol ?? null }])
        .select()
        .single();
      if (error || !vinculo) return null;

      if (!compuestos[compuestoId]) {
        const { data: compuestoData } = await supabase
          .from(CONFIG_COMPUESTOS.tabla)
          .select(CONFIG_COMPUESTOS.select)
          .eq("id", compuestoId)
          .single();
        if (compuestoData) {
          const compuesto = compuestoData as unknown as Compuesto;
          setCompuestos((prev) => ({ ...prev, [compuestoId]: compuesto }));
          void guardarEnDexie([], [compuesto]);
        }
      }
      setVinculos((prev) => [...prev, vinculo as unknown as CelulaCompuesto]);
      void guardarEnDexie([vinculo as unknown as CelulaCompuesto], []);
      return vinculo as unknown as CelulaCompuesto;
    },
    [celulaId, compuestos],
  );

  const actualizarRol = useCallback(async (vinculoId: string, rol: string) => {
    setVinculos((prev) => {
      const next = prev.map((v) => (v.id === vinculoId ? { ...v, rol } : v));
      void guardarEnDexie(next.filter((v) => v.id === vinculoId), []);
      return next;
    });
    const { error } = await supabase
      .from(CONFIG_CELULA_COMPUESTOS.tabla)
      .update({ rol })
      .eq("id", vinculoId);
    if (error) console.error("[useCelulaCompuestos] error actualizando rol:", error);
  }, []);

  const actualizarProporcion = useCallback(async (vinculoId: string, proporcion: string) => {
    setVinculos((prev) => {
      const next = prev.map((v) => (v.id === vinculoId ? { ...v, proporcion } : v));
      void guardarEnDexie(next.filter((v) => v.id === vinculoId), []);
      return next;
    });
    const { error } = await supabase
      .from(CONFIG_CELULA_COMPUESTOS.tabla)
      .update({ proporcion })
      .eq("id", vinculoId);
    if (error) console.error("[useCelulaCompuestos] error actualizando proporción:", error);
  }, []);

  const quitar = useCallback(async (vinculoId: string) => {
    setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
    try {
      if (db) await db.celula_compuestos.delete(vinculoId);
    } catch {}
    const { error } = await supabase.from(CONFIG_CELULA_COMPUESTOS.tabla).delete().eq("id", vinculoId);
    if (error) console.error("[useCelulaCompuestos] error quitando vínculo:", error);
  }, []);

  return { items, loading, vincularExistente, actualizarRol, actualizarProporcion, quitar, load };
}
