"use client";

/**
 * EditorCiudad.tsx
 * ──────────────────
 * View del editor de ciudades. Solo orquesta: maneja form/status y
 * delega el fetching de catálogos y la relación con entidades al
 * componente FormularioCiudad + hooks de useCiudadCatalogos.
 *
 * Antes este archivo tenía ~900 líneas mezclando 7 hooks de fetching,
 * un componente sin uso (BloqueEntidades, código muerto — eliminado)
 * y el formulario completo. Ahora:
 *
 *   Hooks    → hooks/useCiudadCatalogos.ts
 *   UI       → components/ciudades/FormularioCiudad.tsx
 *   Tipo     → hooks/types.ts (Ciudad, junto con Reino/Item/Personaje)
 *
 * Ruta destino:
 *   src/features/editorGarlia/views/EditorCiudad.tsx
 */

import React, { useEffect, useState } from "react";

import type { WikiEntity } from "@/components/forms/Markdown/commandItems";
import { useConfirm } from "@/components/ui/ConfirmModal";
import { FormularioCiudad } from "@/domains/garlia/_legacy/components/ciudades/FormularioCiudad";
import { dexiePut, dexieDelete } from "@/hooks/data/useOfflineSync";
import { supabase } from "@/lib/api/client/supabase";

import { type Ciudad, type SaveStatus } from "../hooks/types";

// ─── EditorCiudad ──────────────────────────────────────────────────────────────
export function EditorCiudad({
  item,
  onSaved,
  onDeleted,
  entities = [],
  onSelectPersonaje,
  onSelectCriatura,
  onSelectItem,
  onNavigateReino,
}: {
  item: Ciudad;
  onSaved: (l: Ciudad) => void;
  onDeleted: (id: string) => void;
  entities?: WikiEntity[];
  onSelectPersonaje?: (id: string) => void;
  onSelectCriatura?: (id: string) => void;
  onSelectItem?: (id: string) => void;
  onNavigateReino?: (id: string) => void;
}) {
  const [form, setForm] = useState<Ciudad>(item);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const { confirm, ConfirmModal } = useConfirm();

  useEffect(() => {
    setForm(item);
    setStatus("idle");
  }, [item.id]);

  const save = async () => {
    setStatus("saving");
    try {
      const { error } = await supabase
        .from("ciudades")
        .update({
          nombre: form.nombre,
          tipo: form.tipo || null,
          descripcion: form.descripcion || null,
          historia: form.historia || null,
          secretos: form.secretos || null,
          imagen_url: form.imagen_url || null,
          reino_id: form.reino_id || null,
        })
        .eq("id", form.id);
      if (error) throw error;
      setStatus("saved");
      onSaved(form);
      void dexiePut("ciudades", form);
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  };

  const del = async () => {
    const ok = await confirm({
      message: `¿Eliminar "${form.nombre}"?`,
      danger: true,
    });
    if (!ok) return;
    await supabase.from("ciudades").delete().eq("id", form.id);
    void dexieDelete("ciudades", form.id);
    onDeleted(form.id);
  };

  return (
    <>
      <ConfirmModal />
      <FormularioCiudad
        entities={entities}
        form={form}
        setForm={setForm}
        status={status}
        onDelete={del}
        onNavigateReino={onNavigateReino}
        onSave={save}
        onSelectCriatura={onSelectCriatura}
        onSelectItem={onSelectItem}
        onSelectPersonaje={onSelectPersonaje}
      />
    </>
  );
}
