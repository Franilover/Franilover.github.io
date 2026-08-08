"use client";

/**
 * EntityTabBar
 * ───────────────────────────────────────────────────────────────────────────
 * Barra horizontal, arriba del contenido de EditorMundoRoot, con una pestaña
 * por cada entidad puntual abierta (personaje, capítulo de reino,
 * etc — cualquier section+id pasado por useMundoNavigation.openEntity).
 *
 * No es la navegación de secciones (eso vive en navbar.tsx) — es el
 * equivalente a las tabs de un editor de código: cada vez que abrís una
 * entidad se agrega una pestaña, y podés saltar entre las que ya abriste sin
 * perder su lugar en la lista de origen.
 *
 * Se oculta sola si no hay ninguna pestaña abierta (openTabs.length === 0),
 * para no ocupar espacio en las secciones "de catálogo" (Mapa, Aventura,
 * Línea de tiempo) donde este concepto no aplica. También se oculta
 * siempre que la sección activa es "runas" (RunasPage: Runas/Tabla/
 * Física/Biología), que ya trae su propio toggle interno y aprovecha
 * mejor el espacio vertical sin esta barra encima.
 */

import {
  Atom,
  Bug,
  BookMarked,
  Clock,
  Crown,
  Landmark,
  Leaf,
  Music,
  ScrollText,
  StickyNote,
  Swords,
  Users,
  X,
} from "lucide-react";
import React from "react";

import { useEntityTabLabel } from "./useEntityTabLabel";
import { useMundoNavigation, type SectionKey } from "./useMundoNavigationStore";

const SECTION_ICON: Partial<Record<SectionKey, React.ElementType>> = {
  personajes: Users,
  criaturas: Bug,
  ecosistemas: Leaf,
  items: Swords,
  reinos: Crown,
  ciudades: Landmark,
  runas: ScrollText,
  elementos: Atom,
  grupos: Users,
  letras: Music,
  notas: StickyNote,
  "notas-gos": StickyNote,
  "linea-tiempo": Clock,
  capitulos: BookMarked,
};

function EntityTab({
  section,
  id,
  active,
  onActivate,
  onClose,
}: {
  section: SectionKey;
  id: string;
  active: boolean;
  onActivate: () => void;
  onClose: (e: React.SyntheticEvent) => void;
}) {
  const label = useEntityTabLabel(section, id);
  const Icon = SECTION_ICON[section] ?? Users;

  return (
    <div
      role="tab"
      aria-selected={active}
      onClick={onActivate}
      onMouseDown={(e) => {
        // Click central (botón del medio del mouse) cierra la pestaña,
        // igual que en las tabs de un navegador — sin activarla primero.
        if (e.button === 1) {
          e.preventDefault();
          onClose(e);
        }
      }}
      className={`group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-lg cursor-pointer select-none transition-colors shrink-0 max-w-[180px] ${
        active
          ? "bg-primary/10 text-primary"
          : "text-primary/50 hover:bg-primary/5 hover:text-primary/80"
      }`}
      title={label}
    >
      <Icon size={11} className="shrink-0" />
      <span className="text-xs font-semibold truncate">{label}</span>
      <button
        type="button"
        onClick={onClose}
        title="Cerrar pestaña"
        className="shrink-0 p-0.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-primary/15 transition-opacity"
      >
        <X size={10} />
      </button>
    </div>
  );
}

export function EntityTabBar() {
  const openTabs = useMundoNavigation((s) => s.openTabs);
  const section = useMundoNavigation((s) => s.section);
  const selectedId = useMundoNavigation((s) => s.selectedId);
  const activateTab = useMundoNavigation((s) => s.activateTab);
  const closeTab = useMundoNavigation((s) => s.closeTab);

  // RunasPage (Runas/Tabla/Física/Biología) ya trae su propio toggle de
  // secciones y aprovecha el espacio vertical al máximo (árboles, grids,
  // modales) — la barra de pestañas de entidades no aporta ahí y se
  // oculta, igual que se oculta cuando no hay ninguna pestaña abierta.
  if (openTabs.length === 0 || section === "runas") return null;

  return (
    <div
      className="shrink-0 border-b border-primary/10 overflow-x-auto"
      style={{ background: "var(--bg-main)" }}
    >
      <div className="flex items-center gap-1 px-2 py-1.5" role="tablist" aria-label="Entidades abiertas">
        {openTabs.map((tab) => (
          <EntityTab
            key={`${tab.section}:${tab.id}`}
            section={tab.section}
            id={tab.id}
            active={section === tab.section && selectedId === tab.id}
            onActivate={() => activateTab(tab.section, tab.id)}
            onClose={(e) => {
              e.stopPropagation();
              closeTab(tab.section, tab.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}
