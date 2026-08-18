"use client";

/**
 * useTagsCompuestos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Sistema de tags para Compuestos: tabla "tags" (catálogo global, 3 ejes —
 * naturaleza / oris / uso, cada tag con color hex para la UI) + tabla
 * relacional "compuesto_tags" (many-to-many, ON DELETE CASCADE).
 *
 * Ambas tablas viven en Supabase con RLS de solo-lectura pública, así que
 * el catálogo de tags se lee con useSupabaseData (mismo patrón que
 * useCompuestos.ts) y las relaciones se escriben directo con
 * supabase.from("compuesto_tags").insert/delete — igual que persist() en
 * CompuestoEditor (CompuestosPage.tsx).
 */

import { useCallback, useMemo } from "react";

import { supabase } from "@/infra/supabase/supabase";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export type CategoriaTag = "naturaleza" | "oris" | "uso";

export const CATEGORIA_TAG_LABEL: Record<CategoriaTag, string> = {
  naturaleza: "Naturaleza",
  oris: "Oris",
  uso: "Uso",
};

export const CATEGORIAS_TAG: CategoriaTag[] = ["naturaleza", "oris", "uso"];

/** Fila cruda tal cual vive en Supabase (tabla "tags"). */
export interface Tag {
  id: string;
  nombre: string;
  categoria: CategoriaTag;
  descripcion?: string | null;
  color?: string | null;
}

/** Fila cruda tal cual vive en Supabase (tabla "compuesto_tags"). */
export interface CompuestoTag {
  id: string;
  compuesto_id: string;
  tag_id: string;
}

export const CONFIG_TAGS = {
  tabla: "tags",
  select: "id, nombre, categoria, descripcion, color",
};

export const CONFIG_COMPUESTO_TAGS = {
  tabla: "compuesto_tags",
  select: "id, compuesto_id, tag_id",
};

/**
 * Catálogo completo de tags (los 19 de los 3 ejes), agrupado por categoría
 * para que el selector pueda pintar tres secciones (naturaleza/oris/uso).
 */
export function useTagsCatalogo() {
  const { data, loading } = useSupabaseData<Tag>(CONFIG_TAGS.tabla, {
    select: CONFIG_TAGS.select,
    order: { campo: "nombre" },
  });

  const porCategoria = useMemo(() => {
    const grupos: Record<CategoriaTag, Tag[]> = {
      naturaleza: [],
      oris: [],
      uso: [],
    };
    for (const tag of data) {
      grupos[tag.categoria]?.push(tag);
    }
    return grupos;
  }, [data]);

  return { tags: data, porCategoria, loading };
}

/**
 * Relaciones compuesto↔tag de TODO el catálogo (no filtradas por compuesto):
 * se traen todas de una para poder resolver, en memoria, qué tags tiene
 * cualquier compuesto sin pedir una query por compuesto — mismo espíritu
 * que useCompuestos trayendo todo el catálogo de una.
 */
export function useCompuestoTags() {
  const { data, setData, loading } = useSupabaseData<CompuestoTag>(
    CONFIG_COMPUESTO_TAGS.tabla,
    {
      select: CONFIG_COMPUESTO_TAGS.select,
    },
  );

  const tagIdsPorCompuesto = useMemo(() => {
    const mapa = new Map<string, Set<string>>();
    for (const rel of data) {
      if (!mapa.has(rel.compuesto_id)) mapa.set(rel.compuesto_id, new Set());
      mapa.get(rel.compuesto_id)!.add(rel.tag_id);
    }
    return mapa;
  }, [data]);

  /** Tags (ids) asignados a un compuesto puntual — set vacío si no tiene. */
  const tagIdsDe = useCallback(
    (compuestoId: string): Set<string> => tagIdsPorCompuesto.get(compuestoId) ?? new Set(),
    [tagIdsPorCompuesto],
  );

  /** Prende/apaga un tag en un compuesto: inserta o borra la fila relacional
   *  en Supabase y refleja el cambio en memoria al toque (optimista). */
  const toggleTag = useCallback(
    async (compuestoId: string, tagId: string) => {
      const yaTiene = (tagIdsPorCompuesto.get(compuestoId) ?? new Set()).has(tagId);

      if (yaTiene) {
        const existente = data.find(
          (r) => r.compuesto_id === compuestoId && r.tag_id === tagId,
        );
        setData((prev) =>
          prev.filter((r) => !(r.compuesto_id === compuestoId && r.tag_id === tagId)),
        );
        const { error } = await supabase
          .from(CONFIG_COMPUESTO_TAGS.tabla)
          .delete()
          .eq("compuesto_id", compuestoId)
          .eq("tag_id", tagId);
        if (error) {
          console.error("[useCompuestoTags] error quitando tag:", error);
          if (existente) setData((prev) => [...prev, existente]);
        }
      } else {
        const optimista: CompuestoTag = {
          id: `__pending__${compuestoId}__${tagId}`,
          compuesto_id: compuestoId,
          tag_id: tagId,
        };
        setData((prev) => [...prev, optimista]);
        const { data: inserted, error } = await supabase
          .from(CONFIG_COMPUESTO_TAGS.tabla)
          .insert([{ compuesto_id: compuestoId, tag_id: tagId }])
          .select(CONFIG_COMPUESTO_TAGS.select)
          .single<CompuestoTag>();
        if (error) {
          console.error("[useCompuestoTags] error agregando tag:", error);
          setData((prev) => prev.filter((r) => r.id !== optimista.id));
        } else if (inserted) {
          const fila: CompuestoTag = inserted;
          setData((prev) => prev.map((r) => (r.id === optimista.id ? fila : r)));
        }
      }
    },
    [data, tagIdsPorCompuesto, setData],
  );

  return { relaciones: data, tagIdsDe, toggleTag, loading };
}
