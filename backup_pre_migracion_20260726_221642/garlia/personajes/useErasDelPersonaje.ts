"use client";

/**
 * useErasDelPersonaje.ts
 * ───────────────────────
 * Gestión completa de las eras de la línea de tiempo de un personaje:
 * carga (Dexie → Supabase), crear, eliminar, y mutar rasgos/notas/label
 * con debounce para los campos de texto.
 *
 * Ruta: src/features/editorGarlia/hooks/useErasDelPersonaje.ts
 */

import { useEffect, useRef, useState } from "react";

import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";

// ─── Tipo ─────────────────────────────────────────────────────────────────────

export type Era = {
  id: string;
  momento: number;
  label: string;
  rasgos: string[];
  notas: string;
  _saving?: boolean;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useErasDelPersonaje(
  personajeId: string,
  fechaNacimiento?: number | null,
) {
  const [eras, setEras] = useState<Era[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const notasTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const labelTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Helpers internos ──────────────────────────────────────────────────────

  const mapEraRow = (e: any): Era => ({
    id: e.id,
    momento: e.momento,
    label: e.label ?? "",
    rasgos: e.rasgos ?? [],
    notas: e.notas ?? "",
  });

  const updateEra = (id: string, patch: Partial<Era>) =>
    setEras((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  // ── Carga ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!personajeId) return;
    setLoading(true);

    const run = async () => {
      // 1. Dexie primero
      try {
        if (db) {
          const local: any[] =
            (await (db as any).personaje_eras
              ?.where("personaje_id")
              .equals(personajeId)
              .toArray()) ?? [];
          if (local.length) {
            setEras(
              [...local]
                .sort((a, b) => (a.momento ?? 0) - (b.momento ?? 0))
                .map(mapEraRow),
            );
            setLoading(false);
            if (!navigator.onLine) return;
          }
        }
      } catch {}

      // 2. Supabase en background
      try {
        const { data } = await (supabase as any)
          .from("personaje_eras")
          .select("id, momento, label, rasgos, notas")
          .eq("personaje_id", personajeId)
          .order("momento");
        if (data) {
          setEras(data.map(mapEraRow));
          setLoading(false);
          try {
            if (db && data.length > 0) {
              const rowsWithPid = data.map((e: any) => ({
                ...e,
                personaje_id: personajeId,
              }));
              await (db as any).personaje_eras?.bulkPut(rowsWithPid);
            }
          } catch {}
        }
      } catch {}
      setLoading(false);
    };

    void run();
  }, [personajeId]);

  // ── Mutaciones ─────────────────────────────────────────────────────────────

  const addEra = async (momento: number, label: string): Promise<Era | null> => {
    if (isNaN(momento)) return null;
    if (fechaNacimiento != null && momento <= fechaNacimiento) return null;
    setCreating(true);
    const { data, error } = await (supabase as any)
      .from("personaje_eras")
      .insert({
        personaje_id: personajeId,
        momento,
        label: label.trim() || null,
        rasgos: [],
        notas: "",
      })
      .select("id, momento, label, rasgos, notas")
      .single();
    if (!error && data) {
      const era: Era = {
        id: data.id,
        momento: data.momento,
        label: data.label ?? "",
        rasgos: [],
        notas: "",
      };
      setEras((prev) =>
        [...prev, era].sort((a, b) => a.momento - b.momento),
      );
      try {
        if (db)
          await (db as any).personaje_eras?.put({
            ...data,
            personaje_id: personajeId,
          });
      } catch {}
      setCreating(false);
      return era;
    }
    setCreating(false);
    return null;
  };

  const deleteEra = async (id: string) => {
    setEras((prev) => prev.filter((e) => e.id !== id));
    await (supabase as any).from("personaje_eras").delete().eq("id", id);
    try {
      if (db) await (db as any).personaje_eras?.delete(id);
    } catch {}
  };

  const addRasgo = async (era: Era, rasgo: string) => {
    const trimmed = rasgo.trim();
    if (!trimmed) return;
    const next = [...era.rasgos, trimmed];
    updateEra(era.id, { rasgos: next, _saving: true });
    await (supabase as any)
      .from("personaje_eras")
      .update({ rasgos: next })
      .eq("id", era.id);
    updateEra(era.id, { _saving: false });
  };

  const removeRasgo = async (era: Era, rasgo: string) => {
    const next = era.rasgos.filter((r) => r !== rasgo);
    updateEra(era.id, { rasgos: next, _saving: true });
    await (supabase as any)
      .from("personaje_eras")
      .update({ rasgos: next })
      .eq("id", era.id);
    updateEra(era.id, { _saving: false });
  };

  const changeNotas = (era: Era, val: string) => {
    updateEra(era.id, { notas: val, _saving: true });
    clearTimeout(notasTimers.current[era.id]);
    notasTimers.current[era.id] = setTimeout(async () => {
      await (supabase as any)
        .from("personaje_eras")
        .update({ notas: val })
        .eq("id", era.id);
      updateEra(era.id, { _saving: false });
    }, 1200);
  };

  const changeLabel = (era: Era, val: string) => {
    updateEra(era.id, { label: val, _saving: true });
    clearTimeout(labelTimers.current[era.id]);
    labelTimers.current[era.id] = setTimeout(async () => {
      await (supabase as any)
        .from("personaje_eras")
        .update({ label: val.trim() || null })
        .eq("id", era.id);
      updateEra(era.id, { _saving: false });
    }, 800);
  };

  // Cambia el día absoluto de la era (se usa tanto al editar la fecha
  // directamente como al editar la edad, que recalcula el día absoluto
  // manteniendo el mismo desfase dentro del año). Como esto puede alterar
  // el orden cronológico de la lista, re-ordenamos tras aplicar el cambio.
  const changeMomento = async (era: Era, nuevoMomento: number) => {
    if (isNaN(nuevoMomento)) return;
    setEras((prev) =>
      prev
        .map((e) => (e.id === era.id ? { ...e, momento: nuevoMomento, _saving: true } : e))
        .sort((a, b) => a.momento - b.momento),
    );
    await (supabase as any)
      .from("personaje_eras")
      .update({ momento: nuevoMomento })
      .eq("id", era.id);
    updateEra(era.id, { _saving: false });
  };

  // Reajusta el `momento` de TODAS las eras cuando cambia la fecha de
  // nacimiento del personaje, de forma que la EDAD de cada era se
  // mantenga fija (es la fecha la que se adapta a la edad, no al revés).
  // Para cada era se recalcula su edad y su desfase dentro del año usando
  // la fecha de nacimiento ANTERIOR, y con eso se reconstruye el nuevo
  // día absoluto sobre la fecha de nacimiento NUEVA.
  const reajustarErasPorNuevaFecha = async (
    fechaNacimientoAnterior: number,
    fechaNacimientoNueva: number,
    diasPorAnio: number,
  ) => {
    if (diasPorAnio <= 0) return;
    if (fechaNacimientoAnterior === fechaNacimientoNueva) return;
    if (!eras.length) return;

    const actualizaciones = eras.map((era) => {
      const delta = era.momento - fechaNacimientoAnterior;
      const edad = Math.floor(delta / diasPorAnio);
      const desfase = ((delta % diasPorAnio) + diasPorAnio) % diasPorAnio;
      const nuevoMomento = fechaNacimientoNueva + edad * diasPorAnio + desfase;
      return { id: era.id, nuevoMomento };
    });

    setEras((prev) =>
      prev
        .map((e) => {
          const upd = actualizaciones.find((a) => a.id === e.id);
          return upd ? { ...e, momento: upd.nuevoMomento, _saving: true } : e;
        })
        .sort((a, b) => a.momento - b.momento),
    );

    try {
      await Promise.all(
        actualizaciones.map((a) =>
          (supabase as any)
            .from("personaje_eras")
            .update({ momento: a.nuevoMomento })
            .eq("id", a.id),
        ),
      );
    } catch {}

    try {
      if (db) {
        await Promise.all(
          actualizaciones.map(async (a) => {
            const existing = await (db as any).personaje_eras?.get(a.id);
            if (existing) {
              await (db as any).personaje_eras?.put({
                ...existing,
                momento: a.nuevoMomento,
              });
            }
          }),
        );
      }
    } catch {}

    setEras((prev) => prev.map((e) => ({ ...e, _saving: false })));
  };

  return {
    eras,
    loading,
    creating,
    addEra,
    deleteEra,
    addRasgo,
    removeRasgo,
    changeNotas,
    changeLabel,
    changeMomento,
    reajustarErasPorNuevaFecha,
  };
}
