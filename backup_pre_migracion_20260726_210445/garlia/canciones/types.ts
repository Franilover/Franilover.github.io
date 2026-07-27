export type EscenaMV = {
  id: string;
  timestamp_seg: number;
  descripcion: string;
  tipo: "escena" | "camara" | "efecto" | "transicion" | "personaje";
};

export type Seccion = {
  id: string;
  cancion_id: string;
  nombre_seccion: string;
  letra_es: string;
  letra_en?: string;
  letra_jp?: string;
  letra_romaji?: string;
  orden: number;

  timings_es?:     Record<string, number> | null;
  timings_en?:     Record<string, number> | null;
  timings_jp?:     Record<string, number> | null;
  timings_romaji?: Record<string, number> | null;
};

export type CancionLink = { titulo: string; url: string };

export type PersonajeRef = {
  id: string;
  nombre: string;
  img_url?: string | null;
};

export type Cancion = {
  id: string;
  titulo: string;
  personaje_id?: string | null;
  personaje?: PersonajeRef | PersonajeRef[] | null;
  cantante?: string;
  compositor?: string;
  idioma?: string;
  estado: "BORRADOR" | "EN PROCESO" | "TERMINADA";
  visible: boolean;
  portada_url?: string;
  links?: CancionLink[];
  secciones?: Seccion[];
  duracion_segundos?: number | null;

  info_cancion?: string | null;
  guion_mv?: EscenaMV[] | null;
};

export type IdiomaKey = "es" | "en" | "jp" | "romaji";

export type Filtros = {
  estado: string;
  visible: "" | "true" | "false";
  idioma: string;
  cantante: string;
  compositor: string;
  personaje: string;
};

export type EditorTab = "letras" | "info" | "guion";

export type ColState = {
  dirty:  boolean;
  saving: boolean;
  saved:  boolean;
  mode:   "idle" | "pending" | "error";
  msg:    string | null;
};

export type LineaConTiempo = {
  seccionId: string;
  lineaIdx:  number;
  texto:     string;
  tiempo:    number | null;
};

export type KaraokeTimings = Record<string, Record<number, number>>;