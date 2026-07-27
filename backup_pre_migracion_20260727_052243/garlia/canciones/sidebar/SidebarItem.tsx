"use client";

import { Eye, EyeOff, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";

import { useConfirm } from "@/components/ui/ConfirmModal";
import { ESTADO_COLOR } from "@/domains/garlia/canciones/constants";
import type { Cancion } from "@/domains/garlia/canciones/types";
import { supabase } from "@/lib/api/client/supabase";

export const SidebarItem = ({
  cancion, selected, onClick, onEdit, onDelete, onToggleVisible,
}: {
  cancion: Cancion;
  selected: boolean;
  onClick: () => void;
  onEdit: (c: Cancion) => void;
  onDelete: (id: string) => void;
  onToggleVisible: (id: string, visible: boolean) => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { confirm, ConfirmModal } = useConfirm();

  const handleToggleVisible = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (toggling) return;
    setToggling(true);
    const nuevoVisible = !cancion.visible;
    try {
      await supabase.from("canciones").update({ visible: nuevoVisible }).eq("id", cancion.id);
      onToggleVisible(cancion.id, nuevoVisible);
    } finally {
      setToggling(false);
    }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div className="relative group/item">
      <button
        className={`w-full text-left px-4 py-3 rounded-xl transition-all border ${
          selected
            ? "bg-primary text-bg-main border-primary shadow-lg shadow-primary/20"
            : "border-transparent hover:bg-primary/5 hover:border-primary/10 text-primary"
        }`}
        onClick={onClick}
      >
        <div className="flex items-start justify-between gap-2">
          <span className={`font-black text-sm uppercase italic tracking-tight leading-tight truncate flex-1 ${selected ? "text-bg-main" : ""}`}>
            {cancion.titulo}
          </span>
          <span className={`shrink-0 text-micro font-black uppercase px-2 py-1 rounded-full border ${
            selected ? "bg-bg-main/20 text-bg-main border-bg-main/30" : ESTADO_COLOR[cancion.estado]
          }`}>
            {cancion.estado === "EN PROCESO" ? "WIP" : cancion.estado === "TERMINADA" ? "✓" : "…"}
          </span>
        </div>
        {(() => {
          const p = cancion.personaje;
          const nombre = (Array.isArray(p) ? p[0]?.nombre : p?.nombre) || cancion.cantante;
          return nombre ? (
            <p className={`text-micro mt-1 truncate ${selected ? "text-bg-main/70" : "text-primary/40"}`}>
              {nombre}
            </p>
          ) : null;
        })()}
      </button>

      {/* Toggle visible */}
      <button
        className={`absolute top-2 right-8 p-1 rounded-lg transition-all z-10 ${
          !cancion.visible
            ? selected ? "opacity-80 text-bg-main/60" : "opacity-100 text-primary/30"
            : selected
              ? "opacity-0 group-hover/item:opacity-60 hover:!opacity-100 text-bg-main hover:bg-bg-main/20"
              : "opacity-0 group-hover/item:opacity-100 text-primary/50 hover:bg-primary/10 hover:text-primary"
        }`}
        title={cancion.visible ? "Ocultar canción" : "Mostrar canción"}
        onClick={handleToggleVisible}
      >
        {toggling
          ? <Loader2 className="animate-spin" size={13} />
          : cancion.visible ? <Eye size={13} /> : <EyeOff size={13} />
        }
      </button>

      {/* Context menu */}
      <div ref={menuRef} className="absolute top-2 right-2">
        <button
          className={`p-1 rounded-lg transition-all z-10 ${
            menuOpen
              ? "bg-primary/20 text-primary opacity-100"
              : selected
                ? "opacity-60 hover:opacity-100 text-bg-main hover:bg-bg-main/20"
                : "opacity-0 group-hover/item:opacity-100 text-primary/50 hover:bg-primary/10 hover:text-primary"
          }`}
          onClick={e => { e.stopPropagation(); setMenuOpen(m => !m); }}
        >
          <MoreHorizontal size={13} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-7 z-50 min-w-[160px] bg-bg-main border border-primary/15 rounded-xl shadow-xl shadow-primary/10 py-1 overflow-hidden">
            <button
              className="w-full text-left px-3 py-2 text-micro font-black uppercase tracking-widest text-primary/60 hover:bg-primary/8 hover:text-primary transition-all flex items-center gap-2"
              onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit(cancion); }}
            >
              <Pencil size={11} /> Editar canción
            </button>
            <div className="h-px bg-primary/8 mx-2 my-1" />
            <button
              className="w-full text-left px-3 py-2 text-micro font-black uppercase tracking-widest text-red-400/70 hover:bg-red-500/8 hover:text-red-400 transition-all flex items-center gap-2"
              onClick={async e => {
                e.stopPropagation();
                setMenuOpen(false);
                const ok = await confirm({ message: `¿Eliminar "${cancion.titulo}"?`, danger: true });
                if (ok) onDelete(cancion.id);
              }}
            >
              <Trash2 size={11} /> Eliminar
            </button>
          </div>
        )}
      </div>
      <ConfirmModal />
    </div>
  );
};