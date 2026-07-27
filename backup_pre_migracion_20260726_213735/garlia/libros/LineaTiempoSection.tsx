"use client";

/**
 * LineaTiempoSection
 * ───────────────────────────────────────────────────────────────────────────
 * `PanelHistoriaMundo` necesita `texto`/`onChange`/`onSave` de la sección
 * "historia" — antes eso lo proveía `useMundoSecciones()` desde el
 * componente raíz (`EditorMundo.tsx`) y bajaba por props. Ahora el hook se
 * usa directo acá, sin pasar por 2 niveles de componentes intermedios.
 */

import { PanelHistoriaMundo } from "@/domains/garlia/libros/EditorLineaTiempo";

import { useMundoSecciones } from "@/domains/garlia/_shared/useMundoSecciones";
import { useMundoNavigation } from "@/domains/garlia/_shared/useMundoNavigationStore";

export function LineaTiempoSection() {
  const { textos, setTextos, save } = useMundoSecciones();
  const openEntity = useMundoNavigation((s) => s.openEntity);

  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
      <PanelHistoriaMundo
        texto={textos.historia}
        onChange={(v) => setTextos((t) => ({ ...t, historia: v }))}
        onSave={() => save("historia", textos.historia)}
        onSelectPersonaje={(id) => openEntity("personajes", id)}
        onSelectCapitulo={() => openEntity("capitulos", "")}
        onSelectCancion={(id) => openEntity("letras", id)}
      />
    </div>
  );
}
