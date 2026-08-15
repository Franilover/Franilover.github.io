// Tipos de la entidad Item.
// Extraído de domains/garlia/_shared/types.ts (antes _legacy/hooks/types.ts,
// el "cajón de sastre" que mezclaba Personaje, Criatura, Item, Reino...).

export type Item = {
  id: string;
  nombre: string;
  imagen_url?: string;
  descripcion?: string;
  categoria?: string;
  origen?: "Natural" | "Artificial" | null;
  sub_origen?: "Planta" | "Criatura" | null;
  reino_ids?: string[];
  criatura_id?: string | null;
  criatura?: { id: string; nombre: string; imagen_url?: string } | null;
  /** Compuesto de la Tabla Química que compone este ítem (mismo patrón que
   *  Flora/Mineral: se elige/crea vía SelectorCompuesto). */
  compuesto_id?: string | null;
  // ── Reglas D&D 2024 (fichas_dnd las lee al equipar/atacar) ────────────
  /** Si el ítem es un arma: habilita dado_dano/sutileza/distancia y el
   *  selector de Maestría de Arma al equiparlo en una ficha. */
  es_arma?: boolean;
  /** Dado de daño del arma, ej. "1d8". Solo aplica si es_arma. */
  dado_dano?: string | null;
  /** Arma "sutil": el ataque usa el mayor entre mod. Fuerza/Destreza. */
  sutileza?: boolean;
  /** Arma a distancia: el ataque siempre usa mod. Destreza. */
  distancia?: boolean;
  /** Maestría de arma fija del catálogo (PHB 2024): Sap, Slow, Push, Topple,
   *  Vex, Cleave, Graze o Nick. Es la propiedad "de fábrica" del arma —
   *  distinto de qué maestría tiene activa una ficha en particular, que
   *  vive en fichas_dnd.maestrias_armas. */
  maestria?: string | null;
  /** Si el ítem es una armadura corporal (no escudo): aporta CA base al
   *  equiparse. */
  es_armadura?: boolean;
  /** Si el ítem es un escudo: +2 fijo a la CA, no reemplaza la armadura base. */
  es_escudo?: boolean;
  /** CA base que otorga la armadura antes de sumar mod. Destreza. */
  ca_base_armadura?: number | null;
  /** Tope al mod. Destreza que se suma a la CA: null/undefined = sin tope
   *  (ligera o sin armadura), 2 = media, 0 = pesada. */
  max_bono_dex_armadura?: number | null;
};
