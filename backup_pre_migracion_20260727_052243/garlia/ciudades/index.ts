// API pública de domains/garlia/ciudades.
// Fuera de esta carpeta, importar SIEMPRE desde acá.

export { ciudadesQueries } from "./queries";
export { useCiudades } from "./useCiudades";
export {
  useReinos,
  usePersonajesDelCiudad,
  useCriaturasDeCiudad,
  useItemsDelCiudad,
  useTodosPersonajes,
  useTodasCriaturas,
  useTodosItems,
  type ReinoMin,
  type PersonajeMin,
  type CriaturaMin,
  type ItemMin,
} from "./useCiudadCatalogos";
export { EditorCiudad } from "./components/EditorCiudad";
export { CiudadEditor } from "./components/CiudadEditor";
export { FormularioCiudad } from "./components/FormularioCiudad";
export type { Ciudad, CiudadMin } from "./model";
