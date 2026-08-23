"use client";

/**
 * useTejidoCelulas.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Resuelve las Células vinculadas a UN Tejido — tabla puente `tejido_celulas`
 * (M:N, migración ago-2026 que reemplazó a la vieja `tejidos.celula_id` 1:1).
 * Un Tejido puede tener varias Células (ej. varios tipos celulares que lo
 * pueblan) y una misma Célula puede aparecer en varios Tejidos.
 *
 * No cachea en Dexie todavía — infra/supabase/db.ts no tiene registrada la
 * tabla `tejido_celulas` (agregarla ahí como bulkPut/where análogo a
 * `organo_tejidos` para pintar offline-first, ver useOrganoTejidos.ts).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";

import {
  CONFIG_CELULAS,
  CONFIG_TEJIDO_CELULAS,
  type Celula,
  type TejidoCelula,
} from "@/domains/garlia/elementos/types";

/** Una fila resuelta: vínculo + Célula ya cargada, lista para la UI. */
export interface CelulaDeTejido {
  vinculo_id: string;
  tejido_id: string;
  celula_id: string;
  rol: string | null;
  proporcion: string | null;
  celula: Celula;
}

export function useTejidoCelulas(tejidoId: string | null) {
  const [vinculos, setVinculos] = useState<TejidoCelula[]>([]);
  const [celulas, setCelulas] = useState<Record<string, Celula>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tejidoId) {
      setVinculos([]);
      setCelulas({});
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: vinculoData, error: vinculoError } = await supabase
      .from(CONFIG_TEJIDO_CELULAS.tabla)
      .select(CONFIG_TEJIDO_CELULAS.select)
      .eq("tejido_id", tejidoId)
      .order("created_at", { ascending: true });

    if (vinculoError || !vinculoData) {
      setVinculos([]);
      setCelulas({});
      setLoading(false);
      return;
    }
    setVinculos(vinculoData as unknown as TejidoCelula[]);

    const celulaIds = (vinculoData as unknown as TejidoCelula[]).map((v) => v.celula_id);
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
    for (const c of (celulaData ?? []) as unknown as Celula[]) celulasPorId[c.id] = c;
    setCelulas(celulasPorId);
    setLoading(false);
  }, [tejidoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<CelulaDeTejido[]>(() => {
    return vinculos
      .map((v) => {
        const celula = celulas[v.celula_id];
        if (!celula) return null;
        return {
          vinculo_id: v.id,
          tejido_id: v.tejido_id,
          celula_id: v.celula_id,
          rol: v.rol,
          proporcion: v.proporcion,
          celula,
        };
      })
      .filter((c): c is CelulaDeTejido => c !== null);
  }, [vinculos, celulas]);

  /** Vincular una Célula ya existente del catálogo a este Tejido. */
  const vincularExistente = useCallback(
    async (celulaId: string, rol?: string) => {
      if (!tejidoId) return null;
      const { data: vinculo, error } = await supabase
        .from(CONFIG_TEJIDO_CELULAS.tabla)
        .insert([{ tejido_id: tejidoId, celula_id: celulaId, rol: rol ?? null }])
        .select()
        .single();
      if (error || !vinculo) return null;

      if (!celulas[celulaId]) {
        const { data: celulaData } = await supabase
          .from(CONFIG_CELULAS.tabla)
          .select(CONFIG_CELULAS.select)
          .eq("id", celulaId)
          .single();
        if (celulaData) {
          setCelulas((prev) => ({ ...prev, [celulaId]: celulaData as unknown as Celula }));
        }
      }
      setVinculos((prev) => [...prev, vinculo as unknown as TejidoCelula]);
      return vinculo as unknown as TejidoCelula;
    },
    [tejidoId, celulas],
  );

  /** Editar el rol de una fila (ej. "célula principal", "matriz extracelular"). */
  const actualizarRol = useCallback(async (vinculoId: string, rol: string) => {
    setVinculos((prev) => prev.map((v) => (v.id === vinculoId ? { ...v, rol } : v)));
    const { error } = await supabase
      .from(CONFIG_TEJIDO_CELULAS.tabla)
      .update({ rol })
      .eq("id", vinculoId);
    if (error) console.error("[useTejidoCelulas] error actualizando rol:", error);
  }, []);

  /** Editar la proporción de una fila. */
  const actualizarProporcion = useCallback(async (vinculoId: string, proporcion: string) => {
    setVinculos((prev) => prev.map((v) => (v.id === vinculoId ? { ...v, proporcion } : v)));
    const { error } = await supabase
      .from(CONFIG_TEJIDO_CELULAS.tabla)
      .update({ proporcion })
      .eq("id", vinculoId);
    if (error) console.error("[useTejidoCelulas] error actualizando proporción:", error);
  }, []);

  /** Quitar el vínculo (la Célula queda en su catálogo, no se borra). */
  const quitar = useCallback(async (vinculoId: string) => {
    setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
    const { error } = await supabase.from(CONFIG_TEJIDO_CELULAS.tabla).delete().eq("id", vinculoId);
    if (error) console.error("[useTejidoCelulas] error quitando vínculo:", error);
  }, []);

  return { items, loading, vincularExistente, actualizarRol, actualizarProporcion, quitar, load };
}
