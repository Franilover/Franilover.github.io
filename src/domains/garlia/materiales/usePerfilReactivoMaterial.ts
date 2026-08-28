"use client";

import { useMemo } from "react";

import {
  CONFIG_PERFIL_REACTIVO_MATERIAL,
  type PerfilReactivoMaterial,
} from "@/domains/garlia/materiales/types";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";

/**
 * Lee el Perfil Reactivo Emergente V2 de un material desde la vista
 * `v_perfil_reactivo_material` (fuente de verdad — ver documentacion_sistema,
 * orden 1101 "Perfil reactivo emergente V2"). Solo lectura: el perfil ya
 * viene derivado por Supabase desde la microestructura del material: no se
 * recalcula ni se completa nada en frontend.
 *
 * Si `estado !== "derivado_microestructura"` (p. ej. "insuficiente_informacion"),
 * el material no tiene desglose microscópico suficiente todavía — la UI debe
 * mostrar ese estado explícitamente, nunca un valor inventado ni un cero.
 */
export function usePerfilReactivoMaterial(materialId?: string | null) {
  const { data, loading } = useSupabaseData<PerfilReactivoMaterial>(
    CONFIG_PERFIL_REACTIVO_MATERIAL.tabla,
    {
      select: CONFIG_PERFIL_REACTIVO_MATERIAL.select,
    },
  );

  const item = useMemo(
    () => (materialId ? data.find((row) => row.material_id === materialId) ?? null : null),
    [data, materialId],
  );

  return {
    item,
    loading: materialId ? loading : false,
  };
}
