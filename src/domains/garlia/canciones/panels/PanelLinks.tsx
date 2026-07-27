"use client";

import {
  Link2,
  ChevronDown,
  ExternalLink,
  Pencil,
  Trash2,
  Loader2,
  Check,
} from "lucide-react";
import React, { useState } from "react";

import { useConfirm } from "@/components/ui/ConfirmModal";
import type { CancionLink } from "@/domains/garlia/canciones/types";
import { supabase } from "@/infra/supabase/supabase";

export const PanelLinks = ({
  cancionId,
  links,
  onLinksChange,
}: {
  cancionId: string;
  links: CancionLink[];
  onLinksChange: (links: CancionLink[]) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const { confirm, ConfirmModal } = useConfirm();

  const saveLinks = async (newLinks: CancionLink[]) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("canciones")
        .update({ links: newLinks })
        .eq("id", cancionId);
      if (error) throw error;
      onLinksChange(newLinks);
    } catch (e) {
      console.error("Links:", e);
    }
    setSaving(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !url.trim()) return;
    const newLink = { titulo: titulo.trim(), url: url.trim() };
    const updated = [...links];
    if (editIdx !== null) updated[editIdx] = newLink;
    else updated.push(newLink);
    await saveLinks(updated);
    setTitulo("");
    setUrl("");
    setEditIdx(null);
  };

  const handleEdit = (i: number) => {
    setTitulo(links[i].titulo);
    setUrl(links[i].url);
    setEditIdx(i);
    setOpen(true);
  };

  const handleDelete = async (i: number) => {
    const ok = await confirm({
      message: `¿Eliminar "${links[i].titulo}"?`,
      danger: true,
    });
    if (!ok) return;
    await saveLinks(links.filter((_, idx) => idx !== i));
  };

  const handleCancel = () => {
    setTitulo("");
    setUrl("");
    setEditIdx(null);
  };

  return (
    <div className="border-t border-primary/8 px-8 py-3">
      <button
        className="flex items-center gap-2 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors w-full"
        onClick={() => setOpen((o) => !o)}
      >
        <Link2 size={12} />
        Enlaces
        {links.length > 0 && (
          <span className="bg-primary/10 text-primary/60 rounded-full px-2 py-0.5 text-micro">
            {links.length}
          </span>
        )}
        <ChevronDown
          className={`ml-auto transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          size={11}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {links.length > 0 && (
            <div className="space-y-1.5">
              {links.map((link, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <a
                    className="flex-1 flex items-center gap-1.5 text-micro font-bold text-primary/60 hover:text-primary transition-colors truncate min-w-0"
                    href={link.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <ExternalLink className="shrink-0" size={10} />
                    <span className="truncate">{link.titulo}</span>
                  </a>
                  <button
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-primary/10 text-primary/30 hover:text-primary transition-all"
                    onClick={() => handleEdit(i)}
                  >
                    <Pencil size={10} />
                  </button>
                  <button
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[color-mix(in_srgb,var(--callout-danger-border)_10%,transparent)] text-primary/20 hover:text-[var(--callout-danger-border)] transition-all"
                    onClick={() => handleDelete(i)}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form className="space-y-2 pt-1" onSubmit={handleSubmit}>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-primary/5 border border-primary/15 rounded-xl px-3 py-2 text-micro font-medium text-primary outline-none focus:border-primary/40 transition-colors placeholder:text-primary/25"
                placeholder="Título del enlace…"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
              <input
                className="flex-1 bg-primary/5 border border-primary/15 rounded-xl px-3 py-2 text-micro font-medium text-primary outline-none focus:border-primary/40 transition-colors placeholder:text-primary/25"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-bg-main rounded-xl text-micro font-black uppercase tracking-widest disabled:opacity-40 hover:opacity-90 transition-all"
                disabled={!titulo.trim() || !url.trim() || saving}
                type="submit"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={11} />
                ) : (
                  <Check size={11} />
                )}
                {editIdx !== null ? "Guardar" : "Añadir"}
              </button>
              {editIdx !== null && (
                <button
                  className="px-3 py-2 rounded-xl border border-primary/15 text-micro font-black uppercase text-primary/40 hover:text-primary hover:border-primary/30 transition-all"
                  type="button"
                  onClick={handleCancel}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      )}
      <ConfirmModal />
    </div>
  );
};
