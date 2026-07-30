"use client";

/**
 * useGruposCancionesPorSubtipo.ts
 * ─────────────────────────────────
 * Trae los grupos del mundo (tipo="canciones") que tienen un subtipo
 * específico — por ejemplo subtipo="Emoción" o subtipo="Tema" — para
 * usarlos como opciones de un selector, en vez de una lista fija en código
 * o de texto libre.
 *
 * También expone toggleMiembro para sincronizar miembro_ids del grupo
 * cuando una canción elige/cambia de opción.
 *
 * Dexie primero → Supabase en background, mismo patrón que
 * useGruposDeLaCancion.ts.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";

export type GrupoSubtipo = {
  id: string;
  nombre: string;
  subtipo: string | null;
  miembro_ids: string[];
};

async function readFromDexie(subtipo: string): Promise<GrupoSubtipo[]> {
  try {
    if (!db?.grupos_mundo) return [];
    const rows = await db.grupos_mundo
      .where("tipo")
      .equals("canciones")
      .toArray();
    return rows
      .filter((r: any) => !r.deleted && r.subtipo === subtipo)
      .map((r: any) => ({
        id: r.id,
        nombre: r.nombre,
        subtipo: r.subtipo ?? null,
        miembro_ids: r.miembro_ids ?? [],
      }));
  } catch {
    return [];
  }
}

async function writeToDexie(rows: any[]): Promise<void> {
  try {
    if (!db?.grupos_mundo || rows.length === 0) return;
    const local: any[] = await db.grupos_mundo.toArray();
    const pendingIds = new Set(
      local.filter((r: any) => r.status === "pending").map((r: any) => r.id),
    );
    const toWrite = rows
      .filter((r: any) => !pendingIds.has(r.id))
      .map((r: any) => ({ ...r, status: "synced" }));
    if (toWrite.length > 0) await db.grupos_mundo.bulkPut(toWrite);
  } catch (e) {
    console.warn("[useGruposCancionesPorSubtipo] No se pudo guardar en Dexie:", e);
  }
}

/**
 * @param subtipo Ej. "Emoción" o "Tema" — debe matchear exactamente el
 *   subtipo guardado en grupos_mundo para que la canción aparezca listada.
 */
export function useGruposCancionesPorSubtipo(subtipo: string) {
  const [grupos, setGrupos] = useState<GrupoSubtipo[]>([]);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  const load = useCallback(async () => {
    const local = await readFromDexie(subtipo);
    if (!isMounted.current) return;
    if (local.length > 0) {
      setGrupos(local.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setLoading(false);
    }

    try {
      const { data, error } = await supabase
        .from("grupos_mundo")
        .select("id, nombre, subtipo, miembro_ids")
        .eq("tipo", "canciones")
        .eq("subtipo", subtipo);

      if (error || !data) throw error ?? new Error("Sin datos");
      if (!isMounted.current) return;

      // Necesitamos escribir también tipo="canciones" para que el read de
      // Dexie (que filtra por tipo) encuentre estas filas la próxima vez.
      writeToDexie(data.map((r: any) => ({ ...r, tipo: "canciones" }))).catch(
        () => {},
      );

      const result = (data as any[]).map((r) => ({
        id: r.id,
        nombre: r.nombre,
        subtipo: r.subtipo ?? null,
        miembro_ids: r.miembro_ids ?? [],
      }));
      setGrupos(result.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } catch {
      // Si Dexie tenía datos, el usuario ya los ve.
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [subtipo]);

  useEffect(() => {
    isMounted.current = true;
    void load();
    return () => {
      isMounted.current = false;
    };
  }, [load]);

  /**
   * Sincroniza la pertenencia de una canción a los grupos de este subtipo:
   * la agrega a `grupoIdNuevo` (si no es null) y la quita de cualquier otro
   * grupo del mismo subtipo al que perteneciera antes (para que una canción
   * tenga como máximo un grupo por subtipo, igual que el campo de texto
   * único emocion/tema).
   */
  const sincronizarMiembro = useCallback(
    async (cancionId: string, grupoIdNuevo: string | null) => {
      const afectados = grupos.filter(
        (g) =>
          g.id === grupoIdNuevo || g.miembro_ids.includes(cancionId),
      );

      for (const g of afectados) {
        const debeEstar = g.id === grupoIdNuevo;
        const yaEsta = g.miembro_ids.includes(cancionId);
        if (debeEstar === yaEsta) continue;

        const nuevosMiembros = debeEstar
          ? [...g.miembro_ids, cancionId]
          : g.miembro_ids.filter((id) => id !== cancionId);

        setGrupos((prev) =>
          prev.map((x) =>
            x.id === g.id ? { ...x, miembro_ids: nuevosMiembros } : x,
          ),
        );

        await supabase
          .from("grupos_mundo")
          .update({ miembro_ids: nuevosMiembros })
          .eq("id", g.id);
      }
    },
    [grupos],
  );

  return { grupos, loading, sincronizarMiembro };
}
