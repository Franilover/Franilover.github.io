"use client";

import { PanelEcosistema } from "@/domains/garlia/biologia/EcosistemasPage";
import { useCadenasAlimenticias, useEcosistemas } from "@/domains/garlia/biologia/useBiologia";
import type { Ecosistema } from "@/domains/garlia/biologia/types";

import { useMundoNavigation } from "@/domains/garlia/_shared/useMundoNavigationStore";

export function EcosistemaEditor({ ecosistema }: { ecosistema: Ecosistema }) {
  const openEntity = useMundoNavigation((s) => s.openEntity);
  const clearSelection = useMundoNavigation((s) => s.clearSelection);

  const { actualizar, eliminar } = useEcosistemas();
  const {
    cadenas,
    creating: creandoCadena,
    crear: crearCadena,
    actualizar: actualizarCadena,
    eliminar: eliminarCadena,
  } = useCadenasAlimenticias();

  const cadenasDelEcosistema = cadenas.filter((c) => c.ecosistema_id === ecosistema.id);

  return (
    <div className="p-4">
      <PanelEcosistema
        ecosistema={ecosistema}
        cadenas={cadenasDelEcosistema}
        creandoCadena={creandoCadena}
        onSave={(updates) => void actualizar(ecosistema.id, updates)}
        onDelete={() => {
          void eliminar(ecosistema.id);
          clearSelection();
        }}
        onVolver={clearSelection}
        onCrearCadena={() => void crearCadena("Nueva cadena", ecosistema.id)}
        onActualizarCadena={(id, updates) => void actualizarCadena(id, updates)}
        onEliminarCadena={(id) => void eliminarCadena(id)}
        onSelectCriatura={(id) => openEntity("criaturas", id)}
      />
    </div>
  );
}
