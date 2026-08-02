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

import { Plus, ScrollText } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { EntityCard } from "@/domains/garlia/_shared/EntityCard";
import type { SectionKey } from "@/domains/garlia/_shared/useMundoNavigationStore";
import { RichEditor } from "@/editor/lexical";
import { useEnsayoEditorLogic } from "@/editor/notas/hooks/useEnsayoEditorLogic";

import { BloqueProbadorYCombinaciones } from "./BloqueProbadorYCombinaciones";
import { BloqueSubsistemasMagia, PanelEditorSubsistema } from "./BloqueSubsistemasMagia";
import type { Punto } from "./dollarOneRecognizer";
import { RunaThumbnail } from "./RunaThumbnail";
import type { EntidadMagica } from "./types";
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

  if (loading && runas.length === 0) {
    return <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>;
  }

  // Sin onOpenEnsayo: comportamiento anterior, un solo bloque.
  if (!onOpenEnsayo) {
    return (
      <div>
        <BloqueRunas entidades={runas} creating={creating} onCreate={onCreate} onOpen={onOpen} />
      </div>
    );
  }

  // Vista dividida: mitad izquierda = runas + herramientas,
  // mitad derecha = ensayo de Energías — o, si hay un subsistema
  // seleccionado, su editor reemplaza al ensayo en ese mismo lugar (en
  // vez de abrirse en un modal flotante encima de todo).
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <BloqueSubsistemasMagia
          subsistemas={subsistemas}
          loading={loadingSubsistemas}
          creating={creandoSubsistema}
          crear={crearSubsistema}
          subsistemaSeleccionadoId={subsistemaSeleccionadoId}
          onSelect={setSubsistemaSeleccionadoId}
        />

        <div className="mt-6">
          <BloqueRunas entidades={runas} creating={creating} onCreate={onCreate} onOpen={onOpen} />
        </div>

        {todasLasRunas && (
          <div className="mt-6">
            <BloqueProbadorYCombinaciones runas={todasLasRunas} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        {subsistemaSeleccionado ? (
          <PanelEditorSubsistema
            key={subsistemaSeleccionado.id}
            subsistema={subsistemaSeleccionado}
            onVolver={() => setSubsistemaSeleccionadoId(null)}
            onSave={(updates) => void actualizarSubsistema(subsistemaSeleccionado.id, updates)}
            onDelete={() => {
              void eliminarSubsistema(subsistemaSeleccionado.id);
              setSubsistemaSeleccionadoId(null);
            }}
          />
        ) : (
          <BloqueEnsayoEnergias />
        )}
      </div>
    </div>
  );
}
