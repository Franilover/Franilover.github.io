/**
 * types.ts (Flora)
 * ───────────────────────────────────────────────────────────────────────────
 * Entidad plana (mismo molde que Item/Ecosistema): nombre, imagen,
 * descripción, notas y una referencia a un Compuesto del catálogo de
 * Elementos (compuesto_id) — antes se armaba una lista de elementos
 * sueltos (componentes) por entidad; ahora se elige/crea un Compuesto ya
 * existente en la Tabla Química y esta entidad queda ligada a él.
 */

export interface Flora {
  id: string;
  nombre: string;
  imagen_url: string | null;
  descripcion: string;
  /** @deprecated Legado: un solo compuesto. Se mantiene por compatibilidad
   *  con datos viejos, pero la composición actual vive en `composicion`. */
  compuesto_id: string | null;
  /** Composición material de la planta: puede tener varias partes hechas de
   *  compuestos distintos (ej: "Madera" en el tronco, "Clorofila" en las
   *  hojas), cada una con su propia etiqueta. */
  composicion: { compuesto_id: string; tag: string }[];
  notas: string;
  orden: number;
  created_at: string;
  updated_at: string;
}

export type FloraInput = Partial<
  Pick<
    Flora,
    "nombre" | "imagen_url" | "descripcion" | "compuesto_id" | "composicion" | "notas" | "orden"
  >
>;
