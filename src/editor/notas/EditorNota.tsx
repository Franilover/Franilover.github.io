"use client";

import {
  FileText,
  Save,
  Trash2,
  Loader2,
  Tag,
  X,
  Plus,
  Check,
} from "lucide-react";
import React, { useState, useEffect, useRef, useCallback } from "react";

import { RichEditor } from "@/editor/lexical";
import { useConfirm } from "@/components/ui/ConfirmModal";

import { SaveIndicator } from "@/domains/garlia/_shared/UIComponents";
import { useWikilink } from "@/domains/garlia/_shared/WikilinkContext";
import type { SaveStatus, Nota } from "@/domains/garlia/_shared/types";

// ─── Etiqueta chip ────────────────────────────────────────────────────────────
function EtiquetaChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-micro font-black uppercase tracking-widest border transition-all"
      style={{
        background: "color-mix(in srgb, var(--primary) 8%, transparent)",
        borderColor: "color-mix(in srgb, var(--primary) 14%, transparent)",
        color: "color-mix(in srgb, var(--primary) 55%, transparent)",
      }}
    >
      {label}
      <button
        className="w-3 h-3 rounded-full flex items-center justify-center hover:text-red-400 transition-colors"
        type="button"
        onClick={onRemove}
      >
        <X size={7} />
      </button>
    </span>
  );
}

// ─── EditorNota ───────────────────────────────────────────────────────────────
export function EditorNota({
  nota,
  onSaved,
  onDeleted,
}: {
  nota: Nota;
  onSaved: (n: Nota) => void | Promise<void>;
  onDeleted: (id: string) => void;
}) {
  const [form, setForm] = useState<Nota>(nota);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [etiquetaInput, setEtiquetaInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const { confirm, ConfirmModal } = useConfirm();
  const { onWikilink } = useWikilink();

  // Sync cuando cambia la nota seleccionada
  useEffect(() => {
    setForm(nota);
    setStatus("idle");
    setEtiquetaInput("");
    setShowTagInput(false);
  }, [nota.id]);

  // Parsear etiquetas
  const etiquetas: string[] = (() => {
    try {
      return JSON.parse(form.etiquetas ?? "[]");
    } catch {
      return [];
    }
  })();

  const setEtiquetas = useCallback((tags: string[]) => {
    setForm((f) => ({ ...f, etiquetas: JSON.stringify(tags) }));
  }, []);

  const addTag = useCallback(() => {
    const tag = etiquetaInput.trim().toLowerCase();
    if (!tag || etiquetas.includes(tag)) {
      setEtiquetaInput("");
      return;
    }
    setEtiquetas([...etiquetas, tag]);
    setEtiquetaInput("");
    setShowTagInput(false);
  }, [etiquetaInput, etiquetas, setEtiquetas]);

  const removeTag = useCallback(
    (tag: string) => {
      setEtiquetas(etiquetas.filter((t) => t !== tag));
    },
    [etiquetas, setEtiquetas],
  );

  // Guardar
  const handleSave = async () => {
    setStatus("saving");
    try {
      await onSaved(form);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  };

  // Eliminar
  const handleDelete = async () => {
    const ok = await confirm({
      title: "¿Eliminar nota?",
      message: `Esto eliminará "${form.titulo}" de forma permanente.`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    onDeleted(nota.id);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <ConfirmModal />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex flex-col gap-2 px-4 py-3 border-b"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
          background: "color-mix(in srgb, var(--primary) 2%, transparent)",
        }}
      >
        {/* Título editable */}
        <input
          className="w-full bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25 border-b border-transparent focus:border-primary/15 pb-0.5 transition-colors"
          placeholder="Título de la nota…"
          value={form.titulo}
          onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
        />

        {/* Etiquetas */}
        <div className="flex flex-wrap items-center gap-1 min-h-[22px]">
          <Tag className="text-primary/25 shrink-0" size={9} />
          {etiquetas.map((tag) => (
            <EtiquetaChip
              key={tag}
              label={tag}
              onRemove={() => removeTag(tag)}
            />
          ))}

          {showTagInput ? (
            <div className="flex items-center gap-1">
              <input
                ref={tagInputRef}
                autoFocus
                className="w-24 bg-primary/5 border border-primary/15 rounded-lg px-2 py-0.5 text-micro font-medium outline-none focus:border-primary/30 text-primary placeholder:text-primary/25"
                placeholder="Nueva etiqueta…"
                value={etiquetaInput}
                onBlur={(e) => {
                  if (
                    e.relatedTarget instanceof HTMLButtonElement &&
                    e.relatedTarget.dataset.addtag
                  )
                    return;
                  addTag();
                  setShowTagInput(false);
                }}
                onChange={(e) => setEtiquetaInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                  if (e.key === "Escape") {
                    setShowTagInput(false);
                    setEtiquetaInput("");
                  }
                }}
              />
              <button
                className="w-4 h-4 rounded flex items-center justify-center text-primary/30 hover:text-primary transition-colors"
                data-addtag="true"
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag();
                }}
              >
                <Check size={9} />
              </button>
            </div>
          ) : (
            <button
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-micro font-black uppercase tracking-widest border border-dashed transition-all text-primary/25 hover:text-primary/50"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 10%, transparent)",
              }}
              type="button"
              onClick={() => setShowTagInput(true)}
            >
              <Plus size={7} /> Tag
            </button>
          )}
        </div>
      </div>

      {/* ── Contenido — Markdown ────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5">
        <RichEditor
          minHeight="30rem"
          mode="edit"
          placeholder="Escribe tu nota aquí… Ideas, referencias, fragmentos, recordatorios…"
          showSplitMode={false}
          value={form.contenido ?? ""}
          onChange={(v) => setForm((f) => ({ ...f, contenido: v }))}
          onWikilinkNavigate={onWikilink}
        />
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-t"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
        }}
      >
        {/* Eliminar */}
        <button
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-micro font-black uppercase tracking-widest border border-red-400/20 text-red-400/50 hover:text-red-400 hover:border-red-400/40 hover:bg-red-400/5 transition-all"
          onClick={handleDelete}
        >
          <Trash2 size={10} /> Eliminar
        </button>

        {/* Guardar */}
        <div className="flex items-center gap-1.5">
          <SaveIndicator status={status} />
          <button
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
            disabled={status === "saving"}
            onClick={handleSave}
          >
            {status === "saving" ? (
              <Loader2 className="animate-spin" size={10} />
            ) : (
              <Save size={10} />
            )}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ListaNotas: panel lateral izquierdo de notas ────────────────────────────
export function ListaNotas({
  notas,
  loading,
  selectedId,
  search,
  onSearch,
  onSelect,
  onNew,
}: {
  notas: Nota[];
  loading: boolean;
  selectedId: string | null;
  search: string;
  onSearch: (v: string) => void;
  onSelect: (n: Nota) => void;
  onNew: () => void;
}) {
  const filtered = notas.filter(
    (n) =>
      n.titulo.toLowerCase().includes(search.toLowerCase()) ||
      (n.contenido ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (n.etiquetas ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  // Parsear etiquetas rápido
  const getTags = (n: Nota): string[] => {
    try {
      return JSON.parse(n.etiquetas ?? "[]");
    } catch {
      return [];
    }
  };

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* Buscador + botón nuevo */}
      <div
        className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
        }}
      >
        <div className="relative flex-1">
          <input
            className="w-full bg-primary/4 border border-primary/10 rounded-xl pl-2.5 pr-5 py-1.5 text-micro font-medium outline-none focus:border-primary/25 text-primary placeholder:text-primary/25"
            placeholder="Buscar notas…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-primary/25 hover:text-primary transition-colors"
              onClick={() => onSearch("")}
            >
              <X size={8} />
            </button>
          )}
        </div>
        <button
          className="shrink-0 w-7 h-7 rounded-xl flex items-center justify-center transition-all border"
          style={{
            background: "color-mix(in srgb, var(--primary) 8%, transparent)",
            borderColor: "color-mix(in srgb, var(--primary) 14%, transparent)",
            color: "var(--primary)",
          }}
          title="Nueva nota"
          onClick={onNew}
        >
          <Plus size={11} />
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2 py-2 space-y-0.5">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-primary/20" size={16} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <FileText className="text-primary/15" size={20} strokeWidth={1} />
            <p className="text-micro font-black uppercase tracking-widest text-primary/20">
              {search ? "Sin resultados" : "Sin notas aún"}
            </p>
            {!search && (
              <button
                className="mt-1 text-micro font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border border-dashed transition-all text-primary/30 hover:text-primary/60"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--primary) 12%, transparent)",
                }}
                onClick={onNew}
              >
                Crear primera nota
              </button>
            )}
          </div>
        ) : (
          filtered.map((n) => {
            const tags = getTags(n);
            const isSelected = n.id === selectedId;
            return (
              <button
                key={n.id}
                className="w-full text-left px-3 py-2.5 rounded-xl border transition-all group"
                style={
                  isSelected
                    ? {
                        background:
                          "color-mix(in srgb, var(--primary) 10%, transparent)",
                        borderColor:
                          "color-mix(in srgb, var(--primary) 20%, transparent)",
                      }
                    : {
                        background: "transparent",
                        borderColor: "transparent",
                      }
                }
                onClick={() => onSelect(n)}
              >
                <p
                  className={`text-micro font-bold truncate transition-colors ${
                    isSelected
                      ? "text-primary"
                      : "text-primary/70 group-hover:text-primary/90"
                  }`}
                >
                  {n.titulo || (
                    <span className="italic text-primary/30">Sin título</span>
                  )}
                </p>
                {/* Preview del contenido */}
                {n.contenido?.trim() && (
                  <p className="text-micro text-primary/35 truncate mt-0.5 leading-tight">
                    {n.contenido
                      .replace(/#+\s|[*_`]/g, "")
                      .trim()
                      .slice(0, 80)}
                  </p>
                )}
                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-1 py-0 rounded text-micro font-black uppercase tracking-wider"
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary) 7%, transparent)",
                          color:
                            "color-mix(in srgb, var(--primary) 40%, transparent)",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                    {tags.length > 3 && (
                      <span className="text-micro text-primary/25">
                        +{tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
