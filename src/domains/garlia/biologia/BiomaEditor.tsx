"use client";

import { PanelBioma } from "@/domains/garlia/biologia/PanelBioma";
import { useBiomas, useEcosistemas } from "@/domains/garlia/biologia/useBiologia";
import type { Bioma } from "@/domains/garlia/biologia/types";

import { useMundoNavigation } from "@/domains/garlia/_shared/useMundoNavigationStore";

export function BiomaEditor({ bioma }: { bioma: Bioma }) {
  const openEntity = useMundoNavigation((s) => s.openEntity);
  const clearSelection = useMundoNavigation((s) => s.clearSelection);

  const { actualizar, eliminar } = useBiomas();
  const { ecosistemas, creating: creandoEcosistema, crear: crearEcosistema, actualizar: actualizarEcosistema } =
    useEcosistemas();

  const ecosistemasDelBioma = ecosistemas.filter((e) => e.bioma_id === bioma.id);

  return (
    <div className="p-4">
      <PanelBioma
        bioma={bioma}
        ecosistemas={ecosistemasDelBioma}
        onSave={(updates) => void actualizar(bioma.id, updates)}
        onDelete={() => {
          void eliminar(bioma.id);
          clearSelection();
        }}
        onVolver={clearSelection}
        onSelectReino={(id) => openEntity("reinos", id)}
        onSelectEcosistema={(id) => openEntity("ecosistemas", id)}
        creandoEcosistema={creandoEcosistema}
        onCrearEcosistema={async () => {
          const nuevo = await crearEcosistema("Nuevo ecosistema");
          if (nuevo?.id) {
            await actualizarEcosistema(nuevo.id, { bioma_id: bioma.id });
            openEntity("ecosistemas", nuevo.id);
          }
        }}
      />
    </div>
  );
}
