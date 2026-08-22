"use client";

/**
 * useEntidadVinculosGrupo.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Generaliza usePlantaOrganosProcesos (flora/) para cualquier entidad que
 * necesite vincular N:N un catálogo propio tipo "GrupoCompuesto" — mismo
 * patrón que usan Formaciones de Minerales/Items (tabla real
 * "estructuras_ensambladas").
 *
 * Órganos/Formaciones/Procesos/Habilidades viven en tablas propias — ya no
 * hay un `tipo` que discrimine dentro de "grupos_compuestos" — cada
 * catálogo (ej. "estructuras_ensambladas") es su propia tabla, pasada acá
 * vía `tablaCatalogo`. La entidad vinculada sigue siendo una fila puente
 * {entidad_id, grupo_compuesto_id} distinta por relación — editar la
 * fórmula en el catálogo actualiza todas las entidades que la tengan
 * vinculada.
 *
 * Uso:
 *   const formaciones = useEntidadVinculosGrupo({
 *     entidadId: item.id,
 *     tablaCatalogo: "estructuras_ensambladas",
 *     tablaPuente: "item_estructura",
 *     columnaFk: "item_id",
 *     catalogo: catalogoFormaciones, // useEstructurasEnsambladas().items
 *   });
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import type { GrupoCompuesto } from "@/domains/garlia/elementos/types";

/** Fila cruda de una tabla puente {id, [columnaFk]: string, grupo_compuesto_id, created_at}. */
interface VinculoGrupo {
  id: string;
  grupo_compuesto_id: string;
  created_at: string;
  [key: string]: unknown;
}

export interface GrupoVinculadoResuelto extends GrupoCompuesto {
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
  /** Nombre de la tabla de catálogo propia, ej. "estructuras_ensambladas". */
  tablaCatalogo: string;
  /** Nombre de la tabla puente en Supabase, ej. "item_estructura". */
  tablaPuente: string;
  /** Columna FK de la tabla puente que apunta a la entidad padre, ej. "item_id". */
  columnaFk: string;
  /** Catálogo ya cargado por el padre (ej. useFormaciones().items). */
  catalogo: GrupoCompuesto[];
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
  const crearYVincular = useCallback(
    async (nombre: string = "") => {
      const { data: nuevoGrupo, error: errorGrupo } = await supabase
        .from(tablaCatalogo)
        .insert([{ nombre, componentes: [] }])
        .select()
        .single();
      if (errorGrupo || !nuevoGrupo) return null;

      const { data: vinculo, error: errorVinculo } = await supabase
        .from(tablaPuente)
        .insert([{ [columnaFk]: entidadId, grupo_compuesto_id: (nuevoGrupo as GrupoCompuesto).id }])
        .select()
        .single();
      if (errorVinculo || !vinculo) {
        // Rollback best-effort: el grupo queda huérfano en el catálogo, sin
        // romper nada — mismo trade-off que usePlantaOrganosProcesos.
        return null;
      }

      setVinculos((prev) => [...prev, vinculo as VinculoGrupo]);
      return { ...(nuevoGrupo as GrupoCompuesto), vinculo_id: (vinculo as VinculoGrupo).id };
    },
    [tablaCatalogo, tablaPuente, columnaFk, entidadId],
  );

  // ── Vincular un GrupoCompuesto ya existente del catálogo ───────────────
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
    async (grupoCompuestoId: string, updates: Partial<GrupoCompuesto>) => {
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

  // ── Desvincular (borra solo la fila puente, el GrupoCompuesto sigue en
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
