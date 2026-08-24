"use client";

/**
 * useCriaturaOrganos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Hook para CRUD de Órganos de una criatura. Ya NO reimplementa el patrón de
 * vínculo N:N a mano — delega directo a useEntidadVinculosGrupo (ver ese
 * archivo para el razonamiento completo), instanciado contra el catálogo
 * real "organos" vía estructura_componentes (padre_tipo='criatura',
 * hijo_tipo='organo') — FASE 7, reemplaza la tabla dedicada
 * "criatura_organos" (sigue existiendo sin usarse, limpieza en Fase 8).
 *
 * Distinto de `perfiles_atomicos_criatura`: ese es composición directa por
 * ELEMENTO (nivel micro, como `compuestos`), esto es ensamblaje por
 * COMPUESTO vía Tejidos/Células (nivel macro, como Formaciones/Órganos del
 * resto del árbol). No hay solapamiento, son capas distintas.
 *
 * Reemplaza la versión vieja que apuntaba a la tabla ya eliminada
 * "estructuras_ensambladas" y tipaba contra GrupoCompuesto/componentes.
 * Mantiene el mismo nombre de export (`organos`, `crearYVincularOrgano`,
 * etc.) para no tener que tocar EditorCriatura.tsx más de lo necesario.
 */

import { useEntidadVinculosGrupo } from "@/domains/garlia/_shared/useEntidadVinculosGrupo";
import type { Organo } from "@/domains/garlia/elementos/types";

export type CriaturaOrganoResuelto = Organo & { vinculo_id: string };

export function useCriaturaOrganos(criaturaId: string, catalogoOrganos: Organo[]) {
  const {
    items: organos,
    loading,
    crearYVincular: crearYVincularOrgano,
    vincularExistente: vincularOrganoExistente,
    actualizar: actualizarOrgano,
    desvincular: desvincularOrgano,
    load,
  } = useEntidadVinculosGrupo({
    entidadId: criaturaId,
    padreTipo: "criatura",
    tablaCatalogo: "organos",
    hijoTipo: "organo",
    catalogo: catalogoOrganos,
  });

  return {
    organos: organos as CriaturaOrganoResuelto[],
    loading,
    crearYVincularOrgano,
    vincularOrganoExistente,
    actualizarOrgano,
    desvincularOrgano,
    load,
  };
}
