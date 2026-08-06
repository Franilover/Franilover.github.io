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
 */

import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import { EditorMapa } from "@/domains/garlia/_shared/EditorMapa";
import MapaInteractivo from "@/domains/garlia/reinos/public/mapaGarlia";

export function MapaSection() {
  const [reinoAEditar, setReinoAEditar] = useState<string | null>(null);

  if (reinoAEditar) {
    return (
      <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
        <button
          className="absolute top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 text-micro font-semibold uppercase tracking-widest transition-colors"
          style={{
            background: "color-mix(in srgb, var(--bg-menu) 88%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
            color: "var(--accent)",
            borderRadius: "2px",
            letterSpacing: "0.12em",
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          }}
          onClick={() => setReinoAEditar(null)}
        >
          <ArrowLeft size={14} /> Tiles
        </button>
        <MapaInteractivo allowEdit initialEditReinoId={reinoAEditar} />
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
      <EditorMapa onSelectReino={setReinoAEditar} />
    </div>
  );
}
