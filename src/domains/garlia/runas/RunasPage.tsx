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

import { Atom, Beaker, Dna, Maximize2, Plus, ScrollText, Sparkles, Waypoints, X, Zap } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { EntityCard } from "@/domains/garlia/_shared/EntityCard";
import { usePanelFlotante } from "@/domains/garlia/_shared/usePanelFlotanteStore";
import type { SectionKey } from "@/domains/garlia/_shared/useMundoNavigationStore";
import { RichEditor } from "@/editor/lexical";
import { useEnsayoEditorLogic } from "@/editor/notas/hooks/useEnsayoEditorLogic";
import { SubBloqueSelector } from "@/editor/sub-bloques/SubBloqueSelector";
import { useSubBloquesDeEnsayo } from "@/editor/sub-bloques/useSubBloquesDeEnsayo";
import { supabase } from "@/infra/supabase/supabase";
import { SaveDot } from "@/ui/SaveDot";
import type { SaveStatus } from "@/ui/saveStatus";

import { ElementosPage } from "@/domains/garlia/elementos/ElementosPage";
import type { Elemento } from "@/domains/garlia/elementos/types";
import { BiologiaPage } from "@/domains/garlia/biologia/BiologiaPage";
import { SandboxPage } from "@/domains/garlia/sandbox/SandboxPage";
import { LogicaSistemaPage } from "./LogicaSistemaPage";
import { FisicaPage } from "@/domains/garlia/fisica/FisicaPage";
import { ORIS_CONFIG, type Oris } from "@/domains/garlia/fisica/types";
import { FISICA_CONCEPTOS_CONFIG, type FisicaConcepto } from "@/domains/garlia/fisica/types";
import {
  useFisicaConceptos,
  useIums,
  useParticulas,
  useParticulasBase,
} from "@/domains/garlia/fisica/useFisica";
import {
  useOrisConIums,
  sincronizarIumsDeOris,
} from "@/domains/garlia/fisica/useOrisConIums";

import {
  PanelCombinacionesRunas,
  SelectorProbadorConfig,
  type SeccionProbadorConfig,
} from "./BloqueProbadorYCombinaciones";
import type { Punto } from "./dollarOneRecognizer";
import { PanelConfigRunas, type PreviewCombinacion } from "./PanelConfigRunas";
import { PanelDetectorUnificado } from "./PanelDetectorUnificado";
import { PanelGruposAsignados } from "./PanelGruposAsignados";
import { PanelPatronRuna } from "./PanelPatronRuna";
import { RunaThumbnail } from "./RunaThumbnail";
import type { EntidadMagica, GrupoMin, RangoAcierto } from "./types";
import { RANGOS_ACIERTO } from "./types";
import { useConfigRunas } from "./useConfigRunas";
import { useGruposRunas } from "./useGruposRunas";
import { useSubsistemasMagia } from "./useSubsistemasMagia";
import {
  useMagiaSeccionStore,
  type SeccionMagia,
  type SubSeccionQuimica,
} from "./useMagiaSeccionStore";

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

  // ── Tabla Química (Elementos) ──────────────────────────────────────
  // Tercera pill del toggle Sistema/Runas/Tabla. Todas opcionales: si no
  // se pasa `elementos`, la pill "Tabla" ni se muestra (mismo criterio
  // que onOpenEnsayo/subsistemas para "Sistema").
  elementos?: Elemento[];
  loadingElementos?: boolean;
  creatingElemento?: boolean;
  onCreateElemento?: () => void;
  onActualizarElemento?: (id: string, cambios: Partial<Elemento>) => void;
  onEliminarElemento?: (id: string) => void;
  seleccionarElementoId?: string | null;
  onImportarElementos?: (elementos: Omit<Elemento, "id">[]) => Promise<number>;
  onEliminarVariosElementos?: (ids: string[]) => Promise<void>;
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
 * mismo, sin pasar por un editor aparte. El nombre también es editable
 * inline, arriba del canvas.
 */
function PatronRunaSeleccionada({
  runa,
  onPatronChange,
  onNombreChange,
}: {
  runa: EntidadMagica;
  onPatronChange: (trazos: Punto[][]) => void;
  onNombreChange: (nombre: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-primary/15 bg-white-custom/60 p-4">
      <input
        type="text"
        value={runa.nombre}
        onChange={(e) => onNombreChange(e.target.value)}
        placeholder="Nombre de la runa"
        className="w-full bg-transparent text-micro font-black uppercase tracking-widest text-primary/70 text-center mb-3 outline-none placeholder:text-primary/25 focus:text-primary"
      />
      <PanelPatronRuna patronTrazos={runa.patron_trazos ?? []} onChange={onPatronChange} />
    </div>
  );
}

/**
 * Explicación (editable) de la runa seleccionada + grupos asignados,
 * debajo. Vive en la columna derecha (donde antes iba el editor de
 * combinaciones/config) mientras haya una runa seleccionada.
 *
 * Además de la explicación general, permite definir una explicación
 * distinta por rango de precisión del trazo (feedback progresivo al
 * jugador) — cada rango cae a la explicación general si se deja vacío.
 */
function DetalleRunaSeleccionada({
  runa,
  grupos,
  loadingGrupos,
  onGrupoIdsChange,
  onExplicacionChange,
  onExplicacionPorRangoChange,
}: {
  runa: EntidadMagica;
  grupos: GrupoMin[];
  loadingGrupos: boolean;
  onGrupoIdsChange: (ids: string[]) => void;
  onExplicacionChange: (explicacion: string) => void;
  onExplicacionPorRangoChange: (rango: RangoAcierto, texto: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-primary/15 bg-white-custom/60 p-4 space-y-4">
      <div className="space-y-1.5">
        <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35">
          Explicación
        </label>
        <RichEditor
          key={runa.id}
          value={runa.explicacion || ""}
          onChange={onExplicacionChange}
          placeholder="Qué significa esta runa, cómo se activa, su poder…"
          minHeight={140}
        />
      </div>

      <div className="border-t border-primary/10 pt-4 space-y-3">
        <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35">
          Explicación por precisión del trazo
        </label>
        <p className="text-micro text-primary/30 -mt-1.5">
          Opcional — si se deja vacío, ese rango usa la explicación general de arriba.
        </p>
        {RANGOS_ACIERTO.map((r) => (
          <div key={r.key} className="space-y-1">
            <span className="text-micro font-bold text-primary/45">{r.label}</span>
            <RichEditor
              key={`${runa.id}-${r.key}`}
              value={runa.explicacion_por_rango?.[r.key] || ""}
              onChange={(texto) => onExplicacionPorRangoChange(r.key, texto)}
              placeholder="Explicación para este rango…"
              minHeight={80}
            />
          </div>
        ))}
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
  const { ensayos, loading, crearNotaPendiente, actualizarLocal, saveStatus } = useEnsayoEditorLogic(null);
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
      <BloqueEnsayoConSubBloques
        ensayo={ensayoEnergias}
        actualizarLocal={actualizarLocal}
        saveStatus={saveStatus}
      />
    </div>
  );
}

// ─── Bloque "Física" (Oris + catálogos + conceptos) ────────────────────────
// Self-contained: trae sus propios datos (useOris/useFisicaConceptos) desde
// Supabase, igual que ElementosPage recibe los suyos por props desde
// RunasPage — pero acá se resuelve todo adentro para no ensuciar más la
// firma de Props de RunasPage con otro bloque de campos opcionales.
function BloqueFisica({
  seleccionarOrisId,
  onOrisSeleccionadoChange,
  onSelectCriatura,
}: {
  seleccionarOrisId?: string | null;
  /** Notifica cada vez que cambia el Oris abierto — RunasPage lo persiste
   *  en useMagiaSeccionStore para reabrirlo tras un refresh. */
  onOrisSeleccionadoChange?: (id: string | null) => void;
  onSelectCriatura?: (id: string) => void;
}) {
  const { items: particulaBase, loading: loadingParticulaBase } = useParticulasBase();
  const { items: particulas, loading: loadingParticulas } = useParticulas();
  const { items: iums, loading: loadingIums } = useIums();
  const { items: oris, setItems: setOris, loading: loadingOris } = useOrisConIums();
  const { items: conceptos, setItems: setConceptos, loading: loadingConceptos } =
    useFisicaConceptos();
  const [creating, setCreating] = useState(false);

  // Subsistemas de Magia — se muestran como chips al final de Física; al
  // seleccionar uno se abre en un modal flotante (antes vivía inline en
  // la columna derecha de "Sistema").
  const {
    subsistemas,
    loading: loadingSubsistemas,
    creating: creandoSubsistema,
    crear: crearSubsistema,
    actualizar: actualizarSubsistema,
    eliminar: eliminarSubsistema,
  } = useSubsistemasMagia();

  async function handleCreate() {
    setCreating(true);
    try {
      const siguienteOrden = oris.reduce((max, o) => Math.max(max, o.orden ?? 0), 0) + 1;
      const { data, error } = await supabase
        .from(ORIS_CONFIG.tabla)
        .insert([{ orden: siguienteOrden, nombre: "Nuevo Oris", familia: "Mecánica", formula: "", dominio: "" }])
        .select()
        .single();
      if (error) throw error;
      setOris((prev) => [...prev, data as Oris]);
    } catch (e) {
      console.error("[BloqueFisica] error creando Oris:", e);
    } finally {
      setCreating(false);
    }
  }

  async function handleEliminar(id: string) {
    try {
      const { error } = await supabase.from(ORIS_CONFIG.tabla).delete().eq("id", id);
      if (error) throw error;
      setOris((prev) => prev.filter((o) => o.id !== id));
    } catch (e) {
      console.error("[BloqueFisica] error eliminando Oris:", e);
    }
  }

  // Inserta un lote de Oris y/o conceptos ya parseados/validados por
  // FisicaPage (parsearArchivoFisicaJSON) — mismo insert que handleCreate
  // pero con varias filas a la vez, para el botón "Subir JSON".
  async function handleImportarFisica(
    orisNuevos: Omit<Oris, "id">[],
    conceptosNuevos: Omit<FisicaConcepto, "id">[],
  ) {
    let total = 0;
    if (orisNuevos.length > 0) {
      // Fase 3 del rediseño: iums_composicion (jsonb) ya no se manda al
      // insert base — se crean las filas de Oris "vacías" de composición
      // y se sincroniza cada una contra oris_iums después, mismo criterio
      // que sincronizarComponentesCompuesto en Compuestos (Fase 2).
      const orisSinComposicion = orisNuevos.map(({ iums_composicion, ...resto }) => resto);
      const { data, error } = await supabase
        .from(ORIS_CONFIG.tabla)
        .insert(orisSinComposicion)
        .select();
      if (error) throw error;
      const insertados = (data ?? []) as Oris[];

      for (let i = 0; i < insertados.length; i++) {
        const composicion = orisNuevos[i]?.iums_composicion;
        if (composicion && Object.keys(composicion).length > 0) {
          await sincronizarIumsDeOris(insertados[i].id, composicion);
        }
      }

      setOris((prev) => [
        ...prev,
        ...insertados.map((o, i) => ({ ...o, iums_composicion: orisNuevos[i]?.iums_composicion ?? {} })),
      ]);
      total += insertados.length;
    }
    if (conceptosNuevos.length > 0) {
      const { data, error } = await supabase
        .from(FISICA_CONCEPTOS_CONFIG.tabla)
        .insert(conceptosNuevos)
        .select();
      if (error) throw error;
      const insertados = (data ?? []) as FisicaConcepto[];
      setConceptos((prev) => [...prev, ...insertados]);
      total += insertados.length;
    }
    return total;
  }

  // Actualiza (upsert) un lote de Oris y/o conceptos ya existentes cuyo
  // nombre (Oris) o bloque+titulo (conceptos) coincidió con uno del JSON
  // subido — mismo patrón que handleImportarFisica pero con UPDATE en vez
  // de INSERT, uno por fila.
  async function handleActualizarVariosFisica(
    orisActualizar: (Partial<Oris> & { id: string })[],
    conceptosActualizar: (Partial<FisicaConcepto> & { id: string })[],
  ) {
    let actualizados = 0;

    for (const { id, iums_composicion, ...datos } of orisActualizar) {
      // Fase 3: iums_composicion se sincroniza aparte contra oris_iums,
      // el resto de columnas sigue actualizándose igual que siempre.
      if (Object.keys(datos).length > 0) {
        const { error } = await supabase.from(ORIS_CONFIG.tabla).update(datos).eq("id", id);
        if (error) {
          console.error("[BloqueFisica] error actualizando Oris", id, error);
          continue;
        }
      }
      if (iums_composicion !== undefined) {
        const ok = await sincronizarIumsDeOris(id, iums_composicion);
        if (!ok) {
          console.error("[BloqueFisica] error sincronizando iums de Oris", id);
          continue;
        }
      }
      actualizados++;
    }
    if (orisActualizar.length > 0) {
      setOris((prev) =>
        prev.map((o) => {
          const cambio = orisActualizar.find((c) => c.id === o.id);
          return cambio ? { ...o, ...cambio } : o;
        }),
      );
    }

    for (const { id, ...datos } of conceptosActualizar) {
      const { error } = await supabase.from(FISICA_CONCEPTOS_CONFIG.tabla).update(datos).eq("id", id);
      if (error) {
        console.error("[BloqueFisica] error actualizando concepto", id, error);
        continue;
      }
      actualizados++;
    }
    if (conceptosActualizar.length > 0) {
      setConceptos((prev) =>
        prev.map((c) => {
          const cambio = conceptosActualizar.find((x) => x.id === c.id);
          return cambio ? { ...c, ...cambio } : c;
        }),
      );
    }

    return actualizados;
  }

  return (
    <div>
      <FisicaPage
        particulaBase={particulaBase}
        loadingParticulaBase={loadingParticulaBase}
        particulas={particulas}
        loadingParticulas={loadingParticulas}
        iums={iums}
        loadingIums={loadingIums}
        oris={oris}
        loadingOris={loadingOris}
        creatingOris={creating}
        onCreateOris={handleCreate}
        onActualizarOris={(id, cambios) =>
          setOris((prev) => prev.map((o) => (o.id === id ? { ...o, ...cambios } : o)))
        }
        onEliminarOris={handleEliminar}
        seleccionarOrisId={seleccionarOrisId}
        onOrisSeleccionadoChange={onOrisSeleccionadoChange}
        conceptos={conceptos}
        loadingConceptos={loadingConceptos}
        onActualizarConcepto={(id, cambios) =>
          setConceptos((prev) => prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)))
        }
        onImportarFisica={handleImportarFisica}
        onActualizarVariosFisica={handleActualizarVariosFisica}
        subsistemas={subsistemas}
        loadingSubsistemas={loadingSubsistemas}
        creandoSubsistema={creandoSubsistema}
        onCrearSubsistema={crearSubsistema}
        onActualizarSubsistema={(id, updates) => void actualizarSubsistema(id, updates)}
        onEliminarSubsistema={(id) => void eliminarSubsistema(id)}
        onSelectCriatura={onSelectCriatura}
      />
    </div>
  );
}

// ─── Bloque de ensayo "Runas" (tag GOS + tag Runas) ─────────────────────────
// Mismo patrón que BloqueEnsayoEnergias: un ensayo único y fijo, buscado
// por título+tags, que se crea automáticamente la primera vez que se abre
// la sección Runas si todavía no existe. Vive en la columna derecha de la
// vista "Runas", debajo (o al lado) del editor de combinaciones / detalle
// de runa seleccionada.
const TITULO_ENSAYO_RUNAS = "Runas";

function BloqueEnsayoRunas(_props: { onOpenEnsayo?: (id: string) => void }) {
  const { ensayos, loading, crearNotaPendiente, actualizarLocal, saveStatus } = useEnsayoEditorLogic(null);
  const creandoRef = useRef(false);
  const [creando, setCreando] = useState(false);

  const ensayoRunas = useMemo(
    () =>
      ensayos.find((e: any) => {
        const tags = (e.tags ?? []).map((t: string) => t.trim().toLowerCase());
        return (
          (e.titulo ?? "").trim().toLowerCase() === TITULO_ENSAYO_RUNAS.toLowerCase() &&
          tags.includes("gos") &&
          tags.includes("runas")
        );
      }),
    [ensayos],
  );

  useEffect(() => {
    if (loading || ensayoRunas || creandoRef.current) return;
    creandoRef.current = true;
    setCreando(true);
    void crearNotaPendiente(TITULO_ENSAYO_RUNAS, ["gos", "runas"]).finally(() => {
      setCreando(false);
      creandoRef.current = false;
    });
  }, [loading, ensayoRunas, crearNotaPendiente]);

  if (loading || creando || !ensayoRunas) {
    return (
      <div className="w-full py-6 text-xs text-primary/30 text-center mb-6">
        {creando ? "Creando ensayo…" : "Cargando…"}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/15 bg-white-custom/60 p-4">
      <p className="text-micro font-black uppercase tracking-widest text-primary/30 text-center mb-3">
        Ensayo
      </p>
      <BloqueEnsayoConSubBloques
        ensayo={ensayoRunas}
        actualizarLocal={actualizarLocal}
        saveStatus={saveStatus}
      />
    </div>
  );
}

// ─── Wrapper compartido: RichEditor + selector de sub-bloques ──────────────
// Ambos bloques de ensayo de arriba (Energías, Runas) tienen la misma
// necesidad — alternar entre el documento principal y sus sub-bloques —
// así que la lógica vive una sola vez acá en vez de duplicarse en cada
// función. Mismo patrón que markdownBlock en EditorEnsayo.tsx, pero sin
// el resto del shell (TOC, layout boxes, citas) que no aplica en este
// contexto lateral de RunasPage.
function BloqueEnsayoConSubBloques({
  ensayo,
  actualizarLocal,
  saveStatus,
}: {
  ensayo: any;
  actualizarLocal: (id: string, field: string, value: any, extra?: any) => void;
  saveStatus?: SaveStatus;
}) {
  const {
    subBloques,
    activeBloqueId,
    setActiveBloqueId,
    activeSubBloque,
    handleCreateSubBloque,
    handleRenameSubBloque,
    handleDeleteSubBloque,
    handleSubBloqueContenidoChange,
  } = useSubBloquesDeEnsayo(ensayo.id, ensayo.sub_bloques, actualizarLocal);

  // Mismo propósito que en EditorEnsayo.tsx: alimentar la opción "todas
  // las secciones" del menú de exportar de RichEditor.
  const allSections = useMemo(
    () => [
      { nombre: ensayo.titulo || "Documento principal", contenido: ensayo.contenido || "" },
      ...subBloques.map((b) => ({ nombre: b.nombre, contenido: b.contenido })),
    ],
    [ensayo.titulo, ensayo.contenido, subBloques],
  );

  return (
    <div>
      <div className="flex items-center gap-2 pb-2">
        <SaveDot status={saveStatus ?? "idle"} />
        <SubBloqueSelector
          activeId={activeBloqueId}
          bloques={subBloques}
          onCreate={handleCreateSubBloque}
          onDelete={handleDeleteSubBloque}
          onRename={handleRenameSubBloque}
          onSelect={setActiveBloqueId}
        />
      </div>

      {activeSubBloque ? (
        <RichEditor
          key={`${ensayo.id}-${activeSubBloque.id}`}
          allSections={allSections}
          value={activeSubBloque.contenido}
          onChange={(value) =>
            handleSubBloqueContenidoChange(activeSubBloque.id, value)
          }
          placeholder={`escribiendo en "${activeSubBloque.nombre}"...`}
          minHeight={220}
        />
      ) : (
        <RichEditor
          key={ensayo.id}
          allSections={allSections}
          value={ensayo.contenido || ""}
          onChange={(value) => actualizarLocal(ensayo.id, "contenido", value)}
          placeholder="Escribe aquí…"
          minHeight={220}
        />
      )}
    </div>
  );
}

// ─── Toggle "Runas" / "Tabla" / "Física" / "Biología" / "Sandbox" / "Lógica" ─
// Runas: el bloque de herramientas de runas (probador, lista, config), sin
// ensayo. Tabla: grid de Elementos (Tabla Química/Alquímica) + detalle,
// solo si se pasan props de elementos. Física: grid de Oris + catálogos
// fijos + conceptos, y al final los Subsistemas de Magia (chips que abren
// en modal flotante) — ver BloqueFisica más abajo. Biología:
// taxonomía/ecosistemas/perfiles. Sandbox: entorno experimental aislado
// (crear simulación, entidades, disparar eventos, Play/Pause/Step/Reset) —
// ver domains/garlia/sandbox/SandboxPage.tsx. Lógica: mapa de capas del
// sistema entero en lenguaje humano, leído de documentacion_sistema — ver
// LogicaSistemaPage.tsx.
// SeccionMagia se importa (y persiste) desde useMagiaSeccionStore.ts —
// arriba, junto al resto de imports del store.

// Física y Biología ya no son tabs propias acá — su contenido se movió
// adentro de "Química" como sub-secciones (ver SelectorSubSeccionQuimica
// más abajo), respetando la jerarquía Partículas Base > Partículas >
// Elementos que ya tenían.
const SECCIONES_MAGIA: { key: SeccionMagia; label: string; Icon: React.ElementType }[] = [
  { key: "runas", label: "Runas", Icon: Waypoints },
  { key: "tabla", label: "Química", Icon: Atom },
  { key: "sandbox", label: "Sandbox", Icon: Beaker },
  { key: "logica", label: "Lógica", Icon: Sparkles },
];

// ─── Submenú interno de "Química": Tabla / Física / Biología ───────────────
// Reemplaza a las antiguas tabs de nivel superior "Física" y "Biología".
// Misma jerarquía de siempre (Partículas Base > Partículas > Iums > Oris
// para Física; Elementos > Compuestos > … para Química/Tabla; Cladística
// > Tejidos > Órganos para Biología), ahora navegable desde acá en vez de
// todo apilado y scrolleable en una sola vista.
const SUBSECCIONES_QUIMICA: { key: SubSeccionQuimica; label: string; Icon: React.ElementType }[] = [
  { key: "tabla", label: "Tabla", Icon: Atom },
  { key: "fisica", label: "Física", Icon: Zap },
  { key: "biologia", label: "Biología", Icon: Dna },
];

function SelectorSubSeccionQuimica({
  sub,
  onCambiarSub,
}: {
  sub: SubSeccionQuimica;
  onCambiarSub: (sub: SubSeccionQuimica) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-primary/10 pb-2 mb-4">
      {SUBSECCIONES_QUIMICA.map(({ key, label, Icon }) => {
        const activa = sub === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onCambiarSub(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-micro font-bold uppercase tracking-[0.1em] transition-colors ${
              activa
                ? "bg-primary/10 text-primary"
                : "text-primary/40 hover:text-primary/70 hover:bg-primary/5"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function SelectorSeccionMagia({
  seccion,
  onCambiarSeccion,
  mostrarTabla,
}: {
  seccion: SeccionMagia;
  onCambiarSeccion: (seccion: SeccionMagia) => void;
  mostrarTabla?: boolean;
}) {
  const opciones = mostrarTabla
    ? SECCIONES_MAGIA
    : SECCIONES_MAGIA.filter((s) => s.key !== "tabla");
  return (
    <div className="flex items-center justify-center gap-0.5">
      {opciones.map(({ key, label, Icon }) => {
        const activa = seccion === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onCambiarSeccion(key)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] transition-colors ${
              activa ? "bg-primary/10 text-primary" : "text-primary/35 hover:text-primary/60"
            }`}
          >
            <Icon size={11} />
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
  elementos,
  loadingElementos,
  creatingElemento,
  onCreateElemento,
  onActualizarElemento,
  onEliminarElemento,
  seleccionarElementoId,
  onImportarElementos,
  onEliminarVariosElementos,
}: Props) {
  const { config: configRunas, actualizar: actualizarConfigRunas } = useConfigRunas();
  const abrirPanel = usePanelFlotante((s) => s.abrir);

  // Grupos de runas — antes vivían en el editor externo de una runa
  // individual (FormularioRuna), recibidos por props. Ahora la asignación
  // de grupos se hace acá mismo, en el panel derecho.
  const { grupos, loading: loadingGrupos, sincronizarGruposDeRuna } = useGruposRunas();

  // Sub-tab activa de Magia (Runas/Química/Física/Biología) + item
  // seleccionado dentro de cada una — persistidos vía useMagiaSeccionStore
  // (Zustand + localStorage) para sobrevivir a un refresh de página; antes
  // eran useState locales que se perdían siempre al recargar.
  const seccionMagia = useMagiaSeccionStore((s) => s.seccion);
  const setSeccionMagia = useMagiaSeccionStore((s) => s.setSeccion);
  const itemPorSeccion = useMagiaSeccionStore((s) => s.itemPorSeccion);
  const setItemDeSeccion = useMagiaSeccionStore((s) => s.setItem);
  // Sub-tab interna de "Química" (Tabla/Física/Biología) — reemplaza a
  // las antiguas tabs de nivel superior "Física" y "Biología".
  const subSeccionQuimica = useMagiaSeccionStore((s) => s.subSeccionQuimica);
  const setSubSeccionQuimica = useMagiaSeccionStore((s) => s.setSubSeccionQuimica);

  // Runa actualmente seleccionada en el grid (click para mostrar su
  // patrón + explicación/grupos, click de nuevo para esconder). Reemplaza
  // al editor aparte: ya no se navega a otra pantalla, todo pasa acá
  // mismo — el patrón ocupa el lugar del Probador y la explicación +
  // grupos ocupan la columna derecha.
  const runaSeleccionadaId = itemPorSeccion.runas ?? null;
  const setRunaSeleccionadaId = (
    valor: string | null | ((actual: string | null) => string | null),
  ) => {
    const nuevo = typeof valor === "function" ? valor(runaSeleccionadaId) : valor;
    setItemDeSeccion("runas", nuevo);
  };
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

  // Nombre y explicación editables inline en el panel derecho —
  // reemplazan al editor aparte para estos dos campos también.
  const actualizarNombreDeRunaSeleccionada = (nombre: string) => {
    if (!runaSeleccionada) return;
    void supabase.from("runas").update({ nombre }).eq("id", runaSeleccionada.id);
    onActualizarRuna?.(runaSeleccionada.id, { nombre });
  };

  const actualizarExplicacionDeRunaSeleccionada = (explicacion: string) => {
    if (!runaSeleccionada) return;
    void supabase.from("runas").update({ explicacion }).eq("id", runaSeleccionada.id);
    onActualizarRuna?.(runaSeleccionada.id, { explicacion });
  };

  // Explicación específica de un rango de acierto (feedback progresivo al
  // jugador según qué tan preciso fue su trazo).
  const actualizarExplicacionPorRangoDeRunaSeleccionada = (rango: RangoAcierto, texto: string) => {
    if (!runaSeleccionada) return;
    const actualizado = { ...(runaSeleccionada.explicacion_por_rango ?? {}), [rango]: texto };
    void supabase
      .from("runas")
      .update({ explicacion_por_rango: actualizado })
      .eq("id", runaSeleccionada.id);
    onActualizarRuna?.(runaSeleccionada.id, { explicacion_por_rango: actualizado });
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

  // seccionMagia ahora vive en useMagiaSeccionStore (ver arriba, junto a
  // runaSeleccionadaId) — persiste entre recargas.

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
                onNombreChange={actualizarNombreDeRunaSeleccionada}
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
                onExplicacionChange={actualizarExplicacionDeRunaSeleccionada}
                onExplicacionPorRangoChange={actualizarExplicacionPorRangoDeRunaSeleccionada}
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

  // Vista con toggle "Runas" / "Tabla" / "Física" / "Biología" (ver
  // SelectorSeccionMagia más arriba). El bloque de abajo (fuera de
  // tabla/física/biología) es la vista "Runas":
  //
  //   [Probador (cuadrado 1:1) + panel lateral Forma/Runa] [Config/preview]
  //   [Lista de runas                                    ] [   (arriba)  ]
  return (
    <div>
      <SelectorSeccionMagia
        seccion={seccionMagia}
        onCambiarSeccion={setSeccionMagia}
        mostrarTabla={!!elementos}
      />

      {seccionMagia === "tabla" && elementos ? (
        <div className="mt-4">
          <SelectorSubSeccionQuimica
            sub={subSeccionQuimica}
            onCambiarSub={setSubSeccionQuimica}
          />

          {subSeccionQuimica === "tabla" ? (
            <ElementosPage
              elementos={elementos}
              loading={loadingElementos}
              creating={creatingElemento}
              onCreate={onCreateElemento}
              onActualizar={onActualizarElemento ?? (() => {})}
              onEliminar={onEliminarElemento}
              seleccionarId={seleccionarElementoId ?? itemPorSeccion.tabla ?? null}
              onSeleccionarIdChange={(id) => setItemDeSeccion("tabla", id)}
              onImportarElementos={onImportarElementos}
              onEliminarVarios={onEliminarVariosElementos}
            />
          ) : subSeccionQuimica === "fisica" ? (
            <BloqueFisica
              seleccionarOrisId={itemPorSeccion.fisica ?? null}
              onOrisSeleccionadoChange={(id) => setItemDeSeccion("fisica", id)}
              onSelectCriatura={(id) => abrirPanel("criatura", id)}
            />
          ) : (
            <BiologiaPage onSelectCriatura={(id) => abrirPanel("criatura", id)} />
          )}
        </div>
      ) : seccionMagia === "sandbox" ? (
        <div className="mt-4">
          <SandboxPage />
        </div>
      ) : seccionMagia === "logica" ? (
        <div className="mt-4">
          <LogicaSistemaPage />
        </div>
      ) : (
        <div className="mt-4 flex flex-col lg:flex-row gap-6">
          {/* Columna izquierda: toggle Probador/Config (o patrón de la runa
              seleccionada, arriba) + Lista de runas (abajo) */}
          <div className="flex-1 min-w-0 space-y-6">
            {todasLasRunas && runaSeleccionada && (
              <PatronRunaSeleccionada
                runa={runaSeleccionada}
                onPatronChange={actualizarPatronDeRunaSeleccionada}
                onNombreChange={actualizarNombreDeRunaSeleccionada}
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
                <SelectorProbadorConfig
                  seccion={seccionProbadorConfig}
                  onCambiarSeccion={setSeccionProbadorConfig}
                  runas={todasLasRunas}
                  configRunas={configRunas}
                  onActualizarConfigRunas={actualizarConfigRunas}
                  previewCombinacion={previewCombinacion}
                />
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
              grupos asignados. Si no, el editor de combinaciones (solo
              cuando la sección activa a la izquierda es "config") seguido
              del ensayo de Runas (tags GOS + Runas). */}
          <div className="flex-1 min-w-0 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto space-y-6">
            {runaSeleccionada ? (
              <DetalleRunaSeleccionada
                runa={runaSeleccionada}
                grupos={grupos}
                loadingGrupos={loadingGrupos}
                onGrupoIdsChange={actualizarGrupoIdsDeRunaSeleccionada}
                onExplicacionChange={actualizarExplicacionDeRunaSeleccionada}
                onExplicacionPorRangoChange={actualizarExplicacionPorRangoDeRunaSeleccionada}
              />
            ) : (
              todasLasRunas && (
                <>
                  {seccionProbadorConfig === "config" && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setPantallaCompleta("combinaciones")}
                        className="absolute -top-1 right-0 z-10 p-1.5 rounded-lg text-primary/30 hover:text-primary/60 hover:bg-primary/5 transition-colors"
                        title="Ver render y combinaciones en pantalla completa"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                      <PanelCombinacionesRunas
                        runas={todasLasRunas}
                        onCambiarPreview={setPreviewCombinacion}
                      />
                    </div>
                  )}
                  <BloqueEnsayoRunas />
                </>
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
