"use client";

import { EditorReino } from "@/domains/garlia/_legacy/views/EditorReino";

import { useMundoNavigation } from "../../hooks/mundo/useMundoNavigationStore";

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
