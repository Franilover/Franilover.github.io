"use client";

/**
 * MagiaPorTipo
 * ───────────────────────────────────────────────────────────────────────────
 * Vista de la página "Magia": tres bloques planos — Hechizos / Dones / Runas —
 * cada uno con su grid de tarjetas. Sin agrupar por criatura de origen (esa
 * relación fue eliminada; ahora hechizos/dones/runas no tienen `criatura_id`).
 */

import { FileText, Plus, ScrollText, Sparkles, Star } from "lucide-react";
import React, { useMemo, useState } from "react";

import { EntityCard } from "@/domains/garlia/_shared/EntityCard";
import type { SectionKey } from "@/domains/garlia/_shared/useMundoNavigationStore";
import NewNoteModal from "@/editor/notas/components/newNoteModal";
import { useEnsayoEditorLogic } from "@/editor/notas/hooks/useEnsayoEditorLogic";

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

// ─── Bloque de ensayos (tag GOS + tag Magia) ───────────────────────────────
// Mismo patrón que EnsayosGosWidget (home), pero filtrando también por la
// tag "Magia" además de "GOS" — ambas deben estar presentes.
function BloqueEnsayosMagia({ onOpenEnsayo }: { onOpenEnsayo: (id: string) => void }) {
  const { ensayos, loading, crearNotaPendiente } = useEnsayoEditorLogic(null);
  const [showModal, setShowModal] = useState(false);

  const ensayosMagia = useMemo(
    () =>
      ensayos.filter((e: any) => {
        const tags = (e.tags ?? []).map((t: string) => t.trim().toLowerCase());
        return tags.includes("gos") && tags.includes("magia");
      }),
    [ensayos],
  );

  return (
    <div className="rounded-xl border border-primary/10 bg-primary/[0.03] overflow-hidden mb-6 last:mb-0">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-3 py-1.5 bg-primary/10 border-b border-primary/10">
        <span />
        <span className="justify-self-center max-w-[280px] truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70 flex items-center gap-1">
          <FileText size={9} className="shrink-0" />
          Ensayos · GOS + Magia
        </span>
        <div className="justify-self-end">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            title="Nuevo ensayo"
            className="p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <Plus size={9} className="text-primary/60" />
          </button>
        </div>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="w-full py-6 text-xs text-primary/30 text-center">Cargando…</div>
        ) : ensayosMagia.length === 0 ? (
          <div className="w-full py-6 text-xs text-primary/25 text-center">
            Sin ensayos con tag GOS + Magia todavía
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {ensayosMagia.map((e: any) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onOpenEnsayo(e.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/10 bg-primary/[0.02] hover:bg-primary/5 hover:border-primary/25 transition-colors text-xs font-semibold text-primary/80"
              >
                <FileText size={12} className="text-primary/40 shrink-0" />
                {e.titulo || "Sin título"}
              </button>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <NewNoteModal
          onClose={() => setShowModal(false)}
          onConfirm={async (titulo) => {
            const id = await crearNotaPendiente(titulo, ["gos", "magia"]);
            setShowModal(false);
            if (id) onOpenEnsayo(id);
          }}
        />
      )}
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
        <BloqueEnsayosMagia onOpenEnsayo={onOpenEnsayo} />
      </div>
    </div>
  );
}
