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
 * Consulta liviana (solo compuesto_id/cantidad + entidad dueña), separada
 * de los hooks de edición completos (useMineralFormacionesProcesos,
 * usePlantaOrganosProcesos) que traen filas completas por una sola entidad.
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

interface FilaFormacionMineral {
  mineral_id?: string;
  componentes: { compuesto_id: string; cantidad: number }[] | null;
}

/**
 * Fila de la tabla puente planta_organos, con el Organo del catálogo
 * compartido ya resuelto (join vía organo_id) — la fórmula real vive en
 * `organo.componentes`, la fila puente solo guarda el vínculo.
 * Supabase tipa la relación embebida como array aunque en runtime sea un
 * único registro (FK organo_id → organos.id) — se toma el primero.
 */
interface FilaVinculoOrgano {
  planta_id: string;
  organo: { componentes: { compuesto_id: string; cantidad: number }[] | null }[] | null;
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
        { data: formaciones },
        { data: floras },
        { data: organos },
      ] = await Promise.all([
        supabase.from("minerales").select("id, nombre"),
        supabase.from("mineral_formaciones").select("mineral_id, componentes"),
        supabase.from("flora").select("id, nombre"),
        supabase.from("planta_organos").select("planta_id, organo:organos(componentes)"),
      ]);

      if (cancelado) return;

      const mezclaMineral = new Map<string, ComponenteCompuestoEnMezcla[]>();
      for (const f of (formaciones ?? []) as FilaFormacionMineral[]) {
        if (!f.mineral_id || !f.componentes) continue;
        const acumulada = mezclaMineral.get(f.mineral_id) ?? [];
        mezclaMineral.set(f.mineral_id, [...acumulada, ...f.componentes]);
      }

      const mezclaFlora = new Map<string, ComponenteCompuestoEnMezcla[]>();
      for (const v of (organos ?? []) as FilaVinculoOrgano[]) {
        const componentes = v.organo?.[0]?.componentes;
        if (!v.planta_id || !componentes) continue;
        const acumulada = mezclaFlora.get(v.planta_id) ?? [];
        mezclaFlora.set(v.planta_id, [...acumulada, ...componentes]);
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
