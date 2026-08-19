"use client";

import { EditorItem } from "@/domains/garlia/items/EditorItem";

import { useMundoNavigation } from "@/domains/garlia/_shared/useMundoNavigationStore";
import { type OnHeaderControlsChange } from "@/domains/garlia/_shared/useEditorHeaderControls";

interface Item {
  id: string;
  nombre: string;
  [key: string]: any;
}

export function ItemEditor({
  item,
  onDeleted,
  onHeaderControlsChange,
}: {
  item: Item;
  /** Si se pasa (ej. desde PanelFlotanteGlobal, para cerrar el panel), se
   *  usa en vez de la navegación por defecto a la lista de items — mismo
   *  patrón que MineralEditor/FloraEditor. */
  onDeleted?: (id: string) => void;
  onHeaderControlsChange?: OnHeaderControlsChange;
}) {
  const openEntity = useMundoNavigation((s) => s.openEntity);

  return (
    <EditorItem
      item={item as any}
      onSaved={() => {}}
      onDeleted={(id) => (onDeleted ? onDeleted(id) : openEntity("items", ""))}
      onSelectGrupo={(id) => openEntity("grupos", id)}
      onHeaderControlsChange={onHeaderControlsChange}
    />
  );
}
