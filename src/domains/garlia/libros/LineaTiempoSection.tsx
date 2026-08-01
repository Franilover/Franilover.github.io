"use client";

/**
 * LineaTiempoSection
 * ───────────────────────────────────────────────────────────────────────────
 * `PanelHistoriaMundo` necesita `texto`/`onChange`/`onSave` de la sección
 * "historia" — antes eso lo proveía `useMundoSecciones()` desde el
 * componente raíz (`EditorMundo.tsx`) y bajaba por props. Ahora el hook se
 * usa directo acá, sin pasar por 2 niveles de componentes intermedios.
 *
 * "Historia completa" (antes un modal flotante encima de la línea de
 * tiempo) ahora es una pestaña más, igual que Personajes o Criaturas:
 * abre con openEntity("linea-tiempo", "historia") y aparece en
 * EntityTabBar. No hay tabla real detrás de esa pseudo-entidad — el id
 * "historia" solo se usa como bandera para que PanelHistoriaMundo
 * renderice HistoriaCompletaPanel en vez de la línea de tiempo normal
 * (ver useEntityTabLabel, que le da su label fijo "Historia completa").
 */

import { PanelHistoriaMundo } from "@/domains/garlia/libros/EditorLineaTiempo";

import { useMundoSecciones } from "@/domains/garlia/_shared/useMundoSecciones";
import { useMundoNavigation } from "@/domains/garlia/_shared/useMundoNavigationStore";

export function LineaTiempoSection() {
  const { textos, setTextos, save } = useMundoSecciones();
  const openEntity = useMundoNavigation((s) => s.openEntity);
  const selectedId = useMundoNavigation((s) => s.selectedId);
  const openTabs = useMundoNavigation((s) => s.openTabs);

  // Si hay una pestaña de un personaje abierta (en cualquier orden, no
  // necesariamente la activa), la usamos para preseleccionar el filtro de
  // "Historia completa" y así mostrar de entrada las eras internas de ese
  // personaje. Si hay varias pestañas de personajes abiertas, se usa la
  // última abierta (la más reciente en openTabs).
  const personajeAbiertoId =
    [...openTabs].reverse().find((t) => t.section === "personajes")?.id ??
    null;

  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
      <PanelHistoriaMundo
        texto={textos.historia}
        onChange={(v) => setTextos((t) => ({ ...t, historia: v }))}
        onSave={() => save("historia", textos.historia)}
        onSelectPersonaje={(id) => openEntity("personajes", id)}
        onSelectCapitulo={() => openEntity("capitulos", "")}
        onSelectCancion={(id) => openEntity("letras", id)}
        onOpenHistoriaCompleta={() => openEntity("linea-tiempo", "historia")}
        mostrarHistoriaCompleta={selectedId === "historia"}
        personajePreseleccionado={personajeAbiertoId}
      />
    </div>
  );
}
