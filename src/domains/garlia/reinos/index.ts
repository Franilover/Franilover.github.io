// API pública de domains/garlia/reinos.
// Fuera de esta carpeta, importar SIEMPRE desde acá.
//
// Nota: existe otro `reinosQueries` en src/lib/api/queries/garlia/reino.ts,
// preexistente y sin relación con esta migración (lo usa únicamente
// useSupabaseData.ts, un layer de API distinto). No se tocó ni se unificó
// acá — mismo criterio que con INPUT_CLS/SaveStatus: fuera del alcance de
// esta tarea.

export { reinosQueries } from "./queries";
export { useReinosMin } from "./useReinosMin";
export { ReinoEditor } from "./components/ReinoEditor";
export { EditorReino } from "./components/EditorReino";
// ReinoTileCanvas quedó desactivado (ver nota al tope del archivo) — sin
// consumidores en el flujo actual. Se sigue re-exportando para no romper
// el export en caso de import externo directo, pero no usarlo sin antes
// leer esa nota.
export { ReinoTileCanvas, useReinoTiles, type ReinoTile } from "./components/ReinoTileCanvas";
export type { Reino, ReinoMin } from "./types";
