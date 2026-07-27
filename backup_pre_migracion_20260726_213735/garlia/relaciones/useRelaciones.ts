"use client";

/**
 * useRelaciones.ts
 * ─────────────────
 * Estado y mutaciones de las relaciones de un personaje.
 * Dexie primero → Supabase en background.
 * Incluye creación de relación inversa y borrado en cascada.
 *
 * También exporta `useTiposExistentes`: lista de tipos usados en toda la tabla.
 *
 * Ruta: src/features/editorGarlia/hooks/useRelaciones.ts
 */

import { useCallback, useEffect, useState } from "react";

import { enqueueOperation, isReallyOnline } from "@/hooks/data/useOfflineSync";
import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Relacion {
  id: string;
  personaje_id: string;
  personaje_rel_id: string;
  tipo: string;
  nota?: string | null;
  rel_nombre?: string;
  rel_img_url?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function dexiePutRelacion(
  row: Omit<Relacion, "rel_nombre" | "rel_img_url">,
): Promise<void> {
  try {
    if (db) await (db as any).relaciones?.put(row);
  } catch {}
}

async function dexieDelRelacion(id: string): Promise<void> {
  try {
    if (db) await (db as any).relaciones?.delete(id);
  } catch {}
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const INVERSOS: [string, string][] = [
  ["madre", "hijo"], ["padre", "hijo"], ["hijo", "padre"], ["hija", "padre"],
  ["hermano", "hermano"], ["hermana", "hermana"],
  ["abuelo", "nieto"], ["abuela", "nieto"], ["nieto", "abuelo"], ["nieta", "abuela"],
  ["tio", "sobrino"], ["tia", "sobrino"], ["sobrino", "tio"], ["sobrina", "tia"],
  ["amigo", "amigo"], ["amiga", "amiga"],
  ["enemigo", "enemigo"], ["rival", "rival"],
  ["mentor", "aprendiz"], ["aprendiz", "mentor"],
  ["maestro", "alumno"], ["alumno", "maestro"],
  ["lider", "seguidor"], ["seguidor", "lider"],
  ["pareja", "pareja"], ["novio", "novia"], ["novia", "novio"],
  ["esposo", "esposa"], ["esposa", "esposo"], ["amante", "amante"],
  ["aliado", "aliado"], ["socio", "socio"],
];

export function tipoInverso(tipo: string): string {
  const n = norm(tipo);
  const par = INVERSOS.find(([a]) => norm(a) === n);
  if (par) return par[1].charAt(0).toUpperCase() + par[1].slice(1);
  return tipo;
}

// ─── useTiposExistentes ───────────────────────────────────────────────────────

export function useTiposExistentes(): string[] {
  const [tipos, setTipos] = useState<string[]>([]);

  useEffect(() => {
    // 1. Dexie primero (sin red)
    void (async () => {
      try {
        if (db) {
          const all: any[] = (await (db as any).relaciones?.toArray()) ?? [];
          const set = [
            ...new Set<string>(all.map((r: any) => r.tipo).filter(Boolean)),
          ].sort();
          if (set.length) setTipos(set);
        }
      } catch {}
    })();

    // 2. Supabase si hay conexión
    if (!navigator.onLine) return;

    supabase
      .from("relaciones")
      .select("tipo")
      .then(({ data }) => {
        if (!data) return;
        const set = [
          ...new Set<string>(data.map((r: any) => r.tipo).filter(Boolean)),
        ].sort();
        setTipos(set);
      });
  }, []);

  return tipos;
}

// ─── useRelaciones ────────────────────────────────────────────────────────────

export function useRelaciones(personajeId: string): {
  relaciones: Relacion[];
  loading: boolean;
  addRelacion: (
    personajeSel: { id: string; nombre: string; img_url?: string | null },
    tipo: string,
    nota: string,
  ) => Promise<Relacion | null>;
  deleteRelacion: (rel: Relacion) => Promise<void>;
} {
  const [relaciones, setRelaciones] = useState<Relacion[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      if (db) {
        const local: any[] =
          (await (db as any).relaciones
            ?.where("personaje_id")
            .equals(personajeId)
            .toArray()) ?? [];
        if (local.length) {
          const ids = local.map((r: any) => r.personaje_rel_id);
          const pjs: any[] =
            (await (db as any).personajes?.where("id").anyOf(ids).toArray()) ?? [];
          const pjMap = Object.fromEntries(pjs.map((p: any) => [p.id, p]));
          setRelaciones(
            local.map((r: any) => ({
              ...r,
              rel_nombre: pjMap[r.personaje_rel_id]?.nombre ?? "—",
              rel_img_url: pjMap[r.personaje_rel_id]?.img_url ?? null,
            })),
          );
          setLoading(false);
        }
      }
    } catch {}

    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("relaciones")
        .select(
          `id, personaje_id, personaje_rel_id, tipo, nota,
          personaje_rel:personajes!relaciones_personaje_rel_id_fkey(nombre, img_url)`,
        )
        .eq("personaje_id", personajeId)
        .order("tipo");
      if (error) throw error;
      const enriquecidas: Relacion[] = (data as any[]).map((r) => ({
        id: r.id,
        personaje_id: r.personaje_id,
        personaje_rel_id: r.personaje_rel_id,
        tipo: r.tipo,
        nota: r.nota,
        rel_nombre: r.personaje_rel?.nombre ?? "—",
        rel_img_url: r.personaje_rel?.img_url ?? null,
      }));
      setRelaciones(enriquecidas);
      try {
        if (db)
          await (db as any).relaciones?.bulkPut(
            enriquecidas.map(
              ({ rel_nombre: _n, rel_img_url: _i, ...rest }) => rest,
            ),
          );
      } catch {}
    } catch {}
    setLoading(false);
  }, [personajeId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const addRelacion = async (
    personajeSel: { id: string; nombre: string; img_url?: string | null },
    tipo: string,
    nota: string,
  ): Promise<Relacion | null> => {
    const online = await isReallyOnline();
    const row = {
      personaje_id: personajeId,
      personaje_rel_id: personajeSel.id,
      tipo: tipo.trim(),
      nota: nota.trim() || null,
    };
    const rowInverso = {
      personaje_id: personajeSel.id,
      personaje_rel_id: personajeId,
      tipo: tipoInverso(tipo.trim()),
      nota: nota.trim() || null,
    };

    if (!online) {
      const id = generateUUID();
      const idInv = generateUUID();
      const nueva: Relacion = {
        id,
        ...row,
        rel_nombre: personajeSel.nombre,
        rel_img_url: personajeSel.img_url ?? null,
      };
      void dexiePutRelacion({ id, ...row });
      void dexiePutRelacion({ id: idInv, ...rowInverso });
      await enqueueOperation("relaciones", "upsert", id, { id, ...row });
      await enqueueOperation("relaciones", "upsert", idInv, {
        id: idInv,
        ...rowInverso,
      });
      setRelaciones((prev) => [...prev, nueva]);
      return nueva;
    }

    try {
      const [{ data, error: err }, { error: errInv }] = await Promise.all([
        supabase
          .from("relaciones")
          .insert(row)
          .select("id, personaje_id, personaje_rel_id, tipo, nota")
          .single(),
        supabase
          .from("relaciones")
          .insert({ id: generateUUID(), ...rowInverso }),
      ]);
      if (err) throw err;
      if (errInv)
        console.warn("[useRelaciones] Error al insertar relación inversa:", errInv);
      const nueva: Relacion = {
        ...(data as any),
        rel_nombre: personajeSel.nombre,
        rel_img_url: personajeSel.img_url ?? null,
      };
      void dexiePutRelacion({
        id: nueva.id,
        personaje_id: nueva.personaje_id,
        personaje_rel_id: nueva.personaje_rel_id,
        tipo: nueva.tipo,
        nota: nueva.nota,
      });
      setRelaciones((prev) => [...prev, nueva]);
      return nueva;
    } catch {
      return null;
    }
  };

  const deleteRelacion = async (rel: Relacion) => {
    void dexieDelRelacion(rel.id);
    setRelaciones((prev) => prev.filter((r) => r.id !== rel.id));
    const online = await isReallyOnline();

    if (!online) {
      await enqueueOperation("relaciones", "delete", rel.id);
      try {
        if (db) {
          const inversas: any[] =
            (await (db as any).relaciones
              ?.where("personaje_id")
              .equals(rel.personaje_rel_id)
              .toArray()) ?? [];
          const inv = inversas.find(
            (r: any) => r.personaje_rel_id === rel.personaje_id,
          );
          if (inv) {
            void dexieDelRelacion(inv.id);
            await enqueueOperation("relaciones", "delete", inv.id);
          }
        }
      } catch {}
      return;
    }

    try {
      const { error } = await supabase
        .from("relaciones")
        .delete()
        .eq("id", rel.id);
      if (error) await enqueueOperation("relaciones", "delete", rel.id);
      const { data: inversas } = await supabase
        .from("relaciones")
        .select("id")
        .eq("personaje_id", rel.personaje_rel_id)
        .eq("personaje_rel_id", rel.personaje_id);
      if (inversas?.length) {
        const invIds = inversas.map((r: any) => r.id);
        await supabase.from("relaciones").delete().in("id", invIds);
        invIds.forEach((id: string) => void dexieDelRelacion(id));
      }
    } catch {
      await enqueueOperation("relaciones", "delete", rel.id);
    }
  };

  return { relaciones, loading, addRelacion, deleteRelacion };
}
