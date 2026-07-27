// Extraído de src/domains/garlia/_legacy/hooks/types.ts (el cajón de sastre
// que mezclaba Personaje, Criatura, Item, Reino... en un solo archivo).
// Mismo patrón que domains/garlia/personajes/types.ts.

export type Reino = {
  id: string;
  nombre: string;
  historia?: string;
  politica?: string;
  economia?: string;
  geografia?: string;
  cultura?: string;
  mapa_url?: string;
  coord_x?: number;
  coord_y?: number;
  oculto?: boolean;
};

/** Fila mínima usada por catálogos/selects (useReinosMin, filtros, etc). */
export type ReinoMin = {
  id: string;
  nombre: string;
};

/**
 * ReinoDetalle: quedó definido en el mismo cajón de sastre junto a Reino,
 * pero en la práctica el detalle real de un reino es una Ciudad
 * (domains/garlia/_legacy/hooks/types.ts → Ciudad), con reino_id apuntando
 * acá. Se mantiene el alias para no romper nada que aún lo importe desde acá,
 * pero no se usa en el código migrado — Ciudad no es parte de esta entidad.
 */
export type ReinoDetalle = {
  id: string;
  reino_id: string;
  nombre: string;
  descripcion?: string;
  coord_x?: number;
  coord_y?: number;
  oculto?: boolean;
};
