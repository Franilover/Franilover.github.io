"use client";
// Migrado desde _legacy/components/reinos/ReinoEditor.tsx a
// domains/garlia/reinos/components. useMundoNavigation sigue siendo legacy
// (navegación compartida entre todas las entidades de Garlia, no propia de
// reinos).

import { useMundoNavigation } from "@/domains/garlia/_shared/useMundoNavigationStore";
import { usePanelFlotante } from "@/domains/garlia/_shared/usePanelFlotanteStore";

import { EditorReino } from "./EditorReino";

interface Reino {
  id: string;
  nombre: string;
  [key: string]: any;
}

export function ReinoEditor({ reino }: { reino: Reino }) {
  const openEntity = useMundoNavigation((s) => s.openEntity);
  const abrirPanel = usePanelFlotante((s) => s.abrir);

  return (
    <EditorReino
      item={reino as any}
      onSaved={() => {}}
      onDeleted={() => openEntity("reinos", "")}
      onSelectPersonaje={(personaje) => abrirPanel("personaje", personaje.id)}
      onSelectCiudad={(id) => openEntity("ciudades", id)}
      onSelectCriatura={(id) => abrirPanel("criatura", id)}
      onSelectItem={(id) => openEntity("items", id)}
    />
  );
}
