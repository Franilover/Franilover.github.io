"use client";

import { EditorCriatura } from "@/domains/garlia/_legacy/views/EditorCriatura";

import { useMundoNavigation } from "../../hooks/mundo/useMundoNavigationStore";

interface Criatura {
  id: string;
  nombre: string;
  [key: string]: any;
}

export function CriaturaEditor({ criatura }: { criatura: Criatura }) {
  const openEntity = useMundoNavigation((s) => s.openEntity);

  return (
    <EditorCriatura
      item={criatura as any}
      onSaved={() => {}}
      onDeleted={() => openEntity("criaturas", "")}
      onSelectItem={(id) => openEntity("items", id)}
      onSelectPersonaje={(id) => openEntity("personajes", id)}
      onSelectGrupo={(id) => openEntity("grupos", id)}
      onNavigateCiudad={(id) => openEntity("ciudades", id)}
      onNavigateReino={(id) => openEntity("reinos", id)}
    />
  );
}
