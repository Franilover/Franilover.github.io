"use client";

/**
 * useExternalCommandBridge
 * ───────────────────────────────────────────────────────────────────────────
 * La paleta de comandos global (GlobalCommandPalette) y los wikilinks del
 * editor de Markdown viven fuera de este feature y solo saben comunicarse
 * por CustomEvent en `window`. Eso está bien — no vamos a acoplar un paquete
 * externo al store interno.
 *
 * Lo que SÍ cambia respecto al código anterior: en vez de que 5-6 efectos
 * separados escuchen eventos sueltos y cada uno replique su propia lógica de
 * "cambiar de tab + sección + setTimeout", hay UN solo puente. Si mañana la
 * paleta de comandos agrega una acción nueva, se agrega un caso acá, no un
 * useEffect nuevo en el componente principal.
 *
 * Este hook se monta una sola vez, arriba del árbol (en el layout del editor).
 */

import { useEffect } from "react";

import type { SectionKey } from "./useMundoNavigationStore";
import { useMundoNavigation } from "./useMundoNavigationStore";

type OpenEntityDetail = { tabla: string; id: string };
type CreateEntityDetail = { tab: string };
type AddMagicDetail = { key: string };

// Mapeo tabla de Supabase → sección de navegación. Único lugar donde vive
// esta correspondencia (antes estaba repetida como MUNDO_TABLAS +
// tablaMap + magicCollections en distintos puntos de editorGarlia.tsx).
export const TABLA_TO_SECTION: Record<string, SectionKey> = {
  personajes: "personajes",
  criaturas: "criaturas",
  items: "items",
  reinos: "reinos",
  ciudades: "ciudades",
  grupos_mundo: "grupos",
  hechizos: "hechizos",
  dones: "dones",
  runas: "runas",
  // "libros" es el nombre de tabla que usa GRUPO_TIPO_CONFIG (cfg.tabla) para
  // el tipo de grupo "Libros" — la sección de navegación equivalente es
  // "capitulos" (misma que usa el resto del editor para libros/capítulos).
  libros: "capitulos",
  // Alias en singular: los mismos usados por garlia-add-magic / wikilinks.
  libro: "capitulos",
  capitulo: "capitulos",
  cancion: "letras",
  canciones: "letras",
  letras: "letras",
  ciudad: "ciudades",
  grupos: "grupos",
};

const MAGIA_TABLAS = new Set(["hechizos", "dones", "runas"]);

export function useExternalCommandBridge(onCreateEntity: (tab: string) => void) {
  const openEntity = useMundoNavigation((s) => s.openEntity);
  const selectSection = useMundoNavigation((s) => s.selectSection);

  useEffect(() => {
    const handleOpenEntity = (e: Event) => {
      const { tabla, id } = (e as CustomEvent<OpenEntityDetail>).detail;
      const section = TABLA_TO_SECTION[tabla];
      if (!section) return;
      openEntity(section, id);
    };

    const handleCreateEntity = (e: Event) => {
      const { tab } = (e as CustomEvent<CreateEntityDetail>).detail;
      onCreateEntity(tab);
    };

    const handleAddMagic = (e: Event) => {
      const { key } = (e as CustomEvent<AddMagicDetail>).detail;
      if (MAGIA_TABLAS.has(key)) {
        selectSection(key as SectionKey);
        return;
      }
      const directSectionMap: Record<string, SectionKey> = {
        notas: "notas",
        libro: "capitulos",
        capitulo: "capitulos",
        cancion: "letras",
        ciudad: "ciudades",
        grupos: "grupos",
      };
      const section = directSectionMap[key];
      if (section) selectSection(section);
    };

    // Buzón persistente para cold-navigation: si venimos de otra página, la
    // paleta de comandos pudo haber dejado una solicitud en sessionStorage
    // antes de navegar (el CustomEvent no llega si el listener aún no existe).
    // Se consume una sola vez al montar, con una ventana de validez corta.
    try {
      const raw = sessionStorage.getItem("garlia-pending-open-entity");
      if (raw) {
        sessionStorage.removeItem("garlia-pending-open-entity");
        const pending = JSON.parse(raw) as OpenEntityDetail & { ts: number };
        const isFresh = pending?.tabla && pending?.id && Date.now() - pending.ts < 15_000;
        if (isFresh) {
          const section = TABLA_TO_SECTION[pending.tabla];
          if (section) {
            openEntity(section, pending.id);
          }
        }
      }
    } catch {
      // sessionStorage inaccesible (modo privado, etc.) — no bloquea el resto.
    }

    window.addEventListener("garlia-open-entity", handleOpenEntity);
    window.addEventListener("garlia-create-entity", handleCreateEntity);
    window.addEventListener("garlia-add-magic", handleAddMagic);
    return () => {
      window.removeEventListener("garlia-open-entity", handleOpenEntity);
      window.removeEventListener("garlia-create-entity", handleCreateEntity);
      window.removeEventListener("garlia-add-magic", handleAddMagic);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEntity, selectSection]);
}
