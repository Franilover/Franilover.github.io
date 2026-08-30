"use client";

/**
 * useEnlaceRoute.ts
 * ───────────────────────────────────────────────────────────────────────────
 * VIS-19 — El Enlace (documento maestro Parte 6 del docx original, ahí
 * numerado "VIS-05" — renumerado a VIS-19 en visualizador_estado porque
 * VIS-05..VIS-18 ya estaban ocupados; Supabase manda sobre la numeración
 * del docx).
 *
 * Idea central del docx: "VIS-04 era una posibilidad. VIS-19 empieza cuando
 * esa posibilidad ya se materializó." El protagonista es el enlace en sí
 * (origen, destino, fuerza, estabilidad), no las entidades que conecta.
 *
 * Flujo: Compuesto → lista de sus enlaces reales (compuesto_enlaces) →
 * un enlace activo para inspección ("anatomía") + opcionalmente un segundo
 * enlace para comparación.
 *
 * Reutiliza useCompuestoRoute() entero (mismo selector de Compuesto que ya
 * usa la ruta "Compuestos" — no se duplica la consulta) y solo agrega la
 * capa de selección de enlace + resolución de nombres A/B + comparación.
 *
 * Datos reales disponibles (nada inventado — ver columnas de Supabase):
 *   - compuesto_enlaces: instancia (compuesto_id, elemento_a_id,
 *     elemento_b_id, enlace_sitios_id) — vía useCompuestoEnlaces, ya
 *     resuelto dentro de useCompuestoRoute().enlaces.
 *   - enlace_sitios: intensidad, estabilidad, reversibilidad, confianza,
 *     coste_energetico, estado — la "fuerza"/"anatomía" real del enlace.
 *   - direccion: existe en enlace_sitios pero useCompuestoEnlaces no la trae
 *     todavía (no se agrega acá para no bifurcar esa consulta — queda
 *     documentado como ausente, no se inventa un valor).
 *
 * Lo que NO existe todavía y por eso no se implementa (docx lo advierte
 * explícitamente en el punto 22: "no se inventan colores, formas o tipos
 * hasta revisar exactamente qué categorías tiene el modelo"):
 *   - timeline propia de eventos por-enlace (formación/ruptura conectada a
 *     Sandbox) — no hay tabla que vincule un evento de sandbox_eventos a un
 *     compuesto_enlaces_id específico.
 *   - "familia"/tipo visual del enlace — vive en tipos_enlace, no está
 *     conectada desde compuesto_enlaces/enlace_sitios hoy.
 */

import { useMemo, useState } from "react";

import { useCompuestoRoute, type CompuestoRouteState } from "./useCompuestoRoute";
import type { CompuestoEnlaceRow } from "@/domains/garlia/elementos/useCompuestoEnlaces";
import type { Elemento } from "@/domains/garlia/elementos/types";

/** Un enlace real ya resuelto con el nombre/símbolo de sus dos elementos —
 *  el shape que consume el panel de "anatomía del enlace". */
export interface EnlaceResuelto extends CompuestoEnlaceRow {
  elementoA: Elemento | null;
  elementoB: Elemento | null;
}

export interface EnlaceRouteState {
  loading: boolean;
  empty: boolean;

  // ─── Selector de Compuesto (delega en useCompuestoRoute) ──────────────
  compuestoRoute: CompuestoRouteState;

  // ─── Enlaces del compuesto activo, ya con nombres resueltos ───────────
  enlaces: EnlaceResuelto[];
  loadingEnlaces: boolean;

  // ─── Enlace activo (el que se inspecciona) ────────────────────────────
  enlaceSel: EnlaceResuelto | null;
  setEnlaceSelId: (id: string | null) => void;

  // ─── Comparación: un segundo enlace opcional ──────────────────────────
  compararActivo: boolean;
  setCompararActivo: (activo: boolean) => void;
  enlaceCompararSel: EnlaceResuelto | null;
  setEnlaceCompararId: (id: string | null) => void;
}

export function useEnlaceRoute(): EnlaceRouteState {
  const compuestoRoute = useCompuestoRoute();

  const elementosPorId = useMemo(() => {
    const mapa = new Map<string, Elemento>();
    for (const c of compuestoRoute.componentes) mapa.set(c.elemento.id, c.elemento);
    return mapa;
  }, [compuestoRoute.componentes]);

  const enlaces = useMemo<EnlaceResuelto[]>(
    () =>
      compuestoRoute.enlaces.map((e) => ({
        ...e,
        elementoA: elementosPorId.get(e.elemento_a_id) ?? null,
        elementoB: elementosPorId.get(e.elemento_b_id) ?? null,
      })),
    [compuestoRoute.enlaces, elementosPorId],
  );

  const [enlaceSelId, setEnlaceSelId] = useState<string | null>(null);
  const enlaceSel = useMemo(
    () => (enlaceSelId ? enlaces.find((e) => e.id === enlaceSelId) ?? null : enlaces[0] ?? null),
    [enlaces, enlaceSelId],
  );

  const [compararActivo, setCompararActivo] = useState(false);
  const [enlaceCompararId, setEnlaceCompararId] = useState<string | null>(null);
  const enlaceCompararSel = useMemo(
    () => (enlaceCompararId ? enlaces.find((e) => e.id === enlaceCompararId) ?? null : null),
    [enlaces, enlaceCompararId],
  );

  return {
    loading: compuestoRoute.loading,
    empty: !compuestoRoute.loading && enlaces.length === 0,
    compuestoRoute,
    enlaces,
    loadingEnlaces: compuestoRoute.loadingEnlaces,
    enlaceSel,
    setEnlaceSelId,
    compararActivo,
    setCompararActivo,
    enlaceCompararSel,
    setEnlaceCompararId,
  };
}
