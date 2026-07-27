"use client";

/**
 * useFichasDnd
 * ───────────────────────────────────────────────────────────────────────────
 * CRUD de las fichas de personaje D&D del usuario logueado ("sub-identidades"
 * de jugador, distintas de `personajes`, que es lore del mundo creado por
 * el DM). El usuario puede tener varias y marcar UNA como activa (la que
 * está usando ahora) — el trigger fichas_dnd_unica_activa en la base de
 * datos garantiza que solo una quede activa por perfil.
 */

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/api/client/supabase";

// ── Constantes compartidas de reglas D&D (stats/skills) ────────────────────
// Fuente de verdad única para las 6 características y las 18 habilidades
// oficiales agrupadas por la stat de la que dependen. misiones.tsx tiene su
// propia copia local (ABREVIATURA_STAT / SKILLS_POR_STAT) para no romper esa
// vista grande; estas versiones "_DND" se exponen acá para que otras partes
// del dominio (ej. Editor de Grupos) no dupliquen los datos.
export const STATS_DND = [
  "fuerza",
  "destreza",
  "constitucion",
  "inteligencia",
  "sabiduria",
  "carisma",
] as const;

export const SKILLS_POR_STAT_DND: Record<string, Array<{ id: string; nombre: string }>> = {
  fuerza: [{ id: "atletismo", nombre: "Atletismo" }],
  destreza: [
    { id: "acrobacias", nombre: "Acrobacias" },
    { id: "juego_de_manos", nombre: "Juego de manos" },
    { id: "sigilo", nombre: "Sigilo" },
  ],
  constitucion: [],
  inteligencia: [
    { id: "arcanos", nombre: "Arcanos" },
    { id: "historia", nombre: "Historia" },
    { id: "investigacion", nombre: "Investigación" },
    { id: "naturaleza", nombre: "Naturaleza" },
    { id: "religion", nombre: "Religión" },
  ],
  sabiduria: [
    { id: "trato_con_animales", nombre: "Trato con animales" },
    { id: "perspicacia", nombre: "Perspicacia" },
    { id: "medicina", nombre: "Medicina" },
    { id: "percepcion", nombre: "Percepción" },
    { id: "supervivencia", nombre: "Supervivencia" },
  ],
  carisma: [
    { id: "engano", nombre: "Engaño" },
    { id: "intimidacion", nombre: "Intimidación" },
    { id: "interpretacion", nombre: "Interpretación" },
    { id: "persuasion", nombre: "Persuasión" },
  ],
};

export interface RasgoEspecial {
  id: string;
  nombre: string;
  descripcion: string;
  /** Origen del rasgo: de la raza, de la clase, una dote, u otro. Además de
   *  informativo/visual, "dote" hace que el rasgo se liste en su propia
   *  sección "Dotes" en vez de mezclarse con rasgos de clase/raza. */
  origen: "raza" | "clase" | "dote" | "otro";
}

/** Un conjuro conocido/preparado por la ficha. Lista libre — no depende del
 *  catálogo de magia del mundo (ese es para las entidades del DM). */
export interface ConjuroFicha {
  id: string;
  nombre: string;
  /** 0 = truco (cantrip). 1-9 = nivel del conjuro. */
  nivel: number;
  /** Si está preparado hoy (irrelevante para clases que no preparan, ej. brujo/hechicero con conjuros conocidos fijos — se puede dejar siempre true). */
  preparado: boolean;
}

/** Espacios de conjuro de un nivel dado: cuántos tiene en total y cuántos
 *  ya gastó desde el último descanso largo. Clave del Record = nivel ("1".."9"). */
export interface EspaciosConjuroNivel {
  max: number;
  usados: number;
}

/** Fila de la tabla "Ataques y conjuros" de la ficha 2024 que NO viene de
 *  un arma en el inventario: conjuros de ataque, garras/mordiscos
 *  naturales, ataques especiales de clase. Se agregan a mano. */
export interface AtaqueManual {
  id: string;
  nombre: string;
  /** Bono de ataque ya calculado (ej. "+5"), texto libre porque puede
   *  incluir ventaja/notas cortas. */
  bono_ataque: string;
  /** Daño y tipo, ej. "1d6+3 cortante" o "2d10 fuego (CD 15 Destreza)". */
  dano_tipo: string;
}

export interface EspecieResumen {
  id: string;
  nombre: string;
  imagen_url: string | null;
  /** Características de especie estilo D&D (rasgos raciales, resistencias…)
   *  copiadas de criaturas.descripcion_dnd — texto plano, solo lectura acá. */
  descripcion_dnd?: string | null;
}

export interface FichaDnd {
  id: string;
  perfil_id: string;
  nombre: string;
  especie_id: string | null;
  raza: string | null;
  clase: string | null;
  /** Beneficio mecánico + detalles de la clase. Se autocompleta en el
   *  cliente con `descripcion` del grupo Clase elegido — no es texto libre
   *  que el jugador escriba. */
  rasgo_clase: string | null;
  /** Nombre del grupo (grupos_mundo, subtipo="Subclase"), texto libre igual que clase. */
  subclase: string | null;
  /** Beneficio mecánico + detalles de la subclase. Se autocompleta en el
   *  cliente con `descripcion` del grupo Subclase elegido. */
  rasgo_subclase: string | null;
  nivel: number;
  alineamiento: string | null;
  /** Historia narrativa libre del personaje (motivaciones, pasado…). Distinto
   *  de `trasfondo_mecanico`, que es la elección de trasfondo del manual. */
  trasfondo: string | null;
  /** Nombre del grupo (grupos_mundo, subtipo="Trasfondo") — el trasfondo
   *  mecánico del personaje (ej. "Acólito", "Criminal"), no la historia. */
  trasfondo_mecanico: string | null;
  /** Beneficio mecánico + detalles que otorga el trasfondo. Se autocompleta
   *  en el cliente con `descripcion` del grupo Trasfondo elegido (ver
   *  useTrasfondosDisponibles) — no es texto libre que el jugador escriba. */
  rasgo_trasfondo: string | null;
  imagen_url: string | null;
  fuerza: number;
  destreza: number;
  constitucion: number;
  inteligencia: number;
  sabiduria: number;
  carisma: number;
  hp_max: number;
  hp_actual: number;
  /** Puntos de golpe temporales: absorben daño antes que los reales. No se
   *  acumulan con descansos ni entre sí (regla 2024: el mayor de los dos
   *  valores reemplaza al otro, no se suman). */
  hp_temporal: number;
  ca: number;
  velocidad: number;
  notas: string | null;
  activa: boolean;
  /** Una vez true, nadie salvo admin puede tocar las stats de combate. */
  stats_confirmadas: boolean;
  /** Cuáles de las 6 salvaciones tienen competencia, ej. ["fuerza", "sabiduria"]. */
  salvaciones_competentes: string[];
  /** Cuáles de las 18 habilidades tienen competencia, ej. ["sigilo", "percepcion"]. */
  habilidades_competentes: string[];
  /** Rasgos/habilidades especiales de clase y raza (texto libre, no numérico). */
  rasgos_especiales: RasgoEspecial[];
  /** Estados/condiciones activas ahora mismo (envenenado, aturdido, etc). Las controla el DM. */
  condiciones: string[];
  /** XP vive por identidad desde la migración de misiones. */
  xp_total: number;
  /** Mapa { tipo_moneda_id: cantidad }. Los tipos disponibles son los que el
   *  admin del reino haya definido en `tipos_moneda` (ver useTiposMoneda). */
  monedas: Record<string, number>;
  /** 0-3 cada una. Al llegar a 3 éxitos el personaje se estabiliza; al
   *  llegar a 3 fracasos, muere. Las controla el DM (editableCondiciones). */
  muerte_exitos: number;
  muerte_fracasos: number;
  /** Idiomas y herramientas que el personaje sabe usar (texto libre). */
  idiomas: string[];
  herramientas: string[];
  /** Armaduras/armas con las que el personaje tiene competencia (texto libre,
   *  no es lista cerrada porque hay equipo homebrew en el mundo). */
  competencias_armadura: string[];
  competencias_armas: string[];
  /** Tipos de daño con resistencia (mitad), inmunidad (nulo) o vulnerabilidad
   *  (doble). Texto libre, ej. "fuego", "veneno", "cortante no mágico". */
  resistencias: string[];
  inmunidades: string[];
  vulnerabilidades: string[];
  /** Nivel de agotamiento 0-6 (regla 2024: penalización única acumulativa
   *  de -2 por nivel a todas las tiradas, sin tabla de efectos por nivel). */
  agotamiento: number;
  /** Categoría de tamaño, se muestra junto a velocidad/CA en la hoja. */
  tamano: "Diminuto" | "Pequeño" | "Mediano" | "Grande" | "Enorme" | "Gigantesco";
  /** Bonos de característica elegidos por trasfondo (PHB 2024): +2/+1 a dos
   *  stats distintas, o +1/+1/+1 a las tres que el trasfondo habilita
   *  (ver GrupoPersonajeOpcion.caracteristicas_trasfondo). Se suma al score
   *  base al calcular el valor efectivo — el score guardado en
   *  fuerza/destreza/etc queda "limpio" (el que el jugador repartió al
   *  crear el personaje), no se pisa. */
  mejora_trasfondo: Partial<Record<(typeof STATS_DND)[number], number>>;
  /** Maestría de arma activa por fila de inventario equipada (PHB 2024):
   *  { "<fichas_dnd_inventario.id>": "Vex" }. Solo tiene sentido en armas
   *  con las que el personaje tiene competencia. */
  maestrias_armas: Record<string, MaestriaArma>;
  /** IDs (dotes_dnd) de dotes generales ya elegidas en los niveles que
   *  otorgan dote (PHB 2024: 4, 8, 12, 16, 19). No incluye la dote de
   *  Origen del trasfondo, esa vive aparte. */
  dotes_generales_elegidas: string[];
  /** Ataques/conjuros de la tabla "Ataques y conjuros" que NO vienen del
   *  inventario (conjuros de ataque, garras/mordiscos, ataques de clase).
   *  Ya existía la columna en la BD, esto la expone en el tipo. */
  ataques_manuales: AtaqueManual[];
  /** Dados de golpe para descansos cortos, ej. "3d8". */
  dados_golpe: string | null;
  dados_golpe_usados: number;
  /** Los 4 campos narrativos de la ficha 2024 (antes "Rasgos" en la hoja física). */
  rasgos_personalidad: string | null;
  ideales: string | null;
  vinculos: string | null;
  defectos: string | null;
  /** Mecánica de inspiración: el DM la otorga, el jugador la gasta. */
  inspiracion: boolean;
  /** Si el personaje es lanzador de conjuros (bardo, clérigo, druida, hechicero,
   *  mago, brujo, paladín, explorador…). Si es false, toda la sección de
   *  conjuros queda oculta en el panel. */
  lanzador_conjuros: boolean;
  /** Característica de conjuros (ej. "inteligencia" para mago, "sabiduria"
   *  para clérigo/druida, "carisma" para bardo/brujo/hechicero/paladín). */
  caracteristica_conjuros: string | null;
  /** Espacios de conjuro por nivel, ej. { "1": { max: 4, usados: 1 }, "2": {...} }. */
  espacios_conjuro: Record<string, EspaciosConjuroNivel>;
  /** Conjuros conocidos/preparados de la ficha. */
  conjuros: ConjuroFicha[];
  created_at: string;
  updated_at: string;
  /** Resuelto en cliente a partir de especie_id, no viene de la tabla. */
  especie?: EspecieResumen | null;
}

export interface ItemResumen {
  id: string;
  nombre: string;
  imagen_url: string | null;
  descripcion: string | null;
  /** Si es un arma: su dado de daño (ej "1d8") y si usa Destreza en vez de Fuerza. */
  es_arma: boolean;
  dado_dano: string | null;
  sutileza: boolean;
  /** Arma a distancia (arco, ballesta, jabalina arrojada…): usa Destreza para
   *  el ataque, sin importar "sutileza" (que es para armas cuerpo a cuerpo livianas). */
  distancia: boolean;
  /** Maestría de arma fija del catálogo (PHB 2024): la que "trae de fábrica"
   *  el arma. Distinta de fichas_dnd.maestrias_armas, que es cuál de las
   *  maestrías desbloqueadas por el personaje está usando esa arma en
   *  particular — normalmente coinciden, pero se guardan separado porque el
   *  personaje puede tener más de una maestría disponible según su clase. */
  maestria: MaestriaArma | null;
  /** Si es armadura corporal (no escudo): aporta CA base al equiparse. */
  es_armadura: boolean;
  /** Si es escudo: +2 fijo a la CA, no reemplaza la armadura base. */
  es_escudo: boolean;
  /** CA base de la armadura antes de sumar mod. Destreza. Null si no es armadura. */
  ca_base_armadura: number | null;
  /** Tope al mod. Destreza que suma a la CA: null=sin tope, 2=media, 0=pesada. */
  max_bono_dex_armadura: number | null;
}

export interface ItemInventarioFicha {
  id: string;
  ficha_id: string;
  item_id: string | null;
  cantidad: number;
  equipado: boolean;
  /** Resuelto en cliente a partir de item_id. */
  item?: ItemResumen | null;
}

export type NuevaFicha = Pick<FichaDnd, "nombre"> & Partial<Omit<FichaDnd, "id" | "perfil_id" | "created_at" | "updated_at" | "activa" | "nombre" | "especie">>;

/** Unión de todos los tipos de valor que puede tomar un campo editable de la
 *  ficha — usado por el callback onEditarCampo en los distintos paneles. */
export type CampoFichaValor =
  | string
  | number
  | boolean
  | string[]
  | RasgoEspecial[]
  | ConjuroFicha[]
  | AtaqueManual[]
  | Record<string, number>
  | Record<string, string>
  | Record<string, EspaciosConjuroNivel>
  | null;

export function statMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Valor efectivo de una característica: score base guardado en la ficha +
 *  el bono de mejora de trasfondo (PHB 2024) que le corresponda a esa stat.
 *  Todo lo que derive de una característica (mod, pasivas, CD/ataque de
 *  conjuros, tiradas de salvación) debe leer esto y no el score crudo. */
export function statEfectivo(
  ficha: Pick<FichaDnd, "mejora_trasfondo"> &
    Partial<Record<(typeof STATS_DND)[number], number>>,
  stat: (typeof STATS_DND)[number],
): number {
  const base = typeof ficha[stat] === "number" ? (ficha[stat] as number) : 10;
  const bono = ficha.mejora_trasfondo?.[stat] ?? 0;
  return base + bono;
}

/** Percepción pasiva = 10 + mod(Sabiduría) + bono de competencia (si tiene
 *  competencia en Percepción). Es puramente derivada, no vive en la tabla. */
export function percepcionPasiva(
  ficha: Pick<FichaDnd, "sabiduria" | "nivel" | "habilidades_competentes" | "mejora_trasfondo">,
): number {
  const mod = statMod(statEfectivo(ficha, "sabiduria"));
  const competente = ficha.habilidades_competentes?.includes("percepcion") ?? false;
  return 10 + mod + (competente ? bonusCompetencia(ficha.nivel ?? 1) : 0);
}


/** Bono de competencia estándar de D&D 5e según nivel: 1-4→+2, 5-8→+3, 9-12→+4, 13-16→+5, 17-20→+6. */
export function bonusCompetencia(nivel: number): number {
  return 2 + Math.floor((Math.max(1, Math.min(20, nivel)) - 1) / 4);
}

/** Penalizador por agotamiento (regla 2024): -2 acumulativo por nivel a
 *  TODA tirada d20 (ataques, salvaciones, pruebas de característica,
 *  iniciativa). No se aplica a valores pasivos (percepción/investigación/
 *  perspicacia pasivas), que no son una tirada. */
export function penalizacionAgotamiento(agotamiento: number | null | undefined): number {
  return -2 * Math.max(0, agotamiento ?? 0);
}

/** Cambios que produce un descanso LARGO (regla 2024, PHB p.184):
 *  - HP vuelve al máximo.
 *  - Todos los dados de golpe gastados se recuperan (2024 ya no es la
 *    mitad como en 2014: "regains... all spent Hit Point Dice").
 *  - Todos los espacios de conjuro gastados se recuperan.
 *  - El agotamiento baja 1 nivel (no llega a 0 de golpe salvo que ya
 *    estuviera en 1).
 *  - Los HP temporales no sobreviven a un descanso largo (son transitorios,
 *    se pierden si no se gastaron antes). */
export function cambiosDescansoLargo(
  ficha: Pick<FichaDnd, "hp_max" | "agotamiento" | "espacios_conjuro">,
): Partial<FichaDnd> {
  const espaciosRecuperados = Object.fromEntries(
    Object.entries(ficha.espacios_conjuro ?? {}).map(([nivel, e]) => [nivel, { ...e, usados: 0 }]),
  );
  return {
    hp_actual: ficha.hp_max ?? 0,
    hp_temporal: 0,
    dados_golpe_usados: 0,
    agotamiento: Math.max(0, (ficha.agotamiento ?? 0) - 1),
    espacios_conjuro: espaciosRecuperados,
  };
}

/** Un descanso CORTO no tiene ningún reseteo automático en la regla 2024:
 *  el jugador decide a mano cuántos dados de golpe gasta (tirándolos) y
 *  algunas clases recargan rasgos puntuales por descanso corto (eso vive
 *  en rasgos_especiales, texto libre, y lo controla el jugador/DM a mano).
 *  Esta función solo existe para dejar registrado en un solo lugar que "no
 *  hay nada que resetear automático", en vez de que cada UI lo asuma. */
export function cambiosDescansoCorto(): Partial<FichaDnd> {
  return {};
}

/** Investigación pasiva = 10 + mod(Inteligencia) + bono de competencia (si
 *  tiene competencia en Investigación). Misma fórmula que percepción pasiva. */
export function investigacionPasiva(
  ficha: Pick<FichaDnd, "inteligencia" | "nivel" | "habilidades_competentes" | "mejora_trasfondo">,
): number {
  const mod = statMod(statEfectivo(ficha, "inteligencia"));
  const competente = ficha.habilidades_competentes?.includes("investigacion") ?? false;
  return 10 + mod + (competente ? bonusCompetencia(ficha.nivel ?? 1) : 0);
}

/** Perspicacia pasiva = 10 + mod(Sabiduría) + bono de competencia (si tiene
 *  competencia en Perspicacia). Misma fórmula que percepción pasiva. */
export function perspicaciaPasiva(
  ficha: Pick<FichaDnd, "sabiduria" | "nivel" | "habilidades_competentes" | "mejora_trasfondo">,
): number {
  const mod = statMod(statEfectivo(ficha, "sabiduria"));
  const competente = ficha.habilidades_competentes?.includes("perspicacia") ?? false;
  return 10 + mod + (competente ? bonusCompetencia(ficha.nivel ?? 1) : 0);
}

/** XP acumulativa mínima para alcanzar cada nivel 1-20 (tabla oficial PHB). */
export const UMBRALES_XP: number[] = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
  120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

/** Progreso de XP dentro del nivel actual: nivel derivado de la tabla (no de
 *  ficha.nivel, que puede haber sido seteado a mano por el DM), XP restante
 *  para subir y el % de la barra. En nivel 20 la barra queda llena y sin
 *  "próximo umbral" porque es el máximo. */
export function progresoXp(xpTotal: number): {
  nivel: number;
  xpNivelActual: number;
  xpProximoNivel: number | null;
  faltante: number | null;
  porcentaje: number;
} {
  const xp = Math.max(0, xpTotal ?? 0);
  let nivel = 1;
  for (let i = UMBRALES_XP.length - 1; i >= 0; i--) {
    if (xp >= UMBRALES_XP[i]) {
      nivel = i + 1;
      break;
    }
  }
  const umbralActual = UMBRALES_XP[nivel - 1];
  const umbralSiguiente = nivel < 20 ? UMBRALES_XP[nivel] : null;
  if (umbralSiguiente === null) {
    return { nivel, xpNivelActual: xp - umbralActual, xpProximoNivel: null, faltante: null, porcentaje: 100 };
  }
  const rango = umbralSiguiente - umbralActual;
  const avance = xp - umbralActual;
  return {
    nivel,
    xpNivelActual: avance,
    xpProximoNivel: umbralSiguiente,
    faltante: umbralSiguiente - xp,
    porcentaje: rango > 0 ? Math.min(100, Math.max(0, (avance / rango) * 100)) : 100,
  };
}

/** Tamaños disponibles (PHB 2024), en el orden en que se muestran en selects. */
export const TAMANOS_DND = ["Diminuto", "Pequeño", "Mediano", "Grande", "Enorme", "Gigantesco"] as const;

/** Tipos de daño oficiales de D&D 5e, para resistencias/inmunidades/vulnerabilidades. */
export const TIPOS_DANO_DND = [
  "ácido", "contundente", "cortante", "frío", "fuego", "fuerza",
  "necrótico", "perforante", "psíquico", "radiante", "relámpago", "trueno", "veneno",
] as const;

/** Las 7 propiedades de Maestría de Arma del PHB 2024. Cada arma con
 *  competencia trae fija una de estas (dato del catálogo, no de la ficha);
 *  lo que la ficha guarda en maestrias_armas es cuál de las que el
 *  personaje "desbloqueó" está usando esa arma en particular — la mayoría
 *  de las armas del mundo homebrew no van a tener esta propiedad precargada
 *  en `items`, así que se deja como elección libre por fila de inventario. */
export const MAESTRIAS_ARMA_DND = [
  "Sap",
  "Slow",
  "Push",
  "Topple",
  "Vex",
  "Cleave",
  "Graze",
  "Nick",
] as const;

export type MaestriaArma = (typeof MAESTRIAS_ARMA_DND)[number];

/** Descripción corta de cada maestría, para tooltip/badge en la UI. */
export const DESCRIPCION_MAESTRIA_ARMA: Record<MaestriaArma, string> = {
  Sap: "El objetivo impactado tiene desventaja en su próximo ataque antes de tu siguiente turno.",
  Slow: "El objetivo impactado reduce su velocidad en 10 ft hasta el inicio de tu próximo turno.",
  Push: "El objetivo impactado es empujado hasta 10 ft en línea recta lejos de vos.",
  Topple: "El objetivo impactado debe salvar Constitución o cae derribado (prone).",
  Vex: "Si impactás, tenés ventaja en el próximo ataque contra ese mismo objetivo antes de tu siguiente turno.",
  Cleave: "Si impactás, podés atacar a otra criatura al alcance dentro de 5 ft del objetivo original, sin usar tu acción de nuevo.",
  Graze: "Si fallás el ataque, igual causás daño de mod. de característica a la criatura.",
  Nick: "Al hacer ataque extra con arma liviana en la misma acción, no gasta tu acción adicional (solo un arma por turno).",
};

/** CA calculada a partir de la armadura equipada + escudo, como referencia
 *  cuando el DM/jugador no la sobreescribe a mano en `ficha.ca`.
 *  base: CA base del tipo de armadura (10 si va sin armadura).
 *  sumaDex: si suma mod. Destreza completo (armadura ligera / sin armadura),
 *    solo hasta +2 (media) o nada (pesada) — se pasa ya resuelto por quien
 *    llama, ya que depende del ítem equipado y no vive en este helper.
 *  bonoEscudo: +2 fijo si tiene escudo equipado (regla estándar). */
export function calcularCaArmadura(params: {
  caBaseArmadura: number;
  modDestreza: number;
  maxBonoDex: number | null; // null = sin tope (armadura ligera o sin armadura)
  tieneEscudo: boolean;
}): number {
  const { caBaseArmadura, modDestreza, maxBonoDex, tieneEscudo } = params;
  const bonoDex = maxBonoDex === null ? modDestreza : Math.max(0, Math.min(modDestreza, maxBonoDex));
  return caBaseArmadura + bonoDex + (tieneEscudo ? 2 : 0);
}

/** CA calculada a partir del inventario equipado real: busca la armadura
 *  equipada (es_armadura) y el escudo equipado (es_escudo) entre los ítems
 *  del personaje y aplica calcularCaArmadura. Si no hay armadura equipada,
 *  usa CA base 10 sin tope de Destreza (la regla "sin armadura" del PHB). */
export function caCalculadaDesdeInventario(
  itemsEquipados: ItemInventarioFicha[],
  modDestreza: number,
): number {
  const armadura = itemsEquipados.find((i) => i.equipado && i.item?.es_armadura);
  const escudo = itemsEquipados.find((i) => i.equipado && i.item?.es_escudo);
  return calcularCaArmadura({
    caBaseArmadura: armadura?.item?.ca_base_armadura ?? 10,
    modDestreza,
    maxBonoDex: armadura ? armadura.item?.max_bono_dex_armadura ?? null : null,
    tieneEscudo: Boolean(escudo),
  });
}

/** Niveles del PHB 2024 en los que el personaje elige una dote general
 *  (además de la dote de Origen del trasfondo en nivel 1). */
export const NIVELES_DOTE_GENERAL = [4, 8, 12, 16, 19] as const;

/** Cuántas dotes generales le corresponden a la ficha según su nivel actual,
 *  y cuántas le faltan elegir respecto de dotes_generales_elegidas. */
export function dotesGeneralesDisponibles(
  ficha: Pick<FichaDnd, "nivel" | "dotes_generales_elegidas">,
): { total: number; elegidas: number; pendientes: number } {
  const total = NIVELES_DOTE_GENERAL.filter((n) => (ficha.nivel ?? 1) >= n).length;
  const elegidas = ficha.dotes_generales_elegidas?.length ?? 0;
  return { total, elegidas, pendientes: Math.max(0, total - elegidas) };
}

/** CD de salvación de conjuros = 8 + bono de competencia + mod de la
 *  característica de conjuros. Devuelve null si la ficha no tiene
 *  característica de conjuros configurada. */
export function cdSalvacionConjuros(
  ficha: Pick<FichaDnd, "caracteristica_conjuros" | "nivel" | "mejora_trasfondo"> &
    Partial<Record<(typeof STATS_DND)[number], number>>,
): number | null {
  const car = ficha.caracteristica_conjuros as (typeof STATS_DND)[number] | null;
  if (!car) return null;
  const valor = statEfectivo(ficha, car);
  return 8 + bonusCompetencia(ficha.nivel ?? 1) + statMod(valor);
}

/** Bono de ataque con conjuros = bono de competencia + mod de la
 *  característica de conjuros + penalización por agotamiento (es una
 *  tirada d20, regla 2024). Devuelve null si no hay característica configurada. */
export function bonoAtaqueConjuros(
  ficha: Pick<FichaDnd, "caracteristica_conjuros" | "nivel" | "mejora_trasfondo" | "agotamiento"> &
    Partial<Record<(typeof STATS_DND)[number], number>>,
): number | null {
  const car = ficha.caracteristica_conjuros as (typeof STATS_DND)[number] | null;
  if (!car) return null;
  const valor = statEfectivo(ficha, car);
  return bonusCompetencia(ficha.nivel ?? 1) + statMod(valor) + penalizacionAgotamiento(ficha.agotamiento);
}

async function resolverEspecies(fichas: FichaDnd[]): Promise<FichaDnd[]> {
  const ids = Array.from(new Set(fichas.map((f) => f.especie_id).filter(Boolean))) as string[];
  if (ids.length === 0) return fichas;
  const { data } = await supabase.from("criaturas").select("id, nombre, imagen_url, descripcion_dnd").in("id", ids);
  const porId = new Map((data ?? []).map((c: any) => [c.id, c as EspecieResumen]));
  return fichas.map((f) => ({ ...f, especie: f.especie_id ? porId.get(f.especie_id) ?? null : null }));
}

export function useFichasDnd(perfilId: string | null) {
  const [fichas, setFichas] = useState<FichaDnd[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!perfilId) {
      setFichas([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("fichas_dnd")
      .select("*")
      .eq("perfil_id", perfilId)
      .order("updated_at", { ascending: false });
    if (!error && data) {
      const resueltas = await resolverEspecies(data as FichaDnd[]);
      setFichas(resueltas);
    }
    setLoading(false);
  }, [perfilId]);

  useEffect(() => {
    fetchAll();
    if (!perfilId) return;
    const channel = supabase
      .channel(`fichas-dnd-${perfilId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fichas_dnd", filter: `perfil_id=eq.${perfilId}` },
        () => fetchAll(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [perfilId, fetchAll]);

  const crear = useCallback(
    async (datos: NuevaFicha) => {
      if (!perfilId) throw new Error("Sin sesión");
      const { data, error } = await supabase
        .from("fichas_dnd")
        // activa: true siempre — el trigger fichas_dnd_unica_activa se
        // encarga de desactivar cualquier otra ficha del mismo perfil, así
        // que la última creada queda como la que se usa. Evita fichas
        // "huérfanas" que nunca se seleccionaron como activas.
        .insert({ activa: true, ...datos, perfil_id: perfilId })
        .select()
        .single();
      if (error) throw error;
      const nueva = data as FichaDnd;
      // Optimista: la agrega al instante, no espera al roundtrip de realtime.
      setFichas((prev) => [nueva, ...prev]);
      return nueva;
    },
    [perfilId],
  );

  const actualizar = useCallback(
    async (id: string, cambios: Partial<FichaDnd>) => {
      // Optimista: refleja los cambios al instante en este componente y en
      // cualquier otro que use el mismo hook, sin esperar el roundtrip de
      // red ni la latencia (o ausencia) del canal realtime.
      setFichas((prev) => prev.map((f) => (f.id === id ? { ...f, ...cambios } : f)));
      const { error } = await supabase.from("fichas_dnd").update(cambios).eq("id", id);
      if (error) {
        // Revierte al estado real si falló en el servidor.
        await fetchAll();
        throw error;
      }
    },
    [fetchAll],
  );

  /** Aplica un descanso largo (regla 2024): HP al máximo, dados de golpe y
   *  espacios de conjuro recuperados por completo, agotamiento -1, HP
   *  temporal a 0. Un solo update optimista, no una serie de onEditarCampo
   *  sueltos, para que no quede a mitad de camino si falla la red. */
  const descansarLargo = useCallback(
    async (id: string) => {
      const ficha = fichas.find((f) => f.id === id);
      if (!ficha) return;
      await actualizar(id, cambiosDescansoLargo(ficha));
    },
    [fichas, actualizar],
  );

  const eliminar = useCallback(
    async (id: string) => {
      // Optimista: la saca de la lista al instante.
      setFichas((prev) => prev.filter((f) => f.id !== id));
      const { error } = await supabase.from("fichas_dnd").delete().eq("id", id);
      if (error) {
        await fetchAll();
        throw error;
      }
    },
    [fetchAll],
  );

  const elegirActiva = useCallback(async (id: string) => {
    // Optimista: refleja el cambio al instante en este componente y en
    // cualquier otro que use el mismo hook, sin esperar el roundtrip de
    // red ni la latencia del canal realtime.
    setFichas((prev) => prev.map((f) => ({ ...f, activa: f.id === id })));
    const { error } = await supabase.from("fichas_dnd").update({ activa: true }).eq("id", id);
    if (error) {
      // Revierte si falló en el servidor
      await fetchAll();
      throw error;
    }
  }, [fetchAll]);

  const activa = fichas.find((f) => f.activa) ?? null;

  return { fichas, activa, loading, crear, actualizar, eliminar, elegirActiva, descansarLargo, refetch: fetchAll };
}

async function resolverItems(rows: ItemInventarioFicha[]): Promise<ItemInventarioFicha[]> {
  const ids = Array.from(new Set(rows.map((r) => r.item_id).filter(Boolean))) as string[];
  if (ids.length === 0) return rows;
  const { data } = await supabase
    .from("items")
    .select("id, nombre, imagen_url, descripcion, es_arma, dado_dano, sutileza, distancia, es_armadura, es_escudo, ca_base_armadura, max_bono_dex_armadura, maestria")
    .in("id", ids);
  const porId = new Map((data ?? []).map((i: any) => [i.id, i as ItemResumen]));
  return rows.map((r) => ({ ...r, item: r.item_id ? porId.get(r.item_id) ?? null : null }));
}

export function useInventarioFicha(fichaId: string | null) {
  const [items, setItems] = useState<ItemInventarioFicha[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!fichaId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("fichas_dnd_inventario")
      .select("*")
      .eq("ficha_id", fichaId)
      .order("created_at", { ascending: true });
    if (!error && data) {
      const resueltos = await resolverItems(data as ItemInventarioFicha[]);
      setItems(resueltos);
    }
    setLoading(false);
  }, [fichaId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const agregar = useCallback(
    async (itemId: string, cantidad = 1) => {
      if (!fichaId) return;
      const { error } = await supabase
        .from("fichas_dnd_inventario")
        .insert({ ficha_id: fichaId, item_id: itemId, cantidad });
      if (error) throw error;
      fetchAll();
    },
    [fichaId, fetchAll],
  );

  const quitar = useCallback(
    async (filaId: string) => {
      const { error } = await supabase.from("fichas_dnd_inventario").delete().eq("id", filaId);
      if (error) throw error;
      fetchAll();
    },
    [fetchAll],
  );

  const toggleEquipado = useCallback(
    async (item: ItemInventarioFicha) => {
      const { error } = await supabase
        .from("fichas_dnd_inventario")
        .update({ equipado: !item.equipado })
        .eq("id", item.id);
      if (error) throw error;
      fetchAll();
    },
    [fetchAll],
  );

  const editarCantidad = useCallback(
    async (filaId: string, cantidad: number) => {
      const cantidadValida = Math.max(1, Math.floor(cantidad) || 1);
      const { error } = await supabase
        .from("fichas_dnd_inventario")
        .update({ cantidad: cantidadValida })
        .eq("id", filaId);
      if (error) throw error;
      fetchAll();
    },
    [fetchAll],
  );

  return { items, loading, agregar, quitar, toggleEquipado, editarCantidad, refetch: fetchAll };
}

// ── Búsqueda para los selectores (especie / item) ──────────────────────

export async function buscarCriaturas(query: string): Promise<EspecieResumen[]> {
  const q = query.trim();
  let req = supabase.from("criaturas").select("id, nombre, imagen_url, descripcion_dnd").order("nombre").limit(40);
  if (q.length >= 1) req = req.ilike("nombre", `%${q}%`);
  const { data } = await req;
  return (data ?? []) as EspecieResumen[];
}

export async function buscarItems(query: string): Promise<ItemResumen[]> {
  const q = query.trim();
  let req = supabase
    .from("items")
    .select("id, nombre, imagen_url, descripcion, es_arma, dado_dano, sutileza, distancia, es_armadura, es_escudo, ca_base_armadura, max_bono_dex_armadura, maestria")
    .order("nombre")
    .limit(40);
  if (q.length >= 1) req = req.ilike("nombre", `%${q}%`);
  const { data } = await req;
  return (data ?? []) as ItemResumen[];
}

// ── Clases / subclases / trasfondos disponibles ────────────────────────────
// El mundo define clases, subclases y trasfondos como grupos en
// grupos_mundo (tipo="personajes", subtipo="Clase" | "Subclase" | "Trasfondo")
// en vez de dejarlos como texto libre — los selectores de la ficha salen de
// esas listas.

export interface GrupoPersonajeOpcion {
  id: string;
  nombre: string;
  /** Bloque de texto libre del grupo (grupos_mundo.descripcion). Solo se
   *  usa para Trasfondo por ahora — es de donde sale rasgo_trasfondo. */
  descripcion?: string | null;
  /** Dote de Origen vinculada por FK (grupos_mundo.dote_origen_id →
   *  dotes_dnd) — solo tiene sentido para subtipo="Trasfondo". Viene
   *  resuelta por join, no como texto libre. */
  dote_origen?: { id: string; nombre: string; descripcion: string | null } | null;
  /** Reglas fijas de competencias — solo tienen sentido para subtipo="Clase"
   *  (PHB 2024): 2 salvaciones fijas + una lista corta de habilidades entre
   *  las que el jugador elige una cantidad fija. */
  salvaciones_clase?: string[] | null;
  habilidades_disponibles?: string[] | null;
  habilidades_a_elegir?: number | null;
  /** Las 3 características entre las que se reparte la mejora de trasfondo
   *  (+2/+1 o +1/+1/+1, PHB 2024) — solo tiene sentido para subtipo="Trasfondo". */
  caracteristicas_trasfondo?: string[] | null;
}

async function buscarGruposPersonajePorSubtipo(subtipo: string): Promise<GrupoPersonajeOpcion[]> {
  const { data } = await supabase
    .from("grupos_mundo")
    .select(
      "id, nombre, descripcion, dote_origen:dotes_dnd(id, nombre, descripcion), salvaciones_clase, habilidades_disponibles, habilidades_a_elegir, caracteristicas_trasfondo",
    )
    .eq("tipo", "personajes")
    .eq("subtipo", subtipo)
    .order("nombre");
  return (data ?? []) as unknown as GrupoPersonajeOpcion[];
}

function useGruposPersonajePorSubtipo(subtipo: string) {
  const [opciones, setOpciones] = useState<GrupoPersonajeOpcion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    buscarGruposPersonajePorSubtipo(subtipo).then((data) => {
      if (!cancelado) {
        setOpciones(data);
        setLoading(false);
      }
    });
    return () => {
      cancelado = true;
    };
  }, [subtipo]);

  return { opciones, loading };
}

/** @deprecated usá GrupoPersonajeOpcion */
export type ClaseDisponible = GrupoPersonajeOpcion;

export async function buscarClasesDisponibles(): Promise<GrupoPersonajeOpcion[]> {
  return buscarGruposPersonajePorSubtipo("Clase");
}

export function useClasesDisponibles() {
  const { opciones, loading } = useGruposPersonajePorSubtipo("Clase");
  return { clases: opciones, loading };
}

// Las subclases viven en su propia tabla (subclases_dnd), relacionada a la
// clase por clase_id (FK a grupos_mundo.id, subtipo="Clase"). Antes se
// buscaban en grupos_mundo con subtipo="Subclase", pero esa combinación ya
// no existe — las 48 subclases oficiales 2024 se migraron a subclases_dnd.
async function buscarSubclasesPorClaseId(claseId: string | null): Promise<GrupoPersonajeOpcion[]> {
  if (!claseId) return [];
  const { data } = await supabase
    .from("subclases_dnd")
    .select("id, nombre, descripcion")
    .eq("clase_id", claseId)
    .order("nombre");
  return (data ?? []) as unknown as GrupoPersonajeOpcion[];
}

export function useSubclasesDisponibles(claseId: string | null) {
  const [subclases, setSubclases] = useState<GrupoPersonajeOpcion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelado = false;
    if (!claseId) {
      setSubclases([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    buscarSubclasesPorClaseId(claseId).then((data) => {
      if (!cancelado) {
        setSubclases(data);
        setLoading(false);
      }
    });
    return () => {
      cancelado = true;
    };
  }, [claseId]);

  return { subclases, loading };
}

export function useTrasfondosDisponibles() {
  const { opciones, loading } = useGruposPersonajePorSubtipo("Trasfondo");
  return { trasfondos: opciones, loading };
}

// ── Catálogo de Dotes (tabla dotes_dnd, no grupos_mundo) ───────────────────
// A diferencia de clase/subclase/trasfondo, las dotes viven en su propia
// tabla porque no son "grupos" del mundo del DM: son un catálogo de reglas
// (PHB 2024) compartido entre mundos, con categoría fija (origen/general/
// épica) y prerrequisito propio.

export interface DoteDnd {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: "origen" | "general" | "epica";
  prerequisito: string | null;
}

export function useDotesDisponibles() {
  const [dotes, setDotes] = useState<DoteDnd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    supabase
      .from("dotes_dnd")
      .select("id, nombre, descripcion, categoria, prerequisito")
      .order("categoria")
      .order("nombre")
      .then(({ data }) => {
        if (!cancelado) {
          setDotes((data ?? []) as DoteDnd[]);
          setLoading(false);
        }
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return { dotes, loading };
}



export interface TipoMoneda {
  id: string;
  nombre: string;
  simbolo: string | null;
  orden: number;
  valor_en_base: number;
  created_at: string;
  updated_at: string;
}

export type NuevoTipoMoneda = Pick<TipoMoneda, "nombre"> &
  Partial<Pick<TipoMoneda, "simbolo" | "orden" | "valor_en_base">>;

/** CRUD de los tipos de moneda del mundo (global, no hay reino_id en
 *  fichas_dnd). Solo el admin puede escribir (lo aplica la policy
 *  `tipos_moneda_admin_write`), pero cualquiera puede leerlos para
 *  mostrarlos en su ficha. */
export function useTiposMoneda() {
  const [tipos, setTipos] = useState<TipoMoneda[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const { data, error } = await supabase
      .from("tipos_moneda")
      .select("*")
      .order("orden", { ascending: true });
    if (!error && data) setTipos(data as TipoMoneda[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("tipos-moneda")
      .on("postgres_changes", { event: "*", schema: "public", table: "tipos_moneda" }, () =>
        fetchAll(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const crear = useCallback(
    async (datos: NuevoTipoMoneda) => {
      const orden = datos.orden ?? tipos.length;
      const { data, error } = await supabase
        .from("tipos_moneda")
        .insert({ ...datos, orden })
        .select()
        .single();
      if (error) throw error;
      setTipos((prev) => [...prev, data as TipoMoneda].sort((a, b) => a.orden - b.orden));
      return data as TipoMoneda;
    },
    [tipos.length],
  );

  const renombrar = useCallback(
    async (id: string, cambios: Partial<Pick<TipoMoneda, "nombre" | "simbolo" | "orden" | "valor_en_base">>) => {
      setTipos((prev) => prev.map((t) => (t.id === id ? { ...t, ...cambios } : t)));
      const { error } = await supabase.from("tipos_moneda").update(cambios).eq("id", id);
      if (error) {
        await fetchAll();
        throw error;
      }
    },
    [fetchAll],
  );

  const eliminar = useCallback(
    async (id: string) => {
      // Ojo: no borra las cantidades ya guardadas en las fichas (quedan
      // "huérfanas" bajo esa clave); el panel debería avisar antes de borrar
      // un tipo que ya esté en uso.
      setTipos((prev) => prev.filter((t) => t.id !== id));
      const { error } = await supabase.from("tipos_moneda").delete().eq("id", id);
      if (error) {
        await fetchAll();
        throw error;
      }
    },
    [fetchAll],
  );

  return { tipos, loading, crear, renombrar, eliminar, refetch: fetchAll };
}

