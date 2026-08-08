/**
 * types.ts — domains/garlia/biologia
 * ───────────────────────────────────────────────────────────────────────────
 * Módulo self-contained de Biología: NO duplica criaturas (siguen viviendo
 * en domains/garlia/criaturas / tabla "criaturas"), solo las referencia por
 * id — mismo criterio que subsistemas_magia.criatura_ids.
 *
 * Piezas:
 *   1. Taxón (árbol filogenético) — jerarquía de rangos CONFIGURABLE (no
 *      hardcodeada a Reino/Filo/Clase reales), con padre_id para el árbol.
 *      Cada taxón puede tener 0+ criaturas asignadas.
 *   2. Ecosistema — bioma/región con criaturas que lo habitan (multi,
 *      mismo patrón que subsistemas_magia.criatura_ids).
 *   3. Cadena alimenticia — eslabones ordenados, cada uno con un rol
 *      (productor/herbívoro/carnívoro/omnívoro/descompositor) y 1+
 *      criaturas en ese rol.
 *   4. Perfil atómico de criatura — "compuesto vivo": reusa el motor de
 *      afinidad.ts de Elementos tal cual (mismo shape ComponenteCompuesto),
 *      tratando a la criatura como un compuesto con sus propios
 *      componentes (elemento_id + cantidad).
 */

import { Dna, Leaf, Salad, Atom } from "lucide-react";

import type { ComponenteCompuesto } from "@/domains/garlia/elementos/types";

// ─── Taxonomía (árbol filogenético) ────────────────────────────────────────

/** Rangos por defecto — editables/renombrables/extendibles, no fijos. */
export const RANGOS_TAXONOMICOS_DEFAULT: string[] = [
  "Reino",
  "Filo",
  "Clase",
  "Orden",
  "Familia",
  "Género",
  "Especie",
];

/** Fila cruda tal cual vive en Supabase (tabla "taxones"). */
export interface Taxon {
  id: string;
  nombre: string;
  /** Rango dentro de la jerarquía configurable (ej. "Reino", "Filo"...). */
  rango: string;
  /** Taxón padre en el árbol — null si es raíz. */
  padre_id: string | null;
  descripcion: string;
  /** Criaturas (por id) que pertenecen exactamente a este taxón (nivel hoja o intermedio). */
  criatura_ids: string[];
  orden: number;
  created_at: string;
  updated_at: string;
}

export type TaxonInput = Partial<
  Pick<Taxon, "nombre" | "rango" | "padre_id" | "descripcion" | "criatura_ids" | "orden">
>;

/** Config de rangos del árbol — una sola fila viva en "biologia_config". */
export interface BiologiaConfig {
  id: string;
  rangos: string[];
}

// ─── Ecosistemas ────────────────────────────────────────────────────────────

/** Fila cruda tal cual vive en Supabase (tabla "ecosistemas"). */
export interface Ecosistema {
  id: string;
  nombre: string;
  bioma: string;
  clima: string;
  descripcion: string;
  criatura_ids: string[];
  orden: number;
  created_at: string;
  updated_at: string;
}

export type EcosistemaInput = Partial<
  Pick<Ecosistema, "nombre" | "bioma" | "clima" | "descripcion" | "criatura_ids" | "orden">
>;

// ─── Cadenas alimenticias ───────────────────────────────────────────────────

export type RolTrofico =
  | "productor"
  | "herbivoro"
  | "carnivoro"
  | "omnivoro"
  | "descompositor";

export const ROL_TROFICO_LABEL: Record<RolTrofico, string> = {
  productor: "Productor",
  herbivoro: "Herbívoro",
  carnivoro: "Carnívoro",
  omnivoro: "Omnívoro",
  descompositor: "Descomponedor",
};

export const ROLES_TROFICOS: RolTrofico[] = [
  "productor",
  "herbivoro",
  "carnivoro",
  "omnivoro",
  "descompositor",
];

/** Un eslabón de la cadena: un rol trófico con 1+ criaturas que lo ocupan. */
export interface EslabonTrofico {
  id: string;
  rol: RolTrofico;
  criatura_ids: string[];
  nota?: string;
}

/** Fila cruda tal cual vive en Supabase (tabla "cadenas_alimenticias"). */
export interface CadenaAlimenticia {
  id: string;
  nombre: string;
  ecosistema_id: string | null;
  descripcion: string;
  eslabones: EslabonTrofico[];
  orden: number;
  created_at: string;
  updated_at: string;
}

export type CadenaAlimenticiaInput = Partial<
  Pick<
    CadenaAlimenticia,
    "nombre" | "ecosistema_id" | "descripcion" | "eslabones" | "orden"
  >
>;

// ─── Perfil de criatura ─────────────────────────────────────────────────────
// Tres bloques independientes y con semántica distinta (ver discusión de
// diseño): los Oris son leyes externas al universo, no algo que "compone"
// a la criatura — que un Oris tenga dominio "Biológica" no le da a las
// criaturas ninguna relación especial con él. Lo real:
//
//   1. Canalización: qué Oris puede canalizar activamente si es mágica —
//      afinidad de uso, no de composición (oris_ids).
//   2. Rasgos evolutivos: marca física permanente por Fantasía evolutiva/
//      residual — exposición ambiental acumulada a un -ium/Oris concreto
//      (ver conceptos "Las tres fuentes de fantasía" en Física). Nuevo.
//   3. Composición material: de qué está hecho el tejido duro/mineral del
//      cuerpo (huesos, caparazón, escamas) — reusa tal cual el motor de
//      afinidad.ts de Elementos, la única tabla de materia que existe hoy.
//      No representa "toda la criatura", solo sus partes minerales/duras.

/** Un rasgo adquirido por exposición ambiental prolongada a un Oris/-ium
 * concreto — marca física permanente, distinta de canalización activa. */
export interface RasgoEvolutivo {
  id: string;
  /** Oris cuya exposición ambiental originó el rasgo. */
  oris_id: string;
  /** Ej. "Piel resistente al calor por exposición residual a Thermoris". */
  descripcion: string;
  /** evolutiva = generaciones de adaptación; residual = exposición acumulada sin canalización. */
  tipo: "evolutiva" | "residual";
}

export const TIPO_RASGO_EVOLUTIVO_LABEL: Record<RasgoEvolutivo["tipo"], string> = {
  evolutiva: "Fantasía evolutiva (adaptación generacional)",
  residual: "Fantasía residual (exposición acumulada)",
};

/** Fila cruda tal cual vive en Supabase (tabla "perfiles_atomicos_criatura"). */
export interface PerfilAtomicoCriatura {
  id: string;
  criatura_id: string;
  /** Composición material — solo tejido duro/mineral (ver nota arriba). */
  componentes: ComponenteCompuesto[];
  /** Oris que la criatura puede canalizar activamente (si es mágica). */
  oris_ids: string[];
  /** Rasgos físicos permanentes heredados de exposición ambiental. */
  rasgos_evolutivos: RasgoEvolutivo[];
  notas: string;
  created_at: string;
  updated_at: string;
}

export type PerfilAtomicoCriaturaInput = Partial<
  Pick<PerfilAtomicoCriatura, "componentes" | "oris_ids" | "rasgos_evolutivos" | "notas">
>;

// ─── Sub-tabs de Biología ───────────────────────────────────────────────────

export type SeccionBiologia = "taxonomia" | "ecosistemas" | "perfiles";

export const SECCIONES_BIOLOGIA: {
  key: SeccionBiologia;
  label: string;
  Icon: React.ElementType;
}[] = [
  { key: "taxonomia", label: "Taxonomía", Icon: Dna },
  { key: "ecosistemas", label: "Ecosistemas", Icon: Leaf },
  { key: "perfiles", label: "Perfiles", Icon: Atom },
];

export const CADENA_ICON = Salad;
