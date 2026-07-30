"use client";

/**
 * CancionGrupos.tsx
 * ───────────────────
 * Muestra los grupos del mundo (álbumes, playlists, etc.) a los que
 * pertenece una canción. La lógica de datos vive en useGruposDeLaCancion.
 *
 * Análogo a domains/garlia/personajes/PersonajeGrupos.tsx pero para canciones.
 */

import { Loader2, Music } from "lucide-react";

import { useGruposDeLaCancion } from "@/domains/garlia/grupos/useGruposDeLaCancion";

// ─── Componente ───────────────────────────────────────────────────────────────

export function CancionGrupos({
  cancionId,
  onOpenGrupo,
}: {
  cancionId: string;
  onOpenGrupo?: (id: string) => void;
}) {
  const { grupos, loading } = useGruposDeLaCancion(cancionId);

  if (loading)
    return (
      <div className="rounded-xl overflow-hidden">
        <div className="flex items-center gap-1.5 px-2 py-1">
          <Music className="text-primary/25 shrink-0" size={8} />
          <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30 leading-none">
            Grupos
          </span>
          <div
            className="flex-1 h-px"
            style={{
              background:
                "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          />
        </div>
        <div className="flex justify-center py-4">
          <Loader2 className="animate-spin text-primary/20" size={14} />
        </div>
      </div>
    );

  if (!grupos.length) return null;

  return (
    <div className="rounded-xl overflow-hidden">
      <div className="flex items-center gap-1.5 px-2 py-1">
        <Music className="text-primary/25 shrink-0" size={8} />
        <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30 leading-none">
          Grupos
        </span>
        <div
          className="flex-1 h-px"
          style={{
            background:
              "color-mix(in srgb, var(--primary) 12%, transparent)",
          }}
        />
      </div>
      <div>
        {grupos.map((g) => (
          <button
            key={g.id}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-primary/[0.04] transition-colors text-left group border-b border-primary/[0.04] last:border-0"
            onClick={() => onOpenGrupo?.(g.id)}
          >
            <Music
              className="shrink-0 text-primary/20 group-hover:text-primary/40 transition-colors"
              size={8}
            />
            <span className="text-micro font-black uppercase tracking-wide text-primary/50 group-hover:text-primary/80 transition-colors truncate leading-tight">
              {g.nombre}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
