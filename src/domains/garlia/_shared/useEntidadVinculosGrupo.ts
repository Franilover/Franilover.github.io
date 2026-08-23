"use client";

/**
 * useEntidadVinculosGrupo.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Generaliza usePlantaOrganosProcesos (flora/) para cualquier entidad que
 * necesite vincular N:N un catálogo propio de Órganos o Formaciones — mismo
 * patrón que usan Formaciones de Minerales/Items (tabla real "formaciones")
 * y Órganos de Flora/Criaturas (tabla real "organos").
 *
 * Cada catálogo (Órganos u Formaciones) es su propia tabla real, pasada
 * acá vía `tablaCatalogo`. La entidad vinculada sigue siendo una fila
 * puente {entidad_id, grupo_compuesto_id} distinta por relación — el
 * nombre de columna `grupo_compuesto_id` es histórico (de cuando existía
 * una tabla "grupos_compuestos" unificada) pero hoy apunta a organos.id o
 * formaciones.id según el caso. Editar el registro en el catálogo
 * actualiza todas las entidades que lo tengan vinculado.
 *
 * A diferencia de la versión vieja (cuando el catálogo era GrupoCompuesto
 * con `componentes` inline), un Órgano/Formación ya NO tiene fórmula
 * propia — crearYVincular solo crea el registro vacío (nombre/función);
 * la composición (Tejidos/Granos) se arma después, por separado, vía
 * useOrganoTejidos/useFormacionVetas sobre el id ya creado.
 *
 * Uso:
 *   const formaciones = useEntidadVinculosGrupo({
 *     entidadId: item.id,
 *     tablaCatalogo: "formaciones",
 *     tablaPuente: "item_estructura",
 *     columnaFk: "item_id",
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

/** Fila cruda de una tabla puente {id, [columnaFk]: string, grupo_compuesto_id, created_at}. */
interface VinculoGrupo {
  id: string;
  grupo_compuesto_id: string;
  created_at: string;
  [key: string]: unknown;
}

export interface GrupoVinculadoResuelto extends EntradaCatalogoGrupo {
  /** Id de la fila puente — necesario para desvincular sin borrar el grupo del catálogo. */
  vinculo_id: string;
}

export function useEntidadVinculosGrupo({
  entidadId,
  tablaCatalogo,
  tablaPuente,
  columnaFk,
  catalogo,
}: {
  /** Id de la entidad padre (item, planta, mineral…). */
  entidadId: string;
  /** Nombre de la tabla de catálogo propia, ej. "formaciones" u "organos". */
  tablaCatalogo: string;
  /** Nombre de la tabla puente en Supabase, ej. "item_estructura". */
  tablaPuente: string;
  /** Columna FK de la tabla puente que apunta a la entidad padre, ej. "item_id". */
  columnaFk: string;
  /** Catálogo ya cargado por el padre (ej. useFormaciones().items). */
  catalogo: EntradaCatalogoGrupo[];
}) {
  const [vinculos, setVinculos] = useState<VinculoGrupo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(tablaPuente)
      .select("*")
      .eq(columnaFk, entidadId)
      .order("created_at", { ascending: true });

    if (!error && data) setVinculos(data as VinculoGrupo[]);
    setLoading(false);
  }, [tablaPuente, columnaFk, entidadId]);

  useEffect(() => {
    if (entidadId) void load();
  }, [entidadId, load]);

  // ── Vinculados a esta entidad, ya resueltos contra el catálogo compartido
  // (si un vínculo apunta a un grupo_compuesto_id que ya no existe, se
  // ignora silenciosamente — huérfano, mismo espíritu que Flora). ─────────
  const items = useMemo<GrupoVinculadoResuelto[]>(() => {
    const porId = new Map(catalogo.map((g) => [g.id, g]));
    return vinculos
      .map((v) => {
        const grupo = porId.get(v.grupo_compuesto_id);
        if (!grupo) return null;
        return { ...grupo, vinculo_id: v.id };
      })
      .filter((g): g is GrupoVinculadoResuelto => g !== null);
  }, [vinculos, catalogo]);

  // ── Crear un registro nuevo en tablaCatalogo + vincularlo ──────────────
  // Ya no lleva `componentes` — un Organo/Formacion nuevo nace vacío
  // (solo nombre) y su composición se carga después, por separado, vía
  // useOrganoTejidos/useFormacionVetas sobre el id devuelto acá.
  const crearYVincular = useCallback(
    async (nombre: string = "") => {
      const { data: nuevoGrupo, error: errorGrupo } = await supabase
        .from(tablaCatalogo)
        .insert([{ nombre, funcion: null }])
        .select()
        .single();
      if (errorGrupo || !nuevoGrupo) return null;

      const { data: vinculo, error: errorVinculo } = await supabase
        .from(tablaPuente)
        .insert([{ [columnaFk]: entidadId, grupo_compuesto_id: (nuevoGrupo as EntradaCatalogoGrupo).id }])
        .select()
        .single();
      if (errorVinculo || !vinculo) {
        // Rollback best-effort: el grupo queda huérfano en el catálogo, sin
        // romper nada — mismo trade-off que usePlantaOrganosProcesos.
        return null;
      }

      setVinculos((prev) => [...prev, vinculo as VinculoGrupo]);
      return { ...(nuevoGrupo as EntradaCatalogoGrupo), vinculo_id: (vinculo as VinculoGrupo).id };
    },
    [tablaCatalogo, tablaPuente, columnaFk, entidadId],
  );

  // ── Vincular un registro ya existente del catálogo ─────────────────────
  const vincularExistente = useCallback(
    async (grupoCompuestoId: string) => {
      if (vinculos.some((v) => v.grupo_compuesto_id === grupoCompuestoId)) return null;

      const { data: vinculo, error } = await supabase
        .from(tablaPuente)
        .insert([{ [columnaFk]: entidadId, grupo_compuesto_id: grupoCompuestoId }])
        .select()
        .single();
      if (error || !vinculo) return null;

      setVinculos((prev) => [...prev, vinculo as VinculoGrupo]);
      return vinculo as VinculoGrupo;
    },
    [tablaPuente, columnaFk, entidadId, vinculos],
  );

  // ── Actualizar el registro en tablaCatalogo (afecta a todas las
  // entidades que lo tengan vinculado) ────────────────────────────────────
  const actualizar = useCallback(
    async (grupoCompuestoId: string, updates: Partial<EntradaCatalogoGrupo>) => {
      const { error } = await supabase
        .from(tablaCatalogo)
        .update(updates)
        .eq("id", grupoCompuestoId);
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
      setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
      await supabase.from(tablaPuente).delete().eq("id", vinculoId);
    },
    [tablaPuente],
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
