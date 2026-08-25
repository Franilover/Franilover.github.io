"use client";

/**
 * useEntityTabLabel
 * ───────────────────────────────────────────────────────────────────────────
 * Resuelve el nombre visible (para el título de una pestaña) de una entidad
 * dada su sección + id. Reutiliza useSupabaseData("tabla") — el cache es
 * global y compartido (useDataCache), así que llamarlo acá no dispara un
 * fetch duplicado si la tabla ya está cargada en otro lado (p.ej. dentro de
 * EntidadesPage).
 *
 * "grupos" y "notas" no tienen su propio useSupabaseData directo (usan
 * useGrupos/useNotas, que envuelven lógica extra), así que para esos dos
 * casos consultamos su tabla base igual, solo para el nombre — el resto de
 * la lógica de edición sigue viviendo en sus hooks dedicados.
 */

import { useSupabaseData } from "@/infra/sync/useSupabaseData";

import type { SectionKey } from "./useMundoNavigationStore";

interface EntityRow {
  id: string;
  nombre?: string;
  titulo?: string;
}

const SECTION_TABLE: Record<SectionKey, string | null> = {
  personajes: "personajes",
  criaturas: "criaturas",
  ecosistemas: "ecosistemas",
  biomas: "biomas",
  flora: "flora",
  minerales: "minerales",
  items: "items",
  reinos: "reinos",
  ciudades: "ciudades",
  runas: "runas",
  elementos: "elementos",
  grupos: "grupos_mundo",
  // "capitulos" ahora sí abre pestañas — pero de LIBROS (el documento
  // completo de un libro, ver LibroDocumentoPanel en EditorCapitulos.tsx),
  // no de capítulos individuales.
  capitulos: "libros",
  letras: "canciones",
  notas: "notas",
  "notas-gos": "ensayos",
  mapa: null,
  "linea-tiempo": null,
  aventura: null,
  // "auditoria" no abre pestañas de entidad puntual (dashboard de solo
  // lectura, sin openEntity("auditoria", id) en ningún lado) — mismo caso
  // que mapa/aventura.
  auditoria: null,
};

/**
 * Resuelve el nombre visible de una entidad (personaje/reino/etc).
 *
 * "capitulos" resuelve el TÍTULO DEL LIBRO — la pestaña abierta con
 * openEntity("capitulos", libroId) es el documento completo de ese libro
 * (ver LibroDocumentoPanel), no un capítulo individual.
 */
export function useEntityTabLabel(section: SectionKey, id: string): string {
  const tabla = SECTION_TABLE[section] ?? "personajes";
  const { data } = useSupabaseData<EntityRow>(tabla);

  // "linea-tiempo" no tiene tabla propia — solo abre pestaña para la
  // pseudo-entidad "historia" (documento de Historia completa). No hay
  // fila que buscar, el label es fijo.
  if (section === "linea-tiempo") return "Historia completa";

  if (!SECTION_TABLE[section]) return "…";
  const row = data.find((r) => r.id === id);
  if (!row) return "…";
  return row.nombre ?? row.titulo ?? "Sin título";
}
