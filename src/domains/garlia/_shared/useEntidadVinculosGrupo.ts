"use client";

/**
 * useEntidadVinculosGrupo.ts
 * ───────────────────────────────────────────────────────────────────────────
 * FASE 7 — reescrito para usar la tabla puente única `estructura_componentes`
 * en vez de una tabla dedicada por entidad (item_estructura,
 * mineral_formaciones, criatura_organos, planta_organos — todas
 * consolidadas ahí, ver migración fase7_unificacion_estructura_componentes,
 * y el DROP de esas 4 tablas en Dexie v34 en infra/supabase/db.ts).
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
 * FASE 7 (cont.) — antes pegaba directo a `supabase`, sin cache local ni
 * cola offline. Ahora pasa por useSupabaseData("estructura_componentes"),
 * igual que el resto de entidades: lee de Dexie al instante y revalida
 * contra Supabase en segundo plano (ver DEXIE_TABLES/OFFLINE_WRITABLE en
 * useSupabaseData.ts y SYNC_TABLES en lib/utils/offlineSync.ts, ambos ya
 * incluyen "estructura_componentes"). Como useSupabaseData trae la tabla
 * entera (no tiene .eq() propio — es una tabla puente compartida por los
 * 4 tipos de padre), se filtra en memoria por padre_tipo/padre_id/hijo_tipo
 * acá dentro, igual que el resto de hooks de este dominio.
 *
 * La firma pública (items, loading, crearYVincular, vincularExistente,
 * actualizar, desvincular, load) se mantiene EXACTA para no romper a los
 * consumidores existentes (EditorItem.tsx, useCriaturaOrganos.ts,
 * usePlantaOrganosProcesos.ts, useMineralFormacionesProcesos.ts).
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

import { useCallback, useMemo } from "react";
import { supabase } from "@/infra/supabase/supabase";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

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
  padre_tipo: string;
  padre_id: string;
  hijo_tipo: string;
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
  // Trae TODA la tabla estructura_componentes (compartida por los 4 tipos
  // de padre) con cache offline real vía Dexie — mismo patrón que el resto
  // de entidades. Filtramos por padre_tipo/padre_id/hijo_tipo en memoria,
  // igual que syncDexieWithRemote hace con el resto de tablas.
  const {
    data: todosLosVinculos,
    loading,
    addRow,
    deleteRow,
    refetch,
  } = useSupabaseData<VinculoEstructura>("estructura_componentes");

  const vinculos = useMemo(
    () =>
      todosLosVinculos.filter(
        (v) =>
          v.padre_tipo === padreTipo &&
          v.padre_id === entidadId &&
          v.hijo_tipo === hijoTipo,
      ),
    [todosLosVinculos, padreTipo, entidadId, hijoTipo],
  );

  // `load` se conserva por compatibilidad de firma — useSupabaseData ya
  // carga automáticamente al montar y revalida solo; refetch fuerza una
  // relectura manual si algún consumidor la necesita explícitamente.
  const load = useCallback(async () => {
    await refetch();
  }, [refetch]);

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
  //
  // El catálogo (tablaCatalogo: "organos"/"formaciones") sigue creándose
  // directo contra supabase, no vía useSupabaseData — este hook solo recibe
  // el catálogo ya cargado por el padre (useOrganos/useFormaciones), no lo
  // gestiona. Solo el vínculo en estructura_componentes pasa por addRow
  // (con su cache/cola offline).
  const crearYVincular = useCallback(
    async (nombre: string = "") => {
      const { data: nuevoGrupo, error: errorGrupo } = await supabase
        .from(tablaCatalogo)
        .insert([{ nombre, funcion: null }])
        .select()
        .single();
      if (errorGrupo || !nuevoGrupo) return null;

      const { data: vinculo, error: errorVinculo } = await addRow({
        padre_tipo: padreTipo,
        padre_id: entidadId,
        hijo_tipo: hijoTipo,
        hijo_id: (nuevoGrupo as EntradaCatalogoGrupo).id,
      });
      if (errorVinculo || !vinculo) {
        // Rollback best-effort: el grupo queda huérfano en el catálogo, sin
        // romper nada — mismo trade-off que antes.
        return null;
      }

      return {
        ...(nuevoGrupo as EntradaCatalogoGrupo),
        vinculo_id: (vinculo as VinculoEstructura).id,
      };
    },
    [tablaCatalogo, padreTipo, hijoTipo, entidadId, addRow],
  );

  // ── Vincular un registro ya existente del catálogo ─────────────────────
  const vincularExistente = useCallback(
    async (hijoId: string) => {
      if (vinculos.some((v) => v.hijo_id === hijoId)) return null;

      const { data: vinculo, error } = await addRow({
        padre_tipo: padreTipo,
        padre_id: entidadId,
        hijo_tipo: hijoTipo,
        hijo_id: hijoId,
      });
      if (error || !vinculo) return null;

      return vinculo as VinculoEstructura;
    },
    [padreTipo, hijoTipo, entidadId, vinculos, addRow],
  );

  // ── Actualizar el registro en tablaCatalogo (afecta a todas las
  // entidades que lo tengan vinculado) — sigue directo contra supabase,
  // igual que antes: es el catálogo compartido, no el vínculo. ───────────
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
  const desvincular = useCallback(
    async (vinculoId: string) => {
      await deleteRow(vinculoId);
    },
    [deleteRow],
  );

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
