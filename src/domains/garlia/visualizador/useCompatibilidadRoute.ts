"use client";

/**
 * useCompatibilidadRoute.ts
 * ───────────────────────────────────────────────────────────────────────────
 * VIS-04 — Mapa de Compatibilidad (documento maestro del Visualizador,
 * Parte 5).
 *
 * Distinción clave respecto a VIS-03 (útil tenerla presente acá, no solo en
 * el docx): VIS-03 (useCompuestoRoute) muestra una estructura que YA EXISTE
 * — Elemento → Sitios → Enlaces → Compuesto, con datos leídos de
 * compuesto_elementos/compuesto_enlaces. VIS-04 muestra el ESPACIO DE
 * POSIBILIDADES antes de que exista el enlace — "¿qué puede interactuar con
 * qué?", no "qué ya interactúa". No hay tabla "compatibilidades" en
 * Supabase: la compatibilidad se CALCULA en el momento contra cada vecino,
 * con el mismo motor que ya usa el resto del sistema (elementos/afinidad.ts).
 * Nunca se persiste ni se inventa un dato que el motor no entregó.
 *
 * Este archivo NO calcula química nueva. Reusa tal cual:
 *   - calcularCancelacionCarga / calcularCancelacionCargaElementos → LEY
 *     OFICIAL (elementos/afinidad.ts, sección "Ley de Cancelación de
 *     Carga"): si compatible === true, el motor dice que SÍ se pueden
 *     enlazar.
 *   - calcularAfinidad → heurística de diseño (misma fuente, sección "B"):
 *     complementa / compite / saturado / estable. Se usa para distinguir,
 *     dentro de lo que la Ley NO marca como compatible, qué sigue teniendo
 *     una afinidad de diseño razonable ("posible") de lo que claramente no
 *     ("incompatible") — nunca al revés: la Ley manda primero.
 *   - elementoBloqueaEnlace / compuestoEsInerte (Estado Noble) → si el
 *     centro o el vecino está bloqueado, es incompatible sin excepción,
 *     import { AFINIDAD_LABEL, ENLACE_LABEL } sirven de referencia (no se
 *     inventa un label propio).
 *
 * Mapeo a los 3 estados que pide el docx (Parte 5, puntos 4-6):
 *   - "compatible": calcularCancelacionCarga(...).compatible === true.
 *     La Ley oficial confirma que el enlace puede realizarse.
 *   - "incompatible": el centro o el vecino está bloqueado por Estado
 *     Noble, o calcularAfinidad(...).tipo === "compite"/"saturado" y no hay
 *     cancelación de carga real.
 *   - "posible": no hay cancelación de carga real, pero
 *     calcularAfinidad(...).tipo === "complementa" o "estable" — hay una
 *     lectura de diseño razonable aunque la Ley no lo confirme todavía
 *     (docx punto 5: "si el modelo diferencia entre compatible, posible,
 *     condicionado, etc., se representa con menor intensidad").
 *
 * "compatible" y "posible" nunca se confunden visualmente en el llamador
 * (RutaCompatibilidadCanvas) — ver docx punto 5, "la interfaz nunca debe
 * confundir ambos estados".
 *
 * Soporta tanto Elemento como Compuesto como entidad centro (el usuario
 * elige — docx no distingue "VIS-04 de Elementos" de "VIS-04 de
 * Compuestos", es el mismo mapa de posibilidades para cualquier de las dos
 * escalas del sistema). Internamente ambos se tratan como "nodo
 * compatibilidad" con un id namespaced (`elemento:<id>` / `compuesto:<id>`)
 * para no colisionar ids entre catálogos.
 */

import { useMemo, useState } from "react";

import { useElementos } from "@/domains/garlia/elementos/useElementos";
import { useCompuestosConElementos } from "@/domains/garlia/elementos/useCompuestosConElementos";
import {
  calcularAfinidad,
  calcularCancelacionCarga,
  calcularCancelacionCargaElementos,
  compuestoEsInerte,
  elementoBloqueaEnlace,
} from "@/domains/garlia/elementos/afinidad";
import type { Compuesto, Elemento, ResultadoAfinidad, ResultadoCancelacionCarga } from "@/domains/garlia/elementos/types";

/** Tipo de entidad que puede ser centro o vecino del mapa. Un Elemento
 *  suelto se trata internamente como un Compuesto de 1 componente para
 *  poder reusar calcularAfinidad/calcularCancelacionCarga tal cual (mismo
 *  patrón que ya usan calcularCancelacionCargaElementos/
 *  calcularEnlaceResultanteElementos en afinidad.ts). */
export type TipoEntidadCompat = "elemento" | "compuesto";

export interface NodoCompatibilidad {
  /** Id namespaced: `elemento:<id>` o `compuesto:<id>` — único en todo el mapa. */
  nodeId: string;
  tipo: TipoEntidadCompat;
  entidad: Elemento | Compuesto;
  label: string;
  sublabel?: string;
}

export type EstadoCompatibilidad = "compatible" | "posible" | "incompatible";

export interface VecinoCompatibilidad {
  nodo: NodoCompatibilidad;
  estado: EstadoCompatibilidad;
  /** Resultado crudo de la Ley de Cancelación de Carga contra el centro —
   *  siempre presente, es el criterio que manda. */
  cancelacion: ResultadoCancelacionCarga;
  /** Resultado crudo de la heurística de afinidad contra el centro —
   *  presente salvo que el centro o el vecino estén bloqueados (Noble). */
  afinidad: ResultadoAfinidad | null;
  /** Motivo en lenguaje natural para el panel "¿por qué?" (docx punto 7).
   *  Prioriza el motivo de la Ley cuando hay cancelación real; si no, usa
   *  el motivo de la heurística. Nunca se inventa un texto propio. */
  motivo: string;
}

/** Convierte cualquier entidad (Elemento o Compuesto) a la forma Compuesto
 *  que calcularAfinidad/calcularCancelacionCarga esperan — mismo criterio
 *  que ya usa afinidad.ts internamente para sus variantes "...Elementos". */
function comoCompuesto(nodo: NodoCompatibilidad): Compuesto {
  if (nodo.tipo === "compuesto") return nodo.entidad as Compuesto;
  const e = nodo.entidad as Elemento;
  return { id: e.id, nombre: e.nombre, componentes: [{ elemento_id: e.id, cantidad: 1 }] };
}

/** true si la entidad del nodo está bloqueada por Estado Noble (sección
 *  3.2) — un Elemento Noble suelto, o un Compuesto íntegramente inerte. */
function nodoBloqueado(nodo: NodoCompatibilidad, elementos: Elemento[]): boolean {
  if (nodo.tipo === "elemento") return elementoBloqueaEnlace(nodo.entidad as Elemento);
  return compuestoEsInerte(nodo.entidad as Compuesto, elementos);
}

/** Calcula el VecinoCompatibilidad completo de `vecino` respecto de
 *  `centro` — el único punto donde se decide el mapeo a los 3 estados
 *  (ver cabecera del archivo). */
function evaluarVecino(
  centro: NodoCompatibilidad,
  vecino: NodoCompatibilidad,
  elementos: Elemento[],
): VecinoCompatibilidad {
  // Elemento-Elemento tiene su propio atajo en afinidad.ts
  // (calcularCancelacionCargaElementos) — se usa tal cual cuando ambos
  // lados son Elemento suelto, en vez de pasar por comoCompuesto() dos
  // veces para el mismo resultado.
  const cancelacion =
    centro.tipo === "elemento" && vecino.tipo === "elemento"
      ? calcularCancelacionCargaElementos(centro.entidad as Elemento, vecino.entidad as Elemento)
      : calcularCancelacionCarga(comoCompuesto(centro), comoCompuesto(vecino), elementos);

  const centroBloqueado = nodoBloqueado(centro, elementos);
  const vecinoBloqueado = nodoBloqueado(vecino, elementos);

  if (centroBloqueado || vecinoBloqueado) {
    return {
      nodo: vecino,
      estado: "incompatible",
      cancelacion,
      afinidad: null,
      motivo: `Al menos uno de los dos es Noble, con su Capa Externa 100% saturada: no puede iniciar ni aceptar enlaces nuevos, sin importar el balance interno.`,
    };
  }

  if (cancelacion.compatible) {
    return {
      nodo: vecino,
      estado: "compatible",
      cancelacion,
      afinidad: null,
      motivo: `La Voluntad libre de uno cancela los huecos de Percepción del otro: la Ley de Cancelación de Carga confirma que el enlace puede realizarse.`,
    };
  }

  const afinidad = calcularAfinidad(comoCompuesto(centro), comoCompuesto(vecino), elementos);
  if (afinidad.tipo === "complementa" || afinidad.tipo === "estable") {
    return { nodo: vecino, estado: "posible", cancelacion, afinidad, motivo: afinidad.motivo };
  }
  return { nodo: vecino, estado: "incompatible", cancelacion, afinidad, motivo: afinidad.motivo };
}

/** Un paso del historial de navegación (docx punto 15: "Historial — A → B
 *  → C → D"). Reutiliza el mismo concepto de breadcrumb que el resto del
 *  Visualizador, acotado a esta ruta. */
export interface PasoHistorialCompat {
  nodeId: string;
  label: string;
}

export interface CompatibilidadRouteState {
  loading: boolean;
  empty: boolean;
  error: null;

  /** Tipo de catálogo que el usuario está explorando ahora mismo — el
   *  centro y todos los vecinos pertenecen al mismo tipo (docx no pide
   *  mezclar Elementos y Compuestos en el mismo mapa: "vista de vecinos"
   *  es por catálogo). */
  tipoActivo: TipoEntidadCompat;
  setTipoActivo: (t: TipoEntidadCompat) => void;

  elementos: Elemento[];
  compuestos: Compuesto[];

  /** Catálogo completo del tipo activo, ya envuelto como NodoCompatibilidad
   *  — para selectores/vista global. */
  catalogoActivo: NodoCompatibilidad[];

  centro: NodoCompatibilidad | null;
  setCentroId: (nodeId: string | null) => void;

  /** Vecinos del centro actual, cada uno con su estado ya calculado contra
   *  el centro — docx punto 13 "Vista de vecinos (por defecto)": no se
   *  calcula contra TODO el catálogo salvo que vistaGlobal esté activa. */
  vecinos: VecinoCompatibilidad[];

  /** Vista global (docx punto 12): compatibilidad de TODOS contra TODOS
   *  dentro del catálogo activo — cara cara, filtrable por el llamador.
   *  Se calcula solo bajo demanda (vistaGlobal=true) porque es O(n²). */
  vistaGlobal: boolean;
  setVistaGlobal: (v: boolean) => void;
  paresGlobales: { a: NodoCompatibilidad; b: NodoCompatibilidad; estado: EstadoCompatibilidad }[];

  /** Historial de navegación por expansión progresiva (docx punto 14/15).
   *  navegarA empuja el nuevo centro al historial; retrocederA corta el
   *  historial hasta ese punto (mismo criterio que un breadcrumb). */
  historial: PasoHistorialCompat[];
  navegarA: (nodeId: string) => void;
  retrocederA: (nodeId: string) => void;

  /** Comparación A/B (docx punto 11): un segundo nodo fijado, evaluado
   *  contra el mismo centro que "vecinos" ya usa — no se recalcula
   *  distinto, solo se resalta cuál vecino es el B activo. */
  comparandoConId: string | null;
  setComparandoConId: (nodeId: string | null) => void;
  comparacion: VecinoCompatibilidad | null;

  /** Función "solo ruta" (docx punto 22): A → D vía el centro actual, si D
   *  es un vecino directo. No busca caminos multi-salto (el motor no
   *  expone una tabla de adyacencia completa para eso; se limita a lo que
   *  vecinos ya calculó, un salto real desde el centro). */
  soloRutaHaciaId: string | null;
  setSoloRutaHaciaId: (nodeId: string | null) => void;
}

export function useCompatibilidadRoute(): CompatibilidadRouteState {
  const { items: elementos, loading: loadingElementos } = useElementos();
  const { items: compuestos, loading: loadingCompuestos } = useCompuestosConElementos();

  const [tipoActivo, setTipoActivoState] = useState<TipoEntidadCompat>("elemento");
  const [centroId, setCentroIdState] = useState<string | null>(null);
  const [historial, setHistorial] = useState<PasoHistorialCompat[]>([]);
  const [vistaGlobal, setVistaGlobal] = useState(false);
  const [comparandoConId, setComparandoConId] = useState<string | null>(null);
  const [soloRutaHaciaId, setSoloRutaHaciaId] = useState<string | null>(null);

  const catalogoElementos = useMemo<NodoCompatibilidad[]>(
    () =>
      elementos.map((e) => ({
        nodeId: `elemento:${e.id}`,
        tipo: "elemento" as const,
        entidad: e,
        label: e.nombre,
        sublabel: e.simbolo,
      })),
    [elementos],
  );

  const catalogoCompuestos = useMemo<NodoCompatibilidad[]>(
    () =>
      compuestos.map((c) => ({
        nodeId: `compuesto:${c.id}`,
        tipo: "compuesto" as const,
        entidad: c,
        label: c.nombre,
        sublabel: c.simbolo ?? undefined,
      })),
    [compuestos],
  );

  const catalogoActivo = tipoActivo === "elemento" ? catalogoElementos : catalogoCompuestos;

  const nodosPorId = useMemo(() => {
    const mapa = new Map<string, NodoCompatibilidad>();
    for (const n of [...catalogoElementos, ...catalogoCompuestos]) mapa.set(n.nodeId, n);
    return mapa;
  }, [catalogoElementos, catalogoCompuestos]);

  const centro = useMemo(() => {
    if (centroId) return nodosPorId.get(centroId) ?? null;
    return catalogoActivo[0] ?? null;
  }, [centroId, catalogoActivo, nodosPorId]);

  // Cambiar de tipo activo (Elemento ↔ Compuesto) resetea el centro y el
  // historial — mezclar historial de dos catálogos distintos no tiene
  // sentido narrativo (docx: "vista de vecinos" es por catálogo).
  function setTipoActivo(t: TipoEntidadCompat) {
    setTipoActivoState(t);
    setCentroIdState(null);
    setHistorial([]);
    setComparandoConId(null);
    setSoloRutaHaciaId(null);
  }

  function setCentroId(nodeId: string | null) {
    setCentroIdState(nodeId);
    setComparandoConId(null);
    setSoloRutaHaciaId(null);
  }

  // Expansión progresiva (docx punto 14): click en un vecino lo convierte
  // en el nuevo centro, empujando el centro anterior al historial.
  function navegarA(nodeId: string) {
    if (!centro || centro.nodeId === nodeId) return;
    setHistorial((h) => [...h, { nodeId: centro.nodeId, label: centro.label }]);
    setCentroIdState(nodeId);
    setComparandoConId(null);
    setSoloRutaHaciaId(null);
  }

  // Retroceder por el historial (docx punto 15: "se puede volver a B") —
  // corta el historial hasta el paso clickeado y lo hace centro de nuevo.
  function retrocederA(nodeId: string) {
    const idx = historial.findIndex((p) => p.nodeId === nodeId);
    if (idx === -1) return;
    setCentroIdState(nodeId);
    setHistorial((h) => h.slice(0, idx));
    setComparandoConId(null);
  }

  const vecinos = useMemo<VecinoCompatibilidad[]>(() => {
    if (!centro) return [];
    return catalogoActivo
      .filter((n) => n.nodeId !== centro.nodeId)
      .map((n) => evaluarVecino(centro, n, elementos));
  }, [centro, catalogoActivo, elementos]);

  const comparacion = useMemo(() => {
    if (!comparandoConId) return null;
    return vecinos.find((v) => v.nodo.nodeId === comparandoConId) ?? null;
  }, [comparandoConId, vecinos]);

  // Vista global (docx punto 12) — O(n²), solo se calcula si vistaGlobal
  // está prendida. Cada par se evalúa una sola vez (a,b) sin duplicar (b,a).
  const paresGlobales = useMemo(() => {
    if (!vistaGlobal) return [];
    const out: { a: NodoCompatibilidad; b: NodoCompatibilidad; estado: EstadoCompatibilidad }[] = [];
    for (let i = 0; i < catalogoActivo.length; i++) {
      for (let j = i + 1; j < catalogoActivo.length; j++) {
        const a = catalogoActivo[i];
        const b = catalogoActivo[j];
        out.push({ a, b, estado: evaluarVecino(a, b, elementos).estado });
      }
    }
    return out;
  }, [vistaGlobal, catalogoActivo, elementos]);

  const loading = loadingElementos || loadingCompuestos;

  return {
    loading,
    empty: !loading && catalogoActivo.length === 0,
    error: null,
    tipoActivo,
    setTipoActivo,
    elementos,
    compuestos,
    catalogoActivo,
    centro,
    setCentroId,
    vecinos,
    vistaGlobal,
    setVistaGlobal,
    paresGlobales,
    historial,
    navegarA,
    retrocederA,
    comparandoConId,
    setComparandoConId,
    comparacion,
    soloRutaHaciaId,
    setSoloRutaHaciaId,
  };
}
