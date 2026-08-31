"use client";

/**
 * useTejidoCompuestos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Resuelve los Compuestos vinculados directamente a UN Tejido — tabla puente
 * `tejido_compuestos` (nueva, migración ago-2026). Representa material de
 * matriz/estructura del tejido que NO pasa por ninguna Célula (ej. la parte
 * mineral de la matriz ósea, a diferencia del Osteocito que sí es celular).
 * Hermano de useTejidoCelulas.ts — mismo patrón.
 *
 * v42: cache-first vía Dexie, mismo patrón que useOrganoTejidos.ts /
 * useSistemaOrganos.ts (tejido_compuestos ya está en DEXIE_TABLES).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";
import { db } from "@/infra/supabase/db";

import {
  CONFIG_COMPUESTOS,
  CONFIG_TEJIDO_COMPUESTOS,
  type Compuesto,
  type TejidoCompuesto,
} from "@/domains/garlia/elementos/types";

// ── Cache-first: leer/escribir Dexie ───────────────────────────────────────
async function leerVinculosDeDexie(tejidoId: string): Promise<TejidoCompuesto[]> {
  try {
    if (!db) return [];
    const rows = await db.tejido_compuestos
      .where("tejido_id")
      .equals(tejidoId)
      .toArray();
    return rows as unknown as TejidoCompuesto[];
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

async function guardarEnDexie(vinculos: TejidoCompuesto[], compuestos: Compuesto[]) {
  try {
    if (!db) return;
    if (vinculos.length) await db.tejido_compuestos.bulkPut(vinculos as any[]);
    if (compuestos.length) await db.compuestos.bulkPut(compuestos as any[]);
  } catch (e) {
    console.warn("[useTejidoCompuestos] no se pudo guardar en Dexie:", e);
  }
}

export interface CompuestoDeTejido {
  vinculo_id: string;
  tejido_id: string;
  compuesto_id: string;
  rol: string | null;
  proporcion: string | null;
  compuesto: Compuesto;
}

export function useTejidoCompuestos(tejidoId: string | null) {
  const [vinculos, setVinculos] = useState<TejidoCompuesto[]>([]);
  const [compuestos, setCompuestos] = useState<Record<string, Compuesto>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tejidoId) {
      setVinculos([]);
      setCompuestos({});
      setLoading(false);
      return;
    }

    // ── Paso 1: pintar de inmediato con lo que ya haya en Dexie ──────────
    const vinculosLocales = await leerVinculosDeDexie(tejidoId);
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
      .from(CONFIG_TEJIDO_COMPUESTOS.tabla)
      .select(CONFIG_TEJIDO_COMPUESTOS.select)
      .eq("tejido_id", tejidoId)
      .order("created_at", { ascending: true });

    if (vinculoError || !vinculoData) {
      if (vinculosLocales.length === 0) {
        setVinculos([]);
        setCompuestos({});
      }
      setLoading(false);
      return;
    }
    setVinculos(vinculoData as unknown as TejidoCompuesto[]);

    const compuestoIds = (vinculoData as unknown as TejidoCompuesto[]).map((v) => v.compuesto_id);
    if (compuestoIds.length === 0) {
      setCompuestos({});
      setLoading(false);
      void guardarEnDexie(vinculoData as unknown as TejidoCompuesto[], []);
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
      vinculoData as unknown as TejidoCompuesto[],
      Object.values(compuestosPorId),
    );
  }, [tejidoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<CompuestoDeTejido[]>(() => {
    return vinculos
      .map((v) => {
        const compuesto = compuestos[v.compuesto_id];
        if (!compuesto) return null;
        return {
          vinculo_id: v.id,
          tejido_id: v.tejido_id,
          compuesto_id: v.compuesto_id,
          rol: v.rol,
          proporcion: v.proporcion,
          compuesto,
        };
      })
      .filter((c): c is CompuestoDeTejido => c !== null);
  }, [vinculos, compuestos]);

  const vincularExistente = useCallback(
    async (compuestoId: string, rol?: string) => {
      if (!tejidoId) return null;
      const { data: vinculo, error } = await supabase
        .from(CONFIG_TEJIDO_COMPUESTOS.tabla)
        .insert([{ tejido_id: tejidoId, compuesto_id: compuestoId, rol: rol ?? null }])
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
      setVinculos((prev) => [...prev, vinculo as unknown as TejidoCompuesto]);
      void guardarEnDexie([vinculo as unknown as TejidoCompuesto], []);
      return vinculo as unknown as TejidoCompuesto;
    },
    [tejidoId, compuestos],
  );

  const actualizarRol = useCallback(async (vinculoId: string, rol: string) => {
    setVinculos((prev) => {
      const next = prev.map((v) => (v.id === vinculoId ? { ...v, rol } : v));
      void guardarEnDexie(next.filter((v) => v.id === vinculoId), []);
      return next;
    });
    const { error } = await supabase
      .from(CONFIG_TEJIDO_COMPUESTOS.tabla)
      .update({ rol })
      .eq("id", vinculoId);
    if (error) console.error("[useTejidoCompuestos] error actualizando rol:", error);
  }, []);

  const actualizarProporcion = useCallback(async (vinculoId: string, proporcion: string) => {
    setVinculos((prev) => {
      const next = prev.map((v) => (v.id === vinculoId ? { ...v, proporcion } : v));
      void guardarEnDexie(next.filter((v) => v.id === vinculoId), []);
      return next;
    });
    const { error } = await supabase
      .from(CONFIG_TEJIDO_COMPUESTOS.tabla)
      .update({ proporcion })
      .eq("id", vinculoId);
    if (error) console.error("[useTejidoCompuestos] error actualizando proporción:", error);
  }, []);

  const quitar = useCallback(async (vinculoId: string) => {
    setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
    try {
      if (db) await db.tejido_compuestos.delete(vinculoId);
    } catch {}
    const { error } = await supabase.from(CONFIG_TEJIDO_COMPUESTOS.tabla).delete().eq("id", vinculoId);
    if (error) console.error("[useTejidoCompuestos] error quitando vínculo:", error);
  }, []);

  return { items, loading, vincularExistente, actualizarRol, actualizarProporcion, quitar, load };
}
