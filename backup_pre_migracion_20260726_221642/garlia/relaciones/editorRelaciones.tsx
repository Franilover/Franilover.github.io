"use client";

import { AnimatePresence } from "framer-motion";
import {
  User,
  Cat,
  Sword,
  MapPin,
  Crown,
  Plus,
  Trash2,
  Loader2,
  Search,
  X,
  AlertTriangle,
} from "lucide-react";
import Image from "next/image";
import React, { useEffect, useState, useCallback } from "react";

import { MotionDiv } from "@/components/ui/Motion";
import { supabase } from "@/lib/api/client/supabase";

// ── Tipos ────────────────────────────────────────────────────────────────────

type TabId = "personajes" | "criaturas" | "items" | "reinos" | "ciudades";

interface Perfil {
  id: string;
  username: string;
  avatar_url?: string | null;
  rol?: string | null;
}

interface DescRow {
  id: string;
  fecha_descubrimiento?: string | null;
  entidad_id: string;
  nombre: string;
  imagen_url?: string | null;
  extra?: string | null; // habitat / categoria / reino / etc.
}

interface Entidad {
  id: string;
  nombre: string;
  imagen_url?: string | null;
  extra?: string | null;
}

// ── Configuración por tab ─────────────────────────────────────────────────────

const TAB_CONFIG: Record<
  TabId,
  {
    label: string;
    icon: React.ReactNode;
    tabla: string; // tabla de descubrimientos / desbloqueos
    fk: string; // columna que apunta a la entidad
    entidadTabla: string; // tabla maestra
    entidadSelect: string; // columna de nombre en la entidad
    entidadImagen: string; // columna de imagen en la entidad
    entidadExtra?: string; // columna extra opcional
    perfilCol: string; // columna del perfil_id / user_id
    fechaCol: string; // columna de fecha
    joinAlias: string; // alias en la query de join
    compositePk?: boolean; // true si la PK es (perfilCol, fk) en vez de id
  }
> = {
  personajes: {
    label: "Personajes",
    icon: <User size={10} />,
    tabla: "descubrimientos_personajes",
    fk: "personaje_id",
    entidadTabla: "personajes",
    entidadSelect: "nombre",
    entidadImagen: "img_url",
    entidadExtra: "reino",
    perfilCol: "perfil_id",
    fechaCol: "fecha_descubrimiento",
    joinAlias: "personajes",
  },
  criaturas: {
    label: "Criaturas",
    icon: <Cat size={10} />,
    tabla: "descubrimientos_criaturas",
    fk: "criatura_id",
    entidadTabla: "criaturas",
    entidadSelect: "nombre",
    entidadImagen: "imagen_url",
    entidadExtra: "habitat",
    perfilCol: "perfil_id",
    fechaCol: "fecha_descubrimiento",
    joinAlias: "criaturas",
  },
  items: {
    label: "Items",
    icon: <Sword size={10} />,
    tabla: "descubrimientos_items",
    fk: "item_id",
    entidadTabla: "items",
    entidadSelect: "nombre",
    entidadImagen: "imagen_url",
    entidadExtra: "categoria",
    perfilCol: "perfil_id",
    fechaCol: "fecha_descubrimiento",
    joinAlias: "items",
  },
  reinos: {
    label: "Reinos",
    icon: <Crown size={10} />,
    tabla: "descubrimientos_reinos",
    fk: "reino_id",
    entidadTabla: "reinos",
    entidadSelect: "nombre",
    entidadImagen: "mapa_url",
    perfilCol: "perfil_id",
    fechaCol: "fecha_descubrimiento",
    joinAlias: "reino_data",
  },
  ciudades: {
    label: "Ciudades",
    icon: <MapPin size={10} />,
    tabla: "ciudades_desbloqueadas",
    fk: "ciudad_id",
    entidadTabla: "ciudades",
    entidadSelect: "nombre",
    entidadImagen: "imagen_url",
    perfilCol: "user_id",
    fechaCol: "desbloqueado_en",
    joinAlias: "ciudades",
    compositePk: true,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(fecha?: string | null) {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Helpers Dexie ─────────────────────────────────────────────────────────────

async function dexieGetAll<T>(tabla: string): Promise<T[]> {
  try {
    const { db } = await import("@/lib/api/client/db");
    if (!db) return [];
    const t = (db as any)[tabla];
    if (!t) return [];
    return ((await t.toArray()) as any[]).filter((r: any) => !r.deleted) as T[];
  } catch {
    return [];
  }
}

async function dexieGetOne<T>(tabla: string, id: string): Promise<T | null> {
  try {
    const { db } = await import("@/lib/api/client/db");
    if (!db) return null;
    return (await (db as any)[tabla]?.get(id)) ?? null;
  } catch {
    return null;
  }
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AdminDescubrimientos() {
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [perfilSel, setPerfilSel] = useState<Perfil | null>(null);
  const [tab, setTab] = useState<TabId>("personajes");
  const [descubrimientos, setDescubrimientos] = useState<DescRow[]>([]);
  const [cargando, setCargando] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [eliminandoPerfil, setEliminandoPerfil] = useState<string | null>(null);

  // Modal agregar
  const [showAdd, setShowAdd] = useState(false);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [busquedaEnt, setBusquedaEnt] = useState("");
  const [entidadSel, setEntidadSel] = useState<Entidad | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Verificar admin ───────────────────────────────────────────────────────
  // 1. Leer perfil cacheado en Dexie para respuesta inmediata (sin spinner)
  // 2. Confirmar con el RPC is_admin (fuente de verdad)
  useEffect(() => {
    const run = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const cached = await dexieGetOne<any>("perfiles", user.id);
          if (cached?.rol === "admin") setEsAdmin(true);
        }
      } catch {}
      // Siempre confirmar con el servidor
      supabase.rpc("is_admin").then(({ data }) => setEsAdmin(!!data));
    };
    void run();
  }, []);

  // ── Cargar perfiles ───────────────────────────────────────────────────────
  // Dexie primero (respuesta inmediata) → Supabase (actualizar + persistir)
  useEffect(() => {
    if (!esAdmin) return;
    const run = async () => {
      // 1. Cache local
      const local = await dexieGetAll<Perfil>("perfiles");
      if (local.length) setPerfiles(local);

      // 2. Remoto
      const { data } = await supabase
        .from("perfiles")
        .select("id, username, avatar_url, rol")
        .order("username");
      if (!data) return;
      setPerfiles(data as Perfil[]);
      // Persistir para la próxima vez
      try {
        const { db } = await import("@/lib/api/client/db");
        if (db) await (db as any).perfiles?.bulkPut(data);
      } catch {}
    };
    void run();
  }, [esAdmin]);

  // ── Cargar descubrimientos del perfil seleccionado ────────────────────────

  const cargarDesc = useCallback(async () => {
    if (!perfilSel) return;
    setCargando(true);
    const cfg = TAB_CONFIG[tab];

    const idCol = cfg.compositePk ? "" : "id, ";
    const extraCol = cfg.entidadExtra ? `, ${cfg.entidadExtra}` : "";
    const q = supabase
      .from(cfg.tabla)
      .select(
        `${idCol}${cfg.fechaCol}, ${cfg.fk}, ${cfg.joinAlias}:${cfg.fk}(id, ${cfg.entidadSelect}, ${cfg.entidadImagen}${extraCol})`,
      )
      .eq(cfg.perfilCol, perfilSel.id)
      .order(cfg.fechaCol, { ascending: false });

    const { data, error } = await q;

    if (!error && data) {
      const rows = data.map((r: any) => {
        const ent = r[cfg.joinAlias];
        return {
          id: cfg.compositePk ? r[cfg.fk] : r.id,
          fecha_descubrimiento: r[cfg.fechaCol],
          entidad_id: r[cfg.fk],
          nombre: ent?.[cfg.entidadSelect] ?? "Sin nombre",
          imagen_url: ent?.[cfg.entidadImagen] ?? null,
          extra: cfg.entidadExtra ? (ent?.[cfg.entidadExtra] ?? null) : null,
        };
      });

      setDescubrimientos(rows);
    }
    setCargando(false);
  }, [perfilSel, tab]);

  useEffect(() => {
    void cargarDesc();
  }, [cargarDesc]);

  // ── Cargar entidades disponibles para agregar ─────────────────────────────
  // Dexie primero para que el modal abra con datos de inmediato
  useEffect(() => {
    if (!showAdd) return;
    const cfg = TAB_CONFIG[tab];

    const mapEntidad = (r: any): Entidad => ({
      id: r.id,
      nombre: r[cfg.entidadSelect] ?? "Sin nombre",
      imagen_url: r[cfg.entidadImagen] ?? null,
      extra: cfg.entidadExtra ? (r[cfg.entidadExtra] ?? null) : null,
    });

    const run = async () => {
      // 1. Cache local — las tablas de entidades ya las sincronizan otros hooks
      const local = await dexieGetAll<any>(cfg.entidadTabla);
      if (local.length) setEntidades(local.map(mapEntidad));

      // 2. Remoto (fuente de verdad)
      const extraCol = cfg.entidadExtra ? `, ${cfg.entidadExtra}` : "";
      const { data } = await supabase
        .from(cfg.entidadTabla)
        .select(`id, ${cfg.entidadSelect}, ${cfg.entidadImagen}${extraCol}`)
        .order(cfg.entidadSelect);
      if (!data) return;
      setEntidades(data.map(mapEntidad));
    };

    void run();
  }, [showAdd, tab]);

  // ── Eliminar ──────────────────────────────────────────────────────────────

  const eliminar = async (row: DescRow) => {
    if (!confirm(`¿Eliminar "${row.nombre}" de los descubrimientos?`)) return;
    setEliminando(row.id);
    const cfg = TAB_CONFIG[tab];
    const query = cfg.compositePk
      ? supabase
          .from(cfg.tabla)
          .delete()
          .eq(cfg.perfilCol, perfilSel!.id)
          .eq(cfg.fk, row.entidad_id)
      : supabase.from(cfg.tabla).delete().eq("id", row.id);
    const { error } = await query;
    if (error) {
      showToast("Error al eliminar", false);
    } else {
      setDescubrimientos((prev) => prev.filter((d) => d.id !== row.id));
      showToast("Eliminado correctamente", true);
    }
    setEliminando(null);
  };

  // ── Agregar ───────────────────────────────────────────────────────────────

  const agregar = async () => {
    if (!perfilSel || !entidadSel) return;
    setGuardando(true);
    const cfg = TAB_CONFIG[tab];
    const payload: Record<string, string> = {
      [cfg.perfilCol]: perfilSel.id,
      [cfg.fk]: entidadSel.id,
    };
    const { error } = await supabase.from(cfg.tabla).insert(payload);
    if (error) {
      showToast(
        error.message.includes("duplicate") || error.code === "23505"
          ? "Ya tiene ese descubrimiento"
          : "Error al guardar",
        false,
      );
    } else {
      showToast(`"${entidadSel.nombre}" agregado`, true);
      setShowAdd(false);
      setEntidadSel(null);
      setBusquedaEnt("");
      void cargarDesc();
    }
    setGuardando(false);
  };

  // ── Toast ─────────────────────────────────────────────────────────────────

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Eliminar perfil ───────────────────────────────────────────────────────
  // OJO: borrar solo la fila de "perfiles" desde el cliente NUNCA borra la
  // cuenta real de Supabase Auth (eso requiere la service_role key, que no
  // puede usarse en el navegador). Por eso antes el usuario "desaparecía" de
  // la lista pero seguía existiendo en Authentication → Users. Ahora se llama
  // a una ruta de servidor que sí puede borrar todo correctamente.

  const eliminarPerfil = async (p: Perfil) => {
    if (
      !confirm(
        `¿Eliminar el usuario "${p.username}" y todos sus datos? Esta acción no se puede deshacer.`,
      )
    )
      return;
    setEliminandoPerfil(p.id);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/eliminar-usuario", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ userId: p.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Error al eliminar usuario");

      // ✅ Borrar de Dexie para que no reaparezca en la próxima carga
      try {
        const { db } = await import("@/lib/api/client/db");
        if (db) await (db as any).perfiles?.delete(p.id);
      } catch {}

      setPerfiles((prev) => prev.filter((x) => x.id !== p.id));
      if (perfilSel?.id === p.id) {
        setPerfilSel(null);
        setDescubrimientos([]);
      }
      showToast(`Usuario "${p.username}" eliminado`, true);
    } catch (e: any) {
      showToast(e?.message ?? "Error al eliminar usuario", false);
    } finally {
      setEliminandoPerfil(null);
    }
  };

  if (esAdmin === null)
    return (
      <div className="flex items-center justify-center min-h-60">
        <Loader2
          className="animate-spin"
          size={18}
          style={{
            color: "color-mix(in srgb, var(--primary) 30%, transparent)",
          }}
        />
      </div>
    );

  if (!esAdmin)
    return (
      <div className="flex flex-col items-center justify-center min-h-60 gap-3 text-center px-4">
        <div
          className="w-12 h-12 flex items-center justify-center rounded-full"
          style={{
            background: "color-mix(in srgb, var(--primary) 6%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--primary) 14%, transparent)",
          }}
        >
          <AlertTriangle
            size={20}
            style={{
              color: "color-mix(in srgb, var(--primary) 50%, transparent)",
            }}
          />
        </div>
        <p
          className="text-micro font-black uppercase tracking-widest"
          style={{
            color: "color-mix(in srgb, var(--primary) 40%, transparent)",
          }}
        >
          Acceso restringido a administradores
        </p>
      </div>
    );

  // ── Entidades filtradas ───────────────────────────────────────────────────

  const entsFiltradas = entidades.filter((e) =>
    e.nombre.toLowerCase().includes(busquedaEnt.toLowerCase()),
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full px-2 sm:px-3 py-3">
      <div className="flex flex-col md:flex-row w-full items-stretch">
        {/* Selector de perfil */}
        <div
          className="w-full md:w-44 shrink-0 flex flex-col border-b md:border-b-0 md:border-r"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background:
              "color-mix(in srgb, var(--primary) 1.5%, var(--bg-main))",
          }}
        >
          <div
            className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 border-b"
            style={{
              borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            }}
          >
            <User
              size={9}
              style={{
                color: "color-mix(in srgb, var(--primary) 35%, transparent)",
              }}
            />
            <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/35 flex-1">
              Exploradores · {perfiles.length}
            </span>
          </div>

          <div className="p-1 flex flex-col gap-0.5 max-h-[70vh] overflow-y-auto">
            {perfiles.map((p) => {
              const activo = perfilSel?.id === p.id;
              return (
                <div
                  key={p.id}
                  className="group relative flex items-center gap-1.5 pl-2 pr-1 py-1 cursor-pointer transition-all"
                  style={{
                    background: activo
                      ? "color-mix(in srgb, var(--primary) 8%, transparent)"
                      : "transparent",
                    borderLeft: activo
                      ? "2px solid var(--primary)"
                      : "2px solid transparent",
                  }}
                  onClick={() => {
                    setPerfilSel(p);
                    setDescubrimientos([]);
                  }}
                >
                  <div
                    className="w-5 h-5 shrink-0 overflow-hidden flex items-center justify-center rounded"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 10%, transparent)",
                    }}
                  >
                    {p.avatar_url ? (
                      <Image
                        alt={p.username}
                        className="w-full h-full object-contain"
                        src={p.avatar_url}
                      />
                    ) : (
                      <User
                        size={9}
                        style={{
                          color: activo
                            ? "var(--primary)"
                            : "color-mix(in srgb, var(--primary) 30%, transparent)",
                        }}
                      />
                    )}
                  </div>
                  <span
                    className="flex-1 min-w-0 truncate text-micro font-bold uppercase tracking-wide"
                    style={{
                      color: activo
                        ? "var(--primary)"
                        : "color-mix(in srgb, var(--primary) 55%, transparent)",
                    }}
                  >
                    {p.username}
                  </span>
                  {p.rol === "admin" && (
                    <span
                      className="shrink-0 rounded text-micro font-black uppercase tracking-wider px-1 py-0.5"
                      style={{
                        background:
                          "color-mix(in srgb, var(--primary) 8%, transparent)",
                        color:
                          "color-mix(in srgb, var(--primary) 45%, transparent)",
                      }}
                    >
                      admin
                    </span>
                  )}
                  {/* Eliminar usuario */}
                  <button
                    className="shrink-0 opacity-0 group-hover:opacity-100 disabled:opacity-40 transition-all p-1 rounded hover:bg-red-500/10 text-primary/25 hover:text-red-400"
                    disabled={eliminandoPerfil === p.id}
                    title="Eliminar usuario"
                    onClick={(e) => {
                      e.stopPropagation();
                      void eliminarPerfil(p);
                    }}
                  >
                    {eliminandoPerfil === p.id ? (
                      <Loader2 className="animate-spin" size={9} />
                    ) : (
                      <Trash2 size={9} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel de descubrimientos */}
        {perfilSel && (
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Tabs + botón agregar */}
            <div
              className="flex items-center gap-0 overflow-x-auto border-b"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 8%, transparent)",
              }}
            >
              {(
                Object.entries(TAB_CONFIG) as [
                  TabId,
                  (typeof TAB_CONFIG)[TabId],
                ][]
              ).map(([id, cfg]) => (
                <button
                  key={id}
                  className="flex items-center gap-1 px-2.5 py-2 shrink-0 transition-all"
                  style={{
                    borderBottom:
                      tab === id
                        ? "2px solid var(--primary)"
                        : "2px solid transparent",
                    color:
                      tab === id
                        ? "var(--primary)"
                        : "color-mix(in srgb, var(--primary) 35%, transparent)",
                    fontSize: "8px",
                    fontWeight: 900,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                  }}
                  onClick={() => {
                    setTab(id);
                    setDescubrimientos([]);
                  }}
                >
                  {cfg.icon}
                  {cfg.label}
                </button>
              ))}

              <div className="flex-1" />

              <div className="px-2 py-1.5 shrink-0">
                <button
                  className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-btn)] bg-primary/8 hover:bg-primary/15 text-primary/50 hover:text-primary text-micro font-black uppercase tracking-widest transition-all"
                  onClick={() => {
                    setShowAdd(true);
                    setEntidadSel(null);
                    setBusquedaEnt("");
                  }}
                >
                  <Plus size={9} /> Agregar
                </button>
              </div>
            </div>

            {/* Lista */}
            <div
              className="divide-y"
              style={
                {
                  "--divide-color":
                    "color-mix(in srgb, var(--primary) 6%, transparent)",
                } as any
              }
            >
              {cargando ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2
                    className="animate-spin"
                    size={16}
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 30%, transparent)",
                    }}
                  />
                </div>
              ) : descubrimientos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-primary/20">
                  {TAB_CONFIG[tab].icon}
                  <p className="text-micro font-black uppercase tracking-widest">
                    Sin {TAB_CONFIG[tab].label.toLowerCase()} descubiertos
                  </p>
                </div>
              ) : (
                descubrimientos.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-2 px-3 py-2 group transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_2%,transparent)]"
                    style={{
                      borderBottom:
                        "1px solid color-mix(in srgb, var(--primary) 6%, transparent)",
                    }}
                  >
                    {/* Imagen */}
                    <div
                      className="w-7 h-7 shrink-0 overflow-hidden flex items-center justify-center"
                      style={{
                        borderRadius: "var(--radius-btn)",
                        background:
                          "color-mix(in srgb, var(--primary) 6%, transparent)",
                        border:
                          "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                      }}
                    >
                      {row.imagen_url ? (
                        <Image
                          alt={row.nombre}
                          className="w-full h-full object-contain"
                          src={row.imagen_url}
                        />
                      ) : (
                        TAB_CONFIG[tab].icon
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-micro font-black uppercase tracking-tight capitalize truncate"
                        style={{ color: "var(--primary)" }}
                      >
                        {row.nombre}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                        {row.extra && (
                          <span
                            className="min-w-0 truncate text-micro font-black uppercase tracking-wider"
                            style={{
                              color:
                                "color-mix(in srgb, var(--primary) 35%, transparent)",
                            }}
                          >
                            {row.extra}
                          </span>
                        )}
                        {row.extra && row.fecha_descubrimiento && (
                          <span
                            className="shrink-0"
                            style={{
                              color:
                                "color-mix(in srgb, var(--primary) 18%, transparent)",
                              fontSize: "7px",
                            }}
                          >
                            ·
                          </span>
                        )}
                        <span
                          className="shrink-0 text-micro font-black tabular-nums"
                          style={{
                            color:
                              "color-mix(in srgb, var(--primary) 25%, transparent)",
                          }}
                        >
                          {fmt(row.fecha_descubrimiento)}
                        </span>
                      </div>
                    </div>

                    {/* Eliminar */}
                    <button
                      className="opacity-0 group-hover:opacity-100 disabled:opacity-40 transition-all w-6 h-6 flex items-center justify-center shrink-0 rounded hover:bg-red-500/10 text-primary/30 hover:text-red-400"
                      disabled={eliminando === row.id}
                      title="Eliminar descubrimiento"
                      onClick={() => eliminar(row)}
                    >
                      {eliminando === row.id ? (
                        <Loader2 className="animate-spin" size={9} />
                      ) : (
                        <Trash2 size={9} />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer con conteo */}
            {!cargando && descubrimientos.length > 0 && (
              <div
                className="px-3 py-2 border-t"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--primary) 6%, transparent)",
                }}
              >
                <p
                  className="text-micro font-black uppercase tracking-[0.15em]"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 25%, transparent)",
                  }}
                >
                  {descubrimientos.length} {TAB_CONFIG[tab].label.toLowerCase()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      {/* end two-column flex */}

      {/* ── Modal Agregar ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAdd && (
          <>
            <MotionDiv
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-40 backdrop-blur-sm"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={() => setShowAdd(false)}
            />
            <MotionDiv
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[26rem]"
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              style={{
                background: "var(--white-custom)",
                borderRadius: "var(--radius-card)",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                boxShadow:
                  "0 20px 60px color-mix(in srgb, var(--primary) 16%, transparent)",
                maxHeight: "80dvh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
              transition={{ type: "spring", stiffness: 360, damping: 30 }}
            >
              {/* Header modal */}
              <div
                className="flex items-center justify-between px-5 py-4 shrink-0"
                style={{
                  borderBottom:
                    "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                }}
              >
                <div>
                  <p
                    className="text-sm font-black uppercase italic tracking-tight"
                    style={{ color: "var(--primary)" }}
                  >
                    Agregar {TAB_CONFIG[tab].label.slice(0, -1).toLowerCase()}
                  </p>
                  <p
                    className="text-micro font-black uppercase tracking-wider mt-0.5"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 30%, transparent)",
                    }}
                  >
                    a {perfilSel?.username}
                  </p>
                </div>
                <button
                  className="w-7 h-7 flex items-center justify-center transition-opacity hover:opacity-60"
                  style={{ color: "var(--primary)" }}
                  onClick={() => setShowAdd(false)}
                >
                  <X size={13} />
                </button>
              </div>

              {/* Buscador */}
              <div
                className="px-4 py-3 shrink-0"
                style={{
                  borderBottom:
                    "1px solid color-mix(in srgb, var(--primary) 6%, transparent)",
                }}
              >
                <div
                  className="flex items-center gap-2 px-3 py-2"
                  style={{
                    background:
                      "color-mix(in srgb, var(--primary) 4%, transparent)",
                    border:
                      "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                    borderRadius: "var(--radius-btn)",
                  }}
                >
                  <Search
                    size={11}
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 30%, transparent)",
                      flexShrink: 0,
                    }}
                  />
                  <input
                    autoFocus
                    className="flex-1 bg-transparent outline-none text-micro font-black uppercase tracking-tight"
                    placeholder={`Buscar ${TAB_CONFIG[tab].label.toLowerCase()}…`}
                    style={{ color: "var(--primary)" }}
                    value={busquedaEnt}
                    onChange={(e) => setBusquedaEnt(e.target.value)}
                  />
                  {busquedaEnt && (
                    <button
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 30%, transparent)",
                      }}
                      onClick={() => setBusquedaEnt("")}
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              </div>

              {/* Lista de entidades */}
              <div className="overflow-y-auto flex-1">
                {entsFiltradas.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <p
                      className="text-micro font-black uppercase tracking-widest"
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 25%, transparent)",
                      }}
                    >
                      Sin resultados
                    </p>
                  </div>
                ) : (
                  entsFiltradas.map((e) => {
                    const yaTiene = descubrimientos.some(
                      (d) => d.entidad_id === e.id,
                    );
                    const sel = entidadSel?.id === e.id;
                    return (
                      <button
                        key={e.id}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          yaTiene
                            ? "cursor-not-allowed"
                            : "cursor-pointer hover:bg-[color-mix(in_srgb,var(--primary)_3%,transparent)]"
                        }`}
                        disabled={yaTiene}
                        style={{
                          borderBottom:
                            "1px solid color-mix(in srgb, var(--primary) 5%, transparent)",
                          background: sel
                            ? "color-mix(in srgb, var(--primary) 6%, transparent)"
                            : "transparent",
                          opacity: yaTiene ? 0.35 : 1,
                        }}
                        onClick={() => setEntidadSel(sel ? null : e)}
                      >
                        <div
                          className="w-8 h-8 shrink-0 overflow-hidden flex items-center justify-center"
                          style={{
                            borderRadius: "var(--radius-btn)",
                            background:
                              "color-mix(in srgb, var(--primary) 7%, transparent)",
                            border: `1px solid ${sel ? "color-mix(in srgb, var(--primary) 30%, transparent)" : "color-mix(in srgb, var(--primary) 10%, transparent)"}`,
                          }}
                        >
                          {e.imagen_url ? (
                            <Image
                              alt={e.nombre}
                              className="w-full h-full object-contain"
                              src={e.imagen_url}
                            />
                          ) : (
                            TAB_CONFIG[tab].icon
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p
                            className="text-micro font-black uppercase tracking-tight capitalize truncate"
                            style={{ color: "var(--primary)" }}
                          >
                            {e.nombre}
                          </p>
                          {e.extra && (
                            <p
                              className="text-micro font-black uppercase tracking-wider truncate mt-0.5"
                              style={{
                                color:
                                  "color-mix(in srgb, var(--primary) 30%, transparent)",
                              }}
                            >
                              {e.extra}
                            </p>
                          )}
                        </div>

                        {yaTiene && (
                          <span
                            className="text-micro font-black uppercase tracking-wider shrink-0 px-1.5 py-0.5"
                            style={{
                              background:
                                "color-mix(in srgb, var(--primary) 8%, transparent)",
                              borderRadius: "2px",
                              color:
                                "color-mix(in srgb, var(--primary) 40%, transparent)",
                            }}
                          >
                            Ya tiene
                          </span>
                        )}

                        {sel && !yaTiene && (
                          <div
                            className="w-4 h-4 shrink-0 flex items-center justify-center"
                            style={{
                              borderRadius: "50%",
                              background: "var(--primary)",
                            }}
                          >
                            <svg
                              fill="none"
                              height="7"
                              viewBox="0 0 7 7"
                              width="7"
                            >
                              <path
                                d="M1 3.5L3 5.5L6 1.5"
                                stroke="white"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.2"
                              />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer modal */}
              <div
                className="px-4 py-3 shrink-0 flex items-center justify-between gap-3"
                style={{
                  borderTop:
                    "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                }}
              >
                <p
                  className="text-micro font-black uppercase tracking-wider"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 30%, transparent)",
                  }}
                >
                  {entidadSel
                    ? `Seleccionado: ${entidadSel.nombre}`
                    : "Ninguno seleccionado"}
                </p>
                <button
                  className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-btn)] transition-all"
                  disabled={!entidadSel || guardando}
                  style={{
                    background: entidadSel
                      ? "var(--primary)"
                      : "color-mix(in srgb, var(--primary) 12%, transparent)",
                    color: entidadSel
                      ? "var(--btn-text)"
                      : "color-mix(in srgb, var(--primary) 30%, transparent)",
                    fontSize: "9px",
                    fontWeight: 900,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    cursor: entidadSel ? "pointer" : "not-allowed",
                  }}
                  onClick={agregar}
                >
                  {guardando ? (
                    <Loader2 className="animate-spin" size={10} />
                  ) : (
                    <Plus size={10} />
                  )}
                  Agregar
                </button>
              </div>
            </MotionDiv>
          </>
        )}
      </AnimatePresence>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <MotionDiv
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 flex items-center gap-2 rounded-[var(--radius-btn)]"
            exit={{ opacity: 0, y: 8 }}
            initial={{ opacity: 0, y: 8 }}
            style={{
              background: toast.ok
                ? "color-mix(in srgb, var(--callout-success-border) 12%, var(--white-custom))"
                : "color-mix(in srgb, #ef4444 10%, var(--white-custom))",
              border: `1px solid ${
                toast.ok
                  ? "color-mix(in srgb, var(--callout-success-border) 30%, transparent)"
                  : "color-mix(in srgb, #ef4444 25%, transparent)"
              }`,
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              whiteSpace: "nowrap",
            }}
          >
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center"
              style={{
                background: toast.ok
                  ? "var(--callout-success-border)"
                  : "#ef4444",
              }}
            >
              {toast.ok ? (
                <svg fill="none" height="8" viewBox="0 0 8 8" width="8">
                  <path
                    d="M1.5 4L3 5.5L6.5 2"
                    stroke="white"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.2"
                  />
                </svg>
              ) : (
                <X color="white" size={7} />
              )}
            </div>
            <span
              className="text-micro font-black uppercase tracking-tight"
              style={{
                color: toast.ok ? "var(--callout-success-title)" : "#ef4444",
              }}
            >
              {toast.msg}
            </span>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
}
