"use client";

/**
 * useSandbox.ts — dominio Sandbox
 *
 * Orquestación del Sandbox:
 * Frontend → useSandbox() → sandboxService → RPC Supabase → motor → estado
 *
 * IMPORTANTE:
 * Este hook no contiene reglas de simulación.
 * Solo prepara datos, llama RPCs y vuelve a cargar el estado.
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
    if (!simulacionId) {
      setState((s) => ({
        ...s,
        simulacion: null,
        entidades: [],
        eventos: [],
        loading: false,
        error: null,
      }));
      return;
    }

    setState((s) => ({
      ...s,
      loading: true,
      error: null,
    }));

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

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    sandboxService
      .listarCatalogoEventos()
      .then((catalogoEventos) =>
        setState((s) => ({
          ...s,
          catalogoEventos,
        })),
      )
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

      setState((s) => ({
        ...s,
        ejecutandoAccion: true,
        error: null,
      }));

      try {
        await sandboxService.controlSandbox(simulacionId, accion, delta);
        await refetch();
      } catch (err) {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : String(err),
        }));
      } finally {
        setState((s) => ({
          ...s,
          ejecutandoAccion: false,
        }));
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

      setState((s) => ({
        ...s,
        error: null,
      }));

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
      if (!simulacionId) return null;

      setState((s) => ({
        ...s,
        error: null,
      }));

      try {
        const id = await sandboxService.agregarEntidadSandbox({
          simulacionId,
          ...params,
        });

        await refetch();

        return id;
      } catch (err) {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : String(err),
        }));

        return null;
      }
    },
    [simulacionId, refetch],
  );

  /**
   * Agrega un Elemento o Compuesto del catálogo al Sandbox.
   *
   * No crea una RPC nueva:
   * utiliza agregar_entidad_sandbox existente.
   *
   * El catálogo conserva la identidad mediante entidadOrigenId.
   * estadoInicial contiene únicamente el estado experimental inicial.
   */
  const agregarEntidadDesdeCatalogo = useCallback(
    async (params: {
      entidadTipo: "elemento" | "compuesto";
      entidadOrigenId: string;
      estadoInicial: Record<string, unknown>;
    }) => {
      return agregarEntidad({
        entidadTipo: params.entidadTipo,
        entidadOrigenId: params.entidadOrigenId,
        estadoInicial: params.estadoInicial,
      });
    },
    [agregarEntidad],
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
    agregarEntidadDesdeCatalogo,
  };
}

export function useListaSandboxes() {
  const [simulaciones, setSimulaciones] = useState<SandboxSimulacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await sandboxService.listarSimulaciones();
      setSimulaciones(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    simulaciones,
    loading,
    error,
    refetch,
  };
}

export function useCrearSandbox() {
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = useCallback(
    async (
      nombre: string,
      contexto?: Record<string, unknown>,
    ) => {
      setCreando(true);
      setError(null);

      try {
        const id = await sandboxService.crearSandbox(
          nombre,
          contexto,
        );

        return id;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : String(err),
        );

        return null;
      } finally {
        setCreando(false);
      }
    },
    [],
  );

  return {
    crear,
    creando,
    error,
  };
}
