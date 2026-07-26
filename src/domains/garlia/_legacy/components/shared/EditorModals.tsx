"use client";

import {
  Loader2,
  X,
  ScrollText,
  Globe,
  Clock,
  Check,
  Layers,
  Users,
  Bug,
  Package,
  Map,
  Sparkles,
  Wand2,
  Star,
  BookOpen,
  Feather,
  Swords,
  Gem,
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";

import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type AllItems = {
  personajes: any[];
  criaturas: any[];
  items: any[];
  reinos: any[];
  hechizos: any[];
  dones: any[];
  runas: any[];
  notas: any[];
  grupos: any[];
  capitulos: any[];
  letras: any[];
};

export type MagicAddKey =
  | "hechizos"
  | "dones"
  | "runas"
  | "notas"
  | "acontecimiento"
  | "grupos"
  | "ciudad"
  | "libro"
  | "capitulo"
  | "cancion"
  | "grupo_libro";

// ─── Helper Dexie local ───────────────────────────────────────────────────────

type ReinoMin = { id: string; nombre: string };

async function dexieReadAll<T>(tabla: string): Promise<T[]> {
  try {
    if (!db) return [];
    const t = (db as any)[tabla];
    if (!t) return [];
    return ((await t.toArray()) as any[]).filter((r: any) => !r.deleted) as T[];
  } catch {
    return [];
  }
}

// ─── ModalAcontecimiento ──────────────────────────────────────────────────────

export function ModalAcontecimiento({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [scope, setScope] = useState<"global" | "reino">("global");
  const [reinos, setReinos] = useState<ReinoMin[]>([]);
  const [reinoId, setReinoId] = useState<string>("");
  const [loadingR, setLoadingR] = useState(true);
  const [year, setYear] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const local = await dexieReadAll<ReinoMin>("reinos");
        if (local.length) {
          setReinos(local);
          setLoadingR(false);
        }
        if (!navigator.onLine) {
          if (!local.length) setLoadingR(false);
          return;
        }
        const { data } = await supabase
          .from("reinos")
          .select("id, nombre")
          .order("nombre");
        setReinos((data ?? []) as ReinoMin[]);
      } finally {
        setLoadingR(false);
      }
    })();
  }, []);

  const canSave = title.trim() && (scope === "global" || reinoId);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const newEvt = {
        id: crypto.randomUUID(),
        year: year.trim(),
        title: title.trim(),
        description: desc.trim(),
      };

      if (scope === "global") {
        const { data: secRow } = await supabase
          .from("mundo_secciones")
          .select("contenido")
          .eq("key", "historia")
          .single();
        let events: any[] = [];
        try { events = JSON.parse(secRow?.contenido ?? "[]"); } catch {}
        if (!Array.isArray(events)) events = [];
        events.push(newEvt);
        const { error: err } = await supabase
          .from("mundo_secciones")
          .update({ contenido: JSON.stringify(events), updated_at: new Date().toISOString() })
          .eq("key", "historia");
        if (err) throw err;
      } else {
        const { data: reinoRow } = await supabase
          .from("reinos")
          .select("id, historia")
          .eq("id", reinoId)
          .single();
        if (!reinoRow) throw new Error("No se encontró el reino");
        let events: any[] = [];
        try { events = JSON.parse((reinoRow as any).historia ?? "[]"); } catch {}
        if (!Array.isArray(events)) events = [];
        events.push(newEvt);
        const { error: err } = await supabase
          .from("reinos")
          .update({ historia: JSON.stringify(events) })
          .eq("id", reinoId);
        if (err) throw err;
      }

      setSaved(true);
      onSaved?.();
      setTimeout(onClose, 900);
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  const INPUT =
    "w-full px-3 py-2 rounded-xl text-xs font-medium text-primary bg-transparent border transition-all outline-none placeholder:text-primary/25 focus:border-primary/40 focus:bg-primary/3";
  const borderNorm = "border-primary/15";

  return (
    <div
      className="fixed inset-0 z-80 flex items-center justify-center p-4"
      style={{ background: "color-mix(in srgb, var(--primary) 30%, transparent)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: "var(--bg-main)",
          border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
          animation: "popIn 160ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)", background: "color-mix(in srgb, var(--primary) 3%, transparent)" }}
        >
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border"
            style={{ background: "color-mix(in srgb, var(--primary) 8%, transparent)", borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)" }}
          >
            <Clock className="text-primary/50" size={12} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-micro font-black uppercase tracking-[0.3em] text-primary/40">Añadir acontecimiento</p>
          </div>
          <button className="text-primary/25 hover:text-primary transition-colors" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35">Ámbito</label>
            <div className="flex gap-1.5">
              {(["global", "reino"] as const).map((s) => (
                <button
                  key={s}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-micro font-black uppercase tracking-widest border transition-all"
                  style={
                    scope === s
                      ? { background: "color-mix(in srgb, var(--primary) 10%, transparent)", borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)", color: "var(--primary)" }
                      : { borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "color-mix(in srgb, var(--primary) 35%, transparent)" }
                  }
                  onClick={() => setScope(s)}
                >
                  {s === "global" ? <Globe size={10} /> : <ScrollText size={10} />}
                  {s === "global" ? "Global" : "Un reino"}
                </button>
              ))}
            </div>
          </div>

          {scope === "reino" && (
            <div className="space-y-1.5">
              <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35">Reino</label>
              {loadingR ? (
                <div className="flex items-center gap-2 px-3 py-2">
                  <Loader2 className="animate-spin text-primary/20" size={11} />
                  <span className="text-micro text-primary/30">Cargando reinos…</span>
                </div>
              ) : (
                <select
                  className={`${INPUT} ${borderNorm} cursor-pointer`}
                  style={{ appearance: "none" }}
                  value={reinoId}
                  onChange={(e) => setReinoId(e.target.value)}
                >
                  <option value="">Seleccionar reino…</option>
                  {reinos.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35">
              Año / Era{" "}
              <span className="text-primary/20 normal-case tracking-normal font-medium">(opcional)</span>
            </label>
            <input
              className={`${INPUT} ${borderNorm}`}
              placeholder="Año 342, Era del Fuego, Antes del Caos…"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35">Título</label>
            <input
              className={`${INPUT} ${borderNorm}`}
              placeholder="La Gran Batalla, Fundación del Imperio…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35">
              Qué ocurrió{" "}
              <span className="text-primary/20 normal-case tracking-normal font-medium">(opcional)</span>
            </label>
            <textarea
              className={`${INPUT} ${borderNorm} resize-none`}
              placeholder="Describe el acontecimiento, sus causas y consecuencias…"
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>

          {error && <p className="text-micro text-red-400 font-medium px-1">{error}</p>}
        </div>

        <div
          className="flex items-center justify-end gap-2 px-4 py-3 border-t"
          style={{ borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)", background: "color-mix(in srgb, var(--primary) 2%, transparent)" }}
        >
          <button
            className="px-4 py-2 rounded-xl text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary hover:bg-primary/6 transition-all border border-transparent hover:border-primary/10"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-micro font-black uppercase tracking-widest transition-all disabled:opacity-40"
            disabled={!canSave || saving}
            style={{
              background: saved ? "color-mix(in srgb, #22c55e 80%, transparent)" : "var(--primary)",
              color: "var(--btn-text, white)",
            }}
            onClick={handleSave}
          >
            {saving ? <Loader2 className="animate-spin" size={10} /> : saved ? <Check size={10} /> : <Clock size={10} />}
            {saved ? "Guardado" : saving ? "Guardando…" : "Añadir"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ModalNuevoGrupo ──────────────────────────────────────────────────────────

type GrupoTipoLocal =
  | "personajes"
  | "criaturas"
  | "items"
  | "reinos"
  | "hechizos"
  | "dones"
  | "runas"
  | "libros";

const GRUPO_MODAL_CONFIG: Record<
  GrupoTipoLocal,
  { label: string; labelPlural: string; Icon: React.ElementType; IconAlt: React.ElementType; color: string; ejemplo: string; tabla: string }
> = {
  personajes: { label: "Personaje", labelPlural: "Personajes", Icon: Users, IconAlt: Users, color: "var(--primary)", tabla: "personajes", ejemplo: "Facción, clan, gremio…" },
  criaturas:  { label: "Criatura",  labelPlural: "Criaturas",  Icon: Bug,   IconAlt: Feather, color: "color-mix(in srgb, var(--primary) 70%, #4ade80)", tabla: "criaturas", ejemplo: "Manada, especie, orden…" },
  items:      { label: "Objeto",    labelPlural: "Objetos",    Icon: Package, IconAlt: Swords, color: "color-mix(in srgb, var(--primary) 60%, #f59e0b)", tabla: "items", ejemplo: "Arsenal, colección, reliquias…" },
  reinos:     { label: "Reino",     labelPlural: "Reinos",     Icon: Map,   IconAlt: Map,    color: "color-mix(in srgb, var(--primary) 60%, #60a5fa)", tabla: "reinos", ejemplo: "Alianza, confederación, imperio…" },
  hechizos:   { label: "Hechizo",   labelPlural: "Hechizos",   Icon: Sparkles, IconAlt: Wand2, color: "var(--accent)", tabla: "hechizos", ejemplo: "Escuela, elemento, estilo…" },
  dones:      { label: "Don",       labelPlural: "Dones",      Icon: Star,  IconAlt: Gem,    color: "color-mix(in srgb, var(--accent) 70%, var(--primary))", tabla: "dones", ejemplo: "Linaje, maldición, ancestral…" },
  runas:      { label: "Runa",      labelPlural: "Runas",      Icon: ScrollText, IconAlt: ScrollText, color: "var(--primary)", tabla: "runas", ejemplo: "Conjunto rúnico, tradición…" },
  libros:     { label: "Libro",     labelPlural: "Libros",     Icon: BookOpen, IconAlt: BookOpen, color: "color-mix(in srgb, var(--primary) 60%, #a78bfa)", tabla: "libros", ejemplo: "Novela, poemario, saga, extra…" },
};

export function ModalNuevoGrupo({
  onClose,
  onCreated,
  tipoInicial,
}: {
  onClose: () => void;
  onCreated?: (grupo: any) => void;
  tipoInicial?: GrupoTipoLocal;
}) {
  const [tipo, setTipo] = useState<GrupoTipoLocal | null>(tipoInicial ?? null);
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tipo) setTimeout(() => inputRef.current?.focus(), 80);
  }, [tipo]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (tipo) { setTipo(null); setNombre(""); setError(null); }
        else onClose();
      }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [tipo, onClose]);

  const cfg = tipo ? GRUPO_MODAL_CONFIG[tipo] : null;
  const canSave = !!tipo && nombre.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving || !tipo) return;
    setSaving(true);
    setError(null);
    try {
      const newGrupo = {
        id: crypto.randomUUID(),
        nombre: nombre.trim(),
        tipo,
        descripcion: null,
        miembro_ids: [] as string[],
      };
      const { data, error: err } = await (supabase as any)
        .from("grupos_mundo")
        .insert([newGrupo])
        .select()
        .single();
      if (err) throw err;
      setSaved(true);
      onCreated?.(data);
      setTimeout(onClose, 700);
    } catch (e: any) {
      setError(e?.message ?? "Error al crear el grupo");
    } finally {
      setSaving(false);
    }
  };

  const INPUT =
    "w-full px-3 py-2 rounded-xl text-xs font-medium text-primary bg-transparent border transition-all outline-none placeholder:text-primary/25 focus:border-primary/40 focus:bg-primary/3";

  return (
    <div
      className="fixed inset-0 z-80 flex items-center justify-center p-4"
      style={{ background: "color-mix(in srgb, var(--primary) 30%, transparent)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: "var(--bg-main)",
          border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
          animation: "popIn 160ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)", background: "color-mix(in srgb, var(--primary) 3%, transparent)" }}
        >
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border transition-all"
            style={
              cfg
                ? { background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`, borderColor: `color-mix(in srgb, ${cfg.color} 25%, transparent)` }
                : { background: "color-mix(in srgb, var(--primary) 8%, transparent)", borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)" }
            }
          >
            {cfg ? <cfg.Icon size={12} style={{ color: cfg.color }} /> : <Layers className="text-primary/40" size={12} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-micro font-black uppercase tracking-[0.3em] text-primary/40">
              {cfg ? `Nuevo grupo · ${cfg.labelPlural}` : "Nuevo grupo"}
            </p>
          </div>
          <button className="text-primary/25 hover:text-primary transition-colors" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35">Tipo de miembros</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.entries(GRUPO_MODAL_CONFIG) as [GrupoTipoLocal, typeof GRUPO_MODAL_CONFIG[GrupoTipoLocal]][]).map(([key, c]) => {
                const isSelected = tipo === key;
                return (
                  <button
                    key={key}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all"
                    style={
                      isSelected
                        ? { borderColor: `color-mix(in srgb, ${c.color} 40%, transparent)`, background: `color-mix(in srgb, ${c.color} 12%, transparent)` }
                        : { borderColor: "color-mix(in srgb, var(--primary) 10%, transparent)", background: "color-mix(in srgb, var(--primary) 3%, transparent)" }
                    }
                    onClick={() => { setTipo(key); setNombre(""); setError(null); }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLElement).style.borderColor = `color-mix(in srgb, ${c.color} 25%, transparent)`;
                        (e.currentTarget as HTMLElement).style.background = `color-mix(in srgb, ${c.color} 7%, transparent)`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLElement).style.borderColor = "color-mix(in srgb, var(--primary) 10%, transparent)";
                        (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--primary) 3%, transparent)";
                      }
                    }}
                  >
                    <c.IconAlt
                      size={16}
                      strokeWidth={1.5}
                      style={{ color: isSelected ? c.color : `color-mix(in srgb, ${c.color} 55%, transparent)` }}
                    />
                    <span
                      className="text-micro font-black uppercase tracking-widest leading-tight text-center"
                      style={{ color: isSelected ? "var(--primary)" : "color-mix(in srgb, var(--primary) 45%, transparent)" }}
                    >
                      {c.labelPlural}
                    </span>
                  </button>
                );
              })}
            </div>
            {tipo && cfg && <p className="text-micro text-primary/25 italic px-0.5">{cfg.ejemplo}</p>}
          </div>

          {tipo && (
            <div className="space-y-1.5">
              <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35">Nombre del grupo</label>
              <input
                ref={inputRef}
                className={`${INPUT} border-primary/15`}
                placeholder={`Nombre del grupo de ${cfg!.labelPlural.toLowerCase()}…`}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
              />
            </div>
          )}

          {error && <p className="text-micro text-red-400 font-medium px-1">{error}</p>}
        </div>

        <div
          className="flex items-center justify-end gap-2 px-4 py-3 border-t"
          style={{ borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)", background: "color-mix(in srgb, var(--primary) 2%, transparent)" }}
        >
          <button
            className="px-4 py-2 rounded-xl text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary hover:bg-primary/6 transition-all border border-transparent hover:border-primary/10"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-micro font-black uppercase tracking-widest transition-all disabled:opacity-40"
            disabled={!canSave || saving}
            style={{
              background: saved
                ? "color-mix(in srgb, #22c55e 80%, transparent)"
                : cfg
                  ? `color-mix(in srgb, ${cfg.color} 85%, transparent)`
                  : "var(--primary)",
              color: "var(--btn-text, white)",
            }}
            onClick={handleSave}
          >
            {saving ? <Loader2 className="animate-spin" size={10} /> : saved ? <Check size={10} /> : <Layers size={10} />}
            {saved ? "Creado" : saving ? "Creando…" : "Crear grupo"}
          </button>
        </div>
      </div>
    </div>
  );
}
