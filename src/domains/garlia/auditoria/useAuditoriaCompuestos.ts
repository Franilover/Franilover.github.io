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
  PROPIEDADES_COMPUESTO_COMPARABLES,
  type AuditoriaCompuestoRow,
} from "@/domains/garlia/auditoria/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

/** Misma tolerancia que AuditoriaDerivacionPanel.tsx — duplicada acá a
 *  propósito (constante primitiva, no vale la pena una dependencia
 *  cruzada solo por esto) para poder calcular el conteo de discrepancias
 *  reales sin que el header de AuditoriaSection tenga que reimplementar
 *  la lógica de comparación por propiedad. */
const TOLERANCIA = 0.0005;

function tieneDiscrepancia(row: AuditoriaCompuestoRow): boolean {
  return PROPIEDADES_COMPUESTO_COMPARABLES.some(
    (p) => Math.abs(Number(row[p.campo]) - Number(row[p.campoDerivado])) > TOLERANCIA,
  );
}

export function useAuditoriaCompuestos() {
  const { data, loading } = useSupabaseData<AuditoriaCompuestoRow>(
    CONFIG_AUDITORIA_COMPUESTOS.tabla,
    { select: CONFIG_AUDITORIA_COMPUESTOS.select, order: { campo: "nombre" } },
  );

  const items = useMemo(() => data, [data]);
  const conDiscrepancia = useMemo(() => items.filter(tieneDiscrepancia).length, [items]);

  return { items, loading, conDiscrepancia };
}
