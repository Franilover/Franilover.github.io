/**
 * types.ts — domains/garlia/biologia
 * ───────────────────────────────────────────────────────────────────────────
 * Módulo self-contained de Biología: NO duplica criaturas (siguen viviendo
 * en domains/garlia/criaturas / tabla "criaturas"), solo las referencia por
 * id — mismo criterio que subsistemas_magia.criatura_ids.
 *
 * Piezas:
 *   1. Bioma — condición única del mundo (ligada a Oris/elementos), M:N con
 *      Reino. Contiene 0+ Ecosistemas (subzonas geográficas concretas).
 *   2. Clado (cladograma) — árbol filogenético SIN rangos fijos (nada de
 *      Reino/Filo/Clase). Cada nodo es un grupo monofilético definido por
 *      una sinapomorfía (carácter derivado compartido por todos sus
 *      descendientes) — el criterio real de la cladística moderna, no la
 *      jerarquía linneana. padre_id arma el árbol; profundidad libre.
 *      Cada clado puede tener 0+ criaturas asignadas (típicamente en las
 *      hojas, pero nada lo obliga).
 *   3. Ecosistema — subzona concreta dentro de un Bioma, con criaturas que
 *      la habitan (multi, mismo patrón que subsistemas_magia.criatura_ids).
 *   4. Cadena alimenticia — eslabones ordenados, cada uno con un rol
 *      (productor/herbívoro/carnívoro/omnívoro/descompositor) y 1+
 *      criaturas en ese rol.
 *   5. Perfil atómico de criatura — "compuesto vivo": reusa el motor de
 *      afinidad.ts de Elementos tal cual (mismo shape ComponenteCompuesto),
 *      tratando a la criatura como un compuesto con sus propios
 *      componentes (elemento_id + cantidad).
 */

import { Compass, Dna, Leaf, Salad } from "lucide-react";

import type { ComponenteCompuesto } from "@/domains/garlia/elementos/types";

// ─── Biomas ─────────────────────────────────────────────────────────────────
// Nivel jerárquico por ENCIMA de Ecosistema: un Bioma es una condición única
// del mundo (ligada a la física/elementos de Oris), no un tipo climático
// intercambiable. Puede extenderse por varios Reinos, y un Reino puede tener
// territorio en varios Biomas — many-to-many en ambos sentidos.
//
//   Bioma "Desierto Mágico de Cristal"   ← único, propio del mundo
//     ↓ reino_ids (M:N)
//     Ecosistema "Dunas de Khazir"       ← subzona geográfica concreta
//     Ecosistema "Oasis de Vael"
//       ↓
//       Criaturas, Flora, Minerales

/** Fila cruda tal cual vive en Supabase (tabla "biomas"). */
export interface Bioma {
  id: string;
  nombre: string;
  descripcion: string;
  /** Afinidad simple con Oris/elementos del mundo (texto libre por ahora). */
  afinidad: string;
  /** Reinos (por id) que tienen territorio en este bioma — M:N. */
  reino_ids: string[];
  orden: number;
  created_at: string;
  updated_at: string;
}

export type BiomaInput = Partial<
  Pick<Bioma, "nombre" | "descripcion" | "afinidad" | "reino_ids" | "orden">
>;

// ─── Cladística (cladograma / árbol filogenético) ──────────────────────────

/** Fila cruda tal cual vive en Supabase (tabla "clados"). */
export interface Clado {
  id: string;
  nombre: string;
  /**
   * Sinapomorfía: el carácter derivado compartido por todos los
   * descendientes de este clado, lo que lo define como grupo monofilético
   * (ej. "Presencia de vejiga de veneno dorsal"). Es el corazón del
   * criterio cladístico — a diferencia de un "rango" linneano, no es una
   * etiqueta de nivel sino la evidencia evolutiva del agrupamiento.
   */
  sinapomorfia: string;
  /** Clado padre en el árbol — null si es raíz (ancestro común más lejano registrado). */
  padre_id: string | null;
  descripcion: string;
  /** Criaturas (por id) que pertenecen exactamente a este clado. */
  criatura_ids: string[];
  orden: number;
  created_at: string;
  updated_at: string;
}

export type CladoInput = Partial<
  Pick<Clado, "nombre" | "sinapomorfia" | "padre_id" | "descripcion" | "criatura_ids" | "orden">
>;

// ─── Ecosistemas ────────────────────────────────────────────────────────────

/** Fila cruda tal cual vive en Supabase (tabla "ecosistemas"). */
export interface Ecosistema {
  id: string;
  nombre: string;
  /** FK a Bioma (biologia/types.ts → Bioma) — null si no está asignado a ninguno. */
  bioma_id: string | null;
  clima: string;
  descripcion: string;
  /** Flora (por id) que crece/habita en este ecosistema. */
  flora_ids: string[];
  /** Minerales (por id) presentes como recursos de este ecosistema. */
  mineral_ids: string[];
  orden: number;
  created_at: string;
  updated_at: string;
}

export type EcosistemaInput = Partial<
  Pick<
    Ecosistema,
    "nombre" | "bioma_id" | "clima" | "descripcion" | "flora_ids" | "mineral_ids" | "orden"
  >
>;

// ─── Ecosistema ↔ Criatura (tabla puente) ──────────────────────────────────
// Ruta canónica (migración v226) para la relación M:N entre Ecosistema y
// Criatura — reemplaza la antigua columna embebida `ecosistemas.criatura_ids`
// (retirada por duplicar la misma relación). Vive en la tabla
// "ecosistema_criaturas", con atributos propios de la asociación.

/** Fila cruda tal cual vive en Supabase (tabla "ecosistema_criaturas"). */
export interface EcosistemaCriatura {
  ecosistema_id: string;
  criatura_id: string;
  /** Rol de la criatura dentro de ese ecosistema — semántica libre. */
  rol: string | null;
  /** Abundancia de la criatura dentro de ese ecosistema — semántica libre. */
  abundancia: string | null;
}

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
  /** Flora (por id) que ocupa este eslabón — típicamente rol "productor". */
  flora_ids?: string[];
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

export type SeccionBiologia = "cladistica" | "ecosistemas";

export const SECCIONES_BIOLOGIA: {
  key: SeccionBiologia;
  label: string;
  Icon: React.ElementType;
}[] = [
  { key: "cladistica", label: "Cladística", Icon: Dna },
  { key: "ecosistemas", label: "Ecosistemas", Icon: Leaf },
];

export const CADENA_ICON = Salad;
export const BIOMA_ICON = Compass;
