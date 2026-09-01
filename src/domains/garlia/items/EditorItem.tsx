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
import { PanelFisicaObjeto } from "@/domains/garlia/items/PanelFisicaObjeto";
import { itemsQueries } from "@/domains/garlia/items/queries";
import { PickerImagenItemBtn } from "@/domains/garlia/items/PickerImagenItemBtn";
import { SelectorGrupoUnico } from "@/domains/garlia/items/SelectorGrupoUnico";
import { useCriaturasCatalogo } from "@/domains/garlia/criaturas/useCriaturasCatalogo";
import { dexiePut, dexieDelete } from "@/infra/sync/useOfflineSync";
import { supabase } from "@/infra/supabase/supabase";

import { useCompuestosConElementos } from "@/domains/garlia/elementos/useCompuestosConElementos";
import { useElementos } from "@/domains/garlia/elementos/useElementos";
import { useFormaciones } from "@/domains/garlia/elementos/useFormaciones";
import { useReacciones } from "@/domains/garlia/elementos/useReacciones";
import { CompuestoPanelFlotante } from "@/domains/garlia/elementos/CompuestosPage";
import { GrupoCompuestoPanelFlotante } from "@/domains/garlia/elementos/GruposCompuestosPage";
import { ReaccionPanelFlotante } from "@/domains/garlia/elementos/ReaccionesPage";
import { useGranos } from "@/domains/garlia/elementos/useGranos";
import { useVetas } from "@/domains/garlia/elementos/useVetas";
import { PanelEditorGrano, PanelEditorVeta } from "@/domains/garlia/fisica/CatalogoVetasFisica";
import { useEntidadVinculosGrupo } from "@/domains/garlia/_shared/useEntidadVinculosGrupo";
import { useItemHabilidadesReaccion } from "@/domains/garlia/_shared/useItemHabilidadesReaccion";

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
  const [editandoGrupoId, setEditandoGrupoId] = useState<string | null>(null);
  const [editandoReaccionId, setEditandoReaccionId] = useState<string | null>(null);
  // Panel del Grano abierto al clickear "hecho de: [Grano]" en la fila de
  // fórmula de una Veta (Formación → Veta → Grano → Compuesto). Ver misma
  // nota en MineralEditor.tsx.
  const [editandoGranoId, setEditandoGranoId] = useState<string | null>(null);
  // Panel de la Veta abierta desde "Grano → Veta" dentro de PanelEditorGrano
  // (ver onAbrirVeta abajo) — mismo patrón que editandoGranoId.
  const [editandoVetaId, setEditandoVetaId] = useState<string | null>(null);
  const granosCatalogo = useGranos();
  const vetasCatalogo = useVetas();
  const { onWikilink } = useWikilink();

  // Catálogo de criaturas para el selector "Criatura" (origen del ítem)
  const { criaturas: allCriaturas, loading: loadingCriaturas } = useCriaturasCatalogo();
  // Catálogo de elementos/compuestos — mismo patrón que Flora/Mineral
  const { items: elementos } = useElementos();
  const { items: compuestos, setItems: setCompuestos } = useCompuestosConElementos();

  // Catálogo propio de Formaciones — Estructura del item usa el MISMO
  // catálogo (tabla real "formaciones") que Formaciones de Minerales. Un
  // item y un mineral pueden compartir la misma Formación (ej. "Cristal de
  // Cuarzo" como parte de una espada y como formación mineral), y editarla
  // en cualquiera de los dos lugares actualiza a ambos. FASE 7: el vínculo
  // vive en estructura_componentes (padre_tipo='item', hijo_tipo='formacion'),
  // reemplaza la tabla dedicada item_estructura (sigue existiendo sin
  // usarse, limpieza en Fase 8).
  const { items: catalogoEstructura, setItems: setCatalogoEstructura } = useFormaciones();

  const estructura = useEntidadVinculosGrupo({
    entidadId: item.id,
    padreTipo: "item",
    tablaCatalogo: "formaciones",
    hijoTipo: "formacion",
    catalogo: catalogoEstructura,
  });

  // Habilidades del item = N Reacciones del catálogo global de Química,
  // vinculadas N:N vía la tabla puente item_habilidades (item_id,
  // reaccion_id — múltiples filas por item). Editar una Reacción acá afecta
  // a todo lo que la use — Procesos de Flora/Minerales incluidos.
  const { items: reacciones, setItems: setReacciones } = useReacciones();
  const habilidades = useItemHabilidadesReaccion({
    itemId: item.id,
    catalogo: reacciones,
  });

  function onGrupoCompuestoActualizadoLocal(id: string, updates: any) {
    setCatalogoEstructura((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
  }

  // Persistencia directa de la Formación en catálogo — usada por el
  // panel flotante (GrupoCompuestoPanelFlotante), que no sabe a qué
  // relación (estructura/habilidad) pertenece el grupo que edita.
  async function persistirGrupoCompuesto(id: string, cambios: any) {
    onGrupoCompuestoActualizadoLocal(id, cambios);
    const { error } = await supabase.from("formaciones").update(cambios).eq("id", id);
    if (error) {
      console.error("[EditorItem] error guardando formación:", error);
    }
  }

  function onReaccionActualizadaLocal(id: string, updates: any) {
    setReacciones((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }

  // Persistencia directa de la Reacción/Habilidad en catálogo — usada por
  // el panel flotante (ReaccionPanelFlotante), que no sabe que se abrió
  // desde acá.
  async function persistirReaccion(id: string, cambios: any) {
    onReaccionActualizadaLocal(id, cambios);
    const { error } = await supabase.from("reacciones").update(cambios).eq("id", id);
    if (error) {
      console.error("[EditorItem] error guardando reacción:", error);
    }
  }

  useEffect(() => {
    setForm(item);
    setStatus("idle");
  }, [item.id]);

  // ── Refrescar solo los campos derivados por el motor (propiedades_fisicas/
  // estado_fisico) después de editar item_materiales. Supabase ya recalculó
  // y persistió esos campos vía trigger (trg_objeto_propiedades →
  // recalcular_objeto_propiedades, verificado contra el proyecto real) —
  // acá solo se vuelve a pedir el item con la query real ya existente
  // (itemsQueries.getById, misma que carga el editor la primera vez) para
  // que PanelFisicaObjeto deje de mostrar el valor anterior. No se toca
  // nada que el usuario esté editando en `form` en ese momento. ─────────────
  const refrescarPropiedadesFisicas = async () => {
    try {
      const actualizado = await itemsQueries.getById(form.id);
      if (!actualizado) return;
      setForm((f: Item) => ({
        ...f,
        propiedades_fisicas: actualizado.propiedades_fisicas,
        estado_fisico: actualizado.estado_fisico,
      }));
    } catch (err) {
      console.error("[EditorItem] error refrescando propiedades físicas:", err);
    }
  };

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
            <div className="w-full sm:w-72 sm:shrink-0">
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

              {/* Física del objeto (Modelo físico canónico v218). La
                  sección "Física del objeto"/"Geometría" es solo lectura:
                  item_materiales es la fuente principal; compuesto_id es
                  solo compatibilidad secundaria y nunca se suma. La
                  composición de materiales sí es editable dentro de este
                  panel (capa "Editar composición") — al cambiar algo,
                  Supabase recalcula vía trigger y acá se vuelve a pedir el
                  item con la misma query real que lo cargó. */}
              <PanelFisicaObjeto
                itemId={item.id}
                propiedadesFisicas={form.propiedades_fisicas}
                estadoFisico={form.estado_fisico}
                geometriaFisica={form.geometria_fisica}
                onRefrescarItem={refrescarPropiedadesFisicas}
              />

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

      {editandoGrupoId && (
        <GrupoCompuestoPanelFlotante
          grupo={catalogoEstructura.find((g) => g.id === editandoGrupoId)!}
          tipo="formacion"
          compuestos={compuestos}
          onCerrar={() => setEditandoGrupoId(null)}
          onActualizar={persistirGrupoCompuesto}
          onAbrirCompuesto={setEditandoCompuestoId}
        />
      )}

      {/* Click en "hecho de: [Grano]" en la fila de fórmula de una Veta —
          la cadena real es Veta→Grano→Compuesto, así que esto abre el
          Grano (donde vive compuesto_id), no el Compuesto directo. */}
      {editandoGranoId &&
        (() => {
          const granoActivo = granosCatalogo.items.find((g) => g.id === editandoGranoId);
          if (!granoActivo) return null;
          return (
            <PanelEditorGrano
              item={granoActivo}
              compuestos={compuestos}
              onCerrar={() => setEditandoGranoId(null)}
              onActualizar={granosCatalogo.actualizar}
              onEliminar={granosCatalogo.eliminar}
              onAbrirCompuesto={setEditandoCompuestoId}
              onAbrirVeta={(vetaId) => {
                setEditandoGranoId(null);
                setEditandoVetaId(vetaId);
              }}
              onAbrirFormacion={(formacionId) => {
                setEditandoGranoId(null);
                setEditandoGrupoId(formacionId);
              }}
            />
          );
        })()}

      {/* Panel de la Veta abierta desde "Grano → Veta" — se apila igual
          que el Grano de arriba. */}
      {editandoVetaId &&
        (() => {
          const vetaActiva = vetasCatalogo.items.find((v) => v.id === editandoVetaId);
          if (!vetaActiva) return null;
          return (
            <PanelEditorVeta
              item={vetaActiva}
              granos={granosCatalogo.items}
              loadingGranos={granosCatalogo.loading}
              onCerrar={() => setEditandoVetaId(null)}
              onActualizar={vetasCatalogo.actualizar}
              onEliminar={vetasCatalogo.eliminar}
              onAbrirGrano={(granoId) => {
                setEditandoVetaId(null);
                setEditandoGranoId(granoId);
              }}
              onAbrirFormacion={(formacionId) => {
                setEditandoVetaId(null);
                setEditandoGrupoId(formacionId);
              }}
            />
          );
        })()}

      {editandoReaccionId && (
        <ReaccionPanelFlotante
          reaccion={reacciones.find((r) => r.id === editandoReaccionId)!}
          compuestos={compuestos}
          elementos={elementos}
          onCerrar={() => setEditandoReaccionId(null)}
          onActualizar={persistirReaccion}
          onAbrirItem={(it) => setEditandoCompuestoId(it.tipo === "compuesto" ? it.id : null)}
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
