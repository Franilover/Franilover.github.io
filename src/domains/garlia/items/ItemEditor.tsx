"use client";

import { EditorItem } from "@/domains/garlia/items/EditorItem";

import { useMundoNavigation } from "@/domains/garlia/_shared/useMundoNavigationStore";
import { usePanelFlotante } from "@/domains/garlia/_shared/usePanelFlotanteStore";
import { type OnHeaderControlsChange } from "@/domains/garlia/_shared/useEditorHeaderControls";

interface Item {
  id: string;
  nombre: string;
  [key: string]: any;
}

export function ItemEditor({
  item,
  onHeaderControlsChange,
}: {
  item: Item;
  onHeaderControlsChange?: OnHeaderControlsChange;
}) {
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
      onHeaderControlsChange={onHeaderControlsChange}
    />
  );
}
