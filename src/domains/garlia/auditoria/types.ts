/**
 * types.ts — domains/garlia/auditoria
 * ───────────────────────────────────────────────────────────────────────────
 * Dominio nuevo, de SOLO LECTURA: panel de auditoría del "estado del mundo"
 * (estado_proyecto + vistas v_auditoria_* + tablas de alertas).
 *
 * No reemplaza ni toca ningún dominio existente (elementos, biologia,
 * fisica...). Es una capa de observación por encima de ellos — cuando el
 * usuario hace click en una fila de auditoría, se navega al editor real ya
 * existente (ElementoEditor, CompuestosPage, etc.) vía useMundoNavigation,
 * nunca se duplica su UI.
 *
 * Esquema confirmado contra Supabase en vivo (proyecto ftdxthnizdosaaavjhah)
 * antes de escribir estos tipos — ver auditoría de Paso 0. Puntos que NO son
 * obvios desde el nombre de la tabla/columna y por eso van comentados acá:
 *
 *   - compuesto_estequiometria_alertas: columnas reales son
 *     (id, compuesto_id, codigo, severidad, detalle) — NO tiene columna
 *     "resuelto"/booleana. Las alertas ya resueltas simplemente se borran
 *     de esta tabla (ver estado_proyecto v97), así que TODA fila presente
 *     acá está activa por definición. No modelar un campo resuelto que no
 *     existe.
 *
 *   - compuesto_consistencia_issues: es genérica (entity_type/entity_id),
 *     no exclusiva de compuestos pese al prefijo del nombre de tabla. Hoy
 *     en la práctica solo hay filas con entity_type derivado de compuestos
 *     (13 filas, todas ya resueltas — resolved_at poblado, ver estado_proyecto
 *     v100), pero el tipo no debe asumir eso: puede volver a haber issues
 *     abiertos o de otro entity_type en cualquier momento.
 *
 *   - v_auditoria_compuestos_derivacion: estado_derivacion viene SIEMPRE en
 *     "discrepancia" para las 90 filas actuales (verificado). Esto NO
 *     significa que los 90 compuestos estén mal en todas sus propiedades:
 *     masa/carga derivadas SÍ coinciden con las almacenadas en el 100% de
 *     los casos (0/90 diffs), pero estabilidad, rigidez y flexibilidad
 *     también discrepan hoy (89/90, 87/90 y 90/90 respectivamente —
 *     re-verificado tras el cambio de fórmula de rigidez/flexibilidad en
 *     estado_proyecto v141-v142, que ahora incorpora enlaces; la vista
 *     _derivada aparenta seguir comparando contra la fórmula vieja sin
 *     enlaces). Ya NO es correcto decir que la discrepancia está acotada a
 *     estabilidad/energía de enlace. Por eso el semáforo de UI se calcula
 *     en frontend comparando cada par valor/valor_derivado por separado —
 *     NUNCA leyendo estado_derivacion como si fuera un veredicto binario
 *     ok/mal, porque hoy marcaría el 100% de las filas como rojas de forma
 *     engañosa.
 *
 *   - v_auditoria_elementos_derivacion: fuente_propiedades y
 *     metodo_propiedades YA NO están NULL (re-verificado) — las 67/67 filas
 *     tienen ahora un valor constante único en cada columna
 *     ("Teoria_Elementos_y_Compuestos_v1.0" / "derivacion_estructural_por_
 *     nivel_armonico"). Es metadata de procedencia igual para toda la
 *     tabla, no un veredicto por fila, así que la conclusión de UI sigue
 *     siendo correcta: esta vista se muestra como tabla de valores planos,
 *     sin semáforo propio (inventar un veredicto que la vista no provee
 *     seguiría siendo fabricar información).
 */

// ─── estado_proyecto ────────────────────────────────────────────────────
// Registro maestro único (clave='maestro'), fuente de verdad de progreso.
export interface EstadoProyecto {
  id: string;
  clave: string;
  titulo: string;
  etapa_actual: string;
  objetivo_actual: string;
  /** Array de strings — cada entrada es un hito ya cerrado, con su propia
   *  narrativa de auditoría/decisión incluida en el texto. */
  completado: string[];
  en_progreso: string[];
  pendiente: string[];
  principios: string[];
  resumen: string;
  siguiente_paso: string;
  ultima_actualizacion: string;
  actualizado_por: string;
  version: number;
}

export const CONFIG_ESTADO_PROYECTO = {
  tabla: "estado_proyecto",
  select:
    "id, clave, titulo, etapa_actual, objetivo_actual, completado, en_progreso, pendiente, principios, resumen, siguiente_paso, ultima_actualizacion, actualizado_por, version",
};

// ─── v_auditoria_compuestos_derivacion ──────────────────────────────────
// Fila cruda de la vista: valores almacenados vs derivados, por compuesto.
// El semáforo (ok/discrepancia real) se calcula en el hook/componente
// comparando cada par *_almacenado / *_derivada — ver nota arriba.
export interface AuditoriaCompuestoRow {
  id: string;
  nombre: string;
  masa: number;
  carga: number;
  estabilidad: number;
  rigidez: number;
  flexibilidad: number;
  masa_derivada: number;
  carga_derivada: number;
  estabilidad_derivada: number;
  rigidez_derivada: number;
  flexibilidad_derivada: number;
  intensidad_enlace_promedio: number | null;
  energia_enlace_candidata: number | null;
  enlaces: number;
  /** Siempre "discrepancia" hoy (ver nota de cabecera) — no usar como
   *  semáforo directo, solo mostrar como dato crudo si se necesita. */
  estado_derivacion: string;
  auditoria_energia: string;
}

export const CONFIG_AUDITORIA_COMPUESTOS = {
  tabla: "v_auditoria_compuestos_derivacion",
  select:
    "id, nombre, masa, carga, estabilidad, rigidez, flexibilidad, masa_derivada, carga_derivada, estabilidad_derivada, rigidez_derivada, flexibilidad_derivada, intensidad_enlace_promedio, energia_enlace_candidata, enlaces, estado_derivacion, auditoria_energia",
};

/** Nombre de cada propiedad comparable en la fila de auditoría de compuesto,
 *  con su clave "almacenada" y su clave "derivada" — usado para iterar sin
 *  repetir 5 veces la misma comparación a mano en el componente. */
export const PROPIEDADES_COMPUESTO_COMPARABLES: {
  label: string;
  campo: keyof AuditoriaCompuestoRow;
  campoDerivado: keyof AuditoriaCompuestoRow;
}[] = [
  { label: "Masa", campo: "masa", campoDerivado: "masa_derivada" },
  { label: "Carga", campo: "carga", campoDerivado: "carga_derivada" },
  { label: "Estabilidad", campo: "estabilidad", campoDerivado: "estabilidad_derivada" },
  { label: "Rigidez", campo: "rigidez", campoDerivado: "rigidez_derivada" },
  { label: "Flexibilidad", campo: "flexibilidad", campoDerivado: "flexibilidad_derivada" },
];

// ─── v_auditoria_elementos_derivacion ───────────────────────────────────
// Tabla de valores planos — sin columna de veredicto usable (ver nota de
// cabecera). Se muestra como referencia, no como semáforo.
export interface AuditoriaElementoRow {
  id: string;
  nombre: string;
  numero_atomico: number;
  composicion: string | null;
  masa_base: number;
  estabilidad: number;
  rigidez: number;
  flexibilidad: number;
  capacidad_transformacion: number;
  dureza: number;
  conductividad: number;
  interaccion: number;
  transparencia: number;
  catalisis_total: number;
  transicion_total: number;
  ocupacion_externa: number;
  capacidad_externa: number;
  saturacion_externa: number;
  /** Metadata de procedencia, valor CONSTANTE e igual para las 67/67 filas
   *  actuales ("Teoria_Elementos_y_Compuestos_v1.0" / "derivacion_estructural_
   *  por_nivel_armonico") — ya no NULL, pero al ser el mismo valor para toda
   *  la tabla sigue sin ser una señal por fila. Ver nota de cabecera. */
  fuente_propiedades: string | null;
  metodo_propiedades: string | null;
}

export const CONFIG_AUDITORIA_ELEMENTOS = {
  tabla: "v_auditoria_elementos_derivacion",
  select:
    "id, nombre, numero_atomico, composicion, masa_base, estabilidad, rigidez, flexibilidad, capacidad_transformacion, dureza, conductividad, interaccion, transparencia, catalisis_total, transicion_total, ocupacion_externa, capacidad_externa, saturacion_externa, fuente_propiedades, metodo_propiedades",
};

// ─── compuesto_estequiometria_alertas ───────────────────────────────────
// Toda fila presente está activa por definición (ver nota de cabecera:
// las resueltas se eliminan de la tabla, no se marcan).
export interface AlertaEstequiometria {
  id: string;
  compuesto_id: string;
  codigo: string;
  severidad: string;
  detalle: Record<string, unknown> | null;
}

export const CONFIG_ALERTAS_ESTEQUIOMETRIA = {
  tabla: "compuesto_estequiometria_alertas",
  select: "id, compuesto_id, codigo, severidad, detalle",
};

// ─── compuesto_consistencia_issues ──────────────────────────────────────
// Genérica por entity_type/entity_id (ver nota de cabecera). resolved_at
// null = issue abierto; con fecha = cerrado (a diferencia de la tabla de
// alertas de arriba, ESTA sí soporta filas cerradas sin borrarlas).
export interface ConsistenciaIssue {
  id: string;
  entity_type: string;
  entity_id: string;
  issue_code: string;
  severity: string;
  details: Record<string, unknown> | null;
  detected_at: string;
  resolved_at: string | null;
}

export const CONFIG_CONSISTENCIA_ISSUES = {
  tabla: "compuesto_consistencia_issues",
  select: "id, entity_type, entity_id, issue_code, severity, details, detected_at, resolved_at",
};
