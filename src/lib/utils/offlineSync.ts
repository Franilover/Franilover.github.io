import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";

// ─── Este archivo es código puro (sin React). ─────────────────────────────────
// Contiene la lógica de sincronización offline que antes vivía mezclada con el
// hook `useOfflineSync` en hooks/data/. Se movió aquí para respetar la regla de
// arquitectura: lib/ es agnóstico a React, hooks/ solo expone hooks.
// El hook React sigue disponible en @/hooks/data/useOfflineSync (re-exporta lo
// de aquí más el hook `useOfflineSync` en sí).

const SYNC_TABLES: Record<
  string,
  {
    supabaseTable: string;
    excludeFields?: string[];
  }
> = {
  notas: { supabaseTable: "notas", excludeFields: ["status", "deleted"] },
  ensayos: { supabaseTable: "ensayos", excludeFields: ["status", "deleted"] },
  secciones_cancion: {
    supabaseTable: "secciones_cancion",
    excludeFields: ["status", "deleted"],
  },
  capitulos: {
    supabaseTable: "capitulos",
    excludeFields: ["status", "deleted"],
  },
  tareas: { supabaseTable: "tareas", excludeFields: ["status", "deleted"] },
  eventos: { supabaseTable: "eventos", excludeFields: ["status", "deleted"] },
  rutinas: { supabaseTable: "rutinas", excludeFields: ["status", "deleted"] },
  ejercicios_rutina: {
    supabaseTable: "ejercicios_rutina",
    excludeFields: ["status", "deleted"],
  },
  recetas: { supabaseTable: "recetas", excludeFields: ["status", "deleted"] },
  ingredientes: {
    supabaseTable: "ingredientes",
    excludeFields: ["status", "deleted"],
  },
  compras: { supabaseTable: "compras", excludeFields: ["status", "deleted"] },
  ropa: { supabaseTable: "ropa", excludeFields: ["status", "deleted"] },
  ropa_outfits: {
    supabaseTable: "ropa_outfits",
    excludeFields: ["status", "deleted"],
  },
  diario_fotos: {
    supabaseTable: "diario_fotos",
    excludeFields: ["status", "deleted"],
  },
  dibujos: { supabaseTable: "dibujos", excludeFields: ["status", "deleted"] },
  personajes: {
    supabaseTable: "personajes",
    excludeFields: ["status", "deleted"],
  },
  criaturas: {
    supabaseTable: "criaturas",
    excludeFields: ["status", "deleted"],
  },
  criatura_variantes: {
    supabaseTable: "criatura_variantes",
    excludeFields: ["status", "deleted"],
  },
  items: { supabaseTable: "items", excludeFields: ["status", "deleted"] },
  reinos: { supabaseTable: "reinos", excludeFields: ["status", "deleted"] },
  relaciones: {
    supabaseTable: "relaciones",
    excludeFields: ["status", "deleted"],
  },
  // ─── Lore ────────────────────────────────────────────────────────────────────
  // "notas_lore" en Dexie corresponde a la tabla "notas" de Supabase (lore notes).
  // Se excluye "deleted" para que el soft-delete no se suba accidentalmente.
  notas_lore: { supabaseTable: "notas", excludeFields: ["deleted"] },
  // ─── EditorMundo: entidades migradas de useEntityList casero a useSupabaseData ──
  runas: { supabaseTable: "runas", excludeFields: ["status", "deleted"] },
  grupos_mundo: {
    supabaseTable: "grupos_mundo",
    excludeFields: ["status", "deleted"],
  },
  ciudades: { supabaseTable: "ciudades", excludeFields: ["status", "deleted"] },
  // ─── Fase 7: tabla puente unificada Órgano/Formación (reemplaza
  // planta_organos/criatura_organos/mineral_formaciones/item_estructura) ──
  estructura_componentes: {
    supabaseTable: "estructura_componentes",
    excludeFields: ["status", "deleted"],
  },
};

const MAX_RETRIES = 3;

const SYNC_DEBOUNCE_MS = 500;

// ─── Callbacks globales ───────────────────────────────────────────────────────
type SyncDoneCallback = () => void;

const syncDoneCallbacks = new Set<SyncDoneCallback>();

export function onSyncDone(cb: SyncDoneCallback): () => void {
  syncDoneCallbacks.add(cb);
  return () => syncDoneCallbacks.delete(cb);
}

function notifySyncDone() {
  for (const cb of syncDoneCallbacks) {
    try {
      cb();
    } catch {}
  }
}

// ─── Verificación real de conectividad ───────────────────────────────────────

export async function isReallyOnline(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    await fetch("/favicon.ico", {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    return true;
  } catch {
    return false;
  }
}

function cleanPayload(payload: any, exclude: string[] = []): any {
  const clean = { ...payload };
  for (const field of exclude) delete clean[field];
  return clean;
}

export async function dexiePut(table: string, data: any): Promise<void> {
  try {
    if (db) await (db as any)[table]?.put(data);
  } catch (e) {
    console.warn(`[Dexie] put failed on '${table}':`, e);
  }
}

export async function dexieUpdate(
  table: string,
  id: string | number,
  data: any,
): Promise<void> {
  try {
    if (db) await (db as any)[table]?.update(id, data);
  } catch (e) {
    console.warn(`[Dexie] update failed on '${table}':`, e);
  }
}

export async function dexieDelete(
  table: string,
  id: string | number,
): Promise<void> {
  try {
    if (db) await (db as any)[table]?.delete(id);
  } catch (e) {
    console.warn(`[Dexie] delete failed on '${table}':`, e);
  }
}

// ─── Estado global del sync (singleton) ──────────────────────────────────────
let globalSyncPromise: Promise<void> | null = null;
let lastSyncTime = 0;

let syncInFlight = false;

export async function runSync(): Promise<void> {
  if (globalSyncPromise) return globalSyncPromise;

  const now = Date.now();
  if (now - lastSyncTime < SYNC_DEBOUNCE_MS) return;

  if (syncInFlight) return;
  syncInFlight = true;

  let online = false;
  try {
    online = await isReallyOnline();
  } catch {
    online = false;
  } finally {
    if (!online) syncInFlight = false;
  }

  if (!online) return;

  lastSyncTime = Date.now();

  let needsRerun = false;

  globalSyncPromise = (async () => {
    try {
      const queue = await db.offline_queue.orderBy("timestamp").toArray();

      if (queue.length === 0) {
        notifySyncDone();
        return;
      }

      console.warn(
        `[Sync] Procesando ${queue.length} operaciones pendientes...`,
      );

      for (const op of queue) {
        const config = SYNC_TABLES[op.table];
        if (!config) {
          await db.offline_queue.delete(op.id!);
          continue;
        }

        try {
          let error: any = null;

          if (op.operation === "delete") {
            ({ error } = await supabase
              .from(config.supabaseTable)
              .delete()
              .eq("id", op.recordId));
            if (!error) {
              try {
                await (db as any)[op.table]?.delete(op.recordId);
              } catch {}
            }
          } else if (op.operation === "upsert") {
            ({ error } = await supabase
              .from(config.supabaseTable)
              .upsert(cleanPayload(op.payload, config.excludeFields)));
          } else if (op.operation === "update") {
            ({ error } = await supabase
              .from(config.supabaseTable)
              .update(cleanPayload(op.payload, config.excludeFields))
              .eq("id", op.recordId));
          }

          if (error) throw error;

          try {
            const table = (db as any)[op.table];
            if (table && op.operation !== "delete") {
              await table.update(op.recordId, { status: "synced" });
            }
          } catch {}

          await db.offline_queue.delete(op.id!);
          console.warn(`[Sync] ✓ ${op.table}/${op.recordId}`);
        } catch (_err: any) {
          const retries = (op.retries ?? 0) + 1;
          if (retries >= MAX_RETRIES) {
            console.warn(
              `[Sync] ✗ Descartando ${op.table}/${op.recordId} tras ${MAX_RETRIES} intentos`,
            );
            await db.offline_queue.delete(op.id!);
          } else {
            await db.offline_queue.update(op.id!, { retries });
          }
        }
      }

      notifySyncDone();

      const remaining = await db.offline_queue.count();
      if (remaining > 0) needsRerun = true;
    } finally {
      globalSyncPromise = null;
      syncInFlight = false;

      if (needsRerun) {
        setTimeout(() => runSync(), SYNC_DEBOUNCE_MS + 100);
      }
    }
  })();

  return globalSyncPromise;
}

// ─── Encolar operación con deduplicación ──────────────────────────────────────

export async function enqueueOperation(
  table: string,
  operation: "upsert" | "update" | "delete",
  recordId: string,
  payload?: any,
): Promise<void> {
  try {
    const existing = await db.offline_queue
      .where("recordId")
      .equals(recordId)
      .and((op) => op.table === table && op.operation === operation)
      .toArray();

    if (existing.length > 0) {
      await db.offline_queue.update(existing[0].id!, {
        payload: payload ?? {},
        timestamp: Date.now(),
        retries: 0,
      });
      console.warn(
        `[Queue] Actualizado (dedup): ${operation} en ${table}/${recordId}`,
      );
      return;
    }

    await db.offline_queue.add({
      table,
      operation,
      recordId,
      payload: payload ?? {},
      timestamp: Date.now(),
      retries: 0,
    });
    console.warn(`[Queue] Encolado: ${operation} en ${table}/${recordId}`);
  } catch (e) {
    console.error(
      `[Queue] Error al encolar ${operation} en ${table}/${recordId}:`,
      e,
    );
    throw e;
  }
}

export async function getPendingCount(): Promise<number> {
  return await db.offline_queue.count();
}
