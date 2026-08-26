"use client";

/**
 * useDocumentacionSistema.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Lee la tabla "documentacion_sistema": el catálogo real de conceptos que
 * explican, capa por capa, cómo funciona el sistema entero (Fundamentos →
 * Partículas → Elementos → Compuestos → Estructuras → Células → Tejidos →
 * Propiedades emergentes → Procesos y dinámica → Auditoría → ...), en
 * lenguaje humano — concepto, explicación, fórmula (cuando aplica),
 * dependencias declaradas y un ejemplo concreto.
 *
 * Es la fuente de la pestaña "Lógica" (ver LogicaSistemaPage): el mapa de
 * capas que se muestra ahí SON estas filas agrupadas por "capa" y
 * ordenadas por "orden" — no un diagrama aparte inventado, así que
 * cualquier cambio acá (agregar/editar un concepto en Supabase) se refleja
 * solo con recargar. Solo lectura: esta tabla se edita desde el propio
 * proceso de worldbuilding en Supabase, no desde este frontend.
 */

import { useMemo } from "react";

import { useSupabaseData } from "@/infra/sync/useSupabaseData";

export interface ConceptoDocumentacion {
  id: number;
  orden: number;
  capa: string;
  concepto: string;
  explicacion: string;
  formula: string | null;
  dependencias: string | null;
  ejemplo: string | null;
  notas: string | null;
  activo: boolean;
}

export const CONFIG_DOCUMENTACION_SISTEMA = {
  tabla: "documentacion_sistema",
  select:
    "id, orden, capa, concepto, explicacion, formula, dependencias, ejemplo, notas, activo",
};

/** Una capa del mapa, con sus conceptos ya ordenados. El orden de las
 *  capas entre sí es el orden de aparición del primer concepto de cada
 *  una (mismo criterio que agrupa "documentacion_sistema" en Supabase). */
export interface CapaDocumentacion {
  capa: string;
  conceptos: ConceptoDocumentacion[];
}

/** Capas que son bitácora/estado interno del proceso de construcción
 *  ("Auditoría", "Motor", changelog de versiones dentro de "Arquitectura"/
 *  "General"), no explicaciones conceptuales del sistema. La tab "Lógica"
 *  es la versión humana de cómo funciona el mundo — este ruido de proceso
 *  (triggers, "Fin de v1", auditoría cruzada, etc.) no aporta ahí y se
 *  filtra para que "Manual científico" y el resto de capas conceptuales
 *  queden como protagonistas. Las filas siguen existiendo en Supabase
 *  intactas; esto solo afecta qué se lista en esta pantalla. */
const CAPAS_OCULTAS = new Set([
  "Arquitectura",
  "General",
  "Motor",
  "Auditoría",
  "Auditoría matemática",
  "Auditoría de simplificación",
]);

export function useDocumentacionSistema() {
  const { data, loading } = useSupabaseData<ConceptoDocumentacion>(
    CONFIG_DOCUMENTACION_SISTEMA.tabla,
    {
      select: CONFIG_DOCUMENTACION_SISTEMA.select,
      order: { campo: "orden" },
    },
  );

  const activos = useMemo(
    () => data.filter((c) => c.activo && !CAPAS_OCULTAS.has(c.capa)),
    [data],
  );

  const capas = useMemo<CapaDocumentacion[]>(() => {
    const orden: string[] = [];
    const mapa = new Map<string, ConceptoDocumentacion[]>();
    for (const c of activos) {
      if (!mapa.has(c.capa)) {
        mapa.set(c.capa, []);
        orden.push(c.capa);
      }
      mapa.get(c.capa)!.push(c);
    }
    return orden.map((capa) => ({ capa, conceptos: mapa.get(capa)! }));
  }, [activos]);

  return { capas, total: activos.length, loading };
}
