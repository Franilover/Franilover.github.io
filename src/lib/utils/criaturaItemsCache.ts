/**
 * criaturaItemsCache.ts
 * ───────────────────────
 * Singleton de catálogo de ítems (tabla `items`), compartido entre
 * CriaturaItemsCraftedos y CriaturaItemsNaturales — un solo fetch
 * aunque haya múltiples bloques montados (criatura base + variantes).
 *
 * Ruta destino:
 *   src/lib/utils/criaturaItemsCache.ts
 */

import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";

export type ItemMin = { id: string; nombre: string; imagen_url?: string | null };

let _itemsData: ItemMin[] | null = null;
let _itemsPromise: Promise<ItemMin[]> | null = null;

export async function fetchAllItems(): Promise<ItemMin[]> {
  if (_itemsData) return _itemsData;
  if (_itemsPromise) return _itemsPromise;

  _itemsPromise = (async () => {
    // 1. Dexie primero
    try {
      if (db) {
        const local = await db.items.orderBy("nombre").toArray();
        if (local.length > 0) {
          _itemsData = local as ItemMin[];
          // Refrescar en background
          if (navigator.onLine) {
            supabase
              .from("items")
              .select("id, nombre, imagen_url")
              .order("nombre")
              .then(({ data }) => {
                if (data && data.length > 0) _itemsData = data as ItemMin[];
              });
          }
          return _itemsData;
        }
      }
    } catch {}

    // 2. Supabase
    if (!navigator.onLine) return [];
    const { data } = await supabase
      .from("items")
      .select("id, nombre, imagen_url")
      .order("nombre");
    _itemsData = (data ?? []) as ItemMin[];
    return _itemsData;
  })().finally(() => {
    _itemsPromise = null;
  });

  return _itemsPromise;
}
