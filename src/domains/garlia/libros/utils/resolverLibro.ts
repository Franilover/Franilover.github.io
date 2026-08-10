// ─────────────────────────────────────────────────────────────────────────────
// resolverLibro.ts
// ─────────────────────────────────────────────────────────────────────────────
// Antes esta lógica (Dexie-first, fallback a Supabase, match por slug) vivía
// duplicada: una vez como `resolverLibroPorSlug` en detallesLibro.tsx, y otra
// vez reimplementada inline dentro del efecto principal de leerLibro.tsx con
// pequeñas diferencias de columnas pedidas. Unificado acá — cada consumidor
// pide solo las columnas que necesita vía el genérico `LibroBase`.
//
// NOTA: detallesLibro.tsx necesita `trigger_warnings` (para el modal de TW) y
// solo confía en el caché de Dexie si esa columna ya está presente en la fila
// cacheada — por eso `exigirColumnas` existe: sin eso, un libro cacheado
// ANTES de que se agregara la columna trigger_warnings se serviría desde
// Dexie sin ese campo, y el modal de TW nunca aparecería para libros viejos
// en caché. leerLibro.tsx no la necesita, así que no la pasa.

import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";
import { toSlug, esUUID } from "@/lib/utils/slugify";

export interface LibroBase {
  id: string;
  titulo: string;
  categoria?: string | null;
  [key: string]: unknown;
}

interface ResolverLibroOpts {
  /** Columnas a pedir en el select de Supabase. */
  columnas: string;
  /** Si se pasan, un libro cacheado en Dexie solo se usa si TODAS estas
   * columnas ya están presentes (no undefined) en la fila — evita servir
   * datos incompletos desde una caché vieja. */
  exigirColumnas?: string[];
}

/** Resuelve un libro por su slug (título slugificado), Dexie-first con
 * fallback a Supabase. Solo considera libros públicos o programados. */
export async function resolverLibroPorSlug<T extends LibroBase = LibroBase>(
  slugParam: string,
  { columnas, exigirColumnas = [] }: ResolverLibroOpts,
): Promise<T | null> {
  try {
    if (db?.libros) {
      const todos = (await db.libros.toArray()) as any[];
      const encontrado = todos.find(
        (l: any) =>
          toSlug(l.titulo ?? "") === slugParam &&
          (l.visibilidad === "publico" || l.visibilidad === "programado"),
      );
      const tieneColumnasRequeridas = exigirColumnas.every(
        (col) => encontrado?.[col] !== undefined,
      );
      if (encontrado && tieneColumnasRequeridas) return encontrado as T;
    }
  } catch {}

  const { data } = await supabase
    .from("libros")
    .select(columnas)
    .in("visibilidad", ["publico", "programado"]);
  if (!data) return null;

  try {
    await db?.libros?.bulkPut(data as any[]);
  } catch {}
  return (data.find((l: any) => toSlug(l.titulo ?? "") === slugParam) ??
    null) as T | null;
}

/** Resuelve un libro por su UUID directo, Dexie-first con fallback a
 * Supabase (single row). */
export async function resolverLibroPorId<T extends LibroBase = LibroBase>(
  id: string,
  columnas: string,
): Promise<T | null> {
  try {
    const cacheado = (await db?.libros?.get(id)) as T | undefined;
    if (cacheado) return cacheado;
  } catch {}

  const { data } = await supabase
    .from("libros")
    .select(columnas)
    .eq("id", id)
    .in("visibilidad", ["publico", "programado"])
    .single();
  if (!data) return null;

  try {
    await db?.libros?.put(data as any);
  } catch {}
  return data as T;
}

/** Determina si un libro es "extra" (poemario u otro grupo sin navegación
 * lineal anterior/siguiente), consultando su grupo_mundo si `categoria` es
 * un UUID de grupo. */
export async function esLibroExtra(categoria: string | null | undefined): Promise<boolean> {
  if (!categoria) return false;
  if (!esUUID(categoria)) return false;

  const { data: grupo } = await supabase
    .from("grupos_mundo")
    .select("nombre")
    .eq("id", categoria)
    .single();

  const nombre = grupo?.nombre?.toLowerCase() ?? "";
  return nombre.includes("poemario") || nombre.includes("extra");
}
