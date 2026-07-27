"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";

import { ComboSelector } from "@/components/ui/ComboSelector";
import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";

async function loreReadRelaciones(
  tabla: string,
  personajeId: string,
  foreignKey: string
): Promise<string[]> {
  try {
    if (!db) return [];
    const t = (db as any)[tabla];
    if (!t) return [];
    // Ajustado para buscar dinámicamente tanto por personaje_id como por criatura_id
    const searchKey = t.schema.indexes.some((i: any) => i.name === "personaje_id") 
      ? "personaje_id" 
      : "criatura_id";
      
    const rows = await t.where(searchKey).equals(personajeId).toArray();
    return rows.map((r: any) => r[foreignKey]);
  } catch {
    return [];
  }
}

async function loreSyncRelaciones(
  tabla: string,
  personajeId: string,
  foreignKey: string,
  remoteIds: string[]
): Promise<void> {
  try {
    if (!db) return;
    const t = (db as any)[tabla];
    if (!t) return;
    const searchKey = t.schema.indexes.some((i: any) => i.name === "personaje_id") 
      ? "personaje_id" 
      : "criatura_id";

    await t.where(searchKey).equals(personajeId).delete();
    for (const id of remoteIds) {
      await t.put({ [searchKey]: personajeId, [foreignKey]: id });
    }
  } catch (e) {
    console.error(`Error sincronizando relaciones locales en ${tabla}:`, e);
  }
}

// ─── Types locales ─────────────────────────────────────────────────────────────
type DonCatalogo = {
  id: string;
  nombre: string;
  grupo_ids?: string[];
};

// ─── Helpers Dexie ────────────────────────────────────────────────────────────
async function dexieReadDones(): Promise<DonCatalogo[]> {
  try {
    if (!db) return [];
    const rows = await db.dones.orderBy("nombre").toArray();
    return rows.filter(r => !(r as any).deleted) as DonCatalogo[];
  } catch {
    return [];
  }
}

async function dexieWriteDones(rows: DonCatalogo[]): Promise<void> {
  try {
    if (!db || rows.length === 0) return;
    await db.dones.bulkPut(rows as any);
    const remoteIds = new Set(rows.map(r => r.id));
    const allLocal = await db.dones.toArray();
    const toDelete = allLocal.map(r => r.id).filter(id => !remoteIds.has(id));
    if (toDelete.length > 0) await db.dones.bulkDelete(toDelete);
  } catch (e) {
    console.warn("[BloqueDones] dexieWriteDones failed:", e);
  }
}

// ─── Cache del catálogo (singleton en módulo) ─────────────────────────────────
let _catalogPromise: Promise<DonCatalogo[]> | null = null;
let _catalogData:    DonCatalogo[] | null = null;

async function fetchCatalogo(): Promise<DonCatalogo[]> {
  if (_catalogData) return _catalogData;
  if (_catalogPromise) return _catalogPromise;

  _catalogPromise = (async () => {
    const local = await dexieReadDones();
    if (local.length > 0) {
      _catalogData = local;
      if (navigator.onLine) {
        supabase
          .from("dones")
          .select("id, nombre, grupo_ids")
          .order("nombre")
          .then(({ data }) => {
            if (data && data.length > 0) {
              _catalogData = data as DonCatalogo[];
              void dexieWriteDones(_catalogData);
            }
          });
      }
      return local;
    }

    if (!navigator.onLine) return [];

    const { data } = await supabase
      .from("dones")
      .select("id, nombre, grupo_ids")
      .order("nombre");

    const result = (data ?? []) as DonCatalogo[];
    _catalogData = result;
    await dexieWriteDones(result);
    return result;
  })().finally(() => { _catalogPromise = null; });

  return _catalogPromise;
}

// ─── Hook unificado: catálogo + don asignado en paralelo ─────────────────────
function useDones(personajeId: string) {
  const [dones,   setDones]   = useState<DonCatalogo[]>(_catalogData ?? []);
  const [donId,   setDonId]   = useState<string | null>(null);
  const [loading, setLoading] = useState(_catalogData === null);

  const load = useCallback(async () => {
    if (!_catalogData) setLoading(true);

    const localDonPromise = loreReadRelaciones("personaje_dones", personajeId, "don_id")
      .then((ids) => ids[0] ?? null)
      .catch(() => null);

    const [catalogResult, localDonId] = await Promise.all([
      fetchCatalogo(),
      localDonPromise,
    ]);

    setDones(catalogResult);
    if (localDonId) { setDonId(localDonId); setLoading(false); }

    if (navigator.onLine) {
      const { data } = await supabase
        .from("personaje_dones")
        .select("don_id")
        .eq("personaje_id", personajeId)
        .limit(1)
        .maybeSingle();

      const remoteId = data?.don_id ?? null;
      setDonId(remoteId);
      await loreSyncRelaciones(
        "personaje_dones", personajeId, "don_id",
        remoteId ? [remoteId] : [],
      );
    }

    setLoading(false);
  }, [personajeId]);

  useEffect(() => { void load(); }, [load]);

  const assign = async (id: string | null) => {
    setDonId(id);
    if (id) {
      await loreSyncRelaciones("personaje_dones", personajeId, "don_id", [id]);
      await supabase.from("personaje_dones").delete().eq("personaje_id", personajeId);
      await supabase.from("personaje_dones").insert({ personaje_id: personajeId, don_id: id });
    } else {
      await loreSyncRelaciones("personaje_dones", personajeId, "don_id", []);
      await supabase.from("personaje_dones").delete().eq("personaje_id", personajeId);
    }
  };

  return { dones, donId, loading, assign };
}

// ─── Lógica de compatibilidad ─────────────────────────────────────────────────
function esCompatible(don: DonCatalogo, grupoIdsDeCriatura: string[]): boolean {
  const grupoIds = don.grupo_ids ?? [];
  if (grupoIds.length === 0) return true;
  if (grupoIdsDeCriatura.length === 0) return false;
  return grupoIds.some(gid => grupoIdsDeCriatura.includes(gid));
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function BloqueDones({ personajeId, grupoIds = [] }: {
  personajeId: string;
  grupoIds?: string[];
}) {
  const { dones, donId, loading, assign } = useDones(personajeId);

  const sinGrupos = grupoIds.length === 0;

  const compatibles = useMemo(
    () => dones.filter(d => esCompatible(d, grupoIds)),
    [dones, grupoIds]
  );

  const items = compatibles.map(d => ({ id: d.id, label: d.nombre }));

  return (
    <div className="space-y-1">
      <ComboSelector
        allowNone
        hint={sinGrupos ? "requiere especie" : undefined}
        items={items}
        label="Don"
        loading={loading}
        mode="single"
        noneLabel="Sin don"
        placeholder={
          loading    ? "Cargando…"   :
          sinGrupos  ? "Sin grupos…" :
          "Elegir don…"
        }
        value={donId}
        onChange={assign}
      />
    </div>
  );
}