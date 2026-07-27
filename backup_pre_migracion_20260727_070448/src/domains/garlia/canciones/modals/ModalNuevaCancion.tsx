"use client";

import { Music, X, Loader2, Plus } from "lucide-react";
import React, { useState } from "react";

import { ModalBase, CampoInput, BotonSubmit } from "@/layout/EstudioTemplates";
import { ESTADOS } from "@/domains/garlia/canciones/constants";
import type { Cancion } from "@/domains/garlia/canciones/types";
import { SelectPersonaje, SelectIdioma } from "@/hooks/useEditorShared";
import { supabase } from "@/infra/supabase/supabase";


import { InputConSugerencias } from "../InputConSugerencias";

export const ModalNuevaCancion = ({
  onCreated,
  onClose,
}: {
  onCreated: (c: Cancion) => void;
  onClose: () => void;
}) => {
  const [titulo,     setTitulo]     = useState("");
  const [personajeId, setPersonajeId] = useState<string | null>(null);
  const [cantante,   setCantante]   = useState("");
  const [compositor, setCompositor] = useState("");
  const [idioma,     setIdioma]     = useState("");
  const [estado,     setEstado]     = useState<Cancion["estado"]>("BORRADOR");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;
    setSaving(true);
    setError("");
    try {
      const { data, error: err } = await supabase
        .from("canciones")
        .insert([{
          titulo: titulo.trim().toUpperCase(),
          personaje_id: personajeId || null,
          cantante:   cantante.trim()   || null,
          compositor: compositor.trim() || null,
          idioma:     idioma.trim()     || null,
          estado,
          visible: false,
        }])
        .select()
        .single();
      if (err) throw err;
      onCreated(data as Cancion);
      onClose();
    } catch (e: any) {
      setError(e.message || "Error al crear la canción");
    }
    setSaving(false);
  };

  return (
    <ModalBase onClose={onClose}>
      <div className="flex items-center justify-between">
        <h3 className="text-micro font-black uppercase tracking-[0.3em] text-primary/50 italic flex items-center gap-2">
          <Music size={12} /> Nueva Canción
        </h3>
        <button className="text-primary/30 hover:text-primary transition-colors" onClick={onClose}><X size={16} /></button>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <CampoInput autoFocus label="Título *" placeholder="NOMBRE DE LA CANCIÓN…" value={titulo} onChange={setTitulo} />
        <SelectPersonaje value={personajeId ?? ""} onChange={v => setPersonajeId(v || null)} />
        <div className="grid grid-cols-2 gap-3">
          <InputConSugerencias columna="cantante"   label="Cantante"   placeholder="Cantante…"   tabla="canciones"   value={cantante} onChange={setCantante} />
          <InputConSugerencias columna="compositor" label="Compositor" placeholder="Compositor…" tabla="canciones" value={compositor} onChange={setCompositor} />
        </div>
        <SelectIdioma value={idioma} onChange={setIdioma} />

        <div className="space-y-1.5">
          <label className="text-micro font-black uppercase text-primary/30 tracking-widest">Estado</label>
          <div className="flex gap-2">
            {ESTADOS.map(e => (
              <button
                key={e} className={`flex-1 py-2 rounded-xl text-micro font-black uppercase tracking-widest border transition-all ${
                  estado === e ? "bg-primary text-bg-main border-primary" : "border-primary/15 text-primary/40 hover:border-primary/30"
                }`}
                type="button"
                onClick={() => setEstado(e)}
              >
                {e === "EN PROCESO" ? "WIP" : e}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-micro font-black uppercase text-red-400 tracking-widest">⚠ {error}</p>}

        <BotonSubmit
          disabled={!titulo.trim()}
          labelLoading={<><Loader2 className="animate-spin" size={13} />Creando…</>}
          labelNormal={<><Plus size={13} />Crear Canción</>}
          loading={saving}
        />
      </form>
    </ModalBase>
  );
};