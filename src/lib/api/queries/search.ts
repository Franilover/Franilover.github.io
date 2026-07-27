import { useQuery } from "@tanstack/react-query";

import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";
import { loadPersonajes } from "@/infra/sync/syncEngine";
import type { Tables } from "@/lib/types/supabase";
import { isReallyOnline } from "@/lib/utils/offlineSync";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type SearchPersonaje = Pick<
  Tables<"personajes">,
  "id" | "nombre" | "especie" | "img_url"
>;
export type SearchLibro = Pick<
  Tables<"libros">,
  "id" | "titulo" | "portada_url" | "estado"
>;
export type SearchCancion = Pick<
  Tables<"canciones">,
  "id" | "titulo" | "cantante" | "portada_url"
>;
export type SearchCapitulo = Pick<
  Tables<"capitulos">,
  "id" | "titulo_capitulo" | "libro_id" | "orden"
>;
export type SearchReino = Pick<Tables<"reinos">, "id" | "nombre" | "logo_url">;
export type SearchCriatura = Pick<
  Tables<"criaturas">,
  "id" | "nombre" | "imagen_url"
>;
export type SearchCiudad = Pick<
  Tables<"ciudades">,
  "id" | "nombre" | "imagen_url"
>;
export type SearchEnsayo = Pick<
  Tables<"ensayos">,
  "id" | "titulo" | "tags" | "updated_at"
>;
export type SearchGrupo = Pick<
  Tables<"grupos_mundo">,
  "id" | "nombre" | "tipo" | "subtipo" | "miembro_ids"
>;
export type SearchNota = Pick<
  Tables<"notas">,
  "id" | "titulo" | "etiquetas" | "updated_at"
>;

export interface GlobalSearchResults {
  personajes: SearchPersonaje[];
  libros: SearchLibro[];
  canciones: SearchCancion[];
  capitulos: SearchCapitulo[];
  reinos: SearchReino[];
  criaturas: SearchCriatura[];
  ciudades: SearchCiudad[];
  ensayos: SearchEnsayo[];
  grupos: SearchGrupo[];
  notas: SearchNota[];
  /** true = vino de Dexie (offline), false = vino de Supabase (online) */
  fromCache: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Filtra un array por nombre usando ilike (case-insensitive, con acento ignorado básico) */
function localFilter<T extends { nombre?: string; titulo?: string }>(
  items: T[],
  term: string,
  field: "nombre" | "titulo" = "nombre",
  limit = 4,
): T[] {
  const lower = term.toLowerCase();
  return items
    .filter((item) => (item[field] ?? "").toLowerCase().includes(lower))
    .slice(0, limit);
}

// ── Búsqueda en Dexie (offline-first) ────────────────────────────────────────

async function searchDexie(term: string): Promise<GlobalSearchResults | null> {
  if (!db) return null;

  try {
    // Dexie no hace ilike nativo, pero toArray() + filter en JS es muy rápido
    // porque todo está en memoria/IndexedDB local
    const [
      personajes,
      libros,
      canciones,
      capitulos,
      reinos,
      criaturas,
      ciudades,
      ensayos,
      gruposMundo,
      notasLore,
    ] = await Promise.all([
      db.personajes.toArray(),
      db.libros.toArray(),
      db.canciones.toArray(),
      (db as any).capitulos?.toArray() ?? [],
      db.reinos.toArray(),
      db.criaturas.toArray(),
      db.ciudades.toArray(),
      (db as any).ensayos?.toArray() ?? [],
      (db as any).grupos_mundo?.toArray() ?? [],
      (db as any).notas_lore?.toArray() ?? [],
    ]);

    const results: GlobalSearchResults = {
      personajes: localFilter(
        personajes,
        term,
        "nombre",
        4,
      ) as SearchPersonaje[],
      libros: localFilter(libros, term, "titulo", 4) as SearchLibro[],
      canciones: localFilter(canciones, term, "titulo", 3) as SearchCancion[],
      capitulos: (capitulos as any[])
        .filter((c) =>
          (c.titulo_capitulo ?? "").toLowerCase().includes(term.toLowerCase()),
        )
        .slice(0, 4) as SearchCapitulo[],
      reinos: localFilter(reinos, term, "nombre", 3) as SearchReino[],
      criaturas: localFilter(criaturas, term, "nombre", 3) as SearchCriatura[],
      ciudades: localFilter(ciudades, term, "nombre", 3) as SearchCiudad[],
      ensayos: localFilter(ensayos, term, "titulo", 5) as SearchEnsayo[],
      grupos: localFilter(gruposMundo, term, "nombre", 3) as SearchGrupo[],
      notas: localFilter(notasLore, term, "titulo", 4) as SearchNota[],
      fromCache: true,
    };

    // Si al menos una tabla tiene datos, consideramos Dexie válido
    const hasAnyData =
      personajes.length > 0 ||
      libros.length > 0 ||
      canciones.length > 0 ||
      reinos.length > 0 ||
      gruposMundo.length > 0 ||
      notasLore.length > 0;

    // Auto-sanar caché: Dexie puede tener copias viejas (ej. sin img_url
    // recién agregado). No bloqueamos la búsqueda actual, pero disparamos
    // un refresh en background para que la PRÓXIMA búsqueda ya esté fresca.
    void isReallyOnline().then((online) => {
      if (online) void loadPersonajes();
    });

    return hasAnyData ? results : null;
  } catch {
    return null;
  }
}

// ── Búsqueda en Supabase (fallback online) ────────────────────────────────────

async function searchSupabase(term: string): Promise<GlobalSearchResults> {
  const pattern = `%${term}%`;

  const [
    personajes,
    libros,
    canciones,
    capitulos,
    reinos,
    criaturas,
    ciudades,
    ensayos,
    grupos,
    notas,
  ] = await Promise.all([
    supabase
      .from("personajes")
      .select("id, nombre, especie, img_url")
      .ilike("nombre", pattern)
      .limit(4),
    supabase
      .from("libros")
      .select("id, titulo, portada_url, estado")
      .ilike("titulo", pattern)
      .limit(4),
    supabase
      .from("canciones")
      .select("id, titulo, cantante, portada_url")
      .ilike("titulo", pattern)
      .limit(3),
    supabase
      .from("capitulos")
      .select("id, titulo_capitulo, libro_id, orden")
      .ilike("titulo_capitulo", pattern)
      .limit(4),
    supabase
      .from("reinos")
      .select("id, nombre, logo_url")
      .ilike("nombre", pattern)
      .limit(3),
    supabase
      .from("criaturas")
      .select("id, nombre, imagen_url")
      .ilike("nombre", pattern)
      .limit(3),
    supabase
      .from("ciudades")
      .select("id, nombre, imagen_url")
      .ilike("nombre", pattern)
      .limit(3),
    supabase
      .from("ensayos")
      .select("id, titulo, tags, updated_at")
      .ilike("titulo", pattern)
      .limit(5),
    supabase
      .from("grupos_mundo")
      .select("id, nombre, tipo, subtipo, miembro_ids")
      .ilike("nombre", pattern)
      .limit(3),
    supabase
      .from("notas")
      .select("id, titulo, etiquetas, updated_at")
      .ilike("titulo", pattern)
      .limit(4),
  ]);

  return {
    personajes: personajes.data ?? [],
    libros: libros.data ?? [],
    canciones: canciones.data ?? [],
    capitulos: capitulos.data ?? [],
    reinos: reinos.data ?? [],
    criaturas: criaturas.data ?? [],
    ciudades: ciudades.data ?? [],
    ensayos: ensayos.data ?? [],
    grupos: grupos.data ?? [],
    notas: notas.data ?? [],
    fromCache: false,
  };
}

// ── Query principal ───────────────────────────────────────────────────────────

export function useGlobalSearch(term: string) {
  const trimmed = term.trim();

  return useQuery<GlobalSearchResults>({
    queryKey: ["global-search", trimmed],

    queryFn: async (): Promise<GlobalSearchResults> => {
      if (trimmed.length < 2) {
        return {
          personajes: [],
          libros: [],
          canciones: [],
          capitulos: [],
          reinos: [],
          criaturas: [],
          ciudades: [],
          ensayos: [],
          grupos: [],
          notas: [],
          fromCache: false,
        };
      }

      // 1️⃣ Intentar Dexie primero (instantáneo, offline)
      const dexieResults = await searchDexie(trimmed);
      if (dexieResults) return dexieResults;

      // 2️⃣ Fallback a Supabase (red, online)
      return searchSupabase(trimmed);
    },

    enabled: trimmed.length >= 2,
    staleTime: 1000 * 60 * 2, // 2 min — Dexie es tan rápido que no hace falta invalidar seguido
    placeholderData: {
      personajes: [],
      libros: [],
      canciones: [],
      capitulos: [],
      reinos: [],
      criaturas: [],
      ciudades: [],
      ensayos: [],
      grupos: [],
      notas: [],
      fromCache: false,
    },
  });
}
