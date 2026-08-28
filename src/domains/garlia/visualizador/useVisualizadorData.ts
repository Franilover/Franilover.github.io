"use client";

/**
 * useVisualizadorData.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Hooks propios del Visualizador V2 para los pocos datos que no tienen un
 * hook reusable en el resto del código:
 *
 *  - useParticulasCompletas(): igual que useParticulas() (fisica/useFisica)
 *    pero pidiendo también "ejes_fundamentales" (jsonb, 6 dimensiones reales)
 *    y "categoria" — columnas reales de la tabla "particulas" que no están
 *    en PARTICULAS_CONFIG.select. Se hace acá en vez de tocar ese archivo
 *    compartido para no arriesgar romper otros consumidores del mismo
 *    select cacheado (Dexie/useSupabaseData usa el select como parte de la
 *    identidad del fetch).
 *  - useRunasCatalogo(): tabla "runas", mismo patrón useSupabaseData que el
 *    resto — no existía un hook dedicado (RunasPage arma su propio CRUD).
 *  - usePropiedadesDerivadas(): catálogo completo de "propiedades_derivadas"
 *    (43 filas) — fórmula/dependencias reales, fuente única de verdad para
 *    la sección "Fórmulas".
 *  - useValoresDerivadosDeEntidad(tipo, id): valores reales calculados
 *    (tabla "valores_propiedades_derivadas") para una entidad puntual
 *    (compuesto | material | estructura), unidos a su propiedad para traer
 *    nombre + fórmula + dependencias junto al valor. Fetch directo (no vía
 *    useSupabaseData) porque depende de un id seleccionado dinámicamente,
 *    no de un catálogo completo cacheable.
 */

import { useEffect, useMemo, useState } from "react";

import { useSupabaseData } from "@/infra/sync/useSupabaseData";
import { supabase } from "@/infra/supabase/supabase";

import type { Particula } from "@/domains/garlia/fisica/types";
import type { EntidadMagica } from "@/domains/garlia/runas/types";

// ─── Partículas con ejes_fundamentales reales (6 dimensiones) ─────────────

export type EjesFundamentales = {
  dinamica: number;
  coherencia: number;
  estabilidad: number;
  informacion: number;
  interaccion: number;
  transformacion: number;
};

export interface ParticulaCompleta extends Particula {
  ejes_fundamentales: EjesFundamentales | null;
  categoria: string | null;
}

const PARTICULAS_COMPLETAS_SELECT =
  "id, orden, nombre, formula, extra, vector_neto, s_count, es_teorica, ejes_fundamentales, categoria";

export function useParticulasCompletas() {
  const { data, loading } = useSupabaseData<ParticulaCompleta>("particulas", {
    select: PARTICULAS_COMPLETAS_SELECT,
    order: { campo: "orden" },
  });

  const items = useMemo(() => data, [data]);
  return { items, loading };
}

// ─── Runas ──────────────────────────────────────────────────────────────

const RUNAS_SELECT =
  "id, nombre, explicacion, explicacion_por_rango, grupo_ids, patron_trazos";

export function useRunasCatalogo() {
  const { data, loading } = useSupabaseData<EntidadMagica>("runas", {
    select: RUNAS_SELECT,
    order: { campo: "nombre" },
  });

  const items = useMemo(() => data, [data]);
  return { items, loading };
}

// ─── Catálogo de propiedades derivadas (fórmulas reales) ───────────────────

export interface PropiedadDerivada {
  id: string;
  clave: string;
  nombre: string;
  tipo_valor: string | null;
  rango_min: number | null;
  rango_max: number | null;
  descripcion: string | null;
  formula: string | null;
  dependencias: string | null;
}

const PROPIEDADES_DERIVADAS_SELECT =
  "id, clave, nombre, tipo_valor, rango_min, rango_max, descripcion, formula, dependencias";

export function usePropiedadesDerivadas() {
  const { data, loading } = useSupabaseData<PropiedadDerivada>("propiedades_derivadas", {
    select: PROPIEDADES_DERIVADAS_SELECT,
    order: { campo: "nombre" },
  });

  const items = useMemo(() => data, [data]);
  return { items, loading };
}

// ─── Valores reales de propiedades derivadas para una entidad puntual ─────

export type EntidadTipoDerivada = "compuesto" | "material" | "estructura";

export interface ValorDerivadoEntidad {
  id: string;
  valor: number;
  metodo: string | null;
  propiedad: PropiedadDerivada;
}

/**
 * Trae los valores reales calculados en Supabase para una entidad
 * (compuesto/material/estructura) puntual, junto a la fórmula y
 * dependencias de cada propiedad — nunca inventados en frontend.
 * Fetch directo con el cliente porque el id cambia con la selección del
 * usuario y no tiene sentido cachear cada combinación en Dexie.
 */
export function useValoresDerivadosDeEntidad(
  tipo: EntidadTipoDerivada | null,
  entidadId: string | null,
) {
  const [items, setItems] = useState<ValorDerivadoEntidad[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelado = false;
    if (!tipo || !entidadId) {
      setItems([]);
      return;
    }
    setLoading(true);
    supabase
      .from("valores_propiedades_derivadas")
      .select(
        "id, valor, metodo, propiedades_derivadas(id, clave, nombre, tipo_valor, rango_min, rango_max, descripcion, formula, dependencias)",
      )
      .eq("entidad_tipo", tipo)
      .eq("entidad_id", entidadId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error || !data) {
          setItems([]);
          setLoading(false);
          return;
        }
        const filas: ValorDerivadoEntidad[] = data
          .filter((f: any) => f.propiedades_derivadas)
          .map((f: any) => ({
            id: f.id,
            valor: Number(f.valor),
            metodo: f.metodo,
            propiedad: f.propiedades_derivadas as PropiedadDerivada,
          }))
          .sort((a: ValorDerivadoEntidad, b: ValorDerivadoEntidad) =>
            a.propiedad.nombre.localeCompare(b.propiedad.nombre),
          );
        setItems(filas);
        setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [tipo, entidadId]);

  return { items, loading };
}
