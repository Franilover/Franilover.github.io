"use client";

/**
 * useCelulaEstructuras.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Resuelve de qué Estructura(s) real(es) está hecha UNA Célula (tabla
 * puente "celula_estructuras") — reemplaza a useCelulaCompuestos como
 * fuente de "composición" en el panel de Célula: desde la migración de
 * estructuras (ago-2026), celula_compuestos quedó vacía (0 filas) y la
 * fuente de verdad pasó a ser Célula → Estructura → Compuesto, no un
 * vínculo directo Célula → Compuesto.
 *
 * Para cada Estructura vinculada, además resuelve sus Compuestos vía
 * estructura_compuestos, así el panel de Célula puede seguir mostrando
 * "de qué está hecha en el fondo" sin que el usuario tenga que abrir la
 * Estructura por separado.
 *
 * Solo lectura: a diferencia de useCelulaCompuestos, este hook no expone
 * vincularExistente/actualizarRol/quitar — celula_estructuras se puebla
 * por migración/triggers, no por edición manual desde este panel (ver
 * decisión explícita al agregar esta sección: solo lectura).
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import {
  CONFIG_CELULA_ESTRUCTURAS,
  CONFIG_ESTRUCTURA_COMPUESTOS,
  CONFIG_ESTRUCTURAS,
  CONFIG_COMPUESTOS,
  type CelulaEstructura,
  type Compuesto,
  type Estructura,
  type EstructuraCompuesto,
} from "@/domains/garlia/elementos/types";

/** Un Compuesto dentro de una Estructura, ya resuelto — para mostrar en
 *  cascada bajo cada Estructura de la Célula. */
export interface CompuestoDeEstructura {
  vinculo_id: string;
  compuesto_id: string;
  rol: string | null;
  compuesto: Compuesto;
}

/** Una Estructura vinculada a la Célula, con sus Compuestos ya resueltos. */
export interface EstructuraDeCelula {
  vinculo_id: string;
  estructura_id: string;
  rol: string | null;
  estructura: Estructura;
  compuestos: CompuestoDeEstructura[];
}

export function useCelulaEstructuras(celulaId: string | null) {
  const [vinculos, setVinculos] = useState<CelulaEstructura[]>([]);
  const [estructuras, setEstructuras] = useState<Record<string, Estructura>>({});
  const [compuestosPorEstructura, setCompuestosPorEstructura] = useState<
    Record<string, CompuestoDeEstructura[]>
  >({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!celulaId) {
      setVinculos([]);
      setEstructuras({});
      setCompuestosPorEstructura({});
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: vinculoData, error: vinculoError } = await supabase
      .from(CONFIG_CELULA_ESTRUCTURAS.tabla)
      .select(CONFIG_CELULA_ESTRUCTURAS.select)
      .eq("celula_id", celulaId)
      .order("orden", { ascending: true });

    if (vinculoError || !vinculoData) {
      setVinculos([]);
      setEstructuras({});
      setCompuestosPorEstructura({});
      setLoading(false);
      return;
    }
    const vinculosResueltos = vinculoData as unknown as CelulaEstructura[];
    setVinculos(vinculosResueltos);

    const estructuraIds = vinculosResueltos.map((v) => v.estructura_id);
    if (estructuraIds.length === 0) {
      setEstructuras({});
      setCompuestosPorEstructura({});
      setLoading(false);
      return;
    }

    const { data: estructuraData } = await supabase
      .from(CONFIG_ESTRUCTURAS.tabla)
      .select(CONFIG_ESTRUCTURAS.select)
      .in("id", estructuraIds);
    const estructurasPorId: Record<string, Estructura> = {};
    for (const e of (estructuraData ?? []) as unknown as Estructura[]) estructurasPorId[e.id] = e;
    setEstructuras(estructurasPorId);

    const { data: ecData } = await supabase
      .from(CONFIG_ESTRUCTURA_COMPUESTOS.tabla)
      .select(CONFIG_ESTRUCTURA_COMPUESTOS.select)
      .in("estructura_id", estructuraIds);
    const vinculosCompuesto = (ecData ?? []) as unknown as EstructuraCompuesto[];

    const compuestoIds = [...new Set(vinculosCompuesto.map((v) => v.compuesto_id))];
    let compuestosPorId: Record<string, Compuesto> = {};
    if (compuestoIds.length > 0) {
      const { data: compuestoData } = await supabase
        .from(CONFIG_COMPUESTOS.tabla)
        .select(CONFIG_COMPUESTOS.select)
        .in("id", compuestoIds);
      for (const c of (compuestoData ?? []) as unknown as Compuesto[]) compuestosPorId[c.id] = c;
    }

    const agrupado: Record<string, CompuestoDeEstructura[]> = {};
    for (const v of vinculosCompuesto) {
      const compuesto = compuestosPorId[v.compuesto_id];
      if (!compuesto) continue;
      const lista = agrupado[v.estructura_id] ?? [];
      lista.push({ vinculo_id: v.id, compuesto_id: v.compuesto_id, rol: v.rol, compuesto });
      agrupado[v.estructura_id] = lista;
    }
    setCompuestosPorEstructura(agrupado);
    setLoading(false);
  }, [celulaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<EstructuraDeCelula[]>(() => {
    return vinculos
      .map((v) => {
        const estructura = estructuras[v.estructura_id];
        if (!estructura) return null;
        return {
          vinculo_id: v.id,
          estructura_id: v.estructura_id,
          rol: v.rol,
          estructura,
          compuestos: compuestosPorEstructura[v.estructura_id] ?? [],
        };
      })
      .filter((e): e is EstructuraDeCelula => e !== null);
  }, [vinculos, estructuras, compuestosPorEstructura]);

  return { items, loading, load };
}
