"use client";
// Migrado desde _legacy/components/reinos/ReinoEditor.tsx a
// domains/garlia/reinos/components. useMundoNavigation sigue siendo legacy
// (navegación compartida entre todas las entidades de Garlia, no propia de
// reinos).

import { useMundoNavigation } from "@/domains/garlia/_shared/useMundoNavigationStore";

import { EditorReino } from "./EditorReino";

interface Reino {
  id: string;
  nombre: string;
  [key: string]: any;
}

export function ReinoEditor({ reino }: { reino: Reino }) {
  const openEntity = useMundoNavigation((s) => s.openEntity);

  return (
    <EditorReino
      item={reino as any}
      onSaved={() => {}}
      onDeleted={() => openEntity("reinos", "")}
      onSelectPersonaje={(personaje) => openEntity("personajes", personaje.id)}
      onSelectCiudad={(id) => openEntity("ciudades", id)}
      onSelectCriatura={(id) => openEntity("criaturas", id)}
      onSelectItem={(id) => openEntity("items", id)}
    />
  );
}
