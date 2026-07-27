// API pública de domains/garlia/canciones.
// Fuera de esta carpeta, importar SIEMPRE desde acá — nunca un archivo interno
// directo (@garlia/canciones/PanelEditor sí, pero no desde otra entidad/dominio).
// Ver eslint boundaries: la regla "no-restricted-imports" de domains/garlia
// permite cruces entre entidades solo a través de este archivo.

export { cancionesQueries } from "./queries";
export { useCanciones } from "./useCanciones";
export { useCancionesDelPersonaje } from "./useCancionesDelPersonaje";
export type { CancionMin } from "./useCancionesDelPersonaje";

export { PanelEditor } from "./editor/PanelEditor";
export { ModalNuevaCancion } from "./modals/ModalNuevaCancion";

export type { Cancion, EditorTab, Filtros, IdiomaKey, Seccion } from "./types";
