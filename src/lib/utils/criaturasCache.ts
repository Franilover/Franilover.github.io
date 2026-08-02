/**
 * criaturasCache.ts
 * ───────────────────
 * Singleton de catálogo de criaturas (tabla `criaturas`), compartido entre
 * todos los selectores "Criatura" del editor (Items, Runas)
 * — un solo fetch aunque haya múltiples selectores montados a la vez.
 *
 * Mismo patrón que criaturaItemsCache.ts.
 *
 * Ruta destino:
 *   src/lib/utils/criaturasCache.ts
 */

import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";

export type CriaturaMin = {
  id: string;
  nombre: string;
  imagen_url?: string | null;
};

let _criaturasData: CriaturaMin[] | null = null;
let _criaturasPromise: Promise<CriaturaMin[]> | null = null;

export async function fetchAllCriaturas(): Promise<CriaturaMin[]> {
  if (_criaturasData) return _criaturasData;
  if (_criaturasPromise) return _criaturasPromise;

  _criaturasPromise = (async () => {
    // 1. Dexie primero
    try {
      if (db) {
        const local = await db.criaturas.orderBy("nombre").toArray();
        if (local.length > 0) {
          _criaturasData = local as CriaturaMin[];
          // Refrescar en background
          if (navigator.onLine) {
            supabase
              .from("criaturas")
              .select("id, nombre, imagen_url")
              .order("nombre")
              .then(({ data }) => {
                if (data && data.length > 0) _criaturasData = data as CriaturaMin[];
              });
          }
          return _criaturasData;
        }
      }
    } catch {}

    // 2. Supabase
    if (!navigator.onLine) return [];
    const { data } = await supabase
      .from("criaturas")
      .select("id, nombre, imagen_url")
      .order("nombre");
    _criaturasData = (data ?? []) as CriaturaMin[];
    return _criaturasData;
  })().finally(() => {
    _criaturasPromise = null;
  });

  return _criaturasPromise;
}

/** Invalida el cache en memoria (ej. tras crear una criatura nueva). */
export function invalidateCriaturasCache() {
  _criaturasData = null;
}
