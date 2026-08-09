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
 * Recibe solo el biomaId (no el objeto Bioma completo): lo resuelve él mismo
 * vía useBiomas(), para no depender del shape de Bioma que use cada vista
 * que lo invoca (algunas, como CriaturasJerarquica, trabajan con un
 * subconjunto reducido de campos vía props).
 */

import { PanelBioma } from "@/domains/garlia/biologia/PanelBioma";
import { useBiomas, useEcosistemas } from "@/domains/garlia/biologia/useBiologia";

export function BiomaPopoverContent({
  biomaId,
  onClose,
}: {
  biomaId: string;
  onClose: () => void;
}) {
  const { biomas, actualizar, eliminar } = useBiomas();
  const { ecosistemas } = useEcosistemas();

  const bioma = biomas.find((b) => b.id === biomaId);
  const ecosistemasDelBioma = ecosistemas.filter((e) => e.bioma_id === biomaId);

  if (!bioma) return null;

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
