import { enqueueOperation } from "@/infra/sync/useOfflineSync";
import { db } from "@/infra/supabase/db";
import { cancionesQueries } from "@/domains/garlia/canciones/queries";

import { TABLA_SEC } from "./constants";
import type { Seccion } from "./types";

// ── Dexie helpers ────────────────────────────────────────────────────────────

export async function dexieSecRead(cancionId: string): Promise<Seccion[]> {
  try {
    const table = (db as any)[TABLA_SEC];
    if (!table) return [];
    const rows = (await table.toArray()) as Seccion[];
    return rows
      .filter((r: any) => r.cancion_id === cancionId && !r.deleted)
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  } catch { return []; }
}

export async function dexieSecWrite(rows: any[]): Promise<void> {
  try {
    const table = (db as any)[TABLA_SEC];
    if (!table || rows.length === 0) return;
    await table.bulkPut(rows);
  } catch (e) { console.warn("[Dexie] secciones_cancion:", e); }
}

export async function dexieSecDelete(id: string): Promise<void> {
  try {
    const table = (db as any)[TABLA_SEC];
    if (!table) return;
    await table.delete(id);
  } catch {}
}

export async function dexieSecGet(id: string): Promise<any> {
  try { return await (db as any)[TABLA_SEC]?.get(id); } catch { return null; }
}

// ── Section CRUD ─────────────────────────────────────────────────────────────

export async function secUpdate(id: string, updates: Partial<Seccion>): Promise<void> {
  if (!navigator.onLine) {
    const existing = await dexieSecGet(id);
    const row = { ...existing, ...updates, id, status: "pending" };
    await dexieSecWrite([row]);
    await enqueueOperation(TABLA_SEC, "update", id, row);
    return;
  }
  try {
    const updated = await cancionesQueries.secciones.update(id, updates as any);
    await dexieSecWrite([{ ...updated, status: "synced" }]);
  } catch {
    const existing = await dexieSecGet(id);
    const row = { ...existing, ...updates, id, status: "pending" };
    await dexieSecWrite([row]);
    await enqueueOperation(TABLA_SEC, "update", id, row);
    throw new Error("Sin conexión — cambio guardado localmente");
  }
}

export async function secCreate(datos: Omit<Seccion, "id">): Promise<Seccion> {
  if (!navigator.onLine) {
    const tmpId = crypto.randomUUID();
    const row = { ...datos, id: tmpId, status: "pending" };
    await dexieSecWrite([row]);
    await enqueueOperation(TABLA_SEC, "upsert", tmpId, row);
    return row as Seccion;
  }
  try {
    const nueva = await cancionesQueries.secciones.create(datos as any);
    await dexieSecWrite([{ ...nueva, status: "synced" }]);
    return nueva as Seccion;
  } catch {
    const tmpId = crypto.randomUUID();
    const row = { ...datos, id: tmpId, status: "pending" };
    await dexieSecWrite([row]);
    await enqueueOperation(TABLA_SEC, "upsert", tmpId, row);
    return row as Seccion;
  }
}

export async function secDelete(id: string): Promise<void> {
  if (!navigator.onLine) {
    const existing = await dexieSecGet(id);
    if (existing) await dexieSecWrite([{ ...existing, deleted: true, status: "pending" }]);
    await enqueueOperation(TABLA_SEC, "delete", id);
    return;
  }
  try {
    await cancionesQueries.secciones.delete(id);
    await dexieSecDelete(id);
  } catch {
    const existing = await dexieSecGet(id);
    if (existing) await dexieSecWrite([{ ...existing, deleted: true, status: "pending" }]);
    await enqueueOperation(TABLA_SEC, "delete", id);
    throw new Error("Sin conexión — eliminación en cola");
  }
}

export async function secReorder(secciones: { id: string; orden: number }[]): Promise<void> {
  if (!navigator.onLine) {
    for (const { id, orden } of secciones) {
      const existing = await dexieSecGet(id);
      if (existing) {
        await dexieSecWrite([{ ...existing, orden, status: "pending" }]);
        await enqueueOperation(TABLA_SEC, "update", id, { orden });
      }
    }
    return;
  }
  try {
    await cancionesQueries.secciones.reorder(secciones);
    for (const { id, orden } of secciones) {
      const existing = await dexieSecGet(id);
      if (existing) await dexieSecWrite([{ ...existing, orden, status: "synced" }]);
    }
  } catch {
    for (const { id, orden } of secciones) {
      const existing = await dexieSecGet(id);
      if (existing) {
        await dexieSecWrite([{ ...existing, orden, status: "pending" }]);
        await enqueueOperation(TABLA_SEC, "update", id, { orden });
      }
    }
  }
}