"use client";

/**
 * MapaSection
 * ───────────────────────────────────────────────────────────────────────────
 * Toda la edición del mapa vive acá adentro, dentro de editorGarlia — nada
 * de esto toca la ruta pública (/garlia/mapa), que se renderiza siempre en
 * modo solo-lectura (ver src/app/(public)/garlia/mapa/page.tsx).
 *
 * Dos sub-modos, alternables sin salir de la sección:
 *   - "tiles": EditorMapa — gestión de los tiles del mapa global (crear,
 *     borrar, poner imagen, mover reinos entre celdas).
 *   - "reino": el mismo componente que usa la vista pública
 *     (MapaInteractivo), pero con allowEdit=true e initialEditReinoId
 *     apuntando al reino clickeado — arranca directo en editMode con el
 *     panel de nombre/descripción/coordenadas abierto, en vez de requerir
 *     un click extra en "Editar Mapa". Antes esto navegaba a /garlia/mapa
 *     y activaba edición ahí vía evento; ahora se renderiza directo acá.
 *
 * El botón "Volver" para salir de la vista de reino es el propio botón
 * nativo de MapaInteractivo (esquina superior izquierda) — NO agregamos
 * uno nuestro encima, solo escuchamos onExitReino para volver a "tiles".
 */

import { useState } from "react";

import { EditorMapa } from "@/domains/garlia/_shared/EditorMapa";
import MapaInteractivo from "@/domains/garlia/reinos/public/mapaGarlia";

export function MapaSection() {
  const [reinoAEditar, setReinoAEditar] = useState<string | null>(null);

  if (reinoAEditar) {
    return (
      <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
        <MapaInteractivo
          allowEdit
          initialEditReinoId={reinoAEditar}
          onExitReino={() => setReinoAEditar(null)}
        />
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
      <EditorMapa onSelectReino={setReinoAEditar} />
    </div>
  );
}
