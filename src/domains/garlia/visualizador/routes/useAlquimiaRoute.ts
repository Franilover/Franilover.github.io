"use client";

/**
 * useAlquimiaRoute.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Perspectiva ALQUÍMICA del Visualizador: Partícula química → capa
 * (núcleo/media/externa) → Elemento.
 *
 * Ruta distinta de la perspectiva FÍSICA (useFisicaRoute.ts, Partícula A/T/S
 * → IUM → Oris). Comparten el vocabulario de 11 Partículas de Química
 * (PARTICLE_TYPES / PARTICULA_QUIMICA_FORMULA) pero NO son la misma cadena —
 * ver PerspectivaSwitcher.tsx, que evita que se rendericen fusionadas.
 *
 * Cero matemática nueva: reusa tal cual
 *   - useElementos() (elementos/useElementos.ts)
 *   - LAYER_PARTICLES, LAYER_LABEL, formatLayer, layerTotal, PARTICLE_INITIAL
 *     (elementos/types.ts)
 *   - PARTICULA_QUIMICA_FORMULA (fisica/types.ts) para pintar cada Partícula
 *     de Química con su fórmula A/T/S real usando ParticulaVisual — no se
 *     inventa una fórmula nueva, se reusa la ya existente en Física.
 * Este archivo solo selecciona un Elemento activo y arma el shape que
 * StructureCanvas/Inspector/TraceView necesitan para pintarlo.
 */

import { useMemo, useState } from "react";

import { useElementos } from "@/domains/garlia/elementos/useElementos";
import {
  LAYER_LABEL,
  LAYER_PARTICLES,
  formatLayer,
  layerTotal,
  type Elemento,
  type LayerName,
  type ParticleMap,
  type ParticleType,
} from "@/domains/garlia/elementos/types";
import { PARTICULA_QUIMICA_FORMULA } from "@/domains/garlia/fisica/types";

export interface CapaResumen {
  capa: LayerName;
  label: string;
  particulas: ParticleMap;
  total: number;
  resumen: string;
  /** Partículas de química de esta capa ya expandidas (una entrada por
   *  unidad) con su fórmula A/T/S real — para CapaNodo, mismo criterio que
   *  particulasDeCapaSel pero disponible para las 3 capas a la vez, no
   *  solo la capa en zoom. */
  particulasExpandidas: { nombre: ParticleType; formula: string }[];
}

export interface AlquimiaRouteState {
  loading: boolean;
  empty: boolean;
  /** Siempre null hoy: useElementos() (elementos/useElementos.ts) no
   *  propaga el error de useSupabaseData hacia afuera — mismo patrón
   *  compartido con otros consumidores fuera de visualizador/
   *  (ElementosPage, etc.), no se corrige acá para no arriesgar romper
   *  esas secciones. Riesgo documentado, no resuelto — ver auditoría VIS-01. */
  error: null;

  elementos: Elemento[];

  elementoSel: Elemento | null;
  setElementoSelId: (id: string | null) => void;

  capaSel: LayerName | null;
  setCapaSel: (capa: LayerName | null) => void;

  /** Las 3 capas del Elemento seleccionado, con su ParticleMap real. */
  capas: CapaResumen[];

  /** Partículas de Química expandidas de la capa activa (una entrada por
   *  unidad), cada una con su fórmula A/T/S real — para ParticulaVisual. */
  particulasDeCapaSel: { nombre: ParticleType; formula: string }[];
}

const NOMBRES_CAPA: LayerName[] = ["nucleo", "media", "externa"];

/** Expande un ParticleMap de una capa a una entrada por unidad con su
 *  fórmula A/T/S real — misma lógica que particulasDeCapaSel pero
 *  reutilizable para cualquier capa, no solo la seleccionada. */
function expandirParticulasCapa(mapa: ParticleMap, capa: LayerName): { nombre: ParticleType; formula: string }[] {
  const out: { nombre: ParticleType; formula: string }[] = [];
  for (const tipo of LAYER_PARTICLES[capa]) {
    const cantidad = mapa[tipo] ?? 0;
    const formula = PARTICULA_QUIMICA_FORMULA[tipo];
    if (!cantidad || !formula) continue;
    for (let i = 0; i < cantidad; i++) out.push({ nombre: tipo, formula });
  }
  return out;
}

export function useAlquimiaRoute(): AlquimiaRouteState {
  const { items: elementos, loading } = useElementos();

  const [elementoSelId, setElementoSelId] = useState<string | null>(null);
  const [capaSel, setCapaSel] = useState<LayerName | null>(null);

  const elementoSel = useMemo(
    () =>
      elementoSelId
        ? elementos.find((e) => e.id === elementoSelId) ?? null
        : elementos[0] ?? null,
    [elementos, elementoSelId],
  );

  const capas = useMemo<CapaResumen[]>(() => {
    if (!elementoSel) return [];
    return NOMBRES_CAPA.map((capa) => {
      const particulas = elementoSel[capa] ?? {};
      return {
        capa,
        label: LAYER_LABEL[capa],
        particulas,
        total: layerTotal(particulas),
        resumen: formatLayer(particulas),
        particulasExpandidas: expandirParticulasCapa(particulas, capa),
      };
    });
  }, [elementoSel]);

  const particulasDeCapaSel = useMemo(() => {
    if (!elementoSel || !capaSel) return [];
    return expandirParticulasCapa(elementoSel[capaSel] ?? {}, capaSel);
  }, [elementoSel, capaSel]);

  return {
    loading,
    empty: !loading && elementos.length === 0,
    error: null,
    elementos,
    elementoSel,
    setElementoSelId,
    capaSel,
    setCapaSel,
    capas,
    particulasDeCapaSel,
  };
}
