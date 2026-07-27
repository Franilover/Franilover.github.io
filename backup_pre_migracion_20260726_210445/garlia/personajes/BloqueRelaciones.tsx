"use client";

/**
 * BloqueRelaciones.tsx
 * ──────────────────────
 * UI de relaciones de un personaje: listado por tipo, formulario de
 * alta y selector de personaje destino. Toda la lógica de datos vive
 * en useRelaciones / useTiposExistentes (hooks/).
 *
 * Ruta: src/features/editorGarlia/components/personajes/BloqueRelaciones.tsx
 */

import {
  Users,
  Plus,
  X,
  Loader2,
  UserCircle2,
  ChevronDown,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  type Relacion,
  useRelaciones,
  useTiposExistentes,
} from "@/domains/garlia/_legacy/hooks/relaciones/useRelaciones";
import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";

import { GrafoRelaciones } from "./GrafoRelaciones";

// ─── Input tipo con autocomplete ──────────────────────────────────────────────

function InputTipo({
  value,
  onChange,
  sugerencias,
}: {
  value: string;
  onChange: (v: string) => void;
  sugerencias: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtradas = sugerencias.filter(
    (s) =>
      s.toLowerCase().includes(value.toLowerCase()) &&
      s.toLowerCase() !== value.toLowerCase(),
  );
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <input
        className="w-full bg-primary/[0.03] text-micro font-bold text-primary outline-none placeholder:text-primary/20 border border-primary/10 focus:border-primary/25 rounded-md px-2.5 py-1.5 transition-all"
        placeholder="Tipo de relación…"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtradas.length > 0 && (
        <div className="absolute z-[80] top-full left-0 mt-1 w-full rounded-lg shadow-xl overflow-hidden bg-bg-main border border-primary/15">
          {filtradas.map((s) => (
            <button
              key={s}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-primary/6 transition-colors text-left"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s);
                setOpen(false);
              }}
            >
              <span className="shrink-0 w-1 h-1 rounded-full bg-primary/30" />
              <span className="text-micro font-bold text-primary/70">{s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Selector de personaje ────────────────────────────────────────────────────

interface PersonajeMin {
  id: string;
  nombre: string;
  img_url?: string | null;
}

function SelectorPersonaje({
  excludeId,
  onSelect,
  onClose,
}: {
  excludeId: string;
  onSelect: (p: PersonajeMin) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonajeMin[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        if (!navigator.onLine) {
          if (db) {
            const all: any[] = (await (db as any).personajes?.toArray()) ?? [];
            setResults(
              all
                .filter(
                  (p: any) =>
                    p.id !== excludeId &&
                    (!q.trim() ||
                      p.nombre?.toLowerCase().includes(q.trim().toLowerCase())),
                )
                .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre))
                .slice(0, 20) as PersonajeMin[],
            );
          }
          setLoading(false);
          return;
        }
        let sb = supabase
          .from("personajes")
          .select("id, nombre, img_url")
          .neq("id", excludeId)
          .order("nombre")
          .limit(20);
        if (q.trim()) sb = sb.ilike("nombre", `%${q.trim()}%`);
        const { data } = await sb;
        setResults((data ?? []) as PersonajeMin[]);
      } catch {
        setResults([]);
      }
      setLoading(false);
    },
    [excludeId],
  );

  useEffect(() => {
    const t = setTimeout(() => search(query), 250);
    return () => clearTimeout(t);
  }, [query, search]);
  useEffect(() => {
    void search("");
  }, [search]);

  return (
    <div
      className="absolute z-[70] top-full left-0 mt-1 w-full rounded-lg shadow-2xl overflow-hidden bg-bg-main border border-primary/15"
      style={{ maxHeight: 200 }}
    >
      <div className="px-2.5 py-1.5 border-b border-primary/10">
        <input
          autoFocus
          className="w-full bg-transparent text-micro font-bold text-primary outline-none placeholder:text-primary/25"
          placeholder="Buscar personaje…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 158 }}>
        {loading ? (
          <div className="flex justify-center py-3">
            <Loader2 className="animate-spin text-primary/20" size={12} />
          </div>
        ) : results.length === 0 ? (
          <p className="text-micro text-primary/25 text-center py-3 font-bold uppercase tracking-widest italic">
            Sin resultados
          </p>
        ) : (
          results.map((p) => (
            <button
              key={p.id}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-primary/6 transition-colors text-left"
              onClick={() => {
                onSelect(p);
                onClose();
              }}
            >
              <div className="shrink-0 w-5 h-5 rounded overflow-hidden border border-primary/10 bg-primary/5 flex items-center justify-center">
                {p.img_url ? (
                  <Image
                    alt={p.nombre}
                    className="w-full h-full object-cover"
                    src={p.img_url}
                  />
                ) : (
                  <UserCircle2 className="text-primary/20" size={9} />
                )}
              </div>
              <span className="text-micro font-bold text-primary/80 truncate">
                {p.nombre}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Formulario inline compacto ───────────────────────────────────────────────

function FormNuevaRelacion({
  personajeId,
  tiposExistentes,
  onAdd,
  onCancel,
}: {
  personajeId: string;
  tiposExistentes: string[];
  onAdd: (
    personajeSel: PersonajeMin,
    tipo: string,
    nota: string,
  ) => Promise<Relacion | null>;
  onCancel: () => void;
}) {
  const [tipo, setTipo] = useState("");
  const [personajeSel, setPersonajeSel] = useState<PersonajeMin | null>(null);
  const [nota, setNota] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const guardar = async () => {
    if (!personajeSel) {
      setError("Selecciona un personaje");
      return;
    }
    if (!tipo.trim()) {
      setError("Escribe el tipo de relación");
      return;
    }
    setError("");
    setSaving(true);
    const ok = await onAdd(personajeSel, tipo, nota);
    setSaving(false);
    if (!ok) {
      setError("Error al guardar");
      return;
    }
  };

  return (
    <div className="border border-primary/12 rounded-lg bg-primary/[0.025] p-2.5 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[7.5px] font-black uppercase tracking-[0.25em] text-primary/30">
            Tipo
          </label>
          <InputTipo
            sugerencias={tiposExistentes}
            value={tipo}
            onChange={setTipo}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[7.5px] font-black uppercase tracking-[0.25em] text-primary/30">
            Personaje
          </label>
          <div className="relative">
            <button
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-primary/10 bg-primary/[0.03] text-left hover:border-primary/25 transition-all"
              onClick={() => setSelectorOpen((o) => !o)}
            >
              {personajeSel ? (
                <>
                  <div className="shrink-0 w-4 h-4 rounded overflow-hidden border border-primary/10 bg-primary/5">
                    {personajeSel.img_url ? (
                      <Image
                        alt=""
                        className="w-full h-full object-cover"
                        src={personajeSel.img_url}
                      />
                    ) : (
                      <UserCircle2 className="text-primary/20" size={8} />
                    )}
                  </div>
                  <span className="flex-1 text-micro font-bold text-primary/80 truncate">
                    {personajeSel.nombre}
                  </span>
                </>
              ) : (
                <span className="flex-1 text-micro font-bold text-primary/25 italic">
                  Seleccionar…
                </span>
              )}
              <ChevronDown
                className={`text-primary/25 shrink-0 transition-transform ${selectorOpen ? "rotate-180" : ""}`}
                size={9}
              />
            </button>
            {selectorOpen && (
              <SelectorPersonaje
                excludeId={personajeId}
                onClose={() => setSelectorOpen(false)}
                onSelect={setPersonajeSel}
              />
            )}
          </div>
        </div>
      </div>

      {tiposExistentes.length > 0 && tiposExistentes.length <= 10 && (
        <div className="flex flex-wrap gap-1">
          {tiposExistentes.map((s) => (
            <button
              key={s}
              className={`px-1.5 py-0.5 rounded text-micro font-black uppercase tracking-widest border transition-all
                ${
                  tipo === s
                    ? "bg-primary/10 border-primary/25 text-primary"
                    : "border-primary/8 text-primary/30 hover:border-primary/20 hover:text-primary/55"
                }`}
              onMouseDown={(e) => {
                e.preventDefault();
                setTipo(s);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          className="flex-1 bg-primary/[0.03] text-micro font-medium text-primary outline-none placeholder:text-primary/20 border border-primary/10 focus:border-primary/25 rounded-md px-2.5 py-1.5 transition-all min-w-0"
          placeholder="Nota opcional…"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="px-2.5 py-1.5 rounded-md text-[8.5px] font-black uppercase tracking-widest border border-primary/10 text-primary/30 hover:text-primary/60 hover:border-primary/20 transition-all"
            onClick={onCancel}
          >
            ✕
          </button>
          <button
            className="px-2.5 py-1.5 rounded-md text-[8.5px] font-black uppercase tracking-widest bg-primary text-btn-text disabled:opacity-40 hover:bg-primary/90 transition-all flex items-center gap-1"
            disabled={saving}
            onClick={guardar}
          >
            {saving ? (
              <Loader2 className="animate-spin" size={8} />
            ) : (
              <Plus size={8} />
            )}
            Añadir
          </button>
        </div>
      </div>

      {error && <p className="text-[8.5px] font-bold text-red-400">{error}</p>}
    </div>
  );
}

// ─── Fila de relación compacta ────────────────────────────────────────────────

function FilaRelacion({
  rel,
  onDelete,
  onSelectPersonaje,
}: {
  rel: Relacion;
  onDelete: (rel: Relacion) => void;
  onSelectPersonaje?: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(rel);
    setDeleting(false);
  };

  return (
    <div className="group flex items-center gap-1.5 py-[3px] rounded-md hover:bg-primary/[0.04] px-1 transition-all">
      <button
        className="shrink-0 w-[18px] h-[18px] rounded overflow-hidden border border-primary/10 bg-primary/5 flex items-center justify-center hover:border-primary/30 transition-colors"
        onClick={() => onSelectPersonaje?.(rel.personaje_rel_id)}
      >
        {rel.rel_img_url ? (
          <Image
            alt={rel.rel_nombre ?? ""}
            className="w-full h-full object-cover"
            src={rel.rel_img_url}
          />
        ) : (
          <UserCircle2 className="text-primary/20" size={8} />
        )}
      </button>
      <button
        className="flex-1 text-left text-micro font-bold text-primary/75 truncate leading-none min-w-0 hover:text-primary transition-colors"
        onClick={() => onSelectPersonaje?.(rel.personaje_rel_id)}
      >
        {rel.rel_nombre ?? "—"}
      </button>
      <button
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 rounded flex items-center justify-center text-primary/20 hover:text-red-400 hover:bg-red-500/8"
        disabled={deleting}
        onClick={handleDelete}
      >
        {deleting ? (
          <Loader2 className="animate-spin" size={8} />
        ) : (
          <X size={8} />
        )}
      </button>
    </div>
  );
}

// ─── Columna por tipo ─────────────────────────────────────────────────────────

function ColumnaTipo({
  tipo,
  relaciones,
  onDelete,
  onSelectPersonaje,
}: {
  tipo: string;
  relaciones: Relacion[];
  onDelete: (rel: Relacion) => void;
  onSelectPersonaje?: (id: string) => void;
}) {
  return (
    <div className="flex-1 min-w-[90px]">
      <div className="flex items-center gap-1 mb-1 px-1">
        <span className="text-[7.5px] font-black uppercase tracking-[0.25em] text-primary/35 truncate leading-none">
          {tipo}
        </span>
        <span className="text-[7.5px] font-bold text-primary/20 shrink-0">
          {relaciones.length}
        </span>
      </div>
      <div className="space-y-0">
        {relaciones.map((rel) => (
          <FilaRelacion
            key={rel.id}
            rel={rel}
            onDelete={onDelete}
            onSelectPersonaje={onSelectPersonaje}
          />
        ))}
      </div>
    </div>
  );
}

// ─── BloqueRelaciones ─────────────────────────────────────────────────────────

export function BloqueRelaciones({
  personajeId,
  personajeNombre,
  onSelectPersonaje,
}: {
  personajeId: string;
  personajeNombre?: string;
  onSelectPersonaje?: (id: string) => void;
}) {
  const { relaciones, loading, addRelacion, deleteRelacion } =
    useRelaciones(personajeId);
  const tiposExistentes = useTiposExistentes();
  const [formVisible, setFormVisible] = useState(false);

  const handleAdd = async (
    personajeSel: PersonajeMin,
    tipo: string,
    nota: string,
  ) => {
    const r = await addRelacion(personajeSel, tipo, nota);
    if (r) setFormVisible(false);
    return r;
  };

  const tiposConData = [...new Set(relaciones.map((r) => r.tipo))].sort();
  const porTipo = (t: string) => relaciones.filter((r) => r.tipo === t);

  return (
    <div className="rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2 py-1">
        <Users className="text-primary/25 shrink-0" size={8} />
        <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30 leading-none">
          Relaciones
        </span>
        {relaciones.length > 0 && (
          <span className="text-micro font-black text-primary/20 tabular-nums leading-none">
            {relaciones.length}
          </span>
        )}
        <div
          className="flex-1 h-px"
          style={{
            background:
              "color-mix(in srgb, var(--primary) 12%, transparent)",
          }}
        />
        {!loading && relaciones.length > 0 && (
          <GrafoRelaciones
            personajeId={personajeId}
            personajeNombre={personajeNombre}
          />
        )}
        <button
          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-micro font-black uppercase tracking-widest border transition-all leading-none
            ${
              formVisible
                ? "bg-primary/8 border-primary/20 text-primary"
                : "border-primary/8 text-primary/25 hover:text-primary/50 hover:border-primary/18"
            }`}
          onClick={() => setFormVisible((v) => !v)}
        >
          {formVisible ? <X size={7} /> : <Plus size={7} />}
          {formVisible ? "Cerrar" : "Añadir"}
        </button>
      </div>

      {/* Cuerpo */}
      <div className="px-2 py-1.5 space-y-1.5">
        {formVisible && (
          <div className="pb-1">
            <FormNuevaRelacion
              personajeId={personajeId}
              tiposExistentes={tiposExistentes}
              onAdd={handleAdd}
              onCancel={() => setFormVisible(false)}
            />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="animate-spin text-primary/20" size={12} />
          </div>
        ) : relaciones.length === 0 ? (
          <p className="text-[8.5px] font-bold text-primary/18 uppercase tracking-widest text-center py-3 italic">
            Sin relaciones
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-3 gap-y-2.5">
            {tiposConData.map((tipo) => (
              <ColumnaTipo
                key={tipo}
                relaciones={porTipo(tipo)}
                tipo={tipo}
                onDelete={deleteRelacion}
                onSelectPersonaje={onSelectPersonaje}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
