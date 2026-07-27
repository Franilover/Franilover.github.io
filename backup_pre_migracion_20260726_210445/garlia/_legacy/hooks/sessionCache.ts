/**
 * sessionCache.ts
 * ─────────────────
 * Constante compartida de TTL para session_cache (Dexie), usada por varios
 * hooks de editorGarlia que cachean fetches remotos por un tiempo corto.
 * Extraída de `hooks/hooks.ts` al partir ese archivo en módulos por dominio.
 *
 * Ruta: src/features/editorGarlia/hooks/sessionCache.ts
 */

export const SESSION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
