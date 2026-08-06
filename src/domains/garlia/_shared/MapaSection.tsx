"use client";

/**
 * MapaSection
 * ───────────────────────────────────────────────────────────────────────────
 * Toda la edición del mapa vive acá adentro, dentro de editorGarlia — nada
 * de esto toca la ruta pública (/garlia/mapa), que se renderiza siempre en
 * modo solo-lectura (ver src/app/(public)/garlia/mapa/page.tsx).
 *
 * Un solo componente, sin pasos intermedios: MapaInteractivo con
 * allowEdit=true ya trae fondo + tiles + reinos juntos desde el primer
 * render, y desde ahí se puede tanto gestionar tiles (crear, borrar, poner
 * imagen, mover reinos) como entrar a un reino y editar sus ciudades —
 * todo dentro del mismo componente, sin el EditorMapa separado que se
 * usaba antes (ese sub-modo "tiles" no mostraba el fondo del mar y exigía
 * un click extra para llegar a las demás opciones).
 */

import MapaInteractivo from "@/domains/garlia/reinos/public/mapaGarlia";

export function MapaSection() {
  return (
    <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
      <MapaInteractivo allowEdit />
    </div>
  );
}
