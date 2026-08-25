"use client";

/**
 * useAlertasEstequiometria.ts
 * ────────────────────────
 * compuesto_estequiometria_alertas: toda fila presente está ACTIVA por
 * definición — las alertas resueltas se eliminan de la tabla en vez de
 * marcarse (ver estado_proyecto v97 y types.ts). No hay booleano
 * "resuelto" que filtrar acá; si la fila existe, es porque sigue abierta.
 *
 * Solo lectura: no se expone setItems.
 */

import { useMemo } from "react";

import {
  CONFIG_ALERTAS_ESTEQUIOMETRIA,
  type AlertaEstequiometria,
} from "@/domains/garlia/auditoria/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export function useAlertasEstequiometria() {
  const { data, loading } = useSupabaseData<AlertaEstequiometria>(
    CONFIG_ALERTAS_ESTEQUIOMETRIA.tabla,
    { select: CONFIG_ALERTAS_ESTEQUIOMETRIA.select, order: { campo: "severidad" } },
  );

  const items = useMemo(() => data, [data]);

  return { items, loading };
}
