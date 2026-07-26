"use client";

/**
 * SectionListHeader
 * ───────────────────────────────────────────────────────────────────────────
 * Header de la columna angosta (w-64) que reemplaza al menú de 12 secciones
 * una vez que el usuario elige una.
 *
 * El botón de "volver" ya NO vive acá — se movió a la navbar global (ver
 * components/layout/navbar.tsx), que lee useMundoNavigation directamente
 * y muestra ←/✕ contextual arriba de la página, consistente con el resto
 * del sitio. Este header ahora es solo buscador + botón de crear.
 */

import { Plus, Search } from "lucide-react";
import React from "react";

import type { SectionKey } from "../../hooks/mundo/useMundoNavigationStore";
import { siblingsOf } from "../../hooks/mundo/mundoMenuGroups";
import { SiblingSectionTabs } from "./SiblingSectionTabs";

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  onCreate?: () => void;
  placeholder: string;
  createLabel: string;
  /** @deprecated el botón de volver ahora vive en la navbar; prop ignorada */
  hasSelection?: boolean;
  /** Sección activa — si se pasa, muestra arriba los iconos de las secciones hermanas del mismo grupo */
  activeSection?: SectionKey;
}

export function SectionListHeader({
  query,
  onQueryChange,
  onCreate,
  placeholder,
  createLabel,
  activeSection,
}: Props) {
  const siblings = activeSection ? siblingsOf(activeSection) : [];

  return (
    <div className="border-b border-primary/10">
      {activeSection && siblings.length > 1 && (
        <SiblingSectionTabs active={activeSection} items={siblings} />
      )}
      <div className="p-2 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-input-bg">
          <Search size={12} className="text-primary/30" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-primary/25"
          />
        </div>
      </div>
      {onCreate && (
        <div className="px-2 pb-2">
          <button
            type="button"
            onClick={onCreate}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-xs font-semibold text-primary"
            aria-label={createLabel}
          >
            <Plus size={13} />
            Añadir
          </button>
        </div>
      )}
    </div>
  );
}
