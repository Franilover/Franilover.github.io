"use client";

/**
 * SelectorTipoGrupo.tsx
 * ────────────────────────
 * Grilla de selección del tipo de grupo al crear uno nuevo. Extraído de
 * EditorGrupo.tsx — lo usa EditorGrupoStandalone cuando `creando === true`.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/grupos/SelectorTipoGrupo.tsx
 */

import { Layers } from "lucide-react";
import React from "react";

import { GRUPO_TIPO_CONFIG, type GrupoTipo } from "@/domains/garlia/_legacy/hooks/grupos/useGrupos";

export function SelectorTipoGrupo({
  onSelect,
  onCancel,
}: {
  onSelect: (tipo: GrupoTipo) => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
      <div className="text-center">
        <Layers
          className="text-primary/20 mx-auto mb-1.5"
          size={20}
          strokeWidth={1}
        />
        <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/45">
          Tipo de grupo
        </p>
        <p className="text-micro text-primary/25 mt-0.5">
          ¿De qué serán los miembros?
        </p>
      </div>
      <div className="w-full max-w-xs grid grid-cols-2 gap-1.5">
        {(
          Object.entries(GRUPO_TIPO_CONFIG) as [
            GrupoTipo,
            (typeof GRUPO_TIPO_CONFIG)[GrupoTipo],
          ][]
        ).map(([tipo, cfg]) => (
          <button
            key={tipo}
            className="flex items-center gap-2 p-2 rounded-lg border transition-all hover:scale-[1.01] text-left"
            style={{
              borderColor:
                "color-mix(in srgb, var(--primary) 10%, transparent)",
              background: "color-mix(in srgb, var(--primary) 2%, transparent)",
            }}
            onClick={() => onSelect(tipo)}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor =
                `color-mix(in srgb, ${cfg.color} 25%, transparent)`;
              (e.currentTarget as HTMLElement).style.background =
                `color-mix(in srgb, ${cfg.color} 6%, transparent)`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor =
                "color-mix(in srgb, var(--primary) 10%, transparent)";
              (e.currentTarget as HTMLElement).style.background =
                "color-mix(in srgb, var(--primary) 2%, transparent)";
            }}
          >
            <cfg.IconAlt
              size={13}
              strokeWidth={1.5}
              style={{
                color: `color-mix(in srgb, ${cfg.color} 65%, transparent)`,
                flexShrink: 0,
              }}
            />
            <div>
              <p className="text-micro font-black uppercase tracking-widest text-primary/65 leading-tight">
                {cfg.labelPlural}
              </p>
              <p className="text-micro text-primary/25 leading-tight mt-0.5">
                {cfg.ejemplo}
              </p>
            </div>
          </button>
        ))}
      </div>
      <button
        className="text-micro font-black uppercase tracking-widest text-primary/20 hover:text-primary/45 transition-colors"
        onClick={onCancel}
      >
        Cancelar
      </button>
    </div>
  );
}
