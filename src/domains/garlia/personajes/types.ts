// Tipos de la entidad Personaje.
// Extraído de domains/garlia/_legacy/hooks/types.ts (el "cajón de sastre" que
// mezclaba Personaje, Criatura, Item, Reino... en un solo archivo). Cuando se
// migren esas otras entidades, sus tipos salen del mismo lugar hacia sus
// propios model.ts.

export type Personaje = {
  id: string;
  nombre: string;
  img_url?: string;
  img_cuerpo_url?: string;
  sobre?: string;
  /** Nombre del reino (no id) — así se guarda hoy en la tabla `personajes`. */
  reino?: string;
  especie?: string;
  caracteristicas?: string;
  variante_id?: string | null;
};
