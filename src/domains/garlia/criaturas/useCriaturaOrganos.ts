"use client";

/**
 * useCriaturaOrganos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Hook para CRUD de Órganos de una criatura. Calco de
 * usePlantaOrganosProcesos.ts (ver ese archivo para el razonamiento
 * completo sobre el patrón de vínculo N:N), sin la parte de Procesos: no
 * existe todavía "criatura_reacciones", así que Órganos de Fauna es
 * solo composición macro (ensamblaje de compuestos), sin etapas de ciclo
 * de vida vinculadas a Reacciones.
 *
 * Distinto de `perfiles_atomicos_criatura`: ese es composición directa por
 * ELEMENTO (nivel micro, como `compuestos`), esto es ensamblaje por
 * COMPUESTO (nivel macro, como Formaciones/Órganos del resto del árbol).
 * No hay solapamiento, son capas distintas.
 *
 * Órganos: catálogo propio — tabla real "estructuras_ensambladas"
 * (separada de "grupos_compuestos", compartida con Formaciones de
 * Minerales/Items y Órganos de Flora). Este hook resuelve los vínculos de
 * `criaturaId` (tabla puente "criatura_organos", FK `grupo_compuesto_id` →
 * estructuras_ensambladas.id) contra el catálogo de Órganos (recibido como
 * parámetro, ya cargado por useEstructurasEnsambladas en el componente
 * padre) y expone:
 *   - crearYVincularOrgano: crea un Organo nuevo y lo vincula a esta
 *     criatura ("Crear órgano" en el picker).
 *   - vincularOrganoExistente: vincula un Organo ya existente del catálogo
 *     ("Usar uno existente" en el picker) — no duplica nada.
 *   - actualizarOrgano: edita la fórmula/nombre/notas del Organo en el
 *     catálogo — el cambio se refleja en todas las criaturas que lo usen
 *     (y en plantas/minerales/items si comparten el mismo Órgano).
 *   - desvincularOrgano: quita el vínculo criatura↔órgano (borra la fila
 *     puente), sin borrar el Organo del catálogo — así sigue disponible
 *     para otras criaturas / para volver a vincularlo.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import type { GrupoCompuesto } from "@/domains/garlia/elementos/types";

export interface CriaturaOrgano {
  id: string;
  criatura_id: string;
  grupo_compuesto_id: string;
  created_at: string;
}

export type CriaturaOrganoResuelto = GrupoCompuesto & { vinculo_id: string };

export function useCriaturaOrganos(criaturaId: string, catalogoOrganos: GrupoCompuesto[]) {
  const [vinculos, setVinculos] = useState<CriaturaOrgano[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Cargar vínculos (criatura_organos) ──────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);

    const { data: vinculoData, error: vinculoError } = await supabase
      .from("criatura_organos")
      .select("*")
      .eq("criatura_id", criaturaId)
      .order("created_at", { ascending: true });

    if (!vinculoError && vinculoData) {
      setVinculos(vinculoData as CriaturaOrgano[]);
    }

    setLoading(false);
  }, [criaturaId]);

  useEffect(() => {
    if (criaturaId) void load();
  }, [criaturaId, load]);

  // ── Órganos vinculados a esta criatura, ya resueltos contra el catálogo ─
  // (si un vínculo apunta a un grupo_compuesto_id que ya no existe en el
  // catálogo, se ignora silenciosamente — huérfano, mismo espíritu que
  // usePlantaOrganosProcesos).
  const organos = useMemo<CriaturaOrganoResuelto[]>(() => {
    const porId = new Map(catalogoOrganos.map((g) => [g.id, g]));
    return vinculos
      .map((v) => {
        const grupo = porId.get(v.grupo_compuesto_id);
        if (!grupo) return null;
        return { ...grupo, vinculo_id: v.id };
      })
      .filter((o): o is CriaturaOrganoResuelto => o !== null);
  }, [vinculos, catalogoOrganos]);

  // ── Crear un Organo nuevo + vincularlo a esta criatura ──────────────────
  const crearYVincularOrgano = useCallback(
    async (nombre: string = "") => {
      const { data: nuevoGrupo, error: errorGrupo } = await supabase
        .from("estructuras_ensambladas")
        .insert([{ nombre, componentes: [] }])
        .select()
        .single();
      if (errorGrupo || !nuevoGrupo) return null;

      const { data: vinculo, error: errorVinculo } = await supabase
        .from("criatura_organos")
        .insert([{ criatura_id: criaturaId, grupo_compuesto_id: (nuevoGrupo as GrupoCompuesto).id }])
        .select()
        .single();
      if (errorVinculo || !vinculo) {
        // Rollback best-effort: el grupo queda huérfano en el catálogo, sin
        // romper nada — mismo trade-off que usePlantaOrganosProcesos.
        return null;
      }

      setVinculos((prev) => [...prev, vinculo as CriaturaOrgano]);
      return { ...(nuevoGrupo as GrupoCompuesto), vinculo_id: (vinculo as CriaturaOrgano).id };
    },
    [criaturaId],
  );

  // ── Vincular un GrupoCompuesto ya existente del catálogo a esta criatura ─
  const vincularOrganoExistente = useCallback(
    async (grupoCompuestoId: string) => {
      // Evita duplicar el vínculo si ya está vinculado.
      if (vinculos.some((v) => v.grupo_compuesto_id === grupoCompuestoId)) return null;

      const { data: vinculo, error } = await supabase
        .from("criatura_organos")
        .insert([{ criatura_id: criaturaId, grupo_compuesto_id: grupoCompuestoId }])
        .select()
        .single();
      if (error || !vinculo) return null;

      setVinculos((prev) => [...prev, vinculo as CriaturaOrgano]);
      return vinculo as CriaturaOrgano;
    },
    [criaturaId, vinculos],
  );

  // ── Actualizar el Organo en el catálogo (afecta a todas las criaturas
  // que lo tengan vinculado, y a plantas/minerales/items si comparten el
  // mismo Órgano) ──────────────────────────────────────────────────────────
  const actualizarOrgano = useCallback(
    async (grupoCompuestoId: string, updates: Partial<GrupoCompuesto>) => {
      const { error } = await supabase
        .from("estructuras_ensambladas")
        .update(updates)
        .eq("id", grupoCompuestoId);
      if (error) {
        console.error("[useCriaturaOrganos] error actualizando organo:", error);
      }
    },
    [],
  );

  // ── Desvincular (borra solo la fila puente, el GrupoCompuesto sigue en
  // el catálogo para otras criaturas) ─────────────────────────────────────
  const desvincularOrgano = useCallback(async (vinculoId: string) => {
    setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
    await supabase.from("criatura_organos").delete().eq("id", vinculoId);
  }, []);

  return {
    organos,
    loading,
    crearYVincularOrgano,
    vincularOrganoExistente,
    actualizarOrgano,
    desvincularOrgano,
    load,
  };
}
