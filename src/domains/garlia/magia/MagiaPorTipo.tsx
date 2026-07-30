"use client";

/**
 * MagiaPorTipo
 * ───────────────────────────────────────────────────────────────────────────
 * Vista de la página "Magia": tres bloques planos — Hechizos / Dones / Runas —
 * cada uno con su grid de tarjetas. Sin agrupar por criatura de origen (esa
 * relación fue eliminada; ahora hechizos/dones/runas no tienen `criatura_id`).
 */

import { Plus, ScrollText, Sparkles, Star } from "lucide-react";
import React from "react";

import { EntityCard } from "@/domains/garlia/_shared/EntityCard";
import type { SectionKey } from "@/domains/garlia/_shared/useMundoNavigationStore";

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
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))" }}
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

export function MagiaPorTipo({
  hechizos,
  dones,
  runas,
  loading,
  onOpen,
  onCreate,
  creating,
}: Props) {
  const datos = { hechizos, dones, runas };

  if (loading && hechizos.length === 0 && dones.length === 0 && runas.length === 0) {
    return <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>;
  }

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
