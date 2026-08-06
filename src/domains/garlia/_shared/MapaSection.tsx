"use client";

import { useRouter } from "next/navigation";

import { EditorMapa } from "@/domains/garlia/_shared/EditorMapa";

const DESTINO_MAPA = "/garlia/mapa";

export function MapaSection() {
  const router = useRouter();

  // Al hacer click en un reino desde el editor de mapa, en vez de abrir el
  // editor de entidad genérico, navegamos al mapa público y le pedimos —vía
  // el mismo "buzón" que usa el GlobalCommandPalette (sessionStorage +
  // evento "mapa-open-entity")— que abra el panel lateral de ese reino en
  // modo edición (editMode activo + panel abierto), igual que si un admin
  // hubiese hecho click ahí estando en modo edición.
  const editarReinoEnMapa = (reinoId: string) => {
    const detail = { tipo: "reino" as const, entidad_id: reinoId, editar: true };

    if (window.location.pathname === DESTINO_MAPA) {
      window.dispatchEvent(
        new CustomEvent("mapa-open-entity", { detail }),
      );
      return;
    }

    try {
      sessionStorage.setItem(
        "mapa-pending-open-entity",
        JSON.stringify({ ...detail, ts: Date.now() }),
      );
    } catch {}
    router.push(DESTINO_MAPA);
  };

  return (
    <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
      <EditorMapa onSelectReino={editarReinoEnMapa} />
    </div>
  );
}
