"use client";

/**
 * ElementosSection.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Conecta useElementos (datos vía Supabase) con ElementosPage (UI de grid +
 * detalle). Sección independiente dentro de EditorMundoRoot — igual que
 * MapaSection/AventuraSection — porque no comparte el mega-grid de
 * EntidadesPage (Entidades/Geografía/Organización).
 *
 * Punto de extensión: cuando se sumen "Iums" y "Simulador" como tabs
 * hermanas de Tabla, este componente es el lugar natural para agregar un
 * sub-selector (mismo patrón que SiblingSectionTabs a nivel de sección, o
 * un tab-bar interno si se prefiere mantenerlas todas bajo la key
 * "elementos").
 */

import React, { useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import { ElementosPage } from "./ElementosPage";
import { useElementos } from "./useElementos";
import type { Elemento } from "./types";

export function ElementosSection({ selectedId }: { selectedId: string | null }) {
  const { items: elementos, setItems: setElementos, loading } = useElementos();
  const [creating, setCreating] = useState(false);
  const [recienCreadoId, setRecienCreadoId] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    try {
      const siguienteNumero =
        elementos.reduce((max, e) => Math.max(max, e.numero_atomico ?? 0), 0) + 1;
      const { data, error } = await supabase
        .from("elementos")
        .insert([
          {
            nombre: "Nuevo elemento",
            simbolo: "??",
            numero_atomico: siguienteNumero,
            familia: "Sensibles",
            es_noble: false,
            nucleo: {},
            media: {},
            externa: {},
          },
        ])
        .select()
        .single();
      if (error) throw error;
      setElementos((prev) => [...prev, data as Elemento]);
      setRecienCreadoId((data as Elemento).id);
    } catch (e) {
      console.error("[ElementosSection] error creando elemento:", e);
    } finally {
      setCreating(false);
    }
  }

  async function handleEliminar(id: string) {
    try {
      const { error } = await supabase.from("elementos").delete().eq("id", id);
      if (error) throw error;
      setElementos((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      console.error("[ElementosSection] error eliminando elemento:", e);
    }
  }

  // Inserta un lote de elementos ya parseados/validados por ElementosPage
  // (parsearArchivoElementosJSON) — mismo insert que handleCreate pero con
  // varias filas a la vez, para el botón "Subir JSON".
  async function handleImportarElementos(nuevos: Omit<Elemento, "id">[]) {
    const { data, error } = await supabase.from("elementos").insert(nuevos).select();
    if (error) throw error;
    const insertados = (data ?? []) as Elemento[];
    setElementos((prev) => [...prev, ...insertados]);
    return insertados.length;
  }

  return (
    <ElementosPage
      elementos={elementos}
      loading={loading}
      creating={creating}
      onCreate={handleCreate}
      onActualizar={(id, cambios) =>
        setElementos((prev) => prev.map((e) => (e.id === id ? { ...e, ...cambios } : e)))
      }
      onEliminar={handleEliminar}
      seleccionarId={selectedId ?? recienCreadoId}
      onImportarElementos={handleImportarElementos}
    />
  );
}
