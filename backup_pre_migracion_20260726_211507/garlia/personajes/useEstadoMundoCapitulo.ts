"use client";

/**
 * useEstadoMundoCapitulo.ts
 * ───────────────────────────
 * "¿Qué pasa en el mundo en este punto de la historia?" — para cada
 * personaje vinculado al capítulo (no solo el narrador), calcula su edad y
 * su era/rasgos/notas vigentes en el `dia_absoluto` del capítulo. Reusa
 * exactamente la misma regla que ya existía para el narrador en
 * PanelPersonajesCapitulo: la era de mayor `momento` que sea <= al momento
 * actual (o la más reciente de todas si el capítulo no tiene fecha).
 *
 * Ruta: src/features/editorGarlia/hooks/personajes/useEstadoMundoCapitulo.ts
 */

import { useEffect, useMemo, useState } from "react";

import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";

type EraRow = {
  personaje_id: string;
  momento: number;
  label: string;
  rasgos: string[];
  notas: string;
};

type PersonajeBasico = {
  id: string;
  nombre: string;
  fecha_nacimiento: number | null;
};

export type EstadoPersonaje = {
  id: string;
  nombre: string;
  edad: number | null;
  eraLabel: string;
  rasgos: string[];
  notas: string;
};

export function useEstadoMundoCapitulo(
  personajesIds: string[],
  diaAbsoluto: number | null,
  diasPorAnio: number,
) {
  const [datos, setDatos] = useState<
    Record<string, { fechaNacimiento: number | null; eras: EraRow[] }>
  >({});
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Clave estable para no re-disparar el efecto en cada render por un
  // array `personajesIds` recreado con el mismo contenido.
  const idsKey = useMemo(() => [...personajesIds].sort().join(","), [
    personajesIds,
  ]);

  useEffect(() => {
    const ids = idsKey ? idsKey.split(",") : [];
    if (ids.length === 0) {
      setDatos({});
      setNombres({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      const nextDatos: Record<
        string,
        { fechaNacimiento: number | null; eras: EraRow[] }
      > = {};
      const nextNombres: Record<string, string> = {};

      // 1. Dexie primero — instantáneo con lo que ya esté cacheado.
      try {
        for (const id of ids) {
          const p = await (db as any)?.personajes?.get(id);
          if (p) {
            nextNombres[id] = p.nombre ?? "";
            nextDatos[id] = {
              fechaNacimiento: p.fecha_nacimiento ?? null,
              eras: [],
            };
          }
          const eras: EraRow[] =
            (await (db as any)?.personaje_eras
              ?.where("personaje_id")
              .equals(id)
              .toArray()) ?? [];
          if (nextDatos[id]) nextDatos[id].eras = eras;
        }
        if (!cancelled && Object.keys(nextDatos).length > 0) {
          setDatos({ ...nextDatos });
          setNombres({ ...nextNombres });
        }
      } catch {}

      // 2. Supabase en background — refresca y recachea.
      if (!navigator.onLine) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const [{ data: personajes }, { data: eras }] = await Promise.all([
          supabase
            .from("personajes")
            .select("id, nombre, fecha_nacimiento")
            .in("id", ids),
          (supabase as any)
            .from("personaje_eras")
            .select("id, personaje_id, momento, label, rasgos, notas")
            .in("personaje_id", ids),
        ]);

        if (!cancelled && personajes) {
          for (const p of personajes as PersonajeBasico[]) {
            nextNombres[p.id] = p.nombre;
            nextDatos[p.id] = {
              fechaNacimiento: p.fecha_nacimiento ?? null,
              eras: (eras ?? []).filter((e: any) => e.personaje_id === p.id),
            };
          }
          setDatos({ ...nextDatos });
          setNombres({ ...nextNombres });
        }

        // Recachear en Dexie, best-effort.
        try {
          if (eras?.length) await (db as any).personaje_eras?.bulkPut(eras);
        } catch {}
      } catch {
        // Sin conexión o error: nos quedamos con lo que Dexie haya dado.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  // Cálculo 100% local: para cada personaje, su era vigente en
  // `diaAbsoluto` según la misma regla que el narrador (era de mayor
  // momento <= momento actual; si no hay fecha, la más reciente).
  const estados = useMemo<EstadoPersonaje[]>(() => {
    const ids = idsKey ? idsKey.split(",") : [];
    return ids
      .filter((id) => datos[id])
      .map((id) => {
        const { fechaNacimiento, eras } = datos[id];
        const candidatas =
          diaAbsoluto != null
            ? eras.filter((e) => e.momento <= diaAbsoluto)
            : eras;
        const eraActual = candidatas.length
          ? candidatas.reduce((max, e) => (e.momento > max.momento ? e : max))
          : null;
        const edad =
          fechaNacimiento != null && diasPorAnio > 0 && diaAbsoluto != null
            ? Math.floor((diaAbsoluto - fechaNacimiento) / diasPorAnio)
            : null;
        return {
          id,
          nombre: nombres[id] ?? "…",
          edad,
          eraLabel: eraActual?.label ?? "",
          rasgos: eraActual?.rasgos ?? [],
          notas: eraActual?.notas ?? "",
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [idsKey, datos, nombres, diaAbsoluto, diasPorAnio]);

  return { estados, loading };
}
