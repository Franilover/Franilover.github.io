"use client";

/**
 * EditorLineaTiempo.tsx
 * ────────────────────────
 * View de "Historia del mundo / Línea de tiempo": orquesta el panel
 * PanelHistoriaMundo (tarjetas de evento, modales de evento/eras, minimapa).
 *
 * Piezas que antes vivían acá y se extrajeron:
 *   useCalendario     → hooks/useCalendario.ts (catálogo de estaciones/eras)
 *   SelectorFechaMundo → components/calendario/SelectorFechaMundo.tsx
 *   FechaMundoBadge    → components/calendario/FechaMundoBadge.tsx
 * (las tres se usan también fuera de esta view — Personaje, Capítulos, etc.
 * — así que no correspondía dejarlas acá).
 *
 * Todo lo demás en este archivo (CapituloEventoRow, ModalEra,
 * ListaEventosConMinimapa, etc.) es exclusivo de esta pantalla y se queda.
 *
 * Ruta destino:
 *   src/features/editorGarlia/views/EditorLineaTiempo.tsx
 */

import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Crown,
  Loader2,
  Music,
  Plus,
  Trash2,
  User,
  X,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { onSyncDone } from "@/infra/sync/useOfflineSync";
import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";
import type { EraMundo} from "@/lib/utils/calendario";
import { diaAbsolutoAFecha, eraEnAnio } from "@/lib/utils/calendario";

import { RichEditor } from "@/editor/lexical";

import { SelectorFechaMundo } from "@/domains/garlia/calendario/SelectorFechaMundo";
import { SaveIndicator } from "@/domains/garlia/_shared/UIComponents";
import { useErasDelPersonaje } from "@/domains/garlia/personajes/useErasDelPersonaje";
import {
  useCalendario,
  invalidarCacheEras,
  type CalCache,
} from "@/domains/garlia/calendario/useCalendario";
import { type Reino } from "@/domains/garlia/reinos/types";
import { type SaveStatus } from "@/domains/garlia/_shared/types";

// ════════════════════════════════════════════════════════════════════════════
// ─── Historia del mundo / Línea de tiempo (movido desde EditorMundo.tsx) ────
// Incluye: tarjetas de evento (capítulos, canciones, cumpleaños, eventos sueltos),
// modales de creación de evento y de gestión de eras, el hook de reinos con
// historia completa, y el panel PanelHistoriaMundo que orquesta todo.
// ════════════════════════════════════════════════════════════════════════════

type TimelineEvent = {
  id: string;
  year: string;
  title: string;
  description: string;
  dia_absoluto?: number;
  reinoId?: string | null;
  reinoNombre?: string | null;
};

type MundoTimelineEvent = TimelineEvent & {
  source: "mundo" | "reino" | "capitulo" | "cancion" | "cumpleanos" | "era_personaje";
  reinoNombre?: string;
  reinoId?: string;
  yearNum: number; // dia_absoluto — para ordenar
  dia_absoluto?: number; // el valor real del calendario
  capData?: CapTimeline;
  cancionData?: {
    id: string;
    titulo: string;
    cantante?: string | null;
    reinoNombre?: string | null;
    dia_absoluto?: number;
  };
  cumpleanosData?: {
    id: string;
    nombre: string;
    img_url: string | null;
    reino: string | null;
    fecha_nacimiento: number;
  };
  eraPersonajeData?: {
    id: string;
    personajeId: string;
    personajeNombre: string;
    rasgos: string[];
    notas: string;
  };
};

// (Eliminados: parseYear, decodeTimeline, encodeTimeline, newEvent — sistema antiguo)

// ── Tarjeta de capítulo en la línea de tiempo ────────────────────────────────
function CapituloEventoRow({
  cap,
  reinos = [],
  onNavigate,
  onDiaChange,
}: {
  cap: CapTimeline;
  reinos?: { id: string; nombre: string }[];
  onNavigate: () => void;
  onDiaChange?: (id: string, dia: number) => void;
}) {
  const [saving, setSaving] = useState(false);

  const commitDia = async (dia: number | null) => {
    if (dia == null) return;
    setSaving(true);
    await supabase
      .from("capitulos")
      .update({ dia_absoluto: dia } as any)
      .eq("id", cap.id);
    onDiaChange?.(cap.id, dia);
    setSaving(false);
  };

  const reinosDelCap = (cap.reinos_ids ?? [])
    .map((id) => reinos.find((r) => r.id === id)?.nombre)
    .filter(Boolean) as string[];

  const diaActual = cap.dia_absoluto ?? null;

  return (
    <div className="group/card" style={{ width: 220 }}>
      <div
        className="mx-1.5 rounded-xl transition-all"
        style={{
          border:
            "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
          background: "color-mix(in srgb, var(--primary) 2%, transparent)",
        }}
      >
        <div className="flex flex-col gap-1.5 p-2">
          {/* Libro */}
          {cap.libroTitulo && (
            <span
              className="text-micro font-black uppercase tracking-widest truncate"
              style={{
                color: "color-mix(in srgb, var(--primary) 30%, transparent)",
              }}
            >
              {cap.libroTitulo}
            </span>
          )}

          {/* Selector de fecha */}
          <div className="relative">
            {saving && (
              <Loader2
                className="animate-spin absolute right-2 top-2 z-10 text-primary/30"
                size={8}
              />
            )}
            <SelectorFechaMundo
              placeholder="Sin fecha…"
              value={diaActual}
              onChange={commitDia}
            />
          </div>

          {/* Título navegable */}
          <button
            className="flex items-center gap-1 px-1.5 py-1 rounded-lg border w-full text-left transition-all"
            style={{
              background: "color-mix(in srgb, var(--primary) 4%, transparent)",
              borderColor:
                "color-mix(in srgb, var(--primary) 10%, transparent)",
            }}
            title={`Abrir: ${cap.titulo_capitulo}`}
            type="button"
            onClick={onNavigate}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background =
                "color-mix(in srgb, var(--primary) 9%, transparent)";
              el.style.borderColor =
                "color-mix(in srgb, var(--primary) 22%, transparent)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background =
                "color-mix(in srgb, var(--primary) 4%, transparent)";
              el.style.borderColor =
                "color-mix(in srgb, var(--primary) 10%, transparent)";
            }}
          >
            <BookOpen
              size={8}
              style={{
                color: "color-mix(in srgb, var(--primary) 40%, transparent)",
                flexShrink: 0,
              }}
            />
            <span
              className="text-micro font-bold truncate"
              style={{
                color: "color-mix(in srgb, var(--primary) 65%, transparent)",
              }}
            >
              {cap.titulo_capitulo}
            </span>
          </button>

          {/* Reinos */}
          {reinosDelCap.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {reinosDelCap.map((nombre) => (
                <span
                  key={nombre}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-micro font-black uppercase tracking-widest"
                  style={{
                    background:
                      "color-mix(in srgb, var(--primary) 8%, transparent)",
                    color:
                      "color-mix(in srgb, var(--primary) 50%, transparent)",
                    border:
                      "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                  }}
                >
                  <Crown size={6} /> {nombre}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta horizontal de canción en la línea de tiempo ─────────────────────
function CancionMundoRow({
  cancion,
  onDiaChange,
}: {
  cancion: {
    id: string;
    titulo: string;
    cantante?: string | null;
    reinoNombre?: string | null;
    dia_absoluto?: number;
  };
  onDiaChange?: (id: string, dia: number) => void;
}) {
  const [saving, setSaving] = useState(false);

  const commitDia = async (dia: number | null) => {
    if (dia == null) return;
    setSaving(true);
    await supabase
      .from("canciones")
      .update({ dia_absoluto: dia } as any)
      .eq("id", cancion.id);
    onDiaChange?.(cancion.id, dia);
    setSaving(false);
  };

  const navigate = () => {
    window.dispatchEvent(
      new CustomEvent("garlia-open-entity", {
        detail: { tabla: "canciones", id: cancion.id },
      }),
    );
  };
  return (
    <div className="group/card" style={{ width: 220 }}>
      <div
        className="mx-1.5 rounded-xl transition-all"
        style={{
          border:
            "1px solid color-mix(in srgb, var(--accent) 14%, transparent)",
          background: "color-mix(in srgb, var(--accent) 2%, transparent)",
        }}
      >
        <div className="flex flex-col gap-1.5 p-2">
          {/* Reino */}
          {cancion.reinoNombre && (
            <span
              className="text-micro font-black uppercase tracking-widest truncate"
              style={{
                color: "color-mix(in srgb, var(--accent) 35%, transparent)",
              }}
            >
              {cancion.reinoNombre}
            </span>
          )}
          {/* Selector de fecha */}
          <div className="relative">
            {saving && (
              <Loader2
                className="animate-spin absolute right-2 top-2 z-10 text-accent/40"
                size={8}
              />
            )}
            <SelectorFechaMundo
              placeholder="Sin fecha…"
              value={cancion.dia_absoluto ?? null}
              onChange={commitDia}
            />
          </div>
          {/* Título */}
          <button
            className="flex items-center gap-1 px-1.5 py-1 rounded-lg border w-full text-left transition-all"
            style={{
              background: "color-mix(in srgb, var(--accent) 4%, transparent)",
              borderColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
            }}
            title={`Abrir: ${cancion.titulo}`}
            type="button"
            onClick={navigate}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background =
                "color-mix(in srgb, var(--accent) 9%, transparent)";
              el.style.borderColor =
                "color-mix(in srgb, var(--accent) 22%, transparent)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background =
                "color-mix(in srgb, var(--accent) 4%, transparent)";
              el.style.borderColor =
                "color-mix(in srgb, var(--accent) 10%, transparent)";
            }}
          >
            <Music
              size={8}
              style={{
                color: "color-mix(in srgb, var(--accent) 40%, transparent)",
                flexShrink: 0,
              }}
            />
            <span
              className="text-micro font-bold truncate"
              style={{
                color: "color-mix(in srgb, var(--accent) 65%, var(--primary))",
              }}
            >
              {cancion.titulo}
            </span>
          </button>
          {cancion.cantante && (
            <span
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-micro font-black uppercase tracking-widest truncate self-start"
              style={{
                background: "color-mix(in srgb, var(--accent) 8%, transparent)",
                color: "color-mix(in srgb, var(--accent) 50%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--accent) 12%, transparent)",
                maxWidth: "100%",
              }}
            >
              <Music size={6} /> {cancion.cantante}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta de cumpleaños en la línea de tiempo ──────────────────────────────
function CumpleanosTimelineRow({
  data,
  onNavigate,
}: {
  data: NonNullable<MundoTimelineEvent["cumpleanosData"]>;
  onNavigate?: () => void;
}) {
  return (
    <div className="group/card" style={{ width: 220 }}>
      <div
        className="mx-1.5 rounded-xl transition-all"
        style={{
          border:
            "1px solid color-mix(in srgb, var(--accent) 22%, transparent)",
          background: "color-mix(in srgb, var(--accent) 4%, transparent)",
        }}
      >
        <div className="flex items-center gap-2 p-2">
          {/* Avatar */}
          <div
            className="shrink-0 w-7 h-7 rounded-full border overflow-hidden flex items-center justify-center"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
              background: "color-mix(in srgb, var(--accent) 8%, transparent)",
            }}
          >
            {data.img_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={data.nombre}
                className="w-full h-full object-cover"
                src={data.img_url}
              />
            ) : (
              <svg
                fill="none"
                height="12"
                stroke="var(--accent)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="12"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <button
              className="w-full text-left flex items-center gap-1 rounded transition-opacity hover:opacity-70"
              type="button"
              onClick={onNavigate}
            >
              <span
                className="text-micro font-black uppercase italic truncate"
                style={{ color: "var(--accent)" }}
              >
                {data.nombre}
              </span>
            </button>
            {data.reino && (
              <span
                className="flex items-center gap-0.5 text-micro font-black uppercase tracking-widest truncate mt-0.5"
                style={{
                  color: "color-mix(in srgb, var(--accent) 50%, transparent)",
                }}
              >
                <Crown size={6} /> {data.reino}
              </span>
            )}
          </div>

          {/* Icono torta */}
          <svg
            className="shrink-0 opacity-40"
            fill="none"
            height="11"
            stroke="var(--accent)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="11"
          >
            <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
            <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2 1 2 1" />
            <path d="M2 21h20" />
            <path d="M7 8v2" />
            <path d="M12 8v2" />
            <path d="M17 8v2" />
            <path d="M7 4h.01" />
            <path d="M12 4h.01" />
            <path d="M17 4h.01" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function EventoMundoRow({
  evt,
  onDiaChange,
  onFieldChange,
  onDelete,
  showDescripciones = true,
}: {
  evt: MundoTimelineEvent;
  onDiaChange?: (id: string, dia: number) => void;
  onFieldChange?: (
    id: string,
    field: "titulo" | "descripcion",
    value: string,
  ) => void;
  onDelete?: (id: string) => void;
  showDescripciones?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [titulo, setTitulo] = useState(evt.title);
  const [descripcion, setDescripcion] = useState(evt.description);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTitulo(evt.title);
  }, [evt.title]);
  useEffect(() => {
    setDescripcion(evt.description);
  }, [evt.description]);

  const commitDia = async (dia: number | null) => {
    if (dia == null) return;
    setSaving(true);
    await onDiaChange?.(evt.id, dia);
    setSaving(false);
  };

  const scheduleSave = (field: "titulo" | "descripcion", value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFieldChange?.(evt.id, field, value);
    }, 800);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete?.(evt.id);
    setDeleting(false);
  };

  return (
    <div className="group/card" style={{ width: 220 }}>
      <div
        className="mx-1.5 rounded-xl p-2 flex flex-col gap-1.5 transition-all"
        style={{
          border:
            "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
          background: "color-mix(in srgb, var(--primary) 2.5%, transparent)",
        }}
      >
        {/* Selector de fecha — solo en modo expandido */}
        {showDescripciones && (
          <div className="relative">
            {saving && (
              <Loader2
                className="animate-spin absolute right-2 top-2 z-10 text-primary/30"
                size={8}
              />
            )}
            <SelectorFechaMundo
              placeholder="Sin fecha…"
              value={evt.dia_absoluto ?? null}
              onChange={commitDia}
            />
          </div>
        )}

        {/* Título + botón eliminar */}
        <div className="flex items-center gap-1">
          <input
            className="flex-1 min-w-0 px-1 bg-transparent outline-none rounded transition-all"
            placeholder="Título del evento…"
            style={{
              color: "var(--primary)",
              fontSize: showDescripciones ? "10px" : "13px",
              fontWeight: showDescripciones ? 700 : 900,
            }}
            value={titulo}
            onBlur={(e) => onFieldChange?.(evt.id, "titulo", e.target.value)}
            onChange={(e) => {
              setTitulo(e.target.value);
              scheduleSave("titulo", e.target.value);
            }}
          />
          {!confirmDel ? (
            <button
              className="shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity p-1 rounded-md"
              style={{
                color: "color-mix(in srgb, var(--primary) 25%, transparent)",
              }}
              title="Eliminar evento"
              type="button"
              onClick={() => setConfirmDel(true)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#ef4444";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color =
                  "color-mix(in srgb, var(--primary) 25%, transparent)";
              }}
            >
              <Trash2 size={9} />
            </button>
          ) : (
            <div className="shrink-0 flex items-center gap-1">
              <button
                className="px-1.5 py-0.5 rounded text-micro font-black uppercase tracking-widest transition-all"
                disabled={deleting}
                style={{ background: "#ef444420", color: "#ef4444" }}
                type="button"
                onClick={handleDelete}
              >
                {deleting ? (
                  <Loader2 className="animate-spin" size={7} />
                ) : (
                  "Sí"
                )}
              </button>
              <button
                className="px-1.5 py-0.5 rounded text-micro font-black uppercase tracking-widest"
                style={{
                  color: "color-mix(in srgb, var(--primary) 35%, transparent)",
                }}
                type="button"
                onClick={() => setConfirmDel(false)}
              >
                No
              </button>
            </div>
          )}
        </div>

        {/* Reino — siempre visible */}
        {evt.reinoNombre && (
          <span
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-micro font-black uppercase tracking-widest truncate self-start"
            style={{
              background: "color-mix(in srgb, var(--primary) 8%, transparent)",
              color: "color-mix(in srgb, var(--primary) 50%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
              maxWidth: "150px",
            }}
          >
            <Crown size={6} /> {evt.reinoNombre}
          </span>
        )}

        {/* Descripción — solo en modo expandido */}
        {showDescripciones && (
          <textarea
            className="px-1 text-micro leading-relaxed bg-transparent outline-none w-full rounded resize-y"
            placeholder="Descripción…"
            rows={6}
            style={{
              color: "color-mix(in srgb, var(--primary) 70%, transparent)",
              minHeight: "90px",
            }}
            value={descripcion}
            onBlur={(e) =>
              onFieldChange?.(evt.id, "descripcion", e.target.value)
            }
            onChange={(e) => {
              setDescripcion(e.target.value);
              scheduleSave("descripcion", e.target.value);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Modal: crear nuevo evento de línea de tiempo (mundo o reino) ─────────────
function ModalNuevoEvento({
  reinos,
  onClose,
  onCrear,
  creando,
  reinoFijoId,
}: {
  reinos: { id: string; nombre: string }[];
  onClose: () => void;
  onCrear: (datos: {
    titulo: string;
    reinoId: string | null;
    dia_absoluto: number;
  }) => void;
  creando: boolean;
  /** Cuando se pasa, el reino queda pre-seleccionado y no se puede cambiar */
  reinoFijoId?: string | null;
}) {
  const [titulo, setTitulo] = useState("");
  const [reinoId, setReinoId] = useState<string | null>(reinoFijoId ?? null);
  const [diaAbsoluto, setDiaAbsoluto] = useState<number | null>(null);

  const puedeCrear = titulo.trim().length > 0 && diaAbsoluto != null;

  return (
    <>
      {/* Backdrop separado — no bloquea el portal del selector de fecha */}
      <div
        className="fixed inset-0 z-[1100]"
        style={{ background: "color-mix(in srgb, black 45%, transparent)" }}
        onMouseDown={onClose}
      />
      <div className="fixed inset-0 z-[1101] flex items-center justify-center p-3 pointer-events-none">
        <div
          className="w-full max-w-sm rounded-2xl border shadow-lg p-4 space-y-3 pointer-events-auto"
          style={{
            background: "var(--bg-main)",
            borderColor: "color-mix(in srgb, var(--primary) 14%, transparent)",
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-micro font-black uppercase tracking-[0.2em]"
              style={{ color: "var(--primary)" }}
            >
              Nuevo evento
            </span>
            <button
              className="flex items-center justify-center w-6 h-6 rounded-lg border transition-all"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 12%, transparent)",
                color: "color-mix(in srgb, var(--primary) 40%, transparent)",
              }}
              type="button"
              onClick={onClose}
            >
              <X size={10} />
            </button>
          </div>

          {/* Título */}
          <div className="space-y-1">
            <label className="text-micro font-black uppercase tracking-[0.18em] text-primary/35">
              Título
            </label>
            <input
              autoFocus
              className="w-full rounded-lg border px-2.5 py-1.5 text-micro font-bold outline-none transition-all"
              placeholder="Título del evento…"
              style={{
                background: "transparent",
                borderColor:
                  "color-mix(in srgb, var(--primary) 14%, transparent)",
                color: "var(--primary)",
              }}
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          {/* Selector de reino — oculto cuando hay un reinoFijoId */}
          {reinoFijoId == null && (
            <div className="space-y-1">
              <label className="text-micro font-black uppercase tracking-[0.18em] text-primary/35">
                Reino
              </label>
              <div className="flex flex-wrap gap-1">
                <button
                  className="px-2.5 py-1 rounded-lg border text-micro font-black uppercase tracking-widest transition-all"
                  style={
                    reinoId === null
                      ? {
                          background:
                            "color-mix(in srgb, var(--accent) 15%, transparent)",
                          borderColor:
                            "color-mix(in srgb, var(--accent) 35%, transparent)",
                          color: "var(--accent)",
                        }
                      : {
                          borderColor:
                            "color-mix(in srgb, var(--primary) 10%, transparent)",
                          color:
                            "color-mix(in srgb, var(--primary) 45%, transparent)",
                        }
                  }
                  type="button"
                  onClick={() => setReinoId(null)}
                >
                  Mundo (sin reino)
                </button>
                {reinos.map((r) => (
                  <button
                    key={r.id}
                    className="px-2.5 py-1 rounded-lg border text-micro font-black uppercase tracking-widest transition-all"
                    style={
                      reinoId === r.id
                        ? {
                            background:
                              "color-mix(in srgb, var(--accent) 15%, transparent)",
                            borderColor:
                              "color-mix(in srgb, var(--accent) 35%, transparent)",
                            color: "var(--accent)",
                          }
                        : {
                            borderColor:
                              "color-mix(in srgb, var(--primary) 10%, transparent)",
                            color:
                              "color-mix(in srgb, var(--primary) 45%, transparent)",
                          }
                    }
                    type="button"
                    onClick={() => setReinoId(r.id)}
                  >
                    {r.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selector de fecha */}
          <div className="space-y-1">
            <label className="text-micro font-black uppercase tracking-[0.18em] text-primary/35">
              Fecha
            </label>
            <SelectorFechaMundo
              placeholder="Elegir fecha…"
              value={diaAbsoluto}
              onChange={setDiaAbsoluto}
            />
          </div>

          {/* Acciones */}
          <div className="flex gap-1.5 pt-1">
            <button
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-micro font-black uppercase tracking-widest transition-all"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 12%, transparent)",
                color: "color-mix(in srgb, var(--primary) 35%, transparent)",
              }}
              type="button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-micro font-black uppercase tracking-widest transition-all"
              disabled={!puedeCrear || creando}
              style={{
                background: puedeCrear
                  ? "var(--accent)"
                  : "color-mix(in srgb, var(--primary) 12%, transparent)",
                color: puedeCrear
                  ? "white"
                  : "color-mix(in srgb, var(--primary) 35%, transparent)",
                cursor: puedeCrear ? "pointer" : "default",
              }}
              type="button"
              onClick={() => {
                if (puedeCrear)
                  onCrear({
                    titulo: titulo.trim(),
                    reinoId,
                    dia_absoluto: diaAbsoluto!,
                  });
              }}
            >
              {creando ? (
                <Loader2 className="animate-spin" size={9} />
              ) : (
                <Check size={9} />
              )}{" "}
              Crear
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Tarjeta horizontal de evento (mundo O reino) — solo visualización ────────
// ─── Tipo para capítulos con posición en línea de tiempo ─────────────────────
type CapTimeline = {
  id: string;
  libro_id: string;
  titulo_capitulo: string;
  orden_linea_tiempo?: number; // legacy — opcional, se mantiene por compatibilidad
  dia_absoluto?: number; // nuevo campo del calendario
  libroTitulo?: string;
  reinos_ids?: string[];
  personajes_ids?: string[];
};

// ── Carga reinos con historia completa (query dedicada, no el hook genérico) ──
let _reinosLastFetch = 0;
const REINOS_TTL_MS = 60_000; // 1 minuto

function useReinosConHistoria() {
  const [reinos, setReinos] = useState<Reino[]>([]);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  const cargar = useCallback(async (force = false) => {
    if (!isMounted.current) return;
    if (!force) setLoading(true);

    // 1. Dexie primero — respuesta inmediata aunque estemos offline
    try {
      const local: any[] = db
        ? ((await (db as any).reinos?.toArray()) ?? [])
        : [];
      const filtered = local.filter((r: any) => !r.deleted);
      if (filtered.length && isMounted.current) {
        setReinos(filtered as Reino[]);
        setLoading(false);
      }
    } catch {}

    // 2. Supabase — solo si hay conexión real
    if (!navigator.onLine || !isMounted.current) {
      setLoading(false);
      return;
    }

    // Si no es un force-reload y el fetch fue reciente, nos quedamos con Dexie
    if (!force && Date.now() - _reinosLastFetch < REINOS_TTL_MS) {
      return;
    }

    try {
      const { data } = await supabase
        .from("reinos")
        .select("*") // necesitamos historia completa
        .order("nombre");
      if (!isMounted.current) return;
      if (data?.length) {
        setReinos(data as Reino[]);
        _reinosLastFetch = Date.now();
        // Persistir en Dexie con historia incluida
        try {
          if (db) await (db as any).reinos?.bulkPut(data);
        } catch {}
      }
    } catch {}

    if (isMounted.current) setLoading(false);
  }, []);

  useEffect(() => {
    isMounted.current = true;
    void cargar();

    // Recargar al recuperar conexión
    const handleOnline = () => {
      void cargar(true);
    };
    window.addEventListener("online", handleOnline);

    // Recargar cuando el sync offline termina de subir cambios
    const unsubSync = onSyncDone(() => {
      if (isMounted.current) void cargar(true);
    });

    return () => {
      isMounted.current = false;
      window.removeEventListener("online", handleOnline);
      unsubSync();
    };
  }, [cargar]);

  return { reinos, setReinos, loading, recargar: () => cargar(true) };
}

// ─── Eras: helpers y modal CRUD ──────────────────────────────────────────────
const COLORES_ERA_PRESET = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#f97316",
  "#ef4444",
  "#84cc16",
  "#64748b",
];
// invalidarCacheEras ahora se importa desde @/domains/garlia/calendario/useCalendario — necesita
// tocar las variables privadas del módulo (_cache, _lastFetch, LS_KEY) que
// respaldan el cache en memoria, y esas viven ahí desde el refactor que
// movió useCalendario a hooks/. Se usa en ModalEra/ModalGestionEras más
// abajo para forzar un refetch real tras crear/editar/borrar una era.

type EraFormData = {
  nombre: string;
  descripcion: string;
  anio_inicio: string;
  anio_fin: string;
  color: string;
};
const ERA_FORM_VACIO: EraFormData = {
  nombre: "",
  descripcion: "",
  anio_inicio: "0",
  anio_fin: "",
  color: COLORES_ERA_PRESET[0],
};

function ModalEra({
  era,
  onClose,
  onSaved,
  onDeleted,
}: {
  era: any | null;
  onClose: () => void;
  onSaved: (era: any) => void;
  onDeleted?: (id: string) => void;
}) {
  const [form, setForm] = useState<EraFormData>(
    era
      ? {
          nombre: era.nombre ?? "",
          descripcion: era.descripcion ?? "",
          anio_inicio: String(era.anio_inicio ?? 0),
          anio_fin: era.anio_fin != null ? String(era.anio_fin) : "",
          color: era.color ?? COLORES_ERA_PRESET[0],
        }
      : ERA_FORM_VACIO,
  );
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upd = (p: Partial<EraFormData>) => setForm((f) => ({ ...f, ...p }));

  const guardar = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    setError(null);
    const payload: any = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      anio_inicio: parseInt(form.anio_inicio, 10) || 0,
      anio_fin:
        form.anio_fin.trim() !== "" ? parseInt(form.anio_fin, 10) : null,
      color: form.color,
    };
    try {
      if (era?.id) {
        const { data, error: err } = await (supabase as any)
          .from("eras_mundo")
          .update(payload)
          .eq("id", era.id)
          .select()
          .single();
        if (err) throw err;
        invalidarCacheEras();
        onSaved(data);
      } else {
        const { data, error: err } = await (supabase as any)
          .from("eras_mundo")
          .insert(payload)
          .select()
          .single();
        if (err) throw err;
        invalidarCacheEras();
        onSaved(data);
      }
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar");
      setSaving(false);
    }
  };

  const borrar = async () => {
    if (!era?.id) return;
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await (supabase as any)
        .from("eras_mundo")
        .delete()
        .eq("id", era.id);
      if (err) throw err;
      invalidarCacheEras();
      onDeleted?.(era.id);
    } catch (e: any) {
      setError(e?.message ?? "Error al borrar");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center p-4"
      style={{ background: "color-mix(in srgb, black 55%, transparent)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl p-4 space-y-3"
        style={{
          background: "var(--bg-main)",
          borderColor: "color-mix(in srgb, var(--primary) 14%, transparent)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <span
              className="text-micro font-black uppercase tracking-[0.2em]"
              style={{ color: "var(--primary)" }}
            >
              {era ? "Editar era" : "Nueva era"}
            </span>
            {era && (
              <div className="flex items-center gap-1 mt-0.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: era.color ?? "var(--accent)" }}
                />
                <span
                  className="text-micro font-bold"
                  style={{ color: era.color ?? "var(--accent)" }}
                >
                  {era.nombre}
                </span>
              </div>
            )}
          </div>
          <button
            className="flex items-center justify-center w-6 h-6 rounded-lg border"
            style={{
              borderColor:
                "color-mix(in srgb, var(--primary) 12%, transparent)",
              color: "color-mix(in srgb, var(--primary) 40%, transparent)",
            }}
            type="button"
            onClick={onClose}
          >
            <X size={10} />
          </button>
        </div>

        {error && (
          <div
            className="px-3 py-2 rounded-lg text-micro font-bold"
            style={{
              background: "#ef444415",
              color: "#ef4444",
              border: "1px solid #ef444428",
            }}
          >
            {error}
          </div>
        )}

        {/* Nombre */}
        <div className="space-y-1">
          <label className="text-micro font-black uppercase tracking-[0.18em] text-primary/35">
            Nombre
          </label>
          <input
            autoFocus
            className="w-full rounded-lg border px-2.5 py-1.5 text-micro font-bold outline-none"
            placeholder="ej. Prehistoria, Edad de Hierro…"
            style={{
              background: "transparent",
              borderColor:
                "color-mix(in srgb, var(--primary) 14%, transparent)",
              color: "var(--primary)",
            }}
            type="text"
            value={form.nombre}
            onChange={(e) => upd({ nombre: e.target.value })}
          />
        </div>

        {/* Descripción */}
        <div className="space-y-1">
          <label className="text-micro font-black uppercase tracking-[0.18em] text-primary/35">
            Descripción (opcional)
          </label>
          <textarea
            className="w-full rounded-lg border px-2.5 py-1.5 text-micro outline-none resize-none"
            placeholder="Breve descripción…"
            rows={2}
            style={{
              background: "transparent",
              borderColor:
                "color-mix(in srgb, var(--primary) 14%, transparent)",
              color: "var(--primary)",
            }}
            value={form.descripcion}
            onChange={(e) => upd({ descripcion: e.target.value })}
          />
        </div>

        {/* Años */}
        <div className="grid grid-cols-2 gap-2">
          {(["anio_inicio", "anio_fin"] as const).map((k, i) => (
            <div key={k} className="space-y-1">
              <label className="text-micro font-black uppercase tracking-[0.18em] text-primary/35">
                {i === 0 ? "Año inicio" : "Año fin (vacío = sin fin)"}
              </label>
              <input
                className="w-full rounded-lg border px-2.5 py-1.5 text-micro font-bold outline-none text-center"
                placeholder={i === 0 ? "0" : "—"}
                style={{
                  background: "transparent",
                  borderColor:
                    "color-mix(in srgb, var(--primary) 14%, transparent)",
                  color: "var(--primary)",
                }}
                type="number"
                value={form[k]}
                onChange={(e) => upd({ [k]: e.target.value })}
              />
            </div>
          ))}
        </div>

        {/* Color */}
        <div className="space-y-1.5">
          <label className="text-micro font-black uppercase tracking-[0.18em] text-primary/35">
            Color
          </label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {COLORES_ERA_PRESET.map((c) => (
              <button
                key={c}
                className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                style={{
                  background: c,
                  outline: form.color === c ? `2px solid ${c}` : "none",
                  outlineOffset: 2,
                }}
                type="button"
                onClick={() => upd({ color: c })}
              />
            ))}
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                className="w-5 h-5 cursor-pointer border-0 p-0 rounded"
                style={{ background: "transparent" }}
                type="color"
                value={form.color}
                onChange={(e) => upd({ color: e.target.value })}
              />
              <span className="text-micro text-primary/40 font-bold">Otro</span>
            </label>
          </div>
          {/* Preview badge */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg w-fit"
            style={{ background: `${form.color}18` }}
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: form.color }}
            />
            <span
              className="text-micro font-black uppercase tracking-widest"
              style={{ color: form.color }}
            >
              {form.nombre || "Nombre de la era"}
            </span>
            {form.anio_fin && (
              <span className="text-micro text-primary/30 ml-1">
                {form.anio_inicio} – {form.anio_fin}
              </span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-1.5 pt-1">
          {era && !confirmDel && (
            <button
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-micro font-black uppercase tracking-widest"
              disabled={saving}
              style={{ borderColor: "#ef444425", color: "#ef4444aa" }}
              type="button"
              onClick={() => setConfirmDel(true)}
            >
              <Trash2 size={9} /> Borrar
            </button>
          )}
          {confirmDel && (
            <>
              <button
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-micro font-black uppercase tracking-widest"
                disabled={saving}
                style={{ background: "#ef444420", color: "#ef4444" }}
                type="button"
                onClick={borrar}
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={9} />
                ) : (
                  <Check size={9} />
                )}{" "}
                Confirmar
              </button>
              <button
                className="px-2.5 py-1.5 rounded-lg border text-micro font-black uppercase tracking-widest"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--primary) 12%, transparent)",
                  color: "color-mix(in srgb, var(--primary) 40%, transparent)",
                }}
                type="button"
                onClick={() => setConfirmDel(false)}
              >
                Cancelar
              </button>
            </>
          )}
          {!confirmDel && (
            <>
              <button
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-micro font-black uppercase tracking-widest"
                disabled={saving}
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--primary) 12%, transparent)",
                  color: "color-mix(in srgb, var(--primary) 40%, transparent)",
                }}
                type="button"
                onClick={onClose}
              >
                <X size={9} /> Cancelar
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-micro font-black uppercase tracking-widest disabled:opacity-40"
                disabled={saving || !form.nombre.trim()}
                style={{ background: "var(--accent)", color: "white" }}
                type="button"
                onClick={guardar}
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={9} />
                ) : (
                  <Check size={9} />
                )}
                {era ? "Guardar cambios" : "Crear era"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal: gestión completa de todas las eras ────────────────────────────────
function ModalGestionEras({
  eras,
  onClose,
  onEditEra,
  onNewEra,
}: {
  eras: any[];
  onClose: () => void;
  onEditEra: (era: any) => void;
  onNewEra: () => void;
}) {
  const erasOrdenadas = [...eras].sort(
    (a, b) => (a.anio_inicio ?? 0) - (b.anio_inicio ?? 0),
  );

  return (
    <div
      className="fixed inset-0 z-[1150] flex items-center justify-center p-4"
      style={{ background: "color-mix(in srgb, black 55%, transparent)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl flex flex-col"
        style={{
          background: "var(--bg-main)",
          borderColor: "color-mix(in srgb, var(--primary) 14%, transparent)",
          maxHeight: "80vh",
        }}
      >
        {/* Header */}
        <div
          className="shrink-0 flex items-center justify-between px-4 py-3 border-b"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
          }}
        >
          <div>
            <span
              className="text-micro font-black uppercase tracking-[0.2em]"
              style={{ color: "var(--primary)" }}
            >
              Todas las eras
            </span>
            <div className="text-micro text-primary/35 mt-0.5">
              {erasOrdenadas.length} era{erasOrdenadas.length !== 1 ? "s" : ""}{" "}
              definida{erasOrdenadas.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-micro font-black uppercase tracking-widest transition-all"
              style={{ background: "var(--accent)", color: "white" }}
              type="button"
              onClick={onNewEra}
            >
              <Plus size={9} /> Nueva era
            </button>
            <button
              className="flex items-center justify-center w-6 h-6 rounded-lg border transition-all"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 12%, transparent)",
                color: "color-mix(in srgb, var(--primary) 40%, transparent)",
              }}
              type="button"
              onClick={onClose}
            >
              <X size={10} />
            </button>
          </div>
        </div>

        {/* Lista de eras */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {erasOrdenadas.length === 0 ? (
            <div className="text-center py-8">
              <Clock
                className="mx-auto mb-2 opacity-20"
                size={20}
                style={{ color: "var(--primary)" }}
              />
              <p className="text-micro text-primary/30 font-bold uppercase tracking-widest">
                No hay eras definidas
              </p>
              <button
                className="mt-3 px-3 py-1.5 rounded-xl text-micro font-black uppercase tracking-widest transition-all"
                style={{ background: "var(--accent)", color: "white" }}
                type="button"
                onClick={onNewEra}
              >
                Crear la primera era
              </button>
            </div>
          ) : (
            erasOrdenadas.map((era) => (
              <button
                key={era.id}
                className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-all group"
                style={{
                  background: era.color
                    ? `${era.color}08`
                    : "color-mix(in srgb, var(--primary) 2%, transparent)",
                  borderColor: era.color
                    ? `${era.color}25`
                    : "color-mix(in srgb, var(--primary) 10%, transparent)",
                }}
                type="button"
                onClick={() => onEditEra(era)}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.background = era.color
                    ? `${era.color}15`
                    : "color-mix(in srgb, var(--primary) 5%, transparent)";
                  el.style.borderColor = era.color
                    ? `${era.color}40`
                    : "color-mix(in srgb, var(--primary) 20%, transparent)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.background = era.color
                    ? `${era.color}08`
                    : "color-mix(in srgb, var(--primary) 2%, transparent)";
                  el.style.borderColor = era.color
                    ? `${era.color}25`
                    : "color-mix(in srgb, var(--primary) 10%, transparent)";
                }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
                  style={{ background: era.color ?? "var(--accent)" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-micro font-black truncate"
                      style={{ color: era.color ?? "var(--primary)" }}
                    >
                      {era.nombre}
                    </span>
                    <span
                      className="text-micro font-bold shrink-0"
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 35%, transparent)",
                      }}
                    >
                      {era.anio_inicio != null &&
                        (era.anio_fin != null
                          ? `Año ${era.anio_inicio} – ${era.anio_fin}`
                          : `Desde año ${era.anio_inicio}`)}
                    </span>
                  </div>
                  {era.descripcion && (
                    <p
                      className="text-micro leading-relaxed mt-0.5 line-clamp-2"
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 50%, transparent)",
                      }}
                    >
                      {era.descripcion}
                    </p>
                  )}
                </div>
                <span
                  className="text-micro font-black uppercase tracking-widest shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    color:
                      era.color ??
                      "color-mix(in srgb, var(--primary) 35%, transparent)",
                  }}
                >
                  Editar
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Botón toggle de "mostrar/ocultar tipo" (capítulos, canciones, eventos,
// cumpleaños) en la cabecera de la línea de tiempo ────────────────────────────
function ToggleTipoBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="relative flex items-center justify-center transition-all"
      style={{
        width: 22,
        height: 22,
        borderRadius: "var(--radius-btn)",
        border: `1px solid ${
          active
            ? "color-mix(in srgb, var(--accent) 30%, transparent)"
            : "color-mix(in srgb, var(--primary) 10%, transparent)"
        }`,
        background: active
          ? "color-mix(in srgb, var(--accent) 10%, transparent)"
          : "transparent",
        color: active
          ? "var(--accent)"
          : "color-mix(in srgb, var(--primary) 28%, transparent)",
      }}
      title={
        active
          ? `Ocultar ${label.toLowerCase()}`
          : `Mostrar ${label.toLowerCase()}`
      }
      type="button"
      onClick={onClick}
    >
      {icon}
      <span
        style={{
          position: "absolute",
          bottom: 2,
          right: 2,
          width: 3,
          height: 3,
          borderRadius: "50%",
          background: active
            ? "var(--accent)"
            : "color-mix(in srgb, var(--primary) 18%, transparent)",
          transition: "background 0.15s",
        }}
      />
    </button>
  );
}

// ── Panel de detalle de evento (click en la lista) ───────────────────────────
// Editable para eventos "mundo"/"reino" (tabla eventos_mundo): título,
// descripción y fecha. Capítulos/canciones/cumpleaños se muestran solo
// lectura porque no tienen un campo de descripción propio aquí y editar su
// título cambiaría la entidad real (capítulo, canción o personaje).
function EventoDetallePanel({
  evt,
  era,
  eraColor,
  diasAnioLista,
  onFieldChange,
  onDiaChange,
  onClose,
}: {
  evt: MundoTimelineEvent;
  era: EraMundo | null;
  eraColor: string | null;
  diasAnioLista: number;
  onFieldChange?: (
    id: string,
    field: "titulo" | "descripcion",
    value: string,
  ) => void;
  onDiaChange?: (id: string, dia: number) => void;
  onClose?: () => void;
}) {
  const editable = evt.source === "mundo" || evt.source === "reino";

  const [titulo, setTitulo] = useState(evt.title);
  const [descripcion, setDescripcion] = useState(evt.description);
  const [savingFecha, setSavingFecha] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resincronizar campos locales al cambiar de evento seleccionado
  useEffect(() => {
    setTitulo(evt.title);
    setDescripcion(evt.description);
  }, [evt.id, evt.title, evt.description]);

  const scheduleSave = (field: "titulo" | "descripcion", value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFieldChange?.(evt.id, field, value);
    }, 600);
  };

  const commitDia = async (dia: number | null) => {
    if (dia == null) return;
    setSavingFecha(true);
    await onDiaChange?.(evt.id, dia);
    setSavingFecha(false);
  };

  const Icon = iconoPorSource(evt.source);

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        background: eraColor
          ? `${eraColor}08`
          : "color-mix(in srgb, var(--primary) 3%, transparent)",
        border: `1px solid ${eraColor ? `${eraColor}22` : "color-mix(in srgb, var(--primary) 10%, transparent)"}`,
      }}
    >
      {/* Era + tipo — misma fila, aprovecha el ancho ganado del panel */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {era && (
          <span
            className="text-micro font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full"
            style={{
              background: eraColor
                ? `${eraColor}18`
                : "color-mix(in srgb, var(--primary) 7%, transparent)",
              color:
                eraColor ?? "color-mix(in srgb, var(--primary) 45%, transparent)",
              border: `1px solid ${eraColor ? `${eraColor}30` : "color-mix(in srgb, var(--primary) 12%, transparent)"}`,
            }}
          >
            {era.nombre}
          </span>
        )}
        <span
          className="flex items-center gap-1 text-micro font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
          style={{
            background: "color-mix(in srgb, var(--primary) 5%, transparent)",
            color: "color-mix(in srgb, var(--primary) 30%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
          }}
        >
          <Icon size={7} />
          {evt.source}
        </span>
        {onClose && (
          <button
            className="ml-auto shrink-0 flex items-center justify-center rounded-full transition-all hover:opacity-100"
            style={{
              width: 18,
              height: 18,
              color: "color-mix(in srgb, var(--primary) 45%, transparent)",
              opacity: 0.7,
            }}
            title="Cerrar"
            type="button"
            onClick={onClose}
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Título */}
      {editable ? (
        <input
          className="text-sm font-black uppercase leading-tight bg-transparent outline-none w-full rounded px-0.5 -mx-0.5"
          placeholder="Sin título"
          style={{ color: "var(--primary)" }}
          value={titulo}
          onBlur={(e) => onFieldChange?.(evt.id, "titulo", e.target.value)}
          onChange={(e) => {
            setTitulo(e.target.value);
            scheduleSave("titulo", e.target.value);
          }}
        />
      ) : (
        <p
          className="text-sm font-black uppercase leading-tight"
          style={{ color: "var(--primary)" }}
        >
          {evt.title || <span className="italic opacity-40">Sin título</span>}
        </p>
      )}

      {/* Fecha + reino — misma fila cuando hay espacio */}
      <div className="flex items-center gap-2">
        {editable ? (
          <div className="relative flex-1 min-w-0">
            {savingFecha && (
              <Loader2
                className="animate-spin absolute right-2 top-1.5 z-10 text-primary/30"
                size={9}
              />
            )}
            <SelectorFechaMundo
              placeholder="Sin fecha…"
              value={evt.dia_absoluto ?? null}
              onChange={commitDia}
            />
          </div>
        ) : (
          evt.dia_absoluto != null && (
            <p
              className="text-micro font-black uppercase tracking-widest"
              style={{
                color:
                  eraColor ??
                  "color-mix(in srgb, var(--primary) 35%, transparent)",
              }}
            >
              Año {Math.floor(evt.dia_absoluto / diasAnioLista)}
            </p>
          )
        )}
        {evt.reinoNombre && (
          <span
            className="shrink-0 flex items-center gap-1 text-micro font-black uppercase tracking-widest"
            style={{
              color: "color-mix(in srgb, var(--primary) 40%, transparent)",
            }}
          >
            <Crown size={8} /> {evt.reinoNombre}
          </span>
        )}
      </div>

      {/* Separador */}
      <div
        style={{
          height: 1,
          background: eraColor
            ? `${eraColor}20`
            : "color-mix(in srgb, var(--primary) 8%, transparent)",
        }}
      />

      {/* Descripción — a todo el ancho del panel, editor Lexical completo */}
      {editable ? (
        <div className="flex-1 min-h-0">
          <RichEditor
            minHeight={160}
            placeholder="Sin descripción…"
            value={descripcion}
            onChange={(v) => {
              setDescripcion(v);
              scheduleSave("descripcion", v);
            }}
          />
        </div>
      ) : evt.source === "era_personaje" && evt.eraPersonajeData ? (
        <div className="flex flex-col gap-2">
          {evt.eraPersonajeData.rasgos.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {evt.eraPersonajeData.rasgos.map((r) => (
                <span
                  key={r}
                  className="px-1.5 py-0.5 rounded-full text-micro font-bold"
                  style={{
                    background:
                      "color-mix(in srgb, var(--primary) 6%, transparent)",
                    color:
                      "color-mix(in srgb, var(--primary) 55%, transparent)",
                  }}
                >
                  {r}
                </span>
              ))}
            </div>
          )}
          {evt.eraPersonajeData.notas ? (
            <p
              className="text-micro leading-relaxed"
              style={{
                color: "color-mix(in srgb, var(--primary) 65%, transparent)",
              }}
            >
              {evt.eraPersonajeData.notas}
            </p>
          ) : (
            <p
              className="text-micro italic"
              style={{
                color: "color-mix(in srgb, var(--primary) 20%, transparent)",
              }}
            >
              Sin notas.
            </p>
          )}
          <p
            className="text-micro italic"
            style={{
              color: "color-mix(in srgb, var(--primary) 25%, transparent)",
            }}
          >
            Editable desde la ficha de {evt.eraPersonajeData.personajeNombre}.
          </p>
        </div>
      ) : evt.description ? (
        <p
          className="text-micro leading-relaxed"
          style={{
            color: "color-mix(in srgb, var(--primary) 65%, transparent)",
          }}
        >
          {evt.description}
        </p>
      ) : (
        <p
          className="text-micro italic"
          style={{
            color: "color-mix(in srgb, var(--primary) 20%, transparent)",
          }}
        >
          Sin descripción.
        </p>
      )}
    </div>
  );
}

// Ícono representativo por tipo de evento — usado en las tarjetas del grid
// y en los puntos de la línea de tiempo horizontal.
function iconoPorSource(source: MundoTimelineEvent["source"]) {
  switch (source) {
    case "capitulo":
      return BookOpen;
    case "cancion":
      return Music;
    case "cumpleanos":
      return CalendarDays;
    case "era_personaje":
      return User;
    default:
      return Clock;
  }
}

// ── Lista vertical de eventos + minimap sincronizado por posición real ──────
// El bug: el minimap ubicaba cada punto por índice (i / total), asumiendo que
// todos los items tienen la misma altura. Pero los separadores de año
// (que no tienen una altura fija/predecible) rompen esa suposición — por eso
// el primer evento, que casi siempre lleva un separador justo encima, queda
// visualmente más abajo que su punto (que sí está fijo arriba, en 0%).
// Fix: medimos la posición real (en píxeles) de cada evento dentro de la
// lista con refs + getBoundingClientRect, y usamos esa fracción real para
// ubicar los puntos — así siempre coinciden con su evento, sin importar
// separadores, distinto alto de fila, o el ancho cambiante de la lista.
function ListaEventosConMinimapa({
  allEvents,
  cal,
  evtSeleccionado,
  setEvtSeleccionado,
  onFieldChange,
  onDiaChange,
  onSelectPersonaje,
  onSelectCapitulo,
  onSelectCancion,
}: {
  allEvents: MundoTimelineEvent[];
  cal: CalCache | null;
  evtSeleccionado: string | null;
  setEvtSeleccionado: (id: string | null) => void;
  onFieldChange?: (
    id: string,
    field: "titulo" | "descripcion",
    value: string,
  ) => void;
  onDiaChange?: (id: string, dia: number) => void;
  onSelectPersonaje?: (id: string) => void;
  onSelectCapitulo?: (capituloId: string, libroId: string) => void;
  onSelectCancion?: (cancionId: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const diasAnioLista =
    cal?.estaciones?.reduce(
      (s: number, e: any) => s + (e.duracion_dias ?? 0),
      0,
    ) || 365;

  const getEraEvt = (diaAbs: number | null | undefined) =>
    diaAbs != null
      ? ((cal?.eras ?? []).find(
          (era: any) =>
            era.anio_inicio <= Math.floor(diaAbs / diasAnioLista) &&
            (era.anio_fin == null ||
              era.anio_fin >= Math.floor(diaAbs / diasAnioLista)),
        ) ?? null)
      : null;

  const selEvt = allEvents.find((e) => e.id === evtSeleccionado) ?? null;
  const selEra = selEvt ? getEraEvt(selEvt.dia_absoluto) : null;
  const selEraColor = selEra?.color ?? null;

  // ── Minimapa horizontal ─────────────────────────────────────────────────
  // Franja compacta arriba de la lista: un punto por evento, coloreado por
  // era. Da un vistazo de "dónde estoy" en la línea de tiempo completa y usa
  // el ancho horizontal que antes quedaba vacío. Clic en un punto selecciona
  // (y hace scroll a) ese evento en la lista de abajo.
  //
  // IMPORTANTE: la distribución es por ÍNDICE (uniforme), no proporcional al
  // dia_absoluto real. Con proporción real, un cluster de eventos ocurridos
  // en un rango corto de tiempo (ej. 5 eventos en el mismo año, en una línea
  // de tiempo que abarca siglos) quedaba con sus puntos superpuestos —
  // imposible de clickear individualmente — mientras los huecos sin eventos
  // (siglos sin nada) desperdiciaban todo ese ancho. Al distribuir por índice
  // cada evento recibe el mismo espacio sin importar cuán cerca esté en el
  // tiempo de sus vecinos, así los clusters se separan y usan el espacio que
  // antes quedaba vacío en los huecos.
  const eventosConFecha = useMemo(
    () => allEvents.filter((e) => e.dia_absoluto != null),
    [allEvents],
  );

  return (
    <div className="flex flex-col gap-2" style={{ minHeight: 120 }}>
      {/* ── Minimapa horizontal: toda la línea de tiempo en una franja ── */}
      {eventosConFecha.length > 1 && (
        <div
          className="relative shrink-0 rounded-lg"
          style={{
            height: 28,
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
          }}
        >
          {/* Línea base */}
          <div
            className="absolute left-2 right-2 top-1/2 -translate-y-1/2"
            style={{
              height: 1,
              background:
                "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          />
          {eventosConFecha.map((evt, idx) => {
            // Distribución uniforme: idx/(n-1) en vez de (dia-min)/rango.
            const pct =
              eventosConFecha.length > 1
                ? (idx / (eventosConFecha.length - 1)) * 100
                : 50;
            const eraEvt = getEraEvt(evt.dia_absoluto);
            const eraColor = eraEvt?.color ?? null;
            const isSel = evt.id === evtSeleccionado;
            const Icon = iconoPorSource(evt.source);
            return (
              <button
                key={`mini-${evt.id}`}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full flex items-center justify-center transition-all hover:scale-125"
                style={{
                  left: `${pct}%`,
                  marginLeft: 8 - (16 * pct) / 100,
                  width: isSel ? 12 : 7,
                  height: isSel ? 12 : 7,
                  background: eraColor ?? "color-mix(in srgb, var(--primary) 35%, transparent)",
                  boxShadow: isSel
                    ? `0 0 0 3px ${eraColor ? `${eraColor}30` : "color-mix(in srgb, var(--primary) 18%, transparent)"}`
                    : "none",
                  zIndex: isSel ? 2 : 1,
                }}
                title={evt.title || "Sin título"}
                type="button"
                onClick={() => {
                  setEvtSeleccionado(evt.id);
                  itemRefs.current
                    .get(evt.id)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              >
                {isSel && <Icon color="var(--bg-main)" size={7} />}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Lista (grid) ── */}
      <div className="flex gap-2 items-start flex-1 min-h-0">
        {/* ── Lista agrupada por ERA (cada era = su propia fila, obligatoria)
             y dentro de cada era, carriles por año dispuestos en flex-wrap:
             se ponen lado a lado hasta llegar al borde del contenedor y ahí
             continúan en la siguiente línea, sin scroll horizontal infinito. ── */}
        <div
          ref={listRef}
          className="min-w-0"
          style={{
            flex: "1",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {allEvents.length === 0 && (
            <p className="text-micro text-primary/20 italic px-2 py-2">
              Sin eventos con fecha asignada.
            </p>
          )}
          {(() => {
            // Paso 1 — Agrupar eventos consecutivos por año → carriles.
            type Carril = {
              anio: number | null;
              eraId: string | null;
              eventos: MundoTimelineEvent[];
            };
            const carriles: Carril[] = [];
            for (const evt of allEvents) {
              const anio =
                evt.dia_absoluto != null
                  ? Math.floor(evt.dia_absoluto / diasAnioLista)
                  : null;
              const eraEvt = getEraEvt(evt.dia_absoluto);
              const eraId = eraEvt?.id ?? null;
              const last = carriles[carriles.length - 1];
              if (last && last.anio === anio && last.eraId === eraId) {
                last.eventos.push(evt);
              } else {
                carriles.push({ anio, eraId, eventos: [evt] });
              }
            }

            // Paso 2 — Agrupar esos carriles consecutivos por ERA — cada era
            //    obligatoriamente en su propia fila, nunca comparte fila con
            //    la era anterior o siguiente.
            type GrupoEra = {
              eraId: string | null;
              eraNombre: string | null;
              eraColor: string | null;
              carriles: Carril[];
            };
            const grupos: GrupoEra[] = [];
            for (const carril of carriles) {
              const eraEvt = getEraEvt(carril.eventos[0]?.dia_absoluto);
              const last = grupos[grupos.length - 1];
              if (last && last.eraId === carril.eraId) {
                last.carriles.push(carril);
              } else {
                grupos.push({
                  eraId: carril.eraId,
                  eraNombre: eraEvt?.nombre ?? null,
                  eraColor: eraEvt?.color ?? null,
                  carriles: [carril],
                });
              }
            }

            return grupos.map((grupo, gi) => (
              <div
                key={`era-grupo-${grupo.eraId ?? "sin-era"}-${gi}`}
                className="mb-3"
              >
                {/* Badge de era — encabezado obligatorio de su propia fila */}
                {grupo.eraNombre && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span
                      className="text-micro font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1"
                      style={{
                        background: grupo.eraColor
                          ? `${grupo.eraColor}18`
                          : "color-mix(in srgb, var(--primary) 7%, transparent)",
                        color:
                          grupo.eraColor ??
                          "color-mix(in srgb, var(--primary) 45%, transparent)",
                        border: `1px solid ${grupo.eraColor ? `${grupo.eraColor}35` : "color-mix(in srgb, var(--primary) 12%, transparent)"}`,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: grupo.eraColor ?? "currentColor",
                          flexShrink: 0,
                        }}
                      />
                      {grupo.eraNombre}
                    </span>
                    <div
                      className="flex-1 h-px"
                      style={{
                        background: grupo.eraColor
                          ? `${grupo.eraColor}20`
                          : "color-mix(in srgb, var(--primary) 8%, transparent)",
                      }}
                    />
                  </div>
                )}

                {/* Carriles de año de esta era — envuelven al llegar al borde */}
                <div className="flex flex-wrap items-start gap-3 min-w-0">
                  {grupo.carriles.map((carril, i) => {
                    // Ancho de cada tarjeta de evento — el carril entero se
                    // estira según cuántos eventos tenga (en vez de un ancho
                    // fijo con eventos apilados hacia abajo). El header del
                    // año, al ser w-full del carril, se expande junto con él.
                    // Antes esto se achicaba a 130 cuando había un evento
                    // seleccionado, para dejarle lugar al panel de detalle
                    // que empujaba el layout. Ahora el panel flota encima
                    // (no empuja nada), así que el ancho siempre es el mismo.
                    const anchoEvento = 170;
                    const anchoCarril =
                      anchoEvento * carril.eventos.length +
                      6 * (carril.eventos.length - 1); // gaps entre tarjetas

                    return (
                      <div
                        key={`carril-${carril.anio ?? "sin-fecha"}-${gi}-${i}`}
                        className="flex flex-col gap-1 min-w-0 max-w-full"
                        style={{ width: anchoCarril, maxWidth: "100%" }}
                      >
                        {/* Encabezado del año — se expande a todo el ancho del carril */}
                        <div className="flex items-center gap-1.5 w-full">
                          <span
                            className="text-micro font-black tabular-nums px-1.5 py-0.5 rounded shrink-0"
                            style={{
                              color:
                                grupo.eraColor ??
                                "color-mix(in srgb, var(--primary) 35%, transparent)",
                              background: grupo.eraColor
                                ? `${grupo.eraColor}10`
                                : "color-mix(in srgb, var(--primary) 4%, transparent)",
                            }}
                          >
                            {carril.anio ?? "S/F"}
                          </span>
                          <div
                            className="flex-1 h-px"
                            style={{
                              background: grupo.eraColor
                                ? `${grupo.eraColor}15`
                                : "color-mix(in srgb, var(--primary) 6%, transparent)",
                            }}
                          />
                        </div>

                        {/* Eventos del año — lado a lado (fila), envuelven si no caben */}
                        <div className="flex flex-row flex-wrap gap-1.5">
                          {carril.eventos.map((evt) => {
                            const eraEvt = getEraEvt(evt.dia_absoluto);
                            const eraColor = eraEvt?.color ?? null;
                            const isSel = evt.id === evtSeleccionado;
                            const Icon = iconoPorSource(evt.source);

                            return (
                              <button
                                key={`list-${evt.id}`}
                                ref={(el) => {
                                  if (el) itemRefs.current.set(evt.id, el);
                                  else itemRefs.current.delete(evt.id);
                                }}
                                className="flex flex-col gap-1 px-2 py-1.5 rounded-lg text-left transition-all min-w-0 shrink-0"
                                style={{
                                  width: anchoEvento,
                                  background: isSel
                                    ? eraColor
                                      ? `${eraColor}14`
                                      : "color-mix(in srgb, var(--primary) 6%, transparent)"
                                    : "color-mix(in srgb, var(--primary) 2%, transparent)",
                                  border: `1px solid ${
                                    isSel
                                      ? eraColor
                                        ? `${eraColor}30`
                                        : "color-mix(in srgb, var(--primary) 15%, transparent)"
                                      : "color-mix(in srgb, var(--primary) 8%, transparent)"
                                  }`,
                                }}
                                type="button"
                                onClick={() => {
                                  const willSelect = !isSel;
                                  setEvtSeleccionado(willSelect ? evt.id : null);
                                  if (!willSelect) return;
                                  if (evt.source === "capitulo" && evt.capData) {
                                    onSelectCapitulo?.(
                                      evt.capData.id,
                                      evt.capData.libro_id,
                                    );
                                  } else if (
                                    evt.source === "cancion" &&
                                    evt.cancionData
                                  ) {
                                    onSelectCancion?.(evt.cancionData.id);
                                  } else if (
                                    evt.source === "cumpleanos" &&
                                    evt.cumpleanosData
                                  ) {
                                    onSelectPersonaje?.(evt.cumpleanosData.id);
                                  }
                                }}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Icon
                                    className="shrink-0"
                                    size={10}
                                    style={{
                                      color:
                                        eraColor ??
                                        "color-mix(in srgb, var(--primary) 40%, transparent)",
                                    }}
                                  />
                                  <span
                                    className="text-micro font-bold truncate flex-1"
                                    style={{
                                      color: isSel
                                        ? "var(--primary)"
                                        : "color-mix(in srgb, var(--primary) 65%, transparent)",
                                    }}
                                  >
                                    {evt.title || (
                                      <span className="italic opacity-40">
                                        Sin título
                                      </span>
                                    )}
                                  </span>
                                </div>
                                {evt.reinoNombre && (
                                  <span
                                    className="text-micro font-black uppercase tracking-widest truncate pl-[18px]"
                                    style={{
                                      color:
                                        "color-mix(in srgb, var(--primary) 30%, transparent)",
                                    }}
                                  >
                                    {evt.reinoNombre}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* ── Panel de detalle flotante (editable para mundo/reino) ── ────────
          Antes este panel era un sibling en flex que empujaba la lista
          (achicaba las tarjetas y ganaba ancho a su costa). Ahora flota
          en un portal, anclado justo debajo/al lado de la tarjeta en la
          que se hizo click, sin mover ni una tarjeta del lugar — igual
          que el patrón que ya usa `EraDropdown` más abajo en este mismo
          archivo (fixed + reposición en scroll/resize + cerrar al click
          afuera o con Escape). */}
      {selEvt && (
        <EventoDetalleFlotante
          anchorEl={itemRefs.current.get(selEvt.id) ?? null}
          diasAnioLista={diasAnioLista}
          era={selEra}
          eraColor={selEraColor}
          evt={selEvt}
          onClose={() => setEvtSeleccionado(null)}
          onDiaChange={onDiaChange}
          onFieldChange={onFieldChange}
        />
      )}
    </div>
  );
}

// ── Wrapper que posiciona EventoDetallePanel como flotante (portal) ─────────
// Se ancla al elemento de la tarjeta clickeada (`anchorEl`) en vez de a un
// trigger fijo. Si la tarjeta seleccionada cambia de posición (porque el
// usuario scrollea la lista, o la ventana cambia de tamaño), recalcula.
// Si el evento seleccionado deja de existir en el DOM (ej. se borró, o la
// lista se re-renderizó y el ref todavía no está listo), simplemente no
// se muestra — no rompe nada, solo no hay panel hasta el próximo click.
function EventoDetalleFlotante({
  anchorEl,
  evt,
  era,
  eraColor,
  diasAnioLista,
  onFieldChange,
  onDiaChange,
  onClose,
}: {
  anchorEl: HTMLElement | null;
  evt: MundoTimelineEvent;
  era: EraMundo | null;
  eraColor: string | null;
  diasAnioLista: number;
  onFieldChange?: (
    id: string,
    field: "titulo" | "descripcion",
    value: string,
  ) => void;
  onDiaChange?: (id: string, dia: number) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Posición del panel — igual que EraDropdown: calcula contra el ancla,
  // decide si abrir hacia abajo o hacia arriba según el espacio disponible,
  // y recalcula si el usuario scrollea o cambia el tamaño de la ventana
  // (así el panel "sigue" a la tarjeta en vez de quedar flotando en el
  // aire cuando la lista se mueve debajo).
  useEffect(() => {
    if (!anchorEl) {
      setPos(null);
      return;
    }
    const update = () => {
      const r = anchorEl.getBoundingClientRect();
      // Panel más grande: da espacio real al editor Lexical en vez de un
      // recuadro chico. Se limita al viewport (con margen de 16px) para
      // que siga cabiendo en pantallas angostas.
      const w = Math.min(
        Math.max(r.width, 420),
        window.innerWidth - 16,
      );
      let left = r.left;
      if (left + w > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - w - 8);
      }
      const estimatedH = Math.min(560, window.innerHeight - 32);
      const spaceBelow = window.innerHeight - r.bottom;
      const top =
        spaceBelow < estimatedH && r.top > estimatedH
          ? Math.max(8, r.top - estimatedH - 6)
          : Math.min(r.bottom + 6, window.innerHeight - estimatedH - 8);
      setPos({ top, left, width: w });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [anchorEl, evt.id]);

  // Cerrar al click afuera o con Escape — el click adentro de la tarjeta
  // de origen NO cuenta como "afuera" porque ese click ya lo maneja el
  // propio botón de la tarjeta (des-selecciona o selecciona otro evento).
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorEl?.contains(target)) return;
      onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [anchorEl, onClose]);

  if (!pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[9999] rounded-xl shadow-lg"
      style={{
        top: pos.top,
        left: pos.left,
        width: pos.width,
        maxHeight: "85vh",
        overflowY: "auto",
        background: "var(--bg-main)",
      }}
    >
      <EventoDetallePanel
        diasAnioLista={diasAnioLista}
        era={era}
        eraColor={eraColor}
        evt={evt}
        onClose={onClose}
        onDiaChange={onDiaChange}
        onFieldChange={onFieldChange}
      />
    </div>,
    document.body,
  );
}

// ─── EraDropdown ─────────────────────────────────────────────────────────────
// Selector compacto de era con diseño consistente con el resto del panel.

function EraDropdown({
  eras,
  value,
  eraActiva,
  onChange,
}: {
  eras: any[];
  value: string | null;
  eraActiva: any | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Cerrar al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Posición del panel
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const w = Math.max(r.width, 160);
      let left = r.left;
      if (left + w > window.innerWidth - 8)
        left = Math.max(8, window.innerWidth - w - 8);
      const spaceBelow = window.innerHeight - r.bottom;
      const estimatedH = eras.length * 28 + 36;
      const top =
        spaceBelow < estimatedH && r.top > estimatedH
          ? r.top - estimatedH - 4
          : r.bottom + 4;
      setPos({ top, left, width: w });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, eras.length]);

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={triggerRef}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest transition-all"
        style={{
          background:
            open || value
              ? "color-mix(in srgb, var(--primary) 10%, transparent)"
              : "color-mix(in srgb, var(--primary) 4%, transparent)",
          border: `1px solid color-mix(in srgb, var(--primary) ${open || value ? "20" : "8"}%, transparent)`,
          color:
            open || value
              ? "var(--primary)"
              : "color-mix(in srgb, var(--primary) 40%, transparent)",
        }}
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        <Clock size={8} />
        <span>{eraActiva ? eraActiva.nombre : "Era"}</span>
        <ChevronDown
          size={7}
          style={{
            transform: open ? "rotate(180deg)" : undefined,
            transition: "transform 0.15s",
          }}
        />
      </button>

      {/* Panel — portal para no quedar cortado */}
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] rounded-xl border shadow-lg overflow-hidden py-1"
            style={{
              top: pos.top,
              left: pos.left,
              minWidth: pos.width,
              background: "var(--bg-main)",
              borderColor:
                "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            {/* Opción "Todas" */}
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all"
              style={{
                color:
                  value === null
                    ? "var(--primary)"
                    : "color-mix(in srgb, var(--primary) 45%, transparent)",
                background:
                  value === null
                    ? "color-mix(in srgb, var(--primary) 7%, transparent)"
                    : "transparent",
                fontSize: "8px",
                fontWeight: 900,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              {value === null && <Check className="shrink-0" size={8} />}
              <span className={value === null ? "" : "pl-4"}>
                Todas las eras
              </span>
            </button>

            {/* Separador */}
            <div
              style={{
                height: 1,
                margin: "2px 8px",
                background:
                  "color-mix(in srgb, var(--primary) 8%, transparent)",
              }}
            />

            {/* Opciones de era */}
            {eras.map((era: any) => {
              const activo = value === era.id;
              return (
                <button
                  key={era.id}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all"
                  style={{
                    color: activo
                      ? "var(--primary)"
                      : "color-mix(in srgb, var(--primary) 45%, transparent)",
                    background: activo
                      ? "color-mix(in srgb, var(--primary) 7%, transparent)"
                      : "transparent",
                    fontSize: "8px",
                    fontWeight: 900,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                  type="button"
                  onClick={() => {
                    onChange(activo ? null : era.id);
                    setOpen(false);
                  }}
                >
                  {activo ? (
                    <Check className="shrink-0" size={8} />
                  ) : (
                    <span
                      style={{
                        width: 8,
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span>{era.nombre}</span>
                  {era.anio_inicio != null && (
                    <span
                      style={{
                        marginLeft: "auto",
                        opacity: 0.4,
                        fontSize: "7px",
                        fontWeight: 700,
                      }}
                    >
                      {era.anio_inicio}
                      {era.anio_fin != null ? `–${era.anio_fin}` : "+"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

// ─── PersonajeFilterDropdown ─────────────────────────────────────────────────
// Selector de personaje para la línea de tiempo: mismo patrón visual que
// EraDropdown (trigger + panel portal), con búsqueda porque la lista de
// personajes puede ser larga. Al elegir un personaje, el panel muestra
// además sus eras internas (personaje_eras) y acota capítulos/canciones/
// cumpleaños a los vinculados a ese personaje — ver allEvents en
// PanelHistoriaMundo.
function PersonajeFilterDropdown({
  personajes,
  value,
  onChange,
}: {
  personajes: { id: string; nombre: string; img_url: string | null }[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const activo = personajes.find((p) => p.id === value) ?? null;

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return personajes;
    return personajes.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [personajes, query]);

  // Cerrar al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Posicionar contra el trigger — mismo patrón que EraDropdown.
  useEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      return;
    }
    const update = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      const w = Math.max(r.width, 220);
      let left = r.left;
      if (left + w > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - w - 8);
      }
      setPos({ top: r.bottom + 4, left, width: w });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, personajes.length]);

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={triggerRef}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest transition-all max-w-[140px]"
        style={{
          background:
            open || value
              ? "color-mix(in srgb, var(--primary) 10%, transparent)"
              : "color-mix(in srgb, var(--primary) 4%, transparent)",
          border: `1px solid color-mix(in srgb, var(--primary) ${open || value ? "20" : "8"}%, transparent)`,
          color:
            open || value
              ? "var(--primary)"
              : "color-mix(in srgb, var(--primary) 40%, transparent)",
        }}
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        <User size={8} className="shrink-0" />
        <span className="truncate">{activo ? activo.nombre : "Personaje"}</span>
        <ChevronDown
          className="shrink-0"
          size={7}
          style={{
            transform: open ? "rotate(180deg)" : undefined,
            transition: "transform 0.15s",
          }}
        />
      </button>

      {/* Panel — portal para no quedar cortado */}
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] rounded-xl border shadow-lg overflow-hidden flex flex-col"
            style={{
              top: pos.top,
              left: pos.left,
              minWidth: pos.width,
              maxHeight: 320,
              background: "var(--bg-main)",
              borderColor:
                "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            {/* Buscador */}
            <div
              className="px-2 py-1.5 border-b"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 8%, transparent)",
              }}
            >
              <input
                autoFocus
                className="w-full bg-transparent outline-none text-micro px-1 py-1"
                placeholder="Buscar personaje…"
                style={{ color: "var(--primary)" }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="overflow-y-auto py-1">
              {/* Opción "Todos" */}
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all"
                style={{
                  color:
                    value === null
                      ? "var(--primary)"
                      : "color-mix(in srgb, var(--primary) 45%, transparent)",
                  background:
                    value === null
                      ? "color-mix(in srgb, var(--primary) 7%, transparent)"
                      : "transparent",
                  fontSize: "8px",
                  fontWeight: 900,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {value === null && <Check className="shrink-0" size={8} />}
                <span className={value === null ? "" : "pl-4"}>
                  Todos los personajes
                </span>
              </button>

              <div
                style={{
                  height: 1,
                  margin: "2px 8px",
                  background:
                    "color-mix(in srgb, var(--primary) 8%, transparent)",
                }}
              />

              {filtrados.length === 0 ? (
                <p className="px-3 py-2 text-micro text-primary/25">
                  Sin resultados
                </p>
              ) : (
                filtrados.map((p) => {
                  const activoOpt = value === p.id;
                  return (
                    <button
                      key={p.id}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all"
                      style={{
                        color: activoOpt
                          ? "var(--primary)"
                          : "color-mix(in srgb, var(--primary) 45%, transparent)",
                        background: activoOpt
                          ? "color-mix(in srgb, var(--primary) 7%, transparent)"
                          : "transparent",
                        fontSize: "8px",
                        fontWeight: 900,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                      }}
                      type="button"
                      onClick={() => {
                        onChange(activoOpt ? null : p.id);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      {activoOpt ? (
                        <Check className="shrink-0" size={8} />
                      ) : (
                        <span
                          style={{
                            width: 8,
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <span className="truncate">{p.nombre}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// ── Panel principal — vista y edición unificadas, ambas pistas editables ──────
export function PanelHistoriaMundo({
  texto: _texto,
  onChange: _onChange,
  onSave,
  initialFilterReino,
  reinoFijo,
  onSelectPersonaje,
  onSelectCapitulo,
  onSelectCancion,
}: {
  texto: string;
  onChange: (v: string) => void;
  onSave: () => Promise<void>;
  initialFilterReino?: string | null;
  /**
   * Cuando se pasa, el filtro de reino queda fijado a este ID y los
   * botones de selección de reino se ocultan. Usar cuando el panel se
   * abre dentro del editor de un reino concreto.
   */
  reinoFijo?: string | null;
  onSelectPersonaje?: (id: string) => void;
  // Abren el editor de capítulo/canción en el panel lateral de la app —
  // PanelHistoriaMundo solo avisa, la navegación real la maneja quien
  // renderiza este componente.
  onSelectCapitulo?: (capituloId: string, libroId: string) => void;
  onSelectCancion?: (cancionId: string) => void;
}) {
  // Sistema antiguo de eventos "mundo"/"reino" (basado en columna historia JSON) eliminado.

  const {
    reinos,
    setReinos: _setReinos,
    loading: loadingReinos,
    recargar,
  } = useReinosConHistoria();

  // ── Capítulos con posición en línea de tiempo ─────────────────────────────
  const [capsTimeline, setCapsTimeline] = useState<CapTimeline[]>([]);
  // Mapa de todos los capítulos con reinos_ids (para los botones de filtro,
  // independientemente de si tienen orden_linea_tiempo)
  const [capsReinosIds, setCapsReinosIds] = useState<Record<string, string[]>>(
    {},
  );

  // ── Canciones con posición en línea de tiempo ─────────────────────────────
  const [cancionesTimeline, setCancionesTimeline] = useState<
    {
      id: string;
      titulo: string;
      cantante?: string | null;
      reinoId?: string | null;
      reinoNombre?: string | null;
      dia_absoluto?: number;
      orden_linea_tiempo?: number;
      personajeId?: string | null;
    }[]
  >([]);

  // ── Eventos de mundo/reino (tabla eventos_mundo, sistema nuevo) ───────────
  const [eventosMundo, setEventosMundo] = useState<
    {
      id: string;
      titulo: string;
      descripcion: string;
      dia_absoluto: number;
      reinoId?: string | null;
      reinoNombre?: string | null;
      source: string;
    }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    const cargarEventosMundo = async () => {
      // 1. Dexie primero
      try {
        if (db && (db as any).eventos_mundo) {
          const local: any[] = await (db as any).eventos_mundo.toArray();
          if (local.length && !cancelled) {
            const reinoMap: Record<string, string> = {};
            try {
              if (db && (db as any).reinos) {
                const rs: any[] = await (db as any).reinos.toArray();
                rs.forEach((r: any) => {
                  reinoMap[r.id] = r.nombre;
                });
              }
            } catch {}
            setEventosMundo(
              local.map((e: any) => ({
                id: e.id,
                titulo: e.titulo ?? "Sin título",
                descripcion: e.descripcion ?? "",
                dia_absoluto: e.dia_absoluto,
                reinoId: e.reino_id ?? null,
                reinoNombre: e.reino_id ? (reinoMap[e.reino_id] ?? null) : null,
                source: e.source ?? "mundo",
              })),
            );
          }
        }
      } catch {}
      if (!navigator.onLine || cancelled) return;
      // 2. Remoto
      try {
        const { data } = await supabase
          .from("eventos_mundo")
          .select(
            "id, titulo, descripcion, dia_absoluto, reino_id, source, reinos!reino_id(nombre)",
          );
        if (!data || cancelled) return;
        setEventosMundo(
          data.map((e: any) => {
            const reino = Array.isArray(e.reinos) ? e.reinos[0] : e.reinos;
            return {
              id: e.id,
              titulo: e.titulo ?? "Sin título",
              descripcion: e.descripcion ?? "",
              dia_absoluto: e.dia_absoluto,
              reinoId: e.reino_id ?? null,
              reinoNombre: reino?.nombre ?? null,
              source: e.source ?? "mundo",
            };
          }),
        );
        const flat = data.map((e: any) => ({ ...e, reinos: undefined }));
        try {
          if (db && (db as any).eventos_mundo)
            await (db as any).eventos_mundo.bulkPut(flat);
        } catch {}
      } catch {}
    };
    void cargarEventosMundo();
    const handleOnline = () => {
      if (!cancelled) void cargarEventosMundo();
    };
    window.addEventListener("online", handleOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cargarCanciones = async () => {
      // 1. Dexie primero
      try {
        if (db && (db as any).canciones) {
          const local: any[] = await (db as any).canciones.toArray();
          const conDia = local.filter(
            (c) => c.dia_absoluto != null && !c.deleted,
          );
          if (conDia.length && !cancelled) {
            const reinoMap: Record<string, string> = {};
            try {
              if (db && (db as any).reinos) {
                const rs: any[] = await (db as any).reinos.toArray();
                rs.forEach((r: any) => {
                  reinoMap[r.id] = r.nombre;
                });
              }
            } catch {}
            setCancionesTimeline(
              conDia.map((c) => ({
                id: c.id,
                titulo: c.titulo ?? "Sin título",
                cantante: c.cantante ?? null,
                reinoId: c.reino_id ?? null,
                reinoNombre: c.reino_id ? (reinoMap[c.reino_id] ?? null) : null,
                dia_absoluto: c.dia_absoluto,
                personajeId: c.personaje_id ?? null,
              })),
            );
          }
        }
      } catch {}
      if (!navigator.onLine || cancelled) return;
      // 2. Remoto
      try {
        const { data } = await supabase
          .from("canciones")
          .select(
            "id, titulo, cantante, dia_absoluto, reino_id, personaje_id, reinos!reino_id(nombre)",
          )
          .not("dia_absoluto", "is", null);
        if (!data?.length || cancelled) return;
        setCancionesTimeline(
          data.map((c: any) => {
            const reino = Array.isArray(c.reinos) ? c.reinos[0] : c.reinos;
            return {
              id: c.id,
              titulo: c.titulo ?? "Sin título",
              cantante: c.cantante ?? null,
              reinoId: c.reino_id ?? null,
              reinoNombre: reino?.nombre ?? null,
              dia_absoluto: c.dia_absoluto ?? undefined,
              orden_linea_tiempo: c.orden_linea_tiempo ?? undefined,
              personajeId: c.personaje_id ?? null,
            };
          }),
        );
        const flat = data.map((c: any) => ({ ...c, reinos: undefined }));
        if (db && (db as any).canciones)
          await (db as any).canciones.bulkPut(flat);
      } catch {}
    };
    void cargarCanciones();
    const handleOnline = () => {
      if (!cancelled) void cargarCanciones();
    };
    window.addEventListener("online", handleOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const cargarCaps = async () => {
      // 1. Leer de Dexie primero — respuesta instantánea sin red
      try {
        if (db) {
          const [localCaps, localLibros]: [any[], any[]] = await Promise.all([
            (db as any).capitulos?.toArray() ?? [],
            (db as any).libros?.toArray() ?? [],
          ]);
          const libroMapLocal: Record<string, string> = {};
          localLibros.forEach((l: any) => {
            libroMapLocal[l.id] = l.titulo ?? "";
          });

          const conDia = localCaps.filter((c: any) => c.dia_absoluto != null);
          if (conDia.length && !cancelled) {
            setCapsTimeline(
              conDia.map((c: any) => ({
                id: c.id,
                libro_id: c.libro_id,
                titulo_capitulo: c.titulo_capitulo,
                dia_absoluto: c.dia_absoluto,
                libroTitulo: libroMapLocal[c.libro_id] ?? "",
                reinos_ids: c.reinos_ids ?? [],
                personajes_ids: c.personajes_ids ?? [],
              })),
            );
          }

          const mapLocal: Record<string, string[]> = {};
          localCaps.forEach((c: any) => {
            if (c.reinos_ids?.length) mapLocal[c.id] = c.reinos_ids;
          });
          if (Object.keys(mapLocal).length && !cancelled)
            setCapsReinosIds(mapLocal);
        }
      } catch {}

      // 2. Fetch remoto en paralelo si hay conexión
      if (!navigator.onLine || cancelled) return;

      try {
        // Lanzar ambas queries al mismo tiempo en lugar de secuencialmente
        const [capsRes, capsReinosRes] = await Promise.all([
          supabase
            .from("capitulos")
            .select(
              "id, libro_id, titulo_capitulo, dia_absoluto, orden_linea_tiempo, reinos_ids, personajes_ids",
            )
            .not("dia_absoluto", "is", null),
          supabase
            .from("capitulos")
            .select("id, reinos_ids")
            .not("reinos_ids", "is", null),
        ]);
        if (cancelled) return;

        // Actualizar mapa de reinos_ids para los filtros
        const capsConReinos = capsReinosRes.data ?? [];
        if (capsConReinos.length) {
          const map: Record<string, string[]> = {};
          for (const c of capsConReinos as any[]) {
            if (c.reinos_ids?.length) map[c.id] = c.reinos_ids;
          }
          if (!cancelled) setCapsReinosIds(map);
        }

        // Actualizar pista de línea de tiempo
        const capsData = capsRes.data ?? [];
        if (capsData.length) {
          // Resolver títulos de libros desde Dexie primero, solo pedir los que faltan
          const libroIds = [
            ...new Set(
              (capsData as any[]).map((c: any) => c.libro_id).filter(Boolean),
            ),
          ];
          const libroMap: Record<string, string> = {};
          try {
            if (db && libroIds.length) {
              const localLibros: any[] =
                (await (db as any).libros?.toArray()) ?? [];
              localLibros.forEach((l: any) => {
                libroMap[l.id] = l.titulo ?? "";
              });
            }
          } catch {}

          const missingIds = libroIds.filter((id) => !libroMap[id]);
          if (missingIds.length) {
            try {
              const { data: libros } = await supabase
                .from("libros")
                .select("id, titulo")
                .in("id", missingIds);
              if (!cancelled) {
                (libros ?? []).forEach((l: any) => {
                  libroMap[l.id] = l.titulo ?? "";
                });
                // Persistir libros nuevos en Dexie
                if (db && libros?.length)
                  await (db as any).libros?.bulkPut(libros).catch(() => {});
              }
            } catch {}
          }

          if (!cancelled) {
            setCapsTimeline(
              (capsData as any[]).map((c) => ({
                id: c.id,
                libro_id: c.libro_id,
                titulo_capitulo: c.titulo_capitulo,
                orden_linea_tiempo: c.orden_linea_tiempo,
                dia_absoluto: c.dia_absoluto,
                libroTitulo: libroMap[c.libro_id] ?? "",
                reinos_ids: c.reinos_ids ?? [],
                personajes_ids: c.personajes_ids ?? [],
              })),
            );
            // Persistir capítulos en Dexie para la próxima carga offline
            try {
              if (db)
                await (db as any).capitulos?.bulkPut(capsData).catch(() => {});
            } catch {}
          }
        }
      } catch {}
    };

    void cargarCaps();

    // Recargar al volver online
    const handleOnline = () => {
      if (!cancelled) void cargarCaps();
    };
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // (Eliminado: inicialización de reinoEvents desde reino.historia)

  // (Eliminados: handleMundoChange, updateReinoEvent, removeReinoEvent, saveReinoHistory)

  // ── Personajes con fecha de nacimiento (cumpleaños) ──────────────────────
  const [personajesCumple, setPersonajesCumple] = useState<
    {
      id: string;
      nombre: string;
      img_url: string | null;
      reino: string | null;
      fecha_nacimiento: number;
    }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    const cargar = async () => {
      // 1. Dexie
      try {
        if (db && (db as any).personajes) {
          const local: any[] = await (db as any).personajes.toArray();
          const conFecha = local.filter(
            (p: any) => p.fecha_nacimiento != null && !p.deleted,
          );
          if (conFecha.length && !cancelled) {
            setPersonajesCumple(
              conFecha.map((p: any) => ({
                id: p.id,
                nombre: p.nombre ?? "Sin nombre",
                img_url: p.img_url ?? null,
                reino: p.reino ?? null,
                fecha_nacimiento: p.fecha_nacimiento,
              })),
            );
          }
        }
      } catch {}
      if (!navigator.onLine || cancelled) return;
      // 2. Supabase
      try {
        const { data } = await supabase
          .from("personajes")
          .select("id, nombre, img_url, reino, fecha_nacimiento")
          .not("fecha_nacimiento", "is", null);
        if (!data || cancelled) return;
        setPersonajesCumple(
          data.map((p: any) => ({
            id: p.id,
            nombre: p.nombre ?? "Sin nombre",
            img_url: p.img_url ?? null,
            reino: p.reino ?? null,
            fecha_nacimiento: p.fecha_nacimiento,
          })),
        );
      } catch {}
    };
    void cargar();
    const handleOnline = () => {
      if (!cancelled) void cargar();
    };
    window.addEventListener("online", handleOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const { cal } = useCalendario();
  // reinoFijo tiene prioridad sobre initialFilterReino.
  // Cuando reinoFijo está activo el filtro no puede cambiarse.
  const [filterReino, setFilterReino] = useState<string | null>(
    reinoFijo ?? initialFilterReino ?? null,
  );
  const [filterEra, setFilterEra] = useState<string | null>(null);
  // Personaje seleccionado en el filtro — al elegirlo se muestran también
  // sus eras internas (personaje_eras) mezcladas en la línea de tiempo,
  // y el resto de eventos (capítulos, canciones, cumpleaños) se acota a
  // los que están vinculados a ese personaje.
  const [filterPersonaje, setFilterPersonaje] = useState<string | null>(null);
  const personajeSeleccionado = useMemo(
    () => personajesCumple.find((p) => p.id === filterPersonaje) ?? null,
    [personajesCumple, filterPersonaje],
  );
  const { eras: erasPersonaje } = useErasDelPersonaje(
    filterPersonaje ?? "",
    personajeSeleccionado?.fecha_nacimiento ?? null,
  );

  // Si reinoFijo cambia en tiempo de ejecución (cambio de reino sin desmontar),
  // sincronizamos el filtro.
  useEffect(() => {
    if (reinoFijo !== undefined) setFilterReino(reinoFijo ?? null);
  }, [reinoFijo]);
  const [showCapitulos, setShowCapitulos] = useState(true);
  const [showCanciones, setShowCanciones] = useState(true);
  const [showEventos, setShowEventos] = useState(true);
  const [evtSeleccionado, setEvtSeleccionado] = useState<string | null>(null);
  const [showCumpleanos, setShowCumpleanos] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [diaOverrides, setDiaOverrides] = useState<Record<string, number>>({});
  const [showNuevoEvento, setShowNuevoEvento] = useState(false);
  const [creandoEvento, setCreandoEvento] = useState(false);
  const [erasLocal, setErasLocal] = useState<any[]>([]);
  const [eraModal, setEraModal] = useState<null | "new" | any>(null);
  const [showGestionEras, setShowGestionEras] = useState(false);

  // Sincronizar erasLocal con cal.eras cuando el hook carga
  useEffect(() => {
    if (cal?.eras?.length) setErasLocal(cal.eras);
  }, [cal?.eras]);

  const handleCrearEvento = useCallback(
    async (datos: {
      titulo: string;
      reinoId: string | null;
      dia_absoluto: number;
    }) => {
      setCreandoEvento(true);
      try {
        const reinoNombre = datos.reinoId
          ? (reinos.find((r) => r.id === datos.reinoId)?.nombre ?? null)
          : null;
        const { data, error } = await supabase
          .from("eventos_mundo")
          .insert([
            {
              titulo: datos.titulo || "Sin título",
              descripcion: "",
              dia_absoluto: datos.dia_absoluto,
              reino_id: datos.reinoId,
              source: datos.reinoId ? "reino" : "mundo",
            },
          ] as any)
          .select("id, titulo, descripcion, dia_absoluto, reino_id, source")
          .single();
        if (error || !data) return;
        const nuevo = {
          id: (data as any).id,
          titulo: (data as any).titulo ?? "Sin título",
          descripcion: (data as any).descripcion ?? "",
          dia_absoluto: (data as any).dia_absoluto,
          reinoId: (data as any).reino_id ?? null,
          reinoNombre,
          source: (data as any).source ?? "mundo",
        };
        setEventosMundo((prev) => [...prev, nuevo]);
        try {
          if (db && (db as any).eventos_mundo) {
            await (db as any).eventos_mundo.put({ ...data });
          }
        } catch {}
        setShowNuevoEvento(false);
      } finally {
        setCreandoEvento(false);
      }
    },
    [reinos],
  );

  const _handleDiaChange = (id: string, dia: number) => {
    setDiaOverrides((prev) => ({ ...prev, [id]: dia }));
  };

  const handleEventoMundoDiaChange = useCallback(
    async (id: string, dia: number) => {
      setEventosMundo((prev) =>
        prev.map((e) => (e.id === id ? { ...e, dia_absoluto: dia } : e)),
      );
      try {
        await supabase
          .from("eventos_mundo")
          .update({ dia_absoluto: dia } as any)
          .eq("id", id);
      } catch {}
      try {
        if (db && (db as any).eventos_mundo) {
          const existing = await (db as any).eventos_mundo.get(id);
          await (db as any).eventos_mundo.put({
            ...(existing ?? { id }),
            dia_absoluto: dia,
          });
        }
      } catch {}
    },
    [],
  );

  const handleEventoMundoFieldChange = useCallback(
    async (id: string, field: "titulo" | "descripcion", value: string) => {
      setEventosMundo((prev) =>
        prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
      );
      try {
        await supabase
          .from("eventos_mundo")
          .update({ [field]: value } as any)
          .eq("id", id);
      } catch {}
      try {
        if (db && (db as any).eventos_mundo) {
          const existing = await (db as any).eventos_mundo.get(id);
          await (db as any).eventos_mundo.put({
            ...(existing ?? { id }),
            [field]: value,
          });
        }
      } catch {}
    },
    [],
  );
  const _handleEventoMundoDelete = useCallback(async (id: string) => {
    setEventosMundo((prev) => prev.filter((e) => e.id !== id));
    try {
      await supabase.from("eventos_mundo").delete().eq("id", id);
    } catch {}
    try {
      if (db && (db as any).eventos_mundo)
        await (db as any).eventos_mundo.delete(id);
    } catch {}
  }, []);

  const debounceHistRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    try {
      await onSave();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    }
  }, [onSave]);

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (debounceHistRef.current) {
          clearTimeout(debounceHistRef.current);
          debounceHistRef.current = null;
        }
        void handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  // (Eliminados: add, update, remove, handleSaveReinoEvent — eventos "mundo"/"reino")

  const allEvents = useMemo<MundoTimelineEvent[]>(() => {
    const list: MundoTimelineEvent[] = [];
    // Sistema antiguo (mundoEvents / reinoEvents basados en "historia" JSON) eliminado.
    // Solo se usa el sistema nuevo: capítulos y canciones con dia_absoluto.
    // Capítulos — solo los que tienen dia_absoluto
    if (showCapitulos) {
      for (const cap of capsTimeline) {
        if (filterReino && !(cap.reinos_ids ?? []).includes(filterReino))
          continue;
        if (
          filterPersonaje &&
          !(cap.personajes_ids ?? []).includes(filterPersonaje)
        )
          continue;
        const dia = diaOverrides[cap.id] ?? cap.dia_absoluto;
        if (dia == null) continue; // sin fecha del calendario → no aparece
        if (filterEra && cal) {
          const fechaCap = diaAbsolutoAFecha(dia, cal.estaciones, cal.config);
          if (!fechaCap?.estacion) continue;
          const era = eraEnAnio(fechaCap.anio, cal.eras);
          if (!era || era.id !== filterEra) continue;
        }
        list.push({
          id: `cap:${cap.id}`,
          year: String(dia),
          title: cap.titulo_capitulo,
          description: "",
          source: "capitulo",
          yearNum: dia,
          dia_absoluto: dia,
          capData: cap,
        });
      }
    }
    // Eventos de mundo/reino — tabla eventos_mundo (sistema nuevo)
    if (showEventos && !filterPersonaje) {
      for (const e of eventosMundo) {
        if (filterReino && e.reinoId !== filterReino) continue;
        const dia = e.dia_absoluto;
        if (dia == null) continue;
        if (filterEra && cal) {
          const fechaEvt = diaAbsolutoAFecha(dia, cal.estaciones, cal.config);
          if (!fechaEvt?.estacion) continue;
          const era = eraEnAnio(fechaEvt.anio, cal.eras);
          if (!era || era.id !== filterEra) continue;
        }
        list.push({
          id: e.id,
          year: String(dia),
          title: e.titulo,
          description: e.descripcion,
          source: e.reinoId ? "reino" : "mundo",
          reinoId: e.reinoId ?? undefined,
          reinoNombre: e.reinoNombre ?? undefined,
          yearNum: dia,
          dia_absoluto: dia,
        });
      }
    }
    // Canciones — solo las que tienen dia_absoluto
    if (showCanciones) {
      for (const c of cancionesTimeline) {
        if (filterReino && c.reinoId !== filterReino) continue;
        if (filterPersonaje && c.personajeId !== filterPersonaje) continue;
        const dia = diaOverrides[c.id] ?? c.dia_absoluto;
        if (dia == null) continue; // sin fecha del calendario → no aparece
        if (filterEra && cal) {
          const fechaCan = diaAbsolutoAFecha(dia, cal.estaciones, cal.config);
          if (!fechaCan?.estacion) continue;
          const era = eraEnAnio(fechaCan.anio, cal.eras);
          if (!era || era.id !== filterEra) continue;
        }
        list.push({
          id: `cancion:${c.id}`,
          year: String(dia),
          title: c.titulo,
          description: "",
          source: "cancion",
          yearNum: dia,
          dia_absoluto: dia,
          cancionData: {
            id: c.id,
            titulo: c.titulo,
            cantante: c.cantante,
            reinoNombre: c.reinoNombre ?? null,
            dia_absoluto: dia,
          },
        });
      }
    }
    // Cumpleaños — personajes con fecha_nacimiento
    if (showCumpleanos) {
      for (const p of personajesCumple) {
        if (
          filterReino &&
          p.reino !== reinos.find((r) => r.id === filterReino)?.nombre
        )
          continue;
        if (filterPersonaje && p.id !== filterPersonaje) continue;
        const dia = p.fecha_nacimiento;
        if (filterEra && cal) {
          const fechaCumple = diaAbsolutoAFecha(
            dia,
            cal.estaciones,
            cal.config,
          );
          if (!fechaCumple?.estacion) continue;
          const era = eraEnAnio(fechaCumple.anio, cal.eras);
          if (!era || era.id !== filterEra) continue;
        }
        list.push({
          id: `cumple:${p.id}`,
          year: String(dia),
          title: `Cumpleaños ${p.nombre}`,
          description: "",
          source: "cumpleanos",
          yearNum: dia,
          dia_absoluto: dia,
          cumpleanosData: p,
        });
      }
    }
    // Eras internas del personaje seleccionado — solo aparecen cuando hay
    // un filtro de personaje activo (no tiene sentido mezclarlas con la
    // línea de tiempo general del mundo, son momentos de la vida de UN
    // personaje, no del mundo entero).
    if (filterPersonaje && personajeSeleccionado) {
      for (const era of erasPersonaje) {
        list.push({
          id: `era_personaje:${era.id}`,
          year: String(era.momento),
          title: era.label || `Era de ${personajeSeleccionado.nombre}`,
          description: era.notas,
          source: "era_personaje",
          reinoNombre: personajeSeleccionado.nombre,
          yearNum: era.momento,
          dia_absoluto: era.momento,
          eraPersonajeData: {
            id: era.id,
            personajeId: filterPersonaje,
            personajeNombre: personajeSeleccionado.nombre,
            rasgos: era.rasgos,
            notas: era.notas,
          },
        });
      }
    }
    return list.sort((a, b) => {
      const diff = a.yearNum - b.yearNum;
      if (diff !== 0) return diff;
      const order: Record<string, number> = {
        mundo: 0,
        reino: 1,
        cancion: 2,
        capitulo: 3,
        cumpleanos: 4,
        era_personaje: 5,
      };
      return (order[a.source] ?? 1) - (order[b.source] ?? 1);
    });
  }, [
    filterReino,
    filterEra,
    filterPersonaje,
    personajeSeleccionado,
    erasPersonaje,
    cal,
    capsTimeline,
    cancionesTimeline,
    eventosMundo,
    diaOverrides,
    showCapitulos,
    showCanciones,
    showEventos,
    showCumpleanos,
    personajesCumple,
    reinos,
  ]);

  const reinosConEventos = useMemo(
    () =>
      reinos.filter((r) => {
        // Sistema nuevo: reinos con capítulos, eventos o canciones asociados
        // (antes solo se consideraban capítulos, así que un reino con eventos
        // o canciones pero sin capítulos nunca aparecía como filtro).
        const tieneCaps = Object.values(capsReinosIds).some((ids) =>
          ids.includes(r.id),
        );
        const tieneEventos = eventosMundo.some((e) => e.reinoId === r.id);
        const tieneCanciones = cancionesTimeline.some(
          (c) => c.reinoId === r.id,
        );
        return tieneCaps || tieneEventos || tieneCanciones;
      }),
    [reinos, capsReinosIds, eventosMundo, cancionesTimeline],
  );

  // (Eliminados: selectedEvt, handleUpdateSelected — panel de edición de eventos "mundo"/"reino")

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Cabecera ──────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex flex-col border-b"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
        }}
      >
        {/* Fila 1: filtros + acciones */}
        <div className="flex items-center gap-2 px-3 py-1.5 flex-wrap">
          {/* ── Filtros de tipo ── */}
          <div
            className="flex items-center gap-0.5 p-0.5 rounded-lg"
            style={{
              background: "color-mix(in srgb, var(--primary) 4%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
            }}
          >
            <ToggleTipoBtn
              active={showCapitulos}
              icon={<BookOpen size={9} />}
              label="Capítulos"
              onClick={() => setShowCapitulos((v) => !v)}
            />
            <ToggleTipoBtn
              active={showCanciones}
              icon={<Music size={9} />}
              label="Canciones"
              onClick={() => setShowCanciones((v) => !v)}
            />
            <ToggleTipoBtn
              active={showEventos}
              icon={<CalendarDays size={9} />}
              label="Eventos"
              onClick={() => setShowEventos((v) => !v)}
            />
            <ToggleTipoBtn
              active={showCumpleanos}
              icon={
                <svg
                  fill="none"
                  height="9"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="9"
                >
                  <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
                  <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2 1 2 1" />
                  <path d="M2 21h20" />
                  <path d="M7 8v2" />
                  <path d="M12 8v2" />
                  <path d="M17 8v2" />
                  <path d="M7 4h.01" />
                  <path d="M12 4h.01" />
                  <path d="M17 4h.01" />
                </svg>
              }
              label="Cumpleaños"
              onClick={() => setShowCumpleanos((v) => !v)}
            />
          </div>

          {/* ── Filtro por reino ── (oculto cuando hay un reinoFijo) */}
          {reinoFijo == null && reinosConEventos.length > 0 && (
            <div
              className="flex items-center gap-0.5 p-0.5 rounded-lg flex-wrap"
              style={{
                background:
                  "color-mix(in srgb, var(--primary) 4%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
              }}
            >
              <button
                className="px-2 py-1 rounded-md text-micro font-black uppercase tracking-widest transition-all"
                style={
                  filterReino === null
                    ? {
                        background:
                          "color-mix(in srgb, var(--primary) 12%, transparent)",
                        color: "var(--primary)",
                      }
                    : {
                        color:
                          "color-mix(in srgb, var(--primary) 30%, transparent)",
                      }
                }
                type="button"
                onClick={() => setFilterReino(null)}
              >
                Todos
              </button>
              {reinosConEventos.map((r) => (
                <button
                  key={r.id}
                  className="px-2 py-1 rounded-md text-micro font-black uppercase tracking-widest transition-all"
                  style={
                    filterReino === r.id
                      ? {
                          background:
                            "color-mix(in srgb, var(--primary) 12%, transparent)",
                          color: "var(--primary)",
                        }
                      : {
                          color:
                            "color-mix(in srgb, var(--primary) 28%, transparent)",
                        }
                  }
                  type="button"
                  onClick={() =>
                    setFilterReino((prev) => (prev === r.id ? null : r.id))
                  }
                >
                  {r.nombre}
                </button>
              ))}
            </div>
          )}

          {/* ── Filtro por era ── */}
          {(erasLocal.length > 0 || (cal?.eras?.length ?? 0) > 0) &&
            (() => {
              const eras = erasLocal.length > 0 ? erasLocal : (cal?.eras ?? []);
              const eraActiva =
                eras.find((e: any) => e.id === filterEra) ?? null;
              return (
                <EraDropdown
                  eraActiva={eraActiva}
                  eras={eras}
                  value={filterEra}
                  onChange={setFilterEra}
                />
              );
            })()}

          {/* ── Filtro por personaje ── */}
          {personajesCumple.length > 0 && (
            <PersonajeFilterDropdown
              personajes={personajesCumple}
              value={filterPersonaje}
              onChange={setFilterPersonaje}
            />
          )}

          {/* ── Acciones (derecha) ── */}
          <div className="ml-auto flex items-center gap-1.5">
            <SaveIndicator status={saveStatus} />

            {/* Eras: botón principal + botón + pegados */}
            <div
              className="flex items-stretch rounded-lg overflow-hidden"
              style={{
                border:
                  "1px solid color-mix(in srgb, var(--primary) 14%, transparent)",
              }}
            >
              <button
                className="flex items-center gap-1 px-2 py-1 text-micro font-black uppercase tracking-widest transition-all"
                style={{
                  color: "color-mix(in srgb, var(--primary) 50%, transparent)",
                  background: "transparent",
                }}
                title="Ver y editar eras"
                type="button"
                onClick={() => setShowGestionEras(true)}
              >
                <Clock size={9} /> Eras
              </button>
              <div
                style={{
                  width: 1,
                  background:
                    "color-mix(in srgb, var(--primary) 10%, transparent)",
                  margin: "4px 0",
                }}
              />
              <button
                className="flex items-center px-1.5 py-1 transition-all"
                style={{
                  color: "color-mix(in srgb, var(--primary) 40%, transparent)",
                  background: "transparent",
                }}
                title="Nueva era"
                type="button"
                onClick={() => setEraModal("new")}
              >
                <Plus size={9} />
              </button>
            </div>

            {/* + Evento */}
            <button
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest transition-all"
              style={{
                background: "color-mix(in srgb, var(--accent) 8%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--accent) 22%, transparent)",
                color: "var(--accent)",
              }}
              title="Añadir evento"
              type="button"
              onClick={() => setShowNuevoEvento(true)}
            >
              <Plus size={9} /> Evento
            </button>

            {/* Recargar */}
            <button
              className="flex items-center justify-center transition-all rounded-lg"
              style={{
                width: 24,
                height: 24,
                border:
                  "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                color: "color-mix(in srgb, var(--primary) 30%, transparent)",
                background: "transparent",
              }}
              title="Recargar"
              type="button"
              onClick={() => recargar()}
            >
              {loadingReinos ? (
                <Loader2 className="animate-spin" size={9} />
              ) : (
                <svg
                  fill="none"
                  height="9"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                  width="9"
                >
                  <path d="M21 2v6h-6" />
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M3 22v-6h6" />
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal: nuevo evento */}
      {showNuevoEvento && (
        <ModalNuevoEvento
          creando={creandoEvento}
          reinoFijoId={reinoFijo}
          reinos={reinos}
          onClose={() => setShowNuevoEvento(false)}
          onCrear={handleCrearEvento}
        />
      )}

      {/* Modal: gestionar todas las eras */}
      {showGestionEras && (
        <ModalGestionEras
          eras={erasLocal.length > 0 ? erasLocal : (cal?.eras ?? [])}
          onClose={() => setShowGestionEras(false)}
          onEditEra={(era) => {
            setShowGestionEras(false);
            setEraModal(era);
          }}
          onNewEra={() => {
            setShowGestionEras(false);
            setEraModal("new");
          }}
        />
      )}

      {/* Modal: crear/editar era */}
      {eraModal && (
        <ModalEra
          era={eraModal === "new" ? null : eraModal}
          onClose={() => setEraModal(null)}
          onDeleted={(id) => {
            setErasLocal((prev) => prev.filter((e: any) => e.id !== id));
            setEraModal(null);
          }}
          onSaved={(eraGuardada) => {
            setErasLocal((prev) => {
              const idx = prev.findIndex((e: any) => e.id === eraGuardada.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = eraGuardada;
                return next;
              }
              return [...prev, eraGuardada].sort(
                (a: any, b: any) => a.anio_inicio - b.anio_inicio,
              );
            });
            setEraModal(null);
          }}
        />
      )}

      {/* ── Pista única: acontecimientos + capítulos en un solo scroll ──────── */}
      <div className="px-3 py-3 flex-1 min-h-0 overflow-y-auto">
        {loadingReinos ? (
          <div className="flex justify-center py-4">
            <Loader2 className="animate-spin text-primary/20" size={14} />
          </div>
        ) : (
          /* ── MODO LISTA VERTICAL (solo en modo compacto) ─────────────────── */
          <ListaEventosConMinimapa
            allEvents={allEvents}
            cal={cal}
            evtSeleccionado={evtSeleccionado}
            setEvtSeleccionado={setEvtSeleccionado}
            onDiaChange={handleEventoMundoDiaChange}
            onFieldChange={handleEventoMundoFieldChange}
            onSelectCancion={onSelectCancion}
            onSelectCapitulo={onSelectCapitulo}
            onSelectPersonaje={onSelectPersonaje}
          />
        )}
      </div>
    </div>
  );
}
