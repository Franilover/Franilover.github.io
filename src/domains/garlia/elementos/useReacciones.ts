"use client";

/**
 * Catálogo de Reacciones. Desde Fase 6 la fuente de verdad de consume/produce
 * es `reaccion_componentes`; el JSONB legado de `reacciones` ya no se lee.
 */

import { useEffect, useMemo, useState } from "react";
import { CONFIG_REACCIONES, type EntradaReaccion, type Reaccion, type ReaccionComponenteRow } from "@/domains/garlia/elementos/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";
import { supabase } from "@/infra/supabase/supabase";



export function useReacciones() {
  const { data, setData, loading } = useSupabaseData<Reaccion>(CONFIG_REACCIONES.tabla, {
    // Las columnas JSONB siguen presentes por compatibilidad, pero no son
    // fuente de verdad. Se seleccionan solo para que el shape legacy no
    // rompa otros consumidores durante la transición.
    select: CONFIG_REACCIONES.select,
    order: { campo: "created_at" },
  });

  const [componentes, setComponentes] = useState<ReaccionComponenteRow[]>([]);
  const [loadingComponentes, setLoadingComponentes] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setLoadingComponentes(true);
      const { data: rows, error } = await supabase
        .from("reaccion_componentes")
        .select("id, reaccion_id, entidad_tipo, entidad_id, direccion, cantidad, created_at")
        .order("created_at", { ascending: true });

      if (cancelado) return;
      if (error) {
        console.error("[useReacciones] error cargando reaccion_componentes:", error);
        setComponentes([]);
      } else {
        setComponentes((rows ?? []) as ReaccionComponenteRow[]);
      }
      setLoadingComponentes(false);
    }

    void cargar();
    return () => { cancelado = true; };
  }, [data.length]);

  const items = useMemo<Reaccion[]>(() => {
    const porReaccion = new Map<string, { consume: EntradaReaccion[]; produce: EntradaReaccion[] }>();
    for (const row of componentes) {
      const bucket = porReaccion.get(row.reaccion_id) ?? { consume: [], produce: [] };
      const entrada: EntradaReaccion = {
        tipo: row.entidad_tipo,
        id: row.entidad_id,
        cantidad: row.cantidad,
      };
      if (row.direccion === "reactivo") bucket.consume.push(entrada);
      else bucket.produce.push(entrada);
      porReaccion.set(row.reaccion_id, bucket);
    }

    return data.map((reaccion) => {
      const normalizada = porReaccion.get(reaccion.id);
      return {
        ...reaccion,
        consume: normalizada?.consume ?? [],
        produce: normalizada?.produce ?? [],
      };
    });
  }, [data, componentes]);

  // Mantiene la interfaz existente de useSupabaseData para no romper el
  // frontend: las mutaciones de consume/produce deben pasar por
  // persistirReaccion(), que escribe la tabla normalizada.
  return {
    items,
    setItems: setData,
    loading: loading || loadingComponentes,
  };
}
