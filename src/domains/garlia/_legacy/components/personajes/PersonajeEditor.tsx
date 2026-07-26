"use client";

/**
 * PersonajeEditor
 * ───────────────────────────────────────────────────────────────────────────
 * El formulario real (usePersonajeForm, PersonajeSidebarPanel, BloqueDones,
 * etc.) ya estaba bien factorizado en EditorPersonaje.tsx — no hace falta
 * reescribirlo. Lo único que cambia es cómo navega: antes recibía funciones
 * sueltas (onNavigate, onSelectPersonaje, onOpenGrupo...) que subían como
 * props desde el componente raíz de 2395 líneas. Ahora todas esas funciones
 * son una sola llamada a openEntity() del store.
 */

import { EditorPersonaje } from "@/domains/garlia/_legacy/views/EditorPersonaje";

import { useMundoNavigation } from "../../hooks/mundo/useMundoNavigationStore";
import { useWikilinkNavigate } from "../../hooks/mundo/useWikilinkNavigate";

interface Personaje {
  id: string;
  nombre: string;
  [key: string]: any;
}

export function PersonajeEditor({ personaje }: { personaje: Personaje }) {
  const openEntity = useMundoNavigation((s) => s.openEntity);
  // Resuelve nombre → id contra el cache de personajes/criaturas/items/
  // reinos/ciudades/hechizos/dones/runas y navega. Reusado acá porque
  // onNavigate("criaturas"/"reinos", nombre) de EditorPersonaje solo entrega
  // el NOMBRE de la especie/reino, nunca el id (por diseño de ese formulario).
  const navigateByName = useWikilinkNavigate();

  return (
    <EditorPersonaje
      item={personaje as any}
      onSaved={() => {
        /* useSupabaseData ya actualiza su cache local vía addRow/updateRow;
           no hace falta replicar el item en un estado padre paralelo. */
      }}
      onDeleted={() => openEntity("personajes", "")}
      onNavigate={(_tab, nombre) => navigateByName(nombre)}
      onSelectPersonaje={(id) => openEntity("personajes", id)}
      onOpenGrupo={(id) => openEntity("grupos", id)}
      onNavigateCiudad={(id) => openEntity("ciudades", id)}
      onNavigateCapitulo={(capituloId) => openEntity("capitulos", capituloId)}
      onSelectCancion={(id) => openEntity("letras", id)}
    />
  );
}
