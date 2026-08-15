/**
 * types.ts (Minerales)
 * ───────────────────────────────────────────────────────────────────────────
 * Entidad plana (mismo molde que Flora/Item/Ecosistema): nombre, imagen,
 * descripción, notas y una referencia a un Compuesto del catálogo de
 * Elementos (compuesto_id) — mismo cambio que Flora: ya no arma su propia
 * lista de elementos sueltos, elige/crea un Compuesto existente.
 */

export interface Mineral {
  id: string;
  nombre: string;
  imagen_url: string | null;
  descripcion: string;
  /** @deprecated Legado: un solo compuesto. Se mantiene por compatibilidad
   *  con datos viejos, pero la composición actual vive en `composicion`. */
  compuesto_id: string | null;
  /** Composición material del mineral: puede tener varias partes hechas de
   *  compuestos distintos (ej: "Cuarzo" en la veta principal, "Óxido" en la
   *  superficie), cada una con su propia etiqueta. */
  composicion: { compuesto_id: string; tag: string }[];
  notas: string;
  orden: number;
  created_at: string;
  updated_at: string;
}

export type MineralInput = Partial<
  Pick<
    Mineral,
    "nombre" | "imagen_url" | "descripcion" | "compuesto_id" | "composicion" | "notas" | "orden"
  >
>;
