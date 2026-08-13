"use client";
// Migrado desde _legacy/components/ciudades/CiudadEditor.tsx a
// domains/garlia/ciudades/components. useMundoNavigation sigue siendo legacy
// (navegación compartida entre todas las entidades de Garlia, no propia de
// ciudades) — mismo criterio que domains/garlia/reinos/components/ReinoEditor.tsx.

import { useMundoNavigation } from "@/domains/garlia/_shared/useMundoNavigationStore";
import { usePanelFlotante } from "@/domains/garlia/_shared/usePanelFlotanteStore";

import { EditorCiudad } from "./EditorCiudad";

interface Ciudad {
  id: string;
  nombre: string;
  [key: string]: any;
}

export function CiudadEditor({ ciudad }: { ciudad: Ciudad }) {
  const openEntity = useMundoNavigation((s) => s.openEntity);
  const abrirPanel = usePanelFlotante((s) => s.abrir);

  return (
    <EditorCiudad
      item={ciudad as any}
      onSaved={() => {}}
      onDeleted={() => openEntity("ciudades", "")}
      onSelectPersonaje={(id) => abrirPanel("personaje", id)}
      onSelectCriatura={(id) => abrirPanel("criatura", id)}
      onSelectItem={(id) => openEntity("items", id)}
      onNavigateReino={(id) => abrirPanel("reino", id)}
    />
  );
}
