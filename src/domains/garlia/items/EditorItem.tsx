"use client";

/**
 * EditorItem.tsx
 * ────────────────
 * View del editor de ítems. Solo orquesta: conecta hooks con
 * componentes, no contiene lógica de fetching ni duplicación.
 *
 * Componentes extraídos a components/items/:
 *   PickerImagenItemBtn  → botón mobile de imagen
 *   SelectorGrupoUnico   → reemplaza a SelectorCategoriaGrupo +
 *                          SelectorOrigenGrupo (eran duplicados)
 *   PanelTerritorio      → ya no fetchea, recibe catálogo por props
 *   PanelCiudades        → ya no fetchea catálogo, solo la relación
 *                          item_ciudades vía useCiudadesItem
 *
 * Hooks extraídos a hooks/:
 *   useItemCatalogosUbicacion → catálogo compartido de reinos/ciudades
 *   useCiudadesItem           → relación item_ciudades
 *   useGrupoSelector          → reemplaza useTiposDeGrupoItems +
 *                                useOrigenesDeGrupoItems (duplicados)
 *
 * Ruta destino:
 *   src/features/editorGarlia/views/EditorItem.tsx
 */


import { Bug, Package, Save, Trash2 } from "lucide-react";
import Image from "next/image";
import React, { useEffect, useState } from "react";

import type { WikiEntity } from "@/components/forms/Markdown/commandItems";
import { RichEditor } from "@/components/forms/lexical-editor";
import { ComboSelector } from "@/components/ui/ComboSelector";
import { useConfirm } from "@/components/ui/ConfirmModal";
import { PanelCiudades } from "@/domains/garlia/items/PanelCiudades";
import { PanelReglasDnd } from "@/domains/garlia/items/PanelReglasDnd";
import { PanelTerritorio } from "@/domains/garlia/items/PanelTerritorio";
import { PickerImagenItemBtn } from "@/domains/garlia/items/PickerImagenItemBtn";
import { SelectorGrupoUnico } from "@/domains/garlia/items/SelectorGrupoUnico";
import { useCriaturasCatalogo } from "@/domains/garlia/_legacy/hooks/misc/useCriaturasCatalogo";
import { useItemCatalogosUbicacion } from "@/domains/garlia/_legacy/hooks/misc/useItemCatalogosUbicacion";
import { dexiePut, dexieDelete } from "@/hooks/data/useOfflineSync";
import { supabase } from "@/lib/api/client/supabase";

import { SelectorImagen, SaveIndicator } from "@/domains/garlia/_legacy/components/shared/UIComponents";
import { useWikilink } from "@/domains/garlia/_legacy/components/shared/WikilinkContext";
import { type Item, type SaveStatus } from "../hooks/types";

export function EditorItem({
  item,
  tabla = "items",
  onSaved,
  onDeleted,
  entities = [],
  onNavigateCiudad,
  onNavigateReino,
  onSelectGrupo,
  onNavigateCriatura,
}: {
  item: Item;
  tabla?: string;
  onSaved: (i: Item) => void;
  onDeleted: (id: string) => void;
  entities?: WikiEntity[];
  onNavigateCiudad?: (id: string) => void;
  onNavigateReino?: (id: string) => void;
  onSelectGrupo?: (grupoId: string) => void;
  onNavigateCriatura?: (id: string) => void;
}) {
  const [form, setForm] = useState<Item>(item);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const { confirm, ConfirmModal } = useConfirm();
  const { onWikilink } = useWikilink();

  // Conteos de contenido de Territorio/Ciudades — permiten que la columna
  // con más contenido ocupe proporcionalmente más espacio en la fila.
  const [countTerritorio, setCountTerritorio] = useState(0);
  const [countCiudades, setCountCiudades] = useState(0);

  // Catálogo compartido de reinos/ciudades — un solo fetch para ambos paneles
  const { allReinos, allCiudades, loadingReinos } = useItemCatalogosUbicacion();
  // Catálogo de criaturas para el selector "Criatura" (origen del ítem)
  const { criaturas: allCriaturas, loading: loadingCriaturas } = useCriaturasCatalogo();

  useEffect(() => {
    setForm(item);
    setStatus("idle");
  }, [item.id]);

  const field =
    (k: keyof Item) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setStatus("saving");
    try {
      const payload: any = {
        nombre: form.nombre,
        imagen_url: form.imagen_url || null,
        descripcion: form.descripcion,
        categoria: form.categoria,
        reino_ids: form.reino_ids ?? [],
        criatura_id: form.criatura_id ?? null,
        es_arma: form.es_arma ?? false,
        dado_dano: form.dado_dano || null,
        sutileza: form.sutileza ?? false,
        distancia: form.distancia ?? false,
        maestria: form.maestria || null,
        es_armadura: form.es_armadura ?? false,
        es_escudo: form.es_escudo ?? false,
        ca_base_armadura: form.ca_base_armadura ?? null,
        max_bono_dex_armadura: form.max_bono_dex_armadura ?? null,
      };
      const { error } = await supabase
        .from(tabla)
        .update(payload)
        .eq("id", form.id);
      if (error) throw error;
      setStatus("saved");
      onSaved(form);
      void dexiePut(tabla, form);
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
    await supabase.from(tabla).delete().eq("id", form.id);
    void dexieDelete(tabla, form.id);
    onDeleted(form.id);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <ConfirmModal />

      {/* ── Fixed header ────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center gap-2 px-3 py-2 border-b"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
          background: "color-mix(in srgb, var(--primary) 3%, transparent)",
        }}
      >
        <div className="shrink-0 w-8 h-8 rounded-lg overflow-hidden border border-primary/15 bg-primary/5 flex items-center justify-center">
          {form.imagen_url ? (
            <Image
              alt={form.nombre}
              className="w-full h-full object-cover"
              src={form.imagen_url}
            />
          ) : (
            <Package className="text-primary/25" size={16} />
          )}
        </div>

        <input
          className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
          placeholder="Nombre del objeto"
          value={form.nombre ?? ""}
          onChange={field("nombre")}
        />

        <div className="shrink-0 flex items-center gap-1.5">
          <SaveIndicator status={status} />
          <button
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all"
            onClick={del}
          >
            <Trash2 size={10} />
          </button>
          <button
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
            disabled={status === "saving"}
            onClick={save}
          >
            <Save size={10} /> Guardar
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4">
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Columna izquierda: imagen */}
            <div className="w-full sm:w-96 sm:shrink-0">
              {/* Mobile: imagen con botón flotante */}
              <div
                className="sm:hidden relative w-full rounded-xl overflow-hidden border border-primary/10 bg-primary/3"
                style={{ aspectRatio: "1 / 1" }}
              >
                {form.imagen_url ? (
                  <Image
                    alt={form.nombre}
                    className="w-full h-full object-cover"
                    src={form.imagen_url}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="text-primary/15" size={48} />
                  </div>
                )}
                <div className="absolute top-2 right-2 z-10">
                  <PickerImagenItemBtn
                    value={form.imagen_url ?? ""}
                    onChange={(url) =>
                      setForm((f) => ({ ...f, imagen_url: url }))
                    }
                  />
                </div>
              </div>
              {/* Desktop: selector normal */}
              <div className="hidden sm:block w-full">
                <SelectorImagen
                  aspect="square"
                  label="Imagen"
                  placeholder={<Package className="opacity-20" size={20} />}
                  value={form.imagen_url ?? ""}
                  onChange={(url) =>
                    setForm((f) => ({ ...f, imagen_url: url }))
                  }
                />
              </div>
            </div>

            {/* Columna derecha: categoría + origen + descripción */}
            <div className="flex-1 min-w-0 space-y-4">
              <SelectorGrupoUnico
                emptyLabel="Sin categoría"
                label="Categoría"
                noGruposLabel="No hay categorías de ítems creadas"
                subtipo="Tipo"
                value={form.categoria ?? null}
                onChange={(nombre) =>
                  setForm((f) => ({ ...f, categoria: nombre ?? "" }))
                }
                onSelectGrupo={onSelectGrupo}
              />

              <ComboSelector
                allowNone
                icon={<Bug size={11} />}
                items={allCriaturas.map((c) => ({
                  id: c.id,
                  label: c.nombre,
                  imgUrl: c.imagen_url ?? null,
                }))}
                label="Criatura"
                loading={loadingCriaturas}
                mode="single"
                noneLabel="Sin criatura"
                placeholder="Vincular a una criatura…"
                value={form.criatura_id ?? null}
                onChange={(id) =>
                  setForm((f) => ({ ...f, criatura_id: id }))
                }
                onNavigate={
                  onNavigateCriatura
                    ? (id) => onNavigateCriatura(id)
                    : undefined
                }
              />

              {/* Origen + Territorio + Ciudades en tres columnas */}
              <div className="flex flex-col sm:flex-row sm:items-stretch gap-4">
                {/* Columna Origen — solo para ítems */}
                {tabla === "items" && (
                  <div
                    className="min-w-0 flex flex-col rounded-xl overflow-hidden bg-primary/[0.015]"
                    style={{ flexGrow: form.origen ? 1 : 0.6, flexBasis: 0 }}
                  >
                    <SelectorGrupoUnico
                      emptyLabel="Sin origen"
                      label="Origen"
                      noGruposLabel="No hay orígenes de ítems creados"
                      subtipo="Origen"
                      value={form.origen ?? null}
                      onChange={(nombre) =>
                        setForm((f) => ({
                          ...f,
                          origen: (nombre ?? null) as Item["origen"],
                        }))
                      }
                      onSelectGrupo={onSelectGrupo}
                    />
                  </div>
                )}
                {/* Columna Territorio */}
                <div
                  className="min-w-0 flex flex-col rounded-xl overflow-hidden bg-primary/[0.015]"
                  style={{ flexGrow: Math.max(countTerritorio, 1), flexBasis: 0 }}
                >
                  <PanelTerritorio
                    allReinos={allReinos}
                    loadingReinos={loadingReinos}
                    value={form.reino_ids ?? []}
                    onChange={(ids) =>
                      setForm((f) => ({ ...f, reino_ids: ids }))
                    }
                    onNavigateReino={onNavigateReino}
                    onSelectedCountChange={setCountTerritorio}
                  />
                </div>
                {/* Columna Ciudades */}
                <div
                  className="min-w-0 flex flex-col rounded-xl overflow-hidden bg-primary/[0.015]"
                  style={{ flexGrow: Math.max(countCiudades, 1), flexBasis: 0 }}
                >
                  <PanelCiudades
                    allCiudades={allCiudades}
                    itemId={form.id}
                    reinosSeleccionados={form.reino_ids ?? []}
                    onNavigateCiudad={onNavigateCiudad}
                    onSelectedCountChange={setCountCiudades}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35">
                  Descripción
                </label>
                <RichEditor
                  minHeight="12.5rem"
                  mode="edit"
                  placeholder="Qué es, qué hace, su historia…"
                  showSplitMode={false}
                  value={form.descripcion ?? ""}
                  wikiEntities={entities}
                  onChange={(v) => setForm((f) => ({ ...f, descripcion: v }))}
                  onWikilinkNavigate={onWikilink}
                />
              </div>

              <PanelReglasDnd form={form} onChange={(cambios) => setForm((f) => ({ ...f, ...cambios }))} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
