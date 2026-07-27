"use client";

import { EditorItem } from "@/domains/garlia/items/EditorItem";

import { useMundoNavigation } from "@/domains/garlia/_shared/useMundoNavigationStore";

interface Item {
  id: string;
  nombre: string;
  [key: string]: any;
}

export function ItemEditor({ item }: { item: Item }) {
  const openEntity = useMundoNavigation((s) => s.openEntity);

  return (
    <EditorItem
      item={item as any}
      onSaved={() => {}}
      onDeleted={() => openEntity("items", "")}
      onNavigateCiudad={(id) => openEntity("ciudades", id)}
      onNavigateReino={(id) => openEntity("reinos", id)}
      onSelectGrupo={(id) => openEntity("grupos", id)}
    />
  );
}
