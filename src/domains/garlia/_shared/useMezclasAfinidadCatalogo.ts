"use client";

/**
 * useMezclasAfinidadCatalogo.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Catálogo liviano para "¿con qué otro mineral/planta se complementa este?"
 * (AfinidadEntreEntidadesPanel): trae de una sola vez, para TODOS los
 * Minerales y toda la Flora, la mezcla agregada de Compuestos de sus
 * Formaciones/Órganos (todas juntas por entidad — no una por una), lista
 * para pasar a ordenarPorAfinidadDeMezclas.
 *
 * "Agregada" acá significa: se concatenan los componentes de TODAS las
 * Formaciones de un Mineral (o todos los Órganos de una Flora) en una sola
 * mezcla — es la composición material completa de la entidad, mismo
 * criterio que ya usa ComposicionQuimicaPanel por Formación/Órgano
 * individual, pero a nivel de la entidad entera.
 *
 * FIX (ago-2026): el lado de Flora/Órganos consultaba `grupos_compuestos`
 * y `organo.componentes` — ninguna de las dos existe en Supabase (la tabla
 * `grupos_compuestos` fue eliminada, y Órgano dejó de tener columna
 * `componentes` propia, ver elementos/types.ts). Las queries fallaban
 * silenciosamente y el panel de Flora quedaba siempre vacío. Reescrito
 * para reconstruir la mezcla real desde la cadena viva:
 *   planta_organos → Organo → organo_tejidos → Tejido ─┬─ tejido_celulas → Celula → celula_compuestos → Compuesto
 *                                                       └─ tejido_compuestos ─────────────────────────→ Compuesto
 *
 * FASE 7: los vínculos Mineral→Formación y Planta→Órgano se leen ahora de
 * estructura_componentes (padre_tipo='mineral'|'planta', hijo_tipo=
 * 'formacion'|'organo') en vez de las tablas dedicadas mineral_formaciones/
 * planta_organos (siguen existiendo sin usarse, limpieza en Fase 8). Esto
 * también resuelve el TODO que había quedado pendiente del lado Mineral:
 * ahora se atraviesa formacion_vetas → Veta → estructura_componentes
 * (veta→grano→compuesto) para armar la mezcla real, mismo criterio que ya
 * se usaba del lado Flora.
 */

import { useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import type { ComponenteCompuestoEnMezcla } from "@/domains/garlia/elementos/afinidad";

export interface EntidadConMezcla {
  id: string;
  nombre: string;
  tipo: "mineral" | "flora";
  mezcla: ComponenteCompuestoEnMezcla[];
}

/** Fila de estructura_componentes ya reducida a padre_id/hijo_id — sirve
 *  tanto para mineral→formacion como para planta→organo. */
interface FilaVinculo {
  padre_id: string;
  hijo_id: string;
}

export function useMezclasAfinidadCatalogo() {
  const [entidades, setEntidades] = useState<EntidadConMezcla[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setLoading(true);

      const [
        { data: minerales },
        { data: floras },
        { data: vinculosFormacion },
        { data: vinculosOrganoRaw },
      ] = await Promise.all([
        supabase.from("minerales").select("id, nombre"),
        supabase.from("flora").select("id, nombre"),
        supabase
          .from("estructura_componentes")
          .select("padre_id, hijo_id")
          .eq("padre_tipo", "mineral")
          .eq("hijo_tipo", "formacion"),
        supabase
          .from("estructura_componentes")
          .select("padre_id, hijo_id")
          .eq("padre_tipo", "planta")
          .eq("hijo_tipo", "organo"),
      ]);

      if (cancelado) return;

      // ── Lado Mineral: Formación → formacion_vetas → Veta →
      // estructura_componentes(veta→grano) → estructura_componentes
      // (grano→compuesto). Mismo criterio de agregación que Flora: cada
      // aparición de un Compuesto cuenta como cantidad 1. ─────────────────
      const mezclaMineral = new Map<string, ComponenteCompuestoEnMezcla[]>();
      const formacionIds = [
        ...new Set(((vinculosFormacion ?? []) as FilaVinculo[]).map((v) => v.hijo_id)),
      ];

      if (formacionIds.length > 0) {
        const { data: formacionVetas } = await supabase
          .from("formacion_vetas")
          .select("formacion_id, veta_id")
          .in("formacion_id", formacionIds);

        const vetaIds = [...new Set((formacionVetas ?? []).map((v) => v.veta_id as string))];

        if (vetaIds.length > 0) {
          const { data: vetaGranoLinks } = await supabase
            .from("estructura_componentes")
            .select("padre_id, hijo_id")
            .eq("padre_tipo", "veta")
            .eq("hijo_tipo", "grano")
            .in("padre_id", vetaIds);

          const granoIds = [
            ...new Set(((vetaGranoLinks ?? []) as FilaVinculo[]).map((v) => v.hijo_id)),
          ];

          const granoCompuestoLinks =
            granoIds.length > 0
              ? (
                  (
                    await supabase
                      .from("estructura_componentes")
                      .select("padre_id, hijo_id")
                      .eq("padre_tipo", "grano")
                      .eq("hijo_tipo", "compuesto")
                      .in("padre_id", granoIds)
                  ).data as FilaVinculo[]
                ) ?? []
              : [];

          // grano_id → lista de compuesto_id
          const compuestosPorGrano = new Map<string, string[]>();
          for (const gc of granoCompuestoLinks) {
            const acc = compuestosPorGrano.get(gc.padre_id) ?? [];
            acc.push(gc.hijo_id);
            compuestosPorGrano.set(gc.padre_id, acc);
          }

          // veta_id → lista de compuesto_id (agregando todos sus Granos)
          const compuestosPorVeta = new Map<string, string[]>();
          for (const vg of (vetaGranoLinks ?? []) as FilaVinculo[]) {
            const compuestosDelGrano = compuestosPorGrano.get(vg.hijo_id) ?? [];
            const acc = compuestosPorVeta.get(vg.padre_id) ?? [];
            compuestosPorVeta.set(vg.padre_id, [...acc, ...compuestosDelGrano]);
          }

          // formacion_id → lista de compuesto_id (agregando todas sus Vetas)
          const compuestosPorFormacion = new Map<string, string[]>();
          for (const fv of formacionVetas ?? []) {
            const compuestosDeLaVeta = compuestosPorVeta.get(fv.veta_id as string) ?? [];
            const acc = compuestosPorFormacion.get(fv.formacion_id as string) ?? [];
            compuestosPorFormacion.set(fv.formacion_id as string, [...acc, ...compuestosDeLaVeta]);
          }

          // mineral_id → mezcla agregada de todas sus Formaciones.
          for (const v of (vinculosFormacion ?? []) as FilaVinculo[]) {
            const compuestoIds = compuestosPorFormacion.get(v.hijo_id) ?? [];
            if (!v.padre_id || compuestoIds.length === 0) continue;
            const acumulada = mezclaMineral.get(v.padre_id) ?? [];
            const nuevos: ComponenteCompuestoEnMezcla[] = compuestoIds.map((compuesto_id) => ({
              compuesto_id,
              cantidad: 1,
            }));
            mezclaMineral.set(v.padre_id, [...acumulada, ...nuevos]);
          }
        }
      }

      // ── Lado Flora: reconstruir la mezcla real desde la cadena viva ────
      const vinculosOrgano = ((vinculosOrganoRaw ?? []) as FilaVinculo[]).map((v) => ({
        planta_id: v.padre_id,
        organo_id: v.hijo_id,
      }));
      const organoIds = vinculosOrgano.map((v) => v.organo_id).filter((id): id is string => !!id);

      const mezclaFlora = new Map<string, ComponenteCompuestoEnMezcla[]>();

      if (organoIds.length > 0) {
        const { data: organoTejidos } = await supabase
          .from("organo_tejidos")
          .select("organo_id, tejido_id")
          .in("organo_id", organoIds);

        const tejidoIds = [...new Set((organoTejidos ?? []).map((v) => v.tejido_id as string))];

        if (tejidoIds.length > 0) {
          const [{ data: tejidoCelulas }, { data: tejidoCompuestos }] = await Promise.all([
            supabase.from("tejido_celulas").select("tejido_id, celula_id").in("tejido_id", tejidoIds),
            supabase.from("tejido_compuestos").select("tejido_id, compuesto_id").in("tejido_id", tejidoIds),
          ]);

          const celulaIds = [
            ...new Set((tejidoCelulas ?? []).map((v) => v.celula_id as string)),
          ];
          const celulaCompuestos =
            celulaIds.length > 0
              ? (
                  await supabase
                    .from("celula_compuestos")
                    .select("celula_id, compuesto_id")
                    .in("celula_id", celulaIds)
                ).data
              : [];

          // compuesto_id por tejido: directo (tejido_compuestos) + indirecto
          // (tejido_celulas → celula_compuestos).
          const compuestosPorTejido = new Map<string, string[]>();
          for (const tc of tejidoCompuestos ?? []) {
            const acc = compuestosPorTejido.get(tc.tejido_id as string) ?? [];
            acc.push(tc.compuesto_id as string);
            compuestosPorTejido.set(tc.tejido_id as string, acc);
          }
          const compuestosPorCelula = new Map<string, string[]>();
          for (const cc of celulaCompuestos ?? []) {
            const acc = compuestosPorCelula.get(cc.celula_id as string) ?? [];
            acc.push(cc.compuesto_id as string);
            compuestosPorCelula.set(cc.celula_id as string, acc);
          }
          for (const tc of tejidoCelulas ?? []) {
            const viaCelula = compuestosPorCelula.get(tc.celula_id as string) ?? [];
            const acc = compuestosPorTejido.get(tc.tejido_id as string) ?? [];
            compuestosPorTejido.set(tc.tejido_id as string, [...acc, ...viaCelula]);
          }

          // organo_id → lista de compuesto_id (agregando todos sus tejidos)
          const compuestosPorOrgano = new Map<string, string[]>();
          for (const ot of organoTejidos ?? []) {
            const compuestosDelTejido = compuestosPorTejido.get(ot.tejido_id as string) ?? [];
            const acc = compuestosPorOrgano.get(ot.organo_id as string) ?? [];
            compuestosPorOrgano.set(ot.organo_id as string, [...acc, ...compuestosDelTejido]);
          }

          // planta_id → mezcla agregada de todos sus Órganos. No hay
          // cantidad numérica real en esta cadena (proporcion es texto
          // libre) — cada aparición de un Compuesto cuenta como cantidad 1,
          // aproximación razonable para el cálculo de afinidad.
          for (const v of vinculosOrgano) {
            const compuestoIds = compuestosPorOrgano.get(v.organo_id) ?? [];
            if (!v.planta_id || compuestoIds.length === 0) continue;
            const acumulada = mezclaFlora.get(v.planta_id) ?? [];
            const nuevos: ComponenteCompuestoEnMezcla[] = compuestoIds.map((compuesto_id) => ({
              compuesto_id,
              cantidad: 1,
            }));
            mezclaFlora.set(v.planta_id, [...acumulada, ...nuevos]);
          }
        }
      }

      const resultado: EntidadConMezcla[] = [
        ...((minerales ?? []) as { id: string; nombre: string }[])
          .map((m) => ({ id: m.id, nombre: m.nombre, tipo: "mineral" as const, mezcla: mezclaMineral.get(m.id) ?? [] }))
          .filter((e) => e.mezcla.length > 0),
        ...((floras ?? []) as { id: string; nombre: string }[])
          .map((f) => ({ id: f.id, nombre: f.nombre, tipo: "flora" as const, mezcla: mezclaFlora.get(f.id) ?? [] }))
          .filter((e) => e.mezcla.length > 0),
      ];

      setEntidades(resultado);
      setLoading(false);
    }

    void cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  return { entidades, loading };
}
