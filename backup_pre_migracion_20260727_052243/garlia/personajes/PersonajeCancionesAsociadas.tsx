"use client";

/**
 * PersonajeCancionesAsociadas.tsx
 * ────────────────────────────────
 * Lista las canciones asociadas a un personaje.
 * La lógica de datos vive en useCancionesDelPersonaje.
 *
 * Ruta: src/features/editorGarlia/components/personajes/PersonajeCancionesAsociadas.tsx
 */

import { Loader2, Music2 } from "lucide-react";
import Image from "next/image";

import { useCancionesDelPersonaje } from "@/domains/garlia/canciones/useCancionesDelPersonaje";

// ─── Componente ───────────────────────────────────────────────────────────────

export function PersonajeCancionesAsociadas({
  personajeId,
  onSelectCancion,
}: {
  personajeId: string;
  nombrePersonaje?: string;
  onSelectCancion?: (id: string) => void;
}) {
  const { canciones, loading } = useCancionesDelPersonaje(personajeId);

  if (loading)
    return (
      <div className="flex justify-center py-3">
        <Loader2 className="animate-spin text-primary/15" size={12} />
      </div>
    );

  if (!canciones.length)
    return (
      <p className="text-micro font-black text-primary/20 uppercase tracking-[0.2em] text-center py-3 italic">
        Sin canciones
      </p>
    );

  return (
    <div>
      {canciones.map((c) => (
        <button
          key={c.id}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-primary/[0.04] transition-colors text-left group disabled:cursor-default cursor-pointer border-b border-primary/[0.04] last:border-0"
          disabled={!onSelectCancion}
          type="button"
          onClick={() => onSelectCancion?.(c.id)}
        >
          {c.portada_url ? (
            <div className="shrink-0 w-4 h-4 rounded overflow-hidden border border-primary/10 relative">
              <Image
                fill
                alt={c.titulo}
                className="object-cover"
                sizes="16px"
                src={c.portada_url}
              />
            </div>
          ) : (
            <Music2 className="shrink-0 text-primary/20" size={9} />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-micro font-black text-primary/70 truncate uppercase tracking-wide leading-tight group-hover:text-primary transition-colors">
              {c.titulo}
            </p>
            {c.cantante && (
              <p className="text-micro text-primary/25 truncate leading-tight">
                {c.cantante}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
