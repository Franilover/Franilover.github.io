/**
 * types.ts — dominio Sandbox
 * ───────────────────────────────────────────────────────────────────────────
 * Tipos que reflejan EXACTAMENTE el shape real verificado en Supabase
 * (proyecto ftdxthnizdosaaavjhah), no un diseño ideal aparte.
 *
 * Fuente de verdad: tablas `sandbox_simulaciones`, `sandbox_entidades`,
 * `sandbox_eventos`, `sandbox_snapshots`, y el shape de `estado_actual`
 * confirmado con datos reales de prueba ("Prueba fuego 2").
 *
 * Estos tipos NO deben crecer con lógica de negocio: el motor de reglas
 * vive en Supabase. Este archivo solo describe la forma de los datos.
 */

// ─── sandbox_simulaciones ───────────────────────────────────────────────────

export type EstadoSimulacion = "activa" | "pausada" | "descartada";

export interface SandboxSimulacion {
  id: string; // uuid
  nombre: string;
  estado: EstadoSimulacion;
  contexto: Record<string, unknown>;
  tiempo_simulado: number;
  velocidad_tiempo: number;
  ultimo_tick_at: string | null; // timestamptz
}

// ─── estado_actual (jsonb) — shape confirmado con datos reales ─────────────

export interface EstadoTemporalEntidad {
  activo: boolean;
  iniciado_en: number | null; // tiempo_simulado en que empezó
  expira_en: number | null;   // tiempo_simulado en que expira, null = no expira
  intensidad: number | null;
  datos: Record<string, unknown>;
}

export interface EstadoActualEntidad {
  estados: Record<string, EstadoTemporalEntidad>;
  propiedades: Record<string, unknown>;
}

// ─── sandbox_entidades ──────────────────────────────────────────────────────

export interface SandboxEntidad {
  id: string; // uuid
  simulacion_id: string;
  entidad_tipo: string;
  entidad_origen_id: string | null;
  estado_inicial: EstadoActualEntidad;
  estado_actual: EstadoActualEntidad;
  tiempo_estado_actualizado: number | null;
}

// ─── sandbox_eventos ────────────────────────────────────────────────────────

export type EstadoEvento = "pendiente" | "procesado";

export interface SandboxEvento {
  id: string; // uuid
  simulacion_id: string;
  evento_id: string; // FK a catálogo `interaccion_eventos`
  sujeto_sandbox_id: string;
  objetivo_sandbox_id: string | null;
  contexto: Record<string, unknown>;
  estado: EstadoEvento;
  tiempo_programado: number;
  evento_origen_id: string | null; // evento que disparó este (cadena causal)
  ejecutado_at: string | null; // timestamptz
}

// ─── sandbox_snapshots ──────────────────────────────────────────────────────

export interface SandboxSnapshot {
  id: string; // uuid
  simulacion_id: string;
  etiqueta: string;
  tiempo_simulado: number;
  entidades: SandboxEntidad[];
  eventos: SandboxEvento[];
}

// ─── catálogo (solo lectura, para poblar UI de "disparar evento") ──────────

export interface InteraccionEventoCatalogo {
  id: string; // uuid
  clave?: string;
  nombre: string;
  descripcion?: string | null;
  categoria?: string | null;
  [key: string]: unknown;
}

// ─── acciones válidas para control_sandbox ─────────────────────────────────

export type AccionControlSandbox = "play" | "pause" | "step" | "reset";

/** Respuesta genérica jsonb de las RPCs de control/proceso.
 *  El shape interno lo define el motor en Supabase; el frontend NO debe
 *  asumir campos que no haya confirmado explícitamente contra el backend. */
export type RespuestaMotorSandbox = Record<string, unknown>;
