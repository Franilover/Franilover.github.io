"use client";

import { EditorCiudad } from "@/domains/garlia/_legacy/views/EditorCiudad";

import { useMundoNavigation } from "../../hooks/mundo/useMundoNavigationStore";

interface Ciudad {
  id: string;
  nombre: string;
  [key: string]: any;
}

export function CiudadEditor({ ciudad }: { ciudad: Ciudad }) {
  const openEntity = useMundoNavigation((s) => s.openEntity);

  return (
    <EditorCiudad
      item={ciudad as any}
      onSaved={() => {}}
      onDeleted={() => openEntity("ciudades", "")}
      onSelectPersonaje={(id) => openEntity("personajes", id)}
      onSelectCriatura={(id) => openEntity("criaturas", id)}
      onSelectItem={(id) => openEntity("items", id)}
      onNavigateReino={(id) => openEntity("reinos", id)}
    />
  );
}
