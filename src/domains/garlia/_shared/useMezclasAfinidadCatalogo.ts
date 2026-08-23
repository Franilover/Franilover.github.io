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
 * El lado de Mineral/Formación (formacion_vetas → Veta.grano_id →
 * Grano.compuesto_id) sigue siendo el patrón viejo 1:1 — no se tocó en
 * esta migración, queda fuera de este fix.
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

interface FilaVinculoOrgano {
  planta_id: string;
  /** Pese al nombre histórico, apunta a organos.id — se resuelve por
   *  separado (organo_tejidos → Tejido → Célula/Compuesto), no embebido. */
  grupo_compuesto_id: string;
}

export function useMezclasAfinidadCatalogo() {
  const [entidades, setEntidades] = useState<EntidadConMezcla[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setLoading(true);

      const [{ data: minerales }, { data: formaciones }, { data: floras }, { data: vinculosOrgano }] =
        await Promise.all([
          supabase.from("minerales").select("id, nombre"),
          // NOTA: grupo_compuesto_id acá apunta a formaciones.id (nombre
          // histórico, ver elementos/types.ts) — la cadena real es
          // Formacion → formacion_vetas → Veta.grano_id → Grano.compuesto_id,
          // que sigue siendo 1:1 y quedó FUERA del alcance de esta migración
          // (solo tocamos Célula/Tejido/Órgano, no Grano/Veta). Por ahora
          // el lado mineral sigue sin resolver mezcla real — ver TODO abajo.
          supabase.from("mineral_formaciones").select("mineral_id, grupo_compuesto_id"),
          supabase.from("flora").select("id, nombre"),
          supabase.from("planta_organos").select("planta_id, grupo_compuesto_id"),
        ]);

      if (cancelado) return;

      // ── Lado Mineral: TODO — mismo bug que tenía Flora, sin arreglar
      // todavía (requiere resolver formacion_vetas → Veta → Grano por
      // separado, análogo a lo que se hizo abajo para Flora/Órganos). Por
      // ahora la mezcla queda vacía en vez de fallar silenciosamente. ────
      void formaciones;
      const mezclaMineral = new Map<string, ComponenteCompuestoEnMezcla[]>();

      // ── Lado Flora: reconstruir la mezcla real desde la cadena viva ────
      const organoIds = ((vinculosOrgano ?? []) as FilaVinculoOrgano[])
        .map((v) => v.grupo_compuesto_id)
        .filter((id): id is string => !!id);

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
          for (const v of (vinculosOrgano ?? []) as FilaVinculoOrgano[]) {
            const compuestoIds = compuestosPorOrgano.get(v.grupo_compuesto_id) ?? [];
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
