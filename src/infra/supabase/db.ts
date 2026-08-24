import Dexie, { type Table } from "dexie";

export interface Personaje {
  id: string;
  nombre: string;
  visible?: boolean;
  [key: string]: any;
}

export interface Criatura {
  id: string;
  nombre: string;
  habitat?: string;
  alma?: string;
  pensamiento?: string;
  [key: string]: any;
}

export interface CriaturaVariante {
  id: string;
  criatura_id: string;
  tipo?: string;
  [key: string]: any;
}

export interface Item {
  id: string;
  nombre?: string;
  categoria?: string;
  [key: string]: any;
}

export interface Libro {
  id: string;
  titulo?: string;
  created_at?: string;
  [key: string]: any;
}

export interface Capitulo {
  id: string;
  libro_id: string;
  orden: number;
  titulo_capitulo?: string;
  contenido?: string;
  fecha_publicacion?: string;
  /** Campo de línea de tiempo (legado, reemplazado por dia_absoluto desde v17). */
  orden_linea_tiempo?: number;
  /** Día absoluto del calendario del mundo (indexado desde v17). */
  dia_absoluto?: number;
  /** Estado de sincronización offline. */
  status?: "pending" | "synced";
}

export interface Cancion {
  id: string;
  titulo: string;
  personaje?: string;
  cantante?: string;
  compositor?: string;
  idioma?: string;
  estado?: string;
  portada_url?: string;
  links?: any;
  visible?: boolean;
  created_at?: string;
  updated_at?: string;
  /** Día absoluto del calendario del mundo (indexado desde v17). */
  dia_absoluto?: number;
}

export interface SeccionCancion {
  id: string;
  cancion_id: string;
  nombre_seccion: string;
  letra_es: string;
  letra_en?: string;
  letra_jp?: string;
  letra_romaji?: string;
  orden: number;
  created_at?: string;
}

export interface Reino {
  id: string;
  nombre: string;
  descripcion?: string;
  orden?: number;
  mapa_url?: string;
  imagen_reino?: string;
  coord_x?: number;
  coord_y?: number;
}
export interface ReinoDetalle {
  id: string;
  reino_id: string;
  nombre?: string;
  descripcion?: string;
  coord_x?: number;
  coord_y?: number;
  oculto?: boolean;
  [key: string]: any;
}

export interface Relacion {
  id: string;
  personaje_id: string;
  personaje_rel_id: string;
  tipo: string;
  nota?: string | null;
  [key: string]: any;
}

export interface Tarea {
  id: string;
  titulo: string;
  categoria?: string;
  username?: string;
  completada?: boolean;
  created_at?: string;
  status?: "pending" | "synced";
  deleted?: boolean;
}

export interface Evento {
  id: string;
  titulo: string;
  fecha: string;
  tipo?: string;
  hora_inicio?: string;
  username?: string;
  status?: "pending" | "synced";
  deleted?: boolean;
}

export interface Receta {
  id: string;
  nombre?: string;
  categoria?: string;
  autor_id?: string;
  ingredientes?: any;
  instrucciones?: any;
  created_at?: string;
}

export interface Ingrediente {
  id: string;
  user_id?: string;
  [key: string]: any;
}

export interface RopaPrenda {
  id: string;
  user_id?: string;
  created_at?: string;
  [key: string]: any;
}

export interface RopaOutfit {
  id: string;
  user_id?: string;
  created_at?: string;
  [key: string]: any;
}

export interface DiarioFoto {
  id: number;
  fecha?: string;
  url_imagen: string;
  categoria?: string;
  created_at?: string;
}

export interface Dibujo {
  id: number;
  titulo: string;
  url_imagen: string;
  categoria?: string;
}

export interface Nota {
  id: string;
  titulo?: string;
  contenido: string;
  tags?: string[];
  updated_at: string;
  status: "pending" | "synced";
  deleted?: boolean;
}

export interface MisionEntidad {
  id: string;
  mision_id: string;
  tipo: string;
  entidad_id: string;
  rol: string;
  nombre?: string;
  imagen_url?: string | null;
}

// Notas del universo de fantasía (lore) — separada de la "Nota" personal/ensayos
export interface NotaLore {
  id: string;
  titulo: string;
  contenido?: string;
  etiquetas?: string | null; // JSON array string, ej: '["personaje","idea"]'
  created_at?: string;
  updated_at?: string;
}

export interface RutinaLocal {
  id: string;
  nombre: string;
  descripcion?: string;
  tag?: string;
  created_at?: string;
  status?: "pending" | "synced";
  deleted?: boolean;
}

export interface EjercicioLocal {
  id: string;
  rutina_id: string;
  nombre: string;
  series?: number;
  reps?: string;
  descanso?: number;
  musculo?: string;
  notas?: string;
  orden?: number;
  status?: "pending" | "synced";
  deleted?: boolean;
}

export interface GaleriaItem {
  id: number;
  url_imagen: string;
  bg_color: string;
  aspect_ratio: "square" | "wide" | "portrait";
  orden: number;
  creado_en: string;
}

// ─── Órganos/Formaciones y su jerarquía de composición (v33) ──────────────
// Ver domains/garlia/elementos/types.ts para el detalle completo de cada
// campo — acá solo se declara el shape mínimo que Dexie necesita cachear.
export interface OrganoDexie {
  id: string;
  nombre: string;
  funcion?: string | null;
  notas?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface FormacionDexie {
  id: string;
  nombre: string;
  funcion?: string | null;
  notas?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CelulaDexie {
  id: string;
  nombre: string;
  compuesto_id?: string | null;
  estructura?: unknown;
  funcion?: string | null;
  notas?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TejidoDexie {
  id: string;
  nombre: string;
  celula_id?: string | null;
  estructura?: unknown;
  funcion?: string | null;
  notas?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GranoDexie {
  id: string;
  nombre: string;
  compuesto_id?: string | null;
  estructura?: unknown;
  funcion?: string | null;
  notas?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface VetaDexie {
  id: string;
  nombre: string;
  grano_id?: string | null;
  estructura?: unknown;
  funcion?: string | null;
  notas?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Fila puente organo_tejidos: vincula un Tejido a un Órgano. */
export interface OrganoTejidoDexie {
  id: string;
  organo_id: string;
  tejido_id: string;
  proporcion?: string | null;
  created_at?: string;
}

/** Fila puente formacion_vetas: vincula una Veta a una Formación. */
export interface FormacionVetaDexie {
  id: string;
  formacion_id: string;
  veta_id: string;
  proporcion?: string | null;
  created_at?: string;
}

export interface ReaccionDexie {
  id: string;
  nombre: string;
  consume?: unknown;
  produce?: unknown;
  descripcion?: string | null;
  activador?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Tablas puente {entidad_id, grupo_compuesto_id} hacia Órgano/Formación —
 *  mismo shape genérico que usa useEntidadVinculosGrupo.ts en las 4 tablas
 *  reales (planta_organos, criatura_organos, mineral_formaciones,
 *  item_estructura); el nombre de columna es histórico, ver ese archivo. */
export interface EntidadGrupoVinculoDexie {
  id: string;
  grupo_compuesto_id: string;
  [key: string]: any;
}

/** Shape laxo para las tablas de Fases 2-7 del rediseño 1.0 (compuesto_
 *  elementos, oris_iums, fenomenos, estructura_componentes, organismos,
 *  sistemas, etc.) — no tienen interfaz local dedicada todavía (se leen
 *  vía useSupabaseData con su propio tipo en TS de cada dominio); [key:
 *  string]: any es el mismo escape hatch usado en el resto del archivo
 *  para tablas puente sin modelo local propio (ver EntidadGrupoVinculoDexie). */
export interface FilaGenericaDexie {
  id: string;
  [key: string]: any;
}

export interface OfflineOperation {
  id?: number;
  table: string;
  operation: "upsert" | "update" | "delete";
  recordId: string;
  payload: any;
  timestamp: number;
  retries: number;
}

export interface ReproductorHandle {
  key: string;
  handle: FileSystemDirectoryHandle;
}

export interface Compra {
  id: string;
  [key: string]: any;
}

export interface SessionCache {
  key: string;
  value: any;
  updated_at: number;
}

export interface Runa {
  id: string;
  nombre: string;
  explicacion?: string;
  imagen_url?: string | null;
  /** Trazos de referencia para el reconocedor $1 Unistroke (ver dollarOneRecognizer.ts) */
  patron_trazos?: { x: number; y: number }[][] | null;
  [key: string]: any;
}

export interface Ciudad {
  id: string;
  nombre: string;
  tipo?: string | null;
  imagen_url?: string | null;
  reino_id?: string | null;
  coord_x?: number | null;
  coord_y?: number | null;
  tile_col?: number | null;
  tile_row?: number | null;
  [key: string]: any;
}

export interface GrupoMundo {
  id: string;
  nombre: string;
  tipo: "personajes" | "criaturas" | "items" | "runas";
  descripcion?: string | null;
  miembro_ids: string[];
  created_at?: string;
  updated_at?: string;
}

// ─── Tiles de mapa ───────────────────────────────────────────────────────────
export interface MapTileLocal {
  id: string;
  world_id: string;
  col: number;
  row: number;
  image_url?: string | null;
  label?: string | null;
  order?: number;
}

export interface ReinoTileLocal {
  id: string;
  reino_id: string;
  col: number;
  row: number;
  image_url?: string | null;
  label?: string | null;
  order?: number;
}

// ─── Áreas del mapa (círculo / rectángulo / polígono libre) ───────────────────
// Vinculan una zona dibujada en el mapa global a un reino o una ciudad.
// Las coordenadas de los puntos son "mundo" (mismo sistema que tile_col/
// tile_row + coord_x/coord_y en % dentro del tile) para que escalen igual
// que los tiles al hacer pan/zoom — ver toWorldPoint/fromWorldPoint en
// UnifiedTileCanvas.
export interface MapAreaLocal {
  id: string;
  world_id: string;
  reino_id?: string | null;
  ciudad_id?: string | null;
  tipo: "circulo" | "rectangulo" | "poligono";
  /** Puntos en coordenadas mundo: [{x, y}, ...] — col/row absoluto + fracción. */
  puntos: { x: number; y: number }[];
  color?: string | null;
  label?: string | null;
  orden?: number;
}

// ─── Áreas del mapa INTERNO de un reino ──────────────────────────────────────
// Mismo concepto que MapAreaLocal, pero scoped por reino_id en vez de
// world_id — dibujadas sobre reino_tiles (ReinoTileCanvas) y vinculables a
// una ciudad de ese reino.
export interface ReinoAreaLocal {
  id: string;
  reino_id: string;
  ciudad_id?: string | null;
  tipo: "circulo" | "rectangulo" | "poligono";
  puntos: { x: number; y: number }[];
  color?: string | null;
  label?: string | null;
  orden?: number;
}

// ─── Eras de personaje (arcos vitales en la línea de tiempo) ─────────────────
export interface PersonajeEra {
  id: string; // uuid
  personaje_id: string;
  momento: number; // dia_absoluto o número de orden en la línea de tiempo
  label?: string | null;
  rasgos?: string[] | null;
  notas?: string | null;
  img_url?: string | null;
  img_cuerpo_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ─── Calendario del mundo ─────────────────────────────────────────────────────

export interface CalendarioEstacion {
  id: string;
  nombre: string;
  orden: number;
  duracion_dias?: number;
  descripcion?: string | null;
}

/** Singleton: almacena la configuración global del calendario (días/año, etc). */
export interface CalendarioConfig {
  id: string; // siempre "global"
  dias_por_anio?: number;
  nombre_calendario?: string | null;
  [key: string]: any;
}

export interface EraMundo {
  id: string;
  nombre: string;
  anio_inicio: number;
  anio_fin?: number | null;
  descripcion?: string | null;
  created_at?: string;
}

/** Eventos del mundo/reino referenciados en el sistema dia_absoluto (v18+). */
export interface EventoMundo {
  id: string;
  titulo: string;
  reino_id?: string | null;
  dia_absoluto: number;
  /** "manual" | "capitulo" | "cancion" — origen del evento en la línea de tiempo. */
  source?: string;
  descripcion?: string | null;
  created_at?: string;
}

// ─── Ítems relacionados con criaturas ────────────────────────────────────────
export interface CriaturaDropLocal {
  id: string;
  criatura_id: string;
  item_id: string;
  variante_id?: string | null;
}

export interface ItemCraftereLocal {
  id: string;
  criatura_id: string;
  item_id: string;
}

// ─── Perfil de usuario cacheado localmente ───────────────────────────────────
export interface PerfilLocal {
  id: string; // uuid del usuario (auth.users)
  email?: string | null;
  username?: string | null;
  rol?: string | null; // 'admin' | 'user' | 'visitante' — NUNCA se escribe desde el cliente
  status?: string | null;
  avatar_url?: string | null;
  descripcion?: string | null;
  titulo?: string | null;
  cached_at: number; // timestamp para saber cuándo se guardó
}

// ─── Misiones / desafíos ──────────────────────────────────────────────────────
export interface MisionLocal {
  id: string;
  titulo: string;
  descripcion?: string | null;
  dificultad: "facil" | "media" | "dificil" | "epica";
  categoria?: string | null;
  imagen_url?: string | null;
  requisitos?: string | null;
  vence_en?: string | null;
  recompensa_xp: number;
  recompensa_monedas: number;
  recompensa_item_nombre?: string | null;
  recompensa_item_imagen_url?: string | null;
  recompensa_item_id?: string | null;
  activa: boolean;
  creado_en?: string;
  cached_at?: number;
}

/** Progreso de un usuario en una misión. Clave local: `${user_id}_${mision_id}`. */
export interface MisionUsuarioLocal {
  id: string; // `${ficha_id}_${mision_id}`
  /** Identidad (ficha D&D) dueña del progreso — reemplaza a user_id como filtro principal. */
  ficha_id: string;
  /** Se conserva para RLS/admin (a qué cuenta pertenece la ficha), no para filtrar progreso. */
  user_id?: string;
  mision_id: string;
  estado: "en_curso" | "completada" | "reclamada";
  progreso: number;
  fecha_aceptada?: string | null;
  fecha_completada?: string | null;
  /** Estado de sincronización offline — igual patrón que tareas/eventos/notas. */
  status?: "pending" | "synced";
  cached_at?: number;
}

// ─── Descubrimientos personales (cache offline para GlobalCommandPalette) ────
/**
 * Fila desnormalizada de una entidad desbloqueada por el usuario —
 * personaje, criatura, item, reino o ciudad. Se guarda "aplanada" (sin
 * depender de joins) para poder leerla instantáneamente desde Dexie al abrir
 * la paleta de comandos, mientras el fetch remoto revalida en segundo plano.
 * Clave local compuesta: `${perfil_id}_${tipo}_${entidad_id}`.
 */
export interface DescubrimientoLocal {
  id: string; // `${perfil_id}_${tipo}_${entidad_id}`
  perfil_id: string;
  tipo: "personaje" | "criatura" | "item" | "reino" | "ciudad";
  entidad_id: string;
  nombre?: string | null;
  imagen_url?: string | null;
  reino_id?: string | null; // solo relevante para tipo "ciudad"
  cached_at?: number;
}

/**
 * Flags narrativos — estado libre que el lector va escribiendo al pasar por
 * bloques [[flag|set|...]] y que luego se consulta desde [[flag|if|...]].
 * Un flag es simplemente `flagId: valor` por perfil — sin catálogo, sin
 * validación de tipo (valor es siempre string; "true"/"false" para el caso
 * booleano, o texto libre como "hostil"). Se crea la primera vez que el
 * lector pasa por un [[flag|set]] con ese id.
 */
export interface FlagLocal {
  id: string; // `${perfil_id}_${flag_id}`
  perfil_id: string;
  flag_id: string;
  valor: string;
  updated_at?: number;
}

/**
 * Posiciones x/y de los nodos en el editor visual de grafo (Fase 3). Es
 * data de autor (no de lector) — por eso se indexa por capId + nodeId, no
 * por perfil de lector. Un nodo sin registro acá cae al auto-layout inicial
 * del canvas hasta que el autor lo mueve por primera vez.
 */
export interface NodoPosicionLocal {
  id: string; // `${capId}_${nodeId}`
  capId: string;
  nodeId: string;
  x: number;
  y: number;
  updated_at?: number;
}

// ─── Química: Tabla Alquímica (elementos) y Compuestos ────────────────────
export interface ElementoLocal {
  id: string;
  nombre?: string;
  simbolo?: string;
  numero_atomico?: number;
  [key: string]: any;
}

export interface CompuestoLocal {
  id: string;
  nombre?: string;
  simbolo?: string;
  componentes?: any;
  created_at?: string;
  /** Fase 2: referencia a la sustancia base (familia Agua/Hielo/Nieve/Vapor). */
  sustancia_base_id?: string;
  /** Fase 2: estado de esa familia (ej. "sólido", "líquido", "gaseoso"). */
  estado?: string;
  [key: string]: any;
}

// ─── Fase 2/3 del rediseño 1.0: tablas relacionales que reemplazan a los
// jsonb legado como fuente de lectura (ver useCompuestosConElementos,
// useOrisConIums) ───────────────────────────────────────────────────────────
export interface CompuestoElementoLocal {
  id: string;
  compuesto_id: string;
  elemento_id: string;
  cantidad?: number;
  created_at?: string;
  [key: string]: any;
}

export interface OrisIumLocal {
  id: string;
  oris_id: string;
  ium_id: string;
  cantidad?: number;
  created_at?: string;
  [key: string]: any;
}

export interface FenomenoLocal {
  id: string;
  nombre?: string;
  simbolo?: string;
  notas?: string;
  created_at?: string;
  [key: string]: any;
}

// ─── Física: Oris, Partículas, IUMs, Conceptos ─────────────────────────────
export interface OrisLocal {
  id: string;
  orden?: number;
  [key: string]: any;
}

export interface ParticulaLocal {
  id: string;
  orden?: number;
  [key: string]: any;
}

export interface ParticulaBaseLocal {
  id: string;
  orden?: number;
  [key: string]: any;
}

export interface IumLocal {
  id: string;
  orden?: number;
  [key: string]: any;
}

export interface FisicaConceptoLocal {
  id: string;
  orden?: number;
  [key: string]: any;
}

// ─── Biología: Biomas, Clados, Ecosistemas, Cadenas, Perfiles atómicos ─────
export interface BiomaLocal {
  id: string;
  nombre?: string;
  orden?: number;
  [key: string]: any;
}

export interface CladoLocal {
  id: string;
  nombre?: string;
  padre_id?: string | null;
  orden?: number;
  [key: string]: any;
}

export interface EcosistemaLocal {
  id: string;
  nombre?: string;
  bioma_id?: string | null;
  orden?: number;
  [key: string]: any;
}

export interface CadenaAlimenticiaLocal {
  id: string;
  nombre?: string;
  ecosistema_id?: string | null;
  orden?: number;
  [key: string]: any;
}

export interface PerfilAtomicoCriaturaLocal {
  id: string;
  criatura_id?: string;
  [key: string]: any;
}

class AgendaFraniDB extends Dexie {
  personajes!: Table<Personaje, string>;
  criaturas!: Table<Criatura, string>;
  criatura_variantes!: Table<CriaturaVariante, string>;
  items!: Table<Item, string>;
  libros!: Table<Libro, string>;
  capitulos!: Table<Capitulo, string>;
  canciones!: Table<Cancion, string>;
  secciones_cancion!: Table<SeccionCancion, string>;
  reinos!: Table<Reino, string>;
  relaciones!: Table<Relacion, string>;
  reino_detalles!: Table<ReinoDetalle, string>;

  tareas!: Table<Tarea, string>;
  eventos!: Table<Evento, string>;
  recetas!: Table<Receta, string>;
  ingredientes!: Table<Ingrediente, string>;
  ropa!: Table<RopaPrenda, string>;
  ropa_outfits!: Table<RopaOutfit, string>;
  diario_fotos!: Table<DiarioFoto, number>;
  dibujos!: Table<Dibujo, number>;
  compras!: Table<Compra, string>;

  notas!: Table<Nota, string>;
  ensayos!: Table<Nota, string>;
  notas_lore!: Table<NotaLore, string>;

  rutinas!: Table<RutinaLocal, string>;
  ejercicios_rutina!: Table<EjercicioLocal, string>;

  offline_queue!: Table<OfflineOperation, number>;

  reproductor_handles!: Table<ReproductorHandle, string>;

  session_cache!: Table<SessionCache, string>;
  runas!: Table<Runa, string>;
  ciudades!: Table<Ciudad, string>;
  grupos_mundo!: Table<GrupoMundo, string>;

  // Ítems de criaturas
  criatura_drops!: Table<CriaturaDropLocal, string>;
  item_crafteres!: Table<ItemCraftereLocal, string>;
  galeria!: Table<GaleriaItem, number>;

  // Perfil cacheado offline
  perfiles!: Table<PerfilLocal, string>;

  // Calendario del mundo
  calendario_estaciones!: Table<CalendarioEstacion, string>;
  calendario_config!: Table<CalendarioConfig, string>;
  eras_mundo!: Table<EraMundo, string>;
  eventos_mundo!: Table<EventoMundo, string>;

  // Eras de personaje
  personaje_eras!: Table<PersonajeEra, string>;

  // Misiones / desafíos
  misiones!: Table<MisionLocal, string>;
  misiones_usuario!: Table<MisionUsuarioLocal, string>;
  mision_entidades!: Table<MisionEntidad, string>;

  // Tiles de mapa global y de reinos
  map_tiles!: Table<MapTileLocal, string>;
  reino_tiles!: Table<ReinoTileLocal, string>;

  // Áreas del mapa (círculo/rectángulo/polígono) vinculadas a reino o ciudad
  map_areas!: Table<MapAreaLocal, string>;
  reino_areas!: Table<ReinoAreaLocal, string>;

  // Descubrimientos personales (cache offline para GlobalCommandPalette)
  descubrimientos!: Table<DescubrimientoLocal, string>;
  flagsNarrativos!: Table<FlagLocal, string>;
  nodoPosiciones!: Table<NodoPosicionLocal, string>;

  // Química: Tabla Alquímica + Compuestos
  elementos!: Table<ElementoLocal, string>;
  compuestos!: Table<CompuestoLocal, string>;

  // Física: Oris, Partículas, IUMs, Conceptos
  oris!: Table<OrisLocal, string>;
  particulas!: Table<ParticulaLocal, string>;
  particulas_base!: Table<ParticulaBaseLocal, string>;
  iums!: Table<IumLocal, string>;
  fisica_conceptos!: Table<FisicaConceptoLocal, string>;

  // Biología: Biomas, Clados, Ecosistemas, Cadenas, Perfiles atómicos
  biomas!: Table<BiomaLocal, string>;
  clados!: Table<CladoLocal, string>;
  ecosistemas!: Table<EcosistemaLocal, string>;
  cadenas_alimenticias!: Table<CadenaAlimenticiaLocal, string>;
  perfiles_atomicos_criatura!: Table<PerfilAtomicoCriaturaLocal, string>;

  // Órganos/Formaciones y su jerarquía de composición (Célula/Tejido,
  // Grano/Veta) + Reacciones — ver bloque v33 más abajo.
  organos!: Table<OrganoDexie, string>;
  formaciones!: Table<FormacionDexie, string>;
  celulas!: Table<CelulaDexie, string>;
  tejidos!: Table<TejidoDexie, string>;
  granos!: Table<GranoDexie, string>;
  vetas!: Table<VetaDexie, string>;
  organo_tejidos!: Table<OrganoTejidoDexie, string>;
  formacion_vetas!: Table<FormacionVetaDexie, string>;
  reacciones!: Table<ReaccionDexie, string>;
  planta_organos!: Table<EntidadGrupoVinculoDexie, string>;
  criatura_organos!: Table<EntidadGrupoVinculoDexie, string>;
  mineral_formaciones!: Table<EntidadGrupoVinculoDexie, string>;
  item_estructura!: Table<EntidadGrupoVinculoDexie, string>;

  // ─── Fase 2/3 del rediseño 1.0 (v34) ─────────────────────────────────────
  compuesto_elementos!: Table<FilaGenericaDexie, string>;
  oris_iums!: Table<FilaGenericaDexie, string>;
  fenomenos!: Table<FilaGenericaDexie, string>;

  // ─── Fases 4-7 del rediseño 1.0 (v35) ────────────────────────────────────
  estructura_componentes!: Table<FilaGenericaDexie, string>;
  organismos!: Table<FilaGenericaDexie, string>;
  sistemas!: Table<FilaGenericaDexie, string>;
  sistema_organos!: Table<FilaGenericaDexie, string>;
  organismo_sistemas!: Table<FilaGenericaDexie, string>;
  reaccion_componentes!: Table<FilaGenericaDexie, string>;
  procesos!: Table<FilaGenericaDexie, string>;
  proceso_reacciones!: Table<FilaGenericaDexie, string>;
  fenomeno_procesos!: Table<FilaGenericaDexie, string>;
  fenomeno_elementos!: Table<FilaGenericaDexie, string>;

  // ─── v36: minerales/flora ─────────────────────────────────────────────────
  minerales!: Table<FilaGenericaDexie, string>;
  flora!: Table<FilaGenericaDexie, string>;

  // ─── v37: mineral_reacciones ──────────────────────────────────────────────
  mineral_reacciones!: Table<FilaGenericaDexie, string>;

  // ─── Bug preexistente detectado durante el build de Fase 8: estas 5 tablas
  // están en .stores() desde antes (hechizos/dones desde v11-ish, ver
  // "← nueva"; mensajes_cache más reciente) pero nunca tuvieron su
  // declaración de propiedad tipada — TypeScript solo lo marca en cuanto
  // algo intenta usar db.<tabla>, así que quedó sin detectar hasta ahora.
  hechizos!: Table<FilaGenericaDexie, string>;
  dones!: Table<FilaGenericaDexie, string>;
  personaje_hechizos!: Table<FilaGenericaDexie, string>;
  personaje_dones!: Table<FilaGenericaDexie, string>;
  mensajes_cache!: Table<FilaGenericaDexie, string>;

  constructor() {
    super("AgendaFranilover");

    this.version(1).stores({
      personajes: "id, nombre, visible",
      criaturas: "id, nombre, habitat, alma, pensamiento",
      criatura_variantes: "id, criatura_id, tipo",
      items: "id, nombre, categoria",
      libros: "id, created_at",
      capitulos: "id, libro_id, orden, fecha_publicacion",
      canciones: "id, titulo, personaje, visible, created_at",
      secciones_cancion: "id, cancion_id, orden",
      reinos: "id, nombre, orden",
      relaciones: "id, personaje_id",
      tareas: "id, username, completada, created_at",
      eventos: "id, username, fecha, tipo",
      recetas: "id, autor_id, categoria, created_at",
      ingredientes: "id, user_id",
      ropa: "id, user_id, created_at",
      ropa_outfits: "id, user_id, created_at",
      diario_fotos: "++id, categoria, created_at",
      dibujos: "++id, categoria",
      notas: "id, status, updated_at",
    });

    this.version(2).stores({
      personajes: "id, nombre, visible",
      criaturas: "id, nombre, habitat, alma, pensamiento",
      criatura_variantes: "id, criatura_id, tipo",
      items: "id, nombre, categoria",
      libros: "id, created_at",
      capitulos: "id, libro_id, orden, fecha_publicacion",
      canciones: "id, titulo, personaje, visible, created_at",
      secciones_cancion: "id, cancion_id, orden",
      reinos: "id, nombre, orden",
      relaciones: "id, personaje_id",
      tareas: "id, username, completada, created_at, status",
      eventos: "id, username, fecha, tipo, status",
      recetas: "id, autor_id, categoria, created_at",
      ingredientes: "id, user_id",
      ropa: "id, user_id, created_at",
      ropa_outfits: "id, user_id, created_at",
      diario_fotos: "++id, categoria, created_at",
      dibujos: "++id, categoria",
      notas: "id, status, updated_at",
      rutinas: "id, status",
    });

    this.version(3).stores({
      personajes: "id, nombre, visible",
      criaturas: "id, nombre, habitat, alma, pensamiento",
      criatura_variantes: "id, criatura_id, tipo",
      items: "id, nombre, categoria",
      libros: "id, created_at",
      capitulos: "id, libro_id, orden, fecha_publicacion",
      canciones: "id, titulo, personaje, visible, created_at",
      secciones_cancion: "id, cancion_id, orden",
      reinos: "id, nombre, orden",
      relaciones: "id, personaje_id",
      tareas: "id, username, completada, created_at, status",
      eventos: "id, username, fecha, tipo, status",
      recetas: "id, autor_id, categoria, created_at",
      ingredientes: "id, user_id",
      ropa: "id, user_id, created_at",
      ropa_outfits: "id, user_id, created_at",
      diario_fotos: "++id, categoria, created_at",
      dibujos: "++id, categoria",
      notas: "id, status, updated_at",
      rutinas: "id, status",
      ejercicios_rutina: "id, rutina_id, status",
      offline_queue: "++id, table, operation, recordId, timestamp",
    });

    this.version(4).stores({
      personajes: "id, nombre, visible",
      criaturas: "id, nombre, habitat, alma, pensamiento",
      criatura_variantes: "id, criatura_id, tipo",
      items: "id, nombre, categoria",
      libros: "id, created_at",
      capitulos: "id, libro_id, orden, fecha_publicacion",
      canciones: "id, titulo, personaje, visible, created_at",
      secciones_cancion: "id, cancion_id, orden",
      reinos: "id, nombre, orden",
      relaciones: "id, personaje_id",
      tareas: "id, username, completada, created_at, status",
      eventos: "id, username, fecha, tipo, status",
      recetas: "id, autor_id, categoria, created_at",
      ingredientes: "id, user_id",
      ropa: "id, user_id, created_at",
      ropa_outfits: "id, user_id, created_at",
      diario_fotos: "++id, categoria, created_at",
      dibujos: "++id, categoria",
      notas: "id, status, updated_at",
      rutinas: "id, status",
      ejercicios_rutina: "id, rutina_id, status",
      offline_queue: "++id, table, operation, recordId, timestamp",
      compras: "id",
      reproductor_handles: "key",
      session_cache: "key, updated_at",
    });
    this.version(5).stores({
      personajes: "id, nombre, visible",
      criaturas: "id, nombre, habitat, alma, pensamiento",
      criatura_variantes: "id, criatura_id, tipo",
      items: "id, nombre, categoria",
      libros: "id, created_at",
      capitulos: "id, libro_id, orden, fecha_publicacion",
      canciones: "id, titulo, personaje, visible, created_at",
      secciones_cancion: "id, cancion_id, orden",
      reinos: "id, nombre, orden",
      relaciones: "id, personaje_id",
      tareas: "id, username, completada, created_at, status",
      eventos: "id, username, fecha, tipo, status",
      recetas: "id, autor_id, categoria, created_at",
      ingredientes: "id, user_id",
      ropa: "id, user_id, created_at",
      ropa_outfits: "id, user_id, created_at",
      diario_fotos: "++id, categoria, created_at",
      dibujos: "++id, categoria",
      notas: "id, status, updated_at",
      ensayos: "id, status, updated_at",
      rutinas: "id, status",
      ejercicios_rutina: "id, rutina_id, status",
      offline_queue: "++id, table, operation, recordId, timestamp",
      compras: "id",
      reproductor_handles: "key",
      session_cache: "key, updated_at",
    });
    this.version(6).stores({
      personajes: "id, nombre, visible",
      criaturas: "id, nombre, habitat, alma, pensamiento",
      criatura_variantes: "id, criatura_id, tipo",
      items: "id, nombre, categoria",
      libros: "id, created_at",
      capitulos: "id, libro_id, orden, fecha_publicacion",
      canciones: "id, titulo, personaje, visible, created_at",
      secciones_cancion: "id, cancion_id, orden",
      reinos: "id, nombre, orden",
      relaciones: "id, personaje_id",
      tareas: "id, username, completada, created_at, status",
      eventos: "id, username, fecha, tipo, status",
      recetas: "id, autor_id, categoria, created_at",
      ingredientes: "id, user_id",
      ropa: "id, user_id, created_at",
      ropa_outfits: "id, user_id, created_at",
      diario_fotos: "++id, categoria, created_at",
      dibujos: "++id, categoria",
      notas: "id, status, updated_at",
      ensayos: "id, status, updated_at",
      rutinas: "id, status",
      ejercicios_rutina: "id, rutina_id, status",
      offline_queue: "++id, table, operation, recordId, timestamp",
      compras: "id",
      reproductor_handles: "key",
      session_cache: "key, updated_at",
      reino_detalles: "id, reino_id", // ← nueva
    });

    this.version(7).stores({
      personajes: "id, nombre, visible",
      criaturas: "id, nombre, habitat, alma, pensamiento",
      criatura_variantes: "id, criatura_id, tipo",
      items: "id, nombre, categoria",
      libros: "id, created_at",
      capitulos: "id, libro_id, orden, fecha_publicacion",
      canciones: "id, titulo, personaje, visible, created_at",
      secciones_cancion: "id, cancion_id, orden",
      reinos: "id, nombre, orden",
      relaciones: "id, personaje_id",
      tareas: "id, username, completada, created_at, status",
      eventos: "id, username, fecha, tipo, status",
      recetas: "id, autor_id, categoria, created_at",
      ingredientes: "id, user_id",
      ropa: "id, user_id, created_at",
      ropa_outfits: "id, user_id, created_at",
      diario_fotos: "++id, categoria, created_at",
      dibujos: "++id, categoria",
      notas: "id, status, updated_at",
      ensayos: "id, status, updated_at",
      rutinas: "id, status",
      ejercicios_rutina: "id, rutina_id, status",
      offline_queue: "++id, table, operation, recordId, timestamp",
      compras: "id",
      reproductor_handles: "key",
      session_cache: "key, updated_at",
      reino_detalles: "id, reino_id",
      hechizos: "id, nombre", // ← nueva
      dones: "id, nombre", // ← nueva
    });

    this.version(8).stores({
      personajes: "id, nombre, visible",
      criaturas: "id, nombre, habitat, alma, pensamiento",
      criatura_variantes: "id, criatura_id, tipo",
      items: "id, nombre, categoria",
      libros: "id, created_at",
      capitulos: "id, libro_id, orden, fecha_publicacion",
      canciones: "id, titulo, personaje, visible, created_at",
      secciones_cancion: "id, cancion_id, orden",
      reinos: "id, nombre, orden",
      relaciones: "id, personaje_id, personaje_rel_id, tipo", // ← índices ampliados
      tareas: "id, username, completada, created_at, status",
      eventos: "id, username, fecha, tipo, status",
      recetas: "id, autor_id, categoria, created_at",
      ingredientes: "id, user_id",
      ropa: "id, user_id, created_at",
      ropa_outfits: "id, user_id, created_at",
      diario_fotos: "++id, categoria, created_at",
      dibujos: "++id, categoria",
      notas: "id, status, updated_at",
      ensayos: "id, status, updated_at",
      rutinas: "id, status",
      ejercicios_rutina: "id, rutina_id, status",
      offline_queue: "++id, table, operation, recordId, timestamp",
      compras: "id",
      reproductor_handles: "key",
      session_cache: "key, updated_at",
      reino_detalles: "id, reino_id",
      hechizos: "id, nombre",
      dones: "id, nombre",
    });

    this.version(9).stores({
      personajes: "id, nombre, visible",
      criaturas: "id, nombre, habitat, alma, pensamiento",
      criatura_variantes: "id, criatura_id, tipo",
      items: "id, nombre, categoria",
      libros: "id, created_at",
      capitulos: "id, libro_id, orden, fecha_publicacion",
      canciones: "id, titulo, personaje, visible, created_at",
      secciones_cancion: "id, cancion_id, orden",
      reinos: "id, nombre, orden",
      relaciones: "id, personaje_id, personaje_rel_id, tipo",
      tareas: "id, username, completada, created_at, status",
      eventos: "id, username, fecha, tipo, status",
      recetas: "id, autor_id, categoria, created_at",
      ingredientes: "id, user_id",
      ropa: "id, user_id, created_at",
      ropa_outfits: "id, user_id, created_at",
      diario_fotos: "++id, categoria, created_at",
      dibujos: "++id, categoria",
      notas: "id, status, updated_at", // ← sin tocar, son los ensayos/personal
      ensayos: "id, status, updated_at",
      rutinas: "id, status",
      ejercicios_rutina: "id, rutina_id, status",
      offline_queue: "++id, table, operation, recordId, timestamp",
      compras: "id",
      reproductor_handles: "key",
      session_cache: "key, updated_at",
      reino_detalles: "id, reino_id",
      hechizos: "id, nombre",
      dones: "id, nombre",
      notas_lore: "id, updated_at", // ← nueva tabla para el lore
    });

    this.version(10).stores({
      personajes: "id, nombre, visible",
      criaturas: "id, nombre, habitat, alma, pensamiento",
      criatura_variantes: "id, criatura_id, tipo",
      items: "id, nombre, categoria",
      libros: "id, created_at",
      capitulos: "id, libro_id, orden, fecha_publicacion",
      canciones: "id, titulo, personaje, visible, created_at",
      secciones_cancion: "id, cancion_id, orden",
      reinos: "id, nombre, orden",
      relaciones: "id, personaje_id, personaje_rel_id, tipo",
      tareas: "id, username, completada, created_at, status",
      eventos: "id, username, fecha, tipo, status",
      recetas: "id, autor_id, categoria, created_at",
      ingredientes: "id, user_id",
      ropa: "id, user_id, created_at",
      ropa_outfits: "id, user_id, created_at",
      diario_fotos: "++id, categoria, created_at",
      dibujos: "++id, categoria",
      notas: "id, status, updated_at",
      ensayos: "id, status, updated_at",
      rutinas: "id, status",
      ejercicios_rutina: "id, rutina_id, status",
      offline_queue: "++id, table, operation, recordId, timestamp",
      compras: "id",
      reproductor_handles: "key",
      session_cache: "key, updated_at",
      reino_detalles: "id, reino_id",
      hechizos: "id, nombre",
      dones: "id, nombre",
      notas_lore: "id, updated_at",
      grupos_mundo: "id, tipo, created_at", // ← nueva tabla para grupos
    });

    // ─── v11: tablas de relación personaje↔hechizo / personaje↔don ───────────
    this.version(11).stores({
      personajes: "id, nombre, visible",
      criaturas: "id, nombre, habitat, alma, pensamiento",
      criatura_variantes: "id, criatura_id, tipo",
      items: "id, nombre, categoria",
      libros: "id, created_at",
      capitulos: "id, libro_id, orden, fecha_publicacion",
      canciones: "id, titulo, personaje, visible, created_at",
      secciones_cancion: "id, cancion_id, orden",
      reinos: "id, nombre, orden",
      relaciones: "id, personaje_id, personaje_rel_id, tipo",
      tareas: "id, username, completada, created_at, status",
      eventos: "id, username, fecha, tipo, status",
      recetas: "id, autor_id, categoria, created_at",
      ingredientes: "id, user_id",
      ropa: "id, user_id, created_at",
      ropa_outfits: "id, user_id, created_at",
      diario_fotos: "++id, categoria, created_at",
      dibujos: "++id, categoria",
      notas: "id, status, updated_at",
      ensayos: "id, status, updated_at",
      rutinas: "id, status",
      ejercicios_rutina: "id, rutina_id, status",
      offline_queue: "++id, table, operation, recordId, timestamp",
      compras: "id",
      reproductor_handles: "key",
      session_cache: "key, updated_at",
      reino_detalles: "id, reino_id",
      hechizos: "id, nombre",
      dones: "id, nombre",
      notas_lore: "id, updated_at",
      grupos_mundo: "id, tipo, created_at",
      personaje_hechizos: "id, personaje_id, hechizo_id", // ← nueva
      personaje_dones: "id, personaje_id, don_id", // ← nueva
    });

    // ─── v12: drops e ítems craftedos por criatura ────────────────────────────
    this.version(12).stores({
      personajes: "id, nombre, visible",
      criaturas: "id, nombre, habitat, alma, pensamiento",
      criatura_variantes: "id, criatura_id, tipo",
      items: "id, nombre, categoria",
      libros: "id, created_at",
      capitulos: "id, libro_id, orden, fecha_publicacion",
      canciones: "id, titulo, personaje, visible, created_at",
      secciones_cancion: "id, cancion_id, orden",
      reinos: "id, nombre, orden",
      relaciones: "id, personaje_id, personaje_rel_id, tipo",
      tareas: "id, username, completada, created_at, status",
      eventos: "id, username, fecha, tipo, status",
      recetas: "id, autor_id, categoria, created_at",
      ingredientes: "id, user_id",
      ropa: "id, user_id, created_at",
      ropa_outfits: "id, user_id, created_at",
      diario_fotos: "++id, categoria, created_at",
      dibujos: "++id, categoria",
      notas: "id, status, updated_at",
      ensayos: "id, status, updated_at",
      rutinas: "id, status",
      ejercicios_rutina: "id, rutina_id, status",
      offline_queue: "++id, table, operation, recordId, timestamp",
      compras: "id",
      reproductor_handles: "key",
      session_cache: "key, updated_at",
      reino_detalles: "id, reino_id",
      hechizos: "id, nombre",
      dones: "id, nombre",
      notas_lore: "id, updated_at",
      grupos_mundo: "id, tipo, created_at",
      personaje_hechizos: "id, personaje_id, hechizo_id",
      personaje_dones: "id, personaje_id, don_id",
      criatura_drops: "id, criatura_id, variante_id", // ← nueva
      item_crafteres: "id, criatura_id", // ← nueva
    });
    // ─── v13: caché local de galería ─────────────────────────────────────────────
    this.version(13).stores({
      personajes: "id, nombre, visible",
      criaturas: "id, nombre, habitat, alma, pensamiento",
      criatura_variantes: "id, criatura_id, tipo",
      items: "id, nombre, categoria",
      libros: "id, created_at",
      capitulos: "id, libro_id, orden, fecha_publicacion",
      canciones: "id, titulo, personaje, visible, created_at",
      secciones_cancion: "id, cancion_id, orden",
      reinos: "id, nombre, orden",
      relaciones: "id, personaje_id, personaje_rel_id, tipo",
      tareas: "id, username, completada, created_at, status",
      eventos: "id, username, fecha, tipo, status",
      recetas: "id, autor_id, categoria, created_at",
      ingredientes: "id, user_id",
      ropa: "id, user_id, created_at",
      ropa_outfits: "id, user_id, created_at",
      diario_fotos: "++id, categoria, created_at",
      dibujos: "++id, categoria",
      notas: "id, status, updated_at",
      ensayos: "id, status, updated_at",
      rutinas: "id, status",
      ejercicios_rutina: "id, rutina_id, status",
      offline_queue: "++id, table, operation, recordId, timestamp",
      compras: "id",
      reproductor_handles: "key",
      session_cache: "key, updated_at",
      reino_detalles: "id, reino_id",
      hechizos: "id, nombre",
      dones: "id, nombre",
      notas_lore: "id, updated_at",
      grupos_mundo: "id, tipo, created_at",
      personaje_hechizos: "id, personaje_id, hechizo_id",
      personaje_dones: "id, personaje_id, don_id",
      criatura_drops: "id, criatura_id, variante_id",
      item_crafteres: "id, criatura_id",
      galeria: "++id, orden, creado_en", // ← nueva
    });

    // ─── v14: runas y ciudades (antes faltaban en el schema local) ────────────
    this.version(14).stores({
      personajes: "id, nombre, visible",
      criaturas: "id, nombre, habitat, alma, pensamiento",
      criatura_variantes: "id, criatura_id, tipo",
      items: "id, nombre, categoria",
      libros: "id, created_at",
      capitulos: "id, libro_id, orden, fecha_publicacion",
      canciones: "id, titulo, personaje, visible, created_at",
      secciones_cancion: "id, cancion_id, orden",
      reinos: "id, nombre, orden",
      relaciones: "id, personaje_id, personaje_rel_id, tipo",
      tareas: "id, username, completada, created_at, status",
      eventos: "id, username, fecha, tipo, status",
      recetas: "id, autor_id, categoria, created_at",
      ingredientes: "id, user_id",
      ropa: "id, user_id, created_at",
      ropa_outfits: "id, user_id, created_at",
      diario_fotos: "++id, categoria, created_at",
      dibujos: "++id, categoria",
      notas: "id, status, updated_at",
      ensayos: "id, status, updated_at",
      rutinas: "id, status",
      ejercicios_rutina: "id, rutina_id, status",
      offline_queue: "++id, table, operation, recordId, timestamp",
      compras: "id",
      reproductor_handles: "key",
      session_cache: "key, updated_at",
      reino_detalles: "id, reino_id",
      hechizos: "id, nombre",
      dones: "id, nombre",
      notas_lore: "id, updated_at",
      grupos_mundo: "id, tipo, created_at",
      personaje_hechizos: "id, personaje_id, hechizo_id",
      personaje_dones: "id, personaje_id, don_id",
      criatura_drops: "id, criatura_id, variante_id",
      item_crafteres: "id, criatura_id",
      galeria: "++id, orden, creado_en",
      runas: "id, nombre", // ← nueva
      ciudades: "id, nombre, tipo, reino_id", // ← nueva
    });

    // ─── v15: capitulos con orden_linea_tiempo; reinos sin cambio de schema ──
    // (historia se persiste como campo de datos, no necesita índice propio)
    this.version(15).stores({
      personajes: "id, nombre, visible",
      criaturas: "id, nombre, habitat, alma, pensamiento",
      criatura_variantes: "id, criatura_id, tipo",
      items: "id, nombre, categoria",
      libros: "id, created_at",
      capitulos: "id, libro_id, orden, fecha_publicacion, orden_linea_tiempo", // ← orden_linea_tiempo indexado
      canciones: "id, titulo, personaje, visible, created_at",
      secciones_cancion: "id, cancion_id, orden",
      reinos: "id, nombre, orden", // historia se persiste como dato (no índice)
      relaciones: "id, personaje_id, personaje_rel_id, tipo",
      tareas: "id, username, completada, created_at, status",
      eventos: "id, username, fecha, tipo, status",
      recetas: "id, autor_id, categoria, created_at",
      ingredientes: "id, user_id",
      ropa: "id, user_id, created_at",
      ropa_outfits: "id, user_id, created_at",
      diario_fotos: "++id, categoria, created_at",
      dibujos: "++id, categoria",
      notas: "id, status, updated_at",
      ensayos: "id, status, updated_at",
      rutinas: "id, status",
      ejercicios_rutina: "id, rutina_id, status",
      offline_queue: "++id, table, operation, recordId, timestamp",
      compras: "id",
      reproductor_handles: "key",
      session_cache: "key, updated_at",
      reino_detalles: "id, reino_id",
      hechizos: "id, nombre",
      dones: "id, nombre",
      notas_lore: "id, updated_at",
      grupos_mundo: "id, tipo, created_at",
      personaje_hechizos: "id, personaje_id, hechizo_id",
      personaje_dones: "id, personaje_id, don_id",
      criatura_drops: "id, criatura_id, variante_id",
      item_crafteres: "id, criatura_id",
      galeria: "++id, orden, creado_en",
      runas: "id, nombre",
      ciudades: "id, nombre, tipo, reino_id",
    });

    // ─── v16: perfil de usuario cacheado offline ──────────────────────────────
    this.version(16).stores({
      personajes: "id, nombre, visible",
      criaturas: "id, nombre, habitat, alma, pensamiento",
      criatura_variantes: "id, criatura_id, tipo",
      items: "id, nombre, categoria",
      libros: "id, created_at",
      capitulos: "id, libro_id, orden, fecha_publicacion, orden_linea_tiempo",
      canciones: "id, titulo, personaje, visible, created_at",
      secciones_cancion: "id, cancion_id, orden",
      reinos: "id, nombre, orden",
      relaciones: "id, personaje_id, personaje_rel_id, tipo",
      tareas: "id, username, completada, created_at, status",
      eventos: "id, username, fecha, tipo, status",
      recetas: "id, autor_id, categoria, created_at",
      ingredientes: "id, user_id",
      ropa: "id, user_id, created_at",
      ropa_outfits: "id, user_id, created_at",
      diario_fotos: "++id, categoria, created_at",
      dibujos: "++id, categoria",
      notas: "id, status, updated_at",
      ensayos: "id, status, updated_at",
      rutinas: "id, status",
      ejercicios_rutina: "id, rutina_id, status",
      offline_queue: "++id, table, operation, recordId, timestamp",
      compras: "id",
      reproductor_handles: "key",
      session_cache: "key, updated_at",
      reino_detalles: "id, reino_id",
      hechizos: "id, nombre",
      dones: "id, nombre",
      notas_lore: "id, updated_at",
      grupos_mundo: "id, tipo, created_at",
      personaje_hechizos: "id, personaje_id, hechizo_id",
      personaje_dones: "id, personaje_id, don_id",
      criatura_drops: "id, criatura_id, variante_id",
      item_crafteres: "id, criatura_id",
      galeria: "++id, orden, creado_en",
      runas: "id, nombre",
      ciudades: "id, nombre, tipo, reino_id",
      perfiles: "id",
    });

    // ─── v17: calendario del mundo + dia_absoluto en caps y canciones ─────────
    // - capitulos: añade dia_absoluto como campo indexado (reemplaza orden_linea_tiempo para la línea de tiempo)
    // - canciones: añade dia_absoluto como campo indexado
    // - calendario_estaciones, calendario_config, eras_mundo: nuevas tablas del mundo
    this.version(17).stores({
      personajes: "id, nombre, visible",
      criaturas: "id, nombre, habitat, alma, pensamiento",
      criatura_variantes: "id, criatura_id, tipo",
      items: "id, nombre, categoria",
      libros: "id, created_at",
      capitulos:
        "id, libro_id, orden, fecha_publicacion, orden_linea_tiempo, dia_absoluto", // ← dia_absoluto indexado
      canciones: "id, titulo, personaje, visible, created_at, dia_absoluto", // ← dia_absoluto indexado
      secciones_cancion: "id, cancion_id, orden",
      reinos: "id, nombre, orden",
      relaciones: "id, personaje_id, personaje_rel_id, tipo",
      tareas: "id, username, completada, created_at, status",
      eventos: "id, username, fecha, tipo, status",
      recetas: "id, autor_id, categoria, created_at",
      ingredientes: "id, user_id",
      ropa: "id, user_id, created_at",
      ropa_outfits: "id, user_id, created_at",
      diario_fotos: "++id, categoria, created_at",
      dibujos: "++id, categoria",
      notas: "id, status, updated_at",
      ensayos: "id, status, updated_at",
      rutinas: "id, status",
      ejercicios_rutina: "id, rutina_id, status",
      offline_queue: "++id, table, operation, recordId, timestamp",
      compras: "id",
      reproductor_handles: "key",
      session_cache: "key, updated_at",
      reino_detalles: "id, reino_id",
      hechizos: "id, nombre",
      dones: "id, nombre",
      notas_lore: "id, updated_at",
      grupos_mundo: "id, tipo, created_at",
      personaje_hechizos: "id, personaje_id, hechizo_id",
      personaje_dones: "id, personaje_id, don_id",
      criatura_drops: "id, criatura_id, variante_id",
      item_crafteres: "id, criatura_id",
      galeria: "++id, orden, creado_en",
      runas: "id, nombre",
      ciudades: "id, nombre, tipo, reino_id",
      perfiles: "id",
      calendario_estaciones: "id, orden", // ← nueva
      calendario_config: "id", // ← nueva (singleton)
      eras_mundo: "id, anio_inicio", // ← nueva
    });

    this.version(18).stores({
      eventos_mundo: "id, reino_id, dia_absoluto, source", // ← nueva: eventos del mundo/reino (sistema dia_absoluto)
    });

    // ─── v19: eras de personaje (arcos vitales en la línea de tiempo) ─────────
    this.version(19).stores({
      personajes: "id, nombre, visible",
      criaturas: "id, nombre, habitat, alma, pensamiento",
      criatura_variantes: "id, criatura_id, tipo",
      items: "id, nombre, categoria",
      libros: "id, created_at",
      capitulos:
        "id, libro_id, orden, fecha_publicacion, orden_linea_tiempo, dia_absoluto",
      canciones: "id, titulo, personaje, visible, created_at, dia_absoluto",
      secciones_cancion: "id, cancion_id, orden",
      reinos: "id, nombre, orden",
      relaciones: "id, personaje_id, personaje_rel_id, tipo",
      tareas: "id, username, completada, created_at, status",
      eventos: "id, username, fecha, tipo, status",
      recetas: "id, autor_id, categoria, created_at",
      ingredientes: "id, user_id",
      ropa: "id, user_id, created_at",
      ropa_outfits: "id, user_id, created_at",
      diario_fotos: "++id, categoria, created_at",
      dibujos: "++id, categoria",
      notas: "id, status, updated_at",
      ensayos: "id, status, updated_at",
      rutinas: "id, status",
      ejercicios_rutina: "id, rutina_id, status",
      offline_queue: "++id, table, operation, recordId, timestamp",
      compras: "id",
      reproductor_handles: "key",
      session_cache: "key, updated_at",
      reino_detalles: "id, reino_id",
      hechizos: "id, nombre",
      dones: "id, nombre",
      notas_lore: "id, updated_at",
      grupos_mundo: "id, tipo, created_at",
      personaje_hechizos: "id, personaje_id, hechizo_id",
      personaje_dones: "id, personaje_id, don_id",
      criatura_drops: "id, criatura_id, variante_id",
      item_crafteres: "id, criatura_id",
      galeria: "++id, orden, creado_en",
      runas: "id, nombre",
      ciudades: "id, nombre, tipo, reino_id",
      perfiles: "id",
      calendario_estaciones: "id, orden",
      calendario_config: "id",
      eras_mundo: "id, anio_inicio",
      eventos_mundo: "id, reino_id, dia_absoluto, source",
      personaje_eras: "id, personaje_id, momento", // ← nueva: arcos vitales del personaje
    });

    // ─── v20: misiones / desafíos (catálogo + progreso por usuario) ──────────
    this.version(20).stores({
      personajes: "id, nombre, visible",
      criaturas: "id, nombre, habitat, alma, pensamiento",
      criatura_variantes: "id, criatura_id, tipo",
      items: "id, nombre, categoria",
      libros: "id, created_at",
      capitulos:
        "id, libro_id, orden, fecha_publicacion, orden_linea_tiempo, dia_absoluto",
      canciones: "id, titulo, personaje, visible, created_at, dia_absoluto",
      secciones_cancion: "id, cancion_id, orden",
      reinos: "id, nombre, orden",
      relaciones: "id, personaje_id, personaje_rel_id, tipo",
      tareas: "id, username, completada, created_at, status",
      eventos: "id, username, fecha, tipo, status",
      recetas: "id, autor_id, categoria, created_at",
      ingredientes: "id, user_id",
      ropa: "id, user_id, created_at",
      ropa_outfits: "id, user_id, created_at",
      diario_fotos: "++id, categoria, created_at",
      dibujos: "++id, categoria",
      notas: "id, status, updated_at",
      ensayos: "id, status, updated_at",
      rutinas: "id, status",
      ejercicios_rutina: "id, rutina_id, status",
      offline_queue: "++id, table, operation, recordId, timestamp",
      compras: "id",
      reproductor_handles: "key",
      session_cache: "key, updated_at",
      reino_detalles: "id, reino_id",
      hechizos: "id, nombre",
      dones: "id, nombre",
      notas_lore: "id, updated_at",
      grupos_mundo: "id, tipo, created_at",
      personaje_hechizos: "id, personaje_id, hechizo_id",
      personaje_dones: "id, personaje_id, don_id",
      criatura_drops: "id, criatura_id, variante_id",
      item_crafteres: "id, criatura_id",
      galeria: "++id, orden, creado_en",
      runas: "id, nombre",
      ciudades: "id, nombre, tipo, reino_id",
      perfiles: "id",
      calendario_estaciones: "id, orden",
      calendario_config: "id",
      eras_mundo: "id, anio_inicio",
      eventos_mundo: "id, reino_id, dia_absoluto, source",
      personaje_eras: "id, personaje_id, momento",
      misiones: "id, dificultad, categoria, activa", // ← nueva: catálogo de misiones
      misiones_usuario: "id, user_id, mision_id, estado, status", // ← nueva: progreso por usuario
    });

    // ─── v21: vínculos de entidades a misiones ────────────────────────────────
    this.version(21).stores({
      mision_entidades: "id, mision_id, tipo, entidad_id, rol", // ← nueva: relaciones misión ↔ entidades
    });

    // ─── v22: tiles de mapa global y de reinos ────────────────────────────────
    this.version(22).stores({
      map_tiles: "id, world_id, col, row", // ← tiles del mapa global
      reino_tiles: "id, reino_id, col, row", // ← tiles del mapa de cada reino
    });

    // ─── v23: índice personaje_id en canciones (acelera EditorPersonaje) ──────
    // Antes de esta versión, useCancionesPersonaje hacía toArray() completo y
    // filtraba en JS. Con el índice, .where("personaje_id").equals(id) es O(log n).
    this.version(23).stores({
      canciones:
        "id, titulo, personaje, personaje_id, visible, created_at, dia_absoluto",
    });

    // ─── v24: cache offline de "descubrimientos" (GlobalCommandPalette) ──────
    // Antes, useUnlockedSearch/useUnlockedOverview pegaban directo a Supabase
    // (3-5 queries en paralelo) cada vez que se abría la paleta o se tipeaba,
    // sin ningún cache local — de ahí la demora perceptible. Con esta tabla,
    // igual que el resto de entidades vía useSupabaseData, leemos Dexie al
    // instante y revalidamos contra Supabase en segundo plano.
    this.version(24).stores({
      descubrimientos: "id, perfil_id, tipo, entidad_id",
    });

    // ─── v25: flags narrativos (sistema [[flag|set]]/[[flag|if]]) ────────────
    this.version(25).stores({
      flagsNarrativos: "id, perfil_id, flag_id",
    });

    // ─── v26: posiciones del editor visual de grafo (Fase 3) ──────────────────
    this.version(26).stores({
      nodoPosiciones: "id, capId, nodeId",
    });

    // ─── v27: progreso de misiones pasa a filtrarse por identidad (ficha_id)
    // en vez de por user_id — el XP/monedas ahora vive en cada ficha_dnd.
    // Se agrega el índice ficha_id; user_id se conserva en los datos pero
    // deja de ser el índice principal de consulta.
    this.version(27).stores({
      misiones_usuario: "id, ficha_id, user_id, mision_id, estado, status",
    });

    // ─── v28: se retira el sistema de Hechizos/Dones — todo pasa a vivir
    // únicamente en Runas. null borra la tabla de IndexedDB en los
    // navegadores que ya tenían datos viejos (no se puede simplemente omitir
    // la tabla: Dexie requiere declarar explícitamente su eliminación).
    this.version(28).stores({
      hechizos: null,
      dones: null,
      personaje_hechizos: null,
      personaje_dones: null,
    });

    // ─── v29: áreas del mapa (círculo/rectángulo/polígono) ────────────────────
    // Zonas dibujadas sobre el mapa global, vinculadas a un reino o ciudad —
    // ver EditorMapa/MapaInteractivo y la nueva tabla map_areas en Supabase.
    this.version(29).stores({
      map_areas: "id, world_id, reino_id, ciudad_id",
    });

    // ─── v30: áreas del mapa INTERNO de cada reino ─────────────────────────────
    // Análogo a v29 pero scoped por reino_id — ver ReinoTileCanvas y la nueva
    // tabla reino_areas en Supabase (domains/garlia/reinos/components/reino_areas.sql).
    this.version(30).stores({
      reino_areas: "id, reino_id, ciudad_id",
    });

    // ─── v31: caché local de mensajes de chat ─────────────────────────────────
    // Antes el chat (chatEngine.ts) iba siempre directo contra Supabase, sin
    // ningún cache local — de ahí que abrir una conversación tardara en
    // mostrar algo (esperaba el round-trip completo antes de pintar). Con
    // esta tabla, igual que el resto de entidades (ver useSupabaseData),
    // pintamos primero lo que ya tenemos guardado localmente y revalidamos
    // contra Supabase en segundo plano — ver cargarMensajesConCache en
    // chatEngine.ts. Indexado por conversacion_id (la query más común) y por
    // created_at (para poder traer "los últimos N" ya ordenados).
    this.version(31).stores({
      mensajes_cache: "id, conversacion_id, created_at",
    });

    // ─── v32: cache offline de Química (elementos/compuestos), Física
    // (oris/partículas/iums/conceptos) y Biología (biomas/clados/
    // ecosistemas/cadenas/perfiles atómicos) — antes solo pegaban directo
    // a Supabase sin ningún fallback local, de ahí que la Tabla Química/
    // Física/Biología se reiniciara en blanco al recargar sin conexión (o
    // simplemente tardara el round-trip completo). Mismo patrón que el
    // resto de tablas: useSupabaseData ya sabe leer/escribir acá, solo
    // faltaba declararlas.
    this.version(32).stores({
      elementos: "id, nombre, numero_atomico",
      compuestos: "id, nombre, created_at",
      oris: "id, orden",
      particulas: "id, orden",
      particulas_base: "id, orden",
      iums: "id, orden",
      fisica_conceptos: "id, orden",
      biomas: "id, nombre, orden",
      clados: "id, nombre, padre_id, orden",
      ecosistemas: "id, nombre, bioma_id, orden",
      cadenas_alimenticias: "id, nombre, ecosistema_id, orden",
      perfiles_atomicos_criatura: "id, criatura_id",
    });

    // ─── v33: cache offline de Órganos/Formaciones y su jerarquía de
    // composición (Célula/Tejido, Grano/Veta) + Reacciones — mismo motivo
    // que v32: hasta ahora pegaban directo a Supabase sin cache local, así
    // que useOrganos/useFormaciones/useCelulas/useTejidos/useGranos/
    // useVetas/useReacciones se reiniciaban en blanco al recargar sin
    // conexión. Incluye también las tablas puente organo_tejidos y
    // formacion_vetas (fórmula de cada Órgano/Formación puntual) y las
    // tablas puente hacia las entidades finales (planta_organos,
    // criatura_organos, mineral_formaciones, item_estructura) — mismo
    // patrón {entidad_id, grupo_compuesto_id} que usa useEntidadVinculosGrupo.
    this.version(33).stores({
      organos: "id, nombre, created_at",
      formaciones: "id, nombre, created_at",
      celulas: "id, nombre, compuesto_id, created_at",
      tejidos: "id, nombre, celula_id, created_at",
      granos: "id, nombre, compuesto_id, created_at",
      vetas: "id, nombre, grano_id, created_at",
      organo_tejidos: "id, organo_id, tejido_id",
      formacion_vetas: "id, formacion_id, veta_id",
      reacciones: "id, nombre, created_at",
      planta_organos: "id, planta_id, grupo_compuesto_id",
      criatura_organos: "id, criatura_id, grupo_compuesto_id",
      mineral_formaciones: "id, mineral_id, grupo_compuesto_id",
      item_estructura: "id, item_id, grupo_compuesto_id",
    });

    // ─── v34: cache offline de las tablas relacionales creadas en Fases 2 y 3
    // del rediseño 1.0 — compuesto_elementos (Fase 2, reemplaza a
    // compuestos.componentes jsonb como fuente de lectura, ver
    // useCompuestosConElementos) y oris_iums (Fase 3, ver useOrisConIums).
    // También fenomenos (Fase 2: tabla nueva para Fuego/Rayo marcados
    // es_fenomeno; la migración física completa vía fenomeno_elementos/
    // fenomeno_procesos queda para Fase 6, pero la tabla base ya existe en
    // Supabase y necesita cache igual que el resto). Hasta esta versión,
    // useCompuestosConElementos pegaba directo a Supabase sin pasar por
    // Dexie — se reiniciaba en blanco sin conexión, a diferencia del resto
    // del catálogo de Química que sí cachea desde v32.
    this.version(34).stores({
      compuesto_elementos: "id, compuesto_id, elemento_id",
      oris_iums: "id, oris_id, ium_id",
      fenomenos: "id, nombre, created_at",
    });

    // ─── v35: cache offline de las tablas creadas en Fases 4-7 del rediseño
    // 1.0. Los datos y el frontend ya migraron a este esquema (useFormacion-
    // Vetas, useUsosCompuesto, useOrganismos, useSistemas, useReacciones,
    // persistirReaccion), pero Dexie nunca se actualizó — quedaban pegando
    // directo a Supabase sin cache, igual que compuesto_elementos/oris_iums
    // antes de v34.
    //   Fase 4 — estructura_componentes: Veta→Grano→Compuesto (N:M en cadena)
    //   Fase 5 — organismos, sistemas, sistema_organos, organismo_sistemas
    //   Fase 6 — reaccion_componentes (reemplaza consume/produce jsonb),
    //            procesos, proceso_reacciones, fenomeno_procesos,
    //            fenomeno_elementos (estas últimas tres sin hook frontend
    //            propio todavía, pero se cachean igual por consistencia)
    this.version(35).stores({
      estructura_componentes: "id, padre_tipo, padre_id, hijo_tipo, hijo_id",
      organismos: "id, nombre, created_at",
      sistemas: "id, nombre, created_at",
      sistema_organos: "id, sistema_id, organo_id",
      organismo_sistemas: "id, organismo_id, sistema_id",
      reaccion_componentes: "id, reaccion_id, entidad_tipo, entidad_id",
      procesos: "id, nombre, created_at",
      proceso_reacciones: "id, proceso_id, reaccion_id",
      fenomeno_procesos: "id, fenomeno_id, proceso_id",
      fenomeno_elementos: "id, fenomeno_id, elemento_id",
    });
    // ─── v36: minerales y flora nunca entraron a Dexie en ningún versionado
    // anterior — quedaron fuera del barrido de v32 (que sí trajo elementos,
    // compuestos, oris, etc.) por alguna razón no documentada. Se detecta
    // ahora al migrar useUsosCompuesto.ts (Fase 7) a cache-first: ese hook
    // trae minerales/flora completas y sin esto no tendría nada que cachear.
    this.version(36).stores({
      minerales: "id, nombre, created_at",
      flora: "id, nombre, created_at",
    });

    // ─── v37: mineral_reacciones (Procesos de Minerales, ver
    // useMineralFormacionesProcesos.ts) — mismo caso que sistema_organos/
    // organismo_sistemas: hook filtra por mineral_id, nunca tuvo cache
    // Dexie. Se agrega ahora al completar el barrido de Fase 8.
    this.version(37).stores({
      mineral_reacciones: "id, mineral_id, reaccion_id, created_at",
    });
  }
}

export const db =
  typeof window !== "undefined"
    ? new AgendaFraniDB()
    : (null as unknown as AgendaFraniDB);
