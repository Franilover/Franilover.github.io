"use client";

import { EditorItem } from "@/domains/garlia/items/EditorItem";

import { useMundoNavigation } from "@/domains/garlia/_shared/useMundoNavigationStore";
import { usePanelFlotante } from "@/domains/garlia/_shared/usePanelFlotanteStore";

interface Item {
  id: string;
  nombre: string;
  [key: string]: any;
}

export function ItemEditor({ item }: { item: Item }) {
  const openEntity = useMundoNavigation((s) => s.openEntity);
  const abrirPanel = usePanelFlotante((s) => s.abrir);

  return (
    <EditorItem
      item={item as any}
      onSaved={() => {}}
      onDeleted={() => openEntity("items", "")}
      onNavigateCiudad={(id) => openEntity("ciudades", id)}
      onNavigateReino={(id) => abrirPanel("reino", id)}
      onSelectGrupo={(id) => openEntity("grupos", id)}
    />
  );
}
