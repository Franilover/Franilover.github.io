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

import {
  CONFIG_CELULAS,
  CONFIG_TEJIDOS,
  type Celula,
  type OrganoTejido,
  type Tejido,
} from "@/domains/garlia/elementos/types";

/** Una fila de la fórmula de un Órgano, ya resuelta: vínculo + tejido + célula. */
export interface TejidoDeOrgano {
  /** Id de la fila puente organo_tejidos — necesario para desvincular. */
  vinculo_id: string;
  organo_id: string;
  tejido_id: string;
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
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: vinculoData, error: vinculoError } = await supabase
      .from("organo_tejidos")
      .select("*")
      .eq("organo_id", organoId)
      .order("created_at", { ascending: true });

    if (vinculoError || !vinculoData) {
      setVinculos([]);
      setLoading(false);
      return;
    }
    setVinculos(vinculoData as OrganoTejido[]);

    const tejidoIds = (vinculoData as OrganoTejido[]).map((v) => v.tejido_id);
    if (tejidoIds.length === 0) {
      setTejidos({});
      setCelulas({});
      setLoading(false);
      return;
    }

    const { data: tejidoData } = await supabase
      .from(CONFIG_TEJIDOS.tabla)
      .select(CONFIG_TEJIDOS.select)
      .in("id", tejidoIds);

    const tejidosPorId: Record<string, Tejido> = {};
    for (const t of (tejidoData ?? []) as Tejido[]) tejidosPorId[t.id] = t;
    setTejidos(tejidosPorId);

    const celulaIds = Object.values(tejidosPorId)
      .map((t) => t.celula_id)
      .filter((id): id is string => !!id);

    if (celulaIds.length === 0) {
      setCelulas({});
      setLoading(false);
      return;
    }

    const { data: celulaData } = await supabase
      .from(CONFIG_CELULAS.tabla)
      .select(CONFIG_CELULAS.select)
      .in("id", celulaIds);

    const celulasPorId: Record<string, Celula> = {};
    for (const c of (celulaData ?? []) as Celula[]) celulasPorId[c.id] = c;
    setCelulas(celulasPorId);

    setLoading(false);
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
      return vinculo as OrganoTejido;
    },
    [organoId],
  );

  // ── Reemplazar el compuesto de una fila (edita la Célula existente) ────
  const actualizarCompuesto = useCallback(
    async (celulaId: string, compuestoId: string) => {
      setCelulas((prev) =>
        prev[celulaId] ? { ...prev, [celulaId]: { ...prev[celulaId], compuesto_id: compuestoId } } : prev,
      );
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
    setVinculos((prev) => prev.map((v) => (v.id === vinculoId ? { ...v, proporcion } : v)));
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
    await supabase.from("organo_tejidos").delete().eq("id", vinculoId);
  }, []);

  return {
    items,
    loading,
    agregarCompuesto,
    actualizarCompuesto,
    actualizarProporcion,
    quitarCompuesto,
    load,
  };
}
