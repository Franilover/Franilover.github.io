"use client";

/**
 * EditorCiudad.tsx
 * ──────────────────
 * View del editor de ciudades. Solo orquesta: maneja form/status y
 * delega el fetching de catálogos y la relación con entidades al
 * componente FormularioCiudad + hooks de useCiudadCatalogos.
 *
 * Migrado desde _legacy/views/EditorCiudad.tsx a domains/garlia/ciudades,
 * siguiendo el patrón de reinos. El supabase.from("ciudades") suelto que
 * vivía acá (update/delete) pasó a ciudadesQueries.
 */

import React, { useEffect, useState } from "react";

import type { WikiEntity } from "@/components/forms/Markdown/commandItems";
import { useConfirm } from "@/ui/ConfirmModal";
import { type SaveStatus } from "@/domains/garlia/_shared/types";
import { dexiePut, dexieDelete } from "@/hooks/data/useOfflineSync";

import { FormularioCiudad } from "./FormularioCiudad";
import { type Ciudad } from "../model";
import { ciudadesQueries } from "../queries";

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
      await ciudadesQueries.update(form.id, form);
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
    await ciudadesQueries.delete(form.id);
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
