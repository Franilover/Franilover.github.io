"use client";

/**
 * useEditorHeaderControls
 * ───────────────────────────────────────────────────────────────────────────
 * Cada editor de entidad (EditorItem, EditorPersonaje, EditorCriatura,
 * EditorReino, FloraEditor, MineralEditor) ya NO renderiza su propia barra
 * superior fija (imagen + nombre + acciones). En su lugar, "publica" los
 * controles de esa barra hacia quien lo esté envolviendo — normalmente
 * PanelFlotanteGlobal, que tiene su propia barra superior y renderiza ahí
 * mismo el nombre editable, el indicador de guardado, y los botones de
 * guardar/eliminar/extra del editor activo — evitando así la barra
 * duplicada que antes aparecía dos veces (una del panel flotante, otra del
 * editor) en las vistas rápidas.
 *
 * Cuando el editor se usa a pantalla completa (no dentro del panel
 * flotante) y no hay ningún receptor de headerControls, el consumidor de
 * ese contexto (p. ej. una página que renderiza el editor directo) debe
 * seguir mostrando su propia barra usando estos mismos controles vía
 * <EditorHeaderBar controls={...} />, para no perder la funcionalidad ahí.
 */

import { useEffect } from "react";
import { type ReactNode } from "react";

import { type SaveStatus } from "@/ui/saveStatus";

export interface EditorHeaderControls {
  /** Ícono o thumbnail (imagen circular/rounded) mostrado a la izquierda.
   *  Si no hay imagenUrl ni IconoFallback, no se renderiza el cuadro
   *  (editores como Elemento/Compuesto no usan thumbnail de imagen). */
  imagenUrl?: string | null;
  /** Ícono de fallback cuando no hay imagenUrl (lucide component). */
  IconoFallback?: React.ComponentType<{ className?: string; size?: number }>;
  /** Contenido libre renderizado ANTES del input de nombre — p. ej. el
   *  botón de volver (ChevronLeft) y el badge "#numero_atomico" de
   *  Elemento, que no encajan como thumbnail ni como "extra" (que va
   *  después del nombre). */
  prefix?: ReactNode;
  nombre: string;
  placeholderNombre: string;
  onChangeNombre: (nombre: string) => void;
  /** Se llama al perder foco del input de nombre, para editores que
   *  autoguardan on-blur (Flora/Mineral) en vez de con botón Guardar. */
  onBlurNombre?: () => void;
  /** Texto corto renderizado inmediatamente a la derecha del nombre, con
   *  menor énfasis visual (ej. "Ceniza · 1 Cn + 2 Ep + 1 Fu" en
   *  Compuesto: la fórmula expandida de compuesto_elementos). Opcional —
   *  la mayoría de los editores no lo usan. Trunca en vez de romper el
   *  header si nombre+subtitulo no entran en una línea. */
  subtitulo?: ReactNode;
  status: SaveStatus;
  onGuardar: () => void;
  onEliminar: () => void;
  /** Botones o controles extra específicos del editor (dado D&D, toggles
   *  de panel en Criatura, etc.), renderizados entre el nombre y las
   *  acciones de guardar/eliminar. */
  extra?: ReactNode;
}

/** Firma que debe recibir un editor para publicar sus controles de header
 *  hacia el contenedor (típicamente PanelFlotanteGlobal). */
export type OnHeaderControlsChange = (controls: EditorHeaderControls | null) => void;

/**
 * Publica los controles de header cada vez que cambian, y los limpia al
 * desmontar. `onHeaderControlsChange` es opcional: si el editor se usa
 * fuera de un contenedor que sepa recibirlos (p. ej. tests o storybook),
 * simplemente no hace nada.
 */
export function usePublishHeaderControls(
  controls: EditorHeaderControls,
  onHeaderControlsChange?: OnHeaderControlsChange,
) {
  useEffect(() => {
    onHeaderControlsChange?.(controls);
    return () => onHeaderControlsChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    onHeaderControlsChange,
    controls.imagenUrl,
    controls.prefix,
    controls.nombre,
    controls.subtitulo,
    controls.status,
    controls.extra,
  ]);
}
