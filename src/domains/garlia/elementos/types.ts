/**
 * types.ts — domains/garlia/elementos
 * ───────────────────────────────────────────────────────────────────────────
 * Tipos del sistema de Alquimia/Energías: los 29 Elementos base, sus 3 capas
 * (núcleo, media, externa) y las 11 partículas posibles por capa.
 *
 * Basado en el documento de arquitectura (types.ts / registry.ts del motor
 * de dominio) y en TablaQuimica.py — unificados acá como la fuente única
 * editable desde Supabase (tabla "elementos").
 *
 * Capas guardadas como jsonb: { "Masa": 2, "Potencial": 1, ... } — mismo
 * patrón que patron_trazos (jsonb) en runas/types.ts.
 */

import { Atom, Beaker, Gem, Layers, Sparkle } from "lucide-react";

export type ParticleType =
  | "Masa"
  | "Cinética"
  | "Potencial"
  | "Información"
  | "Voluntad"
  | "Percepción"
  | "Transición"
  | "Ciclo"
  | "Entropía"
  | "Catálisis"
  | "Equilibrio";

export const PARTICLE_TYPES: ParticleType[] = [
  "Masa",
  "Cinética",
  "Potencial",
  "Información",
  "Voluntad",
  "Percepción",
  "Transición",
  "Ciclo",
  "Entropía",
  "Catálisis",
  "Equilibrio",
];

/** Inicial usada como abreviatura corta en las tarjetas (ej. "2M 1P"). */
export const PARTICLE_INITIAL: Record<ParticleType, string> = {
  Masa: "M",
  Cinética: "C",
  Potencial: "P",
  Información: "I",
  Voluntad: "V",
  Percepción: "Pc",
  Transición: "T",
  Ciclo: "Cl",
  Entropía: "E",
  Catálisis: "Ct",
  Equilibrio: "Eq",
};

export type LayerName = "nucleo" | "media" | "externa";

export const LAYER_LABEL: Record<LayerName, string> = {
  nucleo: "Núcleo",
  media: "Media",
  externa: "Externa",
};

export type ParticleMap = Partial<Record<ParticleType, number>>;

export type ElementFamily =
  | "Sensibles"
  | "Reactivos"
  | "Nobles"
  | "Base Terrosa"
  | "Puente";

export const ELEMENT_FAMILIES: ElementFamily[] = [
  "Sensibles",
  "Reactivos",
  "Nobles",
  "Base Terrosa",
  "Puente",
];

export const FAMILY_ICON: Record<ElementFamily, React.ElementType> = {
  Sensibles: Sparkle,
  Reactivos: Beaker,
  Nobles: Gem,
  "Base Terrosa": Layers,
  Puente: Atom,
};

// ─── Estado (manifestación natural) ────────────────────────────────────────
// Los 4 "estados de la materia" del sistema — mismo espíritu que
// sólido/líquido/gaseoso/plasma del mundo real, ya mencionados como texto
// en la info de la Tabla Química. Ahora es un campo real del elemento, para
// poder calcular afinidad/reactividad entre compuestos (ver afinidad.ts).
export type EstadoElemento = "Cristalio" | "Fluxio" | "Nebulio" | "Plasmio";

export const ESTADOS_ELEMENTO: EstadoElemento[] = [
  "Cristalio",
  "Fluxio",
  "Nebulio",
  "Plasmio",
];

/** Equivalente real de cada estado, para mostrar en la UI. */
export const ESTADO_EQUIVALENTE_REAL: Record<EstadoElemento, string> = {
  Cristalio: "Sólido",
  Fluxio: "Líquido",
  Nebulio: "Gaseoso",
  Plasmio: "Plasma/Energético",
};

/** Fila cruda tal cual vive en Supabase (tabla "elementos"). */
export interface Elemento {
  id: string;
  numero_atomico: number;
  nombre: string;
  simbolo: string;
  familia: ElementFamily;
  es_noble: boolean;
  /** Manifestación natural — opcional por compatibilidad con filas viejas. */
  estado?: EstadoElemento | null;
  notas?: string | null;
  nucleo: ParticleMap;
  media: ParticleMap;
  externa: ParticleMap;
  /**
   * Catalizador: reduce la "energía de activación" (déficit) de un compuesto
   * sin aportar sus partículas a las capas y sin consumirse en la reacción —
   * mismo espíritu que un catalizador real. Opcional por compatibilidad con
   * filas viejas; default false si no está seteado.
   */
  es_catalizador?: boolean | null;
}

export const CONFIG = {
  tabla: "elementos",
  select:
    "id, numero_atomico, nombre, simbolo, familia, es_noble, estado, notas, nucleo, media, externa, es_catalizador",
};

// ─── Compuestos: combinaciones de elementos de la Tabla Química ───────────
// Ej. Agua = Fluxio + Cristalio, Fuego = Plasmio + Reactivo, etc. Cada
// compuesto referencia 2+ elementos por id (componentes) y tiene su propio
// nombre/símbolo/notas — mismo espíritu que EditorCombinacionesRunas pero
// para Elementos en vez de Runas.
export interface ComponenteCompuesto {
  elemento_id: string;
  /** Cuántas "partes" de este elemento entran en el compuesto (default 1). */
  cantidad: number;
}

/** Fila cruda tal cual vive en Supabase (tabla "compuestos"). */
export interface Compuesto {
  id: string;
  nombre: string;
  simbolo?: string | null;
  notas?: string | null;
  componentes: ComponenteCompuesto[];
  created_at?: string;
}

export const CONFIG_COMPUESTOS = {
  tabla: "compuestos",
  select: "id, nombre, simbolo, notas, componentes, created_at",
};

/** Compacta un ParticleMap en algo tipo "2M 1P" para tarjetas/resúmenes. */
export function formatLayer(layer: ParticleMap | null | undefined): string {
  if (!layer) return "—";
  const entries = Object.entries(layer).filter(([, v]) => (v ?? 0) > 0);
  if (entries.length === 0) return "—";
  return entries
    .map(([k, v]) => `${v}${PARTICLE_INITIAL[k as ParticleType] ?? k[0]}`)
    .join(" ");
}

/** Total de partículas en una capa (para mostrar ocupación, ej. "4/4"). */
export function layerTotal(layer: ParticleMap | null | undefined): number {
  if (!layer) return 0;
  return Object.values(layer).reduce((a, b) => a + (b ?? 0), 0);
}

// ─── Afinidad entre compuestos ─────────────────────────────────────────────
// Basada en estructura atómica real, no en reglas arbitrarias tipo "agua
// apaga fuego": cada capa (núcleo/media/externa) tiene una capacidad fija
// (2/4/6, ver CAPACIDAD_CAPA) — igual que la valencia química real, donde
// el carbono "necesita" 4 electrones más para completar su capa externa y
// por eso se enlaza con otros átomos que se los aportan.
//
// Acá: sumamos las partículas de todos los elementos de un compuesto, capa
// por capa. Si una capa queda por debajo de su capacidad, el compuesto
// tiene un "déficit" en esa capa — literalmente le faltan partículas de
// ese tipo para estabilizarse. Dos compuestos tienen afinidad si el
// déficit de uno se resuelve con el superávit (sobrante) del otro: se
// "atraen" porque uno completa lo que al otro le falta, igual que dos
// elementos que se enlazan para completar su capa de valencia.
export const CAPACIDAD_CAPA: Record<LayerName, number> = {
  nucleo: 2,
  media: 4,
  externa: 6,
};

export type TipoAfinidad = "complementa" | "compite" | "saturado" | "estable";

export const AFINIDAD_LABEL: Record<TipoAfinidad, string> = {
  complementa: "Se complementan",
  compite: "Compiten por las mismas partículas",
  saturado: "Sobrecarga (ambos ya están completos o sobrantes)",
  estable: "Sin interacción relevante",
};

export interface ResultadoAfinidad {
  tipo: TipoAfinidad;
  /** Explicación corta y en lenguaje natural de por qué. */
  motivo: string;
  /** Partículas que un compuesto le aporta al otro para completarlo. */
  aportes: { particula: ParticleType; cantidad: number }[];
}

// ─── Reactividad ("energía de activación") ─────────────────────────────────
// Cuanto más déficit acumulado tiene un compuesto (más lejos está de
// completar sus 3 capas), menos "energía" hace falta para que reaccione —
// es literalmente inestable, como un átomo lejos de la regla del octeto.
// Un compuesto saturado (déficit 0) es inerte: cuesta mucho romper su
// estructura para que participe en algo nuevo.
export type NivelReactividad = "muy_inestable" | "inestable" | "moderado" | "inerte";

export const REACTIVIDAD_LABEL: Record<NivelReactividad, string> = {
  muy_inestable: "Muy inestable",
  inestable: "Inestable",
  moderado: "Moderadamente reactivo",
  inerte: "Inerte",
};

export interface ResultadoReactividad {
  /** Déficit total sumado en las 3 capas (0 = ninguna capa incompleta). */
  deficitTotal: number;
  /** Capacidad total de las 3 capas — techo teórico del déficit. */
  capacidadTotal: number;
  nivel: NivelReactividad;
}

// ─── Peso molecular ─────────────────────────────────────────────────────────
export interface ResultadoPeso {
  /** Suma de todas las partículas de todos los componentes (masa total). */
  pesoTotal: number;
  categoria: "liviano" | "medio" | "pesado";
}

// ─── Estequiometría exacta ──────────────────────────────────────────────────
// Múltiplo mínimo de cada elemento del compuesto que deja las 3 capas
// exactamente en 0 (sin déficit ni sobrante) — el equivalente a balancear
// una ecuación química real (2H₂ + O₂ → 2H₂O).
export interface ResultadoEstequiometria {
  /** true si existe una combinación entera de multiplicadores que balancea exacto. */
  balanceado: boolean;
  /** Componentes con la cantidad mínima balanceada (solo si balanceado = true). */
  componentes: ComponenteCompuesto[];
  /** Factor por el que se multiplicó la mezcla original para llegar al balance. */
  factor: number;
}
