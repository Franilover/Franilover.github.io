import { Globe, Timer, Lock } from "lucide-react";

import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";
import { librosQueries } from "@/lib/api/queries/garlia/libros";
import { enqueueOperation, isReallyOnline } from "@/lib/utils/offlineSync";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Libro = {
  id: string;
  titulo: string;
  sinopsis?: string;
  portada_url?: string;
  estado?: string;
  visibilidad?: "publico" | "programado" | "oculto";
  fecha_publicacion?: string;
  fecha_proximo_capitulo?: string;
  reino_id?: string | null;
  categoria?: string | null;
  trigger_warnings?: string[];
};

export type Capitulo = {
  id: string;
  libro_id: string;
  titulo_capitulo: string;
  contenido: string;
  orden: number;
  fecha_publicacion: string;
  visibilidad?: "publico" | "programado" | "oculto";
  personajes_ids?: string[];
  reino_id?: string | null;
  narrador_id?: string | null;
  trigger_warnings?: string[];
  status?: "pending" | "synced";
  deleted?: boolean;
};

export type SaveStatus = "idle" | "saving" | "saved" | "pending" | "error";

export type Reino = { id: string; nombre: string };

// ─── Constants ────────────────────────────────────────────────────────────────

export const TABLA_CAPS = "capitulos";

export const ESTADO_COLOR: Record<string, string> = {
  "EN PROCESO":
    "border border-[color-mix(in_srgb,var(--callout-warning-border)_40%,transparent)] text-[var(--callout-warning-title)] bg-[color-mix(in_srgb,var(--callout-warning-border)_12%,transparent)]",
  FINALIZADO:
    "border border-[color-mix(in_srgb,var(--callout-success-border)_40%,transparent)] text-[var(--callout-success-title)] bg-[color-mix(in_srgb,var(--callout-success-border)_12%,transparent)]",
  BORRADOR: "border border-primary/20 text-primary/40 bg-primary/10",
  PAUSADO: "border border-primary/20 text-primary/40 bg-primary/10",
};

export const VISIBILIDAD_CONFIG = {
  publico: {
    label: "Público",
    icon: Globe,
    color: "bg-primary/15 text-primary border-primary/30",
  },
  programado: {
    label: "Programado",
    icon: Timer,
    color: "bg-primary/8  text-primary/70 border-primary/20",
  },
  oculto: {
    label: "Borrador",
    icon: Lock,
    color: "bg-primary/5  text-primary/40 border-primary/10",
  },
} as const;

export const SAVE_TIMEOUT_MS = 10_000;

// ─── Utils ────────────────────────────────────────────────────────────────────

export function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function readingTime(words: number) {
  const mins = Math.ceil(words / 200);
  return mins < 1 ? "<1 min" : `${mins} min`;
}

export function toDateInput(iso: string) {
  return iso ? iso.split("T")[0] : new Date().toISOString().split("T")[0];
}

// ─── Dexie helpers ────────────────────────────────────────────────────────────

export async function dexieCapRead(libroId: string): Promise<Capitulo[]> {
  try {
    const table = (db as any)[TABLA_CAPS];
    if (!table) return [];
    const rows = (await table.toArray()) as Capitulo[];
    return rows
      .filter((r) => r.libro_id === libroId && !r.deleted)
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  } catch {
    return [];
  }
}

export async function dexieCapGet(id: string): Promise<Capitulo | null> {
  try {
    return (await (db as any)[TABLA_CAPS]?.get(id)) ?? null;
  } catch {
    return null;
  }
}

export async function dexieCapWrite(rows: Capitulo[]): Promise<void> {
  try {
    const table = (db as any)[TABLA_CAPS];
    if (!table || !rows.length) return;
    await table.bulkPut(rows);
  } catch (e) {
    console.warn("[Dexie] capitulos:", e);
  }
}

// ─── Async operations ─────────────────────────────────────────────────────────

export async function capUpdateContenido(
  id: string,
  contenido: string,
): Promise<void> {
  const existing = await dexieCapGet(id);
  if (!(await isReallyOnline())) {
    await dexieCapWrite([
      { ...existing, id, contenido, status: "pending" } as Capitulo,
    ]);
    await enqueueOperation(TABLA_CAPS, "update", id, { contenido });
    return;
  }
  try {
    const updatePromise = librosQueries.updateContenido(id, contenido);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("save timeout")), SAVE_TIMEOUT_MS),
    );
    const res = (await Promise.race([updatePromise, timeoutPromise])) as any;
    if (res?.error) throw res.error;
    if (existing)
      await dexieCapWrite([{ ...existing, contenido, status: "synced" }]);
  } catch {
    await dexieCapWrite([
      { ...existing, id, contenido, status: "pending" } as Capitulo,
    ]);
    await enqueueOperation(TABLA_CAPS, "update", id, { contenido });
    throw new Error("offline");
  }
}

export async function capUpdateMeta(
  id: string,
  fields: Partial<Capitulo>,
): Promise<void> {
  const existing = await dexieCapGet(id);
  if (!(await isReallyOnline())) {
    await dexieCapWrite([
      { ...existing, id, ...fields, status: "pending" } as Capitulo,
    ]);
    await enqueueOperation(TABLA_CAPS, "update", id, fields);
    return;
  }
  try {
    const updatePromise = supabase.from(TABLA_CAPS).update(fields).eq("id", id);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("save timeout")), SAVE_TIMEOUT_MS),
    );
    const { error } = (await Promise.race([
      updatePromise,
      timeoutPromise,
    ])) as any;
    if (error) throw error;
    if (existing)
      await dexieCapWrite([{ ...existing, ...fields, status: "synced" }]);
  } catch {
    await dexieCapWrite([
      { ...existing, id, ...fields, status: "pending" } as Capitulo,
    ]);
    await enqueueOperation(TABLA_CAPS, "update", id, fields);
    throw new Error("offline");
  }
}

export async function capCreate(
  libroId: string,
  titulo: string,
  orden: number,
  visibilidad: "publico" | "programado" | "oculto" = "oculto",
  fecha?: string,
  narradorId?: string | null,
): Promise<Capitulo> {
  const base: any = {
    libro_id: libroId,
    titulo_capitulo: titulo.toUpperCase(),
    contenido: "",
    orden,
    visibilidad,
    fecha_publicacion: visibilidad === "programado" ? (fecha ?? null) : null,
    narrador_id: narradorId ?? null,
  };
  if (!(await isReallyOnline())) {
    const tmpId = crypto.randomUUID();
    const row = { ...base, id: tmpId, status: "pending" as const };
    await dexieCapWrite([row]);
    await enqueueOperation(TABLA_CAPS, "upsert", tmpId, row);
    return row;
  }
  try {
    const { data, error } = await supabase
      .from(TABLA_CAPS)
      .insert([base])
      .select()
      .single();
    if (error) throw error;
    await dexieCapWrite([{ ...data, status: "synced" }]);
    return data as Capitulo;
  } catch {
    const tmpId = crypto.randomUUID();
    const row = { ...base, id: tmpId, status: "pending" as const };
    await dexieCapWrite([row]);
    await enqueueOperation(TABLA_CAPS, "upsert", tmpId, row);
    return row;
  }
}

// ─── Historial de versiones ──────────────────────────────────────────────────
// Snapshots del contenido de un capítulo, tomados en cada guardado exitoso
// con cambio real de texto. Dexie es la fuente de verdad instantánea (mismo
// patrón stale-while-revalidate que el resto del proyecto); Supabase se
// intenta en background y si falla, el snapshot igual queda local — no vale
// la pena bloquear el guardado principal ni encolar reintentos para esto.
//
// Nota: reusa la tabla `historial_contenido` que ya existía en Supabase
// (252 filas al momento de conectar esto, con inserts activos desde otro
// flujo — el nombre de columna `contenido_delta` es engañoso: cada fila
// tiene el contenido COMPLETO del capítulo en ese momento, no un diff).
// Supabase es la fuente de verdad acá (a diferencia del resto del
// proyecto que es Dexie-first) porque el historial ya vivía ahí y no
// tiene sentido duplicar el dataset existente en una tabla Dexie nueva.

export const TABLA_HISTORIAL = "historial_contenido";

export type HistorialVersionRow = {
  id: string;
  capitulo_id: string;
  contenido_delta: string; // contenido completo del snapshot (nombre legado)
  fecha: string;
};

export async function capGuardarVersion(
  capId: string,
  contenido: string,
): Promise<void> {
  if (!(await isReallyOnline())) return; // best-effort, sin cola offline
  try {
    const { error } = await supabase.from(TABLA_HISTORIAL).insert([
      { capitulo_id: capId, contenido_delta: contenido },
    ]);
    if (error) throw error;
  } catch (e) {
    console.warn("[Supabase] historial_contenido insert:", e);
    // Sin reintento: un snapshot perdido no es crítico, y no queremos que
    // esto compita con la cola de offlineSync del guardado principal.
  }
}

export async function capListarVersiones(
  capId: string,
): Promise<HistorialVersionRow[]> {
  try {
    const { data, error } = await supabase
      .from(TABLA_HISTORIAL)
      .select("id, capitulo_id, contenido_delta, fecha")
      .eq("capitulo_id", capId)
      .order("fecha", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as HistorialVersionRow[];
  } catch (e) {
    console.warn("[Supabase] historial_contenido select:", e);
    return [];
  }
}

export async function capDelete(id: string): Promise<void> {
  const existing = await dexieCapGet(id);
  if (!(await isReallyOnline())) {
    if (existing)
      await dexieCapWrite([{ ...existing, deleted: true, status: "pending" }]);
    await enqueueOperation(TABLA_CAPS, "delete", id);
    return;
  }
  try {
    const { error } = await supabase.from(TABLA_CAPS).delete().eq("id", id);
    if (error) throw error;
    try {
      await (db as any)[TABLA_CAPS]?.delete(id);
    } catch {}
  } catch {
    if (existing)
      await dexieCapWrite([{ ...existing, deleted: true, status: "pending" }]);
    await enqueueOperation(TABLA_CAPS, "delete", id);
    throw new Error("offline");
  }
}

export async function libroUpdateMeta(
  id: string,
  fields: Partial<Libro>,
): Promise<void> {
  const { error } = await supabase.from("libros").update(fields).eq("id", id);
  if (error) throw error;

  // Sincronizar Dexie para que el cache refleje los cambios (ej: trigger_warnings)
  try {
    const table = (db as any)["libros"];
    if (table) {
      const existing = await table.get(id);
      if (existing) {
        await table.put({ ...existing, ...fields });
      }
    }
  } catch (e) {
    console.warn("[Dexie] libroUpdateMeta:", e);
  }
}

export async function libroDelete(id: string): Promise<void> {
  const { error } = await supabase.from("libros").delete().eq("id", id);
  if (error) throw error;
}
