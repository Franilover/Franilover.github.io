"use client";

/**
 * MineralEditor.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Editor de una entidad Mineral: nombre, imagen, descripción rica y
 * ecosistemas — mismo molde visual que FloraEditor.tsx — más Formaciones y
 * Procesos:
 *
 * - Formaciones: partes del mineral con fórmula propia, nombre libre (ej:
 *   "Veta", "Inclusión de cuarzo"…). Reemplaza la antigua composición plana
 *   de un solo nivel (`Mineral.componentes`), que se migra automáticamente
 *   a una Formación la primera vez que se abre este editor (ver
 *   useMineralFormacionesProcesos).
 *
 * - Procesos: eventos geológicos de formación/transformación, nombre libre
 *   (ej: "Cristalización", "Oxidación"…) con consume/produce — mismo shape
 *   que los Procesos de Flora, pero sin orden/secuencia: los procesos
 *   geológicos de un mineral no tienen un orden narrativo único.
 *
 * Reutiliza SelectorFormulaOrgano y SelectorConsumeProduce de Flora tal cual
 * (son genéricos, sin nada específico de planta).
 */

import { Gem, Leaf, Plus } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { RichEditor } from "@/editor/lexical";
import { SeccionEntidad } from "@/ui/SeccionEntidad";
import { type SaveStatus } from "@/ui/saveStatus";

import { useCompuestosConElementos } from "@/domains/garlia/elementos/useCompuestosConElementos";
import { useElementos } from "@/domains/garlia/elementos/useElementos";
import { useFormaciones } from "@/domains/garlia/elementos/useFormaciones";
import { useReacciones } from "@/domains/garlia/elementos/useReacciones";
import { CompuestoPanelFlotante } from "@/domains/garlia/elementos/CompuestosPage";
import { GrupoCompuestoPanelFlotante } from "@/domains/garlia/elementos/GruposCompuestosPage";
import { useGranos } from "@/domains/garlia/elementos/useGranos";
import { useVetas } from "@/domains/garlia/elementos/useVetas";
import { PanelEditorGrano, PanelEditorVeta } from "@/domains/garlia/fisica/CatalogoVetasFisica";
import { type Compuesto, type Elemento, type Reaccion } from "@/domains/garlia/elementos/types";
import { SelectorImagen } from "@/domains/garlia/_shared/UIComponents";
import { EditorHeaderBar } from "@/domains/garlia/_shared/EditorHeaderBar";
import { AfinidadEntreEntidadesPanel } from "@/domains/garlia/_shared/AfinidadEntreEntidadesPanel";
import { SeccionReaccionVinculada } from "@/domains/garlia/_shared/SeccionReaccionVinculada";
import { useEntidadVinculoReaccion } from "@/domains/garlia/_shared/useEntidadVinculoReaccion";
import {
  usePublishHeaderControls,
  type OnHeaderControlsChange,
} from "@/domains/garlia/_shared/useEditorHeaderControls";

import { useMinerales } from "./useMinerales";
import { useMineralFormacionesProcesos } from "./useMineralFormacionesProcesos";
import { type Mineral, type MineralProceso } from "./types";
import { useEcosistemas } from "@/domains/garlia/biologia/useBiologia";
import { EcosistemaPopoverContent } from "@/domains/garlia/biologia/EcosistemaPopoverContent";
import { PopoverFlotante } from "@/domains/garlia/_shared/PopoverFlotante";

import { SeccionGruposVinculados } from "@/domains/garlia/_shared/SeccionGruposVinculados";

export function MineralEditor({
  mineral: mineralProp,
  onDeleted,
  onHeaderControlsChange,
}: {
  mineral: Mineral;
  onDeleted?: (id: string) => void;
  onHeaderControlsChange?: OnHeaderControlsChange;
}) {
  const { items: elementos } = useElementos();
  const { items: compuestos, setItems: setCompuestos } = useCompuestosConElementos();
  const { items: catalogoFormaciones, setItems: setCatalogoFormaciones } = useFormaciones();
  const { items: reacciones, setItems: setReacciones } = useReacciones();
  const { actualizar, eliminar } = useMinerales();
  const { ecosistemas, loading: loadingEcosistemas, actualizar: actualizarEcosistema } =
    useEcosistemas();

  const [form, setForm] = useState<Mineral>(mineralProp);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [editandoCompuestoId, setEditandoCompuestoId] = useState<string | null>(null);
  // Panel flotante de la Formación abierta al clickear su nombre en la
  // tarjeta — vista completa fuera de la tarjeta inline.
  const [editandoFormacionId, setEditandoFormacionId] = useState<string | null>(null);
  // Panel flotante del Grano abierto al clickear "hecho de: [Grano]" en la
  // fila de la fórmula (ver SeccionGruposVinculados → TarjetaFormacionOrgano
  // → SelectorFormulaTejidos) — la cadena real es Veta→Grano→Compuesto, así
  // que este click abre el Grano, no el Compuesto directo.
  const [editandoGranoId, setEditandoGranoId] = useState<string | null>(null);
  // Panel flotante de la Veta abierta desde el breadcrumb "Grano → Veta"
  // dentro de PanelEditorGrano (ver onAbrirVeta abajo) — antes ese salto no
  // hacía nada porque no se pasaba el callback. Mismo patrón que
  // editandoGranoId/editandoFormacionId: cierra el panel de origen y abre
  // este, apilado en el mismo nivel (no hay jerarquía real entre ellos, uno
  // reemplaza al otro).
  const [editandoVetaId, setEditandoVetaId] = useState<string | null>(null);
  const granosCatalogo = useGranos();
  const vetasCatalogo = useVetas();
  // Popover flotante de ecosistema — mismo patrón que el chip de Ecosistema
  // en CriaturasJerarquica/GeografiaJerarquica (PopoverFlotante anclado al
  // elemento clickeado, sin navegar a pantalla completa).
  const [ecosistemaAbierto, setEcosistemaAbierto] = useState<{
    id: string;
    anchor: HTMLElement;
  } | null>(null);
  // Último elemento DOM clickeado dentro de la barra de Ecosistemas — usado
  // como anchor del PopoverFlotante, ya que SeccionEntidad.onEntityClick
  // solo entrega el id, no el evento/elemento. Mismo patrón que FloraEditor.
  const lastEntityClickTarget = useRef<HTMLElement | null>(null);
  const asideEcosistemasRef = useRef<HTMLElement | null>(null);

  // Ecosistemas donde aparece este mineral — vínculo inverso: vive en
  // Ecosistema.mineral_ids, no en Mineral. Mismo patrón que FloraEditor.
  const ecosistemaIds = useMemo(
    () => ecosistemas.filter((e) => (e.mineral_ids ?? []).includes(form.id)).map((e) => e.id),
    [ecosistemas, form.id],
  );
  const handleToggleEcosistema = (ecosistemaId: string, add: boolean) => {
    const eco = ecosistemas.find((e) => e.id === ecosistemaId);
    if (!eco) return;
    const actuales = eco.mineral_ids ?? [];
    void actualizarEcosistema(ecosistemaId, {
      mineral_ids: add ? [...actuales, form.id] : actuales.filter((id) => id !== form.id),
    });
  };

  // Catálogo de Formaciones: tabla real "formaciones" (catálogo propio,
  // compartido entre todos los minerales y también con Estructura de
  // Items), separada de "organos" que usan Flora/Criaturas. Ya no tiene
  // `componentes` inline: la fórmula vive vía Vetas/Granos.

  // Formaciones y procesos
  const {
    formaciones,
    procesos,
    loading: loadingFormacionesProcesos,
    crearFormacion,
    vincularFormacionExistente,
    actualizarFormacion,
    eliminarFormacion,
    crearProceso,
    actualizarProceso,
    eliminarProceso,
  } = useMineralFormacionesProcesos(mineralProp.id, catalogoFormaciones, form);

  const [tabActiva, setTabActiva] = useState<"info" | "formaciones" | "procesos">("info");

  useEffect(() => {
    setForm(mineralProp);
    setStatus("idle");
  }, [mineralProp.id]);

  async function guardar(updates: Partial<Mineral>) {
    setStatus("saving");
    try {
      await actualizar(form.id, updates);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  }

  // Confirmación inline en el header compartido — ver EditorHeaderBar.
  async function eliminarMineral() {
    await eliminar(form.id);
    onDeleted?.(form.id);
  }

  const headerControls = {
    imagenUrl: form.imagen_url,
    IconoFallback: Gem,
    nombre: form.nombre ?? "",
    placeholderNombre: "Nombre del mineral",
    onChangeNombre: (nombre: string) => setForm((f) => ({ ...f, nombre })),
    onBlurNombre: () => guardar({ nombre: form.nombre }),
    status,
    onGuardar: () => guardar({ nombre: form.nombre, descripcion: form.descripcion }),
    onEliminar: eliminarMineral,
  };
  usePublishHeaderControls(headerControls, onHeaderControlsChange);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {!onHeaderControlsChange && <EditorHeaderBar controls={headerControls} />}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4">
          <div className="flex flex-col sm:flex-row gap-5 mb-6">
            {/* Columna izquierda: imagen */}
            <div className="w-full sm:w-72 sm:shrink-0">
              <SelectorImagen
                aspect="square"
                label="Imagen"
                value={form.imagen_url ?? ""}
                onChange={(url) => {
                  setForm((f) => ({ ...f, imagen_url: url }));
                  void guardar({ imagen_url: url });
                }}
              />
            </div>

            {/* Columna derecha: tabs */}
            <div className="flex-1 min-w-0">
              {/* ── TABS ──────────────────────────────────────────────────── */}
              <div className="flex items-center justify-between gap-2 mb-4 border-b border-primary/10">
                <div className="flex gap-2">
                  <button
                    onClick={() => setTabActiva("info")}
                    className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                      tabActiva === "info"
                        ? "text-primary border-b-2 border-primary"
                        : "text-primary/50 hover:text-primary/70"
                    }`}
                  >
                    Info
                  </button>
                  <button
                    onClick={() => setTabActiva("formaciones")}
                    className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                      tabActiva === "formaciones"
                        ? "text-primary border-b-2 border-primary"
                        : "text-primary/50 hover:text-primary/70"
                    }`}
                  >
                    Formaciones ({formaciones.length})
                  </button>
                  <button
                    onClick={() => setTabActiva("procesos")}
                    className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                      tabActiva === "procesos"
                        ? "text-primary border-b-2 border-primary"
                        : "text-primary/50 hover:text-primary/70"
                    }`}
                  >
                    Procesos ({procesos.length})
                  </button>
                </div>
                {tabActiva === "procesos" && (
                  <button
                    onClick={() => void crearProceso()}
                    title="Nuevo proceso"
                    className="shrink-0 mb-1 w-7 h-7 flex items-center justify-center rounded-md text-primary/50 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>

              {/* ── TAB: Info ─────────────────────────────────────────────── */}
              {tabActiva === "info" && (
                <div className="flex gap-4 items-stretch">
                  <div className="flex-1 min-w-0">
                    <RichEditor
                      minHeight="8rem"
                      placeholder="Qué es, dónde se encuentra, propiedades, apariencia…"
                      value={form.descripcion ?? ""}
                      onChange={(v) => setForm((f) => ({ ...f, descripcion: v }))}
                    />
                  </div>

                  {/* Ecosistemas — barra vertical lateral, mismo patrón que
                      SeccionEntidad en FloraEditor/EditorCriatura/PanelBioma.
                      onEntityClick de SeccionEntidad solo entrega el id, no el
                      elemento clickeado — se captura acá con onClickCapture
                      para usarlo como anchor del PopoverFlotante. */}
                  <aside
                    ref={asideEcosistemasRef}
                    className="shrink-0 w-44 flex flex-col border-l overflow-y-auto"
                    style={{
                      borderColor: "color-mix(in srgb, var(--primary) 7%, transparent)",
                    }}
                    onClickCapture={(e) => {
                      lastEntityClickTarget.current = e.target as HTMLElement;
                    }}
                  >
                    <SeccionEntidad
                      allEntities={ecosistemas.map((e) => ({ id: e.id, nombre: e.nombre }))}
                      emptyLabel="Sin ecosistemas"
                      fallbackIcon={<Leaf size={14} strokeWidth={1} />}
                      fill={false}
                      icon={<Leaf size={9} />}
                      label="Ecosistemas"
                      loading={loadingEcosistemas}
                      saving={false}
                      selectedIds={ecosistemaIds}
                      onEntityClick={(id) =>
                        setEcosistemaAbierto({
                          id,
                          anchor:
                            lastEntityClickTarget.current ?? asideEcosistemasRef.current ?? document.body,
                        })
                      }
                      onToggle={handleToggleEcosistema}
                    />
                  </aside>
                </div>
              )}

              {/* ── TAB: Formaciones ──────────────────────────────────────── */}
              {tabActiva === "formaciones" && (
                <div className="space-y-3">
                  <SeccionGruposVinculados
                    titulo="Formaciones"
                    icono={Gem}
                    tipo="formacion"
                    items={formaciones}
                    catalogo={catalogoFormaciones}
                    loading={loadingFormacionesProcesos}
                    onCrearNuevo={async () => {
                      const nueva = await crearFormacion();
                      if (nueva) setEditandoFormacionId(nueva.id);
                      return nueva;
                    }}
                    onUsarExistente={(id) => void vincularFormacionExistente(id)}
                    onDelete={(vinculoId) => void eliminarFormacion(vinculoId)}
                    onAbrirGrupo={setEditandoFormacionId}
                    onAbrirCelula={setEditandoGranoId}
                    placeholderNombre="Nombre de la formación (ej: Veta, Inclusión de cuarzo)…"
                    placeholderNotas="Notas de la formación…"
                    labelCrear="Crear formación"
                    labelExistente="Usar una existente"
                    labelBuscar="Buscar formación…"
                  />

                  <AfinidadEntreEntidadesPanel
                    entidadId={form.id}
                    nombreEntidad={form.nombre}
                    // TODO: Formacion ya no tiene `componentes` inline (la
                    // fórmula vive vía Vetas/Granos→Compuesto, ver
                    // useFormacionVetas). Este panel y
                    // useMezclasAfinidadCatalogo siguen construidos sobre
                    // el shape viejo y su query a Supabase ya apunta a una
                    // tabla ("grupos_compuestos") que no existe — quedan
                    // pendientes de reescribirse para resolver la mezcla
                    // agregada vía la cadena real de Vetas/Granos. Se pasa
                    // vacío acá para no romper el build mientras tanto.
                    mezcla={[]}
                    compuestos={compuestos}
                    elementos={elementos}
                  />
                </div>
              )}

              {/* ── TAB: Procesos ────────────────────────────────────────── */}
              {tabActiva === "procesos" && (
                <div className="space-y-3">
                  {loadingFormacionesProcesos ? (
                    <p className="text-xs text-primary/40">Cargando procesos…</p>
                  ) : procesos.length === 0 ? (
                    <p className="text-xs text-primary/40 italic">
                      Sin procesos. Crea uno para empezar.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
                      {procesos.map((proceso) => (
                        <div key={proceso.id} className="border-b border-primary/10">
                          <ProcesoMineralCard
                            proceso={proceso}
                            onUpdate={actualizarProceso}
                            onDelete={() => eliminarProceso(proceso.id)}
                            compuestos={compuestos}
                            elementos={elementos}
                            reacciones={reacciones}
                            onUpdateReaccion={(id, updates) => {
                              setReacciones((prev) =>
                                prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
                              );
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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

      {/* Click en el nombre de una Formación en la tarjeta abre este panel
          — vista completa fuera de la tarjeta inline, útil cuando la
          Formación está vinculada a muchos minerales/items y se quiere
          editar desde un solo lugar. */}
      {editandoFormacionId && (
        <GrupoCompuestoPanelFlotante
          grupo={catalogoFormaciones.find((f) => f.id === editandoFormacionId)!}
          tipo="formacion"
          compuestos={compuestos}
          onCerrar={() => setEditandoFormacionId(null)}
          onActualizar={(id, cambios) => {
            setCatalogoFormaciones((prev) =>
              prev.map((g) => (g.id === id ? { ...g, ...cambios } : g)),
            );
            void actualizarFormacion(id, cambios);
          }}
          onAbrirCompuesto={setEditandoCompuestoId}
        />
      )}

      {/* Click en "hecho de: [Grano]" en la fila de fórmula de una Veta
          abre este panel — la cadena real es Veta→Grano→Compuesto, así que
          esto abre el Grano (donde vive compuesto_id), no el Compuesto. */}
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
                setEditandoFormacionId(formacionId);
              }}
            />
          );
        })()}

      {/* Panel flotante de la Veta abierta desde "Grano → Veta" — mismo
          patrón que el Grano de arriba: cierra su origen y se apila acá. */}
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
                setEditandoFormacionId(formacionId);
              }}
            />
          );
        })()}

      {ecosistemaAbierto && (
        <PopoverFlotante
          anchor={ecosistemaAbierto.anchor}
          onClose={() => setEcosistemaAbierto(null)}
          width={640}
          maxHeight={560}
          centerVertically
          centerHorizontally
        >
          <EcosistemaPopoverContent
            ecosistemaId={ecosistemaAbierto.id}
            onClose={() => setEcosistemaAbierto(null)}
          />
        </PopoverFlotante>
      )}
    </div>
  );
}

// ── Componente auxiliar: Tarjeta de proceso geológico ──────────────────────
// Ahora un proceso es solo un evento geológico (descripcion) que vincula
// 1:1 una Reacción del catálogo global de Química vía reaccion_id — la
// Reacción vinculada trae su propio nombre/consume/produce/balance (ver
// TarjetaReaccionVinculada).
function ProcesoMineralCard({
  proceso,
  onUpdate,
  onDelete,
  compuestos,
  elementos,
  reacciones,
  onUpdateReaccion,
}: {
  proceso: MineralProceso;
  onUpdate: (id: string, updates: Partial<MineralProceso>) => void;
  onDelete: () => void;
  compuestos: Compuesto[];
  elementos: Elemento[];
  reacciones: Reaccion[];
  onUpdateReaccion: (id: string, updates: Partial<Reaccion>) => void;
}) {
  const vinculo = useEntidadVinculoReaccion({
    tabla: "mineral_reacciones",
    entidadId: proceso.id,
    reaccionIdActual: proceso.reaccion_id,
    catalogo: reacciones,
    onReaccionIdCambiado: (reaccionId) => onUpdate(proceso.id, { reaccion_id: reaccionId }),
  });

  return (
    <div className="group py-3">
      <SeccionReaccionVinculada
        reaccion={vinculo.reaccion}
        catalogo={reacciones}
        compuestos={compuestos}
        elementos={elementos}
        onCrearNuevo={() => void vinculo.crearYVincular()}
        onUsarExistente={(id) => void vinculo.vincularExistente(id)}
        onUpdate={(id, updates) => {
          onUpdateReaccion(id, updates);
          void vinculo.actualizar(updates);
        }}
        onQuitar={onDelete}
      />
    </div>
  );
}
