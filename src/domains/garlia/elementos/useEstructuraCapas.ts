"use client";

/**
 * useEstructuraCapas.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Resuelve, para UNA Estructura, dos capas de datos que ya vivían en
 * Supabase pero que el editor (EstructurasPage → ComposicionEstructuraBloque)
 * nunca leía porque solo hacía join contra "estructura_compuestos" —
 * composición plana, sin orden ni geometría por capa:
 *
 *   1. estructura_subcomponentes: las piezas/capas ordenadas de la
 *      estructura (ej. Esmalte → Dentina → Pulpa del Diente), cada una con
 *      su propio geometria_id opcional (NULL si esa capa todavía no tiene
 *      geometría explícita enlazada — caso real hoy en el Diente).
 *   2. estructura_uniones: la relación estructural ENTRE dos subcomponentes
 *      consecutivos (ej. la interfaz Esmalte↔Dentina), con intensidad/
 *      flexibilidad/reversibilidad y un `estado` que distingue una unión
 *      con geometría de contacto declarada ("declarada"/"explicita") de
 *      una simple adyacencia asumida por orden de capas ("inferida").
 *
 * componente_tipo/componente_a_tipo/componente_b_tipo pueden apuntar a
 * "compuesto" | "estructura" | "material" — se resuelven los tres catálogos
 * en memoria (mismo patrón que useEstructuraComposicion) para no necesitar
 * un embed relacional que PostgREST no ofrece para FKs polimórficas.
 *
 * Solo lectura: mismo motivo que useEstructuraComposicion — estas tablas se
 * pueblan por migración/cálculo (fn_asignar_enlaces_compuesto y afines), no
 * por edición manual desde acá.
 */

import { useMemo } from "react";

import {
  CONFIG_COMPUESTOS,
  CONFIG_ESTRUCTURA_SUBCOMPONENTES,
  CONFIG_ESTRUCTURA_UNIONES,
  CONFIG_ESTRUCTURAS,
  type Compuesto,
  type Estructura,
  type EstructuraSubcomponente,
  type EstructuraUnion,
} from "@/domains/garlia/elementos/types";
import { CONFIG_MATERIALES, type Material } from "@/domains/garlia/materiales/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

/** Un subcomponente ya resuelto, con el nombre legible de a qué apunta. */
export interface SubcomponenteResuelto {
  id: string;
  componente_tipo: string;
  componente_id: string;
  nombre: string;
  rol: string | null;
  orden: number | null;
  geometria_id: string | null;
}

/** Una unión ya resuelta, con el nombre legible de ambos extremos. */
export interface UnionResuelta {
  id: string;
  nombre_a: string;
  nombre_b: string;
  intensidad: number | null;
  flexibilidad: number | null;
  reversibilidad: number | null;
  rol: string | null;
  tipo_unidad: string | null;
  area_relativa: number | null;
  estado: string | null;
}

function useCatalogosPolimorficos() {
  const { data: compuestos } = useSupabaseData<Compuesto>(CONFIG_COMPUESTOS.tabla, {
    select: CONFIG_COMPUESTOS.select,
  });
  const { data: estructuras } = useSupabaseData<Estructura>(CONFIG_ESTRUCTURAS.tabla, {
    select: CONFIG_ESTRUCTURAS.select,
  });
  const { data: materiales } = useSupabaseData<Material>(CONFIG_MATERIALES.tabla, {
    select: CONFIG_MATERIALES.select,
  });

  return useMemo(() => {
    const nombrePorId: Record<string, string> = {};
    for (const c of compuestos) nombrePorId[c.id] = c.nombre;
    for (const e of estructuras) nombrePorId[e.id] = e.nombre;
    for (const m of materiales) nombrePorId[m.id] = m.nombre;
    return nombrePorId;
  }, [compuestos, estructuras, materiales]);
}

/** Estados considerados "geometría de contacto declarada explícitamente",
 *  frente a una simple adyacencia inferida por orden de capas. Se usa solo
 *  para el rótulo visual — el dato crudo (`estado`) siempre se muestra tal
 *  cual viene de Supabase. */
const ESTADOS_UNION_EXPLICITA = new Set(["declarada", "explicita", "explícita"]);

export function esUnionExplicita(estado: string | null): boolean {
  return !!estado && ESTADOS_UNION_EXPLICITA.has(estado.toLowerCase());
}

export function useEstructuraCapas(estructuraId: string | null) {
  const nombrePorId = useCatalogosPolimorficos();

  const { data: subcomponentesTodos, loading: loadingSub } =
    useSupabaseData<EstructuraSubcomponente>(CONFIG_ESTRUCTURA_SUBCOMPONENTES.tabla, {
      select: CONFIG_ESTRUCTURA_SUBCOMPONENTES.select,
      order: { campo: "orden" },
    });

  const { data: unionesTodas, loading: loadingUniones } =
    useSupabaseData<EstructuraUnion>(CONFIG_ESTRUCTURA_UNIONES.tabla, {
      select: CONFIG_ESTRUCTURA_UNIONES.select,
    });

  const subcomponentes = useMemo<SubcomponenteResuelto[]>(() => {
    if (!estructuraId) return [];
    return subcomponentesTodos
      .filter((s) => s.estructura_id === estructuraId)
      .map((s) => ({
        id: s.id,
        componente_tipo: s.componente_tipo,
        componente_id: s.componente_id,
        nombre: nombrePorId[s.componente_id] ?? "(sin resolver)",
        rol: s.rol,
        orden: s.orden,
        geometria_id: s.geometria_id,
      }));
  }, [subcomponentesTodos, estructuraId, nombrePorId]);

  const uniones = useMemo<UnionResuelta[]>(() => {
    if (!estructuraId) return [];
    return unionesTodas
      .filter((u) => u.estructura_id === estructuraId)
      .map((u) => ({
        id: u.id,
        nombre_a: nombrePorId[u.componente_a_id] ?? "(sin resolver)",
        nombre_b: nombrePorId[u.componente_b_id] ?? "(sin resolver)",
        intensidad: u.intensidad,
        flexibilidad: u.flexibilidad,
        reversibilidad: u.reversibilidad,
        rol: u.rol,
        tipo_unidad: u.tipo_unidad,
        area_relativa: u.area_relativa,
        estado: u.estado,
      }));
  }, [unionesTodas, estructuraId, nombrePorId]);

  return {
    subcomponentes,
    uniones,
    loading: estructuraId ? loadingSub || loadingUniones : false,
  };
}
