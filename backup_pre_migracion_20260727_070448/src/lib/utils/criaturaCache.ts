/**
 * criaturaCache.ts
 * ────────────────
 * Caches en memoria compartidas entre EditorPersonaje y EditorCriatura.
 * Evitan que ambos archivos llamen toArray() por separado sobre las mismas
 * tablas (O(n) × N → O(n) × 1).
 *
 * Sin React, sin JSX → va en lib/utils/.
 * Ruta destino: src/lib/utils/criaturaCache.ts
 */

import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";

// ─── Caché: criatura por nombre ───────────────────────────────────────────────
const _criaturaByNombre = new Map<string, any | null>();
let _criaturaTableLoaded = false;

async function _preloadCriaturas(): Promise<void> {
  if (_criaturaTableLoaded) return;
  _criaturaTableLoaded = true;
  try {
    if (!db) return;
    const todas: any[] = (await (db as any).criaturas?.toArray()) ?? [];
    for (const c of todas) {
      const key = c.nombre?.toLowerCase().trim();
      if (key) _criaturaByNombre.set(key, c);
    }
  } catch {
    _criaturaTableLoaded = false;
  }
}

/**
 * Devuelve la criatura cuyo nombre coincide (case-insensitive).
 * Primero consulta la caché en memoria, luego Dexie y por último Supabase.
 */
export async function getCriaturaByNombre(nombre: string): Promise<any | null> {
  const key = nombre.trim().toLowerCase();
  if (_criaturaByNombre.has(key)) return _criaturaByNombre.get(key) ?? null;
  await _preloadCriaturas();
  if (_criaturaByNombre.has(key)) return _criaturaByNombre.get(key) ?? null;
  if (!navigator.onLine) return null;
  try {
    const { data } = await supabase
      .from("criaturas")
      .select("id, nombre")
      .ilike("nombre", nombre.trim())
      .limit(1)
      .maybeSingle();
    _criaturaByNombre.set(key, data ?? null);
    return data ?? null;
  } catch {
    return null;
  }
}

// ─── Caché: grupos_mundo por tipo (con TTL) ───────────────────────────────────
const _gruposByTipo = new Map<string, { data: any[]; ts: number }>();
const GRUPOS_TTL_MS = 60_000;

function mapGrupoRow(g: any) {
  return {
    ...g,
    nombre: g.nombre ?? "",
    miembro_ids: g.miembro_ids ?? [],
  };
}

/**
 * Devuelve todos los grupos_mundo de un tipo dado.
 * Usa el índice "tipo" de Dexie en vez de toArray() completo.
 * Resultado se cachea 60 segundos en memoria.
 *
 * Estrategia stale-while-revalidate:
 *   1. Si hay caché vigente (< TTL), se devuelve de inmediato.
 *   2. Si no, se lee Dexie para responder rápido sin red.
 *   3. Si hay conexión, SIEMPRE se contrasta contra Supabase y se
 *      actualiza tanto la caché en memoria como Dexie, para que los
 *      grupos creados/editados/eliminados se reflejen sin recargar
 *      la página.
 */
export async function getGruposByTipo(tipo: string): Promise<any[]> {
  const cached = _gruposByTipo.get(tipo);
  if (cached && Date.now() - cached.ts < GRUPOS_TTL_MS) return cached.data;

  let data: any[] = cached?.data ?? [];

  // 1. Dexie (rápido, sin red)
  try {
    if (db) {
      const raw: any[] =
        (await (db as any).grupos_mundo
          ?.where("tipo")
          .equals(tipo)
          .toArray()) ?? [];
      if (raw.length) {
        data = raw.map(mapGrupoRow);
        _gruposByTipo.set(tipo, { data, ts: Date.now() });
      }
    }
  } catch {}

  if (!navigator.onLine) return data;

  // 2. Supabase — fuente de verdad, refresca caché y Dexie
  try {
    const { data: fresh, error } = await supabase
      .from("grupos_mundo")
      .select("id, nombre, tipo, miembro_ids")
      .eq("tipo", tipo);
    if (error) throw error;
    const mapped = (fresh ?? []).map(mapGrupoRow);
    _gruposByTipo.set(tipo, { data: mapped, ts: Date.now() });
    try {
      if (db && mapped.length) await (db as any).grupos_mundo?.bulkPut(mapped);
    } catch {}
    return mapped;
  } catch {
    // Si falla la red, nos quedamos con lo que teníamos (Dexie o caché vieja)
    return data;
  }
}

/**
 * Invalida la caché de un tipo de grupo (o de todos si no se especifica).
 * Llamar tras crear, editar o eliminar un grupo_mundo para que el próximo
 * `getGruposByTipo` traiga datos frescos de inmediato, sin esperar el TTL.
 */
export function invalidateGruposByTipo(tipo?: string): void {
  if (tipo) _gruposByTipo.delete(tipo);
  else _gruposByTipo.clear();
}

// ─── Caché: mapa id → título de libros ───────────────────────────────────────
let _libroMapCache: Record<string, string> | null = null;

/**
 * Devuelve un mapa { libro_id → titulo } construido desde Dexie.
 * Se cachea indefinidamente durante la sesión (los títulos cambian poco).
 */
export async function getLibroMap(): Promise<Record<string, string>> {
  if (_libroMapCache) return _libroMapCache;
  try {
    if (db) {
      const libros: any[] = (await (db as any).libros?.toArray()) ?? [];
      _libroMapCache = Object.fromEntries(
        libros.map((l: any) => [l.id, l.titulo ?? ""]),
      );
      return _libroMapCache!;
    }
  } catch {}
  return {};
}

/** Invalida la caché de libroMap (llamar tras crear/renombrar un libro). */
export function invalidateLibroMap(): void {
  _libroMapCache = null;
}
