"use client";

/**
 * RunasPage
 * ───────────────────────────────────────────────────────────────────────────
 * Vista de la página "Runas": grid de tarjetas de runas, más subsistemas,
 * probador de reconocimiento, editor de combinaciones y ensayo de energías.
 *
 * Antes era MagiaPorTipo.tsx y mostraba tres bloques planos —
 * Hechizos / Dones / Runas —, cada uno con su grid. Ahora que Hechizos y
 * Dones se eliminaron, queda un solo bloque de Runas.
 */

import { Maximize2, Plus, ScrollText, Sparkles, Waypoints, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { EntityCard } from "@/domains/garlia/_shared/EntityCard";
import type { SectionKey } from "@/domains/garlia/_shared/useMundoNavigationStore";
import { RichEditor } from "@/editor/lexical";
import { useEnsayoEditorLogic } from "@/editor/notas/hooks/useEnsayoEditorLogic";
import { supabase } from "@/infra/supabase/supabase";

import {
  PanelCombinacionesRunas,
  SelectorProbadorConfig,
  type SeccionProbadorConfig,
} from "./BloqueProbadorYCombinaciones";
import { BloqueSubsistemasMagia, PanelEditorSubsistema } from "./BloqueSubsistemasMagia";
import type { Punto } from "./dollarOneRecognizer";
import { PanelConfigRunas, type PreviewCombinacion } from "./PanelConfigRunas";
import { PanelDetectorUnificado } from "./PanelDetectorUnificado";
import { PanelGruposAsignados } from "./PanelGruposAsignados";
import { PanelPatronRuna } from "./PanelPatronRuna";
import { RunaThumbnail } from "./RunaThumbnail";
import type { EntidadMagica, GrupoMin } from "./types";
import { useConfigRunas } from "./useConfigRunas";
import { useGruposRunas } from "./useGruposRunas";
import { useSubsistemasMagia } from "./useSubsistemasMagia";

interface EntidadMagicaMin {
  id: string;
  nombre: string;
  patron_trazos?: Punto[][] | null;
}

interface Props {
  runas: EntidadMagicaMin[];
  loading?: boolean;
  onOpen: (section: SectionKey, id: string) => void;
  onCreate?: () => void;
  creating?: boolean;
  // Abre un ensayo (tab "notas-gos") — mismo patrón que EnsayosGosWidget
  // en el home. Si no se pasa, el bloque de ensayos no se muestra.
  onOpenEnsayo?: (ensayoId: string) => void;
  // Catálogo completo de runas — para el bloque de herramientas de runas
  // (probador + editor de combinaciones), movido acá desde el editor
  // interno de una runa individual.
  todasLasRunas?: EntidadMagica[];
  // Id de runa a dejar seleccionada (ej. la recién creada por onCreate) —
  // reemplaza la navegación a un editor aparte: ahora, tras crear, la
  // runa nueva simplemente queda abierta inline acá mismo.
  seleccionarRunaId?: string | null;
  // Refleja en el estado del padre un cambio guardado acá (ej. el
  // patrón de trazo editado desde el panel inline), para que el grid y
  // el resto de la página no queden desincronizados hasta el próximo
  // refetch.
  onActualizarRuna?: (id: string, cambios: Partial<EntidadMagica>) => void;
}

/**
 * Grid de tarjetas de runas. Ya no navega a un editor aparte: al hacer
 * click en una runa se selecciona (toggle) — el padre (RunasPage) usa esa
 * selección para mostrar el patrón de trazo en el lugar del Probador y la
 * explicación + grupos en la columna derecha. Un segundo click sobre la
 * misma runa la deselecciona.
 */
function BloqueRunas({
  entidades,
  runaSeleccionadaId,
  onToggleSeleccion,
  onCreate,
  creating,
}: {
  entidades: EntidadMagicaMin[];
  runaSeleccionadaId?: string | null;
  onToggleSeleccion?: (id: string) => void;
  onCreate?: () => void;
  creating?: boolean;
}) {
  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-2 py-2">
        <span />
        <span className="justify-self-center max-w-[280px] truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70">
          Runas
        </span>
        {onCreate ? (
          <button
            type="button"
            onClick={onCreate}
            disabled={creating}
            title="Añadir runa"
            className="justify-self-end p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50 shrink-0"
          >
            <Plus size={9} className="text-primary/60" />
          </button>
        ) : (
          <span />
        )}
      </div>
      <div className="px-2 pb-2 flex-1">
        {entidades.length === 0 ? (
          <div className="w-full py-6 text-xs text-primary/25 text-center">
            Sin runas todavía
          </div>
        ) : (
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: "repeat(auto-fill, 52px)" }}
          >
            {entidades.map((e) => {
              const seleccionada = runaSeleccionadaId === e.id;
              return (
                <div
                  key={e.id}
                  className={`rounded-lg transition-shadow ${
                    seleccionada ? "ring-2 ring-primary/60" : ""
                  }`}
                >
                  <EntityCard
                    nombre={e.nombre}
                    imageUrl={null}
                    Icon={ScrollText}
                    visual={<RunaThumbnail patronTrazos={e.patron_trazos} />}
                    onClick={() => onToggleSeleccion?.(e.id)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Panel editable del trazo de la runa seleccionada, en el mismo lugar
 * donde normalmente vive el canvas del Probador. Reemplaza al preview
 * de solo-lectura: ahora el admin puede dibujar/rehacer el trazo acá
 * mismo, sin pasar por un editor aparte.
 */
function PatronRunaSeleccionada({
  runa,
  onPatronChange,
}: {
  runa: EntidadMagica;
  onPatronChange: (trazos: Punto[][]) => void;
}) {
  return (
    <div className="rounded-2xl border border-primary/15 bg-white-custom/60 p-4">
      <p className="text-micro font-black uppercase tracking-widest text-primary/30 text-center mb-3">
        {runa.nombre || "(sin nombre)"}
      </p>
      <PanelPatronRuna patronTrazos={runa.patron_trazos ?? []} onChange={onPatronChange} />
    </div>
  );
}

/**
 * Explicación de la runa seleccionada + grupos asignados, debajo. Vive en
 * la columna derecha (donde antes iba el editor de combinaciones/config)
 * mientras haya una runa seleccionada.
 */
function DetalleRunaSeleccionada({
  runa,
  grupos,
  loadingGrupos,
  onGrupoIdsChange,
}: {
  runa: EntidadMagica;
  grupos: GrupoMin[];
  loadingGrupos: boolean;
  onGrupoIdsChange: (ids: string[]) => void;
}) {
  return (
    <div className="rounded-2xl border border-primary/15 bg-white-custom/60 p-4 space-y-4">
      <div className="space-y-1.5">
        <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35">
          Explicación
        </label>
        {runa.explicacion ? (
          <div
            className="text-sm text-primary/80 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: runa.explicacion }}
          />
        ) : (
          <p className="text-micro text-primary/30 italic">Sin explicación todavía.</p>
        )}
      </div>

      <div className="border-t border-primary/10 pt-4">
        <PanelGruposAsignados
          color="var(--primary)"
          entidadId={runa.id}
          grupoIds={runa.grupo_ids ?? []}
          grupos={grupos}
          label="Grupos de runas"
          labelMiembros="runas"
          loadingGrupos={loadingGrupos}
          mensajeVacio="Sin grupos asignados — categorizá esta runa (ej. Naturales, De fuego, Impacto rápido…)"
          modo="runas"
          placeholderBusqueda="Buscar grupo de runas…"
          textoBoton="Agregar grupo de runas"
          onGrupoIdsChange={onGrupoIdsChange}
        />
      </div>
    </div>
  );
}

// ─── Bloque de ensayo "Energias" (tag GOS + tag Magia) ─────────────────────
// Antes listaba todos los ensayos con ambas tags; ahora apunta a un ensayo
// único y fijo llamado "Energias" — se busca por título+tags, y si no existe
// todavía se crea automáticamente la primera vez que se abre Runas.
const TITULO_ENSAYO_ENERGIAS = "Energias";

function BloqueEnsayoEnergias(_props: { onOpenEnsayo?: (id: string) => void }) {
  const { ensayos, loading, crearNotaPendiente, actualizarLocal } = useEnsayoEditorLogic(null);
  const creandoRef = useRef(false);
  const [creando, setCreando] = useState(false);

  const ensayoEnergias = useMemo(
    () =>
      ensayos.find((e: any) => {
        const tags = (e.tags ?? []).map((t: string) => t.trim().toLowerCase());
        return (
          (e.titulo ?? "").trim().toLowerCase() === TITULO_ENSAYO_ENERGIAS.toLowerCase() &&
          tags.includes("gos") &&
          tags.includes("magia")
        );
      }),
    [ensayos],
  );

  // Auto-creación: solo una vez que terminó de cargar y confirmamos que no
  // existe. El ref evita que un doble-render dispare dos creaciones antes
  // de que el primer resultado llegue al estado.
  useEffect(() => {
    if (loading || ensayoEnergias || creandoRef.current) return;
    creandoRef.current = true;
    setCreando(true);
    void crearNotaPendiente(TITULO_ENSAYO_ENERGIAS, ["gos", "magia"]).finally(() => {
      setCreando(false);
      creandoRef.current = false;
    });
  }, [loading, ensayoEnergias, crearNotaPendiente]);

  if (loading || creando || !ensayoEnergias) {
    return (
      <div className="w-full py-6 text-xs text-primary/30 text-center mb-6">
        {creando ? "Creando ensayo…" : "Cargando…"}
      </div>
    );
  }

  return (
    <div className="mb-6">
      <RichEditor
        key={ensayoEnergias.id}
        value={ensayoEnergias.contenido || ""}
        onChange={(value) => actualizarLocal(ensayoEnergias.id, "contenido", value)}
        placeholder="Escribe aquí…"
        minHeight={220}
      />
    </div>
  );
}

// ─── Toggle "Sistema" / "Runas" ─────────────────────────────────────────────
// Sistema: ensayo (Energías) a la izquierda + subsistemas a la derecha,
// nada más. Runas: el bloque de herramientas de runas (probador, lista,
// config), sin ensayo ni subsistemas.
type SeccionMagia = "sistema" | "runas";

const SECCIONES_MAGIA: { key: SeccionMagia; label: string; Icon: React.ElementType }[] = [
  { key: "sistema", label: "Sistema", Icon: Sparkles },
  { key: "runas", label: "Runas", Icon: Waypoints },
];

function SelectorSeccionMagia({
  seccion,
  onCambiarSeccion,
}: {
  seccion: SeccionMagia;
  onCambiarSeccion: (seccion: SeccionMagia) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1 px-2 py-2">
      {SECCIONES_MAGIA.map(({ key, label, Icon }) => {
        const activa = seccion === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onCambiarSeccion(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-micro font-bold uppercase tracking-[0.12em] transition-colors ${
              activa ? "bg-primary/10 text-primary" : "text-primary/40 hover:text-primary/70"
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function RunasPage({
  runas,
  loading,
  onOpen,
  onCreate,
  creating,
  onOpenEnsayo,
  todasLasRunas,
  seleccionarRunaId,
  onActualizarRuna,
}: Props) {
  const {
    subsistemas,
    loading: loadingSubsistemas,
    creating: creandoSubsistema,
    crear: crearSubsistema,
    actualizar: actualizarSubsistema,
    eliminar: eliminarSubsistema,
  } = useSubsistemasMagia();
  const [subsistemaSeleccionadoId, setSubsistemaSeleccionadoId] = useState<string | null>(null);

  const subsistemaSeleccionado =
    subsistemas.find((s) => s.id === subsistemaSeleccionadoId) ?? null;

  const { config: configRunas, actualizar: actualizarConfigRunas } = useConfigRunas();

  // Grupos de runas — antes vivían en el editor externo de una runa
  // individual (FormularioRuna), recibidos por props. Ahora la asignación
  // de grupos se hace acá mismo, en el panel derecho.
  const { grupos, loading: loadingGrupos, sincronizarGruposDeRuna } = useGruposRunas();

  // Runa actualmente seleccionada en el grid (click para mostrar su
  // patrón + explicación/grupos, click de nuevo para esconder). Reemplaza
  // al editor aparte: ya no se navega a otra pantalla, todo pasa acá
  // mismo — el patrón ocupa el lugar del Probador y la explicación +
  // grupos ocupan la columna derecha.
  const [runaSeleccionadaId, setRunaSeleccionadaId] = useState<string | null>(null);
  const runaSeleccionada = useMemo(
    () => todasLasRunas?.find((r) => r.id === runaSeleccionadaId) ?? null,
    [todasLasRunas, runaSeleccionadaId],
  );

  const toggleSeleccionRuna = (id: string) => {
    setRunaSeleccionadaId((actual) => (actual === id ? null : id));
  };

  // Cuando el padre pide dejar seleccionada una runa puntual (ej. justo
  // después de crearla vía onCreate), la reflejamos acá.
  useEffect(() => {
    if (seleccionarRunaId) setRunaSeleccionadaId(seleccionarRunaId);
  }, [seleccionarRunaId]);

  const actualizarGrupoIdsDeRunaSeleccionada = (ids: string[]) => {
    if (!runaSeleccionada) return;
    const gruposAntes = runaSeleccionada.grupo_ids ?? [];
    void sincronizarGruposDeRuna(runaSeleccionada.id, gruposAntes, ids);
    void supabase.from("runas").update({ grupo_ids: ids }).eq("id", runaSeleccionada.id);
    onActualizarRuna?.(runaSeleccionada.id, { grupo_ids: ids });
  };

  // Trazo editado desde el panel que reemplaza al Probador cuando hay
  // una runa seleccionada — persiste directo, sin editor aparte.
  const actualizarPatronDeRunaSeleccionada = (trazos: Punto[][]) => {
    if (!runaSeleccionada) return;
    void supabase.from("runas").update({ patron_trazos: trazos }).eq("id", runaSeleccionada.id);
    onActualizarRuna?.(runaSeleccionada.id, { patron_trazos: trazos });
  };

  // Sección activa de la columna 1: "probador" (Probador de reconocimiento
  // $1) o "config" (tablero de forma/rejilla/separadores). Cuando está en
  // "config", la columna 2 se reserva para el editor de combinaciones en
  // vez del ensayo/subsistema.
  const [seccionProbadorConfig, setSeccionProbadorConfig] =
    useState<SeccionProbadorConfig>("probador");
  // Preview de la combinación en edición dentro del editor de
  // combinaciones (columna 2, sección "config") — se muestra en el
  // tablero de la columna 1.
  const [previewCombinacion, setPreviewCombinacion] = useState<PreviewCombinacion>(null);

  const [seccionMagia, setSeccionMagia] = useState<SeccionMagia>("sistema");

  // Modo pantalla completa: "probador" agranda el Probador de
  // reconocimiento solo; "combinaciones" agranda el render (preview) y
  // el editor de combinaciones lado a lado. null = layout normal.
  const [pantallaCompleta, setPantallaCompleta] = useState<
    "probador" | "combinaciones" | null
  >(null);

  if (loading && runas.length === 0) {
    return <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>;
  }

  // Sin onOpenEnsayo: comportamiento anterior, un solo bloque apilado
  // (no hay toggle Sistema/Runas porque no hay ensayo/subsistemas que
  // mostrar en "Sistema").
  if (!onOpenEnsayo) {
    return (
      <div>
        <BloqueRunas
          entidades={runas}
          creating={creating}
          onCreate={onCreate}
          runaSeleccionadaId={runaSeleccionadaId}
          onToggleSeleccion={toggleSeleccionRuna}
        />
        {todasLasRunas && (
          <div className="mt-6 space-y-6">
            {runaSeleccionada ? (
              <PatronRunaSeleccionada
                runa={runaSeleccionada}
                onPatronChange={actualizarPatronDeRunaSeleccionada}
              />
            ) : (
              <SelectorProbadorConfig
                seccion={seccionProbadorConfig}
                onCambiarSeccion={setSeccionProbadorConfig}
                runas={todasLasRunas}
                configRunas={configRunas}
                onActualizarConfigRunas={actualizarConfigRunas}
                previewCombinacion={previewCombinacion}
              />
            )}
            {runaSeleccionada ? (
              <DetalleRunaSeleccionada
                runa={runaSeleccionada}
                grupos={grupos}
                loadingGrupos={loadingGrupos}
                onGrupoIdsChange={actualizarGrupoIdsDeRunaSeleccionada}
              />
            ) : (
              seccionProbadorConfig === "config" && (
                <PanelCombinacionesRunas
                  runas={todasLasRunas}
                  onCambiarPreview={setPreviewCombinacion}
                />
              )
            )}
          </div>
        )}
      </div>
    );
  }

  // Vista con toggle "Sistema" / "Runas":
  //
  //   [Sistema | Runas]  ← toggle
  //
  //   Sistema:
  //     [Ensayo (izquierda)] [Subsistemas (derecha)]
  //     — nada más.
  //
  //   Runas:
  //     [Probador (cuadrado 1:1) + panel lateral Forma/Runa] [Config/preview]
  //     [Lista de runas                                    ] [   (arriba)  ]
  return (
    <div>
      <SelectorSeccionMagia seccion={seccionMagia} onCambiarSeccion={setSeccionMagia} />

      {seccionMagia === "sistema" ? (
        <div className="mt-4 flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            <BloqueEnsayoEnergias />
          </div>

          <div className="flex-1 min-w-0 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <BloqueSubsistemasMagia
              subsistemas={subsistemas}
              loading={loadingSubsistemas}
              creating={creandoSubsistema}
              crear={crearSubsistema}
              subsistemaSeleccionadoId={subsistemaSeleccionadoId}
              onSelect={setSubsistemaSeleccionadoId}
            />

            {subsistemaSeleccionado && (
              <PanelEditorSubsistema
                key={subsistemaSeleccionado.id}
                subsistema={subsistemaSeleccionado}
                onVolver={() => setSubsistemaSeleccionadoId(null)}
                onSave={(updates) => void actualizarSubsistema(subsistemaSeleccionado.id, updates)}
                onDelete={() => {
                  void eliminarSubsistema(subsistemaSeleccionado.id);
                  setSubsistemaSeleccionadoId(null);
                }}
                onSelectCriatura={(id) => onOpen("criaturas", id)}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col lg:flex-row gap-6">
          {/* Columna izquierda: Probador (o patrón de la runa seleccionada,
              arriba) + Lista de runas (abajo) */}
          <div className="flex-1 min-w-0 space-y-6">
            {todasLasRunas && runaSeleccionada && (
              <PatronRunaSeleccionada
                runa={runaSeleccionada}
                onPatronChange={actualizarPatronDeRunaSeleccionada}
              />
            )}

            {todasLasRunas && !runaSeleccionada && (
              <div className="rounded-2xl border border-primary/15 bg-white-custom/60 p-4 relative">
                <button
                  type="button"
                  onClick={() => setPantallaCompleta("probador")}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-primary/30 hover:text-primary/60 hover:bg-primary/5 transition-colors"
                  title="Ver probador en pantalla completa"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <p className="text-micro font-black uppercase tracking-widest text-primary/30 text-center mb-3">
                  Probador
                </p>
                <PanelDetectorUnificado runas={todasLasRunas} plantillasSeparadores={configRunas.plantillas_separadores} />
              </div>
            )}

            <BloqueRunas
              entidades={runas}
              creating={creating}
              onCreate={onCreate}
              runaSeleccionadaId={runaSeleccionadaId}
              onToggleSeleccion={toggleSeleccionRuna}
            />
          </div>

          {/* Columna derecha: si hay una runa seleccionada, su explicación +
              grupos asignados. Si no, el bloque de config (previsualización)
              + editor de combinaciones, lado a lado (comportamiento previo). */}
          <div className="flex-1 min-w-0 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            {runaSeleccionada ? (
              <DetalleRunaSeleccionada
                runa={runaSeleccionada}
                grupos={grupos}
                loadingGrupos={loadingGrupos}
                onGrupoIdsChange={actualizarGrupoIdsDeRunaSeleccionada}
              />
            ) : (
              todasLasRunas && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPantallaCompleta("combinaciones")}
                    className="absolute -top-1 right-0 z-10 p-1.5 rounded-lg text-primary/30 hover:text-primary/60 hover:bg-primary/5 transition-colors"
                    title="Ver render y combinaciones en pantalla completa"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 min-w-0">
                      <PanelConfigRunas
                        config={configRunas}
                        onActualizar={actualizarConfigRunas}
                        runas={todasLasRunas}
                        previewCombinacion={previewCombinacion}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <PanelCombinacionesRunas
                        runas={todasLasRunas}
                        onCambiarPreview={setPreviewCombinacion}
                      />
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Pantalla completa: Probador solo, usando todo el espacio */}
      {pantallaCompleta === "probador" && todasLasRunas && (
        <div className="fixed inset-0 z-50 bg-white-custom flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-primary/10">
            <p className="text-micro font-black uppercase tracking-widest text-primary/30">
              Probador
            </p>
            <button
              type="button"
              onClick={() => setPantallaCompleta(null)}
              className="p-1.5 rounded-lg text-primary/40 hover:text-primary/70 hover:bg-primary/5 transition-colors"
              title="Cerrar pantalla completa"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <PanelDetectorUnificado runas={todasLasRunas} plantillasSeparadores={configRunas.plantillas_separadores} />
          </div>
        </div>
      )}

      {/* Pantalla completa: render (preview) y editor de combinaciones,
          uno al lado del otro usando todo el espacio disponible */}
      {pantallaCompleta === "combinaciones" && todasLasRunas && (
        <div className="fixed inset-0 z-50 bg-white-custom flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-primary/10">
            <p className="text-micro font-black uppercase tracking-widest text-primary/30">
              Render y combinaciones
            </p>
            <button
              type="button"
              onClick={() => setPantallaCompleta(null)}
              className="p-1.5 rounded-lg text-primary/40 hover:text-primary/70 hover:bg-primary/5 transition-colors"
              title="Cerrar pantalla completa"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <div className="flex flex-col md:flex-row gap-6 h-full">
              <div className="flex-1 min-w-0">
                <PanelConfigRunas
                  config={configRunas}
                  onActualizar={actualizarConfigRunas}
                  runas={todasLasRunas}
                  previewCombinacion={previewCombinacion}
                />
              </div>
              <div className="flex-1 min-w-0">
                <PanelCombinacionesRunas
                  runas={todasLasRunas}
                  onCambiarPreview={setPreviewCombinacion}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
