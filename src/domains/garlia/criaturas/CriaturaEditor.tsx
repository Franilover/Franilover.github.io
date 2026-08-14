"use client";

import { EditorCriatura } from "@/domains/garlia/criaturas/EditorCriatura";

import { useMundoNavigation } from "@/domains/garlia/_shared/useMundoNavigationStore";
import { usePanelFlotante } from "@/domains/garlia/_shared/usePanelFlotanteStore";
import { type OnHeaderControlsChange } from "@/domains/garlia/_shared/useEditorHeaderControls";

interface Criatura {
  id: string;
  nombre: string;
  [key: string]: any;
}

export function CriaturaEditor({
  criatura,
  onHeaderControlsChange,
}: {
  criatura: Criatura;
  onHeaderControlsChange?: OnHeaderControlsChange;
}) {
  const openEntity = useMundoNavigation((s) => s.openEntity);
  const abrirPanel = usePanelFlotante((s) => s.abrir);

  return (
    <EditorCriatura
      item={criatura as any}
      onSaved={() => {}}
      onDeleted={() => openEntity("criaturas", "")}
      onSelectItem={(id) => abrirPanel("item", id)}
      onSelectPersonaje={(id) => abrirPanel("personaje", id)}
      onSelectGrupo={(id) => openEntity("grupos", id)}
      onSelectSubsistema={(id) => openEntity("runas", id)}
      onNavigateCiudad={(id) => openEntity("ciudades", id)}
      onNavigateReino={(id) => abrirPanel("reino", id)}
      onHeaderControlsChange={onHeaderControlsChange}
    />
  );
}
