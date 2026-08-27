"use client";
import { useState, useEffect, useCallback, useRef } from "react";

import {
  enqueueOperation,
  isReallyOnline,
  onSyncDone,
} from "@/infra/sync/useOfflineSync";
import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";
import { cancionesQueries } from "@/domains/garlia/canciones/queries";
import { criaturasQueries } from "@/domains/garlia/criaturas/queries";
import { itemsQueries } from "@/domains/garlia/items/queries";
import { librosQueries } from "@/domains/garlia/libros/queries";
import { personajesQueries } from "@garlia/personajes";
import { comprasQueries } from "@/lib/api/queries/personal/cocina/carrito";
import { ingredientesQueries } from "@/lib/api/queries/personal/cocina/ingredientes";
import { recetasQueries } from "@/lib/api/queries/personal/cocina/recetas";
import { eventosQueries } from "@/lib/api/queries/personal/eventos";
import { ropaQueries } from "@/lib/api/queries/personal/ropa";
import { tareasQueries } from "@/lib/api/queries/personal/tareas";
import { useDataCache } from "@/providers/DataProvider";

// ─── Constantes ───────────────────────────────────────────────────────────────
const FETCH_TIMEOUT_MS = 12_000;
const UPDATE_TIMEOUT_MS = 10_000;
// FIX #4: bajado de 30s → 15s para detectar pérdida de canal más rápido
const REVALIDATE_THROTTLE_MS = 15_000;
const RETRY_POLLING_MS = 30_000;
// FIX #1: delay antes de reconectar el canal tras un error
const CHANNEL_RECONNECT_MS = 5_000;

const QUERIES_MAP: Record<string, any> = {
  personajes: personajesQueries,
  criaturas: criaturasQueries,
  items: itemsQueries,
  libros: librosQueries,
  recetas: recetasQueries,
  tareas: tareasQueries,
  eventos: eventosQueries,
  ingredientes: ingredientesQueries,
  ropa: ropaQueries,
  ropa_outfits: ropaQueries,
  canciones: cancionesQueries,
  compras: comprasQueries,
};

const DEXIE_TABLES = new Set([
  "personajes",
  "criaturas",
  "criatura_variantes",
  "items",
  "libros",
  "canciones",
  "reinos",
  "relaciones",
  "secciones_cancion",
  "capitulos",
  "tareas",
  "eventos",
  "recetas",
  "ingredientes",
  "ropa",
  "ropa_outfits",
  "diario_fotos",
  "dibujos",
  "compras",
  "notas",
  "ensayos",
  "rutinas",
  "ejercicios_rutina",
  "reino_detalles",
  "notas_lore",
  // ─── EditorMundo: migradas de useEntityList casero ──────────────────────────
  "runas",
  "grupos_mundo",
  "ciudades",
  // ─── EditorMundo: Química, Física, Biología (antes sin cache local) ─────────
  "elementos",
  "compuestos",
  "oris",
  "particulas",
  "particulas_base",
  "iums",
  "fisica_conceptos",
  "biomas",
  "clados",
  "ecosistemas",
  "cadenas_alimenticias",
  "perfiles_atomicos_criatura",
  // ─── Órganos/Formaciones y su jerarquía de composición (Célula/Tejido,
  // Grano/Veta) + Reacciones — ver v33 en infra/supabase/db.ts ────────────
  "organos",
  "formaciones",
  "celulas",
  "tejidos",
  "granos",
  "vetas",
  "organo_tejidos",
  "formacion_vetas",
  "reacciones",
  "planta_organos",
  "criatura_organos",
  "mineral_formaciones",
  "item_estructura",
  // ─── Fase 2/3 del rediseño 1.0: tablas relacionales que reemplazan a los
  // jsonb legado (compuestos.componentes) como fuente de lectura — ver
  // v34 en infra/supabase/db.ts, useCompuestosConElementos, useOrisConIums ──
  "compuesto_elementos",
  "oris_iums",
  "fenomenos",
  // ─── Fases 4-7 del rediseño 1.0 — ver v35 en infra/supabase/db.ts ────────
  "estructura_componentes",
  "organismos",
  "sistemas",
  "sistema_organos",
  "organismo_sistemas",
  "reaccion_componentes",
  "procesos",
  "proceso_reacciones",
  "fenomeno_procesos",
  "fenomeno_elementos",
  // ─── v36: minerales/flora, cache que faltaba desde antes de Fase 8 ──────
  "minerales",
  // "flora" (legacy) removida 2026-08-26: migrada a "organismos"
  // (tipo_organismo='vegetal'), ya listada arriba.
  // ─── v37: mineral_reacciones (Procesos de un Mineral) ───────────────────
  "mineral_reacciones",
  // ─── v38: panel de auditoría (domains/garlia/auditoria) — vistas de SOLO
  // LECTURA (prefijo v_), cacheadas para que abrir el panel no dependa del
  // round-trip completo a Supabase cada vez. A propósito NO están en
  // OFFLINE_WRITABLE más abajo: son vistas derivadas, no se editan.
  "v_auditoria_compuestos_derivacion",
  "v_auditoria_elementos_derivacion",
  // ─── v39: paneles de abajo de los editores flotantes (Sitios de enlace,
  // Estabilidad, Enlaces reales) — ver infra/supabase/db.ts. Solo lectura,
  // por eso NO están en OFFLINE_WRITABLE más abajo.
  "compuesto_estabilidad",
  "compuesto_enlaces",
  "enlace_sitios",
  "elemento_sitios_enlace",
]);

const OFFLINE_WRITABLE = new Set([
  "ensayos",
  "secciones_cancion",
  "capitulos",
  "libros",
  "tareas",
  "eventos",
  "rutinas",
  "ejercicios_rutina",
  "recetas",
  "ingredientes",
  "compras",
  "ropa",
  "ropa_outfits",
  "diario_fotos",
  "dibujos",
  "personajes",
  "criaturas",
  "criatura_variantes",
  "items",
  "reinos",
  "relaciones",
  "notas_lore",
  // ─── EditorMundo: migradas de useEntityList casero ──────────────────────────
  "runas",
  "grupos_mundo",
  "ciudades",
  // ─── EditorMundo: Química, Física, Biología (antes sin cache local) ─────────
  "elementos",
  "compuestos",
  "oris",
  "particulas",
  "particulas_base",
  "iums",
  "fisica_conceptos",
  "biomas",
  "clados",
  "ecosistemas",
  "cadenas_alimenticias",
  "perfiles_atomicos_criatura",
  // ─── Órganos/Formaciones y su jerarquía de composición (Célula/Tejido,
  // Grano/Veta) + Reacciones — ver v33 en infra/supabase/db.ts ────────────
  "organos",
  "formaciones",
  "celulas",
  "tejidos",
  "granos",
  "vetas",
  "organo_tejidos",
  "formacion_vetas",
  "reacciones",
  "planta_organos",
  "criatura_organos",
  "mineral_formaciones",
  "item_estructura",
  // ─── Fase 2/3 del rediseño 1.0 (ver v34 en infra/supabase/db.ts) ────────────
  "compuesto_elementos",
  "oris_iums",
  "fenomenos",
  // ─── Fases 4-7 del rediseño 1.0 (ver v35 en infra/supabase/db.ts) ───────────
  "estructura_componentes",
  "organismos",
  "sistemas",
  "sistema_organos",
  "organismo_sistemas",
  "reaccion_componentes",
  "procesos",
  "proceso_reacciones",
  "fenomeno_procesos",
  "fenomeno_elementos",
  // ─── v36: minerales/flora ────────────────────────────────────────────────
  "minerales",
  // "flora" (legacy) removida 2026-08-26: migrada a "organismos".
  // ─── v37: mineral_reacciones ─────────────────────────────────────────────
  "mineral_reacciones",
]);

// Tablas con ID numérico autogenerado por la DB — no se pueden crear offline
const NUMERIC_ID_TABLES = new Set(["diario_fotos", "dibujos"]);

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface UseSupabaseOptions {
  select?: string;
  order?: { campo: string; asc?: boolean };
  isAdmin?: boolean;
  /** Para tablas con getAll() propio (QUERIES_MAP): pide la variante
   *  liviana de la query cuando el consumidor solo necesita metadata
   *  (ej. listas/selectores) y no relaciones anidadas pesadas. */
  lite?: boolean;
  [key: string]: any;
}

// ─── Helpers puros (fuera del hook para no recrearse) ─────────────────────────
function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function isNetworkError(err: any): boolean {
  if (err?.name === "AbortError") return true;
  const msg = (err?.message ?? "").toLowerCase();
  return (
    msg === "failed to fetch" ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("network error") ||
    (msg.includes("timeout") && !msg.includes("update timeout"))
  );
}

async function getDexieRow(tabla: string, id: string | number): Promise<any> {
  try {
    if (!db || !DEXIE_TABLES.has(tabla)) return null;
    return (await (db as any)[tabla]?.get(id)) ?? null;
  } catch {
    return null;
  }
}

async function readFromDexie<T>(tabla: string): Promise<T[]> {
  try {
    if (!db || !DEXIE_TABLES.has(tabla)) return [];
    const table = (db as any)[tabla];
    if (!table) return [];
    const rows = (await table.toArray()) as any[];
    return rows.filter((r: any) => !r.deleted) as T[];
  } catch {
    return [];
  }
}

async function writeToDexie(tabla: string, rows: any[]): Promise<void> {
  try {
    if (!db || !DEXIE_TABLES.has(tabla) || rows.length === 0) return;
    const table = (db as any)[tabla];
    if (!table) return;
    await table.bulkPut(rows);
  } catch (e) {
    console.warn(`[Dexie] No se pudo guardar en '${tabla}':`, e);
  }
}

async function syncDexieWithRemote(
  tabla: string,
  remoteRows: any[],
): Promise<void> {
  try {
    if (!db || !DEXIE_TABLES.has(tabla)) return;
    const table = (db as any)[tabla];
    if (!table) return;
    const localRows: any[] = await table.toArray();
    const pendingIds = new Set(
      localRows
        .filter((r: any) => r.status === "pending")
        .map((r: any) => String(r.id)),
    );
    const remoteIds = new Set(remoteRows.map((r: any) => String(r.id)));
    const toUpsert = remoteRows
      .filter((r: any) => !pendingIds.has(String(r.id)))
      .map((r: any) => ({ ...r, status: "synced" }));
    if (toUpsert.length > 0) await table.bulkPut(toUpsert);
    const hasSynced = localRows.some((r: any) => r.status !== "pending");
    if (remoteRows.length === 0 && hasSynced) return;
    const toDelete = localRows
      .filter(
        (r: any) => !remoteIds.has(String(r.id)) && r.status !== "pending",
      )
      .map((r: any) => r.id);
    if (toDelete.length > 0) await table.bulkDelete(toDelete);
  } catch (e) {
    console.warn(`[Dexie] No se pudo sincronizar '${tabla}':`, e);
  }
}

function mergeWithPending<T>(remoteData: T[], localData: T[]): T[] {
  const pendingRows = localData.filter((r: any) => r.status === "pending");
  if (pendingRows.length === 0) return remoteData;
  const pendingIds = new Set(pendingRows.map((r: any) => String(r.id)));
  return [
    ...remoteData.filter((r: any) => !pendingIds.has(String(r.id))),
    ...pendingRows,
  ] as T[];
}

function makePendingRow(
  id: string | number,
  updates: any,
  existing: any = null,
  extra: Record<string, any> = {},
): Record<string, any> {
  return { ...(existing ?? {}), ...updates, ...extra, id, status: "pending" };
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout`)), ms),
    ),
  ]);
}

function clearTimer(
  ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
): void {
  if (ref.current) {
    clearTimeout(ref.current);
    ref.current = null;
  }
}

// ─── Hook principal ───────────────────────────────────────────────────────────
export function useSupabaseData<T = any>(
  tabla: string,
  opciones: UseSupabaseOptions = {},
) {
  const { cache, updateCache } = useDataCache();
  const [data, setData] = useState<T[]>(cache[tabla] ?? []);
  const [loading, setLoading] = useState(tabla !== "__skip__");
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const isMounted = useRef(true);
  const retryCount = useRef(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFetchRef = useRef<number>(0);
  const lastVisibleRef = useRef<number>(Date.now());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // FIX #1: ref para el timer de reconexión del canal
  const channelReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const optionsRef = useRef<UseSupabaseOptions>(opciones);
  useEffect(() => {
    optionsRef.current = opciones;
  });
  const fetchGenRef = useRef(0);
  // Eco del propio updateRow: guarda, por id, el timestamp del último
  // updateRow() disparado desde ESTE hook. Un refetch (manual o gatillado
  // por el canal realtime, que se activa con CUALQUIER escritura — incluida
  // la nuestra) que llega dentro de este umbral para un id que acabamos de
  // escribir se considera nuestro propio eco: se preserva el snapshot local
  // (que ya tiene los cambios) en vez de reemplazarlo por lo que devolvió
  // el servidor. Sin esto, tablas con autoguardado en cada tecla (ej.
  // RichEditor + persist en fisica_conceptos) entran en un ciclo escribir→
  // UPDATE→evento realtime→fetchData→setData con datos potencialmente algo
  // más viejos que lo que el usuario ya tecleó→React resetea el estado
  // controlado del editor→el cursor salta al inicio, y se repite en cada
  // letra porque cada letra dispara un nuevo UPDATE.
  const recentLocalWritesRef = useRef<Map<string, number>>(new Map());
  const RECENT_WRITE_ECHO_MS = 4_000;

  // ─── fetchData ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!isMounted.current || tabla === "__skip__") return;
    setError(null);

    // Cada invocación toma su propia generación. Si cuando resuelve el await
    // hay una llamada más nueva en vuelo, descartamos silenciosamente el resultado.
    const myGen = ++fetchGenRef.current;
    const isStale = () => fetchGenRef.current !== myGen || !isMounted.current;

    const localData = await readFromDexie<T>(tabla);
    const hasLocalData = localData.length > 0;
    if (isStale()) return;

    if (hasLocalData) {
      setData(localData);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // Con datos locales no esperamos el ping — el fetch falla solo si hay error de red.
    // Sin datos locales hacemos el ping para no colgar con loading=true sin internet.
    if (!hasLocalData) {
      const online = await isReallyOnline();
      if (isStale()) return;
      if (!online) {
        setLoading(false);
        setIsOffline(true);
        return;
      }
    }

    setIsOffline(false);

    try {
      const opts = optionsRef.current;
      const fetchPromise = (): Promise<any> => {
        if (QUERIES_MAP[tabla]) {
          // Los *Queries.getAll(orden) de @/lib/api/queries esperan
          // directamente { campo, asc } — no el objeto `opts` completo
          // (que tiene `order` anidado y además `select`, que estas
          // queries no usan porque ya tienen su propio select fijo).
          // Pasar `opts` tal cual produce `.order(undefined, ...)`.
          //
          // isAdmin SÍ se reenvía: algunas queries (ej. librosQueries.getAll)
          // usan ese flag para saltarse el filtro de visibilidad ("publico").
          // Antes se perdía acá porque solo pasábamos {campo, asc}.
          const orden = opts.order
            ? { campo: opts.order.campo, asc: opts.order.asc ?? true }
            : undefined;
          let args: Record<string, any> | undefined = orden;
          if (opts.isAdmin !== undefined) {
            args = { ...(args ?? {}), isAdmin: opts.isAdmin };
          }
          // `lite` SÍ se reenvía: para tablas con getAll() que por defecto
          // traen relaciones anidadas pesadas (ej. librosQueries.getAll trae
          // libros + TODOS sus capitulos con contenido completo), algunos
          // consumidores solo necesitan metadata para listas/selectores —
          // ahí pasan lite:true y la query se salta el contenido pesado.
          if (opts.lite !== undefined) {
            args = { ...(args ?? {}), lite: opts.lite };
          }
          return args
            ? QUERIES_MAP[tabla].getAll(args)
            : QUERIES_MAP[tabla].getAll();
        }
        let query = supabase.from(tabla).select(opts.select ?? "*");
        if (opts.order) {
          query = query.order(opts.order.campo, {
            ascending: opts.order.asc ?? true,
          });
        }
        return query as unknown as Promise<any>;
      };

      clearTimer(fetchTimeoutRef);
      const result = await Promise.race([
        fetchPromise(),
        new Promise<"timeout">((resolve) => {
          fetchTimeoutRef.current = setTimeout(
            () => resolve("timeout"),
            FETCH_TIMEOUT_MS,
          );
        }),
      ]);
      clearTimer(fetchTimeoutRef);

      // Si mientras esperábamos llegó una llamada más nueva, descartar
      if (isStale()) return;

      if (result === "timeout") {
        setLoading(false);
        setIsOffline(true);
        clearTimer(retryTimerRef);
        retryTimerRef.current = setTimeout(
          () => {
            if (isMounted.current) void fetchData();
          },
          hasLocalData ? 15_000 : 8_000,
        );
        return;
      }

      const res = result as any;
      const finalData = Array.isArray(res) ? res : (res?.data ?? []);
      if (res?.error) throw res.error;

      // Re-leer pending desde Dexie en este momento, no usar el snapshot viejo
      const freshLocal = await readFromDexie<T>(tabla);
      if (isStale()) return;

      let merged = mergeWithPending<T>(finalData, freshLocal);

      // Preservar filas que escribimos nosotros mismos hace muy poco (ver
      // recentLocalWritesRef arriba): si el server todavía no propagó ese
      // cambio exacto (o lo hizo pero el usuario ya siguió escribiendo
      // después), no queremos pisar el estado local con una versión
      // potencialmente más vieja solo porque el canal realtime nos avisó
      // de "algún" cambio en la tabla.
      const recentWrites = recentLocalWritesRef.current;
      if (recentWrites.size > 0) {
        const now = Date.now();
        setData((prevData) => {
          const prevById = new Map(
            (prevData as any[]).map((r) => [String(r.id), r]),
          );
          merged = merged.map((row: any) => {
            const writtenAt = recentWrites.get(String(row.id));
            if (
              writtenAt !== undefined &&
              now - writtenAt < RECENT_WRITE_ECHO_MS &&
              prevById.has(String(row.id))
            ) {
              return prevById.get(String(row.id));
            }
            return row;
          });
          return merged;
        });
      } else {
        setData(merged);
      }
      updateCache(tabla, merged);
      retryCount.current = 0;
      lastFetchRef.current = Date.now();
      setLoading(false);
      setIsOffline(false);
      syncDexieWithRemote(tabla, finalData).catch(() => {});
    } catch (err: any) {
      clearTimer(fetchTimeoutRef);
      if (isStale()) return;

      if (isNetworkError(err) && retryCount.current < 5) {
        retryCount.current++;
        const delay = Math.min(2000 * 2 ** (retryCount.current - 1), 32_000);
        clearTimer(retryTimerRef);
        retryTimerRef.current = setTimeout(() => {
          if (isMounted.current) void fetchData();
        }, delay);
        if (!hasLocalData) setLoading(false);
        setIsOffline(true);
        return;
      }

      if (!hasLocalData) setError(err.message);
      if (isNetworkError(err)) setIsOffline(true);
      setLoading(false);
    }
  }, [tabla, updateCache]);

  // ─── Mutaciones ──────────────────────────────────────────────────────────────
  const addRow = useCallback(
    async (newData: any) => {
      const online = await isReallyOnline();
      if (!online) {
        if (NUMERIC_ID_TABLES.has(tabla)) {
          return {
            data: null,
            error: "Esta tabla requiere conexión para crear registros.",
          };
        }
        if (OFFLINE_WRITABLE.has(tabla)) {
          const id = newData.id ?? generateUUID();
          const row = makePendingRow(id, newData);
          await writeToDexie(tabla, [row]);
          try {
            await enqueueOperation(tabla, "upsert", String(id), row);
          } catch {
            console.error(`[addRow] No se pudo encolar upsert ${tabla}/${id}`);
          }
          setData((prev) => [...prev, row as any]);
          return { data: row, error: null };
        }
        return { data: null, error: "Sin conexión" };
      }
      try {
        const res = QUERIES_MAP[tabla]?.create
          ? await QUERIES_MAP[tabla].create(newData)
          : await supabase.from(tabla).insert([newData]).select().single();
        if (res?.error) return { data: null, error: res.error };
        const created = res?.data ?? res;
        if (created?.id) {
          void writeToDexie(tabla, [{ ...created, status: "synced" }]);
          setData((prev) => [...prev, { ...created, status: "synced" } as any]);
        }
        return { data: created, error: null };
      } catch (err: any) {
        if (OFFLINE_WRITABLE.has(tabla) && !NUMERIC_ID_TABLES.has(tabla)) {
          const id = newData.id ?? generateUUID();
          const row = makePendingRow(id, newData);
          await writeToDexie(tabla, [row]);
          try {
            await enqueueOperation(tabla, "upsert", String(id), row);
          } catch {}
          setData((prev) => [...prev, row as any]);
          return { data: row, error: null };
        }
        return { data: null, error: err.message };
      }
    },
    [tabla],
  );

  const updateRow = useCallback(
    async (id: string | number, updates: any) => {
      // Marcar ANTES del await: un evento realtime disparado por esta
      // misma escritura puede llegar (y resolver su fetchData) antes de
      // que updateRow() termine — el guard tiene que estar activo desde
      // el momento en que decidimos escribir, no desde que confirmamos.
      recentLocalWritesRef.current.set(String(id), Date.now());
      // Poda oportunista de entradas vencidas para no acumular memoria en
      // sesiones largas con muchas ediciones.
      for (const [key, ts] of recentLocalWritesRef.current) {
        if (Date.now() - ts > RECENT_WRITE_ECHO_MS) {
          recentLocalWritesRef.current.delete(key);
        }
      }

      const online = await isReallyOnline();
      if (!online && OFFLINE_WRITABLE.has(tabla)) {
        const existing = await getDexieRow(tabla, id);
        const row = makePendingRow(id, updates, existing);
        await writeToDexie(tabla, [row]);
        try {
          await enqueueOperation(tabla, "update", String(id), row);
        } catch {}
        setData((prev) => prev.map((r: any) => (r.id === id ? row : r)));
        return { data: row, error: null };
      }
      try {
        const updatePromise = QUERIES_MAP[tabla]?.update
          ? QUERIES_MAP[tabla].update(id, updates)
          : supabase.from(tabla).update(updates).eq("id", id).select().single();
        const res = await withTimeout(
          updatePromise,
          UPDATE_TIMEOUT_MS,
          "update",
        );
        if ((res as any)?.error)
          return { data: null, error: (res as any).error };
        const updated = (res as any)?.data ?? null;
        const savedData = updated ?? { id, ...updates };
        if (savedData?.id !== undefined) {
          void writeToDexie(tabla, [{ ...savedData, status: "synced" }]);
          setData((prev) =>
            prev.map((r: any) => (r.id === id ? { ...r, ...savedData } : r)),
          );
        }
        return { data: updated, error: null };
      } catch (err: any) {
        if (OFFLINE_WRITABLE.has(tabla)) {
          const existing = await getDexieRow(tabla, id);
          const row = makePendingRow(id, updates, existing);
          await writeToDexie(tabla, [row]);
          try {
            await enqueueOperation(tabla, "update", String(id), row);
          } catch {}
          setData((prev) => prev.map((r: any) => (r.id === id ? row : r)));
          return { data: row, error: null };
        }
        return { data: null, error: err.message };
      }
    },
    [tabla],
  );

  const deleteRow = useCallback(
    async (id: string | number) => {
      const online = await isReallyOnline();
      const offlineDelete = async () => {
        const existing = await getDexieRow(tabla, id);
        if (existing) {
          await writeToDexie(tabla, [
            makePendingRow(id, {}, existing, { deleted: true }),
          ]);
        }
        try {
          await enqueueOperation(tabla, "delete", String(id));
        } catch {}
        setData((prev) => prev.filter((r: any) => r.id !== id));
        return { error: null };
      };
      if (!online && OFFLINE_WRITABLE.has(tabla)) return offlineDelete();
      try {
        const res = QUERIES_MAP[tabla]?.delete
          ? await QUERIES_MAP[tabla].delete(id)
          : await supabase.from(tabla).delete().eq("id", id);
        if (!res?.error) {
          setData((prev) => prev.filter((r: any) => r.id !== id));
          try {
            if (db && DEXIE_TABLES.has(tabla))
              await (db as any)[tabla]?.delete(id);
          } catch {}
        }
        return { error: res?.error ?? null };
      } catch (err: any) {
        if (OFFLINE_WRITABLE.has(tabla)) return offlineDelete();
        return { error: err.message };
      }
    },
    [tabla],
  );

  // ─── Realtime ─────────────────────────────────────────────────────────────
  const subscribeChannel = useCallback(() => {
    // Limpiar canal anterior si existe
    if (channelRef.current) {
      const old = channelRef.current;
      channelRef.current = null;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      supabase.removeChannel(old).catch(() => {});
    }
    // FIX #1: cancelar cualquier reconexión pendiente para evitar duplicados
    if (channelReconnectRef.current) {
      clearTimeout(channelReconnectRef.current);
      channelReconnectRef.current = null;
    }
    if (!isMounted.current) return;

    const channel = supabase
      .channel(`rt-${tabla}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: tabla },
        () => {
          void fetchData();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Canal activo: parar polling de respaldo si estaba corriendo
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          return;
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          // FIX #1: activar polling de respaldo mientras se reconecta
          if (!pollingRef.current) {
            pollingRef.current = setInterval(() => {
              if (isMounted.current) void fetchData();
            }, RETRY_POLLING_MS);
          }
          // FIX #1: destruir el canal muerto y reconectar tras un delay
          // (evitar reconexión inmediata infinita)
          if (!channelReconnectRef.current) {
            channelReconnectRef.current = setTimeout(() => {
              channelReconnectRef.current = null;
              if (isMounted.current) subscribeChannel();
            }, CHANNEL_RECONNECT_MS);
          }
        }
      });
    channelRef.current = channel;
  }, [tabla, fetchData]);

  // ─── Efectos ─────────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    void fetchData();
    subscribeChannel();

    const unsubSyncDone = onSyncDone(() => {
      if (isMounted.current)
        setTimeout(() => {
          if (isMounted.current) void fetchData();
        }, 800);
    });

    const handleOnline = async () => {
      retryCount.current = 0;
      clearTimer(retryTimerRef);
      const online = await isReallyOnline();
      if (!online || !isMounted.current) return;
      setIsOffline(false);
      subscribeChannel();
      setTimeout(() => {
        if (isMounted.current) void fetchData();
      }, 1_000);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        const sinceFetch = now - lastFetchRef.current;

        // FIX #2: reconectar el canal SIEMPRE al volver a la pestaña
        // (es barato si ya está SUBSCRIBED; si está muerto, lo revive)
        subscribeChannel();

        // FIX #4: refetch si pasaron más de 15s desde el último fetch
        if (sinceFetch > REVALIDATE_THROTTLE_MS) {
          retryCount.current = 0;
          setTimeout(() => {
            if (isMounted.current) void fetchData();
          }, 500);
        }

        lastVisibleRef.current = now;
      } else {
        lastVisibleRef.current = Date.now();
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted.current = false;
      clearTimer(retryTimerRef);
      clearTimer(fetchTimeoutRef);
      clearTimer(updateTimeoutRef);
      // FIX #1: limpiar el timer de reconexión del canal al desmontar
      if (channelReconnectRef.current) {
        clearTimeout(channelReconnectRef.current);
        channelReconnectRef.current = null;
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current).catch(() => {});
        channelRef.current = null;
      }
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      unsubSyncDone();
    };
  }, [tabla, fetchData, subscribeChannel]);

  return {
    data,
    setData,
    loading,
    error,
    isOffline,
    refetch: fetchData,
    mutate: fetchData,
    addRow,
    updateRow,
    deleteRow,
  };
}
