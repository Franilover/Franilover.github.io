/**
 * types.ts — domains/garlia/materiales
 *
 * Catálogo de Materiales.
 *
 * Fuente de verdad:
 *   materiales
 *   material_componentes
 *   material_estructuras
 *
 * Las propiedades físicas vienen calculadas desde Supabase y son SOLO
 * lectura en el frontend.
 */

export interface Material {
  id: string;
  nombre: string;
  descripcion: string | null;
  notas: string | null;

  tipo_material: string;
  material_padre_id: string | null;

  propiedades_calculadas: Record<string, unknown>;
  estado_calculo: string;

  orden: number;
  created_at: string;
  updated_at: string;

  /** Falta en el select original — agregada 2026-08-27 (ver auditoría de
   *  columnas faltantes en elementos/compuestos/materiales). Solo lectura,
   *  calculada por Supabase. */
  capacidades_reactivas: Record<string, unknown> | null;
}

export interface MaterialComponente {
  id: string;
  material_id: string;
  componente_tipo: string;
  componente_id: string;

  cantidad: number;
  proporcion_min: number | null;
  proporcion_max: number | null;

  unidad: string | null;
  rol: string | null;
  orden: number;

  created_at: string;
  updated_at: string;
}

export interface MaterialEstructura {
  id: string;
  material_id: string;
  estructura_id: string;

  cantidad: number;
  proporcion: number | null;
  rol: string | null;

  created_at: string;
}

export const CONFIG_MATERIALES = {
  tabla: "materiales",
  // 2026-08-27: agregada "capacidades_reactivas", única columna real de la
  // tabla "materiales" que faltaba en el select — ver auditoría de columnas
  // faltantes en elementos/compuestos/materiales.
  select:
    "id, nombre, descripcion, notas, tipo_material, material_padre_id, " +
    "propiedades_calculadas, estado_calculo, orden, created_at, updated_at, " +
    "capacidades_reactivas",
};

export const CONFIG_MATERIAL_COMPONENTES = {
  tabla: "material_componentes",
  select:
    "id, material_id, componente_tipo, componente_id, cantidad, " +
    "proporcion_min, proporcion_max, unidad, rol, orden, created_at, updated_at",
};

export const CONFIG_MATERIAL_ESTRUCTURAS = {
  tabla: "material_estructuras",
  select:
    "id, material_id, estructura_id, cantidad, proporcion, rol, created_at",
};
