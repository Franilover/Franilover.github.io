"use client";

/**
 * useAuditoriaCompuestos.ts
 * ────────────────────────
 * Fila cruda de v_auditoria_compuestos_derivacion por compuesto: valores
 * almacenados vs derivados. Mismo patrón que useElementos.ts.
 *
 * El semáforo (ok/discrepancia real por propiedad) NO se calcula acá —
 * vive en el componente de UI (Paso 4), usando
 * PROPIEDADES_COMPUESTO_COMPARABLES de types.ts. Este hook solo entrega
 * los datos crudos, sin opinar.
 *
 * Solo lectura: no se expone setItems.
 */

import { useMemo } from "react";

import {
  CONFIG_AUDITORIA_COMPUESTOS,
  type AuditoriaCompuestoRow,
} from "@/domains/garlia/auditoria/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export function useAuditoriaCompuestos() {
  const { data, loading } = useSupabaseData<AuditoriaCompuestoRow>(
    CONFIG_AUDITORIA_COMPUESTOS.tabla,
    { select: CONFIG_AUDITORIA_COMPUESTOS.select, order: { campo: "nombre" } },
  );

  const items = useMemo(() => data, [data]);

  return { items, loading };
}
