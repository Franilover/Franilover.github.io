/**
 * types.ts (Minerales)
 * ───────────────────────────────────────────────────────────────────────────
 * Entidad plana (mismo molde que Flora/Item/Ecosistema): nombre, imagen,
 * descripción, notas y una composición de Elementos (componentes jsonb)
 * vía el mismo motor de afinidad.ts.
 */

import type { ComponenteCompuesto } from "@/domains/garlia/elementos/types";

export interface Mineral {
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

export type MineralInput = Partial<
  Pick<Mineral, "nombre" | "imagen_url" | "descripcion" | "componentes" | "notas" | "orden">
>;
