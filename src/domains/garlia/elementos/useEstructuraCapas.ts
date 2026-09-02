"use client";

/**
 * useEstructuraCapas.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Resuelve y edita, para UNA Estructura, dos capas de datos que ya vivían en
 * Supabase pero que el editor (EstructurasPage → CapasYUnionesBloque) antes
 * solo leía:
 *
 *   1. estructura_subcomponentes: las piezas/capas ordenadas de la
 *      estructura (ej. Esmalte → Dentina → Pulpa del Diente), cada una con
 *      su propio geometria_id opcional (NULL si esa capa todavía no tiene
 *      geometría explícita enlazada — caso real hoy en el Diente).
 *      → useEstructuraSubcomponentes(estructuraId)
 *   2. estructura_uniones: la relación estructural ENTRE dos subcomponentes
 *      (ej. la interfaz Esmalte↔Dentina), con intensidad/flexibilidad/
 *      reversibilidad y un `estado` que distingue una unión con geometría
 *      de contacto declarada ("declarada"/"explicita") de una simple
 *      adyacencia asumida por orden de capas ("inferida").
 *      → useEstructuraUniones(estructuraId)
 *
 * componente_tipo/componente_a_tipo/componente_b_tipo pueden apuntar a
 * "compuesto" | "estructura" | "material" — se resuelven los tres catálogos
 * en memoria vía useCatalogosPolimorficos (mismo patrón que
 * useEstructuraComposicion) para no necesitar un embed relacional que
 * PostgREST no ofrece para FKs polimórficas.
 *
 * 2026-09-02: ambos hooks se vuelven editables (agregar/actualizar/
 * eliminar), mismo pedido y mismo patrón de escritura optimista con
 * rollback que useMaterialComponentes.ts / useEstructuraComposicion.ts.
 * Antes eran solo lectura porque estas tablas se poblaban únicamente por
 * migración/cálculo (fn_asignar_enlaces_compuesto y afines); el pedido
 * explícito fue llevar edición manual también acá. Se exportan dos hooks
 * separados (en vez de uno combinado como antes) porque cada tabla
 * necesita su propio agregar/actualizar/eliminar independiente.
 */

import { useCallback, useMemo } from "react";

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
import { supabase } from "@/infra/supabase/supabase";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

/** Un subcomponente ya resuelto, con el nombre legible de a qué apunta. */
export interface SubcomponenteResuelto {
  id: string;
  componente_tipo: string;
  componente_id: string;
  nombre: string;
  cantidad: number | null;
  proporcion: number | null;
  rol: string | null;
  orden: number | null;
  geometria_id: string | null;
}

/** Una unión ya resuelta, con el nombre legible de ambos extremos. */
export interface UnionResuelta {
  id: string;
  componente_a_tipo: string;
  componente_a_id: string;
  componente_b_tipo: string;
  componente_b_id: string;
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

/** Ítem de catálogo polimórfico, para poblar selectores de
 *  compuesto/estructura/material sin importarle a quien lo consume de qué
 *  tabla viene cada opción. */
export interface OpcionPolimorfica {
  id: string;
  tipo: "compuesto" | "estructura" | "material";
  nombre: string;
}

/** Catálogos de los tres tipos que pueden ocupar componente_tipo /
 *  componente_a_tipo / componente_b_tipo, resueltos en memoria — mismo
 *  patrón que useEstructuraComposicion, ahora también expuesto para
 *  alimentar selectores de "agregar capa" / "agregar unión". */
export function useCatalogosPolimorficos() {
  const { data: compuestos, loading: loadingCompuestos } = useSupabaseData<Compuesto>(
    CONFIG_COMPUESTOS.tabla,
    { select: CONFIG_COMPUESTOS.select },
  );
  const { data: estructuras, loading: loadingEstructuras } = useSupabaseData<Estructura>(
    CONFIG_ESTRUCTURAS.tabla,
    { select: CONFIG_ESTRUCTURAS.select },
  );
  const { data: materiales, loading: loadingMateriales } = useSupabaseData<Material>(
    CONFIG_MATERIALES.tabla,
    { select: CONFIG_MATERIALES.select },
  );

  const nombrePorId = useMemo(() => {
    const mapa: Record<string, string> = {};
    for (const c of compuestos) mapa[c.id] = c.nombre;
    for (const e of estructuras) mapa[e.id] = e.nombre;
    for (const m of materiales) mapa[m.id] = m.nombre;
    return mapa;
  }, [compuestos, estructuras, materiales]);

  const opciones = useMemo<OpcionPolimorfica[]>(() => {
    return [
      ...compuestos.map((c) => ({ id: c.id, tipo: "compuesto" as const, nombre: c.nombre })),
      ...estructuras.map((e) => ({ id: e.id, tipo: "estructura" as const, nombre: e.nombre })),
      ...materiales.map((m) => ({ id: m.id, tipo: "material" as const, nombre: m.nombre })),
    ];
  }, [compuestos, estructuras, materiales]);

  return {
    nombrePorId,
    opciones,
    loading: loadingCompuestos || loadingEstructuras || loadingMateriales,
  };
}

/** Estados considerados "geometría de contacto declarada explícitamente",
 *  frente a una simple adyacencia inferida por orden de capas. Se usa solo
 *  para el rótulo visual — el dato crudo (`estado`) siempre se muestra tal
 *  cual viene de Supabase. */
const ESTADOS_UNION_EXPLICITA = new Set(["declarada", "explicita", "explícita"]);

export function esUnionExplicita(estado: string | null): boolean {
  return !!estado && ESTADOS_UNION_EXPLICITA.has(estado.toLowerCase());
}

/**
 * Capas ordenadas (estructura_subcomponentes) de una Estructura —
 * editable: agregar/actualizar/eliminar, mismo patrón optimista con
 * rollback que useMaterialComponentes.ts.
 */
export function useEstructuraSubcomponentes(estructuraId: string | null) {
  const { nombrePorId, loading: loadingCatalogos } = useCatalogosPolimorficos();

  const { data: subcomponentesTodos, setData: setSubcomponentes, loading: loadingSub } =
    useSupabaseData<EstructuraSubcomponente>(CONFIG_ESTRUCTURA_SUBCOMPONENTES.tabla, {
      select: CONFIG_ESTRUCTURA_SUBCOMPONENTES.select,
      order: { campo: "orden" },
    });

  const crudos = useMemo(
    () =>
      estructuraId
        ? subcomponentesTodos.filter((s) => s.estructura_id === estructuraId)
        : [],
    [subcomponentesTodos, estructuraId],
  );

  const items = useMemo<SubcomponenteResuelto[]>(
    () =>
      crudos.map((s) => ({
        id: s.id,
        componente_tipo: s.componente_tipo,
        componente_id: s.componente_id,
        nombre: nombrePorId[s.componente_id] ?? "(sin resolver)",
        cantidad: s.cantidad,
        proporcion: s.proporcion,
        rol: s.rol,
        orden: s.orden,
        geometria_id: s.geometria_id,
      })),
    [crudos, nombrePorId],
  );

  // ── Agregar una capa (compuesto/estructura/material) a la Estructura ───
  const agregar = useCallback(
    async (params: {
      componente_tipo: "compuesto" | "estructura" | "material" | string;
      componente_id: string;
      cantidad?: number | null;
      proporcion?: number | null;
      rol?: string | null;
      geometria_id?: string | null;
    }) => {
      if (!estructuraId) return null;
      const ordenMax = subcomponentesTodos
        .filter((s) => s.estructura_id === estructuraId)
        .reduce((max, s) => Math.max(max, s.orden ?? 0), 0);
      const { data: nuevo, error } = await supabase
        .from(CONFIG_ESTRUCTURA_SUBCOMPONENTES.tabla)
        .insert([
          {
            estructura_id: estructuraId,
            componente_tipo: params.componente_tipo,
            componente_id: params.componente_id,
            cantidad: params.cantidad ?? null,
            proporcion: params.proporcion ?? null,
            rol: params.rol ?? null,
            geometria_id: params.geometria_id ?? null,
            orden: ordenMax + 1,
          },
        ])
        .select()
        .single();
      if (error || !nuevo) {
        console.error("[useEstructuraSubcomponentes] error agregando capa:", error);
        return null;
      }
      const fila = nuevo as unknown as EstructuraSubcomponente;
      setSubcomponentes((prev) => [...prev, fila]);
      return fila;
    },
    [estructuraId, subcomponentesTodos, setSubcomponentes],
  );

  // ── Editar cantidad/proporción/rol/orden/geometría de una capa ─────────
  const actualizar = useCallback(
    async (
      id: string,
      cambios: Partial<
        Pick<
          EstructuraSubcomponente,
          "cantidad" | "proporcion" | "rol" | "orden" | "geometria_id"
        >
      >,
    ) => {
      const anterior = subcomponentesTodos.find((row) => row.id === id);
      setSubcomponentes((prev) => prev.map((row) => (row.id === id ? { ...row, ...cambios } : row)));
      const { error } = await supabase
        .from(CONFIG_ESTRUCTURA_SUBCOMPONENTES.tabla)
        .update(cambios)
        .eq("id", id);
      if (error) {
        console.error("[useEstructuraSubcomponentes] error actualizando capa:", error);
        if (anterior) {
          setSubcomponentes((prev) => prev.map((row) => (row.id === id ? anterior : row)));
        }
        return { ok: false, error };
      }
      return { ok: true, error: null };
    },
    [subcomponentesTodos, setSubcomponentes],
  );

  // ── Quitar una capa ──────────────────────────────────────────────────────
  const eliminar = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from(CONFIG_ESTRUCTURA_SUBCOMPONENTES.tabla)
        .delete()
        .eq("id", id);
      if (error) {
        console.error("[useEstructuraSubcomponentes] error eliminando capa:", error);
        return { ok: false, error };
      }
      setSubcomponentes((prev) => prev.filter((row) => row.id !== id));
      return { ok: true, error: null };
    },
    [setSubcomponentes],
  );

  return {
    items,
    loading: estructuraId ? loadingSub || loadingCatalogos : false,
    agregar,
    actualizar,
    eliminar,
  };
}

/**
 * Uniones estructurales (estructura_uniones) ENTRE dos subcomponentes de
 * una misma Estructura — editable: agregar/actualizar/eliminar, mismo
 * patrón optimista con rollback.
 */
export function useEstructuraUniones(estructuraId: string | null) {
  const { nombrePorId, loading: loadingCatalogos } = useCatalogosPolimorficos();

  const { data: unionesTodas, setData: setUniones, loading: loadingUniones } =
    useSupabaseData<EstructuraUnion>(CONFIG_ESTRUCTURA_UNIONES.tabla, {
      select: CONFIG_ESTRUCTURA_UNIONES.select,
    });

  const crudas = useMemo(
    () => (estructuraId ? unionesTodas.filter((u) => u.estructura_id === estructuraId) : []),
    [unionesTodas, estructuraId],
  );

  const items = useMemo<UnionResuelta[]>(
    () =>
      crudas.map((u) => ({
        id: u.id,
        componente_a_tipo: u.componente_a_tipo,
        componente_a_id: u.componente_a_id,
        componente_b_tipo: u.componente_b_tipo,
        componente_b_id: u.componente_b_id,
        nombre_a: nombrePorId[u.componente_a_id] ?? "(sin resolver)",
        nombre_b: nombrePorId[u.componente_b_id] ?? "(sin resolver)",
        intensidad: u.intensidad,
        flexibilidad: u.flexibilidad,
        reversibilidad: u.reversibilidad,
        rol: u.rol,
        tipo_unidad: u.tipo_unidad,
        area_relativa: u.area_relativa,
        estado: u.estado,
      })),
    [crudas, nombrePorId],
  );

  // ── Agregar una unión entre dos componentes (a y b) de la Estructura ────
  const agregar = useCallback(
    async (params: {
      componente_a_tipo: "compuesto" | "estructura" | "material" | string;
      componente_a_id: string;
      componente_b_tipo: "compuesto" | "estructura" | "material" | string;
      componente_b_id: string;
      intensidad?: number | null;
      flexibilidad?: number | null;
      reversibilidad?: number | null;
      rol?: string | null;
      tipo_unidad?: string | null;
      area_relativa?: number | null;
      estado?: string | null;
    }) => {
      if (!estructuraId) return null;
      const { data: nuevo, error } = await supabase
        .from(CONFIG_ESTRUCTURA_UNIONES.tabla)
        .insert([
          {
            estructura_id: estructuraId,
            componente_a_tipo: params.componente_a_tipo,
            componente_a_id: params.componente_a_id,
            componente_b_tipo: params.componente_b_tipo,
            componente_b_id: params.componente_b_id,
            intensidad: params.intensidad ?? null,
            flexibilidad: params.flexibilidad ?? null,
            reversibilidad: params.reversibilidad ?? null,
            rol: params.rol ?? null,
            tipo_unidad: params.tipo_unidad ?? null,
            area_relativa: params.area_relativa ?? null,
            // Una unión creada a mano desde el editor declara geometría de
            // contacto explícita por definición — no es una adyacencia
            // inferida por orden de capas. Se puede editar después si
            // corresponde otro estado.
            estado: params.estado ?? "declarada",
          },
        ])
        .select()
        .single();
      if (error || !nuevo) {
        console.error("[useEstructuraUniones] error agregando unión:", error);
        return null;
      }
      const fila = nuevo as unknown as EstructuraUnion;
      setUniones((prev) => [...prev, fila]);
      return fila;
    },
    [estructuraId, setUniones],
  );

  // ── Editar intensidad/flexibilidad/reversibilidad/rol/etc. de una unión ─
  const actualizar = useCallback(
    async (
      id: string,
      cambios: Partial<
        Pick<
          EstructuraUnion,
          | "intensidad"
          | "flexibilidad"
          | "reversibilidad"
          | "rol"
          | "tipo_unidad"
          | "area_relativa"
          | "estado"
        >
      >,
    ) => {
      const anterior = unionesTodas.find((row) => row.id === id);
      setUniones((prev) => prev.map((row) => (row.id === id ? { ...row, ...cambios } : row)));
      const { error } = await supabase
        .from(CONFIG_ESTRUCTURA_UNIONES.tabla)
        .update(cambios)
        .eq("id", id);
      if (error) {
        console.error("[useEstructuraUniones] error actualizando unión:", error);
        if (anterior) {
          setUniones((prev) => prev.map((row) => (row.id === id ? anterior : row)));
        }
        return { ok: false, error };
      }
      return { ok: true, error: null };
    },
    [unionesTodas, setUniones],
  );

  // ── Quitar una unión ─────────────────────────────────────────────────────
  const eliminar = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from(CONFIG_ESTRUCTURA_UNIONES.tabla)
        .delete()
        .eq("id", id);
      if (error) {
        console.error("[useEstructuraUniones] error eliminando unión:", error);
        return { ok: false, error };
      }
      setUniones((prev) => prev.filter((row) => row.id !== id));
      return { ok: true, error: null };
    },
    [setUniones],
  );

  return {
    items,
    loading: estructuraId ? loadingUniones || loadingCatalogos : false,
    agregar,
    actualizar,
    eliminar,
  };
}

/** @deprecated combinaba subcomponentes + uniones en un solo hook de solo
 *  lectura. Usar useEstructuraSubcomponentes + useEstructuraUniones por
 *  separado — cada tabla necesita su propio CRUD independiente. Se deja
 *  como wrapper de compatibilidad por si queda algún consumidor externo al
 *  dominio que todavía importe el nombre viejo. */
export function useEstructuraCapas(estructuraId: string | null) {
  const sub = useEstructuraSubcomponentes(estructuraId);
  const uni = useEstructuraUniones(estructuraId);
  return {
    subcomponentes: sub.items,
    uniones: uni.items,
    loading: sub.loading || uni.loading,
  };
}
