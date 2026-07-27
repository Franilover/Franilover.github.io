"use client";

import { EditorMapa } from "@/domains/garlia/_legacy/views/EditorMapa";

import { useMundoNavigation } from "../hooks/mundo/useMundoNavigationStore";

export function MapaSection() {
  const openEntity = useMundoNavigation((s) => s.openEntity);

  return (
    <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
      <EditorMapa onSelectReino={(id) => openEntity("reinos", id)} />
    </div>
  );
}
