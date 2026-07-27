import {
  Users,
  Bug,
  Package,
  Map,
  Mountain,
  ScrollText,
  Sparkles,
  Star,
  Wand2,
  Layers,
  BookOpen,
  Music,
} from "lucide-react";

export type Personaje = {
  id: string;
  nombre: string;
  img_url?: string;
  img_cuerpo_url?: string;
  sobre?: string;
  reino?: string;
  especie?: string;
  don?: string;
  caracteristicas?: string;
  variante_id?: string | null;
};

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

export type Item = {
  id: string;
  nombre: string;
  imagen_url?: string;
  descripcion?: string;
  categoria?: string;
  origen?: "Natural" | "Artificial" | null;
  sub_origen?: "Planta" | "Criatura" | null;
  reino_ids?: string[];
  criatura_id?: string | null;
  criatura?: { id: string; nombre: string; imagen_url?: string } | null;
  // ── Reglas D&D 2024 (fichas_dnd las lee al equipar/atacar) ────────────
  /** Si el ítem es un arma: habilita dado_dano/sutileza/distancia y el
   *  selector de Maestría de Arma al equiparlo en una ficha. */
  es_arma?: boolean;
  /** Dado de daño del arma, ej. "1d8". Solo aplica si es_arma. */
  dado_dano?: string | null;
  /** Arma "sutil": el ataque usa el mayor entre mod. Fuerza/Destreza. */
  sutileza?: boolean;
  /** Arma a distancia: el ataque siempre usa mod. Destreza. */
  distancia?: boolean;
  /** Maestría de arma fija del catálogo (PHB 2024): Sap, Slow, Push, Topple,
   *  Vex, Cleave, Graze o Nick. Es la propiedad "de fábrica" del arma —
   *  distinto de qué maestría tiene activa una ficha en particular, que
   *  vive en fichas_dnd.maestrias_armas. */
  maestria?: string | null;
  /** Si el ítem es una armadura corporal (no escudo): aporta CA base al
   *  equiparse. */
  es_armadura?: boolean;
  /** Si el ítem es un escudo: +2 fijo a la CA, no reemplaza la armadura base. */
  es_escudo?: boolean;
  /** CA base que otorga la armadura antes de sumar mod. Destreza. */
  ca_base_armadura?: number | null;
  /** Tope al mod. Destreza que se suma a la CA: null/undefined = sin tope
   *  (ligera o sin armadura), 2 = media, 0 = pesada. */
  max_bono_dex_armadura?: number | null;
};

export type Reino = {
  id: string;
  nombre: string;
  historia?: string;
  politica?: string;
  economia?: string;
  geografia?: string;
  cultura?: string;
  mapa_url?: string;
  coord_x?: number;
  coord_y?: number;
  oculto?: boolean;
};

export type ReinoDetalle = {
  id: string;
  reino_id: string;
  nombre: string;
  descripcion?: string;
  coord_x?: number;
  coord_y?: number;
  oculto?: boolean;
};

export type Ciudad = {
  id: string;
  nombre: string;
  tipo?: string | null;
  descripcion?: string | null;
  historia?: string | null;
  secretos?: string | null;
  imagen_url?: string | null;
  reino_id?: string | null;
  coord_x?: number | null;
  coord_y?: number | null;
  oculto?: boolean;
};

export type CapituloNarrado = {
  id: string;
  titulo_capitulo: string;
  orden: number;
  libro_id: string;
  libro_titulo?: string;
};

// ─── Hechizos y Dones ─────────────────────────────────────────────────────────
export type Hechizo = {
  id: string;
  nombre: string;
  explicacion?: string;
  criatura_id?: string | null;
  criatura?: { id: string; nombre: string; imagen_url?: string } | null;
  variante_id?: string | null;
  variante?: { id: string; tipo: string } | null;
};

export type Don = {
  id: string;
  nombre: string;
  explicacion?: string;
  criatura_id?: string | null;
  criatura?: { id: string; nombre: string; imagen_url?: string } | null;
  variante_id?: string | null;
  variante?: { id: string; tipo: string } | null;
};

export type Nota = {
  id: string;
  titulo: string;
  contenido?: string;
  etiquetas?: string | null; // JSON array string, ej: '["personaje","idea"]'
  created_at?: string;
  updated_at?: string;
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────
export type TabKey =
  | "personajes"
  | "criaturas"
  | "items"
  | "reinos"
  | "mundo"
  | "hechizos"
  | "dones"
  | "runas"
  | "grupos"
  | "capitulos"
  | "letras";
export type SaveStatus = "idle" | "saving" | "saved" | "error";

export const TAB_CONFIG: Record<
  Exclude<TabKey, "mundo">,
  {
    emoji: string;
    label: string;
    tabla: string;
    Icon: React.ElementType;
    orderBy?: string;
    labelKey?: string;
  }
> = {
  personajes: {
    emoji: "🧑",
    label: "Personajes",
    tabla: "personajes",
    Icon: Users,
  },
  criaturas: { emoji: "🐛", label: "Criaturas", tabla: "criaturas", Icon: Bug },
  items: { emoji: "📦", label: "Items", tabla: "items", Icon: Package },
  reinos: { emoji: "🗺️", label: "Mapas", tabla: "reinos", Icon: Map },
  hechizos: { emoji: "✨", label: "Hechizos", tabla: "hechizos", Icon: Wand2 },
  dones: { emoji: "⭐", label: "Dones", tabla: "dones", Icon: Star },
  runas: { emoji: "ᚱ", label: "Runas", tabla: "runas", Icon: ScrollText },
  grupos: { emoji: "", label: "Grupos", tabla: "grupos_mundo", Icon: Layers },
  capitulos: {
    emoji: "📖",
    label: "Capítulos",
    tabla: "capitulos",
    Icon: BookOpen,
  },
  letras: {
    emoji: "🎵",
    label: "Letras",
    tabla: "canciones",
    Icon: Music,
    orderBy: "titulo",
    labelKey: "titulo",
  },
};

export const MUNDO_SECTIONS = [
  { key: "magia", label: "Magia", Icon: Sparkles },
  { key: "geografia", label: "Mundo", Icon: Mountain },
  { key: "historia", label: "Historia", Icon: ScrollText },
] as const;

export type MundoSectionKey = (typeof MUNDO_SECTIONS)[number]["key"];

export const INPUT_CLS =
  "w-full bg-input-bg text-input-text border border-primary/15 rounded-xl px-3 py-2.5 text-xs font-medium outline-none focus:border-primary/40 placeholder:text-primary/25 transition-colors";
// ─── Runas (exportada para uso global) ───────────────────────────────────────
export type Runa = {
  id: string;
  nombre: string;
  explicacion?: string;
  criatura_id?: string | null;
  criatura?: { id: string; nombre: string; imagen_url?: string } | null;
};
