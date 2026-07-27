// Extraído de src/domains/garlia/_legacy/hooks/types.ts (el cajón de sastre
// que mezclaba Personaje, Criatura, Item, Reino, Ciudad... en un solo archivo).
// Mismo patrón que domains/garlia/reinos/types.ts.
//
// Nota: reinos/model.ts (ReinoDetalle) ya documentaba que el "detalle" real
// de un reino es en la práctica una Ciudad, con reino_id apuntando al reino.
// Esta es esa entidad, migrada como propia.

export type Ciudad = {
  id: string;
  nombre: string;
  tipo?: string | null;
  descripcion?: string | null;
  historia?: string | null;
  secretos?: string | null;
  imagen_url?: string | null;
  reino_id?: string | null;
  coord_x?: number | null;
  coord_y?: number | null;
  oculto?: boolean;
};

/** Fila mínima usada por catálogos/selects (useCiudades, filtros, etc). */
export type CiudadMin = {
  id: string;
  nombre: string;
  reino_id: string | null;
};
