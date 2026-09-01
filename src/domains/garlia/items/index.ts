// API pública de domains/garlia/items.
// Fuera de esta carpeta, importar SIEMPRE desde acá.

export { itemsQueries } from "./queries";
export { EditorItem } from "./EditorItem";
export { ItemEditor } from "./ItemEditor";
export type { Item } from "@/lib/types/queries";

// Composición física real del objeto (item_materiales) — ver
// documentacion_sistema "Modelo físico canónico v218", orden 1001.
// NOTA: el `Item` público de arriba viene de @/lib/types/queries, no de
// ./types.ts; si ese `Item` no expone propiedades_fisicas/estado_fisico/
// geometria_fisica, deben agregarse ahí también (misma auditoría de
// columnas faltantes que ya se hizo para materiales/capacidades_reactivas).
export {
  CONFIG_ITEM_MATERIALES,
  type ItemMaterial,
} from "./types";
export { useItemMateriales } from "./useItemMateriales";
export { PanelFisicaObjeto } from "./PanelFisicaObjeto";
export { SelectorMaterialesItem } from "./SelectorMaterialesItem";
export { EditorGeometriaItem } from "./EditorGeometriaItem";
export { useUnidadVolumen } from "./useUnidadVolumen";
