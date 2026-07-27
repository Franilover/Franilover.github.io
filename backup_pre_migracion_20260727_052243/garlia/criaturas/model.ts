// Tipos de la entidad Criatura.
// Extraído de domains/garlia/_shared/types.ts (antes _legacy/hooks/types.ts,
// el "cajón de sastre" que mezclaba Personaje, Criatura, Item, Reino...).

export type Criatura = {
  id: string;
  nombre: string;
  imagen_url?: string;
  descripcion?: string;
  /** Características de especie estilo D&D (rasgos raciales, resistencias,
   *  velocidad especial…), texto plano — distinto de `descripcion`, que es
   *  rich text de lore/aspecto físico. Se copia a la ficha del personaje
   *  que elige esta especie (ver EspecieResumen en useFichasDnd). */
  descripcion_dnd?: string | null;
  habitat?: string;
  pensamiento?: string;
  alma?: string;
  biologia?: string;
  relacion?: string;
  comportamiento?: string;
  magia?: string;
  /** Ficha de combate completa estilo Monster Manual (PHB/MM 2024) — CA,
   *  HP, velocidades, las 6 características, salvaciones, habilidades,
   *  sentidos, idiomas, RC/PX, resistencias/inmunidades, rasgos, acciones,
   *  acciones adicionales, reacciones y acciones legendarias. Se usa desde
   *  la pantalla de combate del jugador. Vive en su propia columna jsonb
   *  (`stats_dnd`) para no ensuciar el resto de columnas de `criaturas`. */
  stats_dnd?: CriaturaStatsDnd | null;
};

/** Una de las 6 características de un monstruo (mismas claves que
 *  STATS_DND en useFichasDnd, para poder compartir helpers como statMod). */
export type StatKeyDnd =
  | "fuerza"
  | "destreza"
  | "constitucion"
  | "inteligencia"
  | "sabiduria"
  | "carisma";

/** Entrada libre de rasgo/acción: el Monster Manual 2024 describe cada
 *  rasgo, acción, acción adicional, reacción o acción legendaria como un
 *  nombre en negrita + un párrafo — se modela igual acá, como lista libre
 *  en vez de campos fijos, porque el texto varía muchísimo de criatura a
 *  criatura. */
export type CriaturaRasgoItem = {
  id: string;
  nombre: string;
  descripcion: string;
};

export type CriaturaVelocidad = {
  caminar: number | null;
  volar: number | null;
  /** "Vuelo estacionario" (hover): la criatura puede quedarse flotando en
   *  el aire sin necesitar apoyo — se marca en el manual junto al valor
   *  de vuelo con "(estacionario)". */
  vuelo_estacionario: boolean;
  nadar: number | null;
  escalar: number | null;
  excavar: number | null;
};

export type CriaturaStatsDnd = {
  tamano: string | null;
  tipo: string | null;
  alineamiento: string | null;

  ca: number | null;
  ca_nota: string | null;

  hp_max: number | null;
  hp_dados: string | null;

  velocidad: CriaturaVelocidad;

  stats: Record<StatKeyDnd, number>;
  /** Solo las salvaciones con competencia (bono ya final, listo para
   *  mostrar/usar — no se recalcula desde stats + bono de competencia). */
  salvaciones: Partial<Record<StatKeyDnd, number>>;
  /** Habilidades con competencia/pericia, ej. { nombre: "Sigilo", bono: 6 }. */
  habilidades: { nombre: string; bono: number }[];

  vulnerabilidades: string | null;
  resistencias: string | null;
  inmunidades_dano: string | null;
  inmunidades_condicion: string | null;

  sentidos: string | null;
  percepcion_pasiva: number | null;
  idiomas: string | null;

  rc: string | null;
  puntos_experiencia: number | null;
  bono_competencia: number | null;

  rasgos: CriaturaRasgoItem[];
  acciones: CriaturaRasgoItem[];
  acciones_adicionales: CriaturaRasgoItem[];
  reacciones: CriaturaRasgoItem[];
  acciones_legendarias_intro: string | null;
  acciones_legendarias: CriaturaRasgoItem[];
};

export const CRIATURA_STATS_DND_VACIO: CriaturaStatsDnd = {
  tamano: null,
  tipo: null,
  alineamiento: null,
  ca: null,
  ca_nota: null,
  hp_max: null,
  hp_dados: null,
  velocidad: {
    caminar: 30,
    volar: null,
    vuelo_estacionario: false,
    nadar: null,
    escalar: null,
    excavar: null,
  },
  stats: {
    fuerza: 10,
    destreza: 10,
    constitucion: 10,
    inteligencia: 10,
    sabiduria: 10,
    carisma: 10,
  },
  salvaciones: {},
  habilidades: [],
  vulnerabilidades: null,
  resistencias: null,
  inmunidades_dano: null,
  inmunidades_condicion: null,
  sentidos: null,
  percepcion_pasiva: null,
  idiomas: null,
  rc: null,
  puntos_experiencia: null,
  bono_competencia: null,
  rasgos: [],
  acciones: [],
  acciones_adicionales: [],
  reacciones: [],
  acciones_legendarias_intro: null,
  acciones_legendarias: [],
};

export type CriaturaVariante = {
  id: string;
  criatura_id: string;
  tipo: string;
  descripcion?: string;
  imagen_url?: string;
  notas?: string;
};
