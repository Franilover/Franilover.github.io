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
 *
 * Hooks extraídos a hooks/:
 *   useGrupoSelector          → reemplaza useTiposDeGrupoItems +
 *                                useOrigenesDeGrupoItems (duplicados)
 *
 * Ruta destino:
 *   src/features/editorGarlia/views/EditorItem.tsx
 */


import { Bug, Dices, Package, X } from "lucide-react";
import Image from "next/image";
import React, { useEffect, useState } from "react";

import type { WikiEntity } from "@/ui/Markdown/commandItems";
import { RichEditor } from "@/editor/lexical";
import { ComboSelector } from "@/ui/ComboSelector";
import { PanelReglasDnd } from "@/domains/garlia/items/PanelReglasDnd";
import { PickerImagenItemBtn } from "@/domains/garlia/items/PickerImagenItemBtn";
import { SelectorGrupoUnico } from "@/domains/garlia/items/SelectorGrupoUnico";
import { useCriaturasCatalogo } from "@/domains/garlia/criaturas/useCriaturasCatalogo";
import { dexiePut, dexieDelete } from "@/infra/sync/useOfflineSync";
import { supabase } from "@/infra/supabase/supabase";

import { useCompuestos } from "@/domains/garlia/elementos/useCompuestos";
import { useElementos } from "@/domains/garlia/elementos/useElementos";
import { CompuestoPanelFlotante } from "@/domains/garlia/elementos/CompuestosPage";
import { type Compuesto } from "@/domains/garlia/elementos/types";
import {
  SelectorComposicionMultiple,
  type ComposicionEntrada,
} from "@/domains/garlia/_shared/SelectorComposicionMultiple";
import { SugerenciaReglasDndPanel } from "@/domains/garlia/_shared/SugerenciaReglasDndPanel";

import { SelectorImagen } from "@/domains/garlia/_shared/UIComponents";
import { EditorHeaderBar } from "@/domains/garlia/_shared/EditorHeaderBar";
import {
  usePublishHeaderControls,
  type OnHeaderControlsChange,
} from "@/domains/garlia/_shared/useEditorHeaderControls";
import { useWikilink } from "@/domains/garlia/_shared/WikilinkContext";
import { type Item } from "@garlia/items";
import { type SaveStatus } from "@/ui/saveStatus";

export function EditorItem({
  item,
  tabla = "items",
  onSaved,
  onDeleted,
  entities = [],
  onSelectGrupo,
  onNavigateCriatura,
  onHeaderControlsChange,
}: {
  item: Item;
  tabla?: string;
  onSaved: (i: Item) => void;
  onDeleted: (id: string) => void;
  entities?: WikiEntity[];
  onSelectGrupo?: (grupoId: string) => void;
  onNavigateCriatura?: (id: string) => void;
  /** Publica los controles de la barra superior (nombre, guardar, eliminar,
   *  dado D&D) hacia el contenedor — normalmente PanelFlotanteGlobal, que
   *  los renderiza en su propia barra en vez de que este editor dibuje la
   *  suya (evita la barra duplicada en la vista rápida). Si no se pasa,
   *  este editor dibuja su propia barra igual que antes (uso standalone). */
  onHeaderControlsChange?: OnHeaderControlsChange;
}) {
  const [form, setForm] = useState<Item>(item);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [showModalDnd, setShowModalDnd] = useState(false);
  const [editandoCompuestoId, setEditandoCompuestoId] = useState<string | null>(null);
  const { onWikilink } = useWikilink();

  // Catálogo de criaturas para el selector "Criatura" (origen del ítem)
  const { criaturas: allCriaturas, loading: loadingCriaturas } = useCriaturasCatalogo();
  // Catálogo de elementos/compuestos — mismo patrón que Flora/Mineral
  const { items: elementos } = useElementos();
  const { items: compuestos, setItems: setCompuestos, loading: loadingCompuestos } = useCompuestos();

  useEffect(() => {
    setForm(item);
    setStatus("idle");
  }, [item.id]);

  function onCompuestoCreado(nuevo: Compuesto) {
    setCompuestos((prev) => [...prev, nuevo]);
  }

  const field =
    (k: keyof Item) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f: Item) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setStatus("saving");
    try {
      const payload: any = {
        nombre: form.nombre,
        imagen_url: form.imagen_url || null,
        descripcion: form.descripcion,
        categoria: form.categoria,
        criatura_id: form.criatura_id ?? null,
        compuesto_id: form.compuesto_id ?? null,
        composicion: form.composicion ?? [],
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

  // La confirmación ya la pide el header compartido (EditorHeaderBar /
  // PanelFlotanteGlobal) de forma inline antes de llamar a onEliminar, así
  // que acá se borra directo — ver useEditorHeaderControls.ts.
  const del = async () => {
    await supabase.from(tabla).delete().eq("id", form.id);
    void dexieDelete(tabla, form.id);
    onDeleted(form.id);
  };

  // Botón de dado D&D — es específico de Item/Criatura, así que viaja como
  // "extra" dentro de los controles de header en vez de ser un campo fijo.
  const dadoDndBtn = (
    <button
      className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all"
      title="Reglas D&D 2024"
      type="button"
      onClick={() => setShowModalDnd(true)}
    >
      <Dices size={13} />
    </button>
  );

  const headerControls = {
    imagenUrl: form.imagen_url,
    IconoFallback: Package,
    nombre: form.nombre ?? "",
    placeholderNombre: "Nombre del objeto",
    onChangeNombre: (nombre: string) => setForm((f: Item) => ({ ...f, nombre })),
    status,
    onGuardar: save,
    onEliminar: del,
    extra: dadoDndBtn,
  };
  usePublishHeaderControls(headerControls, onHeaderControlsChange);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Barra superior: si hay un contenedor escuchando (panel flotante),
          los controles ya se publicaron arriba y este editor no dibuja su
          propia barra — evita la duplicación. Si se usa standalone, se
          sigue mostrando igual que siempre. */}
      {!onHeaderControlsChange && <EditorHeaderBar controls={headerControls} />}

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
                      setForm((f: Item) => ({ ...f, imagen_url: url }))
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
                    setForm((f: Item) => ({ ...f, imagen_url: url }))
                  }
                />
              </div>
            </div>

            {/* Columna derecha: categoría + descripción */}
            <div className="flex-1 min-w-0 space-y-4">
              <SelectorGrupoUnico
                emptyLabel="Sin categoría"
                label="Categoría"
                noGruposLabel="No hay categorías de ítems creadas"
                subtipo="Tipo"
                value={form.categoria ?? null}
                onChange={(nombre) =>
                  setForm((f: Item) => ({ ...f, categoria: nombre ?? "" }))
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
                  setForm((f: Item) => ({ ...f, criatura_id: id }))
                }
                onNavigate={
                  onNavigateCriatura
                    ? (id) => onNavigateCriatura(id)
                    : undefined
                }
              />

              {/* Composición material — puede tener varias partes hechas de
                  compuestos distintos (ej: "Madera" en el mango, "Acero" en
                  la hoja), cada una con su propia etiqueta */}
              <div className="pt-2 border-t border-primary/10">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
                    Composición (Compuestos)
                  </span>
                </div>
                <p className="text-micro text-primary/30 mb-1.5 -mt-1">
                  Compuestos de la Tabla Química que forman este ítem, por parte
                  (mango, hoja, empuñadura…).
                </p>

                <SelectorComposicionMultiple
                  composicion={form.composicion ?? []}
                  onChange={(composicion) =>
                    setForm((f: Item) => ({ ...f, composicion }))
                  }
                  compuestos={compuestos}
                  elementos={elementos}
                  loadingCompuestos={loadingCompuestos}
                  onCompuestoCreado={onCompuestoCreado}
                  onEditarCompuesto={setEditandoCompuestoId}
                />

                <SugerenciaReglasDndPanel
                  composicion={form.composicion ?? []}
                  compuestos={compuestos}
                  elementos={elementos}
                  yaEsArma={!!form.es_arma}
                  yaEsArmadura={!!form.es_armadura}
                  onAplicar={(cambios) => setForm((f: Item) => ({ ...f, ...cambios }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35">
                  Descripción
                </label>
                <RichEditor
                  minHeight="12.5rem"
                  placeholder="Qué es, qué hace, su historia…"
                  value={form.descripcion ?? ""}
                  wikiEntities={entities}
                  onChange={(v) => setForm((f: Item) => ({ ...f, descripcion: v }))}
                  onWikilinkNavigate={onWikilink}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModalDnd && (
        <ModalReglasDnd
          form={form}
          nombre={form.nombre}
          onChange={(cambios) => setForm((f: Item) => ({ ...f, ...cambios }))}
          onClose={() => setShowModalDnd(false)}
        />
      )}

      {editandoCompuestoId && (
        <CompuestoPanelFlotante
          compuesto={compuestos.find((c) => c.id === editandoCompuestoId)!}
          elementos={elementos}
          todosLosCompuestos={compuestos}
          onCerrar={() => setEditandoCompuestoId(null)}
          onActualizar={(id, cambios) =>
            setCompuestos((prev) => prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)))
          }
        />
      )}
    </div>
  );
}

// ─── Modal de reglas D&D ────────────────────────────────────────────────────
// Antes vivía inline en el cuerpo del editor; ahora se accede desde el botón
// de dado junto al nombre, así el editor queda enfocado en lore/descripción
// y las reglas mecánicas (D&D) quedan en un modal aparte.
function ModalReglasDnd({
  form,
  nombre,
  onChange,
  onClose,
}: {
  form: Item;
  nombre: string;
  onChange: (cambios: Partial<Item>) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-80 flex items-center justify-center p-4"
      style={{
        background: "color-mix(in srgb, var(--primary) 30%, transparent)",
        backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl overflow-hidden shadow-2xl"
        style={{
          background: "var(--bg-main)",
          border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
          animation: "popIn 160ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
          }}
        >
          <div
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: "color-mix(in srgb, var(--primary) 10%, transparent)",
              color: "var(--primary)",
            }}
          >
            <Dices size={13} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-micro font-black uppercase tracking-widest text-primary/40">
              Reglas D&D
            </p>
            <p className="text-xs font-bold text-primary truncate">{nombre || "Sin nombre"}</p>
          </div>
          <button
            className="shrink-0 p-1 rounded-lg text-primary/30 hover:text-primary hover:bg-primary/8 transition-all"
            type="button"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <PanelReglasDnd form={form} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}
