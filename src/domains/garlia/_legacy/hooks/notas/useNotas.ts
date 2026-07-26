import { useState, useCallback, useEffect, useRef } from "react";

import { enqueueOperation, isReallyOnline } from "@/hooks/data/useOfflineSync";
import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";

import { type Nota } from "../types";

async function loreReadAll<T>(tabla: string): Promise<T[]> {
  if (!db) return [];
  const t = (db as any)[tabla];
  if (!t) return [];
  return (await t.toArray()).filter((r: any) => !r.deleted) as T[];
}

async function lorePut(tabla: string, row: any): Promise<void> {
  if (db) await (db as any)[tabla]?.put(row);
}

async function loreDel(tabla: string, id: string): Promise<void> {
  if (db) await (db as any)[tabla]?.delete(id);
}  

async function loreWriteAll(tabla: string, rows: any[]): Promise<void> {
  if (!db) return;
  const t = (db as any)[tabla];
  if (t) {
    await t.clear();
    await t.bulkPut(rows);
  }
}
// ─── Hook principal ───────────────────────────────────────────────────────────
export function useNotas() {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);

  // Ref para cancelar fetches en vuelo si el componente se desmonta
  // o si se lanza una nueva carga antes de que termine la anterior.
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    // Cancelar cualquier fetch anterior que siga en vuelo
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // 1. Caché local primero (Dexie — nunca aborta)
    try {
      const local = await loreReadAll<Nota>("notas_lore");
      if (controller.signal.aborted) return;
      if (local.length) { setNotas(local); setLoading(false); }
    } catch {
      // Dexie puede fallar en modo privado — seguimos sin caché
    }

    if (!navigator.onLine) {
      if (!controller.signal.aborted) setLoading(false);
      return;
    }

    // 2. Fetch remoto con manejo explícito de AbortError
    try {
      const { data, error } = await supabase
        .from("notas")
        .select("id, titulo, contenido, etiquetas, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .abortSignal(controller.signal);   // ← pasa la señal al cliente Supabase

      // Si se abortó mientras esperábamos, salir silenciosamente
      if (controller.signal.aborted) return;

      if (error) {
        // Ignorar errores de abort — no son errores reales
        const isAbort =
          error.message?.toLowerCase().includes("abort") ||
          error.message?.toLowerCase().includes("cancel") ||
          (error as any)?.code === "20"; // DOMException AbortError code
        if (!isAbort) {
          console.error("[useNotas] Error al cargar notas:", error);
        }
        setLoading(false);
        return;
      }

      const result = (data ?? []) as Nota[];
      setNotas(result);
      setLoading(false);
      await loreWriteAll("notas_lore", result);
    } catch (err: any) {
      if (controller.signal.aborted) return; // silencio total en abort

      const isAbort =
        err?.name === "AbortError" ||
        err?.message?.toLowerCase().includes("abort") ||
        err?.message?.toLowerCase().includes("cancel");

      if (!isAbort) {
        console.error("[useNotas] Error inesperado:", err);
      }
      setLoading(false);
    }
  }, []); // sin deps — load es estable, el cleanup lo maneja abortRef

  useEffect(() => {
    void load();
    // Al desmontar: cancelar cualquier fetch pendiente para evitar
    // el AbortError que cerraba la sesión
    return () => { abortRef.current?.abort(); };
  }, [load]);

  // Recargar al volver online
  useEffect(() => {
    const handleOnline = () => load();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [load]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const crear = useCallback(async (titulo: string): Promise<Nota | null> => {
    const online = await isReallyOnline();

    if (!online) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const nota: Nota = {
        id,
        titulo: titulo.trim(),
        contenido: "",
        updated_at: now,
        status: "pending",
      } as any;
      setNotas(prev => [nota, ...prev]);
      await lorePut("notas_lore", nota);
      await enqueueOperation("notas_lore", "upsert", id, {
        id,
        titulo: nota.titulo,
        contenido: "",
        updated_at: now,
      });
      return nota;
    }

    try {
      const { data, error } = await supabase
        .from("notas")
        .insert([{ titulo: titulo.trim(), contenido: "" }])
        .select("id, titulo, contenido, etiquetas, created_at, updated_at")
        .single();

      if (error || !data) {
        console.error("[useNotas] Error al crear nota:", error);
        return null;
      }

      const nota = data as Nota;
      setNotas(prev => [nota, ...prev]);
      await lorePut("notas_lore", nota);
      return nota;
    } catch (err: any) {
      console.error("[useNotas] Error al crear nota:", err);
      return null;
    }
  }, []);

  const actualizar = useCallback(async (nota: Nota): Promise<void> => {
    const now = new Date().toISOString();
    const updated = { ...nota, updated_at: now };

    // Optimistic update siempre
    setNotas(prev => prev.map(n => n.id === nota.id ? updated : n));
    await lorePut("notas_lore", updated);

    const online = await isReallyOnline();

    if (!online) {
      await enqueueOperation("notas_lore", "update", nota.id, {
        titulo:     nota.titulo,
        contenido:  nota.contenido ?? "",
        etiquetas:  nota.etiquetas ?? null,
        updated_at: now,
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("notas")
        .update({
          titulo:     nota.titulo,
          contenido:  nota.contenido ?? "",
          etiquetas:  nota.etiquetas ?? null,
          updated_at: now,
        })
        .eq("id", nota.id);

      if (error) {
        console.error("[useNotas] Error al actualizar nota:", error);
        await enqueueOperation("notas_lore", "update", nota.id, {
          titulo:     nota.titulo,
          contenido:  nota.contenido ?? "",
          etiquetas:  nota.etiquetas ?? null,
          updated_at: now,
        });
      }
    } catch (err: any) {
      console.error("[useNotas] Error al actualizar nota:", err);
    }
  }, []);

  const eliminar = useCallback(async (id: string): Promise<void> => {
    setNotas(prev => prev.filter(n => n.id !== id));
    await loreDel("notas_lore", id);

    const online = await isReallyOnline();

    if (!online) {
      await enqueueOperation("notas_lore", "delete", id);
      return;
    }

    try {
      const { error } = await supabase.from("notas").delete().eq("id", id);
      if (error) {
        console.error("[useNotas] Error al eliminar nota:", error);
        await enqueueOperation("notas_lore", "delete", id);
      }
    } catch (err: any) {
      console.error("[useNotas] Error al eliminar nota:", err);
    }
  }, []);

  return { notas, setNotas, loading, crear, actualizar, eliminar, refetch: load };
}