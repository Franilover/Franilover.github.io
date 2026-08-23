"use client";

/**
 * useOrganoTejidos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Resuelve la composición de UN Órgano: la cadena real en Supabase
 * (migración ago-2026) es
 *   Organo → organo_tejidos (proporcion) → Tejido ─┬─ tejido_celulas (M:N) → Celula → celula_compuestos (M:N) → Compuesto
 *                                                   └─ tejido_compuestos (M:N) ──────────────────────────────→ Compuesto
 * Antes Tejido→Célula y Célula→Compuesto eran 1:1 (columnas celula_id /
 * compuesto_id, hoy legacy y sin uso); ahora un mismo Tejido puede tener
 * varias Células y varios Compuestos de matriz a la vez.
 *
 * `agregarCompuesto` sigue ofreciendo el flujo simplificado de UNA acción
 * por fila ("agregar compuesto a la fórmula del Órgano"): crea una Célula
 * nueva, la vincula al Compuesto vía celula_compuestos, crea un Tejido
 * nuevo, lo vincula a esa Célula vía tejido_celulas, y crea el vínculo
 * organo_tejidos — cuatro pasos en cadena en vez de tres, pero el mismo
 * resultado desde la UI: "un tejido hecho de este compuesto". Reutilizar
 * un Tejido/Célula ya existente entre Órganos sigue siendo posible (quedan
 * como catálogos propios en Supabase), pero no es parte de este flujo.
 *
 * `items.compuesto_id` y `catalogo_nombre` ahora resuelven contra la
 * PRIMERA Célula vinculada del Tejido (si el tejido tiene varias, esta
 * vista simplificada solo muestra la primera — para ver/editar todas usar
 * useTejidoCelulas.ts directamente sobre ese tejido_id).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";
import { db } from "@/infra/supabase/db";

import {
  CONFIG_CELULAS,
  CONFIG_CELULA_COMPUESTOS,
  CONFIG_TEJIDOS,
  CONFIG_TEJIDO_CELULAS,
  type Celula,
  type CelulaCompuesto,
  type OrganoTejido,
  type Tejido,
  type TejidoCelula,
} from "@/domains/garlia/elementos/types";

// ── Cache-first: leer/escribir Dexie para organo_tejidos/tejidos/celulas ──
// Mismo espíritu que useSupabaseData (ver v33 en infra/supabase/db.ts):
// pintar de inmediato con lo que ya haya en IndexedDB y revalidar contra
// Supabase en segundo plano, en vez de arrancar siempre en blanco.
async function leerVinculosDeDexie(organoId: string): Promise<OrganoTejido[]> {
  try {
    if (!db) return [];
    const rows = await db.organo_tejidos
      .where("organo_id")
      .equals(organoId)
      .toArray();
    return rows as unknown as OrganoTejido[];
  } catch {
    return [];
  }
}

async function leerTejidosDeDexie(ids: string[]): Promise<Record<string, Tejido>> {
  const out: Record<string, Tejido> = {};
  if (!db || ids.length === 0) return out;
  try {
    const rows = await db.tejidos.bulkGet(ids);
    for (const r of rows) if (r) out[(r as unknown as Tejido).id] = r as unknown as Tejido;
  } catch {}
  return out;
}

async function leerCelulasDeDexie(ids: string[]): Promise<Record<string, Celula>> {
  const out: Record<string, Celula> = {};
  if (!db || ids.length === 0) return out;
  try {
    const rows = await db.celulas.bulkGet(ids);
    for (const r of rows) if (r) out[(r as unknown as Celula).id] = r as unknown as Celula;
  } catch {}
  return out;
}

// tejido_celulas y celula_compuestos todavía no están registradas en
// infra/supabase/db.ts (Dexie) — no hay caché offline-first para estos dos
// niveles todavía, se leen siempre en vivo de Supabase (ver load() abajo).
// TODO: agregar ambas tablas a db.ts, mismo patrón que organo_tejidos.

async function guardarEnDexie(
  vinculos: OrganoTejido[],
  tejidos: Tejido[],
  celulas: Celula[],
) {
  try {
    if (!db) return;
    if (vinculos.length) await db.organo_tejidos.bulkPut(vinculos as any[]);
    if (tejidos.length) await db.tejidos.bulkPut(tejidos as any[]);
    if (celulas.length) await db.celulas.bulkPut(celulas as any[]);
  } catch (e) {
    console.warn("[useOrganoTejidos] no se pudo guardar en Dexie:", e);
  }
}

/** Una fila de la fórmula de un Órgano, ya resuelta: vínculo + tejido + célula. */
export interface TejidoDeOrgano {
  /** Id de la fila puente organo_tejidos — necesario para desvincular. */
  vinculo_id: string;
  organo_id: string;
  tejido_id: string;
  /** Alias de tejido_id — mismo campo que espera FilaFormulaTejido para
   *  no reofrecer este Tejido en el picker de "usar existente". */
  tejido_o_veta_id: string;
  celula_id: string | null;
  /** Alias de celula_id — id de catálogo donde vive compuesto_id (shape
   *  compartido con VetaDeFormacion, ver FilaFormulaTejido). */
  catalogo_id: string | null;
  /** Nombre propio de la Célula (columna `nombre` de la tabla celulas) —
   *  lo que debe mostrar la fila "hecho de", NO el nombre del Compuesto:
   *  la cadena real es Tejido → Célula → Compuesto, y la fila de fórmula
   *  no debe saltearse el nivel Célula. */
  catalogo_nombre: string | null;
  proporcion: string | null;
  nombre: string;
  funcion: string | null;
  notas: string | null;
  compuesto_id: string | null;
}

export function useOrganoTejidos(organoId: string | null) {
  const [vinculos, setVinculos] = useState<OrganoTejido[]>([]);
  const [tejidos, setTejidos] = useState<Record<string, Tejido>>({});
  const [celulas, setCelulas] = useState<Record<string, Celula>>({});
  // tejido_id → celula_id de la PRIMERA célula vinculada (ver nota de
  // cabecera: esta vista simplificada solo resuelve una por tejido).
  const [celulaPorTejido, setCelulaPorTejido] = useState<Record<string, string>>({});
  // celula_id → compuesto_id del PRIMER compuesto vinculado a esa célula.
  const [compuestoPorCelula, setCompuestoPorCelula] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organoId) {
      setVinculos([]);
      setTejidos({});
      setCelulas({});
      setCelulaPorTejido({});
      setCompuestoPorCelula({});
      setLoading(false);
      return;
    }

    // ── Paso 1: pintar de inmediato con lo que ya haya en Dexie (solo
    // vínculos + tejidos — tejido_celulas/celula_compuestos no tienen
    // caché local todavía, ver TODO arriba) ──────────────────────────────
    const vinculosLocales = await leerVinculosDeDexie(organoId);
    if (vinculosLocales.length > 0) {
      setVinculos(vinculosLocales);
      const tejidoIdsLocales = vinculosLocales.map((v) => v.tejido_id);
      const tejidosLocales = await leerTejidosDeDexie(tejidoIdsLocales);
      setTejidos(tejidosLocales);
      setLoading(false); // ya hay algo para mostrar — dejar de bloquear la UI
    } else {
      setLoading(true);
    }

    // ── Paso 2: revalidar contra Supabase en segundo plano ────────────────
    const { data: vinculoData, error: vinculoError } = await supabase
      .from("organo_tejidos")
      .select("*")
      .eq("organo_id", organoId)
      .order("created_at", { ascending: true });

    if (vinculoError || !vinculoData) {
      // Sin red / error: si ya pintamos desde Dexie, dejamos eso como está.
      if (vinculosLocales.length === 0) setVinculos([]);
      setLoading(false);
      return;
    }
    setVinculos(vinculoData as OrganoTejido[]);

    const tejidoIds = (vinculoData as OrganoTejido[]).map((v) => v.tejido_id);
    if (tejidoIds.length === 0) {
      setTejidos({});
      setCelulas({});
      setCelulaPorTejido({});
      setCompuestoPorCelula({});
      setLoading(false);
      void guardarEnDexie(vinculoData as OrganoTejido[], [], []);
      return;
    }

    const { data: tejidoData } = await supabase
      .from(CONFIG_TEJIDOS.tabla)
      .select(CONFIG_TEJIDOS.select)
      .in("id", tejidoIds);

    const tejidosPorId: Record<string, Tejido> = {};
    for (const t of (tejidoData ?? []) as unknown as Tejido[]) tejidosPorId[t.id] = t;
    setTejidos(tejidosPorId);

    // Resolver Célula(s) por Tejido vía tejido_celulas (M:N) — nos
    // quedamos con la primera por tejido para esta vista simplificada.
    const { data: tcData } = await supabase
      .from(CONFIG_TEJIDO_CELULAS.tabla)
      .select(CONFIG_TEJIDO_CELULAS.select)
      .in("tejido_id", tejidoIds)
      .order("created_at", { ascending: true });

    const celulaPorTejidoNuevo: Record<string, string> = {};
    for (const tc of (tcData ?? []) as unknown as TejidoCelula[]) {
      if (!celulaPorTejidoNuevo[tc.tejido_id]) celulaPorTejidoNuevo[tc.tejido_id] = tc.celula_id;
    }
    setCelulaPorTejido(celulaPorTejidoNuevo);

    const celulaIds = Object.values(celulaPorTejidoNuevo);
    if (celulaIds.length === 0) {
      setCelulas({});
      setCompuestoPorCelula({});
      setLoading(false);
      void guardarEnDexie(vinculoData as OrganoTejido[], Object.values(tejidosPorId), []);
      return;
    }

    const { data: celulaData } = await supabase
      .from(CONFIG_CELULAS.tabla)
      .select(CONFIG_CELULAS.select)
      .in("id", celulaIds);

    const celulasPorId: Record<string, Celula> = {};
    for (const c of (celulaData ?? []) as unknown as Celula[]) celulasPorId[c.id] = c;
    setCelulas(celulasPorId);

    // Resolver Compuesto por Célula vía celula_compuestos (M:N) — de nuevo
    // nos quedamos con el primero por célula para esta vista simplificada.
    const { data: ccData } = await supabase
      .from(CONFIG_CELULA_COMPUESTOS.tabla)
      .select(CONFIG_CELULA_COMPUESTOS.select)
      .in("celula_id", celulaIds)
      .order("created_at", { ascending: true });

    const compuestoPorCelulaNuevo: Record<string, string> = {};
    for (const cc of (ccData ?? []) as unknown as CelulaCompuesto[]) {
      if (!compuestoPorCelulaNuevo[cc.celula_id]) compuestoPorCelulaNuevo[cc.celula_id] = cc.compuesto_id;
    }
    setCompuestoPorCelula(compuestoPorCelulaNuevo);

    setLoading(false);
    void guardarEnDexie(
      vinculoData as OrganoTejido[],
      Object.values(tejidosPorId),
      Object.values(celulasPorId),
    );
  }, [organoId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Filas resueltas de la fórmula, listas para la UI ────────────────────
  const items = useMemo<TejidoDeOrgano[]>(() => {
    return vinculos
      .map((v) => {
        const tejido = tejidos[v.tejido_id];
        if (!tejido) return null;
        const celulaId = celulaPorTejido[v.tejido_id] ?? null;
        const celula = celulaId ? celulas[celulaId] : undefined;
        const compuestoId = celulaId ? (compuestoPorCelula[celulaId] ?? null) : null;
        return {
          vinculo_id: v.id,
          organo_id: v.organo_id,
          tejido_id: v.tejido_id,
          tejido_o_veta_id: v.tejido_id,
          celula_id: celulaId,
          catalogo_id: celulaId,
          catalogo_nombre: celula?.nombre ?? null,
          proporcion: v.proporcion,
          nombre: tejido.nombre,
          funcion: tejido.funcion,
          notas: tejido.notas,
          compuesto_id: compuestoId,
        };
      })
      .filter((t): t is TejidoDeOrgano => t !== null);
  }, [vinculos, tejidos, celulas, celulaPorTejido, compuestoPorCelula]);

  // ── Agregar un compuesto a la fórmula: crea Célula + celula_compuestos +
  // Tejido + tejido_celulas + vínculo organo_tejidos (cadena de 5 pasos,
  // ver nota de cabecera) ──────────────────────────────────────────────
  const agregarCompuesto = useCallback(
    async (compuestoId: string) => {
      if (!organoId) return null;

      const { data: nuevaCelula, error: errorCelula } = await supabase
        .from(CONFIG_CELULAS.tabla)
        .insert([{ nombre: "", estructura: [] }])
        .select()
        .single();
      if (errorCelula || !nuevaCelula) return null;
      const celulaId = (nuevaCelula as Celula).id;

      const { error: errorCC } = await supabase
        .from(CONFIG_CELULA_COMPUESTOS.tabla)
        .insert([{ celula_id: celulaId, compuesto_id: compuestoId }]);
      if (errorCC) return null;

      const { data: nuevoTejido, error: errorTejido } = await supabase
        .from(CONFIG_TEJIDOS.tabla)
        .insert([{ nombre: "", estructura: [] }])
        .select()
        .single();
      if (errorTejido || !nuevoTejido) return null;
      const tejidoId = (nuevoTejido as Tejido).id;

      const { error: errorTC } = await supabase
        .from(CONFIG_TEJIDO_CELULAS.tabla)
        .insert([{ tejido_id: tejidoId, celula_id: celulaId }]);
      if (errorTC) return null;

      const { data: vinculo, error: errorVinculo } = await supabase
        .from("organo_tejidos")
        .insert([{ organo_id: organoId, tejido_id: tejidoId }])
        .select()
        .single();
      if (errorVinculo || !vinculo) return null;

      setTejidos((prev) => ({ ...prev, [tejidoId]: nuevoTejido as Tejido }));
      setCelulas((prev) => ({ ...prev, [celulaId]: nuevaCelula as Celula }));
      setCelulaPorTejido((prev) => ({ ...prev, [tejidoId]: celulaId }));
      setCompuestoPorCelula((prev) => ({ ...prev, [celulaId]: compuestoId }));
      setVinculos((prev) => [...prev, vinculo as OrganoTejido]);
      void guardarEnDexie([vinculo as OrganoTejido], [nuevoTejido as Tejido], [nuevaCelula as Celula]);
      return vinculo as OrganoTejido;
    },
    [organoId],
  );

  // ── Crear un Tejido nuevo en el catálogo global (con nombre, sin Célula
  // todavía) y vincularlo de una — flujo "Agregar" unificado con reutilizar,
  // contraparte de vincularExistente cuando el Tejido buscado no existe. ──
  const crearYVincular = useCallback(
    async (nombre: string) => {
      if (!organoId) return null;

      const { data: nuevoTejido, error: errorTejido } = await supabase
        .from(CONFIG_TEJIDOS.tabla)
        .insert([{ nombre, estructura: [] }])
        .select()
        .single();
      if (errorTejido || !nuevoTejido) return null;

      const tejido = nuevoTejido as Tejido;
      setTejidos((prev) => ({ ...prev, [tejido.id]: tejido }));
      void guardarEnDexie([], [tejido], []);

      const { data: vinculo, error: errorVinculo } = await supabase
        .from("organo_tejidos")
        .insert([{ organo_id: organoId, tejido_id: tejido.id }])
        .select()
        .single();
      if (errorVinculo || !vinculo) return null;

      setVinculos((prev) => [...prev, vinculo as OrganoTejido]);
      void guardarEnDexie([vinculo as OrganoTejido], [], []);
      return vinculo as OrganoTejido;
    },
    [organoId],
  );

  // ── Vincular un Tejido YA EXISTENTE (de cualquier otro Órgano) sin crear
  // Célula/Tejido nuevos — reutilización real, contraparte de agregarCompuesto.
  const vincularExistente = useCallback(
    async (tejidoId: string) => {
      if (!organoId) return null;

      const { data: vinculo, error: errorVinculo } = await supabase
        .from("organo_tejidos")
        .insert([{ organo_id: organoId, tejido_id: tejidoId }])
        .select()
        .single();
      if (errorVinculo || !vinculo) return null;

      // Si el Tejido (y su Célula) no están en el estado local todavía
      // (viene de otro Órgano), los traemos para que la fila se resuelva sin recargar todo.
      if (!tejidos[tejidoId]) {
        const { data: tejidoData } = await supabase
          .from(CONFIG_TEJIDOS.tabla)
          .select(CONFIG_TEJIDOS.select)
          .eq("id", tejidoId)
          .single();
        if (tejidoData) {
          const tejido = tejidoData as unknown as Tejido;
          setTejidos((prev) => ({ ...prev, [tejido.id]: tejido }));
          void guardarEnDexie([], [tejido], []);

          // Célula ya no vive en tejido.celula_id (legacy) — se resuelve
          // vía tejido_celulas (M:N), tomando la primera vinculada.
          const { data: tcData } = await supabase
            .from(CONFIG_TEJIDO_CELULAS.tabla)
            .select(CONFIG_TEJIDO_CELULAS.select)
            .eq("tejido_id", tejidoId)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          const celulaId = (tcData as unknown as TejidoCelula | null)?.celula_id ?? null;

          if (celulaId) {
            setCelulaPorTejido((prev) => ({ ...prev, [tejidoId]: celulaId }));
            if (!celulas[celulaId]) {
              const { data: celulaData } = await supabase
                .from(CONFIG_CELULAS.tabla)
                .select(CONFIG_CELULAS.select)
                .eq("id", celulaId)
                .single();
              if (celulaData) {
                const celula = celulaData as unknown as Celula;
                setCelulas((prev) => ({ ...prev, [celula.id]: celula }));
                void guardarEnDexie([], [], [celula]);
              }
            }
          }
        }
      }

      setVinculos((prev) => [...prev, vinculo as OrganoTejido]);
      void guardarEnDexie([vinculo as OrganoTejido], [], []);
      return vinculo as OrganoTejido;
    },
    [organoId, tejidos, celulas],
  );

  // ── Reemplazar el compuesto de una fila: ya no es un update de columna
  // (celula.compuesto_id, legacy) sino un vínculo en celula_compuestos.
  // Simplificación: para esta vista de una fila = un compuesto, borramos
  // cualquier vínculo previo de esa Célula y creamos el nuevo (si la
  // Célula necesita varios Compuestos a la vez, usar useCelulaCompuestos
  // directamente en vez de este atajo). ──────────────────────────────────
  const actualizarCompuesto = useCallback(
    async (celulaId: string, compuestoId: string) => {
      setCompuestoPorCelula((prev) => ({ ...prev, [celulaId]: compuestoId }));

      const { error: errorDelete } = await supabase
        .from(CONFIG_CELULA_COMPUESTOS.tabla)
        .delete()
        .eq("celula_id", celulaId);
      if (errorDelete) {
        console.error("[useOrganoTejidos] error limpiando vínculos previos:", errorDelete);
        return;
      }
      const { error } = await supabase
        .from(CONFIG_CELULA_COMPUESTOS.tabla)
        .insert([{ celula_id: celulaId, compuesto_id: compuestoId }]);
      if (error) console.error("[useOrganoTejidos] error actualizando célula:", error);
    },
    [],
  );

  // ── Editar el nombre propio del Tejido (columna nombre de la tabla tejidos,
  // distinta del Compuesto que lo compone) ───────────────────────────────
  const actualizarNombre = useCallback(async (tejidoId: string, nombre: string) => {
    setTejidos((prev) => {
      if (!prev[tejidoId]) return prev;
      const actualizado = { ...prev[tejidoId], nombre };
      void guardarEnDexie([], [actualizado], []);
      return { ...prev, [tejidoId]: actualizado };
    });
    const { error } = await supabase
      .from(CONFIG_TEJIDOS.tabla)
      .update({ nombre })
      .eq("id", tejidoId);
    if (error) console.error("[useOrganoTejidos] error actualizando nombre del tejido:", error);
  }, []);

  // ── Editar la proporción de una fila (columna propia de organo_tejidos) ─
  const actualizarProporcion = useCallback(async (vinculoId: string, proporcion: string) => {
    setVinculos((prev) => {
      const next = prev.map((v) => (v.id === vinculoId ? { ...v, proporcion } : v));
      const actualizado = next.find((v) => v.id === vinculoId);
      if (actualizado) void guardarEnDexie([actualizado], [], []);
      return next;
    });
    const { error } = await supabase
      .from("organo_tejidos")
      .update({ proporcion })
      .eq("id", vinculoId);
    if (error) console.error("[useOrganoTejidos] error actualizando proporción:", error);
  }, []);

  // ── Quitar una fila: borra solo el vínculo (Tejido/Célula quedan huérfanos
  // en su catálogo propio, mismo trade-off que el resto de vínculos N:N) ──
  const quitarCompuesto = useCallback(async (vinculoId: string) => {
    setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
    try {
      if (db) await db.organo_tejidos.delete(vinculoId);
    } catch {}
    await supabase.from("organo_tejidos").delete().eq("id", vinculoId);
  }, []);

  return {
    items,
    loading,
    agregarCompuesto,
    vincularExistente,
    crearYVincular,
    actualizarCompuesto,
    actualizarNombre,
    actualizarProporcion,
    quitarCompuesto,
    load,
  };
}
