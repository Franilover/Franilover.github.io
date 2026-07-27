"use client";
import { Edit3, Save, X } from 'lucide-react';
import { useState, useEffect } from 'react';

import { supabase } from '@/infra/supabase/supabase';

import { useLightbox } from '../LightboxProvider';

export const AdminControls = () => {
  const { selectedImg, updateGalleryItem, currentIndex, tableContext } = useLightbox();
  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [nuevoTitulo, setNuevoTitulo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: perfil } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", session.user.id)
        .single();

      setIsAdmin(perfil?.rol === "admin");
    };
    void checkAdmin();
  }, []);

  useEffect(() => {
    if (selectedImg) setNuevoTitulo(selectedImg.alt || "");
  }, [selectedImg]);

  const handleUpdate = async () => {
    if (!selectedImg?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from(tableContext)
        .update({ titulo: nuevoTitulo })
        .eq('id', selectedImg.id);
      if (error) throw error;
      updateGalleryItem(currentIndex, nuevoTitulo);
      setEditMode(false);
    } catch (_err) {
      alert("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) return <h2 className="text-white text-micro font-black uppercase tracking-[0.4em]">{selectedImg?.alt}</h2>;

  return (
    <div className="flex items-center gap-3">
      {editMode ? (
        <>
          <input
            className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-micro uppercase font-black"
            value={nuevoTitulo}
            onChange={(e) => setNuevoTitulo(e.target.value)}
          />
          <button className="text-green-400" disabled={saving} onClick={handleUpdate}><Save size={16}/></button>
          <button className="text-red-400" onClick={() => setEditMode(false)}><X size={16}/></button>
        </>
      ) : (
        <>
          <h2 className="text-white text-micro font-black uppercase tracking-[0.4em]">{selectedImg?.alt}</h2>
          <button className="p-1 hover:bg-white/10 rounded" onClick={() => setEditMode(true)}><Edit3 size={14}/></button>
        </>
      )}
    </div>
  );
};
