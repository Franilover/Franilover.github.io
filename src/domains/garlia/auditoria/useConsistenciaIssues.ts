"use client";

/**
 * useConsistenciaIssues.ts
 * ────────────────────────
 * compuesto_consistencia_issues: a diferencia de la tabla de alertas de
 * estequiometría, ESTA sí soporta filas cerradas sin borrarlas —
 * resolved_at null = abierto, con fecha = cerrado (ver types.ts).
 * Se exponen ambos grupos ya separados para que el componente no tenga
 * que repetir el filtro.
 *
 * Solo lectura: no se expone setItems.
 */

import { useMemo } from "react";

import {
  CONFIG_CONSISTENCIA_ISSUES,
  type ConsistenciaIssue,
} from "@/domains/garlia/auditoria/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";
import { grupoSeveridad } from "./types";

export function useConsistenciaIssues() {
  const { data, loading } = useSupabaseData<ConsistenciaIssue>(
    CONFIG_CONSISTENCIA_ISSUES.tabla,
    { select: CONFIG_CONSISTENCIA_ISSUES.select, order: { campo: "detected_at" } },
  );

  const abiertos = useMemo(() => data.filter((i) => i.resolved_at === null), [data]);
  const cerrados = useMemo(() => data.filter((i) => i.resolved_at !== null), [data]);
  // Solo entre los ABIERTOS — un issue cerrado de severidad alta ya no
  // necesita destacar el layout, ver nota en useAlertasEstequiometria.ts.
  const altaOCritica = useMemo(
    () =>
      abiertos.filter((i) => {
        const g = grupoSeveridad(i.severity);
        return g === "Alta" || g === "Crítica";
      }).length,
    [abiertos],
  );

  return { items: data, abiertos, cerrados, loading, altaOCritica };
}
