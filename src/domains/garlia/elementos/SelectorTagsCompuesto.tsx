"use client";

/**
 * SelectorTagsCompuesto.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Bloque de tags dentro del editor de un Compuesto (CompuestosPage.tsx):
 * lista minimalista de Chips agrupados por eje (naturaleza / oris / uso),
 * sin colores propios — solo el estado activo/inactivo de Chip (bg-primary
 * cuando está activo, borde sutil primary/10 cuando no), mismo lenguaje
 * visual que el resto del editor. Sin colorDot ni el campo "color" de la
 * tabla tags: el catálogo puede tenerlo, acá simplemente se ignora.
 * Click en un tag lo prende/apaga vía toggleTag de useCompuestoTags.
 */

import { Loader2 } from "lucide-react";
import React from "react";

import { Chip } from "@/ui/Chip";

import {
  CATEGORIAS_TAG,
  CATEGORIA_TAG_LABEL,
  type Tag,
  type CategoriaTag,
} from "./useTagsCompuestos";

interface Props {
  compuestoId: string;
  porCategoria: Record<CategoriaTag, Tag[]>;
  tagIdsAsignados: Set<string>;
  onToggle: (tagId: string) => void;
  loading?: boolean;
}

export function SelectorTagsCompuesto({
  compuestoId,
  porCategoria,
  tagIdsAsignados,
  onToggle,
  loading,
}: Props) {
  const totalTags = CATEGORIAS_TAG.reduce((acc, cat) => acc + porCategoria[cat].length, 0);

  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
      {totalTags === 0 && !loading ? null : (
        CATEGORIAS_TAG.map((categoria) => {
          const tags = porCategoria[categoria];
          if (tags.length === 0) return null;
          return (
            <div key={categoria} className="flex items-center flex-wrap gap-1">
              <span className="text-micro font-black uppercase tracking-wide text-primary/20">
                {CATEGORIA_TAG_LABEL[categoria]}
              </span>
              {tags.map((tag) => (
                <Chip
                  key={tag.id}
                  active={tagIdsAsignados.has(tag.id)}
                  title={tag.descripcion ?? tag.nombre}
                  onClick={() => onToggle(tag.id)}
                >
                  {tag.nombre}
                </Chip>
              ))}
            </div>
          );
        })
      )}
      {loading && <Loader2 size={10} className="animate-spin text-primary/20" />}
    </div>
  );
}
