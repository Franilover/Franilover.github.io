"use client";

/**
 * CriaturaItemsCraftedos.tsx
 * ───────────────────────────
 * Hook `useCraftedItems` + componente `BloqueItemsCraftedos`.
 * Muestra los ítems que fabrica/crea una criatura (tabla item_crafteres),
 * con opción de añadir/quitar y navegar al editor del ítem.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/criaturas/CriaturaItemsCraftedos.tsx
 */

import { Package, Plus, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";
import { fetchAllItems, type ItemMin } from "@/lib/utils/criaturaItemsCache";

// ─── Tipo ─────────────────────────────────────────────────────────────────────
export type CraftedItem = {
  crafterId: string;
  itemId: string;
  itemName: string;
  itemImg?: string | null;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useCraftedItems(criaturaId: string) {
  const [items, setItems] = useState<CraftedItem[]>([]);
  const [allItems, setAllItems] = useState<ItemMin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const [localDrops, catalogResult] = await Promise.all([
      db
        ? db.item_crafteres
            .where("criatura_id")
            .equals(criaturaId)
            .toArray()
            .catch(() => [])
        : Promise.resolve([]),
      fetchAllItems(),
    ]);

    setAllItems(catalogResult);

    if (localDrops.length > 0) {
      const itemMap = Object.fromEntries(catalogResult.map((i) => [i.id, i]));
      setItems(
        localDrops.map((r: any) => ({
          crafterId: r.id,
          itemId: r.item_id,
          itemName: itemMap[r.item_id]?.nombre ?? "—",
          itemImg: itemMap[r.item_id]?.imagen_url ?? null,
        })),
      );
      setLoading(false);
    }

    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("item_crafteres")
      .select(`id, item_id, items!item_id(nombre, imagen_url)`)
      .eq("criatura_id", criaturaId);

    const remoteItems: CraftedItem[] = (data ?? []).map((r: any) => ({
      crafterId: r.id,
      itemId: r.item_id,
      itemName:
        (Array.isArray(r.items) ? r.items[0]?.nombre : r.items?.nombre) ?? "—",
      itemImg:
        (Array.isArray(r.items)
          ? r.items[0]?.imagen_url
          : r.items?.imagen_url) ?? null,
    }));
    setItems(remoteItems);
    setLoading(false);

    try {
      if (db) {
        await db.item_crafteres
          .where("criatura_id")
          .equals(criaturaId)
          .delete();
        if (remoteItems.length > 0) {
          await db.item_crafteres.bulkPut(
            remoteItems.map((i) => ({
              id: i.crafterId,
              criatura_id: criaturaId,
              item_id: i.itemId,
            })),
          );
        }
      }
    } catch {}
  }, [criaturaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (item: ItemMin) => {
    if (items.some((i) => i.itemId === item.id)) return;
    const tempId = `temp_${item.id}`;
    setItems((prev) => [
      ...prev,
      {
        crafterId: tempId,
        itemId: item.id,
        itemName: item.nombre,
        itemImg: item.imagen_url ?? null,
      },
    ]);

    const { data, error } = await supabase
      .from("item_crafteres")
      .insert([{ item_id: item.id, criatura_id: criaturaId }])
      .select()
      .single();

    if (!error && data) {
      setItems((prev) =>
        prev.map((i) =>
          i.crafterId === tempId ? { ...i, crafterId: data.id } : i,
        ),
      );
      try {
        if (db)
          await db.item_crafteres.put({
            id: data.id,
            criatura_id: criaturaId,
            item_id: item.id,
          });
      } catch {}
      await supabase
        .from("items")
        .update({ origen: "Artificial", sub_origen: null })
        .eq("id", item.id);
      {
        const _ch = new BroadcastChannel("item_origen_sync");
        _ch.postMessage({
          itemId: item.id,
          origen: "Artificial",
          sub_origen: null,
        });
        _ch.close();
      }
    } else {
      setItems((prev) => prev.filter((i) => i.crafterId !== tempId));
    }
  };

  const remove = async (crafterId: string) => {
    setItems((prev) => prev.filter((i) => i.crafterId !== crafterId));
    try {
      if (db) await db.item_crafteres.delete(crafterId);
    } catch {}
    await supabase.from("item_crafteres").delete().eq("id", crafterId);
  };

  // El hook calcula los ítems disponibles para añadir, filtrados por búsqueda.
  // El componente no necesita acceder a allItems crudo.
  const getAvailable = (search: string): ItemMin[] =>
    allItems.filter(
      (it) =>
        it.nombre.toLowerCase().includes(search.toLowerCase()) &&
        !items.some((ci) => ci.itemId === it.id),
    );

  return { items, allItems, loading, add, remove, getAvailable };
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function BloqueItemsCraftedos({
  criaturaId,
  onSelectItem,
}: {
  criaturaId: string;
  onSelectItem?: (itemId: string) => void;
}) {
  const { items, loading, add, remove, getAvailable } =
    useCraftedItems(criaturaId);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = getAvailable(search);

  if (loading)
    return (
      <div className="flex items-center gap-1.5 py-1">
        <span className="text-micro text-primary/20 italic">Cargando…</span>
      </div>
    );

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-micro text-primary/20 italic py-2">
          Sin ítems creados
        </p>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {items.map((it) => (
            <div key={it.crafterId} className="relative group">
              <button
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                style={{
                  background:
                    "color-mix(in srgb, var(--primary) 4%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                }}
                onClick={() => onSelectItem?.(it.itemId)}
              >
                <div className="shrink-0 w-7 h-7 rounded-md overflow-hidden border border-primary/10 bg-primary/5 flex items-center justify-center">
                  {it.itemImg ? (
                    <Image
                      alt={it.itemName}
                      className="w-full h-full object-cover"
                      src={it.itemImg}
                    />
                  ) : (
                    <Package className="text-primary/20" size={11} />
                  )}
                </div>
                <span className="flex-1 text-micro font-bold text-primary/65 truncate leading-tight">
                  {it.itemName}
                </span>
              </button>

              <button
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-red-500/10 hover:bg-red-500/20 text-red-400/60 hover:text-red-400 border border-red-500/20 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  void remove(it.crafterId);
                }}
              >
                <X size={8} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <button
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-primary/15 text-micro font-black uppercase tracking-widest text-primary/30 hover:text-primary/60 hover:border-primary/30 transition-all cursor-pointer"
          onClick={() => setOpen((o) => !o)}
        >
          <Plus size={9} /> Añadir ítem
        </button>
        {open && (
          <div
            className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl shadow-xl overflow-hidden"
            style={{
              background: "var(--bg-main)",
              border:
                "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
            }}
          >
            <div
              className="p-1.5 border-b"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 8%, transparent)",
              }}
            >
              <input
                autoFocus
                className="w-full bg-transparent text-micro text-primary outline-none placeholder:text-primary/30 px-1.5 py-0.5"
                placeholder="Buscar ítem…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-40 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="text-micro text-primary/25 italic text-center py-3">
                  Sin resultados
                </p>
              )}
              {filtered.map((it) => (
                <button
                  key={it.id}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-primary/5 transition-colors text-left cursor-pointer"
                  onClick={() => {
                    void add(it);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <div className="shrink-0 w-5 h-5 rounded-md overflow-hidden border border-primary/10 bg-primary/5 flex items-center justify-center">
                    {it.imagen_url ? (
                      <Image
                        alt={it.nombre}
                        className="w-full h-full object-cover"
                        src={it.imagen_url}
                      />
                    ) : (
                      <Package className="text-primary/20" size={8} />
                    )}
                  </div>
                  <span className="text-micro font-bold text-primary/65 truncate">
                    {it.nombre}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
