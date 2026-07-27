"use client";

import { Pencil, X, Eye, EyeOff, Loader2, Check } from "lucide-react";
import React, { useState } from "react";

import { ModalBase, CampoInput } from "@/components/layout/EstudioTemplates";
import { ESTADOS } from "@/domains/garlia/canciones/constants";
import type { Cancion } from "@/domains/garlia/canciones/types";
import { SelectPersonaje, SelectIdioma } from "@/hooks/useEditorShared";
import { supabase } from "@/lib/api/client/supabase";


import { InputConSugerencias } from "../InputConSugerencias";

export const ModalEditarCancion = ({
  cancion,
  onSaved,
  onClose,
}: {
  cancion: Cancion;
  onSaved: (c: Cancion) => void;
  onClose: () => void;
}) => {
  const [titulo,      setTitulo]      = useState(cancion.titulo);
  const [personajeId, setPersonajeId] = useState<string | null>(
    cancion.personaje_id ?? (Array.isArray(cancion.personaje) ? cancion.personaje[0]?.id : cancion.personaje?.id) ?? null
  );
  const [cantante,    setCantante]    = useState(cancion.cantante   || "");
  const [compositor,  setCompositor]  = useState(cancion.compositor || "");
  const [idioma,      setIdioma]      = useState(cancion.idioma     || "");
  const [estado,      setEstado]      = useState<Cancion["estado"]>(cancion.estado);
  const [visible,     setVisible]     = useState(cancion.visible);
  const [duracionStr, setDuracionStr] = useState(() => {
    const d = cancion.duracion_segundos;
    if (!d) return "";
    const m = Math.floor(d / 60);
    const s = d % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const parseDuracion = (str: string): number | null => {
    if (!str.trim()) return null;
    const parts = str.split(":");
    if (parts.length === 2) {
      const m = parseInt(parts[0]);
      const s = parseInt(parts[1]);
      if (!isNaN(m) && !isNaN(s)) return m * 60 + s;
    }
    const plain = parseInt(str);
    return isNaN(plain) ? null : plain;
  };

  const handleSave = async () => {
    if (!titulo.trim()) return;
    setSaving(true);
    setError("");
    try {
      const updates: any = {
        titulo: titulo.trim().toUpperCase(),
        personaje_id: personajeId || null,
        cantante:   cantante.trim()   || null,
        compositor: compositor.trim() || null,
        idioma:     idioma.trim()     || null,
        estado,
        visible,
        duracion_segundos: parseDuracion(duracionStr),
      };
      const { data, error: err } = await supabase
        .from("canciones")
        .update(updates)
        .eq("id", cancion.id)
        .select()
        .single();
      if (err) throw err;
      onSaved(data as Cancion);
      onClose();
    } catch (e: any) {
      setError(e.message || "Error al guardar");
    }
    setSaving(false);
  };

  return (
    <ModalBase onClose={onClose}>
      <div className="flex items-center justify-between">
        <h3 className="text-micro font-black uppercase tracking-[0.3em] text-primary/50 italic flex items-center gap-2">
          <Pencil size={12} /> Editar Canción
        </h3>
        <button className="text-primary/30 hover:text-primary transition-colors" type="button" onClick={onClose}><X size={16} /></button>
      </div>

      <div className="space-y-4 mt-4">
        <CampoInput autoFocus label="Título *" placeholder="NOMBRE DE LA CANCIÓN…" value={titulo} onChange={setTitulo} />
        <SelectPersonaje value={personajeId ?? ""} onChange={v => setPersonajeId(v || null)} />
        <div className="grid grid-cols-2 gap-3">
          <InputConSugerencias columna="cantante"   label="Cantante"   placeholder="Cantante…"   tabla="canciones"   value={cantante} onChange={setCantante} />
          <InputConSugerencias columna="compositor" label="Compositor" placeholder="Compositor…" tabla="canciones" value={compositor} onChange={setCompositor} />
        </div>
        <SelectIdioma value={idioma} onChange={setIdioma} />

        <div className="space-y-1.5">
          <label className="text-micro font-black uppercase text-primary/30 tracking-widest">Duración (mm:ss)</label>
          <input
            className="w-full bg-primary/5 border border-primary/15 rounded-xl px-3 py-2 text-micro font-bold text-primary outline-none focus:border-primary/30 transition-colors placeholder:text-primary/20"
            placeholder="3:42"
            type="text"
            value={duracionStr}
            onChange={e => setDuracionStr(e.target.value)}
          />
          <p className="text-micro text-primary/25 font-bold uppercase tracking-widest">
            Usado para el slider del karaoke · formato min:seg
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-micro font-black uppercase text-primary/30 tracking-widest">Estado</label>
          <div className="flex gap-2">
            {ESTADOS.map(e => (
              <button
                key={e}
                className={`flex-1 py-2 rounded-xl text-micro font-black uppercase tracking-widest border transition-all ${
                  estado === e ? "bg-primary text-bg-main border-primary" : "border-primary/15 text-primary/40 hover:border-primary/30 hover:text-primary"
                }`}
                type="button"
                onClick={() => setEstado(e)}
              >
                {e === "EN PROCESO" ? "WIP" : e}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-micro font-black uppercase text-primary/30 tracking-widest">Visibilidad</label>
          <button
            className={`w-full py-2.5 rounded-xl text-micro font-black uppercase tracking-widest border flex items-center justify-center gap-2 transition-all ${
              visible
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "border-primary/15 text-primary/40 hover:border-primary/30 hover:text-primary"
            }`}
            type="button"
            onClick={() => setVisible(v => !v)}
          >
            {visible ? <><Eye size={12} /> Visible para lectores</> : <><EyeOff size={12} /> Oculta</>}
          </button>
        </div>

        {error && <p className="text-micro font-black uppercase text-red-400 tracking-widest">⚠ {error}</p>}

        <button
          className="w-full bg-primary text-bg-main py-3 rounded-xl text-micro font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          disabled={saving || !titulo.trim()}
          type="button"
          onClick={handleSave}
        >
          {saving
            ? <><Loader2 className="animate-spin" size={13} />Guardando…</>
            : <><Check size={13} />Guardar Cambios</>
          }
        </button>
      </div>
    </ModalBase>
  );
};