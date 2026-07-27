"use client";

/**
 * useWikilinkNavigate
 * ───────────────────────────────────────────────────────────────────────────
 * El editor de Markdown dispara onWikilink(target) cuando el usuario hace
 * click en un [[nombre]]. Antes esto buscaba en un objeto `allItems` gigante
 * cargado en el componente raíz (personajes + criaturas + items + reinos +
 * hechizos + dones + runas, todo junto). Ahora cada sección mantiene su
 * propia cache vía useSupabaseData, así que resolvemos el link consultando
 * el cache compartido de datos (DataProvider) directamente, sin depender de
 * que el componente padre haya cargado "todo, siempre".
 */

import { useCallback } from "react";

import { useDataCache } from "@/providers/DataProvider";

import { useMundoNavigation, type SectionKey } from "./useMundoNavigationStore";

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const SEARCHABLE: { tabla: string; section: SectionKey }[] = [
  { tabla: "personajes", section: "personajes" },
  { tabla: "criaturas", section: "criaturas" },
  { tabla: "items", section: "items" },
  { tabla: "reinos", section: "reinos" },
  { tabla: "ciudades", section: "ciudades" },
  { tabla: "hechizos", section: "hechizos" },
  { tabla: "dones", section: "dones" },
  { tabla: "runas", section: "runas" },
];

export function useWikilinkNavigate() {
  const { cache } = useDataCache();
  const openEntity = useMundoNavigation((s) => s.openEntity);

  return useCallback(
    (target: string) => {
      const t = norm(target);
      for (const { tabla, section } of SEARCHABLE) {
        const items = (cache[tabla] ?? []) as { id: string; nombre?: string }[];
        const found =
          items.find((i) => norm(i.nombre) === t) ??
          items.find((i) => norm(i.nombre)?.startsWith(t)) ??
          items.find((i) => norm(i.nombre)?.includes(t));
        if (found) {
          openEntity(section, found.id);
          return;
        }
      }
    },
    [cache, openEntity],
  );
}
