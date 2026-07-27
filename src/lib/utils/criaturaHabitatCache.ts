/**
 * criaturaHabitatCache.ts
 * ─────────────────────────
 * Caches de módulo compartidas para reinos, ciudades y personajes.
 * Evita que useCriaturaReinos, useCriaturaCiudades, CriaturaHabitat y el
 * useEffect de EditorCriatura hagan toArray() / queries de red por separado
 * en cada mount.
 *
 * Ruta destino:
 *   src/lib/utils/criaturaHabitatCache.ts
 */

import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type ReinoMin = { id: string; nombre: string };
export type CiudadMin = { id: string; nombre: string; reino_id: string | null };
export type PersonajeMin = { id: string; nombre: string; img_url?: string | null };

export type CriaturaReinoRow = { rowId: string; reinoId: string; reinoNombre: string };
export type CriaturaCiudadRow = {
  rowId: string;
  ciudadId: string;
  ciudadNombre: string;
  reinoId: string | null;
};

// ─── Reinos — TTL 30 min (muy estables) ──────────────────────────────────────
let _reinosCache: ReinoMin[] | null = null;
let _reinosCacheTs = 0;
const REINOS_TTL = 30 * 60_000;

export async function getAllReinos(): Promise<ReinoMin[]> {
  if (_reinosCache && Date.now() - _reinosCacheTs < REINOS_TTL)
    return _reinosCache;
  try {
    if (db) {
      const local: any[] = (await (db as any).reinos?.toArray()) ?? [];
      if (local.length) {
        _reinosCache = local.map((r: any) => ({ id: r.id, nombre: r.nombre }));
        _reinosCacheTs = Date.now();
        // Refrescar en background
        if (navigator.onLine)
          supabase
            .from("reinos")
            .select("id, nombre")
            .order("nombre")
            .then(({ data }) => {
              if (data?.length) {
                _reinosCache = data as ReinoMin[];
                _reinosCacheTs = Date.now();
              }
            });
        return _reinosCache;
      }
    }
  } catch {}
  if (!navigator.onLine) return _reinosCache ?? [];
  const { data } = await supabase
    .from("reinos")
    .select("id, nombre")
    .order("nombre");
  _reinosCache = (data ?? []) as ReinoMin[];
  _reinosCacheTs = Date.now();
  return _reinosCache;
}

// ─── Ciudades — TTL 30 min ────────────────────────────────────────────────────
let _ciudadesCache: CiudadMin[] | null = null;
let _ciudadesCacheTs = 0;
const CIUDADES_TTL = 30 * 60_000;

export async function getAllCiudades(): Promise<CiudadMin[]> {
  if (_ciudadesCache && Date.now() - _ciudadesCacheTs < CIUDADES_TTL)
    return _ciudadesCache;
  try {
    if (db) {
      const local: any[] = (await (db as any).ciudades?.toArray()) ?? [];
      if (local.length) {
        _ciudadesCache = local.map((l: any) => ({
          id: l.id,
          nombre: l.nombre,
          reino_id: l.reino_id ?? null,
        }));
        _ciudadesCacheTs = Date.now();
        if (navigator.onLine)
          supabase
            .from("ciudades")
            .select("id, nombre, reino_id")
            .order("nombre")
            .then(({ data }) => {
              if (data?.length) {
                _ciudadesCache = data.map((l: any) => ({
                  ...l,
                  reino_id: l.reino_id ?? null,
                }));
                _ciudadesCacheTs = Date.now();
              }
            });
        return _ciudadesCache;
      }
    }
  } catch {}
  if (!navigator.onLine) return _ciudadesCache ?? [];
  const { data } = await supabase
    .from("ciudades")
    .select("id, nombre, reino_id")
    .order("nombre");
  _ciudadesCache = (data ?? []).map((l: any) => ({
    ...l,
    reino_id: l.reino_id ?? null,
  }));
  _ciudadesCacheTs = Date.now();
  return _ciudadesCache;
}

// ─── Personajes (catálogo completo para el selector) — TTL 10 min ───────────
let _personajesCache: PersonajeMin[] | null = null;
let _personajesCacheTs = 0;
const PERSONAJES_TTL = 10 * 60_000;

export async function getAllPersonajes(): Promise<PersonajeMin[]> {
  if (_personajesCache && Date.now() - _personajesCacheTs < PERSONAJES_TTL)
    return _personajesCache;
  try {
    if (db) {
      const local: any[] = (await (db as any).personajes?.toArray()) ?? [];
      if (local.length) {
        _personajesCache = local.map((p: any) => ({
          id: p.id,
          nombre: p.nombre,
          img_url: p.img_url ?? null,
        }));
        _personajesCacheTs = Date.now();
        if (navigator.onLine)
          supabase
            .from("personajes")
            .select("id, nombre, img_url")
            .order("nombre")
            .then(({ data }) => {
              if (data?.length) {
                _personajesCache = data as PersonajeMin[];
                _personajesCacheTs = Date.now();
              }
            });
        return _personajesCache!;
      }
    }
  } catch {}
  if (!navigator.onLine) return _personajesCache ?? [];
  const { data } = await supabase
    .from("personajes")
    .select("id, nombre, img_url")
    .order("nombre");
  _personajesCache = (data ?? []) as PersonajeMin[];
  _personajesCacheTs = Date.now();
  return _personajesCache!;
}

// ─── Cache de criatura_reinos por criatura — TTL 5 min ───────────────────────
export const criaturaReinosCache = new Map<
  string,
  { data: CriaturaReinoRow[]; ts: number }
>();

// ─── Cache de criatura_ciudades por criatura — TTL 5 min ─────────────────────
export const criaturaCiudadesCache = new Map<
  string,
  { data: CriaturaCiudadRow[]; ts: number }
>();

export const CRIATURA_REL_TTL = 5 * 60_000;
