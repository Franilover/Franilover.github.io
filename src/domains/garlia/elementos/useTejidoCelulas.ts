"use client";

/**
 * useTejidoCelulas.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Resuelve las Células vinculadas a UN Tejido — tabla puente `tejido_celulas`
 * (M:N, migración ago-2026 que reemplazó a la vieja `tejidos.celula_id` 1:1).
 * Un Tejido puede tener varias Células (ej. varios tipos celulares que lo
 * pueblan) y una misma Célula puede aparecer en varios Tejidos.
 *
 * v42: cache-first vía Dexie, mismo patrón que useOrganoTejidos.ts /
 * useSistemaOrganos.ts (tejido_celulas ya está en DEXIE_TABLES).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";
import { db } from "@/infra/supabase/db";

import {
  CONFIG_CELULAS,
  CONFIG_TEJIDO_CELULAS,
  type Celula,
  type TejidoCelula,
} from "@/domains/garlia/elementos/types";

// ── Cache-first: leer/escribir Dexie ───────────────────────────────────────
async function leerVinculosDeDexie(tejidoId: string): Promise<TejidoCelula[]> {
  try {
    if (!db) return [];
    const rows = await db.tejido_celulas
      .where("tejido_id")
      .equals(tejidoId)
      .toArray();
    return rows as unknown as TejidoCelula[];
  } catch {
    return [];
  }
}

async function leerCelulasDeDexie(ids: string[]): Promise<Record<string, Celula>> {
  const out: Record<string, Celula> = {};
  if (!db || ids.length === 0) return out;
  try {
    const rows = await db.celulas.bulkGet(ids);
    for (const r of rows) if (r) out[(r as unknown as Celula).id] = r as unknown as Celula;
  } catch {}
  return out;
}

async function guardarEnDexie(vinculos: TejidoCelula[], celulas: Celula[]) {
  try {
    if (!db) return;
    if (vinculos.length) await db.tejido_celulas.bulkPut(vinculos as any[]);
    if (celulas.length) await db.celulas.bulkPut(celulas as any[]);
  } catch (e) {
    console.warn("[useTejidoCelulas] no se pudo guardar en Dexie:", e);
  }
}

/** Una fila resuelta: vínculo + Célula ya cargada, lista para la UI. */
export interface CelulaDeTejido {
  vinculo_id: string;
  tejido_id: string;
  celula_id: string;
  rol: string | null;
  proporcion: string | null;
  celula: Celula;
}

export function useTejidoCelulas(tejidoId: string | null) {
  const [vinculos, setVinculos] = useState<TejidoCelula[]>([]);
  const [celulas, setCelulas] = useState<Record<string, Celula>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tejidoId) {
      setVinculos([]);
      setCelulas({});
      setLoading(false);
      return;
    }

    // ── Paso 1: pintar de inmediato con lo que ya haya en Dexie ──────────
    const vinculosLocales = await leerVinculosDeDexie(tejidoId);
    if (vinculosLocales.length > 0) {
      setVinculos(vinculosLocales);
      const celulaIdsLocales = vinculosLocales.map((v) => v.celula_id);
      const celulasLocales = await leerCelulasDeDexie(celulaIdsLocales);
      setCelulas(celulasLocales);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // ── Paso 2: revalidar contra Supabase en segundo plano ────────────────
    const { data: vinculoData, error: vinculoError } = await supabase
      .from(CONFIG_TEJIDO_CELULAS.tabla)
      .select(CONFIG_TEJIDO_CELULAS.select)
      .eq("tejido_id", tejidoId)
      .order("created_at", { ascending: true });

    if (vinculoError || !vinculoData) {
      if (vinculosLocales.length === 0) {
        setVinculos([]);
        setCelulas({});
      }
      setLoading(false);
      return;
    }
    setVinculos(vinculoData as unknown as TejidoCelula[]);

    const celulaIds = (vinculoData as unknown as TejidoCelula[]).map((v) => v.celula_id);
    if (celulaIds.length === 0) {
      setCelulas({});
      setLoading(false);
      void guardarEnDexie(vinculoData as unknown as TejidoCelula[], []);
      return;
    }

    const { data: celulaData } = await supabase
      .from(CONFIG_CELULAS.tabla)
      .select(CONFIG_CELULAS.select)
      .in("id", celulaIds);

    const celulasPorId: Record<string, Celula> = {};
    for (const c of (celulaData ?? []) as unknown as Celula[]) celulasPorId[c.id] = c;
    setCelulas(celulasPorId);
    setLoading(false);
    void guardarEnDexie(
      vinculoData as unknown as TejidoCelula[],
      Object.values(celulasPorId),
    );
  }, [tejidoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<CelulaDeTejido[]>(() => {
    return vinculos
      .map((v) => {
        const celula = celulas[v.celula_id];
        if (!celula) return null;
        return {
          vinculo_id: v.id,
          tejido_id: v.tejido_id,
          celula_id: v.celula_id,
          rol: v.rol,
          proporcion: v.proporcion,
          celula,
        };
      })
      .filter((c): c is CelulaDeTejido => c !== null);
  }, [vinculos, celulas]);

  /** Vincular una Célula ya existente del catálogo a este Tejido. */
  const vincularExistente = useCallback(
    async (celulaId: string, rol?: string) => {
      if (!tejidoId) return null;
      const { data: vinculo, error } = await supabase
        .from(CONFIG_TEJIDO_CELULAS.tabla)
        .insert([{ tejido_id: tejidoId, celula_id: celulaId, rol: rol ?? null }])
        .select()
        .single();
      if (error || !vinculo) return null;

      if (!celulas[celulaId]) {
        const { data: celulaData } = await supabase
          .from(CONFIG_CELULAS.tabla)
          .select(CONFIG_CELULAS.select)
          .eq("id", celulaId)
          .single();
        if (celulaData) {
          const celula = celulaData as unknown as Celula;
          setCelulas((prev) => ({ ...prev, [celulaId]: celula }));
          void guardarEnDexie([], [celula]);
        }
      }
      setVinculos((prev) => [...prev, vinculo as unknown as TejidoCelula]);
      void guardarEnDexie([vinculo as unknown as TejidoCelula], []);
      return vinculo as unknown as TejidoCelula;
    },
    [tejidoId, celulas],
  );

  /** Editar el rol de una fila (ej. "célula principal", "matriz extracelular"). */
  const actualizarRol = useCallback(async (vinculoId: string, rol: string) => {
    setVinculos((prev) => {
      const next = prev.map((v) => (v.id === vinculoId ? { ...v, rol } : v));
      void guardarEnDexie(next.filter((v) => v.id === vinculoId), []);
      return next;
    });
    const { error } = await supabase
      .from(CONFIG_TEJIDO_CELULAS.tabla)
      .update({ rol })
      .eq("id", vinculoId);
    if (error) console.error("[useTejidoCelulas] error actualizando rol:", error);
  }, []);

  /** Editar la proporción de una fila. */
  const actualizarProporcion = useCallback(async (vinculoId: string, proporcion: string) => {
    setVinculos((prev) => {
      const next = prev.map((v) => (v.id === vinculoId ? { ...v, proporcion } : v));
      void guardarEnDexie(next.filter((v) => v.id === vinculoId), []);
      return next;
    });
    const { error } = await supabase
      .from(CONFIG_TEJIDO_CELULAS.tabla)
      .update({ proporcion })
      .eq("id", vinculoId);
    if (error) console.error("[useTejidoCelulas] error actualizando proporción:", error);
  }, []);

  /** Quitar el vínculo (la Célula queda en su catálogo, no se borra). */
  const quitar = useCallback(async (vinculoId: string) => {
    setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
    try {
      if (db) await db.tejido_celulas.delete(vinculoId);
    } catch {}
    const { error } = await supabase.from(CONFIG_TEJIDO_CELULAS.tabla).delete().eq("id", vinculoId);
    if (error) console.error("[useTejidoCelulas] error quitando vínculo:", error);
  }, []);

  return { items, loading, vincularExistente, actualizarRol, actualizarProporcion, quitar, load };
}
