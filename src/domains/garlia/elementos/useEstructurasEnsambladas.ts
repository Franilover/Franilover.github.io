"use client";

/**
 * useEstructurasEnsambladas.ts
 * ────────────────────────
 * Catálogo unificado de Estructuras Ensambladas: conjuntos reutilizables de
 * Compuestos, pensados para vincularse N:N a plantas de Flora
 * (planta_organos.grupo_compuesto_id), minerales
 * (mineral_formaciones.grupo_compuesto_id), items
 * (item_estructura.grupo_compuesto_id) y criaturas
 * (criatura_organos.grupo_compuesto_id) — todos apuntando a
 * estructuras_ensambladas.id. Editar una Estructura acá actualiza todo lo
 * que la use, sea planta, mineral, item o criatura.
 *
 * Reemplaza a los antiguos useOrganos.ts (tabla "organos") y
 * useFormaciones.ts (tabla "formaciones") — ambos catálogos vivían
 * separados en un rediseño intermedio; hoy comparten una única tabla real
 * "estructuras_ensambladas". Mismo shape, mismo patrón useSupabaseData que
 * useCompuestos.ts / useGruposCompuestos.ts.
 */

import { useMemo } from "react";

import {
  CONFIG_ESTRUCTURAS_ENSAMBLADAS,
  type EstructuraEnsamblada,
} from "@/domains/garlia/elementos/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export function useEstructurasEnsambladas() {
  const { data, setData, loading } = useSupabaseData<EstructuraEnsamblada>(
    CONFIG_ESTRUCTURAS_ENSAMBLADAS.tabla,
    {
      select: CONFIG_ESTRUCTURAS_ENSAMBLADAS.select,
      order: { campo: "created_at" },
    },
  );

  const items = useMemo(() => data, [data]);

  return { items, setItems: setData, loading };
}
