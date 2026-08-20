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

import { Gem, Link2, Scale, Wind, CircleOff } from "lucide-react";

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

/**
 * Qué tipos de partícula pertenecen a cada capa — según la Ley de las 3
 * capas (ver reglas-sistema-actualizado.md):
 *   Núcleo (Ancla Estructural): Masa, Cinética, Equilibrio.
 *   Media (Motor Energético): Potencial, Información, Ciclo, Entropía.
 *   Externa (Nube de Reactividad): Voluntad, Percepción, Transición, Catálisis.
 * Se usa para que el editor/creador de elementos solo ofrezca, en cada
 * capa, las partículas que realmente le corresponden — no las 11 sueltas.
 */
export const LAYER_PARTICLES: Record<LayerName, ParticleType[]> = {
  nucleo: ["Masa", "Cinética", "Equilibrio"],
  media: ["Potencial", "Información", "Ciclo", "Entropía"],
  externa: ["Voluntad", "Percepción", "Transición", "Catálisis"],
};

export type ParticleMap = Partial<Record<ParticleType, number>>;

/**
 * Familias derivadas directamente de la física del sistema (no de estética):
 *   - Noble: capa externa saturada (§5.3) — eje aparte, prioritario.
 *   - Rígido / Intermedio / Reactivo: según R = Catálisis/Transición en la
 *     capa externa (§6.2) — R>1 rígido, R=1 intermedio, R<1 reactivo. Un
 *     elemento con Catálisis>0 y Transición=0 cuenta como Rígido (rigidez
 *     máxima, ver nota de §6.2).
 *   - Inerte: Catálisis=0 y Transición=0 — sin medio de acoplamiento activo,
 *     no enlaza por esta vía (caso límite no cubierto por la fórmula R).
 */
export type ElementFamily = "Noble" | "Rígido" | "Intermedio" | "Reactivo" | "Inerte";

export const ELEMENT_FAMILIES: ElementFamily[] = [
  "Noble",
  "Rígido",
  "Intermedio",
  "Reactivo",
  "Inerte",
];

export const FAMILY_ICON: Record<ElementFamily, React.ElementType> = {
  Noble: Gem,
  Rígido: Link2,
  Intermedio: Scale,
  Reactivo: Wind,
  Inerte: CircleOff,
};

/**
 * Colores por familia, inspirados en las categorías de la tabla periódica
 * real (gases nobles = violeta, alcalinos = rojo/naranja muy reactivos,
 * metales de transición = azul acero, metaloides = verde, no clasificados
 * = gris) pero recalibrados en tonos apagados/oscuros para que encajen con
 * el tema violeta-sepia oscuro de la app (--bg-main: #1c1720) en vez de
 * verse como colores planos de Wikipedia sobre fondo blanco.
 *
 *   - Noble:      violeta lila  — como los gases nobles reales, y coincide
 *                 con --accent del tema, reforzando que es la familia "eje".
 *   - Rígido:     azul acero    — como los metales de transición reales.
 *   - Intermedio: verde salvia  — como los metaloides reales (punto medio).
 *   - Reactivo:   rojo ladrillo — como los metales alcalinos reales.
 *   - Inerte:     gris piedra   — como los elementos sin clasificar.
 *
 * Cada familia trae: `text` (símbolo/ícono), `bg` (fondo sutil de casilla)
 * y `border` (borde de casilla) — pensados para combinar sobre fondos
 * oscuros usando opacidad baja, igual que el resto de la UI (bg-primary/5,
 * border-primary/10, etc.).
 */
export const FAMILY_COLOR: Record<ElementFamily, { text: string; bg: string; border: string }> = {
  Noble: { text: "#c9a3e0", bg: "rgba(170, 120, 190, 0.14)", border: "rgba(170, 120, 190, 0.38)" },
  Rígido: { text: "#8fb3d9", bg: "rgba(90, 130, 180, 0.14)", border: "rgba(90, 130, 180, 0.38)" },
  Intermedio: { text: "#9bc4a0", bg: "rgba(110, 160, 115, 0.14)", border: "rgba(110, 160, 115, 0.38)" },
  Reactivo: { text: "#d99a7a", bg: "rgba(190, 110, 70, 0.14)", border: "rgba(190, 110, 70, 0.38)" },
  Inerte: { text: "#a8a0ac", bg: "rgba(140, 130, 145, 0.12)", border: "rgba(140, 130, 145, 0.32)" },
};

/** Fila cruda tal cual vive en Supabase (tabla "elementos"). */
export interface Elemento {
  id: string;
  numero_atomico: number;
  nombre: string;
  simbolo: string;
  familia: ElementFamily;
  es_noble: boolean;
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
    "id, numero_atomico, nombre, simbolo, familia, es_noble, notas, nucleo, media, externa, es_catalizador",
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

// ─── Grupos de Compuestos: conjuntos reutilizables de Compuestos ──────────
// Un Grupo es simplemente "un conjunto reutilizable de compuestos con
// cantidad" — mismo shape que la fórmula de un PlantaOrgano
// ({compuesto_id, cantidad}[]), pensado para usarse directo como fórmula
// desde Flora (Órganos) u otros módulos que necesiten una mezcla ya armada
// sin tener que reconstruirla cada vez desde cero.
export interface ComponenteGrupoCompuesto {
  compuesto_id: string;
  cantidad: number;
}

/** Fila cruda tal cual vive en Supabase (tabla "grupos_compuestos"). */
export interface GrupoCompuesto {
  id: string;
  nombre: string;
  notas: string | null;
  componentes: ComponenteGrupoCompuesto[];
  created_at: string;
  updated_at?: string;
}

export const CONFIG_GRUPOS_COMPUESTOS = {
  tabla: "grupos_compuestos",
  select: "id, nombre, notas, componentes, created_at, updated_at",
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
// apaga fuego": Núcleo (2) y Media (4) tienen capacidad fija — igual que la
// valencia química real, donde el carbono "necesita" 4 electrones más para
// completar su capa externa y por eso se enlaza con otros átomos que se
// los aportan.
//
// La capa Externa NO tiene capacidad fija: crece por "armónicos" según la
// Ley de Expansión por Cierre de Noble (ver reglas-sistema-actualizado.md).
// Cada vez que un átomo alcanza el techo de su armónico se vuelve Noble
// (capa saturada, inerte); para ir más allá el núcleo "abre" +2 espacios
// nuevos cada bloque de 6 elementos:
//   Z 1–12  → techo 6   (armónico base, 2×3)
//   Z 13–18 → techo 8   (armónico secundario, ej. Solthenar #18)
//   Z 19–24 → techo 10  (armónico terciario, ej. Solkarath #24)
//   ... y así +2 cada bloque de 6 elementos nuevos.
//
// Acá: sumamos las partículas de todos los elementos de un compuesto, capa
// por capa. Si una capa queda por debajo de su capacidad, el compuesto
// tiene un "déficit" en esa capa — literalmente le faltan partículas de
// ese tipo para estabilizarse. Dos compuestos tienen afinidad si el
// déficit de uno se resuelve con el superávit (sobrante) del otro: se
// "atraen" porque uno completa lo que al otro le falta, igual que dos
// elementos que se enlazan para completar su capa de valencia.
export const CAPACIDAD_CAPA_FIJA: Record<"nucleo" | "media", number> = {
  nucleo: 2,
  media: 4,
};

/** Tamaño de cada bloque armónico (elementos nuevos por bloque, tras el base). */
const TAMANO_BLOQUE_ARMONICO = 6;
/** Techo de la Capa Externa en el armónico base (Z 1–12). */
const TECHO_EXTERNA_BASE = 6;
/** Techo del primer armónico expandido (Z 13–18). */
const TECHO_EXTERNA_ARMONICO_1 = 8;
/** Cuánto se expande la Externa por cada bloque armónico nuevo tras el base. */
const EXPANSION_POR_BLOQUE = 2;
/** Último Z cubierto por el armónico base, antes de empezar a expandir. */
const Z_FIN_ARMONICO_BASE = 12;

/**
 * Techo de la Capa Externa para un elemento, según su número atómico —
 * Ley de Expansión por Cierre de Noble. No es una capacidad fija: crece
 * +2 cada bloque de 6 elementos después del armónico base (Z 1–12 → 6).
 */
export function capacidadExterna(numero_atomico: number): number {
  if (numero_atomico <= Z_FIN_ARMONICO_BASE) return TECHO_EXTERNA_BASE;
  const bloque = Math.floor((numero_atomico - (Z_FIN_ARMONICO_BASE + 1)) / TAMANO_BLOQUE_ARMONICO);
  return TECHO_EXTERNA_ARMONICO_1 + bloque * EXPANSION_POR_BLOQUE;
}

/**
 * Capacidad de una capa para un elemento puntual. Núcleo/Media son fijos;
 * Externa depende del armónico (ver capacidadExterna). Se usa para mostrar
 * ocupación individual de UN elemento (ej. en ElementoEditor).
 */
export function capacidadCapaElemento(layer: LayerName, numero_atomico: number): number {
  if (layer === "externa") return capacidadExterna(numero_atomico);
  return CAPACIDAD_CAPA_FIJA[layer];
}

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

// ─── Peso Atómico (Propiedad Derivada) ─────────────────────────────────────
// Peso Atómico = (partículas Núcleo × 3) + (partículas Media × 2) +
// (partículas Externa × 1) — ver reglas-sistema-actualizado.md, sección 1.5.
// Pondera más las capas internas (más "profundas") que la externa. NO debe
// confundirse con el Número Atómico (Z), que es solo la posición en la
// tabla. Dos elementos con Z consecutivos pueden tener pesos muy distintos.
export const PESO_POR_CAPA: Record<LayerName, number> = {
  nucleo: 3,
  media: 2,
  externa: 1,
};

export interface ResultadoPeso {
  /** Peso Atómico ponderado: nucleo×3 + media×2 + externa×1 (sección 1.5). */
  pesoTotal: number;
  /** Desglose del aporte de cada capa al peso total (ya ponderado). */
  porCapa: Record<LayerName, number>;
  categoria: "liviano" | "medio" | "pesado";
}

// ─── Ley de Cancelación de Carga (Voluntad ↔ Percepción) ───────────────────
// Dos elementos/compuestos se combinan si la Voluntad LIBRE de uno cancela
// exactamente los huecos de Percepción del otro (relación 1 a 1). "Libre"
// acá significa: no toda la Voluntad de un lado sirve — solo hasta donde
// hay Percepción disponible del otro lado para recibirla (y viceversa), de
// ahí que el resultado sea asimétrico entre A→B y B→A.
export interface ResultadoCancelacionCarga {
  /** Voluntad de A que efectivamente cancela Percepción de B (1 a 1). */
  voluntadAaPercepcionB: number;
  /** Voluntad de B que efectivamente cancela Percepción de A (1 a 1). */
  voluntadBaPercepcionA: number;
  /** true si al menos una dirección cancela carga (hay compatibilidad real). */
  compatible: boolean;
}

// ─── Enlace Resultante (Transición vs Catálisis) ───────────────────────────
// Una vez igualadas las cargas, la proporción entre Transición y Catálisis
// de ambos elementos/compuestos combinados determina qué tan estable es el
// enlace resultante.
export type TipoEnlace = "fuerte" | "debil" | "neutro";

export const ENLACE_LABEL: Record<TipoEnlace, string> = {
  fuerte: "Enlace fuerte (permanente, resistente al desgaste)",
  debil: "Enlace débil (metaestable, sensible a estímulos térmicos/mágicos)",
  neutro: "Sin predominio claro (Transición y Catálisis equilibrados)",
};

export interface ResultadoEnlace {
  tipo: TipoEnlace;
  totalTransicion: number;
  totalCatalisis: number;
}

// ─── Electromagnetismo Derivado ────────────────────────────────────────────
// Corriente: flujo de Voluntad a través de huecos de Percepción compatibles
// (usa el mismo cálculo que la Cancelación de Carga). Campo magnético: se
// induce cuando esa corriente se combina con la Cinética del Núcleo.
export interface ResultadoElectromagnetismo {
  /** Corriente total = Voluntad efectivamente cancelada en ambas direcciones. */
  corriente: number;
  /** true si hay corriente Y Cinética de núcleo disponible en la mezcla. */
  generaCampoMagnetico: boolean;
  /** Cinética total del núcleo combinado (insumo del campo magnético). */
  cineticaTotal: number;
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

// ─── Balance de Procesos (MineralProceso / PlantaProceso) ──────────────────
// Un Proceso (cristalización, oxidación, fotosíntesis…) tiene `consume` y
// `produce`: listas mixtas de {tipo: 'elemento'|'compuesto', id, cantidad}.
// A diferencia de un Compuesto (mezcla que debe cerrar sola en 0), acá lo
// que debe cerrar es la ECUACIÓN completa: el total de partículas que
// entran por `consume` debe igualar al total que sale por `produce`, capa
// por capa — ninguna partícula se crea ni se destruye en la reacción,
// igual que en química real (masa se conserva a ambos lados de la flecha).
export interface BalanceCapaProceso {
  layer: LayerName;
  consumido: number;
  producido: number;
  /** producido − consumido. 0 = balanceado en esta capa. */
  diferencia: number;
}

export interface ResultadoBalanceProceso {
  /** true si las 3 capas están balanceadas (diferencia 0 en todas). */
  balanceado: boolean;
  capas: BalanceCapaProceso[];
  /** Ids de elemento/compuesto referenciados en consume/produce que ya no
   *  existen en el catálogo actual — el balance ignora estas entradas, así
   *  que un resultado "balanceado" con huérfanos puede ser engañoso. */
  huerfanos: { tipo: "elemento" | "compuesto"; id: string }[];
}
