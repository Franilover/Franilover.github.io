"use client";

/**
 * useInteraccionRoute.ts
 * ───────────────────────────────────────────────────────────────────────────
 * VIS-05 — Interacción (visualizador_estado, orden 5): "¿Qué ocurre cuando
 * dos entidades interactúan?" — cadena visual
 * evento → interacción → efecto → nuevo estado/nuevo evento, conectada al
 * motor real.
 *
 * Igual que VIS-04 (useCompatibilidadRoute), este archivo NO calcula nada
 * nuevo: envuelve tal cual el dominio Sandbox ya existente
 * (sandbox/useSandbox.ts, sandbox/sandboxService.ts, sandbox/types.ts), que
 * ya habla directo con las RPCs canónicas (crear_sandbox,
 * agregar_entidad_sandbox, encolar_evento_sandbox, control_sandbox) y con
 * las tablas sandbox_simulaciones / sandbox_entidades / sandbox_eventos.
 *
 * Lo que agrega esta ruta, específico de VIS-05:
 *   - Selección de simulación activa (useListaSandboxes ya lista las no
 *     descartadas) — la ruta no crea sandboxes, solo los usa; crear uno
 *     nuevo sigue siendo responsabilidad de SandboxPage.
 *   - `cadena`: por cada sandbox_evento, arma los 4 nodos que pide el docx
 *     (Evento → Interacción → Efecto → Nuevo estado) a partir de datos
 *     reales: el evento_id resuelto contra el catálogo interaccion_eventos,
 *     el sujeto/objetivo resueltos contra sandbox_entidades, y el estado
 *     resultante leído de estado_actual de la entidad sujeto. Ningún campo
 *     se inventa: si el evento está "pendiente", el nodo "Efecto" y
 *     "Nuevo estado" se marcan sin dato (title: null) en vez de simular un
 *     resultado que el motor todavía no calculó.
 *   - `cadenaCausal`: sigue evento_origen_id hacia atrás (docx "trace
 *     causal") — un evento puede haber sido disparado por otro evento
 *     procesado, formando una cadena real, no solo el par sujeto/objetivo.
 *   - Selección de un evento de la timeline para fijar cuál cadena se
 *     muestra en el Inspector/TraceView (mismo patrón que
 *     nodoSelId/vecinoSel en CompatibilidadSection).
 *
 * No se persiste ni deriva ningún dato de interacción en el frontend: play/
 * pause/step/reset y "disparar evento" siguen yendo tal cual a
 * control_sandbox / encolar_evento_sandbox vía useSandbox().
 */

import { useEffect, useMemo, useState } from "react";

import { useListaSandboxes, useSandbox } from "@/domains/garlia/sandbox/useSandbox";
import type {
  InteraccionEventoCatalogo,
  SandboxEntidad,
  SandboxEvento,
} from "@/domains/garlia/sandbox/types";

/** Un nodo de la cadena causal (docx: Evento → Interacción → Efecto →
 *  Nuevo estado/Nuevo evento). `title: null` es explícito "sin dato
 *  todavía" — nunca se sustituye por un valor supuesto. */
export interface NodoCadenaInteraccion {
  id: string;
  levelLabel: string;
  title: string | null;
  subtitle?: string | null;
}

export interface EventoConEntidades {
  evento: SandboxEvento;
  catalogo: InteraccionEventoCatalogo | null;
  sujeto: SandboxEntidad | null;
  objetivo: SandboxEntidad | null;
  /** Evento que disparó este (si evento_origen_id apunta a uno ya conocido
   *  en esta simulación) — para pintar la cadena causal en la timeline. */
  origen: SandboxEvento | null;
}

function labelEntidad(e: SandboxEntidad | null): string | null {
  if (!e) return null;
  return e.entidad_tipo;
}

/** Resume estado_actual.estados en algo mostrable sin inventar semántica:
 *  cuenta cuántos "estados" están activos ahora mismo. Los valores
 *  concretos (intensidad, datos) quedan para el Inspector, no para el
 *  título del nodo. */
function resumenEstado(e: SandboxEntidad | null): string | null {
  if (!e) return null;
  const activos = Object.entries(e.estado_actual?.estados ?? {}).filter(([, v]) => v?.activo);
  if (activos.length === 0) return "Sin estados activos";
  return activos.map(([clave]) => clave).join(", ");
}

export interface InteraccionRouteState {
  loading: boolean;
  empty: boolean;
  error: string | null;

  // ─── Simulación activa ──────────────────────────────────────────────────
  simulaciones: ReturnType<typeof useListaSandboxes>["simulaciones"];
  simulacionId: string | null;
  setSimulacionId: (id: string | null) => void;

  entidades: SandboxEntidad[];
  eventos: SandboxEvento[];
  catalogoEventos: InteraccionEventoCatalogo[];
  tiempoSimulado: number | null;

  /** Todos los sandbox_eventos de la simulación activa, ya resueltos
   *  contra entidades/catálogo — para pintar la timeline (docx: "timeline,
   *  nodos causales, log"). Ordenados por tiempo_programado (mismo orden
   *  que sandboxService.listarEventos ya devuelve). */
  eventosResueltos: EventoConEntidades[];

  /** Evento fijado por click en la timeline. null = ninguno seleccionado
   *  todavía (se autoselecciona el más reciente si existe, igual que el
   *  resto de secciones autoseleccionan el primer ítem). */
  eventoSelId: string | null;
  setEventoSelId: (id: string | null) => void;
  eventoSel: EventoConEntidades | null;

  /** Cadena Evento → Interacción → Efecto → Nuevo estado del evento
   *  seleccionado — lista para pasar directo a <TraceView steps={...}/>. */
  cadena: NodoCadenaInteraccion[];

  /** Cadena causal completa (docx "trace causal"): sigue evento_origen_id
   *  hacia atrás desde el evento seleccionado, más recientes primero. Un
   *  único evento sin origen es una cadena de longitud 1 — no es un error. */
  cadenaCausal: SandboxEvento[];

  // ─── Control del motor (delegado tal cual a useSandbox) ────────────────
  ejecutandoAccion: boolean;
  play: () => void;
  pause: () => void;
  step: (delta?: number) => void;
  reset: () => void;
  dispararEvento: (params: {
    eventoId: string;
    entidadId: string;
    tiempoProgramado?: number | null;
    datos?: Record<string, unknown>;
  }) => void;
}

export function useInteraccionRoute(): InteraccionRouteState {
  const { simulaciones, loading: loadingSimulaciones } = useListaSandboxes();
  const [simulacionId, setSimulacionIdState] = useState<string | null>(null);

  useEffect(() => {
    if (!simulacionId && simulaciones.length > 0) {
      setSimulacionIdState(simulaciones[0].id);
    }
  }, [simulaciones, simulacionId]);

  function setSimulacionId(id: string | null) {
    setSimulacionIdState(id);
  }

  const sandbox = useSandbox(simulacionId);

  const [eventoSelId, setEventoSelIdState] = useState<string | null>(null);

  // Cambiar de simulación invalida cualquier selección previa — un evento
  // de otra simulación no tiene sentido acá (mismo criterio que
  // CompatibilidadSection resetea nodoSelId al cambiar tipoActivo).
  useEffect(() => {
    setEventoSelIdState(null);
  }, [simulacionId]);

  const entidadesPorId = useMemo(() => {
    const mapa = new Map<string, SandboxEntidad>();
    for (const e of sandbox.entidades) mapa.set(e.id, e);
    return mapa;
  }, [sandbox.entidades]);

  const catalogoPorId = useMemo(() => {
    const mapa = new Map<string, InteraccionEventoCatalogo>();
    for (const c of sandbox.catalogoEventos) mapa.set(c.id, c);
    return mapa;
  }, [sandbox.catalogoEventos]);

  const eventosPorId = useMemo(() => {
    const mapa = new Map<string, SandboxEvento>();
    for (const ev of sandbox.eventos) mapa.set(ev.id, ev);
    return mapa;
  }, [sandbox.eventos]);

  const eventosResueltos = useMemo<EventoConEntidades[]>(
    () =>
      sandbox.eventos.map((evento) => ({
        evento,
        catalogo: catalogoPorId.get(evento.evento_id) ?? null,
        sujeto: entidadesPorId.get(evento.sujeto_sandbox_id) ?? null,
        objetivo: evento.objetivo_sandbox_id ? entidadesPorId.get(evento.objetivo_sandbox_id) ?? null : null,
        origen: evento.evento_origen_id ? eventosPorId.get(evento.evento_origen_id) ?? null : null,
      })),
    [sandbox.eventos, catalogoPorId, entidadesPorId, eventosPorId],
  );

  // Autoselección: el evento más reciente por tiempo_programado (docx
  // punto por defecto — mismo patrón que orisSel/materialSel en
  // VisualizadorPage, "si no hay selección, tomar el primero disponible").
  useEffect(() => {
    if (eventosResueltos.length === 0) {
      if (eventoSelId !== null) setEventoSelIdState(null);
      return;
    }
    if (!eventoSelId || !eventosResueltos.some((e) => e.evento.id === eventoSelId)) {
      setEventoSelIdState(eventosResueltos[eventosResueltos.length - 1].evento.id);
    }
  }, [eventosResueltos, eventoSelId]);

  const eventoSel = useMemo(
    () => eventosResueltos.find((e) => e.evento.id === eventoSelId) ?? null,
    [eventosResueltos, eventoSelId],
  );

  const cadena = useMemo<NodoCadenaInteraccion[]>(() => {
    if (!eventoSel) {
      return [
        { id: "n-evento", levelLabel: "Evento", title: null },
        { id: "n-interaccion", levelLabel: "Interacción", title: null },
        { id: "n-efecto", levelLabel: "Efecto", title: null },
        { id: "n-estado", levelLabel: "Nuevo estado", title: null },
      ];
    }
    const { evento, catalogo, sujeto, objetivo } = eventoSel;
    const procesado = evento.estado === "procesado";
    return [
      {
        id: "n-evento",
        levelLabel: "Evento",
        title: catalogo?.nombre ?? evento.evento_id,
        subtitle: `t=${evento.tiempo_programado}`,
      },
      {
        id: "n-interaccion",
        levelLabel: "Interacción",
        title: labelEntidad(sujeto),
        subtitle: objetivo ? `→ ${labelEntidad(objetivo)}` : "sin objetivo (evento propio)",
      },
      {
        id: "n-efecto",
        levelLabel: "Efecto",
        title: procesado ? "Aplicado" : null,
        subtitle: procesado ? evento.ejecutado_at != null ? `en t=${evento.ejecutado_at}` : undefined : "pendiente de procesar",
      },
      {
        id: "n-estado",
        levelLabel: "Nuevo estado",
        title: procesado ? resumenEstado(sujeto) : null,
      },
    ];
  }, [eventoSel]);

  const cadenaCausal = useMemo<SandboxEvento[]>(() => {
    if (!eventoSel) return [];
    const cadena: SandboxEvento[] = [eventoSel.evento];
    const vistos = new Set([eventoSel.evento.id]);
    let actual: SandboxEvento | null = eventoSel.evento;
    while (actual?.evento_origen_id) {
      const anterior = eventosPorId.get(actual.evento_origen_id);
      if (!anterior || vistos.has(anterior.id)) break;
      cadena.push(anterior);
      vistos.add(anterior.id);
      actual = anterior;
    }
    return cadena;
  }, [eventoSel, eventosPorId]);

  const loading = loadingSimulaciones || sandbox.loading;

  return {
    loading,
    empty: !loading && simulaciones.length === 0,
    error: sandbox.error,

    simulaciones,
    simulacionId,
    setSimulacionId,

    entidades: sandbox.entidades,
    eventos: sandbox.eventos,
    catalogoEventos: sandbox.catalogoEventos,
    tiempoSimulado: sandbox.simulacion?.tiempo_simulado ?? null,

    eventosResueltos,
    eventoSelId,
    setEventoSelId: setEventoSelIdState,
    eventoSel,
    cadena,
    cadenaCausal,

    ejecutandoAccion: sandbox.ejecutandoAccion,
    play: sandbox.play,
    pause: sandbox.pause,
    step: sandbox.step,
    reset: sandbox.reset,
    dispararEvento: sandbox.dispararEvento,
  };
}
