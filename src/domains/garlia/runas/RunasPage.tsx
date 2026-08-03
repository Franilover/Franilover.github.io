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

import { Plus, ScrollText, Sparkles, Waypoints } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { EntityCard } from "@/domains/garlia/_shared/EntityCard";
import type { SectionKey } from "@/domains/garlia/_shared/useMundoNavigationStore";
import { RichEditor } from "@/editor/lexical";
import { useEnsayoEditorLogic } from "@/editor/notas/hooks/useEnsayoEditorLogic";

import {
  PanelCombinacionesRunas,
  SelectorProbadorConfig,
  type SeccionProbadorConfig,
} from "./BloqueProbadorYCombinaciones";
import { BloqueSubsistemasMagia, PanelEditorSubsistema } from "./BloqueSubsistemasMagia";
import type { Punto } from "./dollarOneRecognizer";
import { PanelConfigRunas, type PreviewCombinacion } from "./PanelConfigRunas";
import { PanelDetectorUnificado } from "./PanelDetectorUnificado";
import { RunaThumbnail } from "./RunaThumbnail";
import type { EntidadMagica } from "./types";
import { useConfigRunas } from "./useConfigRunas";
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
}

function BloqueRunas({
  entidades,
  onOpen,
  onCreate,
  creating,
}: {
  entidades: EntidadMagicaMin[];
  onOpen: (section: SectionKey, id: string) => void;
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
            {entidades.map((e) => (
              <EntityCard
                key={e.id}
                nombre={e.nombre}
                imageUrl={null}
                Icon={ScrollText}
                visual={<RunaThumbnail patronTrazos={e.patron_trazos} />}
                onClick={() => onOpen("runas", e.id)}
              />
            ))}
          </div>
        )}
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

  if (loading && runas.length === 0) {
    return <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>;
  }

  // Sin onOpenEnsayo: comportamiento anterior, un solo bloque apilado
  // (no hay toggle Sistema/Runas porque no hay ensayo/subsistemas que
  // mostrar en "Sistema").
  if (!onOpenEnsayo) {
    return (
      <div>
        <BloqueRunas entidades={runas} creating={creating} onCreate={onCreate} onOpen={onOpen} />
        {todasLasRunas && (
          <div className="mt-6 space-y-6">
            <SelectorProbadorConfig
              seccion={seccionProbadorConfig}
              onCambiarSeccion={setSeccionProbadorConfig}
              runas={todasLasRunas}
              configRunas={configRunas}
              onActualizarConfigRunas={actualizarConfigRunas}
              previewCombinacion={previewCombinacion}
            />
            {seccionProbadorConfig === "config" && (
              <PanelCombinacionesRunas
                runas={todasLasRunas}
                onCambiarPreview={setPreviewCombinacion}
              />
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
          {/* Columna izquierda: Probador (arriba) + Lista de runas (abajo) */}
          <div className="flex-1 min-w-0 space-y-6">
            {todasLasRunas && (
              <div className="rounded-2xl border border-primary/15 bg-white-custom/60 p-4">
                <p className="text-micro font-black uppercase tracking-widest text-primary/30 text-center mb-3">
                  Probador
                </p>
                <PanelDetectorUnificado runas={todasLasRunas} />
              </div>
            )}

            <BloqueRunas entidades={runas} creating={creating} onCreate={onCreate} onOpen={onOpen} />
          </div>

          {/* Columna derecha: bloque de config (previsualización) */}
          <div className="flex-1 min-w-0 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            {todasLasRunas && (
              <PanelConfigRunas
                config={configRunas}
                onActualizar={actualizarConfigRunas}
                runas={todasLasRunas}
                previewCombinacion={previewCombinacion}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
