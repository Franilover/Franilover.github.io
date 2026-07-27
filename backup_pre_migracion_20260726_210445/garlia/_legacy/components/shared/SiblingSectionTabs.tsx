"use client";

/**
 * SiblingSectionTabs
 * ───────────────────────────────────────────────────────────────────────────
 * Fila de iconos que va ARRIBA del buscador (SectionListHeader), mostrando
 * las secciones hermanas del mismo grupo del menú (ver GROUPS en MundoMenu)
 * para saltar entre ellas sin volver al menú principal.
 *
 * Ej: dentro de "Personajes" se ven los iconos de Personajes/Criaturas/Items,
 * con el activo resaltado. Click en un hermano navega directo con
 * selectSection (limpia selectedId, igual que clickear el menú).
 */

import React from "react";

import { useMundoNavigation, type SectionKey } from "../../hooks/mundo/useMundoNavigationStore";

export interface SiblingItem {
  key: SectionKey;
  label: string;
  Icon: React.ElementType;
}

interface Props {
  items: SiblingItem[];
  active: SectionKey;
}

export function SiblingSectionTabs({ items, active }: Props) {
  const selectSection = useMundoNavigation((s) => s.selectSection);

  return (
    <div className="shrink-0 flex items-center gap-1 px-2 pt-2">
      {items.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => selectSection(key)}
          title={label}
          aria-label={label}
          aria-current={key === active ? "true" : undefined}
          className={[
            "flex-1 flex items-center justify-center py-1.5 rounded-lg transition-colors",
            key === active
              ? "bg-primary/10 text-primary"
              : "text-primary/40 hover:text-primary/70 hover:bg-primary/5",
          ].join(" ")}
        >
          <Icon size={14} strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
