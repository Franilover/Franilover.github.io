"use client";

/**
 * useCriaturaOrganismos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Vincula una Criatura con Organismo(s) del catálogo — techo de la cadena
 * biológica (Célula→Tejido→Órgano→Sistema→Organismo) aplicado a una
 * Criatura real, tabla puente dedicada "criatura_organismos".
 *
 * A diferencia de useCriaturaOrganos.ts (que delega a
 * useEntidadVinculosGrupo/estructura_componentes, Fase 7), esta tabla NO
 * pasó por esa unificación — sigue siendo dedicada, y useEntidadVinculosGrupo
 * ni siquiera acepta "organismo" como hijo_tipo válido (ver su propio tipo
 * HijoTipoCatalogo). Por eso este hook pega directo a `criatura_organismos`,
 * mismo estilo que useOrganismoSistemas.ts pero sin cache-first en Dexie:
 * `criatura_organismos` todavía no está declarada en el esquema local (ver
 * infra/supabase/db.ts — organismos/organismo_sistemas sí lo están, esta
 * tabla no), así que este hook lee/escribe directo contra Supabase. Se
 * puede sumar a Dexie más adelante sin tocar la firma pública de acá.
 *
 * Al momento de crear este hook, la tabla tenía 0 filas — es un hueco de
 * datos real, no solo de frontend: exponerlo acá permite empezar a
 * poblarlo desde la UI en vez de depender de SQL manual.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import {
  CONFIG_CRIATURA_ORGANISMOS,
  CONFIG_ORGANISMOS,
  type CriaturaOrganismo,
  type Organismo,
} from "@/domains/garlia/elementos/types";

/** Una fila resuelta: vínculo + Organismo ya cargado, lista para la UI. */
export interface OrganismoDeCriatura {
  vinculo_id: string;
  criatura_id: string;
  organismo_id: string;
  rol: string | null;
  cantidad: number;
  es_principal: boolean;
  organismo: Organismo;
}

export function useCriaturaOrganismos(criaturaId: string | null) {
  const [vinculos, setVinculos] = useState<CriaturaOrganismo[]>([]);
  const [organismos, setOrganismos] = useState<Record<string, Organismo>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!criaturaId) {
      setVinculos([]);
      setOrganismos({});
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: vinculoData, error: vinculoError } = await supabase
      .from(CONFIG_CRIATURA_ORGANISMOS.tabla)
      .select(CONFIG_CRIATURA_ORGANISMOS.select)
      .eq("criatura_id", criaturaId)
      .order("created_at", { ascending: true });

    if (vinculoError || !vinculoData) {
      setVinculos([]);
      setOrganismos({});
      setLoading(false);
      return;
    }
    const vinculosResueltos = vinculoData as unknown as CriaturaOrganismo[];
    setVinculos(vinculosResueltos);

    const organismoIds = [...new Set(vinculosResueltos.map((v) => v.organismo_id))];
    if (organismoIds.length === 0) {
      setOrganismos({});
      setLoading(false);
      return;
    }

    const { data: organismoData } = await supabase
      .from(CONFIG_ORGANISMOS.tabla)
      .select(CONFIG_ORGANISMOS.select)
      .in("id", organismoIds);
    const organismosPorId: Record<string, Organismo> = {};
    for (const o of (organismoData ?? []) as unknown as Organismo[]) organismosPorId[o.id] = o;
    setOrganismos(organismosPorId);
    setLoading(false);
  }, [criaturaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<OrganismoDeCriatura[]>(() => {
    return vinculos
      .map((v) => {
        const organismo = organismos[v.organismo_id];
        if (!organismo) return null;
        return {
          vinculo_id: v.id,
          criatura_id: v.criatura_id,
          organismo_id: v.organismo_id,
          rol: v.rol,
          cantidad: v.cantidad,
          es_principal: v.es_principal,
          organismo,
        };
      })
      .filter((o): o is OrganismoDeCriatura => o !== null);
  }, [vinculos, organismos]);

  /** Vincular un Organismo ya existente del catálogo a esta Criatura.
   *  cantidad tiene default numérico en la base (no nulleable); es_principal
   *  arranca en false — se marca a mano después si corresponde. */
  const vincularExistente = useCallback(
    async (organismoId: string) => {
      if (!criaturaId) return null;
      const { data: vinculo, error } = await supabase
        .from(CONFIG_CRIATURA_ORGANISMOS.tabla)
        .insert([{ criatura_id: criaturaId, organismo_id: organismoId, es_principal: false }])
        .select()
        .single();
      if (error || !vinculo) {
        console.error("[useCriaturaOrganismos] error vinculando organismo:", error);
        return null;
      }

      if (!organismos[organismoId]) {
        const { data: organismoData } = await supabase
          .from(CONFIG_ORGANISMOS.tabla)
          .select(CONFIG_ORGANISMOS.select)
          .eq("id", organismoId)
          .single();
        if (organismoData) {
          setOrganismos((prev) => ({ ...prev, [organismoId]: organismoData as unknown as Organismo }));
        }
      }
      setVinculos((prev) => [...prev, vinculo as unknown as CriaturaOrganismo]);
      return vinculo as unknown as CriaturaOrganismo;
    },
    [criaturaId, organismos],
  );

  /** Editar rol y/o cantidad de una fila. */
  const actualizarVinculo = useCallback(
    async (vinculoId: string, cambios: Partial<Pick<CriaturaOrganismo, "rol" | "cantidad">>) => {
      setVinculos((prev) => prev.map((v) => (v.id === vinculoId ? { ...v, ...cambios } : v)));
      const { error } = await supabase
        .from(CONFIG_CRIATURA_ORGANISMOS.tabla)
        .update(cambios)
        .eq("id", vinculoId);
      if (error) console.error("[useCriaturaOrganismos] error actualizando vínculo:", error);
    },
    [],
  );

  /** Marcar/desmarcar como principal — no fuerza unicidad en el frontend
   *  (si la criatura tiene varios organismos marcados como principal a la
   *  vez, es una decisión de datos, no algo que este hook deba arbitrar). */
  const marcarPrincipal = useCallback(async (vinculoId: string, esPrincipal: boolean) => {
    setVinculos((prev) =>
      prev.map((v) => (v.id === vinculoId ? { ...v, es_principal: esPrincipal } : v)),
    );
    const { error } = await supabase
      .from(CONFIG_CRIATURA_ORGANISMOS.tabla)
      .update({ es_principal: esPrincipal })
      .eq("id", vinculoId);
    if (error) console.error("[useCriaturaOrganismos] error marcando principal:", error);
  }, []);

  /** Quitar el vínculo (el Organismo queda en su catálogo, no se borra). */
  const quitar = useCallback(async (vinculoId: string) => {
    setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
    const { error } = await supabase
      .from(CONFIG_CRIATURA_ORGANISMOS.tabla)
      .delete()
      .eq("id", vinculoId);
    if (error) console.error("[useCriaturaOrganismos] error quitando vínculo:", error);
  }, []);

  return { items, loading, vincularExistente, actualizarVinculo, marcarPrincipal, quitar, load };
}
