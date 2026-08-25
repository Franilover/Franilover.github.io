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

/**
 * Prefijo usado para distinguir, dentro de un mismo selectedId de
 * SectionKey "elementos", si lo que se quiere abrir es un ELEMENTO
 * (id crudo, comportamiento de siempre) o un COMPUESTO (id con este
 * prefijo). Se agregó para que el panel de auditoría (domains/garlia/
 * auditoria) pueda enlazar directo a un compuesto vía
 * openEntity("elementos", compuestoIdParaNavegacion(id)) sin necesitar
 * una SectionKey nueva ni tocar useMundoNavigationStore.
 */
const PREFIJO_COMPUESTO = "compuesto:";

export function compuestoIdParaNavegacion(compuestoId: string) {
  return `${PREFIJO_COMPUESTO}${compuestoId}`;
}

export function ElementosSection({ selectedId }: { selectedId: string | null }) {
  const { items: elementos, setItems: setElementos, loading } = useElementos();
  const [creating, setCreating] = useState(false);
  const [recienCreadoId, setRecienCreadoId] = useState<string | null>(null);

  const esCompuesto = selectedId?.startsWith(PREFIJO_COMPUESTO) ?? false;
  const compuestoIdInicial = esCompuesto
    ? selectedId!.slice(PREFIJO_COMPUESTO.length)
    : null;

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
            familia: "Inerte",
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

  // Actualiza (upsert) un lote de elementos ya existentes cuyo número
  // atómico coincidió con uno del JSON subido — mismo patrón que
  // handleImportarElementos pero con UPDATE en vez de INSERT, uno por
  // fila (Supabase no soporta upsert de varias filas con distinto id vía
  // update() en una sola llamada).
  async function handleActualizarVarios(cambios: (Partial<Elemento> & { id: string })[]) {
    let actualizados = 0;
    for (const { id, ...datos } of cambios) {
      const { error } = await supabase.from("elementos").update(datos).eq("id", id);
      if (error) {
        console.error("[ElementosSection] error actualizando elemento", id, error);
        continue;
      }
      actualizados++;
    }
    setElementos((prev) =>
      prev.map((e) => {
        const cambio = cambios.find((c) => c.id === e.id);
        return cambio ? { ...e, ...cambio } : e;
      }),
    );
    return actualizados;
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
      seleccionarId={esCompuesto ? recienCreadoId : (selectedId ?? recienCreadoId)}
      compuestoIdInicial={compuestoIdInicial}
      onImportarElementos={handleImportarElementos}
      onActualizarVarios={handleActualizarVarios}
    />
  );
}
