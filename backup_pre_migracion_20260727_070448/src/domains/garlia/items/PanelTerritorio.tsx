"use client";

/**
 * PanelTerritorio.tsx
 * ─────────────────────
 * Selector múltiple de reinos donde existe el ítem.
 * Antes tenía un useEffect propio para fetchear "reinos" — ahora
 * recibe el catálogo (allReinos, loadingReinos) por props.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/items/PanelTerritorio.tsx
 */

import { Globe } from "lucide-react";
import { useState } from "react";

import { SeccionEntidad } from "@/ui/SeccionEntidad";
import { type ReinoMin } from "@/domains/garlia/_shared/useItemCatalogosUbicacion";

export function PanelTerritorio({
  value,
  allReinos,
  loadingReinos,
  onChange,
  onNavigateReino,
  onSelectedCountChange,
}: {
  value: string[];
  allReinos: ReinoMin[];
  loadingReinos: boolean;
  onChange: (ids: string[]) => void;
  onNavigateReino?: (id: string) => void;
  onSelectedCountChange?: (count: number) => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleToggle = async (id: string, add: boolean) => {
    setSaving(true);
    onChange(add ? [...value, id] : value.filter((x) => x !== id));
    setSaving(false);
  };

  return (
    <SeccionEntidad
      allEntities={allReinos.map((r) => ({ id: r.id, nombre: r.nombre }))}
      emptyLabel="Sin territorio asignado"
      fallbackIcon={<Globe size={9} />}
      groups={[]}
      icon={<Globe size={9} />}
      label="Territorio"
      loading={loadingReinos}
      saving={saving}
      selectedIds={value}
      onEntityClick={(id) => onNavigateReino?.(id)}
      onSelectedCountChange={onSelectedCountChange}
      onToggle={handleToggle}
    />
  );
}
