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

  /**
   * jsonb calculado por Supabase. Incluye, además de las 9 propiedades
   * físicas, la clave `fuente_fisica` (ver documentacion_sistema "Fuente
   * por propiedad en Material v187", orden 421): indica de dónde vino el
   * valor — "composicion", "estructura", "estructura_y_composicion" — o
   * ausencia si no es derivable. No inferir la fuente en frontend; leerla
   * tal cual la entrega Supabase.
   */
  propiedades_calculadas: Record<string, unknown> & { fuente_fisica?: string };
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

/**
 * Perfil Reactivo Emergente V2 — fuente de verdad: vista `v_perfil_reactivo_material`.
 *
 * IMPORTANTE: `materiales.capacidades_reactivas` NO es esta fuente — es un
 * campo legado que hoy queda vacío ({}) para todos los materiales. El
 * perfil reactivo real (ver documentacion_sistema, orden 1101 "Perfil
 * reactivo emergente V2") se deriva de microestructura y vive en esta
 * vista. Cuando un material no tiene desglose microscópico suficiente,
 * `estado` refleja `insuficiente_informacion` en vez de inventar un
 * perfil — no se debe tratar como si fuera cero ni omitirse en la UI.
 */
export interface PerfilReactivoMaterial {
  material_id: string;
  material: string;
  estado: string;
  perfil: {
    modelo?: string;
    origen?: string;
    peso_total?: number;
    aportes_elementales?: number;
    afinidad_reactiva?: number;
    dinamismo_reactivo?: number;
    estabilidad_reactiva?: number;
    conductividad_reactiva?: number;
    actividad_catalitica_reactiva?: number;
    potencial_transicion_reactivo?: number;
    potencial_transformacion_reactiva?: number;
    [key: string]: unknown;
  } | null;
}

export const CONFIG_PERFIL_REACTIVO_MATERIAL = {
  tabla: "v_perfil_reactivo_material",
  select: "material_id, material, estado, perfil",
};
