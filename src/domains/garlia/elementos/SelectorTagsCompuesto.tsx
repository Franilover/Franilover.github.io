"use client";

/**
 * SelectorTagsCompuesto.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Bloque de tags dentro del editor de un Compuesto (CompuestosPage.tsx):
 * 3 dropdowns nativos en fila, uno por eje (naturaleza / oris / uso), justo
 * arriba de "Notas". Elegir una opción activa ese tag y desactiva cualquier
 * otro tag de la MISMA categoría que estuviera prendido — un dropdown solo
 * puede tener un valor a la vez, así que acá cada eje admite como máximo un
 * tag activo (si el compuesto tenía 2+ tags de un mismo eje por fuera de
 * este selector, se resuelve tomando el primero como valor mostrado).
 * Sin colores propios: <select> nativo con el mismo lenguaje visual que el
 * resto del editor (fondo primary/5, borde primary/10).
 */

import { Loader2 } from "lucide-react";
import React from "react";

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
  if (totalTags === 0 && !loading) return null;

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {CATEGORIAS_TAG.map((categoria) => {
        const tags = porCategoria[categoria];
        const activo = tags.find((t) => tagIdsAsignados.has(t.id));

        function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
          const nuevoId = e.target.value;
          // Apaga el tag previamente activo de este eje (si había uno) y
          // prende el elegido — así el dropdown queda como única fuente de
          // verdad para esta categoría.
          if (activo && activo.id !== nuevoId) onToggle(activo.id);
          if (nuevoId) onToggle(nuevoId);
        }

        return (
          <div key={categoria} className="flex flex-col gap-0.5 min-w-0">
            <label className="text-micro font-black uppercase tracking-wide text-primary/20 truncate">
              {CATEGORIA_TAG_LABEL[categoria]}
            </label>
            <select
              value={activo?.id ?? ""}
              onChange={handleChange}
              disabled={tags.length === 0}
              className="w-full bg-primary/5 border border-primary/10 rounded-md px-1.5 py-1 text-micro font-bold text-primary outline-none focus:border-primary/30 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed truncate"
            >
              <option value="">—</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.nombre}
                </option>
              ))}
            </select>
          </div>
        );
      })}
      {loading && <Loader2 size={10} className="animate-spin text-primary/20 col-span-3 justify-self-end" />}
    </div>
  );
}
