"use client";

import { AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Award,
  Bug,
  Camera,
  CheckCircle2,
  Clock,
  Coins,
  Globe,
  Loader2,
  Lock,
  MapPin,
  Package,
  Plus,
  RotateCcw,
  Scroll,
  Search,
  Sparkles,
  Swords,
  Trash2,
  User,
  WifiOff,
  X,
} from "lucide-react";
import Image from "next/image";
import React, { useCallback, useEffect, useState } from "react";

import { MotionDiv } from "@/ui/Motion";
import SimpleImagePicker from "@/ui/SimpleImagePicker";
import { isReallyOnline } from "@/hooks/data/useOfflineSync";
import { supabase } from "@/infra/supabase/supabase";
import { loadMisionesAdmin } from "@/infra/sync/syncEngine";

// ── Tipos ────────────────────────────────────────────────────────────────────

type Dificultad = "facil" | "media" | "dificil" | "epica";
type EstadoUsuario = "en_curso" | "completada" | "reclamada";

interface MisionRow {
  id: string;
  titulo: string;
  descripcion: string | null;
  dificultad: Dificultad;
  categoria: string | null;
  imagen_url: string | null;
  requisitos: string | null;
  recompensa_xp: number;
  recompensa_monedas: number;
  recompensa_item_nombre: string | null;
  recompensa_item_imagen_url: string | null;
  recompensa_item_id: string | null;
  activa: boolean;
}

interface ProgresoRow {
  ficha_id: string;
  user_id?: string;
  estado: EstadoUsuario;
  progreso: number;
  fecha_aceptada: string | null;
  fecha_completada: string | null;
  ficha?: { nombre: string; imagen_url: string | null } | null;
}

interface FormState {
  id: string | null;
  titulo: string;
  descripcion: string;
  dificultad: Dificultad;
  categoria: string;
  imagen_url: string;
  requisitos: string;
  recompensa_xp: string;
  recompensa_monedas: string;
  recompensa_item_nombre: string;
  recompensa_item_imagen_url: string;
  recompensa_item_id: string | null;
  activa: boolean;
}

const FORM_VACIO: FormState = {
  id: null,
  titulo: "",
  descripcion: "",
  dificultad: "facil",
  categoria: "",
  imagen_url: "",
  requisitos: "",
  recompensa_xp: "50",
  recompensa_monedas: "0",
  recompensa_item_nombre: "",
  recompensa_item_imagen_url: "",
  recompensa_item_id: null,
  activa: true,
};

const DIFICULTAD_LABEL: Record<Dificultad, string> = {
  facil: "Fácil",
  media: "Media",
  dificil: "Difícil",
  epica: "Épica",
};

const DIFICULTADES: Dificultad[] = ["facil", "media", "dificil", "epica"];

const ESTADO_LABEL: Record<EstadoUsuario, string> = {
  en_curso: "En curso",
  completada: "Completada",
  reclamada: "Reclamada",
};

// ── Helpers Dexie ────────────────────────────────────────────────────────────

async function dexieGetOne<T>(tabla: string, id: string): Promise<T | null> {
  try {
    const { db } = await import("@/infra/supabase/db");
    if (!db) return null;
    return (await (db as any)[tabla]?.get(id)) ?? null;
  } catch {
    return null;
  }
}

async function dexieGetAll<T>(tabla: string): Promise<T[]> {
  try {
    const { db } = await import("@/infra/supabase/db");
    if (!db) return [];
    const t = (db as any)[tabla];
    if (!t) return [];
    return ((await t.toArray()) as any[]).filter((r: any) => !r.deleted) as T[];
  } catch {
    return [];
  }
}

async function dexiePutAll(tabla: string, rows: any[]): Promise<void> {
  try {
    const { db } = await import("@/infra/supabase/db");
    if (!db) return;
    const t = (db as any)[tabla];
    if (!t || rows.length === 0) return;
    await t.bulkPut(rows);
    // Eliminar locales que ya no existen en remoto
    const remoteIds = new Set(rows.map((r) => r.id));
    const local: any[] = await t.toArray();
    const toDelete = local.map((r) => r.id).filter((id) => !remoteIds.has(id));
    if (toDelete.length > 0) await t.bulkDelete(toDelete);
  } catch {}
}

async function _dexiePutOne(tabla: string, row: any): Promise<void> {
  try {
    const { db } = await import("@/infra/supabase/db");
    if (!db) return;
    await (db as any)[tabla]?.put(row);
  } catch {}
}

async function dexieDeleteOne(tabla: string, id: string): Promise<void> {
  try {
    const { db } = await import("@/infra/supabase/db");
    if (!db) return;
    await (db as any)[tabla]?.delete(id);
  } catch {}
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function EditorMisiones() {
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);

  const [misiones, setMisiones] = useState<MisionRow[]>([]);
  const [misionSel, setMisionSel] = useState<MisionRow | null>(null);
  const [cargandoMisiones, setCargandoMisiones] = useState(false);

  const [progreso, setProgreso] = useState<ProgresoRow[]>([]);
  const [cargandoProgreso, setCargandoProgreso] = useState(false);
  const [actualizandoUserId, setActualizandoUserId] = useState<string | null>(
    null,
  );

  const [eliminando, setEliminando] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  // Modal formulario crear/editar
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Verificar admin ───────────────────────────────────────────────────────
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
      supabase.rpc("is_admin").then(({ data }) => setEsAdmin(!!data));
    };
    void run();
  }, []);

  // ── Cargar catálogo de misiones (Dexie primero, Supabase en background) ──
  const cargarMisiones = useCallback(async () => {
    setCargandoMisiones(true);

    // 1️⃣ Dexie inmediato — sin esperar red
    const local = await dexieGetAll<MisionRow>("misiones");
    if (local.length > 0) {
      setMisiones(local);
      setCargandoMisiones(false); // UI disponible de inmediato
    }

    // 2️⃣ Verificar conexión
    const online = await isReallyOnline();
    setOffline(!online);
    if (!online) {
      if (local.length === 0) setCargandoMisiones(false);
      return;
    }

    // 3️⃣ Fetch remoto en background — sobreescribe con datos frescos
    try {
      const data = await loadMisionesAdmin();
      const rows = data as MisionRow[];
      setMisiones(rows);
      await dexiePutAll("misiones", rows);
    } catch {
      // Sin red — quedarse con el caché local
    } finally {
      setCargandoMisiones(false);
    }
  }, []);

  useEffect(() => {
    if (esAdmin) void cargarMisiones();
  }, [esAdmin, cargarMisiones]);

  // ── Cargar progreso de identidades para la misión seleccionada ────────────
  const cargarProgreso = useCallback(async () => {
    if (!misionSel) return;
    setCargandoProgreso(true);

    // 1️⃣ Dexie primero: mostrar progreso cacheado al instante
    const localProg = await dexieGetAll<any>("misiones_usuario");
    const localDeMision = localProg.filter((r) => r.mision_id === misionSel.id);
    if (localDeMision.length > 0) {
      // Resolver nombres desde caché local de fichas_dnd
      const fichasCached = await dexieGetAll<any>("fichas_dnd");
      const fichasPorId = new Map(fichasCached.map((f) => [f.id, f]));
      setProgreso(
        localDeMision.map((r) => ({
          ficha_id: r.ficha_id,
          user_id: r.user_id,
          estado: r.estado,
          progreso: r.progreso,
          fecha_aceptada: r.fecha_aceptada,
          fecha_completada: r.fecha_completada,
          ficha: fichasPorId.get(r.ficha_id) ?? null,
        })),
      );
      setCargandoProgreso(false); // UI disponible de inmediato
    }

    // 2️⃣ Fetch remoto en background (no usa el embed — ver comentario abajo)
    // No usamos el embed "ficha:ficha_id(...)" para mantener el mismo patrón
    // de dos queries + merge en cliente que ya usaba el resto del admin.
    const { data: progresoData, error: progresoError } = await supabase
      .from("misiones_usuario")
      .select("ficha_id, user_id, estado, progreso, fecha_aceptada, fecha_completada")
      .eq("mision_id", misionSel.id)
      .order("fecha_aceptada", { ascending: false });

    if (progresoError || !progresoData) {
      setCargandoProgreso(false);
      return;
    }

    const fichaIds = progresoData
      .map((r: any) => r.ficha_id)
      .filter((id: string | null): id is string => !!id);
    let fichasPorId = new Map<
      string,
      { nombre: string; imagen_url: string | null }
    >();

    if (fichaIds.length > 0) {
      const { data: fichasData } = await supabase
        .from("fichas_dnd")
        .select("id, nombre, imagen_url")
        .in("id", fichaIds);
      const fichasRows = fichasData ?? [];
      fichasPorId = new Map(
        fichasRows.map((f: any) => [
          f.id,
          { nombre: f.nombre, imagen_url: f.imagen_url },
        ]),
      );
      // Actualizar caché de fichas con lo que llegó
      await dexiePutAll("fichas_dnd", fichasRows);
    }

    const progresoFinal = progresoData.map((r: any) => ({
      ficha_id: r.ficha_id,
      user_id: r.user_id,
      estado: r.estado,
      progreso: r.progreso,
      fecha_aceptada: r.fecha_aceptada,
      fecha_completada: r.fecha_completada,
      ficha: r.ficha_id ? fichasPorId.get(r.ficha_id) ?? null : null,
    }));

    setProgreso(progresoFinal);

    // Cachear en Dexie con mision_id para la próxima carga
    await dexiePutAll(
      "misiones_usuario",
      progresoData.map((r: any) => ({
        ...r,
        mision_id: misionSel.id,
        id: `${misionSel.id}:${r.ficha_id}`,
      })),
    );

    setCargandoProgreso(false);
  }, [misionSel]);

  useEffect(() => {
    void cargarProgreso();
  }, [cargarProgreso]);

  // ── Marcar como completada / devolver a en curso ──────────────────────────
  const cambiarEstadoUsuario = async (
    row: ProgresoRow,
    nuevoEstado: "en_curso" | "completada",
  ) => {
    if (!misionSel) return;
    if (!(await isReallyOnline())) {
      showToast("Sin conexión: no se puede actualizar el progreso", false);
      return;
    }
    setActualizandoUserId(row.ficha_id);
    const { error } = await supabase
      .from("misiones_usuario")
      .update({
        estado: nuevoEstado,
        fecha_completada:
          nuevoEstado === "completada" ? new Date().toISOString() : null,
      })
      .eq("mision_id", misionSel.id)
      .eq("ficha_id", row.ficha_id);

    if (error) {
      showToast("Error al actualizar el estado", false);
    } else {
      // Si se completa y hay item real (con id), entregarlo a la ficha
      if (nuevoEstado === "completada" && misionSel.recompensa_item_id) {
        await supabase.from("fichas_dnd_inventario").upsert(
          {
            ficha_id: row.ficha_id,
            item_id: misionSel.recompensa_item_id,
            cantidad: 1,
          },
          { onConflict: "ficha_id,item_id", ignoreDuplicates: true },
        );
      }
      setProgreso((prev) =>
        prev.map((p) =>
          p.ficha_id === row.ficha_id ? { ...p, estado: nuevoEstado } : p,
        ),
      );
      showToast(
        nuevoEstado === "completada"
          ? misionSel.recompensa_item_id
            ? "¡Completada! Item entregado a la ficha"
            : "Marcada como completada"
          : "Devuelta a en curso",
        true,
      );
    }
    setActualizandoUserId(null);
  };

  // ── Form: abrir para crear ─────────────────────────────────────────────────
  const abrirCrear = () => {
    setForm(FORM_VACIO);
    setShowForm(true);
  };

  // ── Form: abrir para editar ────────────────────────────────────────────────
  const abrirEditar = (m: MisionRow) => {
    // m.id debe existir siempre — si es undefined hay un bug en el select de syncEngine
    const misionId = m.id ?? null;
    setForm({
      id: misionId,
      titulo: m.titulo,
      descripcion: m.descripcion ?? "",
      dificultad: m.dificultad,
      categoria: m.categoria ?? "",
      imagen_url: m.imagen_url ?? "",
      requisitos: m.requisitos ?? "",
      recompensa_xp: String(m.recompensa_xp ?? 0),
      recompensa_monedas: String(m.recompensa_monedas ?? 0),
      recompensa_item_nombre: m.recompensa_item_nombre ?? "",
      recompensa_item_imagen_url: m.recompensa_item_imagen_url ?? "",
      recompensa_item_id: m.recompensa_item_id ?? null,
      activa: m.activa,
    });
    setShowForm(true);
  };

  // ── Guardar (crear o editar) ───────────────────────────────────────────────
  const guardar = async () => {
    if (!form.titulo.trim()) {
      showToast("El título es obligatorio", false);
      return;
    }
    if (!(await isReallyOnline())) {
      showToast("Sin conexión: no se puede guardar la misión", false);
      return;
    }
    setGuardando(true);

    const payload = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      dificultad: form.dificultad,
      categoria: form.categoria.trim() || null,
      imagen_url: form.imagen_url.trim() || null,
      requisitos: form.requisitos.trim() || null,
      recompensa_xp: Number(form.recompensa_xp) || 0,
      recompensa_monedas: Number(form.recompensa_monedas) || 0,
      recompensa_item_nombre: form.recompensa_item_nombre.trim() || null,
      recompensa_item_imagen_url:
        form.recompensa_item_imagen_url.trim() || null,
      recompensa_item_id: form.recompensa_item_id || null,
      activa: form.activa,
    };

    const { error } = form.id
      ? await supabase.from("misiones").update(payload).eq("id", form.id)
      : await supabase.from("misiones").insert(payload);

    if (error) {
      showToast("Error al guardar la misión", false);
    } else {
      showToast(form.id ? "Misión actualizada" : "Misión creada", true);
      setShowForm(false);
      // Refrescar lista (Dexie-first, ya actualiza el caché internamente)
      void cargarMisiones();
    }
    setGuardando(false);
  };

  // ── Eliminar misión ─────────────────────────────────────────────────────────
  const eliminar = async (m: MisionRow) => {
    if (
      !confirm(
        `¿Eliminar la misión "${m.titulo}"? Esto también borra el progreso de los usuarios en ella.`,
      )
    )
      return;

    setEliminando(m.id);
    try {
      if (!(await isReallyOnline())) {
        showToast("Sin conexión: no se puede eliminar la misión", false);
        return;
      }

      const { error, count } = await supabase
        .from("misiones")
        .delete({ count: "exact" })
        .eq("id", m.id);

      if (error) {
        showToast("Error al eliminar", false);
      } else if (count === 0) {
        // count === 0 explícito significa que RLS bloqueó la operación sin
        // lanzar error (0 filas afectadas). Si count es null en cambio, el
        // servidor simplemente no informó el conteo — no es lo mismo que un
        // bloqueo, así que ese caso cae al branch de éxito de abajo.
        showToast("No se pudo eliminar (permiso denegado)", false);
      } else {
        // Limpia tanto el estado en memoria como el caché Dexie — si no se
        // borra de Dexie, la misión "eliminada" puede reaparecer la próxima
        // vez que se cargue el catálogo desde caché offline.
        await dexieDeleteOne("misiones", m.id);
        await dexieDeleteOne("misiones_usuario", `${m.id}:*`); // limpia progreso cacheado

        setMisiones((prev) => prev.filter((x) => x.id !== m.id));
        if (misionSel?.id === m.id) {
          setMisionSel(null);
          setProgreso([]);
        }
        showToast("Misión eliminada", true);
      }
    } catch (err) {
      // Cualquier excepción inesperada (red, parsing, etc.) ahora muestra
      // un toast en vez de fallar en silencio — antes esto podía dejar la
      // pantalla "sin hacer nada" sin ningún aviso visible.
      console.error("[EditorMisiones] Error al eliminar:", err);
      showToast("Error inesperado al eliminar", false);
    } finally {
      setEliminando(null);
    }
  };

  // ── Guards de acceso ────────────────────────────────────────────────────────
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

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="w-full px-2 sm:px-3 py-3">
      <div className="flex flex-col md:flex-row w-full items-stretch">
        {/* ── Lista de misiones ── */}
        <div
          className="md:w-48 shrink-0 w-full flex flex-col border-b md:border-b-0 md:border-r"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background:
              "color-mix(in srgb, var(--primary) 1.5%, var(--bg-main))",
          }}
        >
          <div
            className="shrink-0 flex items-center justify-between gap-1.5 px-2 py-1.5 border-b"
            style={{
              borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            }}
          >
            <div className="flex items-center gap-1 min-w-0">
              <Scroll
                size={9}
                style={{
                  color: "color-mix(in srgb, var(--primary) 35%, transparent)",
                }}
              />
              <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/35 truncate">
                Misiones · {misiones.length}
              </span>
              {offline && (
                <span
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    background:
                      "color-mix(in srgb, var(--callout-warning-border) 12%, transparent)",
                    color: "var(--callout-warning-title)",
                  }}
                  title="Mostrando datos guardados localmente"
                >
                  <WifiOff size={7} />
                  <span className="text-micro font-black uppercase tracking-wider">
                    offline
                  </span>
                </span>
              )}
            </div>
            <button
              className="flex items-center gap-1 px-1.5 py-1 rounded-[var(--radius-btn)] bg-primary/8 hover:bg-primary/15 text-primary/50 hover:text-primary text-micro font-black uppercase tracking-widest transition-all disabled:opacity-40 shrink-0"
              disabled={offline}
              title={
                offline ? "Necesitas conexión para crear misiones" : undefined
              }
              onClick={abrirCrear}
            >
              <Plus size={8} /> Nueva
            </button>
          </div>

          <div className="p-1 flex flex-col gap-0.5 max-h-[70vh] overflow-y-auto">
            {cargandoMisiones ? (
              <div className="flex items-center justify-center py-8">
                <Loader2
                  className="animate-spin"
                  size={16}
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 30%, transparent)",
                  }}
                />
              </div>
            ) : misiones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-primary/20">
                <Scroll size={16} />
                <p className="text-micro font-black uppercase tracking-widest">
                  Sin misiones todavía
                </p>
              </div>
            ) : (
              misiones.map((m) => {
                const activa = misionSel?.id === m.id;
                return (
                  <div
                    key={m.id}
                    className="group relative flex items-center gap-1.5 pl-2 pr-1 py-1 cursor-pointer transition-all"
                    style={{
                      background: activa
                        ? "color-mix(in srgb, var(--primary) 8%, transparent)"
                        : "transparent",
                      borderLeft: activa
                        ? "2px solid var(--primary)"
                        : "2px solid transparent",
                      opacity: m.activa ? 1 : 0.5,
                    }}
                    onClick={() => setMisionSel(m)}
                  >
                    <div
                      className="w-5 h-5 shrink-0 overflow-hidden flex items-center justify-center rounded"
                      style={{
                        background:
                          "color-mix(in srgb, var(--primary) 10%, transparent)",
                      }}
                    >
                      {m.imagen_url ? (
                        <Image
                          alt={m.titulo}
                          className="w-full h-full object-contain"
                          src={m.imagen_url}
                        />
                      ) : (
                        <Scroll
                          size={9}
                          style={{
                            color: activa
                              ? "var(--primary)"
                              : "color-mix(in srgb, var(--primary) 30%, transparent)",
                          }}
                        />
                      )}
                    </div>
                    <span
                      className="flex-1 min-w-0 truncate text-micro font-bold uppercase tracking-wide"
                      style={{
                        color: activa
                          ? "var(--primary)"
                          : "color-mix(in srgb, var(--primary) 55%, transparent)",
                      }}
                    >
                      {m.titulo}
                    </span>
                    {!m.activa && (
                      <span
                        className="shrink-0 rounded text-micro font-black uppercase tracking-wider px-1 py-0.5"
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary) 8%, transparent)",
                          color:
                            "color-mix(in srgb, var(--primary) 45%, transparent)",
                        }}
                      >
                        inactiva
                      </span>
                    )}
                    <button
                      className="shrink-0 opacity-0 group-hover:opacity-100 disabled:opacity-40 transition-all p-1 rounded hover:bg-red-500/10 text-primary/25 hover:text-red-400"
                      disabled={eliminando === m.id}
                      title="Eliminar misión"
                      onClick={(e) => {
                        e.stopPropagation();
                        void eliminar(m);
                      }}
                    >
                      {eliminando === m.id ? (
                        <Loader2 className="animate-spin" size={9} />
                      ) : (
                        <Trash2 size={9} />
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Panel de detalle + progreso de usuarios ── */}
        {!misionSel ? (
          <div className="flex-1 w-full flex items-center justify-center min-h-60">
            <p
              className="text-micro font-black uppercase tracking-widest"
              style={{
                color: "color-mix(in srgb, var(--primary) 25%, transparent)",
              }}
            >
              Selecciona una misión para ver su progreso
            </p>
          </div>
        ) : (
          <div className="flex-1 w-full flex flex-col min-w-0">
            {/* Resumen de la misión */}
            <div
              className="flex items-center gap-2.5 px-3 sm:px-4 py-2.5 border-b"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 8%, transparent)",
              }}
            >
              <div
                className="w-10 h-10 shrink-0 overflow-hidden flex items-center justify-center"
                style={{
                  borderRadius: "var(--radius-btn)",
                  background:
                    "color-mix(in srgb, var(--primary) 6%, transparent)",
                }}
              >
                {misionSel.imagen_url ? (
                  <Image
                    alt={misionSel.titulo}
                    className="w-full h-full object-cover"
                    src={misionSel.imagen_url}
                  />
                ) : (
                  <Scroll
                    size={15}
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 25%, transparent)",
                    }}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  className="font-black uppercase italic tracking-tight text-sm capitalize truncate"
                  style={{ color: "var(--primary)" }}
                >
                  {misionSel.titulo}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="text-micro font-black uppercase tracking-wider"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 40%, transparent)",
                    }}
                  >
                    {DIFICULTAD_LABEL[misionSel.dificultad]}
                  </span>
                  <span
                    className="flex items-center gap-1 text-micro font-black tabular-nums"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 40%, transparent)",
                    }}
                  >
                    <Sparkles size={8} /> {misionSel.recompensa_xp} XP
                  </span>
                  {!!misionSel.recompensa_monedas && (
                    <span
                      className="flex items-center gap-1 text-micro font-black tabular-nums"
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 40%, transparent)",
                      }}
                    >
                      <Coins size={8} /> {misionSel.recompensa_monedas}
                    </span>
                  )}
                </div>
              </div>
              <button
                className="px-2 py-1 shrink-0 rounded-[var(--radius-btn)] bg-primary/8 hover:bg-primary/15 text-primary/50 hover:text-primary text-micro font-black uppercase tracking-widest transition-all"
                onClick={() => abrirEditar(misionSel)}
              >
                Editar
              </button>
            </div>

            {/* Tabla de progreso de usuarios */}
            <div className="flex flex-col flex-1 min-h-0">
              <div
                className="px-3 sm:px-4 py-2 border-b shrink-0"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--primary) 8%, transparent)",
                }}
              >
                <p
                  className="text-micro font-black uppercase tracking-[0.2em]"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 35%, transparent)",
                  }}
                >
                  Usuarios con esta misión ({progreso.length})
                </p>
              </div>

              {cargandoProgreso ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2
                    className="animate-spin"
                    size={14}
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 30%, transparent)",
                    }}
                  />
                </div>
              ) : progreso.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-primary/20">
                  <User size={14} />
                  <p className="text-micro font-black uppercase tracking-widest">
                    Nadie ha aceptado esta misión aún
                  </p>
                </div>
              ) : (
                progreso.map((row) => (
                  <div
                    key={row.ficha_id}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b"
                    style={{
                      borderColor:
                        "color-mix(in srgb, var(--primary) 6%, transparent)",
                    }}
                  >
                    <div
                      className="w-6 h-6 shrink-0 overflow-hidden flex items-center justify-center"
                      style={{
                        borderRadius: "2px",
                        background:
                          "color-mix(in srgb, var(--primary) 10%, transparent)",
                      }}
                    >
                      {row.ficha?.imagen_url ? (
                        <Image
                          alt={row.ficha?.nombre}
                          className="w-full h-full object-contain"
                          src={row.ficha?.imagen_url ?? ""}
                        />
                      ) : (
                        <User
                          size={10}
                          style={{
                            color:
                              "color-mix(in srgb, var(--primary) 30%, transparent)",
                          }}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className="text-micro font-black uppercase tracking-tight capitalize truncate"
                        style={{ color: "var(--primary)" }}
                      >
                        {row.ficha?.nombre ?? "Identidad"}
                      </p>
                      <span
                        className="inline-flex items-center gap-1 text-micro font-black uppercase tracking-wider mt-0.5"
                        style={{
                          color:
                            row.estado === "reclamada"
                              ? "color-mix(in srgb, var(--primary) 35%, transparent)"
                              : row.estado === "completada"
                                ? "var(--callout-success-title)"
                                : "color-mix(in srgb, var(--primary) 45%, transparent)",
                        }}
                      >
                        {row.estado === "en_curso" && <Clock size={8} />}
                        {row.estado === "completada" && (
                          <CheckCircle2 size={8} />
                        )}
                        {row.estado === "reclamada" && <Lock size={8} />}
                        {ESTADO_LABEL[row.estado]}
                      </span>
                    </div>

                    {/* Acción según estado */}
                    {row.estado === "en_curso" && (
                      <button
                        className="flex items-center gap-1 px-2 py-1 transition-all shrink-0"
                        disabled={actualizandoUserId === row.ficha_id}
                        style={{
                          borderRadius: "var(--radius-btn)",
                          background: "var(--primary)",
                          color: "var(--btn-text)",
                          fontSize: "7px",
                          fontWeight: 900,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                        title="Marcar completada"
                        onClick={() => cambiarEstadoUsuario(row, "completada")}
                      >
                        {actualizandoUserId === row.ficha_id ? (
                          <Loader2 className="animate-spin" size={9} />
                        ) : (
                          <CheckCircle2 size={9} />
                        )}
                        <span className="hidden sm:inline">Completar</span>
                      </button>
                    )}

                    {row.estado === "completada" && (
                      <button
                        className="flex items-center gap-1 px-2 py-1 transition-all shrink-0"
                        disabled={actualizandoUserId === row.ficha_id}
                        style={{
                          borderRadius: "var(--radius-btn)",
                          border:
                            "1px solid color-mix(in srgb, var(--primary) 16%, transparent)",
                          color: "var(--primary)",
                          fontSize: "7px",
                          fontWeight: 900,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                        title="Devolver a en curso"
                        onClick={() => cambiarEstadoUsuario(row, "en_curso")}
                      >
                        {actualizandoUserId === row.ficha_id ? (
                          <Loader2 className="animate-spin" size={9} />
                        ) : (
                          <RotateCcw size={9} />
                        )}
                        <span className="hidden sm:inline">Deshacer</span>
                      </button>
                    )}

                    {row.estado === "reclamada" && (
                      <span
                        className="text-micro font-black uppercase tracking-wider px-1.5 py-1 shrink-0"
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary) 6%, transparent)",
                          borderRadius: "2px",
                          color:
                            "color-mix(in srgb, var(--primary) 35%, transparent)",
                        }}
                      >
                        Entregada
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal crear/editar misión ── */}
      <AnimatePresence>
        {showForm && (
          <>
            <MotionDiv
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-40 backdrop-blur-sm"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={() => setShowForm(false)}
            />
            <MotionDiv
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[30rem]"
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              style={{
                background: "var(--white-custom)",
                borderRadius: "var(--radius-card)",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                boxShadow:
                  "0 20px 60px color-mix(in srgb, var(--primary) 16%, transparent)",
                maxHeight: "86dvh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
              transition={{ type: "spring", stiffness: 360, damping: 30 }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-5 py-4 shrink-0"
                style={{
                  borderBottom:
                    "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                }}
              >
                <p
                  className="text-sm font-black uppercase italic tracking-tight"
                  style={{ color: "var(--primary)" }}
                >
                  {form.id ? "Editar misión" : "Nueva misión"}
                </p>
                <button
                  className="w-7 h-7 flex items-center justify-center transition-opacity hover:opacity-60"
                  style={{ color: "var(--primary)" }}
                  onClick={() => setShowForm(false)}
                >
                  <X size={13} />
                </button>
              </div>

              {/* Form body */}
              <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">
                <Campo label="Título">
                  <input
                    className="campo-input"
                    placeholder="Ej. Derrota al Centinela de Piedra"
                    style={inputStyle}
                    value={form.titulo}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, titulo: e.target.value }))
                    }
                  />
                </Campo>

                {/* ── Entidades vinculadas — visible de inmediato ── */}
                {form.id ? (
                  <PanelEntidadesMision misionId={form.id} />
                ) : (
                  <div
                    className="rounded-xl flex items-center justify-center py-2.5 gap-2"
                    style={{
                      border:
                        "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                      background:
                        "color-mix(in srgb, var(--primary) 2%, transparent)",
                    }}
                  >
                    <Swords
                      size={9}
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 25%, transparent)",
                      }}
                    />
                    <span
                      className="text-micro font-black uppercase tracking-widest"
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 25%, transparent)",
                      }}
                    >
                      Guarda la misión para vincular entidades
                    </span>
                  </div>
                )}

                <Campo label="Descripción">
                  <textarea
                    className="campo-input"
                    placeholder="¿En qué consiste la misión?"
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical" }}
                    value={form.descripcion}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, descripcion: e.target.value }))
                    }
                  />
                </Campo>

                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Dificultad">
                    <select
                      className="campo-input"
                      style={inputStyle}
                      value={form.dificultad}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          dificultad: e.target.value as Dificultad,
                        }))
                      }
                    >
                      {DIFICULTADES.map((d) => (
                        <option key={d} value={d}>
                          {DIFICULTAD_LABEL[d]}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo label="Categoría">
                    <input
                      className="campo-input"
                      placeholder="Ej. combate"
                      style={inputStyle}
                      value={form.categoria}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, categoria: e.target.value }))
                      }
                    />
                  </Campo>
                </div>

                <Campo label="Imagen de la misión">
                  <div className="flex gap-2 items-center">
                    <div
                      className="w-10 h-10 shrink-0 overflow-hidden flex items-center justify-center"
                      style={{
                        borderRadius: "var(--radius-btn)",
                        background:
                          "color-mix(in srgb, var(--primary) 6%, transparent)",
                        border:
                          "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                      }}
                    >
                      {form.imagen_url ? (
                        <img
                          alt=""
                          className="w-full h-full object-cover"
                          src={form.imagen_url}
                        />
                      ) : (
                        <Scroll
                          size={14}
                          style={{
                            color:
                              "color-mix(in srgb, var(--primary) 25%, transparent)",
                          }}
                        />
                      )}
                    </div>
                    <input
                      className="campo-input flex-1"
                      placeholder="https://… o usa el selector"
                      style={inputStyle}
                      value={form.imagen_url}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, imagen_url: e.target.value }))
                      }
                    />
                    <PickerImagenMisionBtn
                      value={form.imagen_url}
                      onChange={(url) =>
                        setForm((f) => ({ ...f, imagen_url: url }))
                      }
                    />
                  </div>
                </Campo>

                <Campo label="Requisitos (opcional)">
                  <input
                    className="campo-input"
                    placeholder="Ej. Nivel 5+"
                    style={inputStyle}
                    value={form.requisitos}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, requisitos: e.target.value }))
                    }
                  />
                </Campo>

                <div
                  className="flex items-center gap-2 mt-1 mb-1"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 28%, transparent)",
                  }}
                >
                  <Award size={11} />
                  <span className="text-micro font-black uppercase tracking-widest">
                    Recompensa
                  </span>
                  <div
                    className="flex-1 h-px"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 8%, transparent)",
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Campo label="XP">
                    <input
                      className="campo-input"
                      min={0}
                      style={inputStyle}
                      type="number"
                      value={form.recompensa_xp}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          recompensa_xp: e.target.value,
                        }))
                      }
                    />
                  </Campo>
                  <Campo label="Monedas">
                    <input
                      className="campo-input"
                      min={0}
                      style={inputStyle}
                      type="number"
                      value={form.recompensa_monedas}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          recompensa_monedas: e.target.value,
                        }))
                      }
                    />
                  </Campo>
                </div>

                <SelectorItemRecompensa
                  itemId={form.recompensa_item_id}
                  itemImagenUrl={form.recompensa_item_imagen_url}
                  itemNombre={form.recompensa_item_nombre}
                  onChange={(id, nombre, imagenUrl) =>
                    setForm((f) => ({
                      ...f,
                      recompensa_item_id: id,
                      recompensa_item_nombre: nombre,
                      recompensa_item_imagen_url: imagenUrl,
                    }))
                  }
                />

                <button
                  className="flex items-center gap-2 mt-1"
                  onClick={() => setForm((f) => ({ ...f, activa: !f.activa }))}
                >
                  <div
                    className="w-4 h-4 flex items-center justify-center shrink-0"
                    style={{
                      borderRadius: "3px",
                      border: `1px solid ${
                        form.activa
                          ? "var(--primary)"
                          : "color-mix(in srgb, var(--primary) 25%, transparent)"
                      }`,
                      background: form.activa
                        ? "var(--primary)"
                        : "transparent",
                    }}
                  >
                    {form.activa && (
                      <svg fill="none" height="7" viewBox="0 0 7 7" width="7">
                        <path
                          d="M1 3.5L3 5.5L6 1.5"
                          stroke="white"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.2"
                        />
                      </svg>
                    )}
                  </div>
                  <span
                    className="text-micro font-black uppercase tracking-wider"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 45%, transparent)",
                    }}
                  >
                    Visible en el tablón
                  </span>
                </button>
              </div>

              {/* Footer */}
              <div
                className="px-4 py-3 shrink-0 flex items-center justify-end gap-2"
                style={{
                  borderTop:
                    "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                }}
              >
                <button
                  className="px-4 py-2 transition-all"
                  style={{
                    borderRadius: "var(--radius-btn)",
                    color:
                      "color-mix(in srgb, var(--primary) 45%, transparent)",
                    fontSize: "9px",
                    fontWeight: 900,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                  }}
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </button>
                <button
                  className="flex items-center gap-1.5 px-4 py-2 transition-all"
                  disabled={guardando}
                  style={{
                    borderRadius: "var(--radius-btn)",
                    background: "var(--primary)",
                    color: "var(--btn-text)",
                    fontSize: "9px",
                    fontWeight: 900,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                  }}
                  onClick={guardar}
                >
                  {guardando ? (
                    <Loader2 className="animate-spin" size={10} />
                  ) : (
                    <Plus size={10} />
                  )}
                  {form.id ? "Guardar cambios" : "Crear misión"}
                </button>
              </div>
            </MotionDiv>
          </>
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
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

// ── Helpers de presentación del formulario ──────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "color-mix(in srgb, var(--primary) 4%, transparent)",
  border: "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
  borderRadius: "var(--radius-btn)",
  padding: "8px 10px",
  fontSize: "12px",
  color: "var(--primary)",
  outline: "none",
};

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span
        className="text-micro font-black uppercase tracking-wider"
        style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

// ── Selector de imagen para misión (igual que PickerImagenItemBtn en EditorItem) ──

function PickerImagenMisionBtn({
  value: _value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white-custom rounded-2xl shadow-2xl border border-primary/15 w-full max-w-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-micro font-black uppercase tracking-[0.3em] text-primary/50 flex items-center gap-2">
                <Camera size={11} /> Imagen de la misión
              </h3>
              <button
                className="text-primary/30 hover:text-primary transition-colors"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <SimpleImagePicker
              onClose={() => setOpen(false)}
              onSelect={(url) => {
                onChange(url);
                setOpen(false);
              }}
            />
          </div>
        </div>
      )}
      <button
        className="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg border transition-all"
        style={{
          background: "color-mix(in srgb, var(--primary) 5%, transparent)",
          borderColor: "color-mix(in srgb, var(--primary) 15%, transparent)",
          color: "color-mix(in srgb, var(--primary) 45%, transparent)",
        }}
        title="Seleccionar imagen"
        type="button"
        onClick={() => setOpen(true)}
      >
        <Camera size={13} />
      </button>
    </>
  );
}

// ── Selector de item de recompensa ────────────────────────────────────────────

type ItemMin = {
  id: string;
  nombre: string;
  imagen_url?: string | null;
  categoria?: string | null;
};

function SelectorItemRecompensa({
  itemId,
  itemNombre,
  itemImagenUrl,
  onChange,
}: {
  itemId: string | null;
  itemNombre: string;
  itemImagenUrl: string;
  onChange: (id: string | null, nombre: string, imagenUrl: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<ItemMin[]>([]);
  const [busqueda, setBusqueda] = React.useState("");
  const [cargando, setCargando] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    async function cargarItems() {
      // Dexie primero — aparece al instante sin spinner
      const local = await dexieGetAll<ItemMin>("items");
      if (local.length > 0) {
        setItems(local as any);
        setCargando(false);
      } else {
        setCargando(true);
      }
      // Supabase en background
      supabase
        .from("items")
        .select("id, nombre, imagen_url, categoria")
        .order("nombre")
        .then(({ data }) => {
          if (data) setItems(data);
          setCargando(false);
        });
    }
    void cargarItems();
  }, [open]);

  const filtrados = items.filter((i) =>
    i.nombre.toLowerCase().includes(busqueda.toLowerCase()),
  );

  const limpiar = () => onChange(null, "", "");

  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-micro font-black uppercase tracking-wider"
        style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
      >
        Item de recompensa (opcional)
      </span>

      {/* Preview del item seleccionado */}
      {itemId ? (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            background: "color-mix(in srgb, var(--primary) 5%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
          }}
        >
          <div
            className="w-7 h-7 shrink-0 overflow-hidden flex items-center justify-center rounded"
            style={{
              background: "color-mix(in srgb, var(--primary) 8%, transparent)",
            }}
          >
            {itemImagenUrl ? (
              <img
                alt={itemNombre}
                className="w-full h-full object-cover"
                src={itemImagenUrl}
              />
            ) : (
              <Package
                size={11}
                style={{
                  color: "color-mix(in srgb, var(--primary) 30%, transparent)",
                }}
              />
            )}
          </div>
          <span
            className="flex-1 min-w-0 truncate text-micro font-bold capitalize"
            style={{ color: "var(--primary)" }}
          >
            {itemNombre}
          </span>
          <button
            className="shrink-0 transition-opacity hover:opacity-70"
            style={{
              color: "color-mix(in srgb, var(--primary) 35%, transparent)",
            }}
            title="Quitar item"
            type="button"
            onClick={limpiar}
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left"
          style={{
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
            color: "color-mix(in srgb, var(--primary) 30%, transparent)",
            fontSize: "11px",
            fontWeight: 600,
          }}
          type="button"
          onClick={() => setOpen(true)}
        >
          <Package size={12} />
          Seleccionar item del catálogo…
        </button>
      )}

      {itemId && (
        <button
          className="text-micro font-black uppercase tracking-wider text-left transition-opacity hover:opacity-70 pl-0.5"
          style={{
            color: "color-mix(in srgb, var(--primary) 35%, transparent)",
          }}
          type="button"
          onClick={() => setOpen(true)}
        >
          Cambiar item
        </button>
      )}

      {/* Modal selector */}
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white-custom rounded-2xl shadow-2xl border border-primary/15 w-full max-w-md flex flex-col"
            style={{ maxHeight: "70dvh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-primary/8">
              <span className="text-micro font-black uppercase tracking-[0.25em] text-primary/40 flex items-center gap-1.5">
                <Package size={10} /> Seleccionar item
              </span>
              <button
                className="text-primary/30 hover:text-primary transition-colors"
                type="button"
                onClick={() => setOpen(false)}
              >
                <X size={14} />
              </button>
            </div>

            {/* Búsqueda */}
            <div className="px-3 py-2 shrink-0 border-b border-primary/8">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{
                  background:
                    "color-mix(in srgb, var(--primary) 4%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                }}
              >
                <Search
                  size={11}
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 30%, transparent)",
                  }}
                />
                <input
                  autoFocus
                  className="flex-1 bg-transparent outline-none text-micro"
                  placeholder="Buscar item…"
                  style={{ color: "var(--primary)" }}
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto flex-1">
              {cargando ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2
                    className="animate-spin"
                    size={16}
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 25%, transparent)",
                    }}
                  />
                </div>
              ) : filtrados.length === 0 ? (
                <div className="flex items-center justify-center py-10">
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
                filtrados.map((item) => (
                  <button
                    key={item.id}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{
                      borderBottom:
                        "1px solid color-mix(in srgb, var(--primary) 5%, transparent)",
                      background:
                        itemId === item.id
                          ? "color-mix(in srgb, var(--primary) 6%, transparent)"
                          : "transparent",
                    }}
                    type="button"
                    onClick={() => {
                      onChange(item.id, item.nombre, item.imagen_url ?? "");
                      setOpen(false);
                      setBusqueda("");
                    }}
                  >
                    <div
                      className="w-7 h-7 shrink-0 overflow-hidden flex items-center justify-center rounded"
                      style={{
                        background:
                          "color-mix(in srgb, var(--primary) 8%, transparent)",
                      }}
                    >
                      {item.imagen_url ? (
                        <img
                          alt={item.nombre}
                          className="w-full h-full object-cover"
                          src={item.imagen_url}
                        />
                      ) : (
                        <Package
                          size={10}
                          style={{
                            color:
                              "color-mix(in srgb, var(--primary) 25%, transparent)",
                          }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-micro font-bold capitalize truncate"
                        style={{ color: "var(--primary)" }}
                      >
                        {item.nombre}
                      </p>
                      {item.categoria && (
                        <p
                          className="text-micro uppercase tracking-wider truncate"
                          style={{
                            color:
                              "color-mix(in srgb, var(--primary) 30%, transparent)",
                          }}
                        >
                          {item.categoria}
                        </p>
                      )}
                    </div>
                    {itemId === item.id && (
                      <div
                        className="w-4 h-4 shrink-0 rounded-full flex items-center justify-center"
                        style={{ background: "var(--primary)" }}
                      >
                        <svg fill="none" height="7" viewBox="0 0 7 7" width="7">
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
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tipos para entidades vinculadas ───────────────────────────────────────────

type TipoEntidad = "personaje" | "criatura" | "item" | "ciudad" | "reino";
type RolEntidad = "relacionado" | "objetivo" | "recompensa";

type EntidadVinculo = {
  id: string;
  entidad_id: string;
  tipo: TipoEntidad;
  rol: RolEntidad;
  nombre: string;
  imagen_url?: string | null;
};

type EntidadMin = { id: string; nombre: string; imagen_url?: string | null };

const TIPO_CONFIG: Record<
  TipoEntidad,
  { label: string; icon: React.ReactNode; tabla: string; imgCol: string }
> = {
  personaje: {
    label: "Personajes",
    icon: <User size={9} />,
    tabla: "personajes",
    imgCol: "img_url",
  },
  criatura: {
    label: "Criaturas",
    icon: <Bug size={9} />,
    tabla: "criaturas",
    imgCol: "imagen_url",
  },
  item: {
    label: "Objetos",
    icon: <Swords size={9} />,
    tabla: "items",
    imgCol: "imagen_url",
  },
  ciudad: {
    label: "Ciudades",
    icon: <MapPin size={9} />,
    tabla: "ciudades",
    imgCol: "imagen_url",
  },
  reino: {
    label: "Reinos",
    icon: <Globe size={9} />,
    tabla: "reinos",
    imgCol: "imagen_url",
  },
};

const ROL_LABELS: Record<RolEntidad, string> = {
  relacionado: "Relacionado",
  objetivo: "Objetivo",
  recompensa: "Recompensa",
};

const ROL_COLORS: Record<RolEntidad, string> = {
  relacionado: "color-mix(in srgb, var(--primary) 20%, transparent)",
  objetivo: "var(--primary)",
  recompensa: "var(--callout-success-border)",
};

function PanelEntidadesMision({ misionId }: { misionId: string }) {
  const [open, setOpen] = React.useState(false);
  const [vinculos, setVinculos] = React.useState<EntidadVinculo[]>([]);
  const [catalogo, setCatalogo] = React.useState<EntidadMin[]>([]);
  const [tipoActivo, setTipoActivo] = React.useState<TipoEntidad>("personaje");
  const [busqueda, setBusqueda] = React.useState("");
  const [loadingVinculos, setLoadingVinculos] = React.useState(true);
  const [loadingCat, setLoadingCat] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Cargar vínculos existentes al montar
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingVinculos(true);
      // Dexie primero
      try {
        const { db } = await import("@/infra/supabase/db");
        if (db?.mision_entidades) {
          const local = await db.mision_entidades
            .where("mision_id")
            .equals(misionId)
            .toArray();
          if (!cancelled && local.length > 0) {
            setVinculos(await resolverNombres(local as any[]));
          }
        }
      } catch {}
      // Supabase
      try {
        const { data } = await supabase
          .from("mision_entidades")
          .select("id, tipo, entidad_id, rol")
          .eq("mision_id", misionId);
        if (!cancelled && data) {
          const resolved = await resolverNombres(data);
          setVinculos(resolved);
          try {
            const { db } = await import("@/infra/supabase/db");
            if (db?.mision_entidades)
              await db.mision_entidades.bulkPut(
                resolved.map((v) => ({ ...v, mision_id: misionId })),
              );
          } catch {}
        }
      } catch {}
      if (!cancelled) setLoadingVinculos(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [misionId]);

  // Cargar catálogo del tab activo al abrir el modal
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadCat() {
      setLoadingCat(true);
      const cfg = TIPO_CONFIG[tipoActivo];
      // Dexie primero
      try {
        const { db } = await import("@/infra/supabase/db");
        const local: any[] = (await (db as any)?.[cfg.tabla]?.toArray()) ?? [];
        if (!cancelled && local.length > 0) {
          setCatalogo(
            local.map((x) => ({
              id: x.id,
              nombre: x.nombre,
              imagen_url: x[cfg.imgCol] ?? x.imagen_url ?? null,
            })),
          );
          setLoadingCat(false);
        }
      } catch {}
      // Supabase
      try {
        const { data } = await (supabase.from(cfg.tabla) as any)
          .select(`id, nombre, ${cfg.imgCol}`)
          .order("nombre");
        if (!cancelled && data) {
          setCatalogo(
            data.map((x: any) => ({
              id: x.id,
              nombre: x.nombre,
              imagen_url: x[cfg.imgCol] ?? null,
            })),
          );
        }
      } catch {}
      if (!cancelled) setLoadingCat(false);
    }
    void loadCat();
    return () => {
      cancelled = true;
    };
  }, [open, tipoActivo]);

  const vincActivos = vinculos.filter((v) => v.tipo === tipoActivo);
  const selectedIds = vincActivos.map((v) => v.entidad_id);
  const filtrados = catalogo.filter((e) =>
    e.nombre.toLowerCase().includes(busqueda.toLowerCase()),
  );

  const handleToggle = async (entidadId: string, add: boolean) => {
    setSaving(true);
    if (add) {
      const entidad = catalogo.find((e) => e.id === entidadId);
      if (!entidad) {
        setSaving(false);
        return;
      }
      const { data, error } = await supabase
        .from("mision_entidades")
        .insert({
          mision_id: misionId,
          tipo: tipoActivo,
          entidad_id: entidadId,
          rol: "relacionado",
        })
        .select()
        .single();
      if (!error && data) {
        const nuevo: EntidadVinculo = {
          id: data.id,
          entidad_id: entidadId,
          tipo: tipoActivo,
          rol: "relacionado",
          nombre: entidad.nombre,
          imagen_url: entidad.imagen_url ?? null,
        };
        setVinculos((prev) => [...prev, nuevo]);
        try {
          const { db } = await import("@/infra/supabase/db");
          if (db?.mision_entidades)
            await db.mision_entidades.put({ ...nuevo, mision_id: misionId });
        } catch {}
      }
    } else {
      const vinculo = vinculos.find(
        (v) => v.tipo === tipoActivo && v.entidad_id === entidadId,
      );
      if (!vinculo) {
        setSaving(false);
        return;
      }
      await supabase.from("mision_entidades").delete().eq("id", vinculo.id);
      setVinculos((prev) => prev.filter((v) => v.id !== vinculo.id));
      try {
        const { db } = await import("@/infra/supabase/db");
        if (db?.mision_entidades) await db.mision_entidades.delete(vinculo.id);
      } catch {}
    }
    setSaving(false);
  };

  const cambiarRol = async (vinculoId: string, nuevoRol: RolEntidad) => {
    await supabase
      .from("mision_entidades")
      .update({ rol: nuevoRol })
      .eq("id", vinculoId);
    setVinculos((prev) =>
      prev.map((v) => (v.id === vinculoId ? { ...v, rol: nuevoRol } : v)),
    );
    try {
      const { db } = await import("@/infra/supabase/db");
      if (db?.mision_entidades) {
        const row = await db.mision_entidades.get(vinculoId);
        if (row) await db.mision_entidades.put({ ...row, rol: nuevoRol });
      }
    } catch {}
  };

  const divider =
    "1px solid color-mix(in srgb, var(--primary) 8%, transparent)";
  const subtle = {
    color: "color-mix(in srgb, var(--primary) 30%, transparent)",
  };
  const tiposTabs: TipoEntidad[] = [
    "personaje",
    "criatura",
    "item",
    "ciudad",
    "reino",
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-micro font-black uppercase tracking-wider"
        style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
      >
        Entidades vinculadas ({loadingVinculos ? "…" : vinculos.length})
      </span>

      {/* Vista previa de vínculos existentes — igual que el preview del item */}
      {vinculos.length > 0 ? (
        <div className="flex flex-col gap-1">
          {vinculos.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{
                background:
                  "color-mix(in srgb, var(--primary) 4%, transparent)",
                border: divider,
              }}
            >
              <div
                className="w-6 h-6 shrink-0 overflow-hidden flex items-center justify-center rounded"
                style={{
                  background:
                    "color-mix(in srgb, var(--primary) 8%, transparent)",
                }}
              >
                {v.imagen_url ? (
                  <img
                    alt={v.nombre}
                    className="w-full h-full object-cover"
                    src={v.imagen_url}
                  />
                ) : (
                  <span style={subtle}>{TIPO_CONFIG[v.tipo].icon}</span>
                )}
              </div>
              <span
                className="flex-1 min-w-0 truncate text-micro font-bold capitalize"
                style={{ color: "var(--primary)" }}
              >
                {v.nombre}
              </span>
              {/* Rol inline */}
              <div className="flex gap-0.5 shrink-0">
                {(
                  ["relacionado", "objetivo", "recompensa"] as RolEntidad[]
                ).map((rol) => (
                  <button
                    key={rol}
                    className="px-1.5 py-0.5 transition-all"
                    style={{
                      borderRadius: "3px",
                      fontSize: "7px",
                      fontWeight: 900,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      background:
                        v.rol === rol ? ROL_COLORS[rol] : "transparent",
                      color:
                        v.rol === rol
                          ? rol === "relacionado"
                            ? "var(--primary)"
                            : "white"
                          : "color-mix(in srgb, var(--primary) 25%, transparent)",
                    }}
                    title={ROL_LABELS[rol]}
                    type="button"
                    onClick={() => cambiarRol(v.id, rol)}
                  >
                    {rol === "relacionado"
                      ? "Rel"
                      : rol === "objetivo"
                        ? "Obj"
                        : "Rec"}
                  </button>
                ))}
              </div>
              <button
                className="shrink-0 transition-opacity hover:opacity-70"
                style={subtle}
                type="button"
                onClick={() => handleToggle(v.entidad_id, false)}
              >
                <X size={11} />
              </button>
            </div>
          ))}
          <button
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left mt-0.5"
            style={{
              background: "color-mix(in srgb, var(--primary) 3%, transparent)",
              border: divider,
              color: "color-mix(in srgb, var(--primary) 35%, transparent)",
              fontSize: "11px",
              fontWeight: 600,
            }}
            type="button"
            onClick={() => setOpen(true)}
          >
            <Plus size={11} />
            Añadir más entidades…
          </button>
        </div>
      ) : (
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left"
          style={{
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
            border: divider,
            color: "color-mix(in srgb, var(--primary) 30%, transparent)",
            fontSize: "11px",
            fontWeight: 600,
          }}
          type="button"
          onClick={() => setOpen(true)}
        >
          <Swords size={12} />
          Vincular personajes, criaturas, objetos…
        </button>
      )}

      {/* Modal selector — igual que el modal de SelectorItemRecompensa */}
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white-custom rounded-2xl shadow-2xl border border-primary/15 w-full max-w-md flex flex-col"
            style={{ maxHeight: "75dvh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ borderBottom: divider }}
            >
              <span
                className="text-micro font-black uppercase tracking-[0.25em] flex items-center gap-1.5"
                style={subtle}
              >
                <Swords size={10} /> Vincular entidades
              </span>
              <button
                className="transition-colors"
                style={subtle}
                type="button"
                onClick={() => setOpen(false)}
              >
                <X size={14} />
              </button>
            </div>

            {/* Tabs por tipo */}
            <div className="flex shrink-0" style={{ borderBottom: divider }}>
              {tiposTabs.map((tipo) => {
                const cfg = TIPO_CONFIG[tipo];
                const count = vinculos.filter((v) => v.tipo === tipo).length;
                const active = tipoActivo === tipo;
                return (
                  <button
                    key={tipo}
                    className="flex-1 flex flex-col items-center gap-0.5 py-2 transition-all"
                    style={{
                      background: active
                        ? "color-mix(in srgb, var(--primary) 6%, transparent)"
                        : "transparent",
                      borderRight: tipo !== "reino" ? divider : undefined,
                      color: active
                        ? "var(--primary)"
                        : "color-mix(in srgb, var(--primary) 30%, transparent)",
                    }}
                    type="button"
                    onClick={() => {
                      setTipoActivo(tipo);
                      setBusqueda("");
                    }}
                  >
                    {cfg.icon}
                    <span className="text-micro font-black uppercase tracking-wider">
                      {cfg.label}
                    </span>
                    {count > 0 && (
                      <span
                        className="text-micro font-black tabular-nums px-1 rounded"
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary) 10%, transparent)",
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Búsqueda */}
            <div
              className="px-3 py-2 shrink-0"
              style={{ borderBottom: divider }}
            >
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{
                  background:
                    "color-mix(in srgb, var(--primary) 4%, transparent)",
                  border: divider,
                }}
              >
                <Search size={11} style={subtle} />
                <input
                  autoFocus
                  className="flex-1 bg-transparent outline-none text-micro"
                  placeholder={`Buscar ${TIPO_CONFIG[tipoActivo].label.toLowerCase()}…`}
                  style={{ color: "var(--primary)" }}
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
                {(loadingCat || saving) && (
                  <Loader2
                    className="animate-spin shrink-0"
                    size={11}
                    style={subtle}
                  />
                )}
              </div>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto flex-1">
              {loadingCat && catalogo.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="animate-spin" size={16} style={subtle} />
                </div>
              ) : filtrados.length === 0 ? (
                <p
                  className="text-center text-micro font-black uppercase tracking-widest py-10"
                  style={subtle}
                >
                  Sin resultados
                </p>
              ) : (
                filtrados.map((entidad) => {
                  const sel = selectedIds.includes(entidad.id);
                  return (
                    <button
                      key={entidad.id}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                      style={{
                        borderBottom: divider,
                        background: sel
                          ? "color-mix(in srgb, var(--primary) 6%, transparent)"
                          : "transparent",
                        opacity: saving ? 0.6 : 1,
                      }}
                      type="button"
                      onClick={() => !saving && handleToggle(entidad.id, !sel)}
                    >
                      <div
                        className="w-7 h-7 shrink-0 overflow-hidden flex items-center justify-center rounded"
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary) 8%, transparent)",
                        }}
                      >
                        {entidad.imagen_url ? (
                          <img
                            alt={entidad.nombre}
                            className="w-full h-full object-cover"
                            src={entidad.imagen_url}
                          />
                        ) : (
                          <span style={subtle}>
                            {TIPO_CONFIG[tipoActivo].icon}
                          </span>
                        )}
                      </div>
                      <span
                        className="flex-1 min-w-0 truncate text-micro font-bold capitalize"
                        style={{ color: "var(--primary)" }}
                      >
                        {entidad.nombre}
                      </span>
                      {sel && (
                        <div
                          className="w-4 h-4 shrink-0 rounded-full flex items-center justify-center"
                          style={{ background: "var(--primary)" }}
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
          </div>
        </div>
      )}
    </div>
  );
}

async function resolverNombres(
  rows: Array<{ id: string; tipo: string; entidad_id: string; rol: string }>,
): Promise<EntidadVinculo[]> {
  const porTipo: Record<string, string[]> = {};
  for (const r of rows) {
    if (!porTipo[r.tipo]) porTipo[r.tipo] = [];
    porTipo[r.tipo].push(r.entidad_id);
  }
  const nombreMap = new Map<
    string,
    { nombre: string; imagen_url: string | null }
  >();
  await Promise.all(
    Object.entries(porTipo).map(async ([tipo, ids]) => {
      const cfg = TIPO_CONFIG[tipo as TipoEntidad];
      if (!cfg) return;
      try {
        const { db } = await import("@/infra/supabase/db");
        const local: any[] =
          (await (db as any)?.[cfg.tabla]?.bulkGet(ids)) ?? [];
        for (const e of local.filter(Boolean))
          nombreMap.set(e.id, {
            nombre: e.nombre,
            imagen_url: e[cfg.imgCol] ?? e.imagen_url ?? null,
          });
      } catch {}
      const faltantes = ids.filter((id) => !nombreMap.has(id));
      if (faltantes.length > 0) {
        const { data } = await (supabase.from(cfg.tabla) as any)
          .select(`id, nombre, ${cfg.imgCol}`)
          .in("id", faltantes);
        for (const e of data ?? [])
          nombreMap.set(e.id, {
            nombre: e.nombre,
            imagen_url: (e as any)[cfg.imgCol] ?? null,
          });
      }
    }),
  );
  return rows.map((r) => ({
    id: r.id,
    entidad_id: r.entidad_id,
    tipo: r.tipo as TipoEntidad,
    rol: r.rol as RolEntidad,
    nombre: nombreMap.get(r.entidad_id)?.nombre ?? "—",
    imagen_url: nombreMap.get(r.entidad_id)?.imagen_url ?? null,
  }));
}
