/**
 * types.ts (Flora)
 * ───────────────────────────────────────────────────────────────────────────
 * Entidad plana (mismo molde que Item/Ecosistema): nombre, imagen,
 * descripción, notas y una composición de Elementos (componentes jsonb)
 * que reusa el mismo motor de afinidad.ts que Criaturas (composición
 * material, no orgánica — hoy la Tabla Química es geología/minerales).
 */

import type { ComponenteCompuesto } from "@/domains/garlia/elementos/types";

export interface Flora {
  id: string;
  nombre: string;
  imagen_url: string | null;
  descripcion: string;
  componentes: ComponenteCompuesto[];
  notas: string;
  orden: number;
  created_at: string;
  updated_at: string;
}

export type FloraInput = Partial<
  Pick<Flora, "nombre" | "imagen_url" | "descripcion" | "componentes" | "notas" | "orden">
>;
