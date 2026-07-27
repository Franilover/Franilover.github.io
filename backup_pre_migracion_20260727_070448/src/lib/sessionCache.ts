/**
 * TTL compartido para la cache de sesión (Dexie `session_cache`), usada por
 * varios hooks de Garlia que cachean fetches remotos por un tiempo corto.
 *
 * Vive en lib/ (no en una entidad) porque lo consumen hooks de más de una
 * entidad — es infraestructura agnóstica al dominio, no lógica de negocio.
 */
export const SESSION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
