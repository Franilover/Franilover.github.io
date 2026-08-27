/**
 * sandboxService.ts — dominio Sandbox
 * ───────────────────────────────────────────────────────────────────────────
 * Capa fina sobre `supabase.rpc(...)`. NO contiene reglas de simulación:
 * eso vive enteramente en el backend (Supabase). Este archivo solo llama
 * a las RPCs ya existentes y hace fetch de las tablas relacionadas.
 *
 * Patrón de import calcado de AuthProvider.tsx / syncEngine.ts, que ya
 * usan `supabase.rpc()` directo en este mismo proyecto.
 *
 * RPCs cubiertas en este primer slice (las "oficiales" según el mapa de
 * auditoría, no las legado/alternativas):
 *   - crear_sandbox
 *   - agregar_entidad_sandbox
 *   - encolar_evento_sandbox
 *   - control_sandbox   (Play / Pause / Step / Reset — orquestador único)
 *
 * Deliberadamente NO se llaman directo desde el frontend (son piezas
 * internas que control_sandbox / avanzar_tiempo_sandbox ya orquestan):
 *   - avanzar_tiempo_sandbox, procesar_eventos_sandbox,
 *     evaluar_interaccion_sandbox, aplicar_efectos_interaccion_sandbox
 *
 * Legado, no usar (confirmado en auditoría — operan sobre JSON suelto o
 * tablas paralelas, no sobre sandbox_entidades real):
 *   - simular_interaccion_sandbox, aplicar_efectos_sandbox,
 *     sandbox_simular_interaccion, aplicar_estado_sandbox
 */

import { supabase } from "@/infra/supabase/supabase";

import type {
  AccionControlSandbox,
  InteraccionEventoCatalogo,
  RespuestaMotorSandbox,
  SandboxEntidad,
  SandboxEvento,
  SandboxSimulacion,
  SandboxSnapshot,
} from "./types";

function assertNoError<T>(data: T, error: { message: string } | null, contexto: string): T {
  if (error) {
    throw new Error(`[sandboxService] ${contexto}: ${error.message}`);
  }
  return data;
}

// ─── Escritura vía RPC ──────────────────────────────────────────────────────

/** Crea una nueva simulación de Sandbox. Siempre pasa ambos parámetros
 *  explícitos para evitar cualquier ambigüedad de overload resolution
 *  en PostgREST (crear_sandbox tiene 2 firmas: con y sin p_contexto). */
export async function crearSandbox(
  nombre: string,
  contexto: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await supabase.rpc("crear_sandbox", {
    p_nombre: nombre,
    p_contexto: contexto,
  });
  return assertNoError(data as string, error, "crearSandbox");
}

/** Agrega una entidad a una simulación existente. */
export async function agregarEntidadSandbox(params: {
  simulacionId: string;
  entidadTipo: string;
  entidadOrigenId?: string | null;
  estadoInicial?: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await supabase.rpc("agregar_entidad_sandbox", {
    p_simulacion_id: params.simulacionId,
    p_entidad_tipo: params.entidadTipo,
    p_entidad_origen_id: params.entidadOrigenId ?? null,
    p_estado_inicial: params.estadoInicial ?? {},
  });
  return assertNoError(data as string, error, "agregarEntidadSandbox");
}

/** Encola un evento ("disparar evento") sobre una entidad del sandbox. */
export async function encolarEventoSandbox(params: {
  simulacionId: string;
  eventoId: string;
  entidadId: string;
  tiempoProgramado?: number | null;
  datos?: Record<string, unknown>;
  eventoOrigenId?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("encolar_evento_sandbox", {
    p_simulacion_id: params.simulacionId,
    p_evento_id: params.eventoId,
    p_entidad_id: params.entidadId,
    p_tiempo_programado: params.tiempoProgramado ?? null,
    p_datos: params.datos ?? {},
    p_evento_origen_id: params.eventoOrigenId ?? null,
  });
  return assertNoError(data as string, error, "encolarEventoSandbox");
}

/** Orquestador único de Play / Pause / Step / Reset.
 *  p_delta tiene DEFAULT 1 en el backend; solo se envía cuando aplica (step). */
export async function controlSandbox(
  simulacionId: string,
  accion: AccionControlSandbox,
  delta?: number,
): Promise<RespuestaMotorSandbox> {
  const params: Record<string, unknown> = {
    p_simulacion_id: simulacionId,
    p_accion: accion,
  };
  if (delta !== undefined) params.p_delta = delta;

  const { data, error } = await supabase.rpc("control_sandbox", params);
  return assertNoError(data as RespuestaMotorSandbox, error, `controlSandbox(${accion})`);
}

// ─── Lectura directa de tablas (solo-consulta, sin useSupabaseData/Dexie) ──

export async function obtenerSimulacion(simulacionId: string): Promise<SandboxSimulacion | null> {
  const { data, error } = await supabase
    .from("sandbox_simulaciones")
    .select("*")
    .eq("id", simulacionId)
    .maybeSingle();
  return assertNoError(data as SandboxSimulacion | null, error, "obtenerSimulacion");
}

export async function listarSimulaciones(): Promise<SandboxSimulacion[]> {
  const { data, error } = await supabase
    .from("sandbox_simulaciones")
    .select("*")
    .neq("estado", "descartada")
    .order("id", { ascending: false });
  return assertNoError(data as SandboxSimulacion[], error, "listarSimulaciones") ?? [];
}

export async function listarEntidades(simulacionId: string): Promise<SandboxEntidad[]> {
  const { data, error } = await supabase
    .from("sandbox_entidades")
    .select("*")
    .eq("simulacion_id", simulacionId);
  return assertNoError(data as SandboxEntidad[], error, "listarEntidades") ?? [];
}

export async function listarEventos(simulacionId: string): Promise<SandboxEvento[]> {
  const { data, error } = await supabase
    .from("sandbox_eventos")
    .select("*")
    .eq("simulacion_id", simulacionId)
    .order("tiempo_programado", { ascending: true });
  return assertNoError(data as SandboxEvento[], error, "listarEventos") ?? [];
}

export async function listarSnapshots(simulacionId: string): Promise<SandboxSnapshot[]> {
  const { data, error } = await supabase
    .from("sandbox_snapshots")
    .select("*")
    .eq("simulacion_id", simulacionId);
  return assertNoError(data as SandboxSnapshot[], error, "listarSnapshots") ?? [];
}

/** Catálogo de eventos disponibles, para poblar el selector de "disparar evento".
 *  Solo lectura — la tabla la administra el proceso de worldbuilding, no este frontend. */
export async function listarCatalogoEventos(): Promise<InteraccionEventoCatalogo[]> {
  const { data, error } = await supabase
    .from("interaccion_eventos")
    .select("*");
  return assertNoError(data as InteraccionEventoCatalogo[], error, "listarCatalogoEventos") ?? [];
}
