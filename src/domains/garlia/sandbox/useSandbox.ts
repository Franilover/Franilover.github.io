"use client";

/**
 * useSandbox.ts — dominio Sandbox
 * ───────────────────────────────────────────────────────────────────────────
 * Hook de orquestación del vertical slice. Deliberadamente NO es un motor:
 * solo hace fetch de estado + llama RPCs de sandboxService.ts + refetch.
 * Toda regla de simulación (evaluar condición, aplicar efecto, expirar
 * estado) vive en Supabase. Este hook nunca debe empezar a calcular esas
 * cosas en el cliente.
 *
 * Arquitectura respetada:
 *   Frontend → useSandbox() → sandboxService → RPC Supabase → motor → estado
 */

import { useCallback, useEffect, useState } from "react";

import * as sandboxService from "./sandboxService";
import type {
  AccionControlSandbox,
  InteraccionEventoCatalogo,
  SandboxEntidad,
  SandboxEvento,
  SandboxSimulacion,
} from "./types";

interface UseSandboxState {
  simulacion: SandboxSimulacion | null;
  entidades: SandboxEntidad[];
  eventos: SandboxEvento[];
  catalogoEventos: InteraccionEventoCatalogo[];
  loading: boolean;
  error: string | null;
  /** true mientras una acción de control (play/pause/step/reset) está en curso */
  ejecutandoAccion: boolean;
}

export function useSandbox(simulacionId: string | null) {
  const [state, setState] = useState<UseSandboxState>({
    simulacion: null,
    entidades: [],
    eventos: [],
    catalogoEventos: [],
    loading: false,
    error: null,
    ejecutandoAccion: false,
  });

  const refetch = useCallback(async () => {
    if (!simulacionId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [simulacion, entidades, eventos] = await Promise.all([
        sandboxService.obtenerSimulacion(simulacionId),
        sandboxService.listarEntidades(simulacionId),
        sandboxService.listarEventos(simulacionId),
      ]);
      setState((s) => ({
        ...s,
        simulacion,
        entidades,
        eventos,
        loading: false,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [simulacionId]);

  // Carga inicial + al cambiar de simulación
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Catálogo de eventos: independiente de la simulación activa, se carga una vez
  useEffect(() => {
    sandboxService
      .listarCatalogoEventos()
      .then((catalogoEventos) => setState((s) => ({ ...s, catalogoEventos })))
      .catch((err) =>
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : String(err),
        })),
      );
  }, []);

  const ejecutarControl = useCallback(
    async (accion: AccionControlSandbox, delta?: number) => {
      if (!simulacionId) return;
      setState((s) => ({ ...s, ejecutandoAccion: true, error: null }));
      try {
        await sandboxService.controlSandbox(simulacionId, accion, delta);
        await refetch();
      } catch (err) {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : String(err),
        }));
      } finally {
        setState((s) => ({ ...s, ejecutandoAccion: false }));
      }
    },
    [simulacionId, refetch],
  );

  const dispararEvento = useCallback(
    async (params: {
      eventoId: string;
      entidadId: string;
      tiempoProgramado?: number | null;
      datos?: Record<string, unknown>;
    }) => {
      if (!simulacionId) return;
      setState((s) => ({ ...s, error: null }));
      try {
        await sandboxService.encolarEventoSandbox({
          simulacionId,
          eventoId: params.eventoId,
          entidadId: params.entidadId,
          tiempoProgramado: params.tiempoProgramado,
          datos: params.datos,
        });
        await refetch();
      } catch (err) {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    },
    [simulacionId, refetch],
  );

  const agregarEntidad = useCallback(
    async (params: {
      entidadTipo: string;
      entidadOrigenId?: string | null;
      estadoInicial?: Record<string, unknown>;
    }) => {
      if (!simulacionId) return;
      setState((s) => ({ ...s, error: null }));
      try {
        await sandboxService.agregarEntidadSandbox({
          simulacionId,
          ...params,
        });
        await refetch();
      } catch (err) {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    },
    [simulacionId, refetch],
  );

  return {
    ...state,
    refetch,
    play: () => ejecutarControl("play"),
    pause: () => ejecutarControl("pause"),
    step: (delta?: number) => ejecutarControl("step", delta),
    reset: () => ejecutarControl("reset"),
    dispararEvento,
    agregarEntidad,
  };
}

/** Hook auxiliar para crear una simulación nueva y devolver su id.
 *  Separado de useSandbox porque antes de tener un id no hay nada que
 *  orquestar todavía — evita mezclar "crear" con "operar sobre". */
export function useCrearSandbox() {
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = useCallback(async (nombre: string, contexto?: Record<string, unknown>) => {
    setCreando(true);
    setError(null);
    try {
      const id = await sandboxService.crearSandbox(nombre, contexto);
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setCreando(false);
    }
  }, []);

  return { crear, creando, error };
}
