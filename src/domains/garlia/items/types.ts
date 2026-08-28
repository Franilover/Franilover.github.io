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
  /** @deprecated Legado: un solo compuesto. Se mantiene por compatibilidad
   *  con datos viejos, pero la composición actual vive en `composicion`. */
  compuesto_id?: string | null;
  /** Composición material del ítem: puede tener varias partes hechas de
   *  compuestos distintos (ej: "Madera" en el tronco, "Resina" en la savia),
   *  cada una con su propia etiqueta explicando dónde/por qué aplica.
   *
   *  ADVERTENCIA (2026-08-28): no existe columna `composicion` en la tabla
   *  `items` de Supabase — solo `compuesto_id`. Este campo no tiene fuente
   *  real confirmada; no usarlo como base para nueva UI. La composición
   *  física vigente y auditada del objeto vive en `item_materiales`
   *  (ver Item, más abajo, y documentacion_sistema "Modelo físico canónico
   *  v218", orden 1001). */
  composicion?: { compuesto_id: string; tag: string }[];

  // ── Física canónica del objeto (Modelo físico canónico v218) ──────────
  // Fuente de verdad: item_materiales (principal) > compuesto_id (solo
  // compatibilidad, nunca se suman ambas — ver "Fuente física única del
  // objeto", orden 212). Todos los campos siguientes son SOLO LECTURA:
  // Supabase los calcula desde item_materiales + geometria_fisica. El
  // frontend nunca debe derivarlos ni completarlos localmente.
  /**
   * jsonb calculado. Incluye masa/densidad/dureza/etc + metadatos propios:
   * `estado` ("calculable" | "sin_materiales" | "incompleto_geometria"),
   * `fuente_fisica` ("materiales" | "ninguna"), `factor_geometrico`,
   * `resistencia_efectiva`. Ausencia de una clave = NULL, no 0.
   */
  propiedades_fisicas?: (Record<string, unknown> & {
    estado?: string;
    fuente_fisica?: string;
  }) | null;
  /** Espejo de propiedades_fisicas.estado a nivel de fila; usar como fuente
   *  primaria para filtrar/renderizar estado antes de mirar el jsonb. */
  estado_fisico?: string | null;
  /** Geometría declarada de la instancia (forma, volumen, longitud, factor
   *  geométrico). Sin esto no puede derivarse densidad del objeto. */
  geometria_fisica?: Record<string, unknown> | null;
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

/**
 * Fila de la tabla puente item_materiales — composición física real de un
 * Objeto (ver documentacion_sistema "Modelo físico canónico v218", orden
 * 1001, y "Ponderación de materiales", orden 1002).
 *
 * cantidad: cantidad física, acumulativa para la masa.
 * proporcion: peso relativo explícito para propiedades intensivas; si
 *   todas las filas del ítem tienen proporción se normalizan por su suma,
 *   si no se normalizan las cantidades. No recalcular esto en frontend —
 *   Supabase ya entrega el resultado ponderado en propiedades_fisicas.
 */
export type ItemMaterial = {
  id: string;
  item_id: string;
  material_id: string;
  cantidad: number;
  proporcion: number | null;
  rol: string | null;
  created_at: string;
  updated_at: string;
};

export const CONFIG_ITEM_MATERIALES = {
  tabla: "item_materiales",
  select: "id, item_id, material_id, cantidad, proporcion, rol, created_at, updated_at",
};
