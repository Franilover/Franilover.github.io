/**
 * grafoRelaciones.ts
 * ───────────────────
 * Lógica pura (sin React) para construir el grafo de relaciones
 * de un personaje a partir de Supabase.
 *
 * Ruta: src/lib/utils/grafoRelaciones.ts
 */

import { supabase } from "@/infra/supabase/supabase";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface NodoPersonaje {
  id: string;
  nombre: string;
  img_url?: string | null;
  esCentro?: boolean;
}

export interface EnlaceRelacion {
  source: string;
  target: string;
  tipo: string;
}

export interface DatosGrafo {
  nodos: NodoPersonaje[];
  enlaces: EnlaceRelacion[];
}

// ─── Tipos que se consideran "familia" (jerarquía vertical) ──────────────────

const TIPOS_FAMILIA = new Set([
  "padre", "madre", "hijo", "hija", "hermano", "hermana",
  "abuelo", "abuela", "nieto", "nieta", "tío", "tía",
  "sobrino", "sobrina", "primos", "primo", "prima",
  "familia", "pariente", "ancestro", "descendiente",
]);

export function esFamilia(tipo: string): boolean {
  return TIPOS_FAMILIA.has(tipo.toLowerCase().trim());
}

export const TIPOS_FAM_ARRIBA = [
  "padre", "madre", "abuelo", "abuela", "ancestro", "tío", "tía",
];

// ─── Carga de datos ───────────────────────────────────────────────────────────

export async function cargarDatosGrafo(
  personajeId: string,
): Promise<DatosGrafo> {
  const { data: centro } = await supabase
    .from("personajes")
    .select("id, nombre, img_url")
    .eq("id", personajeId)
    .single();

  if (!centro) return { nodos: [], enlaces: [] };

  const { data: relaciones } = await supabase
    .from("relaciones")
    .select(
      `id, personaje_id, personaje_rel_id, tipo,
      personaje_rel:personajes!relaciones_personaje_rel_id_fkey(id, nombre, img_url)`,
    )
    .eq("personaje_id", personajeId);

  const nodos: NodoPersonaje[] = [{ ...centro, esCentro: true }];
  const enlaces: EnlaceRelacion[] = [];

  for (const rel of relaciones ?? []) {
    const p = (rel as any).personaje_rel;
    if (!p) continue;
    if (!nodos.find((n) => n.id === p.id)) {
      nodos.push({ id: p.id, nombre: p.nombre, img_url: p.img_url });
    }
    enlaces.push({
      source: personajeId,
      target: p.id,
      tipo: rel.tipo,
    });
  }

  return { nodos, enlaces };
}
