// ─────────────────────────────────────────────────────────────────────────────
// rutas.ts
// ─────────────────────────────────────────────────────────────────────────────
// Antes vivían dentro de leerLibro.tsx (rutaLibro/rutaLeer), y detallesLibro.tsx
// reimplementaba a mano la misma lógica condicional de IS_TAURI_BUILD en su
// propia función local `rutaLector`. Unificado acá para que ambos (y
// cualquier otro consumidor, como el mapa o el command palette) construyan
// URLs de la misma forma — un solo lugar para ajustar el esquema de rutas.

import { IS_TAURI_BUILD } from "@/lib/config/buildTarget";

/** URL al índice de capítulos de un libro. Acepta slug canónico o UUID
 * legacy (los componentes consumidores resuelven el UUID a slug real en un
 * efecto posterior y canonicalizan la URL). */
export function rutaLibro(slug: string): string {
  return IS_TAURI_BUILD
    ? `/garlia/libros/detalle?slug=${slug}`
    : `/garlia/libros/${slug}`;
}

/** URL al lector de un capítulo puntual. `orden` acepta tanto el número de
 * orden canónico como un UUID de capítulo legacy (el lector resuelve ambos
 * casos vía esUUID()). */
export function rutaLeer(slug: string, orden: number | string): string {
  return IS_TAURI_BUILD
    ? `/garlia/libros/leer?slug=${slug}&orden=${orden}`
    : `/garlia/libros/${slug}/leer/${orden}`;
}
