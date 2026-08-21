"use client";

/**
 * FloraEditor mejorado (v2 — interfaz de Órganos y Procesos)
 * ───────────────────────────────────────────────────────────────────────────
 * Tres secciones principales:
 * 1. Composición general: descripción + ecosistemas donde crece.
 * 2. Órganos individuales (hoja, pétalo, raíz, fruto, tallo…) — selector
 *    real de tipo (crear y cambiar) y editor visual de fórmula química
 *    (chips + stepper sobre la Tabla Química real).
 * 3. Procesos del ciclo de vida (fotosíntesis, floración…) — selector real
 *    de tipo, editor visual de consume/produce (elemento o compuesto real
 *    + cantidad), y reorden por drag-and-drop persistido en `orden`.
 */

import {
  Leaf,
  Plus,
  Trash2,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { RichEditor } from "@/editor/lexical";
import { SeccionEntidad } from "@/ui/SeccionEntidad";
import { type SaveStatus } from "@/ui/saveStatus";

import { useCompuestos } from "@/domains/garlia/elementos/useCompuestos";
import { useElementos } from "@/domains/garlia/elementos/useElementos";
import { useGruposCompuestos } from "@/domains/garlia/elementos/useGruposCompuestos";
import { useReacciones } from "@/domains/garlia/elementos/useReacciones";
import { type Compuesto, type Elemento, type GrupoCompuesto, type Reaccion } from "@/domains/garlia/elementos/types";
import { ElementoPanelFlotante } from "@/domains/garlia/elementos/ElementosPage";
import { CompuestoPanelFlotante } from "@/domains/garlia/elementos/CompuestosPage";
import { SelectorImagen } from "@/domains/garlia/_shared/UIComponents";
import { EditorHeaderBar } from "@/domains/garlia/_shared/EditorHeaderBar";
import {
  usePublishHeaderControls,
  type OnHeaderControlsChange,
} from "@/domains/garlia/_shared/useEditorHeaderControls";
import { SeccionReaccionVinculada } from "@/domains/garlia/_shared/SeccionReaccionVinculada";
import { useEntidadVinculoReaccion } from "@/domains/garlia/_shared/useEntidadVinculoReaccion";

import { useFlora } from "./useFlora";
import { usePlantaOrganosProcesos } from "./usePlantaOrganosProcesos";
import { type Flora, type PlantaOrganoResuelto, type PlantaProceso } from "./types";
import { useEcosistemas } from "@/domains/garlia/biologia/useBiologia";
import { EcosistemaPopoverContent } from "@/domains/garlia/biologia/EcosistemaPopoverContent";
import { PopoverFlotante } from "@/domains/garlia/_shared/PopoverFlotante";

import { SelectorFormulaOrgano, type ComponenteOrgano } from "./SelectorFormulaOrgano";
import { type ItemProceso } from "./SelectorConsumeProduce";
import { SelectorOrganoPlanta } from "./SelectorOrganoPlanta";

export function FloraEditorMejorado({
  flora: floraProp,
  onDeleted,
  onHeaderControlsChange,
}: {
  flora: Flora;
  onDeleted?: (id: string) => void;
  onHeaderControlsChange?: OnHeaderControlsChange;
}) {
  const { items: elementos, setItems: setElementos } = useElementos();
  const { items: compuestos, setItems: setCompuestos } = useCompuestos();
  const { items: gruposCompuestos, setItems: setGruposCompuestos } = useGruposCompuestos();
  const { items: reacciones, setItems: setReacciones } = useReacciones();
  const { actualizar, eliminar } = useFlora();
  const { ecosistemas, loading: loadingEcosistemas, actualizar: actualizarEcosistema } =
    useEcosistemas();

  const [form, setForm] = useState<Flora>(floraProp);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [ecosistemaAbierto, setEcosistemaAbierto] = useState<{
    id: string;
    anchor: HTMLElement;
  } | null>(null);
  // Panel flotante de Elemento o Compuesto, abierto al clickear un item
  // elegido en Consume/Produce o en la Fórmula química de un Órgano.
  // Un solo estado: abrir uno nuevo reemplaza el que estuviera abierto.
  const [itemAbierto, setItemAbierto] = useState<
    { tipo: "elemento" | "compuesto"; id: string } | null
  >(null);
  // Último elemento DOM clickeado dentro de la barra de Ecosistemas — usado
  // como anchor del PopoverFlotante, ya que SeccionEntidad.onEntityClick
  // solo entrega el id, no el evento/elemento.
  const lastEntityClickTarget = useRef<HTMLElement | null>(null);
  const asideEcosistemasRef = useRef<HTMLElement | null>(null);

  // Catálogo de Órganos = Grupos de Compuestos con tipo="organo" (catálogo
  // global, compartido entre todas las plantas). Ya no es una tabla propia.
  const catalogoOrganos = useMemo(
    () => gruposCompuestos.filter((g) => g.tipo === "organo"),
    [gruposCompuestos],
  );

  // Órganos vinculados a esta planta (resueltos contra el catálogo) y procesos
  const {
    organos,
    procesos,
    loading: loadingOrganosProcesos,
    crearYVincularOrgano,
    vincularOrganoExistente,
    actualizarOrgano,
    desvincularOrgano,
    crearProceso,
    actualizarProceso,
    eliminarProceso,
  } = usePlantaOrganosProcesos(floraProp.id, catalogoOrganos);

  // Picker "Crear órgano / Usar uno existente" — abierto desde el botón +
  const [selectorOrganoAbierto, setSelectorOrganoAbierto] = useState(false);

  // Ecosistemas donde crece esta planta — vínculo inverso: vive en
  // Ecosistema.flora_ids, no en Flora. Mismo patrón que SeccionEntidad en
  // EditorCriatura/PanelBioma.
  const ecosistemaIds = useMemo(
    () => ecosistemas.filter((e) => (e.flora_ids ?? []).includes(form.id)).map((e) => e.id),
    [ecosistemas, form.id],
  );
  const handleToggleEcosistema = (ecosistemaId: string, add: boolean) => {
    const eco = ecosistemas.find((e) => e.id === ecosistemaId);
    if (!eco) return;
    const actuales = eco.flora_ids ?? [];
    void actualizarEcosistema(ecosistemaId, {
      flora_ids: add ? [...actuales, form.id] : actuales.filter((id) => id !== form.id),
    });
  };

  const [tabActiva, setTabActiva] = useState<"composicion" | "organos" | "procesos">(
    "composicion",
  );

  useEffect(() => {
    setForm(floraProp);
    setStatus("idle");
  }, [floraProp.id]);

  async function guardar(updates: Partial<Flora>) {
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
  async function eliminarFlora() {
    await eliminar(form.id);
    onDeleted?.(form.id);
  }

  const headerControls = {
    imagenUrl: form.imagen_url,
    IconoFallback: Leaf,
    nombre: form.nombre ?? "",
    placeholderNombre: "Nombre de la planta",
    onChangeNombre: (nombre: string) => setForm((f) => ({ ...f, nombre })),
    onBlurNombre: () => guardar({ nombre: form.nombre }),
    status,
    onGuardar: () => guardar({ nombre: form.nombre, descripcion: form.descripcion }),
    onEliminar: eliminarFlora,
  };
  usePublishHeaderControls(headerControls, onHeaderControlsChange);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {!onHeaderControlsChange && <EditorHeaderBar controls={headerControls} />}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4">
          {/* Layout principal: imagen + tabs */}
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
                onClick={() => setTabActiva("composicion")}
                className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  tabActiva === "composicion"
                    ? "text-primary border-b-2 border-primary"
                    : "text-primary/50 hover:text-primary/70"
                }`}
              >
                Composición
              </button>
              <button
                onClick={() => setTabActiva("organos")}
                className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  tabActiva === "organos"
                    ? "text-primary border-b-2 border-primary"
                    : "text-primary/50 hover:text-primary/70"
                }`}
              >
                Órganos ({organos.length})
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
              {tabActiva !== "composicion" && (
                <div className="relative">
                  <button
                    onClick={() =>
                      tabActiva === "organos" ? setSelectorOrganoAbierto(true) : void crearProceso()
                    }
                    title={tabActiva === "organos" ? "Agregar órgano" : "Nuevo proceso"}
                    className="shrink-0 mb-1 w-7 h-7 flex items-center justify-center rounded-md text-primary/50 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                  >
                    <Plus size={16} />
                  </button>
                  {selectorOrganoAbierto && tabActiva === "organos" && (
                    <SelectorOrganoPlanta
                      catalogoOrganos={catalogoOrganos}
                      organosYaVinculadosIds={new Set(organos.map((o) => o.id))}
                      onCrearNuevo={() => void crearYVincularOrgano()}
                      onUsarExistente={(organoId) => void vincularOrganoExistente(organoId)}
                      onClose={() => setSelectorOrganoAbierto(false)}
                    />
                  )}
                </div>
              )}
            </div>

            {/* ── TAB: Composición ──────────────────────────────────────── */}
            {tabActiva === "composicion" && (
              <div className="flex gap-4 items-stretch">
                <div className="flex-1 min-w-0">
                  <RichEditor
                    minHeight="8rem"
                    placeholder="Qué es, dónde crece, usos, apariencia…"
                    value={form.descripcion ?? ""}
                    onChange={(v) => setForm((f) => ({ ...f, descripcion: v }))}
                  />
                </div>

                {/* Ecosistemas — barra vertical lateral, mismo patrón que
                    SeccionEntidad en EditorCriatura/PanelBioma.
                    onEntityClick de SeccionEntidad solo entrega el id, no el
                    elemento clickeado — se captura acá con onClickCapture
                    para usarlo como anchor del PopoverFlotante (centrado, así
                    que no depende de la posición exacta del anchor). */}
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

            {/* ── TAB: Órganos ──────────────────────────────────────────── */}
            {tabActiva === "organos" && (
              <div className="space-y-3">
                {loadingOrganosProcesos ? (
                  <p className="text-xs text-primary/40">Cargando órganos…</p>
                ) : organos.length === 0 ? (
                  <p className="text-xs text-primary/40 italic">Sin órganos. Crea uno para empezar.</p>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
                    {organos.map((organo) => (
                      <div key={organo.vinculo_id} className="border-b border-primary/10">
                        <OrganoCard
                          organo={organo}
                          onUpdate={(id, updates) => {
                            // Optimista: refleja el cambio en el catálogo local ya
                            // mismo (afecta a todas las plantas que usan este
                            // Grupo), y persiste en Supabase vía el hook.
                            setGruposCompuestos((prev) =>
                              prev.map((g) => (g.id === id ? { ...g, ...updates } : g)),
                            );
                            void actualizarOrgano(id, updates);
                          }}
                          onDelete={() => void desvincularOrgano(organo.vinculo_id)}
                          compuestos={compuestos}
                          elementos={elementos}
                          onAbrirCompuesto={(id) => setItemAbierto({ tipo: "compuesto", id })}
                          gruposCompuestos={gruposCompuestos}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: Procesos ────────────────────────────────────────── */}
            {tabActiva === "procesos" && (
              <div className="space-y-3">
                {loadingOrganosProcesos ? (
                  <p className="text-xs text-primary/40">Cargando procesos…</p>
                ) : procesos.length === 0 ? (
                  <p className="text-xs text-primary/40 italic">Sin procesos. Crea uno para empezar.</p>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
                    {procesos.map((proceso) => (
                      <div key={proceso.id} className="border-b border-primary/10">
                        <ProcesoCard
                          proceso={proceso}
                          onUpdate={actualizarProceso}
                          onDelete={() => eliminarProceso(proceso.id)}
                          compuestos={compuestos}
                          elementos={elementos}
                          reacciones={reacciones}
                          onUpdateReaccion={(id, updates) => {
                            // Optimista: refleja el cambio en el catálogo local ya
                            // mismo (afecta a todos los procesos/habilidades que
                            // usan esta Reacción), y persiste vía el hook.
                            setReacciones((prev) =>
                              prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
                            );
                          }}
                          onAbrirItem={(item) => setItemAbierto({ tipo: item.tipo, id: item.id })}
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

      {/* Popovers flotantes */}
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

      {/* Panel flotante de Elemento o Compuesto, abierto al clickear un item
          elegido en Consume/Produce o en la Fórmula química de un Órgano. */}
      {itemAbierto?.tipo === "elemento" &&
        (() => {
          const elemento = elementos.find((e) => e.id === itemAbierto.id);
          if (!elemento) return null;
          return (
            <ElementoPanelFlotante
              elemento={elemento}
              todosLosElementos={elementos}
              compuestos={compuestos}
              onCerrar={() => setItemAbierto(null)}
              onActualizar={(id, cambios) =>
                setElementos((prev) => prev.map((e) => (e.id === id ? { ...e, ...cambios } : e)))
              }
              onNavigateCompuesto={(compuestoId) =>
                setItemAbierto({ tipo: "compuesto", id: compuestoId })
              }
            />
          );
        })()}

      {itemAbierto?.tipo === "compuesto" &&
        (() => {
          const compuesto = compuestos.find((c) => c.id === itemAbierto.id);
          if (!compuesto) return null;
          return (
            <CompuestoPanelFlotante
              compuesto={compuesto}
              elementos={elementos}
              todosLosCompuestos={compuestos}
              onCerrar={() => setItemAbierto(null)}
              onActualizar={(id, cambios) =>
                setCompuestos((prev) => prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)))
              }
            />
          );
        })()}
    </div>
  );
}

// ── Componente auxiliar: Tarjeta de órgano ─────────────────────────────────
// organo.id es el id del Organo en el catálogo compartido (editar acá
// afecta a todas las plantas que lo usan); onDelete desvincula esta
// planta del Organo, sin borrarlo del catálogo.
interface OrganoCardProps {
  organo: PlantaOrganoResuelto;
  onUpdate: (id: string, updates: Partial<PlantaOrganoResuelto>) => void;
  onDelete: () => void;
  compuestos: Compuesto[];
  elementos: Elemento[];
  onAbrirCompuesto?: (compuestoId: string) => void;
  gruposCompuestos?: GrupoCompuesto[];
}

function OrganoCard({
  organo,
  onUpdate,
  onDelete,
  compuestos,
  elementos,
  onAbrirCompuesto,
  gruposCompuestos,
}: OrganoCardProps) {
  return (
    <div className="group py-3">
      {/* Header: nombre del órgano (texto libre) + agregar compuesto + eliminar (hover) */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <input
          className="min-w-0 flex-1 bg-transparent px-0 py-1 text-sm font-semibold text-primary/80 outline-none transition-colors placeholder:text-primary/25 placeholder:font-normal"
          placeholder="Nombre del órgano (ej: Hoja)…"
          value={organo.nombre ?? ""}
          onChange={(e) => onUpdate(organo.id, { nombre: e.target.value })}
        />
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onDelete}
            title="Quitar de esta planta (el órgano sigue en el catálogo para otras plantas)"
            className="p-1 rounded hover:bg-red-500/10 text-red-500/40 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Contenido: grid de 2 columnas cuando hay ancho, sin cajas anidadas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2 text-xs items-start">
        <div>
          <SelectorFormulaOrgano
            compuestos={compuestos}
            componentes={(organo.componentes ?? []) as ComponenteOrgano[]}
            onChange={(componentes) => onUpdate(organo.id, { componentes })}
            onAbrirCompuesto={onAbrirCompuesto}
            ocultarBotonAgregar
            gruposCompuestos={gruposCompuestos}
            onUsarGrupo={(grupoElegido) => {
              // Solo copiamos el nombre del grupo si todavía no hay uno
              // propio puesto — no pisamos un nombre que el usuario ya
              // escribió.
              if ((organo.nombre ?? "").trim() === "") {
                onUpdate(organo.id, { nombre: grupoElegido.nombre });
              }
            }}
          />
        </div>

        <div>
          <textarea
            className="w-full h-full min-h-[3.5rem] bg-transparent px-0 py-1 text-primary/70 resize-none outline-none transition-colors placeholder:text-primary/25"
            placeholder="Notas del órgano…"
            value={organo.notas ?? ""}
            onChange={(e) => onUpdate(organo.id, { notas: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ── Componente auxiliar: Tarjeta de proceso ────────────────────────────────
// Ahora un proceso es solo una etapa del ciclo de vida (descripcion) que
// vincula 1:1 una Reacción del catálogo global de Química vía reaccion_id —
// la Reacción vinculada trae su propio nombre/consume/produce/balance (ver
// TarjetaReaccionVinculada). El vínculo se instancia acá vía
// useEntidadVinculoReaccion.
interface ProcesoCardProps {
  proceso: PlantaProceso;
  onUpdate: (id: string, updates: Partial<PlantaProceso>) => void;
  onDelete: () => void;
  compuestos: Compuesto[];
  elementos: Elemento[];
  reacciones: Reaccion[];
  onUpdateReaccion: (id: string, updates: Partial<Reaccion>) => void;
  onAbrirItem?: (item: ItemProceso) => void;
}

function ProcesoCard({
  proceso,
  onUpdate,
  onDelete,
  compuestos,
  elementos,
  reacciones,
  onUpdateReaccion,
  onAbrirItem,
}: ProcesoCardProps) {
  const vinculo = useEntidadVinculoReaccion({
    tabla: "planta_procesos",
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
        onAbrirItem={onAbrirItem}
      />
    </div>
  );
}

export { FloraEditorMejorado as FloraEditor };
