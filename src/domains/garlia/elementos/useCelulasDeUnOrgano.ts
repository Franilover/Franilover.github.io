"use client";

/**
 * useCelulasDeUnOrgano.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Resuelve TODAS las Células que componen un Órgano, atravesando los DOS
 * niveles de la cadena real:
 *   Organo → organo_tejidos → Tejido → tejido_celulas → Celula
 * A diferencia de useOrganoTejidos (que solo resuelve la PRIMERA Célula de
 * cada Tejido, para la vista simplificada de la fórmula), este hook trae
 * la unión completa de Células de TODOS los Tejidos del Órgano — sin
 * duplicados, aunque varias Células se repitan en distintos Tejidos.
 *
 * Pensado para el breadcrumb Célula ⇄ Tejido ⇄ Órgano: parado en un
 * Órgano, el nivel "Célula" debe listar todas las Células alcanzables,
 * no solo una por Tejido.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import {
  CONFIG_CELULAS,
  CONFIG_TEJIDO_CELULAS,
  type Celula,
  type TejidoCelula,
} from "@/domains/garlia/elementos/types";

interface VinculoOrganoTejido {
  id: string;
  organo_id: string;
  tejido_id: string;
}

export function useCelulasDeUnOrgano(organoId: string | null) {
  const [tejidoIds, setTejidoIds] = useState<string[]>([]);
  const [vinculosCelula, setVinculosCelula] = useState<TejidoCelula[]>([]);
  const [celulas, setCelulas] = useState<Record<string, Celula>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organoId) {
      setTejidoIds([]);
      setVinculosCelula([]);
      setCelulas({});
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: otData, error: otError } = await supabase
      .from("organo_tejidos")
      .select("id, organo_id, tejido_id")
      .eq("organo_id", organoId);

    if (otError || !otData) {
      setTejidoIds([]);
      setVinculosCelula([]);
      setCelulas({});
      setLoading(false);
      return;
    }

    const idsTejidos = Array.from(
      new Set((otData as unknown as VinculoOrganoTejido[]).map((v) => v.tejido_id)),
    );
    setTejidoIds(idsTejidos);

    if (idsTejidos.length === 0) {
      setVinculosCelula([]);
      setCelulas({});
      setLoading(false);
      return;
    }

    const { data: tcData, error: tcError } = await supabase
      .from(CONFIG_TEJIDO_CELULAS.tabla)
      .select(CONFIG_TEJIDO_CELULAS.select)
      .in("tejido_id", idsTejidos);

    if (tcError || !tcData) {
      setVinculosCelula([]);
      setCelulas({});
      setLoading(false);
      return;
    }
    setVinculosCelula(tcData as unknown as TejidoCelula[]);

    const celulaIds = Array.from(
      new Set((tcData as unknown as TejidoCelula[]).map((v) => v.celula_id)),
    );
    if (celulaIds.length === 0) {
      setCelulas({});
      setLoading(false);
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
  }, [organoId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Unión sin duplicados: una Célula puede poblar varios Tejidos del mismo Órgano. */
  const items = useMemo<Celula[]>(() => {
    const idsVistos = new Set<string>();
    const out: Celula[] = [];
    for (const v of vinculosCelula) {
      const celula = celulas[v.celula_id];
      if (!celula || idsVistos.has(celula.id)) continue;
      idsVistos.add(celula.id);
      out.push(celula);
    }
    return out;
  }, [vinculosCelula, celulas]);

  return { items, tejidoIds, loading, load };
}
