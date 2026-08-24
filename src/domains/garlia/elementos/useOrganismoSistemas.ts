"use client";

/**
 * useOrganismoSistemas.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Resuelve los Sistemas vinculados a UN Organismo — tabla puente
 * `organismo_sistemas` (M:N, Fase 5). A diferencia de sistema_organos, esta
 * tabla SÍ tiene `proporcion` libre en texto, mismo patrón que
 * organo_tejidos (ej. "1", "2" — peso relativo del Sistema en el Organismo).
 *
 * Techo de la cadena: Célula → Tejido → Órgano → Sistema → Organismo.
 * Un mismo Sistema puede reutilizarse en varios Organismos.
 *
 * Fase 8: cache-first vía Dexie, mismo patrón que useOrganoTejidos.ts /
 * useSistemaOrganos.ts (organismo_sistemas y sistemas ya están en
 * DEXIE_TABLES desde v35).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";
import { db } from "@/infra/supabase/db";

import {
  CONFIG_ORGANISMO_SISTEMAS,
  CONFIG_SISTEMAS,
  type OrganismoSistema,
  type Sistema,
} from "@/domains/garlia/elementos/types";

// ── Cache-first: leer/escribir Dexie ───────────────────────────────────────
async function leerVinculosDeDexie(organismoId: string): Promise<OrganismoSistema[]> {
  try {
    if (!db) return [];
    const rows = await db.organismo_sistemas
      .where("organismo_id")
      .equals(organismoId)
      .toArray();
    return rows as unknown as OrganismoSistema[];
  } catch {
    return [];
  }
}

async function leerSistemasDeDexie(ids: string[]): Promise<Record<string, Sistema>> {
  const out: Record<string, Sistema> = {};
  if (!db || ids.length === 0) return out;
  try {
    const rows = await db.sistemas.bulkGet(ids);
    for (const r of rows) if (r) out[(r as unknown as Sistema).id] = r as unknown as Sistema;
  } catch {}
  return out;
}

async function guardarEnDexie(vinculos: OrganismoSistema[], sistemas: Sistema[]) {
  try {
    if (!db) return;
    if (vinculos.length) await db.organismo_sistemas.bulkPut(vinculos as any[]);
    if (sistemas.length) await db.sistemas.bulkPut(sistemas as any[]);
  } catch (e) {
    console.warn("[useOrganismoSistemas] no se pudo guardar en Dexie:", e);
  }
}

/** Una fila resuelta: vínculo + Sistema ya cargado, lista para la UI. */
export interface SistemaDeOrganismo {
  vinculo_id: string;
  organismo_id: string;
  sistema_id: string;
  proporcion: string | null;
  sistema: Sistema;
}

export function useOrganismoSistemas(organismoId: string | null) {
  const [vinculos, setVinculos] = useState<OrganismoSistema[]>([]);
  const [sistemas, setSistemas] = useState<Record<string, Sistema>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organismoId) {
      setVinculos([]);
      setSistemas({});
      setLoading(false);
      return;
    }

    // ── Paso 1: pintar de inmediato con lo que ya haya en Dexie ──────────
    const vinculosLocales = await leerVinculosDeDexie(organismoId);
    if (vinculosLocales.length > 0) {
      setVinculos(vinculosLocales);
      const sistemaIdsLocales = vinculosLocales.map((v) => v.sistema_id);
      const sistemasLocales = await leerSistemasDeDexie(sistemaIdsLocales);
      setSistemas(sistemasLocales);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // ── Paso 2: revalidar contra Supabase en segundo plano ────────────────
    const { data: vinculoData, error: vinculoError } = await supabase
      .from(CONFIG_ORGANISMO_SISTEMAS.tabla)
      .select(CONFIG_ORGANISMO_SISTEMAS.select)
      .eq("organismo_id", organismoId)
      .order("created_at", { ascending: true });

    if (vinculoError || !vinculoData) {
      if (vinculosLocales.length === 0) {
        setVinculos([]);
        setSistemas({});
      }
      setLoading(false);
      return;
    }
    setVinculos(vinculoData as unknown as OrganismoSistema[]);

    const sistemaIds = (vinculoData as unknown as OrganismoSistema[]).map((v) => v.sistema_id);
    if (sistemaIds.length === 0) {
      setSistemas({});
      setLoading(false);
      void guardarEnDexie(vinculoData as unknown as OrganismoSistema[], []);
      return;
    }

    const { data: sistemaData } = await supabase
      .from(CONFIG_SISTEMAS.tabla)
      .select(CONFIG_SISTEMAS.select)
      .in("id", sistemaIds);

    const sistemasPorId: Record<string, Sistema> = {};
    for (const s of (sistemaData ?? []) as unknown as Sistema[]) sistemasPorId[s.id] = s;
    setSistemas(sistemasPorId);
    setLoading(false);
    void guardarEnDexie(
      vinculoData as unknown as OrganismoSistema[],
      Object.values(sistemasPorId),
    );
  }, [organismoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<SistemaDeOrganismo[]>(() => {
    return vinculos
      .map((v) => {
        const sistema = sistemas[v.sistema_id];
        if (!sistema) return null;
        return {
          vinculo_id: v.id,
          organismo_id: v.organismo_id,
          sistema_id: v.sistema_id,
          proporcion: v.proporcion,
          sistema,
        };
      })
      .filter((s): s is SistemaDeOrganismo => s !== null);
  }, [vinculos, sistemas]);

  /** Vincular un Sistema ya existente del catálogo a este Organismo. */
  const vincularExistente = useCallback(
    async (sistemaId: string) => {
      if (!organismoId) return null;
      const { data: vinculo, error } = await supabase
        .from(CONFIG_ORGANISMO_SISTEMAS.tabla)
        .insert([{ organismo_id: organismoId, sistema_id: sistemaId }])
        .select()
        .single();
      if (error || !vinculo) return null;

      if (!sistemas[sistemaId]) {
        const { data: sistemaData } = await supabase
          .from(CONFIG_SISTEMAS.tabla)
          .select(CONFIG_SISTEMAS.select)
          .eq("id", sistemaId)
          .single();
        if (sistemaData) {
          const sistema = sistemaData as unknown as Sistema;
          setSistemas((prev) => ({ ...prev, [sistemaId]: sistema }));
          void guardarEnDexie([], [sistema]);
        }
      }
      setVinculos((prev) => [...prev, vinculo as unknown as OrganismoSistema]);
      void guardarEnDexie([vinculo as unknown as OrganismoSistema], []);
      return vinculo as unknown as OrganismoSistema;
    },
    [organismoId, sistemas],
  );

  /** Editar la proporción de una fila. */
  const actualizarProporcion = useCallback(async (vinculoId: string, proporcion: string) => {
    setVinculos((prev) => {
      const next = prev.map((v) => (v.id === vinculoId ? { ...v, proporcion } : v));
      const actualizado = next.find((v) => v.id === vinculoId);
      if (actualizado) void guardarEnDexie([actualizado], []);
      return next;
    });
    const { error } = await supabase
      .from(CONFIG_ORGANISMO_SISTEMAS.tabla)
      .update({ proporcion })
      .eq("id", vinculoId);
    if (error) console.error("[useOrganismoSistemas] error actualizando proporción:", error);
  }, []);

  /** Quitar el vínculo (el Sistema queda en su catálogo, no se borra). */
  const quitar = useCallback(async (vinculoId: string) => {
    setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
    try {
      if (db) await db.organismo_sistemas.delete(vinculoId);
    } catch {}
    const { error } = await supabase.from(CONFIG_ORGANISMO_SISTEMAS.tabla).delete().eq("id", vinculoId);
    if (error) console.error("[useOrganismoSistemas] error quitando vínculo:", error);
  }, []);

  return { items, loading, vincularExistente, actualizarProporcion, quitar, load };
}
