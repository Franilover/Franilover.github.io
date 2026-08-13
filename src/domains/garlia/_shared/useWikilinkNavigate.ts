"use client";

/**
 * useWikilinkNavigate
 * ───────────────────────────────────────────────────────────────────────────
 * El editor de Markdown dispara onWikilink(target) cuando el usuario hace
 * click en un [[nombre]]. Antes esto buscaba en un objeto `allItems` gigante
 * cargado en el componente raíz (personajes + criaturas + items + reinos +
 * runas, todo junto). Ahora cada sección mantiene su
 * propia cache vía useSupabaseData, así que resolvemos el link consultando
 * el cache compartido de datos (DataProvider) directamente, sin depender de
 * que el componente padre haya cargado "todo, siempre".
 */

import { useCallback } from "react";

import { useDataCache } from "@/providers/DataProvider";

import { useMundoNavigation, type SectionKey } from "./useMundoNavigationStore";
import { usePanelFlotante } from "./usePanelFlotanteStore";

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
  { tabla: "runas", section: "runas" },
  { tabla: "elementos", section: "elementos" },
];

export function useWikilinkNavigate() {
  const { cache } = useDataCache();
  const openEntity = useMundoNavigation((s) => s.openEntity);
  const abrirPanel = usePanelFlotante((s) => s.abrir);

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
          // Personaje/criatura/reino/item SIEMPRE en panel flotante (reemplaza
          // el contenido del panel actual, nunca abre una tab nueva). El resto
          // de entidades (ciudades, runas, elementos) sigue navegando a su tab
          // vía openEntity.
          if (
            section === "personajes" ||
            section === "criaturas" ||
            section === "reinos" ||
            section === "items"
          ) {
            const tipoPanel =
              section === "personajes"
                ? "personaje"
                : section === "criaturas"
                  ? "criatura"
                  : section === "reinos"
                    ? "reino"
                    : "item";
            abrirPanel(tipoPanel, found.id);
          } else {
            openEntity(section, found.id);
          }
          return;
        }
      }
    },
    [cache, openEntity, abrirPanel],
  );
}
