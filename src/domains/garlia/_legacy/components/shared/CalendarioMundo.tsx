"use client";

/**
 * CalendarioMundo.tsx
 * ─────────────────────
 * ⚠️ SHIM TEMPORAL — no es la extracción real.
 *
 * `FechaMundoBadge`, `SelectorFechaMundo` y `useCalendario` viven hoy en
 * `features/editorGarlia/views/EditorLineaTiempo.tsx`, que es una `view`.
 * Un componente (`PersonajeLineaDeTiempo`) no puede importar de `views/`
 * (regla de zona: "Una view no importa la view de otro módulo" aplica
 * en general a que nada por debajo de `views/` debe depender de ella).
 *
 * Este archivo solo re-exporta para que el build no rompa mientras se
 * comparte el contenido real de EditorLineaTiempo.tsx. Cuando esté
 * disponible, este archivo debe reemplazarse por la extracción real de
 * esas tres piezas a `components/`, y `EditorLineaTiempo.tsx` debe pasar
 * a importarlas desde acá (no al revés).
 *
 * Ruta: src/features/editorGarlia/components/CalendarioMundo.tsx
 */
export { FechaMundoBadge } from "@/domains/garlia/_legacy/components/calendario/FechaMundoBadge";
export { SelectorFechaMundo } from "@/domains/garlia/_legacy/components/calendario/SelectorFechaMundo";
export { useCalendario } from "@/domains/garlia/_legacy/hooks/calendario/useCalendario";
