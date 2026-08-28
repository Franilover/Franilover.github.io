"use client";

/**
 * useTagsCompuestos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Sistema de tags para Compuestos: tabla "tags" (catálogo global, 3 ejes —
 * naturaleza / oris / uso, cada tag con color hex para la UI) + tabla
 * relacional "compuesto_tags" (many-to-many, ON DELETE CASCADE).
 *
 * Ambas tablas viven en Supabase con RLS de solo-lectura pública. El
 * catálogo "tags" se lee con useSupabaseData (mismo patrón que
 * useCompuestos.ts) y ahora está en DEXIE_TABLES → sobrevive offline.
 *
 * "compuesto_tags" también se lee con useSupabaseData (cache-first,
 * offline-first) pero se escribe a mano: no tiene columna "id" propia
 * (PK compuesta real: compuesto_id+tag_id), así que no encaja en el
 * addRow/updateRow/deleteRow genérico de useSupabaseData, que asume "id"
 * en todo el flujo offline (getDexieRow, makePendingRow, etc. — ver nota
 * en useSupabaseData.ts junto a DEXIE_TABLES). En su lugar, cada toggle
 * escribe optimistamente en memoria (igual que antes), pega a Supabase, y
 * además refleja el resultado en Dexie a mano con dexiePut/dexieDelete
 * usando la key compuesta [compuesto_id+tag_id] declarada en db.ts (v41)
 * — así el catálogo de tags asignados por compuesto también sobrevive
 * offline, aunque la escritura en sí siga necesitando red.
 */

import { useCallback, useMemo } from "react";

import { supabase } from "@/infra/supabase/supabase";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";
import { dexiePut, dexieDelete } from "@/infra/sync/useOfflineSync";

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

/** Fila cruda tal cual vive en Supabase (tabla "compuesto_tags"). PK
 *  compuesta (compuesto_id, tag_id) — no tiene columna "id" propia. */
export interface CompuestoTag {
  compuesto_id: string;
  tag_id: string;
}

export const CONFIG_TAGS = {
  tabla: "tags",
  select: "id, nombre, categoria, descripcion, color",
};

export const CONFIG_COMPUESTO_TAGS = {
  tabla: "compuesto_tags",
  select: "compuesto_id, tag_id",
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
   *  en Supabase y refleja el cambio en memoria al toque (optimista). La
   *  fila no tiene "id" propio — se identifica por el par (compuesto_id,
   *  tag_id), que es la PK compuesta real de la tabla. */
  const toggleTag = useCallback(
    async (compuestoId: string, tagId: string) => {
      const yaTiene = (tagIdsPorCompuesto.get(compuestoId) ?? new Set()).has(tagId);

      if (yaTiene) {
        setData((prev) =>
          prev.filter((r) => !(r.compuesto_id === compuestoId && r.tag_id === tagId)),
        );
        // Optimista también en Dexie: si falla la escritura remota se
        // revierte más abajo, igual que con el estado en memoria.
        void dexieDelete(CONFIG_COMPUESTO_TAGS.tabla, [compuestoId, tagId] as any);
        const { error } = await supabase
          .from(CONFIG_COMPUESTO_TAGS.tabla)
          .delete()
          .eq("compuesto_id", compuestoId)
          .eq("tag_id", tagId);
        if (error) {
          console.error("[useCompuestoTags] error quitando tag:", error);
          setData((prev) => [...prev, { compuesto_id: compuestoId, tag_id: tagId }]);
          void dexiePut(CONFIG_COMPUESTO_TAGS.tabla, {
            compuesto_id: compuestoId,
            tag_id: tagId,
          });
        }
      } else {
        setData((prev) => [...prev, { compuesto_id: compuestoId, tag_id: tagId }]);
        void dexiePut(CONFIG_COMPUESTO_TAGS.tabla, {
          compuesto_id: compuestoId,
          tag_id: tagId,
        });
        const { error } = await supabase
          .from(CONFIG_COMPUESTO_TAGS.tabla)
          .insert([{ compuesto_id: compuestoId, tag_id: tagId }]);
        if (error) {
          console.error("[useCompuestoTags] error agregando tag:", error);
          setData((prev) =>
            prev.filter((r) => !(r.compuesto_id === compuestoId && r.tag_id === tagId)),
          );
          void dexieDelete(CONFIG_COMPUESTO_TAGS.tabla, [compuestoId, tagId] as any);
        }
      }
    },
    [tagIdsPorCompuesto, setData],
  );

  return { relaciones: data, tagIdsDe, toggleTag, loading };
}
