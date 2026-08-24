"use client";

/**
 * useEntidadVinculosGrupo.ts
 * ───────────────────────────────────────────────────────────────────────────
 * FASE 7 — reescrito para usar la tabla puente única `estructura_componentes`
 * en vez de una tabla dedicada por entidad (item_estructura,
 * mineral_formaciones, criatura_organos, planta_organos — todas
 * consolidadas ahí, ver migración fase7_unificacion_estructura_componentes).
 *
 * Antes: cada entidad tenía su propia tabla puente libre, pasada como
 * `tablaPuente` + `columnaFk`. Ahora: se fija `padreTipo` ('item' | 'mineral'
 * | 'criatura' | 'planta') y el hook arma todo contra
 * estructura_componentes(padre_tipo=padreTipo, padre_id=entidadId,
 * hijo_tipo=hijoTipo, hijo_id=<id del catálogo>). El propio backend valida
 * con un trigger que padre_tipo/hijo_tipo sean un par permitido y que los
 * ids existan en la tabla correcta — mismo blindaje que ya tiene
 * Grano↔Veta, no hace falta reimplementarlo acá.
 *
 * `tablaCatalogo` sigue siendo la tabla real del catálogo compartido
 * ("formaciones" u "organos") — eso no cambió, solo la tabla puente.
 *
 * Uso:
 *   const formaciones = useEntidadVinculosGrupo({
 *     entidadId: item.id,
 *     padreTipo: "item",
 *     tablaCatalogo: "formaciones",
 *     hijoTipo: "formacion",
 *     catalogo: catalogoFormaciones, // useFormaciones().items
 *   });
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import type { EntidadCatalogoGrupoBase } from "@/domains/garlia/elementos/types";

/** Shape mínimo compartido por Organo y Formacion — tipado contra la base
 *  común (EntidadCatalogoGrupoBase) en vez de una unión (Organo | Formacion),
 *  que TypeScript no deja `extends`-ear de forma confiable (perdía `id` en
 *  GrupoVinculadoResuelto — ver build error). Sigue aceptando indistintamente
 *  filas de Organo o de Formacion en runtime, porque ambas son
 *  estructuralmente esa misma base. */
export type EntradaCatalogoGrupo = EntidadCatalogoGrupoBase;

/** Padres válidos hoy contra el catálogo formacion/organo (no incluye
 *  veta/grano/compuesto — esos tienen su propio hook, useFormacionVetas). */
export type PadreTipoEntidad = "item" | "mineral" | "criatura" | "planta";

/** Hijos válidos: los dos catálogos que consume este hook. */
export type HijoTipoCatalogo = "formacion" | "organo";

/** Fila cruda de estructura_componentes, ya con el par padre/hijo fijo. */
interface VinculoEstructura {
  id: string;
  padre_id: string;
  hijo_id: string;
  created_at: string;
  [key: string]: unknown;
}

export interface GrupoVinculadoResuelto extends EntradaCatalogoGrupo {
  /** Id de la fila puente — necesario para desvincular sin borrar el grupo del catálogo. */
  vinculo_id: string;
}

export function useEntidadVinculosGrupo({
  entidadId,
  padreTipo,
  tablaCatalogo,
  hijoTipo,
  catalogo,
}: {
  /** Id de la entidad padre (item, planta, mineral, criatura). */
  entidadId: string;
  /** Tipo de la entidad padre — fija qué fila valida el trigger de Supabase. */
  padreTipo: PadreTipoEntidad;
  /** Nombre de la tabla de catálogo propia, ej. "formaciones" u "organos". */
  tablaCatalogo: string;
  /** Tipo del catálogo hijo en estructura_componentes ('formacion' | 'organo'). */
  hijoTipo: HijoTipoCatalogo;
  /** Catálogo ya cargado por el padre (ej. useFormaciones().items). */
  catalogo: EntradaCatalogoGrupo[];
}) {
  const [vinculos, setVinculos] = useState<VinculoEstructura[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("estructura_componentes")
      .select("*")
      .eq("padre_tipo", padreTipo)
      .eq("padre_id", entidadId)
      .eq("hijo_tipo", hijoTipo)
      .order("created_at", { ascending: true });

    if (!error && data) setVinculos(data as VinculoEstructura[]);
    setLoading(false);
  }, [padreTipo, hijoTipo, entidadId]);

  useEffect(() => {
    if (entidadId) void load();
  }, [entidadId, load]);

  // ── Vinculados a esta entidad, ya resueltos contra el catálogo compartido
  // (si un vínculo apunta a un hijo_id que ya no existe, se ignora
  // silenciosamente — huérfano, mismo espíritu que antes). ────────────────
  const items = useMemo<GrupoVinculadoResuelto[]>(() => {
    const porId = new Map(catalogo.map((g) => [g.id, g]));
    return vinculos
      .map((v) => {
        const grupo = porId.get(v.hijo_id);
        if (!grupo) return null;
        return { ...grupo, vinculo_id: v.id };
      })
      .filter((g): g is GrupoVinculadoResuelto => g !== null);
  }, [vinculos, catalogo]);

  // ── Crear un registro nuevo en tablaCatalogo + vincularlo ──────────────
  // Ya no lleva `componentes` — un Organo/Formacion nuevo nace vacío
  // (solo nombre) y su composición se arma después, por separado, vía
  // useOrganoTejidos/useFormacionVetas sobre el id ya creado.
  const crearYVincular = useCallback(
    async (nombre: string = "") => {
      const { data: nuevoGrupo, error: errorGrupo } = await supabase
        .from(tablaCatalogo)
        .insert([{ nombre, funcion: null }])
        .select()
        .single();
      if (errorGrupo || !nuevoGrupo) return null;

      const { data: vinculo, error: errorVinculo } = await supabase
        .from("estructura_componentes")
        .insert([
          {
            padre_tipo: padreTipo,
            padre_id: entidadId,
            hijo_tipo: hijoTipo,
            hijo_id: (nuevoGrupo as EntradaCatalogoGrupo).id,
          },
        ])
        .select()
        .single();
      if (errorVinculo || !vinculo) {
        // Rollback best-effort: el grupo queda huérfano en el catálogo, sin
        // romper nada — mismo trade-off que antes.
        return null;
      }

      setVinculos((prev) => [...prev, vinculo as VinculoEstructura]);
      return { ...(nuevoGrupo as EntradaCatalogoGrupo), vinculo_id: (vinculo as VinculoEstructura).id };
    },
    [tablaCatalogo, padreTipo, hijoTipo, entidadId],
  );

  // ── Vincular un registro ya existente del catálogo ─────────────────────
  const vincularExistente = useCallback(
    async (hijoId: string) => {
      if (vinculos.some((v) => v.hijo_id === hijoId)) return null;

      const { data: vinculo, error } = await supabase
        .from("estructura_componentes")
        .insert([{ padre_tipo: padreTipo, padre_id: entidadId, hijo_tipo: hijoTipo, hijo_id: hijoId }])
        .select()
        .single();
      if (error || !vinculo) return null;

      setVinculos((prev) => [...prev, vinculo as VinculoEstructura]);
      return vinculo as VinculoEstructura;
    },
    [padreTipo, hijoTipo, entidadId, vinculos],
  );

  // ── Actualizar el registro en tablaCatalogo (afecta a todas las
  // entidades que lo tengan vinculado) ────────────────────────────────────
  const actualizar = useCallback(
    async (hijoId: string, updates: Partial<EntradaCatalogoGrupo>) => {
      const { error } = await supabase.from(tablaCatalogo).update(updates).eq("id", hijoId);
      if (error) {
        console.error("[useEntidadVinculosGrupo] error actualizando grupo:", error);
      }
    },
    [tablaCatalogo],
  );

  // ── Desvincular (borra solo la fila puente, el registro sigue en
  // el catálogo para otras entidades) ─────────────────────────────────────
  const desvincular = useCallback(async (vinculoId: string) => {
    setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
    await supabase.from("estructura_componentes").delete().eq("id", vinculoId);
  }, []);

  return {
    items,
    loading,
    crearYVincular,
    vincularExistente,
    actualizar,
    desvincular,
    load,
  };
}
