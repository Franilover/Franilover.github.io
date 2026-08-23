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
    setLoading(true);

    const configTejido = tipo === "organo" ? CONFIG_TEJIDOS : CONFIG_VETAS;
    const configCatalogo = tipo === "organo" ? CONFIG_CELULAS : CONFIG_GRANOS;
    const fkCampo = tipo === "organo" ? "celula_id" : "grano_id";

    const { data: tejidoData, error: tejidoError } = await supabase
      .from(configTejido.tabla)
      .select(configTejido.select)
      .order("nombre", { ascending: true });

    if (tejidoError || !tejidoData) {
      setItems([]);
      setLoading(false);
      return;
    }

    const tejidos = tejidoData as unknown as (Tejido | Veta)[];

    const catalogoIds = tejidos
      .map((t) => (t as unknown as Record<string, unknown>)[fkCampo])
      .filter((id): id is string => typeof id === "string");

    let catalogoPorId: Record<string, Celula | Grano> = {};
    if (catalogoIds.length > 0) {
      const { data: catalogoData } = await supabase
        .from(configCatalogo.tabla)
        .select(configCatalogo.select)
        .in("id", catalogoIds);

      catalogoPorId = {};
      for (const c of (catalogoData ?? []) as unknown as (Celula | Grano)[]) {
        catalogoPorId[c.id] = c;
      }
    }

    const resueltos: EntradaCatalogoTejido[] = tejidos.map((t) => {
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

    setItems(resueltos);
    setLoading(false);
  }, [tipo]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, load };
}
