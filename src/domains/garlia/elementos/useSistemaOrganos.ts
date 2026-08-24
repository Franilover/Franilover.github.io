"use client";

/**
 * useSistemaOrganos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Resuelve los Órganos vinculados a UN Sistema — tabla puente
 * `sistema_organos` (M:N, Fase 5). Un Sistema es una agrupación funcional de
 * Órganos (ej. "Sistema circulatorio" = corazón + vasos); a diferencia de
 * organo_tejidos/tejido_celulas, esta tabla NO tiene columnas `rol` ni
 * `proporcion` — el vínculo es simple pertenencia, sin ponderación.
 *
 * Un mismo Órgano puede pertenecer a varios Sistemas (ej. el hígado en
 * digestivo y metabólico a la vez).
 *
 * Fase 8: cache-first vía Dexie, mismo patrón que useOrganoTejidos.ts
 * (sistema_organos y organos ya están en DEXIE_TABLES desde v35/v32).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";
import { db } from "@/infra/supabase/db";

import {
  CONFIG_ORGANOS,
  CONFIG_SISTEMA_ORGANOS,
  type Organo,
  type SistemaOrgano,
} from "@/domains/garlia/elementos/types";

// ── Cache-first: leer/escribir Dexie ───────────────────────────────────────
async function leerVinculosDeDexie(sistemaId: string): Promise<SistemaOrgano[]> {
  try {
    if (!db) return [];
    const rows = await db.sistema_organos
      .where("sistema_id")
      .equals(sistemaId)
      .toArray();
    return rows as unknown as SistemaOrgano[];
  } catch {
    return [];
  }
}

async function leerOrganosDeDexie(ids: string[]): Promise<Record<string, Organo>> {
  const out: Record<string, Organo> = {};
  if (!db || ids.length === 0) return out;
  try {
    const rows = await db.organos.bulkGet(ids);
    for (const r of rows) if (r) out[(r as unknown as Organo).id] = r as unknown as Organo;
  } catch {}
  return out;
}

async function guardarEnDexie(vinculos: SistemaOrgano[], organos: Organo[]) {
  try {
    if (!db) return;
    if (vinculos.length) await db.sistema_organos.bulkPut(vinculos as any[]);
    if (organos.length) await db.organos.bulkPut(organos as any[]);
  } catch (e) {
    console.warn("[useSistemaOrganos] no se pudo guardar en Dexie:", e);
  }
}

/** Una fila resuelta: vínculo + Órgano ya cargado, lista para la UI. */
export interface OrganoDeSistema {
  vinculo_id: string;
  sistema_id: string;
  organo_id: string;
  organo: Organo;
}

export function useSistemaOrganos(sistemaId: string | null) {
  const [vinculos, setVinculos] = useState<SistemaOrgano[]>([]);
  const [organos, setOrganos] = useState<Record<string, Organo>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!sistemaId) {
      setVinculos([]);
      setOrganos({});
      setLoading(false);
      return;
    }

    // ── Paso 1: pintar de inmediato con lo que ya haya en Dexie ──────────
    const vinculosLocales = await leerVinculosDeDexie(sistemaId);
    if (vinculosLocales.length > 0) {
      setVinculos(vinculosLocales);
      const organoIdsLocales = vinculosLocales.map((v) => v.organo_id);
      const organosLocales = await leerOrganosDeDexie(organoIdsLocales);
      setOrganos(organosLocales);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // ── Paso 2: revalidar contra Supabase en segundo plano ────────────────
    const { data: vinculoData, error: vinculoError } = await supabase
      .from(CONFIG_SISTEMA_ORGANOS.tabla)
      .select(CONFIG_SISTEMA_ORGANOS.select)
      .eq("sistema_id", sistemaId)
      .order("created_at", { ascending: true });

    if (vinculoError || !vinculoData) {
      if (vinculosLocales.length === 0) {
        setVinculos([]);
        setOrganos({});
      }
      setLoading(false);
      return;
    }
    setVinculos(vinculoData as unknown as SistemaOrgano[]);

    const organoIds = (vinculoData as unknown as SistemaOrgano[]).map((v) => v.organo_id);
    if (organoIds.length === 0) {
      setOrganos({});
      setLoading(false);
      void guardarEnDexie(vinculoData as unknown as SistemaOrgano[], []);
      return;
    }

    const { data: organoData } = await supabase
      .from(CONFIG_ORGANOS.tabla)
      .select(CONFIG_ORGANOS.select)
      .in("id", organoIds);

    const organosPorId: Record<string, Organo> = {};
    for (const o of (organoData ?? []) as unknown as Organo[]) organosPorId[o.id] = o;
    setOrganos(organosPorId);
    setLoading(false);
    void guardarEnDexie(
      vinculoData as unknown as SistemaOrgano[],
      Object.values(organosPorId),
    );
  }, [sistemaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<OrganoDeSistema[]>(() => {
    return vinculos
      .map((v) => {
        const organo = organos[v.organo_id];
        if (!organo) return null;
        return {
          vinculo_id: v.id,
          sistema_id: v.sistema_id,
          organo_id: v.organo_id,
          organo,
        };
      })
      .filter((o): o is OrganoDeSistema => o !== null);
  }, [vinculos, organos]);

  /** Vincular un Órgano ya existente del catálogo a este Sistema. */
  const vincularExistente = useCallback(
    async (organoId: string) => {
      if (!sistemaId) return null;
      const { data: vinculo, error } = await supabase
        .from(CONFIG_SISTEMA_ORGANOS.tabla)
        .insert([{ sistema_id: sistemaId, organo_id: organoId }])
        .select()
        .single();
      if (error || !vinculo) return null;

      if (!organos[organoId]) {
        const { data: organoData } = await supabase
          .from(CONFIG_ORGANOS.tabla)
          .select(CONFIG_ORGANOS.select)
          .eq("id", organoId)
          .single();
        if (organoData) {
          const organo = organoData as unknown as Organo;
          setOrganos((prev) => ({ ...prev, [organoId]: organo }));
          void guardarEnDexie([], [organo]);
        }
      }
      setVinculos((prev) => [...prev, vinculo as unknown as SistemaOrgano]);
      void guardarEnDexie([vinculo as unknown as SistemaOrgano], []);
      return vinculo as unknown as SistemaOrgano;
    },
    [sistemaId, organos],
  );

  /** Quitar el vínculo (el Órgano queda en su catálogo, no se borra). */
  const quitar = useCallback(async (vinculoId: string) => {
    setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
    try {
      if (db) await db.sistema_organos.delete(vinculoId);
    } catch {}
    const { error } = await supabase.from(CONFIG_SISTEMA_ORGANOS.tabla).delete().eq("id", vinculoId);
    if (error) console.error("[useSistemaOrganos] error quitando vínculo:", error);
  }, []);

  return { items, loading, vincularExistente, quitar, load };
}
