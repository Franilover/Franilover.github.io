"use client";

/**
 * BiomaPopoverContent.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Versión "popover" de BiomaEditor: mismo PanelBioma por dentro (datos y
 * guardado reales, vía useBiomas/useEcosistemas), pero sin tocar el store
 * global de navegación (useMundoNavigation) — se cierra con onClose local en
 * vez de clearSelection, y no navega a pantalla completa. Pensado para
 * usarse dentro de <PopoverFlotante>.
 *
 * A propósito no recibe onSelectEcosistema/onCrearEcosistema: los
 * ecosistemas de este bioma se ven/editan exclusivamente desde la vista de
 * Criaturas (CriaturasJerarquica), no en cascada desde acá.
 */

import { PanelBioma } from "@/domains/garlia/biologia/PanelBioma";
import { useBiomas, useEcosistemas } from "@/domains/garlia/biologia/useBiologia";
import type { Bioma } from "@/domains/garlia/biologia/types";

export function BiomaPopoverContent({
  bioma,
  onClose,
}: {
  bioma: Bioma;
  onClose: () => void;
}) {
  const { actualizar, eliminar } = useBiomas();
  const { ecosistemas } = useEcosistemas();

  const ecosistemasDelBioma = ecosistemas.filter((e) => e.bioma_id === bioma.id);

  return (
    <PanelBioma
      bioma={bioma}
      ecosistemas={ecosistemasDelBioma}
      onSave={(updates) => void actualizar(bioma.id, updates)}
      onDelete={() => {
        void eliminar(bioma.id);
        onClose();
      }}
      onVolver={onClose}
      modoPopover
    />
  );
}
