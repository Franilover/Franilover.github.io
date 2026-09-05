/**
 * syncEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Motor de caché offline-first para lecturas (pull Supabase → Dexie).
 *
 * Complementa useOfflineSync (que maneja escrituras pendientes, push).
 * Reutiliza isReallyOnline y dexiePut de ese módulo para no duplicar lógica.
 *
 * Patrón para cada tabla:
 *   1. Memoria (Map en módulo)  → 0ms, sobrevive SPA nav
 *   2. Dexie (session_cache)    → ~5ms, offline-ready
 *   3. Supabase en background   → refresca y llama onUpdate() si hay conexión
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";
import { isReallyOnline } from "@/lib/utils/offlineSync";

// ─── TTL por tabla (ms) ───────────────────────────────────────────────────────

const TTL: Record<string, number> = {
  personajes: 10 * 60_000, // 10 min
  reinos: 30 * 60_000, // 30 min — muy estables
  ciudades: 30 * 60_000, // 30 min — muy estables
  capitulos: 5 * 60_000, //  5 min — pueden publicarse nuevos
  libros: 5 * 60_000,
  // datos de usuario — más cortos para reflejar desbloqueos recientes
  descubrimientos: 3 * 60_000, //  3 min
  inventario_usuario: 3 * 60_000, //  3 min
  perfil_usuario: 5 * 60_000, //  5 min
  perfiles_resumen: 10 * 60_000, // 10 min — sidebar de exploradores
  canciones_personaje: 10 * 60_000, // 10 min — raramente cambia
  misiones: 10 * 60_000, // 10 min — catálogo, cambia poco
  misiones_usuario: 2 * 60_000, //  2 min — progreso, refrescar seguido
};

const DEFAULT_TTL = 5 * 60_000;

// ─── Caché en memoria ─────────────────────────────────────────────────────────

const _memCache = new Map<string, { data: any; ts: number }>();

function memGet<T>(key: string, ttlOverride?: number): T | null {
  const entry = _memCache.get(key);
  if (!entry) return null;
  const ttl = ttlOverride ?? TTL[key.split(":")[0]] ?? DEFAULT_TTL;
  return Date.now() - entry.ts < ttl ? (entry.data as T) : null;
}

function memSet<T>(key: string, data: T): void {
  _memCache.set(key, { data, ts: Date.now() });
}

/** Invalida la caché en memoria de una tabla (fuerza refetch la próxima vez). */

export function invalidateCache(tablePrefix: string): void {
  for (const key of _memCache.keys()) {
    if (key.startsWith(tablePrefix)) _memCache.delete(key);
  }
}

// ─── session_cache helpers (Dexie genérico) ──────────────────────────────────

async function sessionGet<T>(key: string, ttlMs: number): Promise<T | null> {
  try {
    const row = await db?.session_cache?.get(key);
    if (!row) return null;
    if (Date.now() - row.updated_at > ttlMs) return null;
    return row.value as T;
  } catch {
    return null;
  }
}

async function sessionSet(key: string, value: any): Promise<void> {
  try {
    await db?.session_cache?.put({ key, value, updated_at: Date.now() });
  } catch {}
}

async function _sessionDelete(key: string): Promise<void> {
  try {
    await db?.session_cache?.delete(key);
  } catch {}
}

/** Invalida session_cache para todas las claves que empiecen con un prefijo. */

export async function invalidateSessionCache(prefix: string): Promise<void> {
  try {
    const all = await db?.session_cache?.toArray();
    const keys = (all ?? [])
      .filter((r) => r.key.startsWith(prefix))
      .map((r) => r.key);
    if (keys.length) await db?.session_cache?.bulkDelete(keys);
  } catch {}
  invalidateCache(prefix);
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

export async function dexieAll<T>(table: any): Promise<T[]> {
  try {
    return ((await table?.toArray()) as T[]) ?? [];
  } catch {
    return [];
  }
}

export async function dexieWhere<T>(
  table: any,
  field: string,
  value: any,
): Promise<T[]> {
  try {
    return ((await table?.where(field).equals(value).toArray()) as T[]) ?? [];
  } catch {
    return [];
  }
}

async function persist(tableName: string, rows: any[]): Promise<void> {
  try {
    await (db as any)[tableName]?.bulkPut(rows);
  } catch {}
}

/**
 * Igual que persist(), pero además BORRA de Dexie las filas que ya no
 * vinieron en el resultado fresco de Supabase. Necesario para catálogos
 * donde se eliminan filas activamente (ej. el admin borrando una misión):
 * un simple bulkPut nunca quita lo viejo, así que una fila eliminada en el
 * servidor podía seguir reapareciendo desde el caché offline.
 */
async function persistReplace(tableName: string, rows: any[]): Promise<void> {
  try {
    const table = (db as any)[tableName];
    if (!table) return;
    const idsFrescos = new Set(rows.map((r) => r.id));
    const idsActuales: string[] = await table.toCollection().primaryKeys();
    const idsAEliminar = idsActuales.filter((id) => !idsFrescos.has(id));
    await table.bulkPut(rows);
    if (idsAEliminar.length > 0) await table.bulkDelete(idsAEliminar);
  } catch {}
}

// ─── Función genérica de carga con patrón Dexie-first ────────────────────────

interface LoadConfig<T> {
  cacheKey: string;
  dexieSource: () => Promise<T[]>;
  supabaseFetch: () => Promise<T[] | null>;
  persist: (rows: T[]) => Promise<void>;
}

async function loadWithCache<T>(
  config: LoadConfig<T>,
  onUpdate?: (data: T[]) => void,
): Promise<T[]> {
  const mem = memGet<T[]>(config.cacheKey);
  if (mem) return mem;

  const local = await config.dexieSource();
  if (local.length > 0) {
    memSet(config.cacheKey, local);
    void refreshInBackground(config, onUpdate);
    return local;
  }

  return (await fetchAndStore(config, onUpdate)) ?? [];
}

async function refreshInBackground<T>(
  config: LoadConfig<T>,
  onUpdate?: (data: T[]) => void,
): Promise<void> {
  const online = await isReallyOnline();
  if (!online) return;
  await fetchAndStore(config, onUpdate);
}

async function fetchAndStore<T>(
  config: LoadConfig<T>,
  onUpdate?: (data: T[]) => void,
): Promise<T[]> {
  try {
    const data = await config.supabaseFetch();
    if (!data) return [];
    memSet(config.cacheKey, data);
    await config.persist(data);
    onUpdate?.(data);
    return data;
  } catch {
    return [];
  }
}

// ─── Personajes ───────────────────────────────────────────────────────────────

export async function loadPersonajes(
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  return loadWithCache(
    {
      cacheKey: "personajes:all",
      dexieSource: () => dexieAll(db?.personajes),
      supabaseFetch: async () => {
        const { data } = await supabase
          .from("personajes")
          .select("*")
          .eq("visible", true);
        return data ?? null;
      },
      persist: (rows) => persist("personajes", rows),
    },
    onUpdate,
  );
}

export async function loadPersonajesMap(
  ids: string[],
  onUpdate?: (map: Record<string, any>) => void,
): Promise<Record<string, any>> {
  if (ids.length === 0) return {};
  const map: Record<string, any> = {};
  const missing: string[] = [];

  // ── Ronda 1: caché en memoria (sincrónico, sin IO) ─────────────────────────
  const idsSinMem: string[] = [];
  for (const id of ids) {
    const mem = memGet<any[]>(`personajes:${id}`);
    if (mem?.[0]) map[id] = mem[0];
    else idsSinMem.push(id);
  }

  // ── Ronda 2: Dexie en una sola llamada (bulkGet) en vez de N .get()
  // secuenciales — antes, con muchos ids, los últimos de la lista esperaban
  // a que TODOS los anteriores resolvieran uno por uno (de ahí que algunos
  // personajes/capítulos aparecieran casi al instante y otros tardaran).
  if (idsSinMem.length > 0) {
    try {
      const rows = (await db?.personajes?.bulkGet(idsSinMem)) ?? [];
      rows.forEach((row: any, i: number) => {
        const id = idsSinMem[i];
        if (row) {
          map[id] = row;
          memSet(`personajes:${id}`, [row]);
        } else {
          missing.push(id);
        }
      });
    } catch {
      missing.push(...idsSinMem);
    }
  }

  if (missing.length > 0 && (await isReallyOnline())) {
    try {
      // IMPORTANT: select("*") para no machacar campos como fecha_nacimiento en Dexie
      // con un objeto parcial {id, nombre, img_url} que no los incluye.
      const { data } = await supabase
        .from("personajes")
        .select("*")
        .in("id", missing);
      if (data) {
        for (const p of data) {
          map[p.id] = p;
          memSet(`personajes:${p.id}`, [p]);
        }
        await persist("personajes", data);
        onUpdate?.(map);
      }
    } catch {}
  }

  return map;
}

// ─── Reinos ───────────────────────────────────────────────────────────────────

export async function loadReinos(
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  return loadWithCache(
    {
      cacheKey: "reinos:all",
      dexieSource: () => dexieAll(db?.reinos),
      supabaseFetch: async () => {
        const { data } = await supabase
          .from("reinos")
          .select("*")
          .order("orden");
        return data ?? null;
      },
      persist: (rows) => persist("reinos", rows),
    },
    onUpdate,
  );
}

export async function loadReinosMap(
  ids: string[],
  onUpdate?: (map: Record<string, any>) => void,
): Promise<Record<string, any>> {
  if (ids.length === 0) return {};
  const map: Record<string, any> = {};
  const missing: string[] = [];

  // bulkGet en una sola operación en vez de un .get() por id en serie.
  try {
    const rows = (await db?.reinos?.bulkGet(ids)) ?? [];
    rows.forEach((row: any, i: number) => {
      const id = ids[i];
      if (row) map[id] = row;
      else missing.push(id);
    });
  } catch {
    missing.push(...ids);
  }

  if (missing.length > 0 && (await isReallyOnline())) {
    try {
      const { data } = await supabase
        .from("reinos")
        .select("*")
        .in("id", missing);
      if (data) {
        for (const r of data) map[r.id] = r;
        await persist("reinos", data);
        onUpdate?.(map);
      }
    } catch {}
  }

  return map;
}

// ─── Ciudades de un reino (reino_id está indexado en Dexie, v14) ─────────────

export async function loadCiudadesPorReino(
  reinoId: string,
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  const cacheKey = `ciudades:reino:${reinoId}`;
  const mem = memGet<any[]>(cacheKey, TTL["ciudades"] ?? DEFAULT_TTL);
  if (mem) return mem;

  const all = await dexieWhere<any>(db?.ciudades, "reino_id", reinoId);
  const local = all.filter((c) => !c.deleted);
  if (local.length > 0) {
    memSet(cacheKey, local);
    void isReallyOnline().then((online) => {
      if (online) void fetchCiudadesPorReino(reinoId, cacheKey, onUpdate);
    });
    return local;
  }

  return (await fetchCiudadesPorReino(reinoId, cacheKey, onUpdate)) ?? [];
}

async function fetchCiudadesPorReino(
  reinoId: string,
  cacheKey: string,
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("ciudades")
      .select(
        "id, nombre, descripcion, coord_x, coord_y, imagen_url, tipo, historia, secretos, reino_id",
      )
      .eq("reino_id", reinoId)
      .order("nombre");
    if (error || !data) return [];
    memSet(cacheKey, data);
    await persist("ciudades", data);
    onUpdate?.(data);
    return data;
  } catch {
    return [];
  }
}


// ─── Ciudades ─────────────────────────────────────────────────────────────────


export async function loadCiudadesMap(
  ids: string[],
  onUpdate?: (map: Record<string, any>) => void,
): Promise<Record<string, any>> {
  if (ids.length === 0) return {};
  const map: Record<string, any> = {};
  const missing: string[] = [];

  // bulkGet en una sola operación en vez de un .get() por id en serie.
  try {
    const rows = (await db?.ciudades?.bulkGet(ids)) ?? [];
    rows.forEach((row: any, i: number) => {
      const id = ids[i];
      if (row) map[id] = row;
      else missing.push(id);
    });
  } catch {
    missing.push(...ids);
  }

  if (missing.length > 0 && (await isReallyOnline())) {
    try {
      const { data } = await supabase
        .from("ciudades")
        .select("id, nombre, tipo, reino_id, imagen_url")
        .in("id", missing);
      if (data) {
        for (const c of data) map[c.id] = c;
        await persist("ciudades", data);
        onUpdate?.(map);
      }
    } catch {}
  }

  return map;
}

// ─── Entidades vinculadas a una ciudad (personajes / criaturas / ítems) ──────
//
// "ciudad_id" no está indexado en Dexie para estas tres tablas (ver db.ts),
// así que igual que el código que reemplazan, filtramos en memoria sobre
// dexieAll() en vez de dexieWhere(). Si en el futuro se agrega el índice,
// esto puede pasar a dexieWhere() para evitar el toArray() completo.

export async function loadPersonajesPorCiudad(
  ciudadId: string,
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  const cacheKey = `personajes:ciudad:${ciudadId}`;
  const mem = memGet<any[]>(cacheKey, TTL["personajes"] ?? DEFAULT_TTL);
  if (mem) return mem;

  const all = await dexieAll<any>(db?.personajes);
  const local = all.filter((p) => p.ciudad_id === ciudadId && !p.deleted);
  if (local.length > 0) {
    memSet(cacheKey, local);
    void isReallyOnline().then((online) => {
      if (online) void fetchPersonajesPorCiudad(ciudadId, cacheKey, onUpdate);
    });
    return local;
  }

  return (await fetchPersonajesPorCiudad(ciudadId, cacheKey, onUpdate)) ?? [];
}

async function fetchPersonajesPorCiudad(
  ciudadId: string,
  cacheKey: string,
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("personajes")
      .select("id, nombre, img_url")
      .eq("ciudad_id", ciudadId)
      .order("nombre");
    if (error || !data) return [];
    memSet(cacheKey, data);
    await persist("personajes", data);
    onUpdate?.(data);
    return data;
  } catch {
    return [];
  }
}

export async function loadCriaturasPorCiudad(
  ciudadId: string,
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  const cacheKey = `criaturas:ciudad:${ciudadId}`;
  const mem = memGet<any[]>(cacheKey, DEFAULT_TTL);
  if (mem) return mem;

  const all = await dexieAll<any>(db?.criaturas);
  const local = all.filter((c) => c.ciudad_id === ciudadId && !c.deleted);
  if (local.length > 0) {
    memSet(cacheKey, local);
    void isReallyOnline().then((online) => {
      if (online) void fetchCriaturasPorCiudad(ciudadId, cacheKey, onUpdate);
    });
    return local;
  }

  return (await fetchCriaturasPorCiudad(ciudadId, cacheKey, onUpdate)) ?? [];
}

async function fetchCriaturasPorCiudad(
  ciudadId: string,
  cacheKey: string,
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("criaturas")
      .select("id, nombre, imagen_url")
      .eq("ciudad_id", ciudadId)
      .order("nombre");
    if (error || !data) return [];
    memSet(cacheKey, data);
    await persist("criaturas", data);
    onUpdate?.(data);
    return data;
  } catch {
    return [];
  }
}

export async function loadItemsPorCiudad(
  ciudadId: string,
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  const cacheKey = `items:ciudad:${ciudadId}`;
  const mem = memGet<any[]>(cacheKey, DEFAULT_TTL);
  if (mem) return mem;

  const all = await dexieAll<any>(db?.items);
  const local = all.filter((i) => i.ciudad_id === ciudadId && !i.deleted);
  if (local.length > 0) {
    memSet(cacheKey, local);
    void isReallyOnline().then((online) => {
      if (online) void fetchItemsPorCiudad(ciudadId, cacheKey, onUpdate);
    });
    return local;
  }

  return (await fetchItemsPorCiudad(ciudadId, cacheKey, onUpdate)) ?? [];
}

async function fetchItemsPorCiudad(
  ciudadId: string,
  cacheKey: string,
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("items")
      .select("id, nombre, imagen_url")
      .eq("ciudad_id", ciudadId)
      .order("nombre");
    if (error || !data) return [];
    memSet(cacheKey, data);
    await persist("items", data);
    onUpdate?.(data);
    return data;
  } catch {
    return [];
  }
}

export async function invalidatePersonajesPorCiudad(
  ciudadId: string,
): Promise<void> {
  invalidateCache(`personajes:ciudad:${ciudadId}`);
}

export async function invalidateCriaturasPorCiudad(
  ciudadId: string,
): Promise<void> {
  invalidateCache(`criaturas:ciudad:${ciudadId}`);
}

export async function invalidateItemsPorCiudad(
  ciudadId: string,
): Promise<void> {
  invalidateCache(`items:ciudad:${ciudadId}`);
}

// ─── Capítulos de un libro ────────────────────────────────────────────────────

const _capsMemCache: Record<string, { data: any[]; ts: number }> = {};

export function capsCacheados(libroId: string): any[] | null {
  const c = _capsMemCache[libroId];
  return c && Date.now() - c.ts < TTL["capitulos"] ? c.data : null;
}

export async function loadCapitulos(
  libroId: string,
  onUpdate?: (caps: any[]) => void,
): Promise<any[]> {
  const mem = capsCacheados(libroId);
  if (mem) return mem;

  const local = (await dexieWhere<any>(db?.capitulos, "libro_id", libroId))
    .filter((c: any) => c.visibilidad === "publico")
    .sort((a: any, b: any) => a.orden - b.orden);

  if (local.length > 0) {
    _capsMemCache[libroId] = { data: local, ts: Date.now() };
    void isReallyOnline().then((online) => {
      if (online) void refreshCapitulos(libroId, onUpdate);
    });
    return local;
  }

  return (await refreshCapitulos(libroId, onUpdate)) ?? [];
}

async function refreshCapitulos(
  libroId: string,
  onUpdate?: (caps: any[]) => void,
): Promise<any[]> {
  try {
    const { data } = await supabase
      .from("capitulos")
      .select(
        "id, titulo_capitulo, orden, fecha_publicacion, libro_id, narrador_id, personajes_ids, reinos_ids, ciudades_ids, visibilidad, orden_linea_tiempo, dia_absoluto",
      )
      .eq("libro_id", libroId)
      .eq("visibilidad", "publico")
      .not("titulo_capitulo", "like", "[Ruta]%")
      .order("orden", { ascending: true });
    if (!data) return [];
    _capsMemCache[libroId] = { data, ts: Date.now() };
    await persist("capitulos", data);
    onUpdate?.(data);
    return data;
  } catch {
    return [];
  }
}

// ─── Capítulo próximo (siempre Supabase, tiempo-sensitivo) ───────────────────

export async function loadCapituloProximo(
  libroId: string,
): Promise<{ titulo_capitulo: string; fecha_publicacion: string } | null> {
  try {
    const { data } = await supabase
      .from("capitulos")
      .select("titulo_capitulo, fecha_publicacion")
      .eq("libro_id", libroId)
      .eq("visibilidad", "programado")
      .gt("fecha_publicacion", new Date().toISOString())
      .order("fecha_publicacion", { ascending: true })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

// ─── Libros ───────────────────────────────────────────────────────────────────


// ─── Descubrimientos de usuario (con caché Dexie via session_cache) ──────────
//
//  Estas tablas son perfectas para cachear: solo cambian cuando el usuario
//  lee un capítulo nuevo que desbloquea algo. TTL corto (3 min) + invalidación
//  manual al volver a la pestaña.

export interface DescubrimientoRaw {
  tipo: "item" | "criatura" | "personaje";
  fecha_descubrimiento: string;
  [key: string]: any;
}

/** Carga los descubrimientos del usuario (items + criaturas + personajes) en una sola llamada. */

export async function loadDescubrimientos(
  userId: string,
  onUpdate?: (data: DescubrimientoRaw[]) => void,
): Promise<DescubrimientoRaw[]> {
  const cacheKey = `descubrimientos:${userId}`;
  const ttl = TTL["descubrimientos"];

  // 1. Memoria
  const mem = memGet<DescubrimientoRaw[]>(cacheKey, ttl);
  if (mem) return mem;

  // 2. Dexie session_cache
  const cached = await sessionGet<DescubrimientoRaw[]>(cacheKey, ttl);
  if (cached) {
    memSet(cacheKey, cached);
    // Refrescar en background
    void isReallyOnline().then((online) => {
      if (online) void fetchDescubrimientos(userId, cacheKey, onUpdate);
    });
    return cached;
  }

  // 3. Supabase
  return (await fetchDescubrimientos(userId, cacheKey, onUpdate)) ?? [];
}

async function fetchDescubrimientos(
  userId: string,
  cacheKey: string,
  onUpdate?: (data: DescubrimientoRaw[]) => void,
): Promise<DescubrimientoRaw[]> {
  try {
    const [itemsRes, criaturasRes, personajesRes] = await Promise.all([
      supabase
        .from("descubrimientos_items")
        .select(
          "fecha_descubrimiento, items:item_id(id, nombre, categoria, imagen_url, descripcion)",
        )
        .eq("perfil_id", userId),
      supabase
        .from("descubrimientos_criaturas")
        .select(
          "fecha_descubrimiento, criaturas:criatura_id(id, nombre, habitat, alma, imagen_url, descripcion)",
        )
        .eq("perfil_id", userId),
      supabase
        .from("descubrimientos_personajes")
        .select(
          "fecha_descubrimiento, personajes:personaje_id(id, nombre, reino, especie, img_url, sobre)",
        )
        .eq("perfil_id", userId),
    ]);

    const merged: DescubrimientoRaw[] = [
      ...(itemsRes.data ?? []).map((r: any) => ({
        tipo: "item" as const,
        fecha_descubrimiento: r.fecha_descubrimiento,
        entidad_id: r.items?.id,
        nombre: r.items?.nombre,
        descripcion: r.items?.descripcion,
        imagen_url: r.items?.imagen_url,
        categoria: r.items?.categoria,
      })),
      ...(criaturasRes.data ?? []).map((r: any) => ({
        tipo: "criatura" as const,
        fecha_descubrimiento: r.fecha_descubrimiento,
        entidad_id: r.criaturas?.id,
        nombre: r.criaturas?.nombre,
        descripcion: r.criaturas?.descripcion,
        imagen_url: r.criaturas?.imagen_url,
        habitat: r.criaturas?.habitat,
        alma: r.criaturas?.alma,
      })),
      ...(personajesRes.data ?? []).map((r: any) => ({
        tipo: "personaje" as const,
        fecha_descubrimiento: r.fecha_descubrimiento,
        entidad_id: r.personajes?.id,
        nombre: r.personajes?.nombre,
        imagen_url: r.personajes?.img_url,
        descripcion: r.personajes?.sobre,
        reino: r.personajes?.reino,
        especie: r.personajes?.especie,
      })),
    ];

    memSet(cacheKey, merged);
    await sessionSet(cacheKey, merged);
    onUpdate?.(merged);
    return merged;
  } catch {
    return [];
  }
}

// ─── Reinos + ciudades desbloqueadas por usuario ─────────────────────────────

export interface ReinoDesbloqueado {
  id: string;
  nombre: string;
  mapa_url?: string | null;
  logo_url?: string | null;
  descripcion?: string | null;
}

export interface CiudadDesbloqueada {
  id: string;
  nombre: string;
  imagen_url?: string | null;
  descripcion?: string | null;
  reino_id?: string | null;
}

export async function loadReinosCiudadesUsuario(
  userId: string,
  onUpdate?: (
    reinos: ReinoDesbloqueado[],
    ciudades: CiudadDesbloqueada[],
  ) => void,
): Promise<{ reinos: ReinoDesbloqueado[]; ciudades: CiudadDesbloqueada[] }> {
  const cacheKey = `reinos_ciudades_usuario:${userId}`;
  const ttl = TTL["descubrimientos"];

  // 1. Memoria
  const mem = memGet<{
    reinos: ReinoDesbloqueado[];
    ciudades: CiudadDesbloqueada[];
  }>(cacheKey, ttl);
  if (mem) return mem;

  // 2. Dexie session_cache
  const cached = await sessionGet<{
    reinos: ReinoDesbloqueado[];
    ciudades: CiudadDesbloqueada[];
  }>(cacheKey, ttl);
  if (cached) {
    memSet(cacheKey, cached);
    void isReallyOnline().then((online) => {
      if (online) void fetchReinosCiudadesUsuario(userId, cacheKey, onUpdate);
    });
    return cached;
  }

  // 3. Supabase
  return (
    (await fetchReinosCiudadesUsuario(userId, cacheKey, onUpdate)) ?? {
      reinos: [],
      ciudades: [],
    }
  );
}

async function fetchReinosCiudadesUsuario(
  userId: string,
  cacheKey: string,
  onUpdate?: (
    reinos: ReinoDesbloqueado[],
    ciudades: CiudadDesbloqueada[],
  ) => void,
): Promise<{ reinos: ReinoDesbloqueado[]; ciudades: CiudadDesbloqueada[] }> {
  try {
    const [reinosRes, ciudadesRes] = await Promise.all([
      supabase
        .from("descubrimientos_reinos")
        .select(
          "fecha_descubrimiento, reino_data:reino_id(id, nombre, mapa_url, logo_url, descripcion)",
        )
        .eq("perfil_id", userId),
      supabase
        .from("ciudades_desbloqueadas")
        .select(
          "ciudades:ciudad_id(id, nombre, imagen_url, descripcion, reino_id)",
        )
        .eq("user_id", userId),
    ]);

    const reinos = (reinosRes.data ?? [])
      .map((r: any) => ({
        id: r.reino_data?.id,
        nombre: r.reino_data?.nombre,
        mapa_url: r.reino_data?.mapa_url,
        logo_url: r.reino_data?.logo_url,
        descripcion: r.reino_data?.descripcion,
      }))
      .filter((r: any) => r.id) as ReinoDesbloqueado[];

    const ciudades = (ciudadesRes.data ?? [])
      .map((r: any) => ({
        id: r.ciudades?.id,
        nombre: r.ciudades?.nombre,
        imagen_url: r.ciudades?.imagen_url,
        descripcion: r.ciudades?.descripcion,
        reino_id: r.ciudades?.reino_id ?? null,
      }))
      .filter((c: any) => c.id) as CiudadDesbloqueada[];

    const result = { reinos, ciudades };
    memSet(cacheKey, result);
    await sessionSet(cacheKey, result);
    onUpdate?.(reinos, ciudades);
    return result;
  } catch {
    return { reinos: [], ciudades: [] };
  }
}

// ─── Inventario de usuario ────────────────────────────────────────────────────

export async function loadInventarioUsuario(
  userId: string,
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  const cacheKey = `inventario_usuario:${userId}`;
  const ttl = TTL["inventario_usuario"];

  const mem = memGet<any[]>(cacheKey, ttl);
  if (mem) return mem;

  const cached = await sessionGet<any[]>(cacheKey, ttl);
  if (cached) {
    memSet(cacheKey, cached);
    void isReallyOnline().then((online) => {
      if (online) void fetchInventario(userId, cacheKey, onUpdate);
    });
    return cached;
  }

  return (await fetchInventario(userId, cacheKey, onUpdate)) ?? [];
}

async function fetchInventario(
  userId: string,
  cacheKey: string,
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  try {
    const { data } = await supabase
      .from("inventario_usuario")
      .select("equipado, items(id, nombre, categoria, imagen_url, descripcion)")
      .eq("perfil_id", userId);
    if (!data) return [];
    memSet(cacheKey, data);
    await sessionSet(cacheKey, data);
    onUpdate?.(data);
    return data;
  } catch {
    return [];
  }
}

// ─── Perfil de usuario (con caché) ───────────────────────────────────────────

export async function loadPerfilUsuario(
  userId: string,
  onUpdate?: (data: any) => void,
): Promise<any | null> {
  const cacheKey = `perfil_usuario:${userId}`;
  const ttl = TTL["perfil_usuario"];

  const mem = memGet<any>(cacheKey, ttl);
  if (mem) return mem;

  // Intentar desde Dexie perfiles (tabla nativa)
  try {
    const local = await db?.perfiles?.get(userId);
    if (local && Date.now() - (local.cached_at ?? 0) < ttl) {
      memSet(cacheKey, local);
      void isReallyOnline().then((online) => {
        if (online) void fetchPerfilUsuario(userId, cacheKey, onUpdate);
      });
      return local;
    }
  } catch {}

  return await fetchPerfilUsuario(userId, cacheKey, onUpdate);
}

async function fetchPerfilUsuario(
  userId: string,
  cacheKey: string,
  onUpdate?: (data: any) => void,
): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from("perfiles")
      .select(
        "username, status, rol, avatar_url, descripcion, titulo, personaje_favorito_id, mascota_id, personajes:personaje_favorito_id(id, nombre, img_url), mascota:mascota_id(id, nombre, imagen_url)",
      )
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return null;
    const toStore = { ...data, id: userId, cached_at: Date.now() };
    memSet(cacheKey, data);
    try {
      await db?.perfiles?.put(toStore);
    } catch {}
    onUpdate?.(data);
    return data;
  } catch {
    return null;
  }
}

// ─── Sidebar de exploradores (conteos en una sola RPC/query) ─────────────────
//
//  ANTES: N perfiles × 3 queries COUNT = potencialmente 30+ round-trips.
//  AHORA: 1 query por tabla con GROUP BY perfil_id, cacheado en session_cache.

export interface PerfilResumen {
  id: string;
  username: string;
  status?: string;
  avatar_url?: string;
  items_count: number;
  criaturas_count: number;
  personajes_count: number;
}

export async function loadPerfilesResumen(
  excludeId: string,
  onUpdate?: (data: PerfilResumen[]) => void,
): Promise<PerfilResumen[]> {
  const cacheKey = `perfiles_resumen:all`;
  const ttl = TTL["perfiles_resumen"];

  const mem = memGet<PerfilResumen[]>(cacheKey, ttl);
  if (mem) return mem.filter((p) => p.id !== excludeId);

  const cached = await sessionGet<PerfilResumen[]>(cacheKey, ttl);
  if (cached) {
    memSet(cacheKey, cached);
    void isReallyOnline().then((online) => {
      if (online) void fetchPerfilesResumen(excludeId, cacheKey, onUpdate);
    });
    return cached.filter((p) => p.id !== excludeId);
  }

  return (await fetchPerfilesResumen(excludeId, cacheKey, onUpdate)) ?? [];
}

async function fetchPerfilesResumen(
  excludeId: string,
  cacheKey: string,
  onUpdate?: (data: PerfilResumen[]) => void,
): Promise<PerfilResumen[]> {
  try {
    // 4 queries paralelas en lugar de N×3
    const [perfilesRes, itemsRes, criaturasRes, personajesRes] =
      await Promise.all([
        supabase
          .from("perfiles")
          .select("id, username, status, avatar_url")
          .neq("id", excludeId)
          .order("username"),
        supabase.from("descubrimientos_items").select("perfil_id"),
        supabase.from("descubrimientos_criaturas").select("perfil_id"),
        supabase.from("descubrimientos_personajes").select("perfil_id"),
      ]);

    if (!perfilesRes.data?.length) return [];

    // Contar en JS (O(n)) en lugar de N round-trips
    const countMap = (rows: any[] | null) =>
      (rows ?? []).reduce<Record<string, number>>((acc, r) => {
        acc[r.perfil_id] = (acc[r.perfil_id] ?? 0) + 1;
        return acc;
      }, {});

    const itemCounts = countMap(itemsRes.data);
    const criaturaCounts = countMap(criaturasRes.data);
    const personajeCounts = countMap(personajesRes.data);

    const result: PerfilResumen[] = perfilesRes.data.map((p: any) => ({
      id: p.id,
      username: p.username,
      status: p.status,
      avatar_url: p.avatar_url,
      items_count: itemCounts[p.id] ?? 0,
      criaturas_count: criaturaCounts[p.id] ?? 0,
      personajes_count: personajeCounts[p.id] ?? 0,
    }));

    memSet(cacheKey, result);
    await sessionSet(cacheKey, result);
    const filtered = result.filter((p) => p.id !== excludeId);
    onUpdate?.(filtered);
    return filtered;
  } catch {
    return [];
  }
}

// ─── Canciones de personaje (con caché) ──────────────────────────────────────

export async function loadCancionesPersonaje(
  personajeId: string,
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  const cacheKey = `canciones_personaje:${personajeId}`;
  const ttl = TTL["canciones_personaje"];

  const mem = memGet<any[]>(cacheKey, ttl);
  if (mem) return mem;

  const cached = await sessionGet<any[]>(cacheKey, ttl);
  if (cached) {
    memSet(cacheKey, cached);
    return cached;
  }

  try {
    const { data, error } = await supabase
      .from("canciones")
      .select("id, titulo, portada_url, info_cancion, personaje_id")
      .eq("personaje_id", personajeId)
      .eq("visible", true);
    if (error || !data) return [];
    memSet(cacheKey, data);
    await sessionSet(cacheKey, data);
    onUpdate?.(data);
    return data;
  } catch {
    return [];
  }
}

// ─── Misiones / desafíos ──────────────────────────────────────────────────────
//
// "misiones" es catálogo compartido (igual patrón que loadPersonajes/loadReinos):
// Dexie primero → Supabase en background si hay conexión.
//
// "misiones_usuario" es progreso por usuario (igual patrón que
// loadInventarioUsuario): se guarda también en la tabla Dexie nativa
// (no solo session_cache) para poder LEER y ESCRIBIR offline de forma
// optimista — ver aceptarMisionOffline/reclamarMisionOffline más abajo.

export async function loadMisiones(
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  return loadWithCache(
    {
      cacheKey: "misiones:all",
      dexieSource: () => dexieAll(db?.misiones),
      supabaseFetch: async () => {
        const { data } = await supabase
          .from("misiones")
          .select(
            "id, titulo, descripcion, dificultad, categoria, imagen_url, requisitos, vence_en, recompensa_xp, recompensa_monedas, recompensa_item_nombre, recompensa_item_imagen_url, recompensa_item_id, activa, creado_en",
          )
          .eq("activa", true)
          .order("creado_en", { ascending: false });
        if (!data) return null;
        return data.map((m: any) => ({ ...m, cached_at: Date.now() }));
      },
      // Nota: NO usa persistReplace aquí — esta consulta filtra activa=true,
      // así que reemplazar el contenido completo de Dexie con este subset
      // borraría también las misiones inactivas que el editor admin necesita
      // ver offline. La limpieza de eliminaciones reales ocurre en
      // loadMisionesAdmin, que sí ve el catálogo completo.
      persist: (rows) => persist("misiones", rows),
    },
    onUpdate,
  );
}

/**
 * Variante para el panel de administración: lee/escribe el catálogo
 * COMPLETO (incluidas misiones inactivas), y sincroniza eliminaciones
 * reales contra Dexie (persistReplace) — a diferencia de loadMisiones(),
 * que es para el tablón del jugador y solo trae activas.
 *
 * Dexie-first: antes pegaba SIEMPRE a Supabase y esperaba la respuesta
 * (network-first), así que el panel admin tardaba un round-trip completo
 * cada vez que se abría, incluso con caché local válido. Ahora sigue el
 * mismo patrón que loadWithCache: muestra lo que haya en Dexie al
 * instante y refresca en background si hay conexión, notificando vía
 * onUpdate cuando llegue lo fresco.
 */
export async function loadMisionesAdmin(
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  const local = await dexieAll<any>(db?.misiones);
  if (local.length > 0) {
    void isReallyOnline().then((online) => {
      if (online) void fetchMisionesAdmin(onUpdate);
    });
    return local;
  }
  return (await fetchMisionesAdmin(onUpdate)) ?? dexieAll(db?.misiones);
}

async function fetchMisionesAdmin(
  onUpdate?: (data: any[]) => void,
): Promise<any[] | null> {
  try {
    const { data, error } = await supabase
      .from("misiones")
      .select(
        "id, titulo, descripcion, dificultad, categoria, imagen_url, requisitos, vence_en, recompensa_xp, recompensa_monedas, recompensa_item_nombre, recompensa_item_imagen_url, recompensa_item_id, activa, creado_en",
      )
      .order("creado_en", { ascending: false });

    if (error || !data) return null;

    const rows = data.map((m: any) => ({ ...m, cached_at: Date.now() }));
    await persistReplace("misiones", rows);
    onUpdate?.(rows);
    return rows;
  } catch {
    return null;
  }
}

export async function loadMisionesUsuario(
  fichaId: string,
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  const cacheKey = `misiones_usuario:${fichaId}`;
  const ttl = TTL["misiones_usuario"];

  const mem = memGet<any[]>(cacheKey, ttl);
  if (mem) return mem;

  // Dexie primero — permite ver el progreso offline incluso si el caché en
  // memoria expiró (a diferencia de session_cache, sobrevive recargas).
  const local = await dexieWhere<any>(db?.misiones_usuario, "ficha_id", fichaId);
  if (local.length > 0) {
    memSet(cacheKey, local);
    void isReallyOnline().then((online) => {
      if (online) void fetchMisionesUsuario(fichaId, cacheKey, onUpdate);
    });
    return local;
  }

  return (await fetchMisionesUsuario(fichaId, cacheKey, onUpdate)) ?? [];
}

async function fetchMisionesUsuario(
  fichaId: string,
  cacheKey: string,
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("misiones_usuario")
      .select(
        "mision_id, estado, progreso, fecha_aceptada, fecha_completada, user_id",
      )
      .eq("ficha_id", fichaId);
    if (error || !data) return [];

    const rows = data.map((r: any) => ({
      id: `${fichaId}_${r.mision_id}`,
      ficha_id: fichaId,
      user_id: r.user_id,
      mision_id: r.mision_id,
      estado: r.estado,
      progreso: r.progreso,
      fecha_aceptada: r.fecha_aceptada,
      fecha_completada: r.fecha_completada,
      status: "synced" as const,
      cached_at: Date.now(),
    }));

    memSet(cacheKey, rows);
    await persist("misiones_usuario", rows);
    onUpdate?.(rows);
    return rows;
  } catch {
    return [];
  }
}

/**
 * Acepta una misión de forma optimista: escribe en Dexie de inmediato
 * (status "pending") y, si hay conexión, intenta sincronizar contra
 * Supabase. Si no hay conexión, queda en Dexie con status "pending" y
 * encolada en offline_queue para cuando vuelva la red.
 *
 * Devuelve la fila local que debe usarse para actualizar el estado de la UI
 * de inmediato (no esperar la respuesta de red).
 */

/**
 * Reclama la recompensa de una misión completada.
 *
 * A diferencia de aceptarMisionOffline, esto NO puede aplicarse de forma
 * optimista: la suma de XP/monedas la valida y ejecuta exclusivamente la
 * función RPC reclamar_mision en Supabase (SECURITY DEFINER), para que el
 * cliente nunca decida cuánto XP otorgarse. Por eso, sin conexión, esta
 * función falla explícitamente en lugar de fingir éxito.
 */
export async function reclamarMisionOffline(
  misionId: string,
  fichaId: string,
): Promise<
  | { ok: true; nuevoXpTotal: number; nuevasMonedas: number }
  | { ok: false; reason: "offline" | "error"; message: string }
> {
  const online = await isReallyOnline();
  if (!online) {
    return {
      ok: false,
      reason: "offline",
      message: "Necesitas conexión a internet para reclamar la recompensa.",
    };
  }

  try {
    const { data, error } = await supabase.rpc("reclamar_mision", {
      p_mision_id: misionId,
      p_ficha_id: fichaId,
    });
    if (error) {
      return { ok: false, reason: "error", message: error.message };
    }
    const resultado = Array.isArray(data) ? data[0] : data;
    return {
      ok: true,
      nuevoXpTotal: resultado?.nuevo_xp_total ?? 0,
      nuevasMonedas: resultado?.nuevas_monedas ?? 0,
    };
  } catch (e: any) {
    return {
      ok: false,
      reason: "error",
      message: e?.message ?? "Error al reclamar la recompensa.",
    };
  }
}

/**
 * Encola una operación en offline_queue con el mismo formato que ya usa
 * el resto de la app (tareas, eventos, notas, etc). NOTA: esto asume que
 * tu motor de sync (useOfflineSync) procesa la cola de forma genérica por
 * nombre de tabla; si ese motor tiene una lista fija de tablas soportadas,
 * hay que añadir "misiones_usuario" allí también para que el push real
 * a Supabase ocurra al recuperar conexión.
 */
async function enqueueOffline(
  table: string,
  operation: "upsert" | "update" | "delete",
  recordId: string,
  payload: any,
): Promise<void> {
  try {
    await db?.offline_queue?.add({
      table,
      operation,
      recordId,
      payload,
      timestamp: Date.now(),
      retries: 0,
    });
  } catch {}
}

// ─── Relaciones entre personajes ──────────────────────────────────────────────
//
// Tabla de catálogo (como reinos/ciudades): cambia poco, ideal para Dexie-first.
// Usa persistReplace porque es un panel admin (AdminDescubrimientos) que ve y
// gestiona el set completo — si se borra una relación en Supabase, debe
// desaparecer también del caché offline.


export async function invalidateRelaciones(): Promise<void> {
  invalidateCache("relaciones:all");
}

// ─── Vínculos de entidades a misiones (mision_entidades) ─────────────────────
//
// Igual patrón: catálogo compartido, poco volátil, panel admin necesita ver
// el set completo (persistReplace para que las desvinculaciones se reflejen).


/** Variante filtrada por misión — útil si el editor de una misión puntual
 * no necesita cargar el catálogo completo de vínculos. */
export async function loadMisionEntidadesPorMision(
  misionId: string,
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  const cacheKey = `mision_entidades:mision:${misionId}`;
  const mem = memGet<any[]>(cacheKey, TTL["misiones"] ?? DEFAULT_TTL);
  if (mem) return mem;

  const local = await dexieWhere<any>(
    db?.mision_entidades,
    "mision_id",
    misionId,
  );
  if (local.length > 0) {
    memSet(cacheKey, local);
    void isReallyOnline().then((online) => {
      if (online) void fetchMisionEntidadesPorMision(misionId, cacheKey, onUpdate);
    });
    return local;
  }

  return (
    (await fetchMisionEntidadesPorMision(misionId, cacheKey, onUpdate)) ?? []
  );
}

async function fetchMisionEntidadesPorMision(
  misionId: string,
  cacheKey: string,
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("mision_entidades")
      .select("id, mision_id, tipo, entidad_id, rol, nombre, imagen_url")
      .eq("mision_id", misionId);
    if (error || !data) return [];
    memSet(cacheKey, data);
    await persist("mision_entidades", data);
    onUpdate?.(data);
    return data;
  } catch {
    return [];
  }
}


// ─── Utilidades ───────────────────────────────────────────────────────────────


export function collectIds(caps: any[], field: string): string[] {
  const set = new Set<string>();
  for (const c of caps) {
    const val = c[field];
    if (Array.isArray(val)) val.forEach((id: string) => set.add(id));
    else if (val) set.add(val);
  }
  return [...set];
}

// ─── Tiles de mapa global ─────────────────────────────────────────────────────

export async function loadMapTiles(
  worldId: string = "garlia",
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  return loadWithCache(
    {
      cacheKey: `map_tiles:${worldId}`,
      dexieSource: () => dexieWhere(db?.map_tiles, "world_id", worldId),
      supabaseFetch: async () => {
        const { data } = await supabase
          .from("map_tiles")
          .select("id, world_id, col, row, image_url, label, order")
          .eq("world_id", worldId)
          .order("row")
          .order("col");
        return data ?? null;
      },
      persist: (rows) => persistReplace("map_tiles", rows),
    },
    onUpdate,
  );
}

export async function invalidateMapTiles(
  worldId: string = "garlia",
): Promise<void> {
  await invalidateSessionCache(`map_tiles:${worldId}`);
}

// ─── Tiles de reinos ──────────────────────────────────────────────────────────

export async function loadReinoTiles(
  reinoId: string,
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  return loadWithCache(
    {
      cacheKey: `reino_tiles:${reinoId}`,
      dexieSource: () => dexieWhere(db?.reino_tiles, "reino_id", reinoId),
      supabaseFetch: async () => {
        const { data } = await supabase
          .from("reino_tiles")
          .select("id, reino_id, col, row, image_url, label, order")
          .eq("reino_id", reinoId)
          .order("row")
          .order("col");
        return data ?? null;
      },
      persist: (rows) => persistReplace("reino_tiles", rows),
    },
    onUpdate,
  );
}

export async function invalidateReinoTiles(reinoId: string): Promise<void> {
  await invalidateSessionCache(`reino_tiles:${reinoId}`);
}

// ─── Áreas del mapa interno de un reino (círculo/rectángulo/polígono) ─────────
// Mismo patrón que loadMapAreas, scoped por reino_id en vez de world_id —
// ver ReinoTileCanvas.

export async function loadReinoAreas(
  reinoId: string,
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  return loadWithCache(
    {
      cacheKey: `reino_areas:${reinoId}`,
      dexieSource: () => dexieWhere(db?.reino_areas, "reino_id", reinoId),
      supabaseFetch: async () => {
        const { data } = await supabase
          .from("reino_areas")
          .select("id, reino_id, ciudad_id, tipo, puntos, color, label, orden")
          .eq("reino_id", reinoId)
          .order("orden");
        return data ?? null;
      },
      persist: (rows) => persistReplace("reino_areas", rows),
    },
    onUpdate,
  );
}

export async function invalidateReinoAreas(reinoId: string): Promise<void> {
  await invalidateSessionCache(`reino_areas:${reinoId}`);
}

// ─── Áreas del mapa (círculo / rectángulo / polígono) ─────────────────────────
// Mismo patrón que loadMapTiles: Dexie-first + revalidación en segundo plano.

export async function loadMapAreas(
  worldId: string = "garlia",
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  return loadWithCache(
    {
      cacheKey: `map_areas:${worldId}`,
      dexieSource: () => dexieWhere(db?.map_areas, "world_id", worldId),
      supabaseFetch: async () => {
        const { data } = await supabase
          .from("map_areas")
          .select(
            "id, world_id, reino_id, ciudad_id, tipo, puntos, color, label, orden",
          )
          .eq("world_id", worldId)
          .order("orden");
        return data ?? null;
      },
      persist: (rows) => persistReplace("map_areas", rows),
    },
    onUpdate,
  );
}

export async function invalidateMapAreas(
  worldId: string = "garlia",
): Promise<void> {
  await invalidateSessionCache(`map_areas:${worldId}`);
}

// ─── Librería de assets (map_assets) ───────────────────────────────────────
// Catálogo reutilizable (castillos, árboles, montañas, ríos...) — no scoped
// por reino, solo por world_id (siempre "garlia" por ahora, pero se respeta
// el mismo parámetro que el resto para no hardcodear el string dos veces).
// Cambia poco (se sube a mano por SQL / futuro uploader), así que usa el
// mismo patrón Dexie-first que map_tiles.

export async function loadMapAssets(
  worldId: string = "garlia",
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  return loadWithCache(
    {
      cacheKey: `map_assets:${worldId}`,
      dexieSource: () => dexieWhere(db?.map_assets, "world_id", worldId),
      supabaseFetch: async () => {
        const { data } = await supabase
          .from("map_assets")
          .select(
            "id, world_id, nombre, categoria, image_url, ancho_base, alto_base, anchor_x, anchor_y",
          )
          .eq("world_id", worldId)
          .order("categoria")
          .order("nombre");
        return data ?? null;
      },
      persist: (rows) => persistReplace("map_assets", rows),
    },
    onUpdate,
  );
}

export async function invalidateMapAssets(
  worldId: string = "garlia",
): Promise<void> {
  await invalidateSessionCache(`map_assets:${worldId}`);
}

// ─── Instancias de assets colocados (map_asset_placements) ────────────────
// Scope exclusivo: exactamente uno de world_id/reino_id (ver constraint en
// map_assets.sql). Se cachea por separado según el scope, igual que
// map_areas vs reino_areas — dos funciones en vez de una con scope
// polimórfico, mismo criterio que ya usa el resto del archivo.

export async function loadMapAssetPlacements(
  worldId: string = "garlia",
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  return loadWithCache(
    {
      cacheKey: `map_asset_placements:world:${worldId}`,
      dexieSource: () =>
        dexieWhere(db?.map_asset_placements, "world_id", worldId),
      supabaseFetch: async () => {
        const { data } = await supabase
          .from("map_asset_placements")
          .select(
            "id, asset_id, world_id, reino_id, tile_col, tile_row, coord_x, coord_y, escala, rotacion, z_index",
          )
          .eq("world_id", worldId);
        return data ?? null;
      },
      persist: (rows) => persistReplace("map_asset_placements", rows),
    },
    onUpdate,
  );
}

export async function invalidateMapAssetPlacements(
  worldId: string = "garlia",
): Promise<void> {
  await invalidateSessionCache(`map_asset_placements:world:${worldId}`);
}

export async function loadReinoAssetPlacements(
  reinoId: string,
  onUpdate?: (data: any[]) => void,
): Promise<any[]> {
  return loadWithCache(
    {
      cacheKey: `map_asset_placements:reino:${reinoId}`,
      dexieSource: () =>
        dexieWhere(db?.map_asset_placements, "reino_id", reinoId),
      supabaseFetch: async () => {
        const { data } = await supabase
          .from("map_asset_placements")
          .select(
            "id, asset_id, world_id, reino_id, tile_col, tile_row, coord_x, coord_y, escala, rotacion, z_index",
          )
          .eq("reino_id", reinoId);
        return data ?? null;
      },
      persist: (rows) => persistReplace("map_asset_placements", rows),
    },
    onUpdate,
  );
}

export async function invalidateReinoAssetPlacements(
  reinoId: string,
): Promise<void> {
  await invalidateSessionCache(`map_asset_placements:reino:${reinoId}`);
}
