"use client";

/**
 * EntityCardGrid
 * ───────────────────────────────────────────────────────────────────────────
 * Bloque "título + grid de tarjetas" para una sub-categoría dentro de una
 * página combinada (ej. "Personajes" dentro de la página Entidades).
 * Varias de estas apiladas verticalmente forman la página completa.
 */

import { Box, Loader2, Plus } from "lucide-react";
import React from "react";

import { useFavoritos } from "../../hooks/mundo/useFavoritosStore";
import type { SectionKey } from "../../hooks/mundo/useMundoNavigationStore";
import { EntityCard } from "./EntityCard";

interface Item {
  id: string;
  nombre: string;
  imageUrl?: string | null;
  subtitle?: string | null;
}

interface Props {
  title: string;
  Icon?: React.ElementType;
  items: Item[];
  loading?: boolean;
  onItemClick: (id: string) => void;
  onCreate?: () => void;
  creating?: boolean;
  emptyLabel?: string;
  /**
   * Si se pasa, cada tarjeta muestra una estrella para marcar/desmarcar
   * favorito (persistido en useFavoritos, visible luego en el Home Dashboard).
   * Se omite en listados que no representan una sola SectionKey concreta.
   */
  section?: SectionKey;
  /**
   * @deprecated Las columnas ahora son dinámicas (auto-fill según el ancho
   * disponible), así que este prop ya no cambia nada — se deja para no
   * romper a quien todavía lo pase. La cantidad de columnas se resuelve
   * sola: un bloque "half" simplemente tiene menos ancho disponible que
   * uno "full", y por lo tanto menos columnas, sin puntos de quiebre fijos.
   */
  layout?: "full" | "half" | "third";
  /**
   * "grid" (default): tarjetas cuadradas con imagen/ícono, columnas dinámicas
   * (auto-fill) que se acomodan solas según el ancho disponible — más o
   * menos columnas según cuánto espacio tenga el bloque en su fila, sin
   * dejar espacio muerto.
   * "chips": solo texto, sin imagen, ancho automático según el contenido
   * (flex-wrap).
   */
  variant?: "grid" | "chips";
  /** Ancho mínimo de cada tarjeta en px antes de que el grid agregue una columna más. Default: 76. */
  minCardWidth?: number;
}

export function EntityCardGrid({
  title,
  Icon,
  items,
  loading,
  onItemClick,
  onCreate,
  creating,
  emptyLabel,
  variant = "grid",
  minCardWidth = 76,
  section,
}: Props) {
  const isFavorito = useFavoritos((s) => s.isFavorito);
  const toggleFavorito = useFavoritos((s) => s.toggleFavorito);
  return (
    <div className="mb-8 last:mb-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <h2 className="text-micro font-black uppercase tracking-[0.25em] text-primary/50">
          {title}
        </h2>
        <span className="text-micro text-primary/25 tabular-nums">{items.length}</span>
        <div className="flex-1" />
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            disabled={creating}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-micro font-bold uppercase tracking-wide text-primary disabled:opacity-50"
          >
            {creating ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Plus size={11} />
            )}
            Añadir
          </button>
        )}
      </div>

      {loading && items.length === 0 ? (
        <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="py-6 text-xs text-primary/25 text-center">
          {emptyLabel ?? `Sin ${title.toLowerCase()} todavía`}
        </div>
      ) : variant === "chips" ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onItemClick(item.id)}
              title={item.nombre}
              className="px-2.5 py-1.5 rounded-lg border border-primary/10 bg-primary/[0.03] hover:bg-primary/10 hover:border-primary/20 transition-colors text-xs font-semibold text-primary/80 text-left truncate max-w-[220px]"
            >
              {item.nombre}
            </button>
          ))}
        </div>
      ) : (
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}px, 1fr))` }}
        >
          {items.map((item) => (
            <EntityCard
              key={item.id}
              nombre={item.nombre}
              imageUrl={item.imageUrl}
              subtitle={item.subtitle}
              Icon={Icon ?? Box}
              onClick={() => onItemClick(item.id)}
              isFavorite={section ? isFavorito(section, item.id) : undefined}
              onToggleFavorite={
                section
                  ? () => toggleFavorito({ section, id: item.id, nombre: item.nombre })
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
