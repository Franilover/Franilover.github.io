"use client";

/**
 * useOrganoTejidos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Resuelve la composición de UN Órgano: la cadena real en Supabase es
 *   Organo → organo_tejidos (proporcion) → Tejido → Celula → Compuesto
 * Reemplaza al viejo `Organo.componentes` plano ({compuesto_id, cantidad}[]),
 * que ya no existe como columna — cada nivel intermedio (Tejido, Célula)
 * es su propia fila reutilizable, con nombre/función propios.
 *
 * Simplificación deliberada de la UI: en vez de exponer Tejido y Célula
 * como dos catálogos separados para elegir/reutilizar, este hook ofrece un
 * flujo de UNA sola acción por fila de la fórmula — "agregar compuesto" —
 * que por debajo crea una Célula nueva (compuesto_id) + un Tejido nuevo
 * (celula_id) + el vínculo organo_tejidos, los tres en cadena. Esto
 * modela cada fila de la fórmula como "un tejido hecho de este compuesto",
 * sin forzar al usuario a pensar en 3 tablas para agregar un ingrediente.
 * Reutilizar un Tejido/Célula ya existente entre Órganos sigue siendo
 * posible más adelante (quedan como catálogos propios en Supabase), pero
 * no es parte de este flujo simplificado.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";
import { db } from "@/infra/supabase/db";

import {
  CONFIG_CELULAS,
  CONFIG_TEJIDOS,
  type Celula,
  type OrganoTejido,
  type Tejido,
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
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organoId) {
      setVinculos([]);
      setTejidos({});
      setCelulas({});
      setLoading(false);
      return;
    }

    // ── Paso 1: pintar de inmediato con lo que ya haya en Dexie ──────────
    const vinculosLocales = await leerVinculosDeDexie(organoId);
    if (vinculosLocales.length > 0) {
      setVinculos(vinculosLocales);
      const tejidoIdsLocales = vinculosLocales.map((v) => v.tejido_id);
      const tejidosLocales = await leerTejidosDeDexie(tejidoIdsLocales);
      setTejidos(tejidosLocales);
      const celulaIdsLocales = Object.values(tejidosLocales)
        .map((t) => t.celula_id)
        .filter((id): id is string => !!id);
      const celulasLocales = await leerCelulasDeDexie(celulaIdsLocales);
      setCelulas(celulasLocales);
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

    const celulaIds = Object.values(tejidosPorId)
      .map((t) => t.celula_id)
      .filter((id): id is string => !!id);

    if (celulaIds.length === 0) {
      setCelulas({});
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
        const celula = tejido.celula_id ? celulas[tejido.celula_id] : undefined;
        return {
          vinculo_id: v.id,
          organo_id: v.organo_id,
          tejido_id: v.tejido_id,
          tejido_o_veta_id: v.tejido_id,
          celula_id: tejido.celula_id,
          catalogo_id: tejido.celula_id,
          proporcion: v.proporcion,
          nombre: tejido.nombre,
          funcion: tejido.funcion,
          notas: tejido.notas,
          compuesto_id: celula?.compuesto_id ?? null,
        };
      })
      .filter((t): t is TejidoDeOrgano => t !== null);
  }, [vinculos, tejidos, celulas]);

  // ── Agregar un compuesto a la fórmula: crea Célula + Tejido + vínculo ───
  const agregarCompuesto = useCallback(
    async (compuestoId: string) => {
      if (!organoId) return null;

      const { data: nuevaCelula, error: errorCelula } = await supabase
        .from(CONFIG_CELULAS.tabla)
        .insert([{ nombre: "", compuesto_id: compuestoId, estructura: [] }])
        .select()
        .single();
      if (errorCelula || !nuevaCelula) return null;

      const { data: nuevoTejido, error: errorTejido } = await supabase
        .from(CONFIG_TEJIDOS.tabla)
        .insert([{ nombre: "", celula_id: (nuevaCelula as Celula).id, estructura: [] }])
        .select()
        .single();
      if (errorTejido || !nuevoTejido) return null;

      const { data: vinculo, error: errorVinculo } = await supabase
        .from("organo_tejidos")
        .insert([{ organo_id: organoId, tejido_id: (nuevoTejido as Tejido).id }])
        .select()
        .single();
      if (errorVinculo || !vinculo) return null;

      setTejidos((prev) => ({ ...prev, [(nuevoTejido as Tejido).id]: nuevoTejido as Tejido }));
      setCelulas((prev) => ({ ...prev, [(nuevaCelula as Celula).id]: nuevaCelula as Celula }));
      setVinculos((prev) => [...prev, vinculo as OrganoTejido]);
      void guardarEnDexie([vinculo as OrganoTejido], [nuevoTejido as Tejido], [nuevaCelula as Celula]);
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
          if (tejido.celula_id && !celulas[tejido.celula_id]) {
            const { data: celulaData } = await supabase
              .from(CONFIG_CELULAS.tabla)
              .select(CONFIG_CELULAS.select)
              .eq("id", tejido.celula_id)
              .single();
            if (celulaData) {
              const celula = celulaData as unknown as Celula;
              setCelulas((prev) => ({ ...prev, [celula.id]: celula }));
              void guardarEnDexie([], [], [celula]);
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

  // ── Reemplazar el compuesto de una fila (edita la Célula existente) ────
  const actualizarCompuesto = useCallback(
    async (celulaId: string, compuestoId: string) => {
      setCelulas((prev) => {
        if (!prev[celulaId]) return prev;
        const actualizada = { ...prev[celulaId], compuesto_id: compuestoId };
        void guardarEnDexie([], [], [actualizada]);
        return { ...prev, [celulaId]: actualizada };
      });
      const { error } = await supabase
        .from(CONFIG_CELULAS.tabla)
        .update({ compuesto_id: compuestoId })
        .eq("id", celulaId);
      if (error) console.error("[useOrganoTejidos] error actualizando célula:", error);
    },
    [],
  );

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
    actualizarCompuesto,
    actualizarProporcion,
    quitarCompuesto,
    load,
  };
}
