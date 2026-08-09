"use client";

/**
 * EcosistemaPopoverContent.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Versión "popover" de EcosistemaEditor: mismo PanelEcosistema por dentro
 * (cadenas alimenticias incluidas), pero sin tocar el store global de
 * navegación — se cierra con onClose local, sin navegar a pantalla completa.
 * Pensado para usarse dentro de <PopoverFlotante>, que ya da scroll interno
 * para el contenido más largo (cadenas alimenticias con eslabones).
 *
 * Recibe solo el ecosistemaId (no el objeto Ecosistema completo): lo
 * resuelve él mismo vía useEcosistemas(), para no depender del shape
 * reducido de Ecosistema que usan algunas vistas (p. ej. CriaturasJerarquica
 * trabaja con un subconjunto de campos vía props, no el tipo completo de
 * biologia/types).
 *
 * A propósito no recibe onSelectBioma: abrir el bioma en cascada crearía un
 * popover-dentro-de-popover. El link "Abrir" junto a "Bioma" no se muestra
 * cuando onSelectBioma no está presente (así lo maneja PanelEcosistema).
 * onSelectCriatura sigue navegando a pantalla completa (no hay popover de
 * criatura todavía).
 */

import { PanelEcosistema } from "@/domains/garlia/biologia/PanelEcosistema";
import { useCadenasAlimenticias, useEcosistemas } from "@/domains/garlia/biologia/useBiologia";

export function EcosistemaPopoverContent({
  ecosistemaId,
  onClose,
  onSelectCriatura,
}: {
  ecosistemaId: string;
  onClose: () => void;
  onSelectCriatura?: (id: string) => void;
}) {
  const { ecosistemas, actualizar, eliminar } = useEcosistemas();
  const {
    cadenas,
    creating: creandoCadena,
    crear: crearCadena,
    actualizar: actualizarCadena,
    eliminar: eliminarCadena,
  } = useCadenasAlimenticias();

  const ecosistema = ecosistemas.find((e) => e.id === ecosistemaId);
  const cadenasDelEcosistema = cadenas.filter((c) => c.ecosistema_id === ecosistemaId);

  if (!ecosistema) return null;

  return (
    <PanelEcosistema
      ecosistema={ecosistema}
      cadenas={cadenasDelEcosistema}
      creandoCadena={creandoCadena}
      onSave={(updates) => void actualizar(ecosistema.id, updates)}
      onDelete={() => {
        void eliminar(ecosistema.id);
        onClose();
      }}
      onVolver={onClose}
      onCrearCadena={() => void crearCadena("Nueva cadena", ecosistema.id)}
      onActualizarCadena={(id, updates) => void actualizarCadena(id, updates)}
      onEliminarCadena={(id) => void eliminarCadena(id)}
      onSelectCriatura={onSelectCriatura}
      modoPopover
    />
  );
}
