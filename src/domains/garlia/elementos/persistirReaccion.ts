"use client";

/**
 * Persistencia normalizada de Reacciones (Fase 6).
 *
 * `consume`/`produce` siguen existiendo temporalmente en `reacciones` por
 * compatibilidad con el esquema legado, pero ya no son fuente de verdad.
 * La composición de una reacción vive en `reaccion_componentes`.
 */

import { supabase } from "@/infra/supabase/supabase";
import type { EntradaReaccion, Reaccion } from "./types";

type CambiosPersistibles = Partial<Reaccion>;

function filasComponentes(
  reaccionId: string,
  direccion: "reactivo" | "producto",
  entradas: EntradaReaccion[],
) {
  return (entradas ?? []).map((entrada) => ({
    reaccion_id: reaccionId,
    entidad_tipo: entrada.tipo,
    entidad_id: entrada.id,
    direccion,
    cantidad: entrada.cantidad,
  }));
}

/**
 * Actualiza una reacción usando el modelo normalizado.
 *
 * Importante: no escribe `consume`/`produce` en la fila de `reacciones`.
 * Las columnas JSONB quedan únicamente como compatibilidad hasta que la
 * migración final las elimine.
 */
export async function persistirReaccion(
  reaccionId: string,
  cambios: CambiosPersistibles,
): Promise<{ error: Error | null }> {
  const { consume, produce, ...metadatos } = cambios;

  if (Object.keys(metadatos).length > 0) {
    const { error } = await supabase.from("reacciones").update(metadatos).eq("id", reaccionId);
    if (error) return { error };
  }

  for (const [direccion, entradas] of [
    ["reactivo", consume],
    ["producto", produce],
  ] as const) {
    if (entradas === undefined) continue;

    const { error: deleteError } = await supabase
      .from("reaccion_componentes")
      .delete()
      .eq("reaccion_id", reaccionId)
      .eq("direccion", direccion);

    if (deleteError) return { error: deleteError };

    const filas = filasComponentes(reaccionId, direccion, entradas);
    if (filas.length === 0) continue;

    const { error: insertError } = await supabase.from("reaccion_componentes").insert(filas);
    if (insertError) return { error: insertError };
  }

  return { error: null };
}
