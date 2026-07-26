"use client";

/**
 * usePersonajeForm.ts
 * ─────────────────────
 * Estado del formulario de edición de un personaje + guardado y
 * borrado (Supabase + Dexie). La view solo conecta esto con la UI.
 *
 * Ruta: src/features/editorGarlia/hooks/usePersonajeForm.ts
 */

import { useEffect, useState } from "react";

import { supabase } from "@/lib/api/client/supabase";
import { dexieDelete, dexiePut } from "@/lib/utils/dexieHelpers";

import { type Personaje, type SaveStatus } from "../types";

export function usePersonajeForm(
  item: Personaje,
  onSaved: (p: Personaje) => void,
  onDeleted: (id: string) => void,
) {
  const [form, setForm] = useState<Personaje>(item);
  const [status, setStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    setForm(item);
    setStatus("idle");
  }, [item.id]);

  const save = async () => {
    setStatus("saving");
    try {
      const { error } = await supabase
        .from("personajes")
        .update({
          nombre: form.nombre,
          img_url: form.img_url || null,
          img_cuerpo_url: form.img_cuerpo_url || null,
          sobre: form.sobre,
          reino: form.reino,
          especie: form.especie,
          caracteristicas: form.caracteristicas || null,
          ciudad_id: (form as any).ciudad_id || null,
          fecha_nacimiento: (form as any).fecha_nacimiento ?? null,
        })
        .eq("id", form.id);
      if (error) throw error;
      setStatus("saved");
      onSaved(form);
      void dexiePut("personajes", form);
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  };

  const remove = async () => {
    await supabase.from("personajes").delete().eq("id", form.id);
    void dexieDelete("personajes", form.id);
    onDeleted(form.id);
  };

  const onFechaNacimientoChange = (dia: number | null) => {
    const updated = { ...form, fecha_nacimiento: dia ?? null } as any;
    setForm(updated);
    void dexiePut("personajes", updated);
  };

  return { form, setForm, status, save, remove, onFechaNacimientoChange };
}
