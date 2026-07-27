"use client";
import {
  Loader2, AlertCircle, CheckCircle2,
  Image as ImageIcon, X, Save, Trash2, Pencil, ExternalLink,
} from "lucide-react";
import Image from "next/image";
import React, { useState, useEffect, useRef, useMemo } from "react";

import { RichEditor } from "@/editor/lexical";
import { normalize } from "@/components/layout/EstudioTemplates";
import SimpleImagePicker from "@/components/ui/SimpleImagePicker";

import { useWikilink } from "./WikilinkContext";
import { INPUT_CLS, type SaveStatus } from "@/domains/garlia/_shared/types";

export function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const map = {
    saving: { icon: <Loader2 className="animate-spin" size={11} />, text: "Guardando…", cls: "text-primary/40" },
    saved:  { icon: <CheckCircle2 size={11} />,                     text: "Guardado",   cls: "text-emerald-400" },
    error:  { icon: <AlertCircle  size={11} />,                     text: "Error",      cls: "text-red-400" },
  }[status];
  return (
    <span className={`flex items-center gap-1 text-micro font-black uppercase tracking-widest ${map.cls}`}>
      {map.icon} {map.text}
    </span>
  );
}

export function Campo({ label, value, onChange, placeholder }: {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35">{label}</label>
      <input className={INPUT_CLS} placeholder={placeholder} value={value} onChange={onChange} />
    </div>
  );
}

export function CampoArea({ label, value, onChange, placeholder, rows = 4 }: {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string; rows?: number;
}) {
  const { onWikilink } = useWikilink();
  const handleChange = (v: string) => {
    onChange({ target: { value: v } } as React.ChangeEvent<HTMLTextAreaElement>);
  };
  return (
    <div className="space-y-1.5">
      <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35">{label}</label>
      <RichEditor minHeight={`${rows * 1.6}rem`} mode="split" placeholder={placeholder} value={value} onChange={handleChange} onWikilinkNavigate={onWikilink} />
    </div>
  );
}

export function BarraAcciones({ status, onSave, onDelete }: {
  status: SaveStatus; onSave: () => void; onDelete: () => void;
}) {
  return (
    <div
      className="shrink-0 sticky bottom-0 z-10 px-4 py-3 flex items-center justify-between gap-3 border-t border-primary/8"
      style={{ background: "color-mix(in srgb, var(--bg-main) 95%, transparent)", backdropFilter: "blur(8px)" }}
    >
      <SaveIndicator status={status} />
      <div className="flex items-center gap-2 ml-auto">
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-micro font-black uppercase tracking-widest border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all min-h-[36px]"
          onClick={onDelete}>
          <Trash2 size={11} /> <span className="hidden xs:inline">Eliminar</span>
        </button>
        <button className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 min-h-[36px]"
          onClick={onSave}>
          <Save size={11} /> Guardar
        </button>
      </div>
    </div>
  );
}

export function SelectorImagen({ label, value, onChange, aspect, placeholder }: {
  label: string; value: string; onChange: (url: string) => void;
  aspect: "square" | "portrait" | "landscape" | "video" | "full"; placeholder?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const aspectCls =
    aspect === "square"    ? "aspect-square" :
    aspect === "portrait"  ? "aspect-[3/4]"  :
    aspect === "landscape" ? "aspect-video"  :
    aspect === "full"      ? "h-full"        :
    "aspect-video";

  const fitCls = aspect === "landscape" ? "object-contain" : "object-cover";

  return (
    <div className={`flex flex-col gap-1.5 ${aspect === "full" ? "h-full" : ""}`}>
      {label && <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35 shrink-0">{label}</label>}

      <div
        className={`relative ${aspectCls} ${aspect === "full" ? "flex-1" : ""} rounded-none overflow-hidden border-0 bg-primary/4 cursor-pointer group`}
        onClick={() => setOpen(true)}
      >
        {value ? (
          <>
            <Image alt={label} className={`w-full h-full ${fitCls} transition-transform duration-300 group-hover:scale-105`} src={value} />
            <div className="absolute inset-0 bg-black/40 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
              <ImageIcon className="text-white" size={18} />
              <span className="text-micro font-black uppercase text-white tracking-widest">Cambiar</span>
            </div>
            <button
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 hover:bg-red-500/80 flex items-center justify-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all"
              onClick={e => { e.stopPropagation(); onChange(""); }}
            >
              <X className="text-white" size={10} />
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-primary/20 hover:text-primary/40 transition-colors">
            {placeholder ?? <ImageIcon size={24} />}
            <span className="text-micro font-black uppercase tracking-widest">Elegir imagen</span>
          </div>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white-custom rounded-t-2xl sm:rounded-2xl shadow-2xl border border-primary/15 w-full sm:max-w-lg p-5 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-micro font-black uppercase tracking-[0.3em] text-primary/50 flex items-center gap-2">
                <ImageIcon size={11} /> {label}
              </h3>
              <button className="text-primary/30 hover:text-primary transition-colors" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <SimpleImagePicker
              onClose={() => setOpen(false)}
              onSelect={url => { onChange(url); setOpen(false); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function SelectorTexto({ label, value, onChange, opciones, placeholder, onNavigate }: {
  label: string; value: string; onChange: (v: string) => void;
  opciones: string[]; placeholder?: string;
  onNavigate?: (nombre: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const [open,    setOpen]    = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ref      = useRef<HTMLDivElement>(null);

  useEffect(() => { setDraft(value); setEditing(false); setOpen(false); }, [value]);

  // Cerrar al clickear fuera
  useEffect(() => {
    if (!editing) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) commit();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [editing, draft]);

  const startEdit = () => {
    setDraft(value);
    setEditing(true);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const commit = () => {
    const trimmed = draft.trim();
    onChange(trimmed); // vacío limpia el valor
    setEditing(false);
    setOpen(false);
  };

  const select = (v: string) => { setDraft(v); onChange(v); setEditing(false); setOpen(false); };

  const filtradas = useMemo(
    () => opciones.filter(o => normalize(o).includes(normalize(draft))),
    [opciones, draft]
  );

  return (
    <div ref={ref} className="space-y-1">
      <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35">{label}</label>

      {editing ? (
        /* ── Modo edición: input + dropdown ── */
        <div className="relative">
          <input
            ref={inputRef}
            className={INPUT_CLS + " pr-7"}
            placeholder={placeholder}
            value={draft}
            onChange={e => { setDraft(e.target.value); setOpen(true); }}
            onKeyDown={e => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setDraft(value); setEditing(false); setOpen(false); }
            }}
          />
          <button
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary/30 hover:text-primary transition-colors"
            type="button"
            onMouseDown={e => { e.preventDefault(); commit(); }}
          >
            <X size={10} />
          </button>

          {open && (filtradas.length > 0 || (draft.trim() && !opciones.includes(draft.trim()))) && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white-custom border border-primary/15 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
              {/* Opción quitar si hay valor */}
              {value && (
                <button
                  className="w-full px-3 py-2 text-left text-micro font-bold text-red-400/60 hover:text-red-400 hover:bg-red-400/5 transition-colors border-b border-primary/8 italic"
                  onMouseDown={e => { e.preventDefault(); select(""); }}
                >
                  Quitar {label.toLowerCase()}
                </button>
              )}
              {filtradas.map(o => (
                <button key={o} className={`w-full px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-primary/8 hover:text-primary ${o === value ? "text-primary bg-primary/5" : "text-primary/70"}`}
                  onMouseDown={() => select(o)}>
                  {o}
                </button>
              ))}
              {draft.trim() && !opciones.includes(draft.trim()) && (
                <button className="w-full px-3 py-2 text-left text-xs font-medium text-primary/40 hover:bg-primary/5 transition-colors italic"
                  onMouseDown={() => select(draft.trim())}>
                  Usar &quot;{draft.trim()}&quot;
                </button>
              )}
            </div>
          )}
        </div>
      ) : value ? (
        /* ── Modo display: chip link + botón lápiz ── */
        <div className="flex items-center gap-1">
          <button
            className="flex-1 min-w-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-micro font-bold text-left transition-all border"
            style={{
              background: "color-mix(in srgb, var(--primary) 5%, transparent)",
              borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
              color: "var(--primary)",
              cursor: onNavigate ? "pointer" : "default",
            }}
            type="button"
            onClick={() => { onNavigate?.(value); }}
            onMouseEnter={e => {
              if (!onNavigate) return;
              (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--accent) 8%, transparent)";
              (e.currentTarget as HTMLElement).style.borderColor = "color-mix(in srgb, var(--accent) 22%, transparent)";
              (e.currentTarget as HTMLElement).style.color = "var(--accent)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--primary) 5%, transparent)";
              (e.currentTarget as HTMLElement).style.borderColor = "color-mix(in srgb, var(--primary) 12%, transparent)";
              (e.currentTarget as HTMLElement).style.color = "var(--primary)";
            }}
          >
            <span className="truncate flex-1">{value}</span>
            {onNavigate && <ExternalLink className="shrink-0 opacity-35" size={9} />}
          </button>
          <button
            className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center border border-transparent text-primary/25 hover:text-primary hover:bg-primary/8 hover:border-primary/15 transition-all"
            title={`Editar ${label.toLowerCase()}`}
            type="button"
            onClick={startEdit}
          >
            <Pencil size={9} />
          </button>
        </div>
      ) : (
        /* ── Modo vacío: placeholder como botón ── */
        <button
          className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-micro font-bold text-left transition-all border border-dashed"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
            color: "color-mix(in srgb, var(--primary) 25%, transparent)",
          }}
          type="button"
          onClick={startEdit}
        >
          <Pencil className="opacity-50" size={9} />
          <span className="italic">{placeholder}</span>
        </button>
      )}
    </div>
  );
}