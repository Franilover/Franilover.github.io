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
  compuesto_id: string | null;
  notas: string;
  orden: number;
  created_at: string;
  updated_at: string;
}

export type MineralInput = Partial<
  Pick<Mineral, "nombre" | "imagen_url" | "descripcion" | "compuesto_id" | "notas" | "orden">
>;
