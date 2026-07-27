"use client";

/**
 * CriaturaMagia.tsx
 * ───────────────────
 * Catálogos de hechizos/dones + hooks `useHechizoCriatura` / `useDonCriatura`
 * + helper `grupoEsMagico` + componentes `BloqueMagico` / `BloqueMagicoUI`.
 * Gestiona qué hechizos y dones puede usar una criatura, filtrados por
 * compatibilidad de grupo (grupo_ids).
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/criaturas/CriaturaMagia.tsx
 */

import { ChevronDown, Loader2, Search, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";
import {
  loreReadRelaciones,
  loreSyncRelaciones,
} from "@/lib/utils/dexieHelpers";

// ─── Tipos catálogo ───────────────────────────────────────────────────────────
export type HechizoCat = { id: string; nombre: string; grupo_ids?: string[] };
export type DonCat = { id: string; nombre: string; grupo_ids?: string[] };

// ─── Cache de catálogos ───────────────────────────────────────────────────────
let _hechizosData: HechizoCat[] | null = null;
let _hechizosPromise: Promise<HechizoCat[]> | null = null;
let _donesData: DonCat[] | null = null;
let _donesPromise: Promise<DonCat[]> | null = null;

async function fetchHechizos(): Promise<HechizoCat[]> {
  if (_hechizosData) return _hechizosData;
  if (_hechizosPromise) return _hechizosPromise;
  _hechizosPromise = (async () => {
    try {
      if (db) {
        const local =
          (await (db as any).hechizos?.orderBy("nombre").toArray()) ?? [];
        if (local.length > 0) {
          _hechizosData = local as HechizoCat[];
          if (navigator.onLine)
            supabase
              .from("hechizos")
              .select("id, nombre, grupo_ids")
              .order("nombre")
              .then(({ data }) => {
                if (data?.length) _hechizosData = data as HechizoCat[];
              });
          return _hechizosData;
        }
      }
    } catch {}
    if (!navigator.onLine) return [];
    const { data } = await supabase
      .from("hechizos")
      .select("id, nombre, grupo_ids")
      .order("nombre");
    _hechizosData = (data ?? []) as HechizoCat[];
    return _hechizosData;
  })().finally(() => {
    _hechizosPromise = null;
  });
  return _hechizosPromise;
}

async function fetchDones(): Promise<DonCat[]> {
  if (_donesData) return _donesData;
  if (_donesPromise) return _donesPromise;
  _donesPromise = (async () => {
    try {
      if (db) {
        const local =
          (await (db as any).dones?.orderBy("nombre").toArray()) ?? [];
        if (local.length > 0) {
          _donesData = local as DonCat[];
          if (navigator.onLine)
            supabase
              .from("dones")
              .select("id, nombre, grupo_ids")
              .order("nombre")
              .then(({ data }) => {
                if (data?.length) _donesData = data as DonCat[];
              });
          return _donesData;
        }
      }
    } catch {}
    if (!navigator.onLine) return [];
    const { data } = await supabase
      .from("dones")
      .select("id, nombre, grupo_ids")
      .order("nombre");
    _donesData = (data ?? []) as DonCat[];
    return _donesData;
  })().finally(() => {
    _donesPromise = null;
  });
  return _donesPromise;
}

function esCompatibleGrupo(
  grupoIds: string[] | undefined,
  gruposActuales: string[],
): boolean {
  if (!grupoIds || grupoIds.length === 0) return true;
  if (gruposActuales.length === 0) return false;
  return grupoIds.some((g) => gruposActuales.includes(g));
}

// ─── Hook hechizos de criatura ────────────────────────────────────────────────

export function useHechizoCriatura(criaturaId: string) {
  const [catalogo, setCatalogo] = useState<HechizoCat[]>(_hechizosData ?? []);
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [cat, localIds] = await Promise.all([
      fetchHechizos(),
      loreReadRelaciones("personaje_hechizos", criaturaId, "hechizo_id").catch(
        () => [] as string[],
      ),
    ]);
    setCatalogo(cat);
    if (localIds.length > 0) setIds(localIds);
    if (navigator.onLine) {
      const { data } = await supabase
        .from("personaje_hechizos")
        .select("hechizo_id")
        .eq("personaje_id", criaturaId);
      const remote = (data ?? []).map((r: any) => r.hechizo_id as string);
      setIds(remote);
      await loreSyncRelaciones(
        "personaje_hechizos",
        criaturaId,
        "hechizo_id",
        remote,
      );
    }
    setLoading(false);
  }, [criaturaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (id: string) => {
    setIds((prev) => {
      const next = [...prev, id];
      void loreSyncRelaciones("personaje_hechizos", criaturaId, "hechizo_id", next);
      return next;
    });
    await supabase
      .from("personaje_hechizos")
      .insert({ personaje_id: criaturaId, hechizo_id: id });
  };
  const remove = async (id: string) => {
    setIds((prev) => {
      const next = prev.filter((x) => x !== id);
      void loreSyncRelaciones("personaje_hechizos", criaturaId, "hechizo_id", next);
      return next;
    });
    await supabase
      .from("personaje_hechizos")
      .delete()
      .eq("personaje_id", criaturaId)
      .eq("hechizo_id", id);
  };

  return { catalogo, ids, loading, add, remove };
}

// ─── Hook dones de criatura (multi, igual que hechizos) ───────────────────────

export function useDonCriatura(criaturaId: string) {
  const [catalogo, setCatalogo] = useState<DonCat[]>(_donesData ?? []);
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [cat, localIds] = await Promise.all([
      fetchDones(),
      loreReadRelaciones("personaje_dones", criaturaId, "don_id").catch(
        () => [] as string[],
      ),
    ]);
    setCatalogo(cat);
    if (localIds.length > 0) setIds(localIds);
    if (navigator.onLine) {
      const { data } = await supabase
        .from("personaje_dones")
        .select("don_id")
        .eq("personaje_id", criaturaId);
      const remote = (data ?? []).map((r: any) => r.don_id as string);
      setIds(remote);
      await loreSyncRelaciones("personaje_dones", criaturaId, "don_id", remote);
    }
    setLoading(false);
  }, [criaturaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (id: string) => {
    setIds((prev) => {
      const next = [...prev, id];
      void loreSyncRelaciones("personaje_dones", criaturaId, "don_id", next);
      return next;
    });
    await supabase
      .from("personaje_dones")
      .insert({ personaje_id: criaturaId, don_id: id });
  };
  const remove = async (id: string) => {
    setIds((prev) => {
      const next = prev.filter((x) => x !== id);
      void loreSyncRelaciones("personaje_dones", criaturaId, "don_id", next);
      return next;
    });
    await supabase
      .from("personaje_dones")
      .delete()
      .eq("personaje_id", criaturaId)
      .eq("don_id", id);
  };

  return { catalogo, ids, loading, add, remove };
}

// ─── Helper: detecta si algún grupo del array es "mágico" ────────────────────
function normStr(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
export function grupoEsMagico(grupos: { nombre: string }[]): boolean {
  return grupos.some((g) => normStr(g.nombre) === "magico");
}

// ─── Componente lista mágica (hechizos o dones) ───────────────────────────────
// Dos wrappers finos para evitar instanciar ambos hooks en cada montaje.

export function BloqueMagico({
  label,
  icon: Icon,
  criaturaId,
  gruposActuales,
  usarHook,
}: {
  label: string;
  icon: React.ElementType;
  criaturaId: string;
  gruposActuales: string[];
  usarHook: "hechizos" | "dones";
}) {
  if (usarHook === "hechizos") {
    return (
      <BloqueMagicoHechizos
        criaturaId={criaturaId}
        gruposActuales={gruposActuales}
        icon={Icon}
        label={label}
      />
    );
  }
  return (
    <BloqueMagicoDones
      criaturaId={criaturaId}
      gruposActuales={gruposActuales}
      icon={Icon}
      label={label}
    />
  );
}

function BloqueMagicoHechizos({
  label,
  icon: Icon,
  criaturaId,
  gruposActuales,
}: {
  label: string;
  icon: React.ElementType;
  criaturaId: string;
  gruposActuales: string[];
}) {
  const { catalogo, ids, loading, add, remove } =
    useHechizoCriatura(criaturaId);
  return (
    <BloqueMagicoUI
      add={add}
      catalogo={catalogo}
      gruposActuales={gruposActuales}
      icon={Icon}
      ids={ids}
      label={label}
      loading={loading}
      remove={remove}
    />
  );
}

function BloqueMagicoDones({
  label,
  icon: Icon,
  criaturaId,
  gruposActuales,
}: {
  label: string;
  icon: React.ElementType;
  criaturaId: string;
  gruposActuales: string[];
}) {
  const { catalogo, ids, loading, add, remove } = useDonCriatura(criaturaId);
  return (
    <BloqueMagicoUI
      add={add}
      catalogo={catalogo}
      gruposActuales={gruposActuales}
      icon={Icon}
      ids={ids}
      label={label}
      loading={loading}
      remove={remove}
    />
  );
}

function BloqueMagicoUI({
  label,
  icon: Icon,
  catalogo,
  ids,
  loading,
  add,
  remove,
  gruposActuales,
}: {
  label: string;
  icon: React.ElementType;
  catalogo: (HechizoCat | DonCat)[];
  ids: string[];
  loading: boolean;
  add: (id: string) => void;
  remove: (id: string) => void;
  gruposActuales: string[];
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const compatibles = useMemo(
    () =>
      catalogo.filter((e) => esCompatibleGrupo(e.grupo_ids, gruposActuales)),
    [catalogo, gruposActuales],
  );
  const asignados = compatibles.filter((e) => ids.includes(e.id));
  const disponibles = compatibles
    .filter((e) => !ids.includes(e.id))
    .filter((e) => e.nombre.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col">
      {/* Cabecera */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{
          borderBottom:
            "1px solid color-mix(in srgb, var(--primary) 6%, transparent)",
        }}
      >
        <span
          className="flex items-center gap-1.5 text-micro font-black uppercase tracking-widest"
          style={{
            color: "color-mix(in srgb, var(--primary) 38%, transparent)",
          }}
        >
          <Icon size={9} /> {label}
        </span>
        <button
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md transition-all"
          style={{
            border: open
              ? "1px solid color-mix(in srgb, var(--primary) 28%, transparent)"
              : "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
            background: open
              ? "color-mix(in srgb, var(--primary) 6%, transparent)"
              : "transparent",
            color: "color-mix(in srgb, var(--primary) 40%, transparent)",
          }}
          type="button"
          onClick={() => setOpen((o) => !o)}
        >
          {ids.length > 0 && (
            <span
              className="text-micro font-black tabular-nums"
              style={{ color: "var(--primary)" }}
            >
              {ids.length}
            </span>
          )}
          <ChevronDown
            className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            size={9}
          />
        </button>
      </div>

      {/* Dropdown búsqueda */}
      {open && (
        <div
          className="mx-2 mb-1.5 mt-1 rounded-lg overflow-hidden"
          style={{
            border:
              "1px solid color-mix(in srgb, var(--primary) 28%, transparent)",
            background: "var(--bg-main)",
            boxShadow:
              "0 6px 20px color-mix(in srgb, var(--primary) 10%, transparent)",
          }}
        >
          <div
            className="flex items-center gap-1.5 px-2 py-1.5"
            style={{
              borderBottom:
                "1px solid color-mix(in srgb, var(--primary) 7%, transparent)",
            }}
          >
            <Search
              size={9}
              style={{
                color: "color-mix(in srgb, var(--primary) 30%, transparent)",
                flexShrink: 0,
              }}
            />
            <input
              autoFocus
              className="flex-1 bg-transparent outline-none text-micro font-bold uppercase tracking-wide placeholder:normal-case placeholder:font-medium placeholder:tracking-normal placeholder:opacity-50"
              placeholder="Buscar…"
              style={{ color: "var(--primary)", caretColor: "var(--primary)" }}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="opacity-30 hover:opacity-70 transition-opacity"
                type="button"
                onClick={() => setSearch("")}
              >
                <X size={8} style={{ color: "var(--primary)" }} />
              </button>
            )}
          </div>
          <div className="max-h-36 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-3 text-primary/20">
                <Loader2 className="animate-spin" size={11} />
              </div>
            ) : disponibles.length === 0 ? (
              <p className="text-micro font-black uppercase text-primary/25 px-3 py-2.5 text-center tracking-widest">
                {search
                  ? "Sin resultados"
                  : gruposActuales.length === 0
                    ? "Sin grupos asignados"
                    : "Todos asignados"}
              </p>
            ) : (
              disponibles.map((e) => (
                <button
                  key={e.id}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-all hover:bg-primary/5"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 50%, transparent)",
                  }}
                  type="button"
                  onClick={() => {
                    add(e.id);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <span className="flex-1 min-w-0 text-micro font-black uppercase tracking-wide truncate">
                    {e.nombre}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Lista asignados */}
      {asignados.length === 0 && !open ? (
        <div className="flex items-center gap-2 px-3 py-2 opacity-35">
          <Icon
            size={14}
            strokeWidth={1}
            style={{
              color: "color-mix(in srgb, var(--primary) 40%, transparent)",
            }}
          />
          <p
            className="text-micro font-black uppercase tracking-widest"
            style={{
              color: "color-mix(in srgb, var(--primary) 30%, transparent)",
            }}
          >
            Sin {label.toLowerCase()}
          </p>
        </div>
      ) : (
        asignados.map((e) => (
          <div
            key={e.id}
            className="group flex items-center gap-2 px-3 py-1.5 transition-all hover:bg-primary/5"
          >
            <span
              className="flex-1 min-w-0 text-micro font-black uppercase tracking-wide truncate"
              style={{
                color: "color-mix(in srgb, var(--primary) 65%, transparent)",
              }}
            >
              {e.nombre}
            </span>
            <button
              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-red-500/10"
              style={{
                color: "color-mix(in srgb, var(--primary) 30%, transparent)",
              }}
              type="button"
              onClick={() => remove(e.id)}
            >
              <X size={9} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}
