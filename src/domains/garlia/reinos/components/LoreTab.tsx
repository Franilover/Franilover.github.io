// Migrado desde _legacy/components/shared/LoreTab.tsx a domains/garlia/reinos.
// Es la vista de detalle (tabs de mapa/sociedad/línea de tiempo) de un reino,
// específica de esta entidad — no la usa ninguna otra vista legacy, a
// diferencia de SaveIndicator/useWikilink/INPUT_CLS, que sí son compartidos
// entre entidades y por eso siguen importándose desde _legacy (mismo patrón
// que ya usan criaturas/items).
import {
  Mountain,
  Users,
  Trash2,
  UserCircle2,
  Loader2,
  MapPin,
  Map,
  Check,
  X,
  Eye,
  EyeOff,
  Bug,
  Package,
  SlidersHorizontal,
} from "lucide-react";
import Image from "next/image";
import React, { useState, useRef, useEffect, useCallback } from "react";

import type { WikiEntity } from "@/components/forms/Markdown/commandItems";
import { RichEditor } from "@/components/forms/lexical-editor";
import { useConfirm } from "@/components/ui/ConfirmModal";
import { SeccionEntidad } from "@/components/ui/SeccionEntidad";
import { INPUT_CLS, type SaveStatus } from "@/domains/garlia/_shared/types";
import { type Ciudad } from "@/domains/garlia/ciudades";
import { PanelHistoriaMundo } from "@/domains/garlia/libros/EditorLineaTiempo";
import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";

import { SaveIndicator } from "@/domains/garlia/_shared/UIComponents";
import { useWikilink } from "@/domains/garlia/_shared/WikilinkContext";

import { type Reino } from "../model";
import { reinosQueries } from "../queries";

// ─── Tipo Personaje (local) ───────────────────────────────────────────────────
type Personaje = {
  id: string;
  nombre: string;
  img_url?: string | null;
  especie?: string | null;
  sobre?: string | null;
};

// ─── Dexie helpers ────────────────────────────────────────────────────────────
async function dexiePut(tabla: string, row: any): Promise<void> {
  try {
    if (db) await (db as any)[tabla]?.put(row);
  } catch {}
}
async function dexieDel(tabla: string, id: string): Promise<void> {
  try {
    if (db) await (db as any)[tabla]?.delete(id);
  } catch {}
}
async function dexieReadAll<T>(
  tabla: string,
  filter?: (r: any) => boolean,
): Promise<T[]> {
  try {
    if (!db) return [];
    const t = (db as any)[tabla];
    if (!t) return [];
    const all: any[] = await t.toArray();
    return all.filter((r) => !r.deleted && (!filter || filter(r))) as T[];
  } catch {
    return [];
  }
}
async function dexieWriteAll(
  tabla: string,
  rows: any[],
  keyField = "id",
): Promise<void> {
  try {
    if (!db) return;
    const t = (db as any)[tabla];
    if (!t) return;
    if (rows.length > 0) await t.bulkPut(rows);
    const remoteIds = new Set(rows.map((r: any) => r[keyField]));
    const local: any[] = await t.toArray();
    const toDelete = local
      .map((r: any) => r[keyField])
      .filter((id: string) => !remoteIds.has(id));
    if (toDelete.length > 0) await t.bulkDelete(toDelete);
  } catch {}
}

// ─── DetalleEditor ─────────────────────────────────────────────────────────────

function DetalleEditor({
  detalle,
  onSaved,
  onDeleted,
  onOpenEditor,
  entities = [],
}: {
  detalle: Ciudad;
  onSaved: (d: Ciudad) => void;
  onDeleted: (id: string) => void;
  onOpenEditor?: (id: string) => void;
  entities?: WikiEntity[];
}) {
  const [form, setForm] = useState(detalle);
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const { confirm, ConfirmModal } = useConfirm();
  const { onWikilink } = useWikilink();
  const prevCoords = useRef({ x: detalle.coord_x, y: detalle.coord_y });
  useEffect(() => {
    if (
      detalle.coord_x !== prevCoords.current.x ||
      detalle.coord_y !== prevCoords.current.y
    ) {
      prevCoords.current = { x: detalle.coord_x, y: detalle.coord_y };
      setForm((f) => ({
        ...f,
        coord_x: detalle.coord_x,
        coord_y: detalle.coord_y,
      }));
    }
  }, [detalle.coord_x, detalle.coord_y]);

  const saveDetalle = async (data: Ciudad) => {
    setStatus("saving");
    try {
      const { error } = await supabase
        .from("ciudades")
        .update({
          nombre: data.nombre,
          descripcion: data.descripcion,
          coord_x: data.coord_x,
          coord_y: data.coord_y,
          oculto: data.oculto ?? false,
        })
        .eq("id", data.id);
      if (error) throw error;
      setStatus("saved");
      onSaved(data);
      void dexiePut("ciudades", data);
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  };

  const toggleOculto = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nuevo = { ...form, oculto: !form.oculto };
    setForm(nuevo);
    await saveDetalle(nuevo);
  };

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        border: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
        background: "color-mix(in srgb, var(--primary) 2%, transparent)",
      }}
    >
      <ConfirmModal />
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <MapPin
          className={`shrink-0 ${form.oculto ? "text-primary/20" : "text-primary/40"}`}
          size={11}
        />
        <span
          className={`flex-1 text-micro font-black uppercase tracking-widest truncate ${form.oculto ? "text-primary/30 line-through" : "text-primary"}`}
        >
          {form.nombre}
        </span>
        {form.oculto && (
          <span className="shrink-0 text-micro font-black uppercase tracking-widest text-orange-400/70 bg-orange-400/10 border border-orange-400/20 px-1.5 py-0.5 rounded-lg flex items-center gap-1">
            <EyeOff size={8} /> Oculto
          </span>
        )}
        <button
          className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest transition-all border ${
            form.oculto
              ? "text-orange-400 bg-orange-400/10 border-orange-400/30"
              : "text-primary/40 bg-primary/5 border-primary/10 hover:text-primary"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            void toggleOculto();
          }}
        >
          {form.oculto ? <Eye size={9} /> : <EyeOff size={9} />}
        </button>
        <X
          className="text-primary/25 transition-transform duration-200"
          size={12}
          style={{ transform: expanded ? "rotate(45deg)" : undefined }}
        />
      </div>

      {expanded && (
        <div
          className="px-3 pb-3 pt-0 border-t space-y-3"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 6%, transparent)",
          }}
        >
          <div className="mt-3">
            <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35">
              Nombre
            </label>
            <input
              className={INPUT_CLS + " mt-1"}
              placeholder="Nombre de la ciudad"
              value={form.nombre}
              onChange={(e) =>
                setForm((f) => ({ ...f, nombre: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35 block mb-1">
              Descripción
            </label>
            <RichEditor
              minHeight="6rem"
              mode="edit"
              placeholder="Describe esta ciudad…"
              showSplitMode={false}
              value={form.descripcion ?? ""}
              wikiEntities={entities}
              onChange={(v) => setForm((f) => ({ ...f, descripcion: v }))}
              onWikilinkNavigate={onWikilink}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-micro font-black uppercase tracking-widest text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
                onClick={async (e) => {
                  e.stopPropagation();
                  const ok = await confirm({
                    message: `¿Eliminar punto "${form.nombre}"?`,
                    danger: true,
                  });
                  if (!ok) return;
                  await supabase.from("ciudades").delete().eq("id", form.id);
                  void dexieDel("ciudades", form.id);
                  onDeleted(form.id);
                }}
              >
                <Trash2 size={10} /> Eliminar
              </button>
              {onOpenEditor && (
                <button
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary hover:bg-primary/5 transition-all border border-primary/10 hover:border-primary/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenEditor(form.id);
                  }}
                >
                  <MapPin size={10} /> Ver ficha
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <SaveIndicator status={status} />
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-btn-text rounded-xl text-micro font-black uppercase tracking-widest hover:bg-primary/90 transition-all"
                onClick={() => saveDetalle(form)}
              >
                <Check size={10} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MapaNuevo — canvas full height + overlays flotantes ─────────────────────
function MapaNuevo({
  MapaConPuntosComponent,
  detalles,
  entities: _entities,
  onDetalleUpdate: _onDetalleUpdate,
  onDetalleDelete: _onDetalleDelete,
  onOpenDetalleEditor: _onOpenDetalleEditor,
  form,
  setForm,
  onWikilinkNavigate,
  onDetallesArrayChange,
}: {
  MapaConPuntosComponent?: React.ComponentType<any>;
  detalles: Ciudad[];
  entities: WikiEntity[];
  onDetalleUpdate?: (d: Ciudad) => void;
  onDetalleDelete?: (id: string) => void;
  onOpenDetalleEditor?: (id: string) => void;
  form: Reino;
  setForm: React.Dispatch<React.SetStateAction<Reino>>;
  onWikilinkNavigate?: (target: string) => void;
  onDetallesArrayChange?: (d: Ciudad[]) => void;
}) {
  const [geoOpen, setGeoOpen] = useState(false);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Canvas full height */}
      {MapaConPuntosComponent ? (
        <MapaConPuntosComponent
          detalles={detalles}
          mapaUrl={""}
          onDetallesChange={(d: any) => onDetallesArrayChange?.(d)}
          onMapaChange={() => {}}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-primary/20">
          <Map size={22} strokeWidth={1} />
          <span className="text-micro font-black uppercase tracking-widest">
            Sin mapa
          </span>
        </div>
      )}

      {/* ── Botones flotantes bottom-right ── */}
      <div className="absolute bottom-3 right-3 z-10 flex gap-1.5">
        {/* Geografía */}
        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-micro font-black uppercase tracking-widest transition-opacity hover:opacity-80"
          style={{
            background: geoOpen
              ? "color-mix(in srgb, var(--accent) 18%, transparent)"
              : "color-mix(in srgb, var(--bg-main) 85%, transparent)",
            backdropFilter: "blur(10px)",
            border: geoOpen
              ? "1px solid color-mix(in srgb, var(--accent) 28%, transparent)"
              : "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
            borderRadius: "6px",
            color: geoOpen
              ? "color-mix(in srgb, var(--accent) 80%, transparent)"
              : "color-mix(in srgb, var(--foreground) 45%, transparent)",
          }}
          onClick={() => {
            setGeoOpen((v) => !v);
          }}
        >
          <Mountain size={9} /> Geografía
        </button>
      </div>

      {/* ── Drawer de Geografía ── */}
      {geoOpen && (
        <div
          className="absolute top-0 right-0 bottom-0 z-20 flex flex-col w-64 shadow-2xl"
          style={{
            background: "color-mix(in srgb, var(--bg-main) 95%, transparent)",
            backdropFilter: "blur(16px)",
            borderLeft:
              "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
          }}
        >
          <div
            className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0"
            style={{
              borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            }}
          >
            <Mountain size={10} style={{ color: "var(--accent)" }} />
            <span
              className="flex-1 text-micro font-black uppercase tracking-[0.2em]"
              style={{
                color: "color-mix(in srgb, var(--foreground) 40%, transparent)",
              }}
            >
              Geografía
            </span>
            <button
              className="text-primary/25 hover:text-primary/60 transition-colors"
              onClick={() => setGeoOpen(false)}
            >
              <X size={12} />
            </button>
          </div>
          <div className="flex-1 p-3 overflow-y-auto">
            <RichEditor
              key="geografia"
              minHeight="25rem"
              mode="edit"
              placeholder="Paisajes, clima, fronteras, ciudades principales…"
              showSplitMode={false}
              value={(form as any).geografia ?? ""}
              onChange={(v) => setForm((f) => ({ ...f, geografia: v }))}
              onWikilinkNavigate={onWikilinkNavigate}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tipos mínimos ────────────────────────────────────────────────────────────
type CriaturaMin = { id: string; nombre: string; imagen_url?: string | null };
type PersonajeMin = { id: string; nombre: string; img_url?: string | null };
type ItemMin = { id: string; nombre: string; imagen_url?: string | null };

// ─── Hook: criaturas vinculadas al reino (criatura_reinos) ────────────────────
// Soporta add (INSERT) y remove (DELETE) además de carga.
// Las llamadas a supabase.from("criatura_reinos"/"criaturas") que vivían acá
// sueltas pasaron a reinosQueries (get/add/removeCriaturaVinculada).

function useCriaturasDelReino(reinoId: string) {
  const [criaturas, setCriaturas] = useState<CriaturaMin[]>([]);
  const [allCriaturas, setAllCriaturas] = useState<CriaturaMin[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowMap, setRowMap] = useState<Record<string, string>>({}); // criaturaId → rowId

  const load = useCallback(async () => {
    setLoading(true);

    // ── 1. Local Dexie ──────────────────────────────────────────────────────
    const [localLinked, localAll] = await Promise.all([
      dexieReadAll<any>("criatura_reinos", (r) => r.reino_id === reinoId),
      dexieReadAll<CriaturaMin>("criaturas"),
    ]);
    if (localLinked.length) {
      const allMap = Object.fromEntries(localAll.map((c) => [c.id, c]));
      const map: Record<string, string> = {};
      setCriaturas(
        localLinked.map((r) => {
          map[r.criatura_id] = r.id;
          return (
            allMap[r.criatura_id] ?? {
              id: r.criatura_id,
              nombre: "—",
              imagen_url: null,
            }
          );
        }),
      );
      setRowMap(map);
      if (localAll.length) setAllCriaturas(localAll);
      setLoading(false);
    }

    if (!navigator.onLine) {
      if (!localLinked.length) setLoading(false);
      return;
    }

    // ── 2. Remoto Supabase ──────────────────────────────────────────────────
    const [linked, all] = await Promise.all([
      reinosQueries.getCriaturasVinculadas(reinoId),
      supabase
        .from("criaturas")
        .select("id, nombre, imagen_url")
        .order("nombre")
        .then((r) => r.data),
    ]);
    if (linked) {
      const map: Record<string, string> = {};
      const result = linked.map((r: any) => {
        const c = Array.isArray(r.criaturas) ? r.criaturas[0] : r.criaturas;
        map[c?.id ?? r.criatura_id] = r.id;
        return {
          id: c?.id ?? r.criatura_id,
          nombre: c?.nombre ?? "—",
          imagen_url: c?.imagen_url ?? null,
        };
      });
      setCriaturas(result);
      setRowMap(map);
      // Persistir filas planas (sin el join) para uso offline
      const rows = linked.map((r: any) => ({
        id: r.id,
        reino_id: reinoId,
        criatura_id: r.criatura_id,
      }));
      if (db && (db as any).criatura_reinos)
        await (db as any).criatura_reinos.bulkPut(rows);
    }
    if (all) {
      setAllCriaturas(all);
      await dexieWriteAll("criaturas", all);
    }
    setLoading(false);
  }, [reinoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (criaturaId: string) => {
    try {
      const data = await reinosQueries.addCriaturaVinculada(reinoId, criaturaId);
      const found = allCriaturas.find((c) => c.id === criaturaId);
      if (found) {
        setCriaturas((prev) => [...prev, found]);
        setRowMap((prev) => ({ ...prev, [criaturaId]: data.id }));
        void dexiePut("criatura_reinos", {
          id: data.id,
          reino_id: reinoId,
          criatura_id: criaturaId,
        });
      }
    } catch {}
  };

  const remove = async (criaturaId: string) => {
    const rowId = rowMap[criaturaId];
    if (!rowId) return;
    try {
      await reinosQueries.removeCriaturaVinculada(rowId);
      setCriaturas((prev) => prev.filter((c) => c.id !== criaturaId));
      setRowMap((prev) => {
        const next = { ...prev };
        delete next[criaturaId];
        return next;
      });
      void dexieDel("criatura_reinos", rowId);
    } catch {}
  };

  return { criaturas, allCriaturas, loading, add, remove };
}

// ─── Hook: personajes del reino (personajes.reino = nombre del reino) ─────────
// add → UPDATE personajes SET reino = reinoNombre WHERE id = personajeId
// remove → UPDATE personajes SET reino = null WHERE id = personajeId

function usePersonajesDelReinoEditable(reinoId: string, reinoNombre: string) {
  const [personajes, setPersonajes] = useState<PersonajeMin[]>([]);
  const [allPersonajes, setAllPersonajes] = useState<PersonajeMin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    // ── 1. Local Dexie ──────────────────────────────────────────────────────
    const [localLinked, localAll] = await Promise.all([
      dexieReadAll<PersonajeMin>("personajes", (r) => r.reino === reinoNombre),
      dexieReadAll<PersonajeMin>("personajes"),
    ]);
    if (localLinked.length) {
      setPersonajes(localLinked);
      if (localAll.length) setAllPersonajes(localAll);
      setLoading(false);
    }

    if (!reinoNombre || !navigator.onLine) {
      if (!localLinked.length) setLoading(false);
      return;
    }

    // ── 2. Remoto Supabase ──────────────────────────────────────────────────
    const [{ data: linked }, { data: all }] = await Promise.all([
      supabase
        .from("personajes")
        .select("id, nombre, img_url")
        .eq("reino", reinoNombre)
        .order("nombre"),
      supabase.from("personajes").select("id, nombre, img_url").order("nombre"),
    ]);
    if (linked) setPersonajes(linked);
    if (all) {
      setAllPersonajes(all);
      await dexieWriteAll("personajes", all);
    }
    setLoading(false);
  }, [reinoNombre]);

  useEffect(() => {
    if (reinoNombre) void load();
  }, [load, reinoNombre]);

  const add = async (personajeId: string) => {
    const { error } = await supabase
      .from("personajes")
      .update({ reino: reinoNombre })
      .eq("id", personajeId);
    if (!error) {
      const found = allPersonajes.find((p) => p.id === personajeId);
      if (found) {
        setPersonajes((prev) => [...prev, found]);
        void dexiePut("personajes", { ...found, reino: reinoNombre });
      }
    }
  };

  const remove = async (personajeId: string) => {
    const { error } = await supabase
      .from("personajes")
      .update({ reino: null })
      .eq("id", personajeId);
    if (!error) {
      setPersonajes((prev) => prev.filter((p) => p.id !== personajeId));
      const found = allPersonajes.find((p) => p.id === personajeId);
      if (found) void dexiePut("personajes", { ...found, reino: null });
    }
  };

  return { personajes, allPersonajes, loading, add, remove };
}

// ─── Hook: items del reino (items.reino_ids — misma relación real que usa
// PanelTerritorio en el editor del ítem) ───────────────────────────────────
// add    → UPDATE items SET reino_ids = reino_ids + [reinoId] WHERE id = itemId
// remove → UPDATE items SET reino_ids = reino_ids - [reinoId] WHERE id = itemId
// Antes esta sección se armaba agregando items por su ciudad (items.ciudad_id
// → ciudades.reino_id), una relación indirecta y de solo lectura que no tenía
// nada que ver con el campo `reino_ids` que de verdad usa el ítem (visible en
// su propio panel "Territorio"). Por eso un ítem podía aparecer listado acá
// sin tener ningún reino cargado al abrirlo. Ahora usa la misma relación real
// en ambos lados, así queda consistente y es editable desde acá también.

type ItemMinConReinos = ItemMin & { reino_ids?: string[] | null };

function useItemsDelReinoEditable(reinoId: string) {
  const [items, setItems] = useState<ItemMinConReinos[]>([]);
  const [allItems, setAllItems] = useState<ItemMinConReinos[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    // ── 1. Local Dexie ──────────────────────────────────────────────────────
    const [localLinked, localAll] = await Promise.all([
      dexieReadAll<ItemMinConReinos>("items", (r) =>
        Array.isArray(r.reino_ids) ? r.reino_ids.includes(reinoId) : false,
      ),
      dexieReadAll<ItemMinConReinos>("items"),
    ]);
    if (localLinked.length) {
      setItems(localLinked.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      if (localAll.length) setAllItems(localAll);
      setLoading(false);
    }

    if (!navigator.onLine) {
      if (!localLinked.length) setLoading(false);
      return;
    }

    // ── 2. Remoto Supabase ──────────────────────────────────────────────────
    const [{ data: linked }, { data: all }] = await Promise.all([
      supabase
        .from("items")
        .select("id, nombre, imagen_url, reino_ids")
        .contains("reino_ids", [reinoId]),
      supabase
        .from("items")
        .select("id, nombre, imagen_url, reino_ids")
        .order("nombre"),
    ]);
    if (linked) {
      setItems([...linked].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    }
    if (all) {
      setAllItems(all);
      await dexieWriteAll("items", all);
    }
    setLoading(false);
  }, [reinoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (itemId: string) => {
    const found = allItems.find((i) => i.id === itemId);
    const nextReinoIds = [...(found?.reino_ids ?? []), reinoId];
    const { error } = await supabase
      .from("items")
      .update({ reino_ids: nextReinoIds })
      .eq("id", itemId);
    if (!error && found) {
      const updated = { ...found, reino_ids: nextReinoIds };
      setItems((prev) => [...prev, updated]);
      setAllItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
      void dexiePut("items", updated);
    }
  };

  const remove = async (itemId: string) => {
    const found = allItems.find((i) => i.id === itemId);
    const nextReinoIds = (found?.reino_ids ?? []).filter(
      (id) => id !== reinoId,
    );
    const { error } = await supabase
      .from("items")
      .update({ reino_ids: nextReinoIds })
      .eq("id", itemId);
    if (!error) {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      if (found) {
        const updated = { ...found, reino_ids: nextReinoIds };
        setAllItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
        void dexiePut("items", updated);
      }
    }
  };

  return { items, allItems, loading, add, remove };
}

// ─── NAV config ───────────────────────────────────────────────────────────────

type SectionId =
  | "mapa"
  | "historia"
  | "cultura"
  | "politica"
  | "economia"
  | "sociedad"
  | "puntos"
  | "geografia"
  | "lineatiempo";

// ─── Componente principal — Doble columna con infinity scroll ────────────────

export function LoreTab({
  form,
  setForm,
  entities = [],
  personajes: _personajes = [],
  loadingPersonajes: _loadingPersonajes = false,
  onSelectPersonaje,
  onSelectCriatura,
  onSelectItem,
  reinos: _reinos = [],
  filtroReinoId,
  detalles = [],
  onDetallesChange: _onDetallesChange,
  onDetalleUpdate,
  onDetalleDelete,
  onOpenDetalleEditor,
  mapaUrl: _mapaUrl = "",
  onMapaChange: _onMapaChange,
  onDetallesArrayChange,
  MapaConPuntosComponent,
  activeTab: activeTabProp,
  mobileAsideOpen: mobileAsideOpenProp,
  setMobileAsideOpen: setMobileAsideOpenProp,
}: {
  form: Reino;
  setForm: React.Dispatch<React.SetStateAction<Reino>>;
  entities?: WikiEntity[];
  personajes?: Personaje[];
  loadingPersonajes?: boolean;
  onSelectPersonaje?: (personaje: Personaje) => void;
  onSelectCriatura?: (id: string) => void;
  onSelectItem?: (id: string) => void;
  reinos?: { id: string; nombre: string }[];
  filtroReinoId?: string | null;
  detalles?: Ciudad[];
  onDetallesChange?: (updated: Ciudad) => void;
  onDeleteDetalle?: (id: string) => void;
  onDetalleUpdate?: (d: Ciudad) => void;
  onDetalleDelete?: (id: string) => void;
  onOpenDetalleEditor?: (id: string) => void;
  mapaUrl?: string;
  onMapaChange?: (url: string) => void;
  onDetallesArrayChange?: (d: Ciudad[]) => void;
  MapaConPuntosComponent?: React.ComponentType<any>;
  activeTab?: SectionId;
  mobileAsideOpen?: boolean;
  setMobileAsideOpen?: (v: boolean) => void;
}) {
  const { onWikilink } = useWikilink();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<
    "mapa" | "sociedad" | "lineatiempo"
  >(
    activeTabProp === "mapa"
      ? "mapa"
      : activeTabProp === "lineatiempo"
        ? "lineatiempo"
        : "sociedad",
  );
  const {
    criaturas,
    allCriaturas,
    loading: loadingCriaturas,
    add: addCriatura,
    remove: removeCriatura,
  } = useCriaturasDelReino(form.id);
  const {
    personajes: personajesEditables,
    allPersonajes,
    loading: loadingPersonajesEditables,
    add: addPersonaje,
    remove: removePersonaje,
  } = usePersonajesDelReinoEditable(form.id, form.nombre);
  const { items, allItems, loading: loadingItems, add: addItem, remove: removeItem } =
    useItemsDelReinoEditable(form.id);

  // Estado saving por sección
  const [savingCriaturas, setSavingCriaturas] = useState(false);
  const [savingPersonajes, setSavingPersonajes] = useState(false);
  const [savingItems, setSavingItems] = useState(false);
  const [_mobileAsideOpen, _setMobileAsideOpen] = useState(false);
  const mobileAsideOpen = mobileAsideOpenProp ?? _mobileAsideOpen;
  const setMobileAsideOpen = setMobileAsideOpenProp ?? _setMobileAsideOpen;

  const handleToggleCriatura = async (id: string, add: boolean) => {
    setSavingCriaturas(true);
    if (add) await addCriatura(id);
    else await removeCriatura(id);
    setSavingCriaturas(false);
  };
  const handleTogglePersonaje = async (id: string, add: boolean) => {
    setSavingPersonajes(true);
    if (add) await addPersonaje(id);
    else await removePersonaje(id);
    setSavingPersonajes(false);
  };
  const handleToggleItem = async (id: string, add: boolean) => {
    setSavingItems(true);
    if (add) await addItem(id);
    else await removeItem(id);
    setSavingItems(false);
  };

  // ── Etiqueta de sección ───────────────────────────────────────────────────
  const SectionHeader = ({
    id,
    label,
    Icon,
  }: {
    id: SectionId;
    label: string;
    Icon: React.ElementType;
  }) => (
    <header
      className="flex items-center gap-1.5 mb-2 select-none"
      id={`lore-section-${id}`}
    >
      <Icon
        size={10}
        style={{ color: "color-mix(in srgb, var(--primary) 30%, transparent)" }}
      />
      <span
        className="text-micro font-black uppercase tracking-[0.22em]"
        style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
      >
        {label}
      </span>
      <div
        className="flex-1 h-px"
        style={{
          background: "color-mix(in srgb, var(--primary) 8%, transparent)",
        }}
      />
    </header>
  );

  const TABS = [
    { id: "mapa", label: "Mapa" },
    { id: "sociedad", label: "Sociedad" },
    { id: "lineatiempo", label: "Línea de tiempo" },
  ] as const;

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* ── COLUMNA 1 — Tabs + Editor central ───────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {/* BARRA DE TABS — siempre visible arriba */}
        <div
          className="shrink-0 flex border-b"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background: "color-mix(in srgb, var(--primary) 2%, transparent)",
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className="flex-1 px-2 py-2 text-micro font-black uppercase tracking-widest transition-all border-b-2"
              style={
                activeTab === tab.id
                  ? { borderColor: "var(--primary)", color: "var(--primary)" }
                  : {
                      borderColor: "transparent",
                      color:
                        "color-mix(in srgb, var(--primary) 35%, transparent)",
                    }
              }
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* MAPA — full height, sin scroll wrapper */}
        {activeTab === "mapa" && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <MapaNuevo
              MapaConPuntosComponent={MapaConPuntosComponent}
              detalles={detalles}
              entities={entities}
              form={form}
              setForm={setForm}
              onDetalleDelete={onDetalleDelete}
              onDetalleUpdate={onDetalleUpdate}
              onDetallesArrayChange={onDetallesArrayChange}
              onOpenDetalleEditor={onOpenDetalleEditor}
              onWikilinkNavigate={onWikilink}
            />
          </div>
        )}

        {/* RESTO DE TABS — con scroll y padding normal */}
        {activeTab !== "mapa" && (
          <main
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto"
            style={{ scrollbarWidth: "none" }}
          >
            <div className="p-3 flex flex-col gap-4">
              {/* SOCIEDAD — cultura, política y economía en 3 columnas */}
              {activeTab === "sociedad" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35">
                      Cultura
                    </label>
                    <RichEditor
                      key="cultura"
                      minHeight="22.5rem"
                      mode="edit"
                      placeholder="Tradiciones, religión, idioma, costumbres, arte…"
                      showSplitMode={false}
                      value={(form as any).cultura ?? ""}
                      wikiEntities={entities}
                      onChange={(v) => setForm((f) => ({ ...f, cultura: v }))}
                      onWikilinkNavigate={onWikilink}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35">
                      Política
                    </label>
                    <RichEditor
                      key="politica"
                      minHeight="22.5rem"
                      mode="edit"
                      placeholder="Sistema de gobierno, facciones, líderes, leyes…"
                      showSplitMode={false}
                      value={(form as any).politica ?? ""}
                      wikiEntities={entities}
                      onChange={(v) => setForm((f) => ({ ...f, politica: v }))}
                      onWikilinkNavigate={onWikilink}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35">
                      Economía
                    </label>
                    <RichEditor
                      key="economia"
                      minHeight="22.5rem"
                      mode="edit"
                      placeholder="Recursos, comercio, moneda, riqueza…"
                      showSplitMode={false}
                      value={(form as any).economia ?? ""}
                      wikiEntities={entities}
                      onChange={(v) => setForm((f) => ({ ...f, economia: v }))}
                      onWikilinkNavigate={onWikilink}
                    />
                  </div>
                </div>
              )}

              {/* LÍNEA DE TIEMPO — tab activo */}
              {activeTab === "lineatiempo" && (
                <div
                  className="rounded-xl overflow-hidden -mx-3 -mb-3"
                  style={{
                    border:
                      "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                  }}
                >
                  <PanelHistoriaMundo
                    key={`historia-panel-${form.id}`}
                    reinoFijo={filtroReinoId ?? form.id}
                    texto={(form as any).historia ?? ""}
                    onChange={(v: string) =>
                      setForm((f) => ({ ...f, historia: v }))
                    }
                    onSave={async () => {}}
                  />
                </div>
              )}
            </div>
          </main>
        )}
      </div>
      {/* fin columna tabs+editor */}

      {/* ── COLUMNA 3 — Utilidades (desktop fijo / mobile drawer) ──────────── */}

      {/* Desktop: panel lateral fijo */}
      <aside
        className="hidden sm:flex shrink-0 w-52 flex-col border-l overflow-y-auto overflow-x-hidden"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 7%, transparent)",
          background: "color-mix(in srgb, var(--primary) 1%, transparent)",
          scrollbarWidth: "none",
        }}
      >
        <SeccionEntidad
          allEntities={allPersonajes.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            imagen_url: p.img_url,
          }))}
          emptyLabel="Sin personajes"
          fallbackIcon={<UserCircle2 size={14} strokeWidth={1} />}
          fill={false}
          icon={<Users size={9} />}
          label="Personajes"
          loading={loadingPersonajesEditables}
          saving={savingPersonajes}
          selectedIds={personajesEditables.map((p) => p.id)}
          onEntityClick={(id) => {
            const p = personajesEditables.find((x) => x.id === id);
            if (p) onSelectPersonaje?.(p as any);
          }}
          onToggle={handleTogglePersonaje}
        />
        <div
          style={{
            borderTop:
              "1px solid color-mix(in srgb, var(--primary) 7%, transparent)",
          }}
        />
        <SeccionEntidad
          allEntities={allCriaturas.map((c) => ({
            id: c.id,
            nombre: c.nombre,
            imagen_url: c.imagen_url,
          }))}
          emptyLabel="Sin criaturas"
          fallbackIcon={<Bug size={14} strokeWidth={1} />}
          fill={false}
          icon={<Bug size={9} />}
          label="Criaturas"
          loading={loadingCriaturas}
          saving={savingCriaturas}
          selectedIds={criaturas.map((c) => c.id)}
          onEntityClick={(id) => onSelectCriatura?.(id)}
          onToggle={handleToggleCriatura}
        />
        <div
          style={{
            borderTop:
              "1px solid color-mix(in srgb, var(--primary) 7%, transparent)",
          }}
        />
        <div
          style={{
            borderTop:
              "1px solid color-mix(in srgb, var(--primary) 7%, transparent)",
          }}
        />
        <SeccionEntidad
          allEntities={allItems.map((i) => ({
            id: i.id,
            nombre: i.nombre,
            imagen_url: i.imagen_url,
          }))}
          emptyLabel="Sin ítems"
          fallbackIcon={<Package size={14} strokeWidth={1} />}
          fill={false}
          icon={<Package size={9} />}
          label="Ítems"
          loading={loadingItems}
          saving={savingItems}
          selectedIds={items.map((i) => i.id)}
          onEntityClick={(id) => onSelectItem?.(id)}
          onToggle={handleToggleItem}
        />
      </aside>

      {/* Mobile: drawer desde la derecha */}
      {mobileAsideOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0"
            style={{
              background: "color-mix(in srgb, var(--primary) 20%, transparent)",
            }}
            onClick={() => setMobileAsideOpen(false)}
          />
          <div
            className="relative flex flex-col h-full overflow-y-auto shadow-2xl"
            style={{
              width: "220px",
              background: "var(--white-custom, var(--bg-main))",
              borderLeft:
                "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
              scrollbarWidth: "none",
            }}
          >
            {/* Header del drawer */}
            <div
              className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 10%, transparent)",
              }}
            >
              <span
                className="text-micro font-black uppercase tracking-[0.2em] flex items-center gap-1.5"
                style={{
                  color: "color-mix(in srgb, var(--primary) 40%, transparent)",
                }}
              >
                <SlidersHorizontal size={9} /> Entidades
              </span>
              <button
                className="p-1 rounded-lg text-primary/30 hover:text-primary hover:bg-primary/8 transition-all"
                onClick={() => setMobileAsideOpen(false)}
              >
                <X size={14} />
              </button>
            </div>
            <SeccionEntidad
              allEntities={allPersonajes.map((p) => ({
                id: p.id,
                nombre: p.nombre,
                imagen_url: p.img_url,
              }))}
              emptyLabel="Sin personajes"
              fallbackIcon={<UserCircle2 size={14} strokeWidth={1} />}
              fill={false}
              icon={<Users size={9} />}
              label="Personajes"
              loading={loadingPersonajesEditables}
              saving={savingPersonajes}
              selectedIds={personajesEditables.map((p) => p.id)}
              onEntityClick={(id) => {
                const p = personajesEditables.find((x) => x.id === id);
                if (p) onSelectPersonaje?.(p as any);
              }}
              onToggle={handleTogglePersonaje}
            />
            <div
              style={{
                borderTop:
                  "1px solid color-mix(in srgb, var(--primary) 7%, transparent)",
              }}
            />
            <SeccionEntidad
              allEntities={allCriaturas.map((c) => ({
                id: c.id,
                nombre: c.nombre,
                imagen_url: c.imagen_url,
              }))}
              emptyLabel="Sin criaturas"
              fallbackIcon={<Bug size={14} strokeWidth={1} />}
              fill={false}
              icon={<Bug size={9} />}
              label="Criaturas"
              loading={loadingCriaturas}
              saving={savingCriaturas}
              selectedIds={criaturas.map((c) => c.id)}
              onEntityClick={(id) => onSelectCriatura?.(id)}
              onToggle={handleToggleCriatura}
            />
            <div
              style={{
                borderTop:
                  "1px solid color-mix(in srgb, var(--primary) 7%, transparent)",
              }}
            />
            <div
              style={{
                borderTop:
                  "1px solid color-mix(in srgb, var(--primary) 7%, transparent)",
              }}
            />
            <SeccionEntidad
              allEntities={allItems.map((i) => ({
                id: i.id,
                nombre: i.nombre,
                imagen_url: i.imagen_url,
              }))}
              emptyLabel="Sin ítems"
              fallbackIcon={<Package size={14} strokeWidth={1} />}
              fill={false}
              icon={<Package size={9} />}
              label="Ítems"
              loading={loadingItems}
              saving={savingItems}
              selectedIds={items.map((i) => i.id)}
              onEntityClick={(id) => onSelectItem?.(id)}
              onToggle={handleToggleItem}
            />
          </div>
        </div>
      )}
    </div>
  );
}
