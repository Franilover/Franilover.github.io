"use client";

/**
 * MagiaPorTipo
 * ───────────────────────────────────────────────────────────────────────────
 * Vista de la página "Magia": tres bloques planos — Hechizos / Dones / Runas —
 * cada uno con su grid de tarjetas. Sin agrupar por criatura de origen (esa
 * relación fue eliminada; ahora hechizos/dones/runas no tienen `criatura_id`).
 */

import { FileText, Plus, ScrollText, Sparkles, Star } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { EntityCard } from "@/domains/garlia/_shared/EntityCard";
import type { SectionKey } from "@/domains/garlia/_shared/useMundoNavigationStore";
import { useEnsayoEditorLogic } from "@/editor/notas/hooks/useEnsayoEditorLogic";

import { BloqueHerramientasRunas } from "./BloqueHerramientasRunas";
import { BloqueSubsistemasMagia } from "./BloqueSubsistemasMagia";
import type { EntidadMagica } from "./types";

interface EntidadMagicaMin {
  id: string;
  nombre: string;
  imagen_url?: string | null;
}

interface Props {
  hechizos: EntidadMagicaMin[];
  dones: EntidadMagicaMin[];
  runas: EntidadMagicaMin[];
  loading?: boolean;
  onOpen: (section: SectionKey, id: string) => void;
  onCreate?: (tipo: "hechizos" | "dones" | "runas") => void;
  creating?: boolean;
  // Abre un ensayo (tab "notas-gos") — mismo patrón que EnsayosGosWidget
  // en el home. Si no se pasa, el bloque de ensayos no se muestra.
  onOpenEnsayo?: (ensayoId: string) => void;
  // Catálogo completo de runas — para el bloque de herramientas de runas
  // (probador + editor de combinaciones), movido acá desde el editor
  // interno de una runa individual.
  todasLasRunas?: EntidadMagica[];
}

const BLOQUES = [
  { key: "hechizos" as const, label: "Hechizos", Icon: Sparkles, section: "hechizos" as SectionKey },
  { key: "dones" as const, label: "Dones", Icon: Star, section: "dones" as SectionKey },
  { key: "runas" as const, label: "Runas", Icon: ScrollText, section: "runas" as SectionKey },
];

function Bloque({
  label,
  Icon,
  section,
  entidades,
  onOpen,
  onCreate,
  creating,
}: {
  label: string;
  Icon: React.ElementType;
  section: SectionKey;
  entidades: EntidadMagicaMin[];
  onOpen: (section: SectionKey, id: string) => void;
  onCreate?: () => void;
  creating?: boolean;
}) {
  return (
    <div className="rounded-xl border border-primary/10 bg-primary/[0.03] overflow-hidden mb-6 last:mb-0">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-3 py-1.5 bg-primary/10 border-b border-primary/10">
        <span />
        <span className="justify-self-center max-w-[280px] truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70 flex items-center gap-1">
          <Icon size={9} className="shrink-0" />
          {label}
        </span>
        <div className="justify-self-end">
          {onCreate && (
            <button
              type="button"
              onClick={onCreate}
              disabled={creating}
              title={`Añadir ${label.toLowerCase()}`}
              className="p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <Plus size={9} className="text-primary/60" />
            </button>
          )}
        </div>
      </div>
      <div className="p-4">
        {entidades.length === 0 ? (
          <div className="w-full py-6 text-xs text-primary/25 text-center">
            Sin {label.toLowerCase()} todavía
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
                imageUrl={e.imagen_url}
                Icon={Icon}
                onClick={() => onOpen(section, e.id)}
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
// todavía se crea automáticamente la primera vez que se abre Magia.
const TITULO_ENSAYO_ENERGIAS = "Energias";

function BloqueEnsayoEnergias({ onOpenEnsayo }: { onOpenEnsayo: (id: string) => void }) {
  const { ensayos, loading, crearNotaPendiente } = useEnsayoEditorLogic(null);
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

  return (
    <div className="rounded-xl border border-primary/10 bg-primary/[0.03] overflow-hidden mb-6 last:mb-0">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-3 py-1.5 bg-primary/10 border-b border-primary/10">
        <span />
        <span className="justify-self-center max-w-[280px] truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70 flex items-center gap-1">
          <FileText size={9} className="shrink-0" />
          Ensayo · GOS + Magia
        </span>
        <span />
      </div>
      <div className="p-4">
        {loading || creando || !ensayoEnergias ? (
          <div className="w-full py-6 text-xs text-primary/30 text-center">
            {creando ? "Creando ensayo…" : "Cargando…"}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onOpenEnsayo(ensayoEnergias.id)}
            className="w-full flex items-center gap-3 px-4 py-5 rounded-xl border border-primary/10 bg-primary/[0.02] hover:bg-primary/6 hover:border-accent/30 transition-colors text-left"
          >
            <div className="shrink-0 w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
              <FileText size={18} className="text-accent/70" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black uppercase italic tracking-tight text-primary truncate">
                {ensayoEnergias.titulo || TITULO_ENSAYO_ENERGIAS}
              </div>
              <div className="text-micro font-bold uppercase tracking-widest text-primary/35 mt-0.5">
                GOS · Magia
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

export function MagiaPorTipo({
  hechizos,
  dones,
  runas,
  loading,
  onOpen,
  onCreate,
  creating,
  onOpenEnsayo,
  todasLasRunas,
}: Props) {
  const datos = { hechizos, dones, runas };

  if (loading && hechizos.length === 0 && dones.length === 0 && runas.length === 0) {
    return <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>;
  }

  // Sin onOpenEnsayo: comportamiento anterior, un solo bloque de columna.
  if (!onOpenEnsayo) {
    return (
      <div>
        {BLOQUES.map(({ key, label, Icon, section }) => (
          <Bloque
            key={key}
            Icon={Icon}
            entidades={datos[key]}
            label={label}
            section={section}
            creating={creating}
            onCreate={onCreate ? () => onCreate(key) : undefined}
            onOpen={onOpen}
          />
        ))}
      </div>
    );
  }

  // Vista dividida: mitad izquierda = items (Hechizos/Dones/Runas),
  // mitad derecha = ensayos con tag GOS + Magia.
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        {BLOQUES.map(({ key, label, Icon, section }) => (
          <Bloque
            key={key}
            Icon={Icon}
            entidades={datos[key]}
            label={label}
            section={section}
            creating={creating}
            onCreate={onCreate ? () => onCreate(key) : undefined}
            onOpen={onOpen}
          />
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <BloqueEnsayoEnergias onOpenEnsayo={onOpenEnsayo} />
        <BloqueSubsistemasMagia />
        {todasLasRunas && (
          <BloqueHerramientasRunas runas={todasLasRunas} />
        )}
      </div>
    </div>
  );
}
