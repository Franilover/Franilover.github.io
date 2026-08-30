"use client";

/**
 * useCompuestoRoute.ts
 * ───────────────────────────────────────────────────────────────────────────
 * VIS-03 — Elementos → Sitios → Compatibilidad → Enlaces → Estructura →
 * Compuesto (documento maestro del Visualizador, Parte 4).
 *
 * Tercera ruta del Visualizador junto a Física (useFisicaRoute) y Alquimia
 * (useAlquimiaRoute) — PerspectivaSwitcher gana una tercera opción. Mismo
 * principio que las otras dos: este archivo NO calcula química ni física,
 * solo selecciona un Compuesto activo y arma el shape que
 * StructureCanvas/Inspector/TraceView necesitan, a partir de hooks ya
 * existentes y probados en producción:
 *
 *   - useCompuestosConElementos() (elementos/useCompuestosConElementos.ts)
 *     → catálogo + composición real (compuesto_elementos, con cantidad)
 *   - useElementos() (elementos/useElementos.ts) → catálogo de Elementos
 *     para resolver nombre/símbolo/AtomoVisual de cada componente
 *   - useCompuestoEnlaces(compuestoId) (elementos/useCompuestoEnlaces.ts)
 *     → enlaces reales instanciados (compuesto_enlaces × enlace_sitios),
 *     el grafo elemento↔elemento que sostiene la sección 6 "Nacimiento del
 *     enlace" / 17 "Selección de una conexión" del docx
 *   - useElementoSitiosEnlace(elementoId) (elementos/useElementoSitiosEnlace.ts)
 *     → sitios de enlace de un elemento puntual (sección 3 "Aparecen los
 *     sitios" / 18 "Click sobre un sitio")
 *   - useEstructuraComposicion(estructuraId) (elementos/useEstructuraComposicion.ts)
 *     y useEstructuras() (elementos/useEstructuras.ts) → capa de Estructura
 *     real cuando el compuesto tiene una asociada (sección 9 "Composición
 *     vs. estructura" — la fórmula A+B+C no explica la arquitectura)
 *
 * Regla del docx (punto 13, Modo Laboratorio): "no se permite dibujar
 * enlaces arbitrarios [...] el motor determina qué estructura resulta".
 * Este hook expone únicamente lo que el motor ya calculó y persistió en
 * Supabase — no hay recomposición ni evaluación de laboratorio acá todavía
 * (ese modo depende de un RPC de evaluación que hoy no existe; ver nota en
 * CompuestoRouteState.laboratorioDisponible más abajo, no se inventa uno).
 */

import { useMemo, useState } from "react";

import { useCompuestosConElementos } from "@/domains/garlia/elementos/useCompuestosConElementos";
import { useElementos } from "@/domains/garlia/elementos/useElementos";
import { useCompuestoEnlaces, type CompuestoEnlaceRow } from "@/domains/garlia/elementos/useCompuestoEnlaces";
import { useElementoSitiosEnlace, type ElementoSitioEnlace } from "@/domains/garlia/elementos/useElementoSitiosEnlace";
import { useEstructuras } from "@/domains/garlia/elementos/useEstructuras";
import { useEstructuraComposicion } from "@/domains/garlia/elementos/useEstructuraComposicion";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";
import {
  CONFIG_ESTRUCTURA_COMPUESTOS,
  type Compuesto,
  type Elemento,
  type EstructuraCompuesto,
} from "@/domains/garlia/elementos/types";

/** Un elemento componente del compuesto activo, ya resuelto contra el
 *  catálogo de Elementos, con la cantidad real (compuesto_elementos.cantidad). */
export interface ComponenteResuelto {
  elemento: Elemento;
  cantidad: number;
}

export interface CompuestoRouteState {
  loading: boolean;
  empty: boolean;
  error: null;

  compuestos: Compuesto[];
  compuestoSel: Compuesto | null;
  setCompuestoSelId: (id: string | null) => void;

  /** Composición real del compuesto activo (elemento + cantidad), en el
   *  mismo orden que compuesto_elementos — la "fórmula" del docx (punto 9). */
  componentes: ComponenteResuelto[];

  /** Elemento con foco (hover/click sobre un nodo ELEMENTOS o SITIOS) —
   *  null si ninguno está enfocado. Nunca se infiere un elemento sin que
   *  el usuario lo haya seleccionado. */
  elementoFocoId: string | null;
  setElementoFocoId: (id: string | null) => void;

  /** Sitios de enlace reales del elemento con foco — vacío si no hay foco
   *  o si el elemento no tiene sitios calculados todavía (docx punto 3:
   *  "estos son sitios disponibles, no enlaces"). */
  sitiosDelElementoFoco: ElementoSitioEnlace[];
  loadingSitios: boolean;

  /** Enlaces reales instanciados del compuesto activo (compuesto_enlaces),
   *  cada uno ya resuelto contra enlace_sitios (intensidad, estabilidad,
   *  reversibilidad, coste_energetico) — el "nacimiento del enlace" del
   *  docx (punto 6) y la ficha de "Selección de una conexión" (punto 17). */
  enlaces: CompuestoEnlaceRow[];
  loadingEnlaces: boolean;

  /** Estructura real asociada al compuesto activo, si existe una fila en
   *  estructura_compuestos que lo referencia — null si el compuesto no
   *  tiene estructura formalizada todavía (docx punto 9: la fórmula no
   *  explica la arquitectura, pero puede no haber arquitectura formal aún,
   *  y eso NO se disimula mostrando una estructura inventada). */
  estructuraId: string | null;
  estructuraNombre: string | null;
  /** Los mismos compuestos-hermanos que comparten esa Estructura (si la
   *  Estructura agrupa más de un compuesto) — vacío si no hay Estructura. */
  compuestosDeLaEstructura: { compuesto_id: string; nombre: string; proporcion: number | null }[];

  /** El docx (punto 13) pide un Modo Laboratorio que evalúa recomposición
   *  contra el motor real ("[EVALUAR]"). No existe hoy un RPC de
   *  evaluación de compuestos en Supabase (a diferencia del Sandbox de
   *  VIS-17, que sí tiene crear_sandbox/agregar_entidad_sandbox/etc.) —
   *  se documenta como false en vez de simular el resultado en el
   *  frontend, que violaría la regla "el motor determina, no el visor". */
  laboratorioDisponible: false;
}

export function useCompuestoRoute(): CompuestoRouteState {
  const { items: compuestos, loading: loadingCompuestos } = useCompuestosConElementos();
  const { items: elementos, loading: loadingElementos } = useElementos();

  const [compuestoSelId, setCompuestoSelId] = useState<string | null>(null);
  const [elementoFocoId, setElementoFocoId] = useState<string | null>(null);

  const compuestoSel = useMemo(
    () =>
      compuestoSelId
        ? compuestos.find((c) => c.id === compuestoSelId) ?? null
        : compuestos[0] ?? null,
    [compuestos, compuestoSelId],
  );

  const elementosPorId = useMemo(() => {
    const mapa = new Map<string, Elemento>();
    for (const e of elementos) mapa.set(e.id, e);
    return mapa;
  }, [elementos]);

  const componentes = useMemo<ComponenteResuelto[]>(() => {
    if (!compuestoSel?.componentes) return [];
    return compuestoSel.componentes
      .map((c) => {
        const elemento = elementosPorId.get(c.elemento_id);
        if (!elemento) return null;
        return { elemento, cantidad: c.cantidad };
      })
      .filter((c): c is ComponenteResuelto => c !== null);
  }, [compuestoSel, elementosPorId]);

  const { items: sitiosDelElementoFoco, loading: loadingSitios } =
    useElementoSitiosEnlace(elementoFocoId);

  const { items: enlaces, loading: loadingEnlaces } = useCompuestoEnlaces(
    compuestoSel?.id ?? null,
  );

  // ─── Estructura real (si existe) ─────────────────────────────────────
  // useEstructuraComposicion resuelve estructura → compuestos (1 estructura,
  // N compuestos), pero acá se necesita el camino inverso (compuesto → su
  // estructura, si tiene una). No hay columna compuesto_id en "estructuras"
  // (la relación vive solo en la tabla puente M:N estructura_compuestos) —
  // se trae la tabla puente completa (ya cacheada por useSupabaseData,
  // mismo patrón que useCompuestoEnlaces) y se busca la primera fila que
  // referencia al compuesto activo, junto con el catálogo de Estructuras
  // para resolver su nombre.
  const { items: estructuras, loading: loadingEstructuras } = useEstructuras();
  const { data: vinculosEstructuraCompuesto, loading: loadingVinculos } =
    useSupabaseData<EstructuraCompuesto>(CONFIG_ESTRUCTURA_COMPUESTOS.tabla, {
      select: CONFIG_ESTRUCTURA_COMPUESTOS.select,
    });

  const estructuraDelCompuesto = useMemo(() => {
    if (!compuestoSel) return null;
    const vinculo = vinculosEstructuraCompuesto.find(
      (v) => v.compuesto_id === compuestoSel.id,
    );
    if (!vinculo) return null;
    return estructuras.find((e) => e.id === vinculo.estructura_id) ?? null;
  }, [vinculosEstructuraCompuesto, estructuras, compuestoSel]);

  const { items: compuestosDeEstructuraRaw } = useEstructuraComposicion(
    estructuraDelCompuesto?.id ?? null,
  );

  const compuestosDeLaEstructura = useMemo(
    () =>
      compuestosDeEstructuraRaw.map((c) => ({
        compuesto_id: c.compuesto_id,
        nombre: c.compuesto.nombre,
        proporcion: c.proporcion,
      })),
    [compuestosDeEstructuraRaw],
  );

  return {
    loading: loadingCompuestos || loadingElementos || loadingEstructuras || loadingVinculos || loadingEnlaces,
    empty: !loadingCompuestos && compuestos.length === 0,
    error: null,
    compuestos,
    compuestoSel,
    setCompuestoSelId,
    componentes,
    elementoFocoId,
    setElementoFocoId,
    sitiosDelElementoFoco,
    loadingSitios,
    enlaces,
    loadingEnlaces,
    estructuraId: estructuraDelCompuesto?.id ?? null,
    estructuraNombre: estructuraDelCompuesto?.nombre ?? null,
    compuestosDeLaEstructura,
    laboratorioDisponible: false,
  };
}
