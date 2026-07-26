"use client";

/**
 * PanelCiudades.tsx
 * ───────────────────
 * Selector múltiple de ciudades donde se encuentra el ítem.
 * Antes tenía un useEffect propio para fetchear "ciudades" — ahora
 * recibe el catálogo (allCiudades) por props. La relación específica
 * del ítem (item_ciudades) sigue viviendo en el hook useCiudadesItem.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/items/PanelCiudades.tsx
 */

import { MapPin } from "lucide-react";
import { useState } from "react";

import { SeccionEntidad } from "@/components/ui/SeccionEntidad";
import { useCiudadesItem } from "@/domains/garlia/_legacy/hooks/ciudades/useCiudadesItem";
import { type CiudadMin } from "@/domains/garlia/_legacy/hooks/misc/useItemCatalogosUbicacion";

export function PanelCiudades({
  reinosSeleccionados,
  itemId,
  allCiudades,
  onNavigateCiudad,
  onSelectedCountChange,
}: {
  reinosSeleccionados: string[];
  itemId: string;
  allCiudades: CiudadMin[];
  onNavigateCiudad?: (id: string) => void;
  onSelectedCountChange?: (count: number) => void;
}) {
  const {
    rows: ciudadRows,
    loading: loadingCiudades,
    add: addCiudad,
    remove: removeCiudad,
  } = useCiudadesItem(itemId);
  const [saving, setSaving] = useState(false);

  const ciudadesConReino = allCiudades.filter(
    (c) =>
      c.reino_id &&
      (reinosSeleccionados.length === 0 ||
        reinosSeleccionados.includes(c.reino_id)),
  );

  const handleToggle = async (id: string, add: boolean) => {
    setSaving(true);
    if (add) {
      const c = allCiudades.find((x) => x.id === id);
      if (c) await addCiudad(c);
    } else {
      const row = ciudadRows.find((r) => r.ciudadId === id);
      if (row) await removeCiudad(row.rowId);
    }
    setSaving(false);
  };

  return (
    <SeccionEntidad
      allEntities={ciudadesConReino.map((c) => ({
        id: c.id,
        nombre: c.nombre,
      }))}
      emptyLabel={
        reinosSeleccionados.length > 0
          ? "Sin ciudades en estos reinos"
          : "Sin ciudades"
      }
      fallbackIcon={<MapPin size={9} />}
      groups={[]}
      icon={<MapPin size={9} />}
      label={
        reinosSeleccionados.length > 0
          ? `Ciudades (${reinosSeleccionados.length})`
          : "Ciudades"
      }
      loading={loadingCiudades}
      saving={saving}
      selectedIds={ciudadRows.map((r) => r.ciudadId)}
      onEntityClick={(id) => onNavigateCiudad?.(id)}
      onSelectedCountChange={onSelectedCountChange}
      onToggle={handleToggle}
    />
  );
}
