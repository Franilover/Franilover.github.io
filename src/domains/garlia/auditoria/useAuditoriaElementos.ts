"use client";

/**
 * useAuditoriaElementos.ts
 * ────────────────────────
 * Fila cruda de v_auditoria_elementos_derivacion por elemento. Esta vista
 * no trae columna de veredicto usable: fuente_propiedades/metodo_propiedades
 * ya no están NULL (67/67 filas tienen un valor constante de procedencia —
 * ver types.ts), pero al ser igual para toda la tabla no es señal por fila.
 * El componente de UI la muestra como tabla de referencia, sin semáforo
 * propio inventado.
 *
 * Solo lectura: no se expone setItems.
 */

import { useMemo } from "react";

import {
  CONFIG_AUDITORIA_ELEMENTOS,
  type AuditoriaElementoRow,
} from "@/domains/garlia/auditoria/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export function useAuditoriaElementos() {
  const { data, loading } = useSupabaseData<AuditoriaElementoRow>(
    CONFIG_AUDITORIA_ELEMENTOS.tabla,
    { select: CONFIG_AUDITORIA_ELEMENTOS.select, order: { campo: "numero_atomico" } },
  );

  const items = useMemo(() => data, [data]);

  return { items, loading };
}
