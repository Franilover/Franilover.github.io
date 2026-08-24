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
 * No cachea en Dexie todavía — mismo TODO que useTejidoCelulas.ts.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import {
  CONFIG_ORGANISMO_SISTEMAS,
  CONFIG_SISTEMAS,
  type OrganismoSistema,
  type Sistema,
} from "@/domains/garlia/elementos/types";

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
    setLoading(true);

    const { data: vinculoData, error: vinculoError } = await supabase
      .from(CONFIG_ORGANISMO_SISTEMAS.tabla)
      .select(CONFIG_ORGANISMO_SISTEMAS.select)
      .eq("organismo_id", organismoId)
      .order("created_at", { ascending: true });

    if (vinculoError || !vinculoData) {
      setVinculos([]);
      setSistemas({});
      setLoading(false);
      return;
    }
    setVinculos(vinculoData as unknown as OrganismoSistema[]);

    const sistemaIds = (vinculoData as unknown as OrganismoSistema[]).map((v) => v.sistema_id);
    if (sistemaIds.length === 0) {
      setSistemas({});
      setLoading(false);
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
          setSistemas((prev) => ({ ...prev, [sistemaId]: sistemaData as unknown as Sistema }));
        }
      }
      setVinculos((prev) => [...prev, vinculo as unknown as OrganismoSistema]);
      return vinculo as unknown as OrganismoSistema;
    },
    [organismoId, sistemas],
  );

  /** Editar la proporción de una fila. */
  const actualizarProporcion = useCallback(async (vinculoId: string, proporcion: string) => {
    setVinculos((prev) => prev.map((v) => (v.id === vinculoId ? { ...v, proporcion } : v)));
    const { error } = await supabase
      .from(CONFIG_ORGANISMO_SISTEMAS.tabla)
      .update({ proporcion })
      .eq("id", vinculoId);
    if (error) console.error("[useOrganismoSistemas] error actualizando proporción:", error);
  }, []);

  /** Quitar el vínculo (el Sistema queda en su catálogo, no se borra). */
  const quitar = useCallback(async (vinculoId: string) => {
    setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
    const { error } = await supabase.from(CONFIG_ORGANISMO_SISTEMAS.tabla).delete().eq("id", vinculoId);
    if (error) console.error("[useOrganismoSistemas] error quitando vínculo:", error);
  }, []);

  return { items, loading, vincularExistente, actualizarProporcion, quitar, load };
}
