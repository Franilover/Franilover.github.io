"use client";

/**
 * useCatalogoTejidos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Lista TODOS los Tejidos (u opcionalmente Vetas, según `tipo`) que ya
 * existen en Supabase, sin filtrar por Órgano/Formación — a diferencia de
 * useOrganoTejidos/useFormacionVetas, que solo resuelven la fórmula de UNA
 * entidad puntual.
 *
 * Existe para alimentar el picker "Usar existente" de SelectorFormulaTejidos:
 * antes, la única forma de agregar una fila a la fórmula era crear una
 * Célula+Tejido nuevos desde cero (ver nota en useOrganoTejidos.ts). Este
 * hook expone el catálogo completo para poder reutilizar un Tejido/Veta ya
 * creado en otro Órgano/Formación, vinculándolo directo sin duplicar datos.
 *
 * Devuelve cada fila con su Compuesto resuelto (vía Célula/Grano) para que
 * el picker pueda mostrar "Tejido X — hecho de Compuesto Y" sin fetches
 * adicionales.
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";
import { db } from "@/infra/supabase/db";

import {
  CONFIG_CELULAS,
  CONFIG_GRANOS,
  CONFIG_TEJIDOS,
  CONFIG_VETAS,
  type Celula,
  type Grano,
  type Tejido,
  type Veta,
} from "@/domains/garlia/elementos/types";

// ── Cache-first: catálogo completo, sin filtrar por entidad puntual ───────
// Mismo espíritu que useOrganoTejidos/useFormacionVetas: pintar de Dexie de
// inmediato y revalidar contra Supabase en segundo plano.
function resolverDesdeTablas(
  tejidos: (Tejido | Veta)[],
  catalogoPorId: Record<string, Celula | Grano>,
  fkCampo: string,
): EntradaCatalogoTejido[] {
  return tejidos.map((t) => {
    const catalogoId = (t as unknown as Record<string, unknown>)[fkCampo] as string | null;
    const catalogo = catalogoId ? catalogoPorId[catalogoId] : undefined;
    return {
      id: t.id,
      nombre: t.nombre,
      funcion: t.funcion,
      notas: t.notas,
      catalogo_id: catalogoId,
      compuesto_id: catalogo?.compuesto_id ?? null,
    };
  });
}

async function leerDeDexie(
  tipo: "organo" | "formacion",
): Promise<EntradaCatalogoTejido[]> {
  try {
    if (!db) return [];
    const fkCampo = tipo === "organo" ? "celula_id" : "grano_id";
    const tejidos = (
      tipo === "organo" ? await db.tejidos.toArray() : await db.vetas.toArray()
    ) as unknown as (Tejido | Veta)[];
    if (tejidos.length === 0) return [];

    const catalogoIds = tejidos
      .map((t) => (t as unknown as Record<string, unknown>)[fkCampo])
      .filter((id): id is string => typeof id === "string");

    let catalogoPorId: Record<string, Celula | Grano> = {};
    if (catalogoIds.length > 0) {
      const rows = (
        tipo === "organo"
          ? await db.celulas.bulkGet(catalogoIds)
          : await db.granos.bulkGet(catalogoIds)
      ) as unknown as (Celula | Grano | undefined)[];
      catalogoPorId = {};
      for (const c of rows) if (c) catalogoPorId[c.id] = c;
    }

    return resolverDesdeTablas(tejidos, catalogoPorId, fkCampo).sort((a, b) =>
      a.nombre.localeCompare(b.nombre),
    );
  } catch {
    return [];
  }
}

async function guardarEnDexie(
  tipo: "organo" | "formacion",
  tejidos: (Tejido | Veta)[],
  catalogo: (Celula | Grano)[],
) {
  try {
    if (!db) return;
    if (tipo === "organo") {
      if (tejidos.length) await db.tejidos.bulkPut(tejidos as any[]);
      if (catalogo.length) await db.celulas.bulkPut(catalogo as any[]);
    } else {
      if (tejidos.length) await db.vetas.bulkPut(tejidos as any[]);
      if (catalogo.length) await db.granos.bulkPut(catalogo as any[]);
    }
  } catch (e) {
    console.warn("[useCatalogoTejidos] no se pudo guardar en Dexie:", e);
  }
}

/** Una entrada del catálogo, ya resuelta contra su Célula/Grano — mismo
 *  shape mínimo que necesita el picker (nombre + compuesto_id). */
export interface EntradaCatalogoTejido {
  id: string;
  nombre: string;
  funcion: string | null;
  notas: string | null;
  /** Id de la Célula (Tejido) o Grano (Veta) — el nivel que guarda compuesto_id. */
  catalogo_id: string | null;
  compuesto_id: string | null;
}

export function useCatalogoTejidos(tipo: "organo" | "formacion" = "organo") {
  const [items, setItems] = useState<EntradaCatalogoTejido[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // ── Paso 1: pintar de inmediato con lo que ya haya en Dexie ──────────
    const itemsLocales = await leerDeDexie(tipo);
    if (itemsLocales.length > 0) {
      setItems(itemsLocales);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // ── Paso 2: revalidar contra Supabase en segundo plano ────────────────
    const configTejido = tipo === "organo" ? CONFIG_TEJIDOS : CONFIG_VETAS;
    const configCatalogo = tipo === "organo" ? CONFIG_CELULAS : CONFIG_GRANOS;
    const fkCampo = tipo === "organo" ? "celula_id" : "grano_id";

    const { data: tejidoData, error: tejidoError } = await supabase
      .from(configTejido.tabla)
      .select(configTejido.select)
      .order("nombre", { ascending: true });

    if (tejidoError || !tejidoData) {
      if (itemsLocales.length === 0) setItems([]);
      setLoading(false);
      return;
    }

    const tejidos = tejidoData as unknown as (Tejido | Veta)[];

    const catalogoIds = tejidos
      .map((t) => (t as unknown as Record<string, unknown>)[fkCampo])
      .filter((id): id is string => typeof id === "string");

    let catalogoDatos: (Celula | Grano)[] = [];
    let catalogoPorId: Record<string, Celula | Grano> = {};
    if (catalogoIds.length > 0) {
      const { data: catalogoData } = await supabase
        .from(configCatalogo.tabla)
        .select(configCatalogo.select)
        .in("id", catalogoIds);

      catalogoDatos = (catalogoData ?? []) as unknown as (Celula | Grano)[];
      catalogoPorId = {};
      for (const c of catalogoDatos) catalogoPorId[c.id] = c;
    }

    setItems(resolverDesdeTablas(tejidos, catalogoPorId, fkCampo));
    setLoading(false);
    void guardarEnDexie(tipo, tejidos, catalogoDatos);
  }, [tipo]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, load };
}
