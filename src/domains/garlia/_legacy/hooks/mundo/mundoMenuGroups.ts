"use client";

/**
 * mundoMenuGroups
 * ───────────────────────────────────────────────────────────────────────────
 * Fuente única de los grupos de secciones del editor de mundo. La usan tanto
 * MundoMenu (menú de entrada) como cada Section individual, para pintar la
 * fila de iconos hermanos (SiblingSectionTabs) arriba de su buscador —
 * evita mantener la lista de grupos duplicada en 8 archivos distintos.
 *
 * Mapa se incluye en Geografía como un ítem más (aunque no tiene columna de
 * lista propia — es un canvas) para poder saltar a él desde Reinos/Ciudades.
 */

import {
  Bug,
  Clock,
  Layers,
  Map,
  Mountain,
  MapPinned,
  Music,
  Package,
  ScrollText,
  Sparkles,
  Star,
  StickyNote,
  Users,
} from "lucide-react";
import React from "react";

import type { SectionKey } from "./useMundoNavigationStore";

export interface MenuItem {
  key: SectionKey;
  label: string;
  Icon: React.ElementType;
}

export interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export const MUNDO_MENU_GROUPS: MenuGroup[] = [
  {
    title: "Entidades",
    items: [
      { key: "personajes", label: "Personajes", Icon: Users },
      { key: "criaturas", label: "Criaturas", Icon: Bug },
      { key: "items", label: "Items", Icon: Package },
    ],
  },
  {
    title: "Geografía",
    items: [
      { key: "mapa", label: "Mapa", Icon: Mountain },
      { key: "reinos", label: "Reinos", Icon: Map },
      { key: "ciudades", label: "Ciudades", Icon: MapPinned },
    ],
  },
  {
    title: "Historia",
    items: [
      { key: "capitulos", label: "Capítulos", Icon: ScrollText },
      { key: "letras", label: "Letras", Icon: Music },
      { key: "linea-tiempo", label: "Línea de Tiempo", Icon: Clock },
    ],
  },
  {
    title: "Organización",
    items: [
      { key: "grupos", label: "Grupos", Icon: Layers },
      { key: "notas", label: "Notas", Icon: StickyNote },
    ],
  },
  {
    title: "Magia",
    items: [
      { key: "hechizos", label: "Hechizos", Icon: Sparkles },
      { key: "runas", label: "Runas", Icon: ScrollText },
      { key: "dones", label: "Dones", Icon: Star },
    ],
  },
];

/** Devuelve los items del grupo al que pertenece `key`, o [] si no está en ninguno. */
export function siblingsOf(key: SectionKey): MenuItem[] {
  const group = MUNDO_MENU_GROUPS.find((g) => g.items.some((i) => i.key === key));
  return group?.items ?? [];
}
