/**
 * dexieHelpers.ts
 * ─────────────────
 * Helpers genéricos para leer/escribir en Dexie (IndexedDB local),
 * usados como caché offline-first antes/después de las queries a Supabase.
 *
 * Ruta destino:
 *   src/lib/utils/dexieHelpers.ts
 */

import { db } from "@/infra/supabase/db";

export async function dexiePut(tabla: string, row: any): Promise<void> {
  try {
    if (db) await (db as any)[tabla]?.put(row);
  } catch {}
}

export async function dexieDelete(tabla: string, id: string): Promise<void> {
  try {
    if (db) await (db as any)[tabla]?.delete(id);
  } catch {}
}

export async function dexieReadAll<T>(tabla: string): Promise<T[]> {
  try {
    if (!db) return [];
    const t = (db as any)[tabla];
    if (!t) return [];
    return ((await t.toArray()) as any[]).filter((r: any) => !r.deleted) as T[];
  } catch {
    return [];
  }
}

export async function dexieWriteAll(tabla: string, rows: any[]): Promise<void> {
  try {
    if (!db) return;
    const t = (db as any)[tabla];
    if (!t) return;
    if (rows.length > 0) await t.bulkPut(rows);
    const remoteIds = new Set(rows.map((r: any) => r.id));
    const local: any[] = await t.toArray();
    const toDelete = local
      .map((r: any) => r.id)
      .filter((id: string) => !remoteIds.has(id));
    if (toDelete.length > 0) await t.bulkDelete(toDelete);
  } catch {}
}

/**
 * Lee relaciones N:N locales (Dexie), detectando dinámicamente si la tabla
 * indexa por "personaje_id" o "criatura_id" (mismas tablas se reusan para
 * personajes y criaturas, p.ej. personaje_hechizos / personaje_dones).
 */
export async function loreReadRelaciones(
  tabla: string,
  entidadId: string,
  foreignKey: string,
): Promise<string[]> {
  try {
    if (!db) return [];
    const t = (db as any)[tabla];
    if (!t) return [];
    const searchKey = t.schema.indexes.some(
      (i: any) => i.name === "personaje_id",
    )
      ? "personaje_id"
      : "criatura_id";

    const rows = await t.where(searchKey).equals(entidadId).toArray();
    return rows.map((r: any) => r[foreignKey]);
  } catch {
    return [];
  }
}

/**
 * Sincroniza relaciones N:N locales (Dexie) con la lista de IDs remotos:
 * borra todas las filas existentes para la entidad y reinserta las actuales.
 */
export async function loreSyncRelaciones(
  tabla: string,
  entidadId: string,
  foreignKey: string,
  remoteIds: string[],
): Promise<void> {
  try {
    if (!db) return;
    const t = (db as any)[tabla];
    if (!t) return;
    const searchKey = t.schema.indexes.some(
      (i: any) => i.name === "personaje_id",
    )
      ? "personaje_id"
      : "criatura_id";

    await t.where(searchKey).equals(entidadId).delete();
    for (const id of remoteIds) {
      await t.put({ [searchKey]: entidadId, [foreignKey]: id });
    }
  } catch (e) {
    console.error(`Error sincronizando relaciones locales en ${tabla}:`, e);
  }
}
