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

  // ─── Propiedades físicas calculadas (Supabase, solo lectura) ───────────
  // Estas columnas las pobla/recalcula automáticamente
  // calcular_propiedades_elemento (trigger BEFORE INSERT/UPDATE en
  // Supabase) a partir de nucleo/media/externa — el frontend NUNCA debe
  // escribir acá directamente, solo leer y mostrar. Ver estado_proyecto
  // ("Elementos: motor propio de cálculo") para el detalle de la
  // derivación. Todas nullable porque pueden no estar calculadas aún.
  masa_base?: number | null;
  volumen_base?: number | null;
  estabilidad?: number | null;
  rigidez?: number | null;
  flexibilidad?: number | null;
  dureza?: number | null;
  conductividad?: number | null;
  transparencia?: number | null;
  interaccion?: number | null;
  capacidad_transformacion?: number | null;
  dinamismo_particular?: number | null;
  valencia_estructural?: number | null;
  capacidad_enlace?: number | null;
  polaridad_estructural?: number | null;
  saturacion_enlace?: number | null;
  regimen_estructural?: string | null;

  // ─── Resto de columnas reales de Supabase (2026-08-27) ──────────────────
  // Agregadas al tipo para que coincidan 1:1 con la tabla real y no se
  // pierda tipado sobre datos que ya viajan en el fetch (CONFIG.select) —
  // ver auditoría de columnas faltantes en elementos/compuestos/materiales.
  created_at?: string | null;
  updated_at?: string | null;
  carga_q?: number | null;
  catalisis_total?: number | null;
  transicion_total?: number | null;
  balance_ct?: number | null;
  capacidad_externa?: number | null;
  externa_saturada?: boolean | null;
  ocupacion_externa?: number | null;
  capacidad_externa_restante?: number | null;
  saturacion_externa?: number | null;
  nucleo_particulas_totales?: number | null;
  media_particulas_totales?: number | null;
  nucleo_vector_fundamental?: Record<string, unknown> | null;
  media_vector_fundamental?: Record<string, unknown> | null;
  externa_vector_fundamental?: Record<string, unknown> | null;
  perfil_fisico?: Record<string, unknown> | null;
  vector_fundamental_total?: Record<string, unknown> | null;
  nucleo_catalisis?: number | null;
  media_catalisis?: number | null;
  externa_catalisis?: number | null;
  nucleo_transicion?: number | null;
  media_transicion?: number | null;
  externa_transicion?: number | null;
  nucleo_carga_q?: number | null;
  media_carga_q?: number | null;
  externa_carga_q?: number | null;
  regimen_por_capa?: Record<string, unknown> | null;
  estado_fisico?: Record<string, unknown> | null;
  propiedades_emergentes?: Record<string, unknown> | null;
  validacion_fisica?: Record<string, unknown> | null;
  estado_configuracion?: Record<string, unknown> | null;
  valencia_fuente?: string | null;
  sitios_enlace_externos?: number | null;
  disponibilidad_enlace?: number | null;
  selectividad_enlace?: number | null;
  capacidad_enlace_bruta?: number | null;
  sitios_enlace?: Record<string, unknown> | null;
  afinidad_enlace?: number | null;
  disponibilidad_sitios?: number | null;
  capacidad_externa_enlace?: number | null;
  carga_q_norm?: number | null;
}

export const CONFIG = {
  tabla: "elementos",
  // "es_catalizador" removido del select (2026-08-27): esa columna NO
  // existe en la tabla real "elementos" de Supabase — pedirla hacía
  // fallar el select ENTERO con un 42703 en cada carga (PostgREST no
  // devuelve resultado parcial), tumbando useElementos() de punta a
  // punta, mismo patrón que el bug ya documentado en CONFIG_COMPUESTOS.
  // Elemento.es_catalizador queda opcional/undefined para todas las filas
  // hasta que se agregue la columna en Supabase — afinidad.ts,
  // ElementoEditor, ElementosPage y SandboxPage ya tratan el campo como
  // opcional (`?? false` / `el?.es_catalizador`), así que la feature de
  // "catalizador" queda deshabilitada (todo se comporta como no-
  // catalizador) sin romper tipos ni el resto del fetch.
  select:
    "id, numero_atomico, nombre, simbolo, familia, es_noble, notas, nucleo, media, externa, " +
    "created_at, updated_at, carga_q, catalisis_total, transicion_total, balance_ct, " +
    "regimen_estructural, capacidad_externa, externa_saturada, ocupacion_externa, " +
    "capacidad_externa_restante, saturacion_externa, nucleo_particulas_totales, " +
    "media_particulas_totales, nucleo_vector_fundamental, media_vector_fundamental, " +
    "externa_vector_fundamental, perfil_fisico, vector_fundamental_total, nucleo_catalisis, " +
    "media_catalisis, externa_catalisis, nucleo_transicion, media_transicion, externa_transicion, " +
    "nucleo_carga_q, media_carga_q, externa_carga_q, regimen_por_capa, estado_fisico, " +
    "propiedades_emergentes, validacion_fisica, masa_base, estabilidad, rigidez, flexibilidad, " +
    "capacidad_transformacion, estado_configuracion, dureza, conductividad, transparencia, " +
    "interaccion, valencia_estructural, capacidad_enlace, polaridad_estructural, " +
    "saturacion_enlace, valencia_fuente, sitios_enlace_externos, disponibilidad_enlace, " +
    "selectividad_enlace, capacidad_enlace_bruta, sitios_enlace, afinidad_enlace, " +
    "disponibilidad_sitios, capacidad_externa_enlace, carga_q_norm, dinamismo_particular, " +
    "volumen_base",
};

/** Una propiedad física calculada del Elemento, lista para renderizar en
 *  la sección de solo lectura de ElementoEditor — ver PROPIEDADES_ELEMENTO. */
export interface PropiedadCalculada {
  clave: string;
  label: string;
  /** Valor ya formateado como string (o null si no está calculado). */
  valor: string | null;
  /** 0-1 para dibujar barra de progreso; undefined si el valor no es una
   *  proporción (ej. valencia_estructural, que es un conteo). */
  proporcion?: number;
  descripcion: string;
  /** Fórmula corta y legible (no la implementación SQL literal) — de
   *  dónde sale el número, para el popover de info junto al título de la
   *  sección. Ver elemento_propiedad_reglas / compuesto_reglas en
   *  Supabase, fuente canónica de estas fórmulas. Opcional: si no hay
   *  fórmula documentada (ej. clasificaciones textuales derivadas por
   *  regla simple), se omite del popover. */
  formula?: string;
}

/** Arma la lista de propiedades físicas calculadas de un Elemento para
 *  mostrar en la sección "Propiedades físicas (derivado)" de
 *  ElementoEditor — puramente de presentación, sin recalcular nada acá
 *  (los valores ya vienen calculados desde Supabase). */
export function propiedadesCalculadasDeElemento(el: Elemento): PropiedadCalculada[] {
  const fmt = (v?: number | null, digitos = 3) =>
    v === null || v === undefined ? null : v.toFixed(digitos);
  const prop = (v?: number | null) =>
    v === null || v === undefined ? undefined : Math.max(0, Math.min(1, v));

  return [
    { clave: "masa_base", label: "Masa", valor: fmt(el.masa_base, 2), descripcion: "Cantidad de masa fundamental del elemento en la escala interna de Garlia.", formula: "Masa = 1.00·Masa(núcleo) + 0.75·Equilibrio(núcleo) + 0.50·Cinética(núcleo)" },
    { clave: "volumen_base", label: "Volumen", valor: fmt(el.volumen_base, 2), descripcion: "Espacio de referencia asociado a la configuración del elemento; no es una magnitud 0–1.", formula: "Volumen base = número total de partículas de la configuración elemental" },
    { clave: "estabilidad", label: "Estabilidad", valor: fmt(el.estabilidad), proporcion: prop(el.estabilidad), descripcion: "Qué tan resistente es a romperse o transformarse.", formula: "Propiedad derivada de la composición y estructura del compuesto." },
    { clave: "rigidez", label: "Rigidez", valor: fmt(el.rigidez), proporcion: prop(el.rigidez), descripcion: "Resistencia a deformarse bajo fuerza.", formula: "Propiedad derivada de la composición y estructura del compuesto." },
    { clave: "flexibilidad", label: "Flexibilidad", valor: fmt(el.flexibilidad), proporcion: prop(el.flexibilidad), descripcion: "Capacidad de deformarse sin romperse.", formula: "Propiedad derivada de la composición y estructura del compuesto." },
    { clave: "dureza", label: "Dureza", valor: fmt(el.dureza), proporcion: prop(el.dureza), descripcion: "Resistencia a ser rayado o penetrado.", formula: "Dureza = 0.65·rigidez + 0.20·saturación de enlace + 0.15·saturación externa" },
    { clave: "conductividad", label: "Conductividad", valor: fmt(el.conductividad), proporcion: prop(el.conductividad), descripcion: "Facilidad para transmitir energía/interacción.", formula: "Conductividad = 0.35·interacción externa + 0.30·interacción media + 0.20·información externa + 0.15·dinámica externa" },
    { clave: "transparencia", label: "Transparencia", valor: fmt(el.transparencia), proporcion: prop(el.transparencia), descripcion: "Cuánto deja pasar en vez de bloquear/absorber.", formula: "Transparencia = propiedad derivada de la capacidad de paso y retención." },
    { clave: "interaccion", label: "Interacción", valor: fmt(el.interaccion), proporcion: prop(el.interaccion), descripcion: "Facilidad con la que el elemento se acopla o responde a su entorno.", formula: "Interacción = propiedad derivada de la capacidad de acoplamiento del elemento." },
    { clave: "capacidad_transformacion", label: "Cap. transformación", valor: fmt(el.capacidad_transformacion), proporcion: prop(el.capacidad_transformacion), descripcion: "Potencial/facilidad de cambio del elemento (no es velocidad real).", formula: "Cap. transformación = 0.60·transición + 0.20·(1−catálisis) + 0.20·(1−saturación externa)" },
    { clave: "dinamismo_particular", label: "Dinamismo", valor: fmt(el.dinamismo_particular, 2), descripcion: "Magnitud combinada de dinámica/transformación/interacción — usada como base de duración de procesos.", formula: "Dinamismo = combinación de dinámica + transformación + interacción de la capa externa" },
    { clave: "valencia_estructural", label: "Valencia estructural", valor: fmt(el.valencia_estructural, 0), descripcion: "Cantidad de enlaces que puede sostener estructuralmente.", formula: "Valencia = mín(ocupación, capacidad externa − ocupación, capacidad externa / 2)" },
    { clave: "capacidad_enlace", label: "Capacidad de enlace", valor: fmt(el.capacidad_enlace), proporcion: prop(el.capacidad_enlace), descripcion: "Qué tan disponible está para formar enlaces nuevos.", formula: "Cap. de enlace = valencia / (capacidad externa / 2)" },
    { clave: "saturacion_enlace", label: "Saturación de enlace", valor: fmt(el.saturacion_enlace), proporcion: prop(el.saturacion_enlace), descripcion: "Qué tan cerca está de agotar su capacidad de enlace.", formula: "Saturación de enlace = sitios de enlace usados / sitios de enlace disponibles" },
    { clave: "regimen_estructural", label: "Régimen estructural", valor: el.regimen_estructural ?? null, descripcion: "Clasificación estructural derivada (ej. equilibrio).", formula: "Catálisis > Transición → conservación · Catálisis = Transición → equilibrio · Transición > Catálisis → transformación" },

    // ─── Sitios, afinidades y enlaces posibles (columnas reales en
    // Supabase, pobladas en las 67 filas, que no se mostraban en ningún
    // editor/visualizador hasta ahora — ver auditoría 2026-08-30). No se
    // incluye disponibilidad_enlace ni capacidad_enlace_bruta: ambas están
    // en 0 en el 100% de las filas actuales (sin implementar todavía en el
    // motor de cálculo), mostrarlas sería ruido de ceros sin significado.
    { clave: "afinidad_enlace", label: "Afinidad de enlace", valor: fmt(el.afinidad_enlace), proporcion: prop(el.afinidad_enlace), descripcion: "Qué tan bien conecta el elemento con otros al formar enlaces.", formula: "Afinidad de enlace = (afinidad de enlace + interacción del elemento) / 2" },
    { clave: "disponibilidad_sitios", label: "Sitios disponibles", valor: fmt(el.disponibilidad_sitios), proporcion: prop(el.disponibilidad_sitios), descripcion: "Proporción de sitios de enlace todavía libres para nuevos enlaces." },
    { clave: "sitios_enlace_externos", label: "Sitios de enlace externos", valor: fmt(el.sitios_enlace_externos, 0), descripcion: "Cantidad de sitios de enlace disponibles en la capa externa." },
    { clave: "capacidad_externa_enlace", label: "Capacidad externa de enlace", valor: fmt(el.capacidad_externa_enlace), proporcion: prop(el.capacidad_externa_enlace), descripcion: "Qué tan preparada está la capa externa para sostener enlaces nuevos." },
    { clave: "selectividad_enlace", label: "Selectividad de enlace", valor: fmt(el.selectividad_enlace), proporcion: prop(el.selectividad_enlace), descripcion: "Qué tan exigente es el elemento al aceptar enlaces nuevos." },
    { clave: "polaridad_estructural", label: "Polaridad estructural", valor: fmt(el.polaridad_estructural), proporcion: prop(el.polaridad_estructural), descripcion: "Desbalance direccional de su estructura de enlace.", formula: "Polaridad = |2 · saturación externa − 1|" },

    // ─── Carga, catálisis/transición y ocupación externa (columnas reales
    // en Supabase, traídas en el select pero nunca mostradas hasta ahora —
    // ver auditoría 2026-08-30 "qué propiedades faltan en Elemento"). Los
    // totales primero, después el desglose por capa (núcleo/media/externa)
    // de cada uno — mismo criterio que catalisis_total/transicion_total ya
    // alimentan balance_ct y regimen_estructural arriba, solo que ahora
    // también se ve el número.
    { clave: "carga_q", label: "Carga Q", valor: fmt(el.carga_q, 2), descripcion: "Carga cuántica total del elemento, suma de las 3 capas.", formula: "Carga Q = carga_q(núcleo) + carga_q(media) + carga_q(externa)" },
    { clave: "carga_q_norm", label: "Carga Q (normalizada)", valor: fmt(el.carga_q_norm), proporcion: prop(el.carga_q_norm), descripcion: "Carga Q normalizada a escala 0–1 para comparar entre elementos." },
    { clave: "catalisis_total", label: "Catálisis total", valor: fmt(el.catalisis_total, 2), descripcion: "Suma de catálisis en las 3 capas — numerador de la relación R usada en régimen estructural." },
    { clave: "transicion_total", label: "Transición total", valor: fmt(el.transicion_total, 2), descripcion: "Suma de transición en las 3 capas — denominador de la relación R usada en régimen estructural." },
    { clave: "balance_ct", label: "Balance Catálisis/Transición", valor: fmt(el.balance_ct), descripcion: "R = Catálisis total / Transición total. Define la familia (Rígido/Intermedio/Reactivo) junto a Noble/Inerte.", formula: "R = Catálisis total / Transición total" },
    { clave: "capacidad_externa", label: "Capacidad externa", valor: fmt(el.capacidad_externa, 0), descripcion: "Cupo total de la capa externa para partículas de Voluntad/Percepción/Transición/Catálisis." },
    { clave: "ocupacion_externa", label: "Ocupación externa", valor: fmt(el.ocupacion_externa, 0), descripcion: "Cuánto de la capacidad externa está ocupado actualmente." },
    { clave: "capacidad_externa_restante", label: "Capacidad externa restante", valor: fmt(el.capacidad_externa_restante, 0), descripcion: "Cupo de la capa externa que todavía queda libre." },
    { clave: "saturacion_externa", label: "Saturación externa", valor: fmt(el.saturacion_externa), proporcion: prop(el.saturacion_externa), descripcion: "Qué tan llena está la capa externa — en 100% determina si el elemento es Noble.", formula: "Saturación externa = ocupación externa / capacidad externa" },

    { clave: "nucleo_catalisis", label: "Catálisis (núcleo)", valor: fmt(el.nucleo_catalisis, 2), descripcion: "Catálisis aportada solo por la capa núcleo." },
    { clave: "media_catalisis", label: "Catálisis (media)", valor: fmt(el.media_catalisis, 2), descripcion: "Catálisis aportada solo por la capa media." },
    { clave: "externa_catalisis", label: "Catálisis (externa)", valor: fmt(el.externa_catalisis, 2), descripcion: "Catálisis aportada solo por la capa externa." },
    { clave: "nucleo_transicion", label: "Transición (núcleo)", valor: fmt(el.nucleo_transicion, 2), descripcion: "Transición aportada solo por la capa núcleo." },
    { clave: "media_transicion", label: "Transición (media)", valor: fmt(el.media_transicion, 2), descripcion: "Transición aportada solo por la capa media." },
    { clave: "externa_transicion", label: "Transición (externa)", valor: fmt(el.externa_transicion, 2), descripcion: "Transición aportada solo por la capa externa." },
    { clave: "nucleo_carga_q", label: "Carga Q (núcleo)", valor: fmt(el.nucleo_carga_q, 2), descripcion: "Carga cuántica aportada solo por la capa núcleo." },
    { clave: "media_carga_q", label: "Carga Q (media)", valor: fmt(el.media_carga_q, 2), descripcion: "Carga cuántica aportada solo por la capa media." },
    { clave: "externa_carga_q", label: "Carga Q (externa)", valor: fmt(el.externa_carga_q, 2), descripcion: "Carga cuántica aportada solo por la capa externa." },

    { clave: "nucleo_particulas_totales", label: "Partículas (núcleo)", valor: fmt(el.nucleo_particulas_totales, 0), descripcion: "Cantidad total de partículas en la capa núcleo." },
    { clave: "media_particulas_totales", label: "Partículas (media)", valor: fmt(el.media_particulas_totales, 0), descripcion: "Cantidad total de partículas en la capa media." },

    { clave: "valencia_fuente", label: "Fuente de valencia", valor: el.valencia_fuente ?? null, descripcion: "De dónde se derivó la valencia estructural (qué regla/capa la determinó)." },
  ];
}

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

/** Estado físico de una sustancia (§ Fase 2 del rediseño 1.0). Null si el
 *  compuesto no forma parte de una familia de estados (ej. Piedra, Metal). */
export type EstadoMateria = "solido" | "liquido" | "gas";

/** Fila cruda tal cual vive en Supabase (tabla "compuestos"). */
export interface Compuesto {
  id: string;
  nombre: string;
  simbolo?: string | null;
  notas?: string | null;
  /** @deprecated La columna "componentes" (jsonb) fue ELIMINADA de la tabla
   *  "compuestos" en Supabase (migración de Materiales del equipo de datos,
   *  ver auditoría 2026-08-26: pedirla en el select rompía CONFIG_COMPUESTOS
   *  con "column componentes does not exist", tumbando useCompuestos()
   *  entero — de ahí el bug reportado de "los datos se muestran al abrir y
   *  después desaparecen"). Ya no existe en la base ni se pide en el
   *  select. El campo queda tipado opcional solo por si algún consumidor
   *  viejo todavía lo referencia — usar useCompuestosConElementos() para
   *  leer composición real y las mutaciones de compuesto_elementos para
   *  escribir. Ver Fase 2. */
  componentes?: ComponenteCompuesto[];
  created_at?: string;
  /** Fila base de la que este compuesto es un estado (ej. Hielo → Agua).
   *  Null si es la sustancia base o si no pertenece a una familia de
   *  estados — ver Fase 2.2 del rediseño 1.0. */
  sustancia_base_id?: string | null;
  /** Estado físico de esta fila. Solo tiene sentido junto a
   *  sustancia_base_id (o en la fila base misma, que suele ser "liquido"). */
  estado?: EstadoMateria | null;

  // ─── Propiedades físicas calculadas (Supabase, solo lectura) ───────────
  // Pobladas/recalculadas automáticamente por triggers en Supabase a partir
  // de compuesto_elementos + elementos + compuesto_enlaces (ver
  // estado_proyecto: "90/90 compuestos pasan auditoría composición
  // elemento→propiedades"). El frontend nunca escribe acá directamente.
  tipo_compuesto?: string | null;
  estado_estructura?: string | null;
  formula_canonica?: string | null;
  masa?: number | null;
  carga?: number | null;
  estabilidad?: number | null;
  rigidez?: number | null;
  flexibilidad?: number | null;
  dureza?: number | null;
  conductividad?: number | null;
  transparencia?: number | null;
  interaccion?: number | null;
  compatibilidad?: number | null;
  energia_enlace?: number | null;
  volumen?: number | null;
  densidad?: number | null;
  clasificacion?: string | null;
  tipo_estructura?: string | null;

  // ─── Resto de columnas reales de Supabase (2026-08-27) ──────────────────
  // Faltaban en el select/tipo pese a existir en la tabla real "compuestos"
  // — ver auditoría de columnas faltantes en elementos/compuestos/materiales.
  updated_at?: string | null;
  estructura?: Record<string, unknown> | null;
  validacion?: Record<string, unknown> | null;
  propiedades_emergentes?: Record<string, unknown> | null;
  auditoria?: Record<string, unknown> | null;
  umbral_estabilidad?: number | null;
  topologia_enlace?: string | null;
  tipo_estructura_derivada?: string | null;
  naturaleza_semantica?: string | null;
  razon_clasificacion?: string | null;
}

export const CONFIG_COMPUESTOS = {
  tabla: "compuestos",
  // "componentes" removido del select (2026-08-26): la columna ya no existe
  // en Supabase (eliminada en la migración de Materiales del equipo de
  // datos). Pedirla hacía fallar el select ENTERO con un 42703 en cada
  // carga — PostgREST no devuelve resultado parcial, así que useCompuestos()
  // fallaba de punta a punta. Ver comentario en Compuesto.componentes.
  //
  // 2026-08-27: agregadas las columnas reales que faltaban (estructura,
  // validacion, propiedades_emergentes, auditoria, umbral_estabilidad,
  // topologia_enlace, tipo_estructura_derivada, naturaleza_semantica,
  // razon_clasificacion, updated_at) — ver auditoría de columnas faltantes.
  select:
    "id, nombre, simbolo, notas, created_at, updated_at, sustancia_base_id, estado, " +
    "tipo_compuesto, estado_estructura, formula_canonica, masa, carga, estabilidad, rigidez, " +
    "flexibilidad, propiedades_emergentes, estructura, validacion, compatibilidad, " +
    "tipo_estructura, energia_enlace, umbral_estabilidad, clasificacion, razon_clasificacion, " +
    "auditoria, topologia_enlace, tipo_estructura_derivada, naturaleza_semantica, dureza, " +
    "conductividad, transparencia, interaccion, volumen, densidad",
};

/** Una propiedad física calculada del Compuesto, lista para renderizar en
 *  la sección de solo lectura de CompuestoEditor — mismo shape que
 *  PropiedadCalculada de Elemento (ver propiedadesCalculadasDeElemento). */
export function propiedadesCalculadasDeCompuesto(c: Compuesto): PropiedadCalculada[] {
  const fmt = (v?: number | null, digitos = 3) =>
    v === null || v === undefined ? null : v.toFixed(digitos);
  const prop = (v?: number | null) =>
    v === null || v === undefined ? undefined : Math.max(0, Math.min(1, v));

  return [
    { clave: "masa", label: "Masa", valor: fmt(c.masa, 2), descripcion: "Cantidad total de masa contenida en el compuesto. Es una magnitud interna, no un índice 0–1.", formula: "Masa = Σ (cantidad × masa base de cada elemento)" },
    { clave: "volumen", label: "Volumen", valor: fmt(c.volumen, 2), descripcion: "Espacio ocupado por el compuesto según su cantidad de partículas y su organización estructural.", formula: "V = V_composición × F_geom" },
    { clave: "densidad", label: "Densidad", valor: fmt(c.densidad, 4), descripcion: "Concentración de masa respecto al volumen ocupado. No es un índice 0–1.", formula: "ρ = M / V" },
    { clave: "carga", label: "Carga", valor: fmt(c.carga, 2), descripcion: "Carga neta del compuesto, suma de la carga de sus elementos.", formula: "Carga = Σ (cantidad × carga de cada elemento)" },
    { clave: "estabilidad", label: "Estabilidad", valor: fmt(c.estabilidad), proporcion: prop(c.estabilidad), descripcion: "Qué tan resistente es el compuesto a romperse o transformarse.", formula: "Estabilidad = propiedad derivada de la composición y estructura del compuesto." },
    { clave: "rigidez", label: "Rigidez", valor: fmt(c.rigidez), proporcion: prop(c.rigidez), descripcion: "Resistencia del compuesto a deformarse bajo fuerza.", formula: "Rigidez = propiedad derivada de la composición y estructura del compuesto." },
    { clave: "flexibilidad", label: "Flexibilidad", valor: fmt(c.flexibilidad), proporcion: prop(c.flexibilidad), descripcion: "Capacidad del compuesto de deformarse sin romperse.", formula: "Flexibilidad = propiedad derivada de la composición y estructura del compuesto." },
    { clave: "dureza", label: "Dureza", valor: fmt(c.dureza), proporcion: prop(c.dureza), descripcion: "Resistencia del compuesto a ser rayado o penetrado.", formula: "Dureza = propiedad derivada de la composición del compuesto." },
    { clave: "conductividad", label: "Conductividad", valor: fmt(c.conductividad), proporcion: prop(c.conductividad), descripcion: "Facilidad del compuesto para transmitir una influencia a través de su estructura.", formula: "Conductividad = propiedad derivada de la capacidad de transmisión de sus componentes." },
    { clave: "transparencia", label: "Transparencia", valor: fmt(c.transparencia), proporcion: prop(c.transparencia), descripcion: "Facilidad con la que una influencia atraviesa el compuesto sin quedar retenida.", formula: "Transparencia = propiedad derivada de la capacidad de paso de sus componentes." },
    { clave: "interaccion", label: "Interacción", valor: fmt(c.interaccion), proporcion: prop(c.interaccion), descripcion: "Facilidad con la que el compuesto se acopla con su entorno.", formula: "Interacción = propiedad derivada de la capacidad de acoplamiento de sus componentes." },
    { clave: "compatibilidad", label: "Compatibilidad", valor: fmt(c.compatibilidad), proporcion: prop(c.compatibilidad), descripcion: "Qué tan compatibles son entre sí los sitios de enlace usados.", formula: "Compatibilidad = función de carga, catálisis, transición, interacción y transformación entre los sitios enlazados" },
    { clave: "energia_enlace", label: "Energía de enlace", valor: fmt(c.energia_enlace, 4), descripcion: "Energía acumulada en los enlaces del compuesto.", formula: "Energía de enlace = Σ (coste energético × intensidad × (1 − reversibilidad)) de cada enlace" },
    { clave: "tipo_compuesto", label: "Tipo", valor: c.tipo_compuesto ?? null, descripcion: "Clasificación estructural (sustancia, mezcla, aleación, material estructural).", formula: "Sin enlace definido → mezcla · con estructura de enlace válida → compuesto" },
    { clave: "clasificacion", label: "Clasificación", valor: c.clasificacion ?? null, descripcion: "Clasificación derivada más específica del compuesto." },
    { clave: "estado_estructura", label: "Estado de estructura", valor: c.estado_estructura ?? null, descripcion: "Qué tan completa/consistente está la definición estructural del compuesto." },

    // ─── Columnas reales en Supabase, traídas en el select pero nunca
    // mostradas hasta ahora (ver auditoría 2026-08-30 "qué propiedades
    // faltan en Compuesto", mismo criterio que ya se aplicó a Elemento).
    // Se excluyen a propósito estructura/validacion/auditoria/
    // propiedades_emergentes: son jsonb de diagnóstico interno, no
    // aplanables a una tarjeta simple sin decidir antes qué mostrar de
    // cada uno.
    { clave: "formula_canonica", label: "Fórmula canónica", valor: c.formula_canonica ?? null, descripcion: "Notación canónica de la composición del compuesto (ej. Fl2Cr)." },
    { clave: "tipo_estructura", label: "Tipo de estructura", valor: c.tipo_estructura ?? null, descripcion: "Clasificación de la arquitectura de enlaces del compuesto." },
    { clave: "tipo_estructura_derivada", label: "Tipo de estructura (derivada)", valor: c.tipo_estructura_derivada ?? null, descripcion: "Tipo de estructura recalculado automáticamente a partir de la composición y enlaces actuales." },
    { clave: "topologia_enlace", label: "Topología de enlace", valor: c.topologia_enlace ?? null, descripcion: "Forma en que se organizan los enlaces entre los elementos del compuesto (ej. lineal, ramificada)." },
    { clave: "naturaleza_semantica", label: "Naturaleza semántica", valor: c.naturaleza_semantica ?? null, descripcion: "Interpretación de qué tipo de sustancia representa el compuesto dentro del canon." },
    { clave: "razon_clasificacion", label: "Razón de clasificación", valor: c.razon_clasificacion ?? null, descripcion: "Motivo/regla por la que Supabase asignó la Clasificación mostrada arriba." },
    { clave: "umbral_estabilidad", label: "Umbral de estabilidad", valor: fmt(c.umbral_estabilidad), proporcion: prop(c.umbral_estabilidad), descripcion: "Estabilidad mínima requerida para que el compuesto se considere formado de manera consistente." },
  ];
}

/** Fila cruda tal cual vive en Supabase (tabla "compuesto_elementos") —
 *  fuente normalizada de la composición, reemplaza a componentes (jsonb)
 *  como fuente de verdad. Ver Fase 2.1 del rediseño 1.0.
 *
 *  proporcion_molar/proporcion_deducida/proporcion_fuente: proporción real
 *  entre los elementos del compuesto (219/219 filas pobladas, ver
 *  estado_proyecto "CERRADO MODELO DE PROPORCIÓN"), solo lectura — derivada
 *  por Supabase, no por cantidad directamente (proporcion_molar puede
 *  diferir de cantidad, ej. Agua: cantidad 4:1 pero proporcion_molar 10:1). */
export interface CompuestoElementoRow {
  id: string;
  compuesto_id: string;
  elemento_id: string;
  cantidad: number;
  proporcion_molar?: number | null;
  proporcion_deducida?: number | null;
  proporcion_fuente?: string | null;
  rol?: string | null;
}

export const CONFIG_COMPUESTO_ELEMENTOS = {
  tabla: "compuesto_elementos",
  select:
    "id, compuesto_id, elemento_id, cantidad, proporcion_molar, proporcion_deducida, proporcion_fuente, rol",
};

// ─── Grupos de Compuestos: conjuntos reutilizables de Compuestos ──────────
// Un Grupo es simplemente "un conjunto reutilizable de compuestos con
// cantidad" — mismo shape que la fórmula de un PlantaOrgano
// ({compuesto_id, cantidad}[]), usado como plantilla genérica copiable
// desde cualquier módulo (botón "Usar grupo").
//
// La tabla "grupos_compuestos" fue eliminada de Supabase — el catálogo
// genérico que vivía ahí se disolvió en tablas propias por dominio
// ("organos", "formaciones", "reacciones"). GrupoCompuesto sigue acá solo
// como SHAPE base (compuestos + cantidad), no como tabla real: lo sigue
// usando GrupoCompuestoPanelFlotante/Reaccion como tipo genérico de
// edición de fórmula donde aplica.
export interface ComponenteGrupoCompuesto {
  compuesto_id: string;
  cantidad: number;
}

/** Shape genérico de "fórmula reutilizable de Compuestos" — YA NO es una
 *  fila real de Supabase (no existe tabla "grupos_compuestos"); sirve solo
 *  como base estructural compartida. */
export interface GrupoCompuesto {
  id: string;
  nombre: string;
  notas: string | null;
  componentes: ComponenteGrupoCompuesto[];
  created_at: string;
  updated_at?: string;
}

// ─── Órganos / Formaciones: catálogo propio, SEPARADO ──────────────────────
// Pasaron por 3 etapas: GrupoCompuesto tipo="organo"/"formacion" → tabla
// unificada "estructuras_ensambladas" → hoy, dos tablas reales separadas
// "organos" y "formaciones", cada una con su propia jerarquía de
// composición debajo (ver Célula/Tejido y Grano/Veta más abajo). Ya NO
// tienen columna `componentes`: un Órgano/Formación es solo catálogo
// (nombre, función, notas) — la fórmula de compuestos vive varios niveles
// más abajo, resuelta vía la tabla puente organo_tejidos/formacion_vetas.
//
// Se vinculan N:N a plantas (planta_organos), minerales
// (mineral_formaciones), items (item_estructura) y criaturas
// (criatura_organos) — todas esas tablas puente siguen usando la columna
// `grupo_compuesto_id` por compatibilidad histórica, aunque hoy apunte a
// organos.id o formaciones.id según el caso (no a una tabla
// "grupos_compuestos", que ya no existe).
//
// Organo y Formacion son estructuralmente idénticos — ambos extienden esta
// base en vez de repetir los campos, así el código compartido (ver
// useEntidadVinculosGrupo.ts, SeccionGruposVinculados.tsx) puede tipar
// contra la base sin recurrir a un tipo unión (`Organo | Formacion`), que
// TypeScript no deja `extends`-ear de forma confiable y termina "perdiendo"
// campos como `id` en el tipo resultante.
export interface EntidadCatalogoGrupoBase {
  id: string;
  nombre: string;
  funcion: string | null;
  notas: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Organo extends EntidadCatalogoGrupoBase {}

export interface Formacion extends EntidadCatalogoGrupoBase {}

export const CONFIG_ORGANOS = {
  tabla: "organos",
  select: "id, nombre, funcion, notas, created_at, updated_at",
};

export const CONFIG_FORMACIONES = {
  tabla: "formaciones",
  select: "id, nombre, funcion, notas, created_at, updated_at",
};

// ─── Células / Tejidos: composición de un Órgano (flora, criaturas) ───────
// Un Órgano no tiene fórmula propia — se arma de Tejidos (organo_tejidos,
// con `proporcion` libre en texto). Migración (ago-2026): la relación
// Tejido→Célula y Célula→Compuesto dejó de ser 1:1 (columnas
// tejidos.celula_id / celulas.compuesto_id, hoy legacy y sin uso) y pasó a
// M:N vía tres tablas puente nuevas, replicando el patrón de organo_tejidos:
//   - tejido_celulas    (tejido_id, celula_id, rol, proporcion)
//   - tejido_compuestos (tejido_id, compuesto_id, rol, proporcion) — matriz
//     extracelular u otro material del tejido que no pasa por una célula.
//   - celula_compuestos (celula_id, compuesto_id, rol, proporcion) — de qué
//     materiales está hecha la célula misma (membrana, citoplasma, etc.).
// Cadena completa:
//   Organo → organo_tejidos → Tejido ─┬─ tejido_celulas ─→ Celula → celula_compuestos → Compuesto
//                                     └─ tejido_compuestos ────────────────────────────→ Compuesto
// Una misma Célula o Tejido puede reutilizarse entre Órganos distintos, y
// ahora también un Tejido puede tener varias Células y varios Compuestos
// de matriz a la vez (antes solo podía apuntar a una única Célula).
export interface Celula {
  id: string;
  nombre: string;
  /** @deprecated Legacy 1:1, sin uso desde la migración a celula_compuestos (M:N). Queda null. */
  compuesto_id?: string | null;
  estructura: unknown;
  funcion: string | null;
  notas: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Tejido {
  id: string;
  nombre: string;
  /** @deprecated Legacy 1:1, sin uso desde la migración a tejido_celulas (M:N). Queda null. */
  celula_id?: string | null;
  estructura: unknown;
  funcion: string | null;
  notas: string | null;
  created_at: string;
  updated_at?: string;
}

/** Fila puente organo_tejidos: vincula un Tejido a un Órgano con una proporción libre. */
export interface OrganoTejido {
  id: string;
  organo_id: string;
  tejido_id: string;
  proporcion: string | null;
  created_at: string;
}

/** Fila puente tejido_celulas: vincula una Célula a un Tejido (M:N), con rol libre (ej. "célula principal"). */
export interface TejidoCelula {
  id: string;
  tejido_id: string;
  celula_id: string;
  rol: string | null;
  proporcion: string | null;
  created_at: string;
}

/** Fila puente tejido_compuestos: material de matriz de un Tejido que no pasa por ninguna Célula. */
export interface TejidoCompuesto {
  id: string;
  tejido_id: string;
  compuesto_id: string;
  rol: string | null;
  proporcion: string | null;
  created_at: string;
}

/** Fila real de la tabla "estructuras": la capa entre Compuesto y Célula
 *  (ej. Diente, Pétalo, Médula Lipídica) — un Compuesto organizado
 *  espacialmente, con propiedades calculadas propias (masa/rigidez/
 *  estabilidad/etc. en propiedades_calculadas, jsonb) derivadas de sus
 *  compuestos vía estructura_compuestos. Mismo patrón calculado que
 *  Elemento/Compuesto: solo lectura desde el frontend. */
export interface Estructura {
  id: string;
  nombre: string;
  tipo: string | null;
  descripcion: string | null;
  funcion: string | null;
  notas: string | null;
  propiedades_calculadas: Record<string, unknown> | null;
  estado_calculo: string | null;
  calculado_at: string | null;
  created_at: string;
  updated_at?: string;
}

export const CONFIG_ESTRUCTURAS = {
  tabla: "estructuras",
  select:
    "id, nombre, tipo, descripcion, funcion, notas, propiedades_calculadas, estado_calculo, calculado_at, created_at, updated_at",
};

/** Fila puente estructura_compuestos: de qué Compuestos está hecha una Estructura (M:N). */
export interface EstructuraCompuesto {
  id: string;
  estructura_id: string;
  compuesto_id: string;
  cantidad: number | null;
  proporcion: number | null;
  unidad: string | null;
  tipo_proporcion: string | null;
  rol: string | null;
  orden: number | null;
  created_at: string;
}

export const CONFIG_ESTRUCTURA_COMPUESTOS = {
  tabla: "estructura_compuestos",
  select:
    "id, estructura_id, compuesto_id, cantidad, proporcion, unidad, tipo_proporcion, rol, orden, created_at",
};

/** Fila puente celula_estructuras: de qué Estructura(s) real(es) está hecha
 *  una Célula — reemplaza a celula_compuestos (ver abajo) como fuente de
 *  verdad desde la migración de estructuras (ago-2026): hoy 12/12 células
 *  tienen exactamente 1 fila acá, cada una apuntando a su Estructura real. */
export interface CelulaEstructura {
  id: string;
  celula_id: string;
  estructura_id: string;
  cantidad: number | null;
  proporcion: number | null;
  rol: string | null;
  orden: number | null;
  created_at: string;
}

export const CONFIG_CELULA_ESTRUCTURAS = {
  tabla: "celula_estructuras",
  select: "id, celula_id, estructura_id, cantidad, proporcion, rol, orden, created_at",
};

/** Fila puente celula_compuestos: de qué Compuestos está hecha una Célula.
 *  @deprecated Legacy — reemplazada por celula_estructuras (ver arriba).
 *  Vacía desde la migración de estructuras (ago-2026): la fuente real de
 *  "de qué está hecha la célula" es ahora Célula → Estructura → Compuesto,
 *  no un vínculo directo Célula → Compuesto. Se conserva el tipo por si
 *  algún dato viejo la vuelve a poblar, pero el frontend ya no la usa
 *  para mostrar composición (ver useCelulaEstructuras). */
export interface CelulaCompuesto {
  id: string;
  celula_id: string;
  compuesto_id: string;
  rol: string | null;
  proporcion: string | null;
  created_at: string;
}

export const CONFIG_CELULAS = {
  tabla: "celulas",
  select: "id, nombre, estructura, funcion, notas, created_at, updated_at",
};

export const CONFIG_TEJIDOS = {
  tabla: "tejidos",
  select: "id, nombre, estructura, funcion, notas, created_at, updated_at",
};

export const CONFIG_TEJIDO_CELULAS = {
  tabla: "tejido_celulas",
  select: "id, tejido_id, celula_id, rol, proporcion, created_at",
};

export const CONFIG_TEJIDO_COMPUESTOS = {
  tabla: "tejido_compuestos",
  select: "id, tejido_id, compuesto_id, rol, proporcion, created_at",
};

export const CONFIG_CELULA_COMPUESTOS = {
  tabla: "celula_compuestos",
  select: "id, celula_id, compuesto_id, rol, proporcion, created_at",
};

// ─── Sistemas / Organismos: techo de la cadena biológica ──────────────────
// Fase 5: Organo → sistema_organos → Sistema → organismo_sistemas → Organismo,
// mismo patrón que organo_tejidos (catálogo simple + tabla puente N:M).
// Diferencia: sistema_organos NO tiene columna `proporcion` (un Sistema es
// una agrupación funcional de Órganos, no una fórmula proporcional como
// Tejido→Célula); organismo_sistemas sí la tiene, igual que organo_tejidos.
export interface Sistema {
  id: string;
  nombre: string;
  descripcion: string | null;
  notas: string | null;
  created_at: string;
  updated_at?: string;
}

/** Organismo — techo de la cadena biológica (Célula→Tejido→Órgano→
 *  Sistema→Organismo). Al crear el catálogo original (Fase 5) se pensó
 *  como catálogo simple sin fórmula propia, pero el schema real (verificado
 *  contra Supabase) YA tiene propiedades_calculadas poblado en las 3 filas
 *  existentes — mismo patrón calculado que Estructura/Compuesto, derivado
 *  de sus Sistemas/Órganos (`fuente` dentro del jsonb indica de cuál).
 *  compuesto_id es legado de un intento anterior 1:1 (mayormente null hoy,
 *  no confundir con la fórmula real que vive en organismo_sistemas). */
export interface Organismo {
  id: string;
  nombre: string;
  descripcion: string | null;
  notas: string | null;
  tipo_organismo: string | null;
  /** @deprecated Legacy, casi siempre null — no es la fórmula real. */
  compuesto_id?: string | null;
  imagen_url: string | null;
  /** Legacy: partes sueltas antes de que organismo_sistemas existiera. */
  componentes: unknown[] | null;
  orden: number | null;
  propiedades_calculadas: Record<string, unknown> | null;
  estado_calculo: string | null;
  calculado_at: string | null;
  created_at: string;
  updated_at?: string;
}

/** Fila puente sistema_organos: vincula un Órgano a un Sistema (M:N), sin proporción. */
export interface SistemaOrgano {
  id: string;
  sistema_id: string;
  organo_id: string;
  created_at: string;
}

/** Fila puente organismo_sistemas: vincula un Sistema a un Organismo, con proporción libre. */
export interface OrganismoSistema {
  id: string;
  organismo_id: string;
  sistema_id: string;
  proporcion: string | null;
  created_at: string;
}

export const CONFIG_SISTEMAS = {
  tabla: "sistemas",
  select: "id, nombre, descripcion, notas, created_at, updated_at",
};

export const CONFIG_ORGANISMOS = {
  tabla: "organismos",
  select:
    "id, nombre, descripcion, notas, tipo_organismo, compuesto_id, imagen_url, componentes, orden, propiedades_calculadas, estado_calculo, calculado_at, created_at, updated_at",
};

export const CONFIG_SISTEMA_ORGANOS = {
  tabla: "sistema_organos",
  select: "id, sistema_id, organo_id, created_at",
};

export const CONFIG_ORGANISMO_SISTEMAS = {
  tabla: "organismo_sistemas",
  select: "id, organismo_id, sistema_id, proporcion, created_at",
};

/** Fila puente criatura_organismos: qué Organismo(s) tiene una Criatura —
 *  techo de la cadena biológica (Célula→Tejido→Órgano→Sistema→Organismo)
 *  aplicado a una Criatura real, no solo al catálogo. A diferencia de
 *  organismo_sistemas, tiene `es_principal` (para distinguir el organismo
 *  base del cuerpo de posibles simbiontes/parásitos vinculados) y
 *  `cantidad` (obligatoria, default numérico en la base) en vez de una
 *  `proporcion` de texto libre. Hueco de datos real al momento de crear
 *  este hook (0 filas en Supabase) — no es solo un hueco de frontend, ver
 *  useCriaturaOrganismos.ts para el detalle. */
export interface CriaturaOrganismo {
  id: string;
  criatura_id: string;
  organismo_id: string;
  rol: string | null;
  cantidad: number;
  es_principal: boolean;
  created_at: string;
}

export const CONFIG_CRIATURA_ORGANISMOS = {
  tabla: "criatura_organismos",
  select: "id, criatura_id, organismo_id, rol, cantidad, es_principal, created_at",
};

// ─── Granos / Vetas: composición de una Formación (minerales) ────────────
// Espejo inerte de Célula/Tejido: Formacion → formacion_vetas → Veta →
// (estructura_componentes) → Grano → (estructura_componentes) → Compuesto.
//
// FASE 4: compuesto_id y grano_id son FK legadas 1:1, YA NO usadas desde el
// frontend (ver useFormacionVetas.ts) — la composición real N:M vive en
// estructura_componentes. Se mantienen en el tipo solo porque la columna
// todavía existe en Supabase (limpieza pendiente para Fase 8); no escribir
// en ellas desde código nuevo.
export interface Grano {
  id: string;
  nombre: string;
  /** @deprecated Fase 4 — usar estructura_componentes (padre=grano, hijo=compuesto). */
  compuesto_id: string | null;
  estructura: unknown;
  funcion: string | null;
  notas: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Veta {
  id: string;
  nombre: string;
  /** @deprecated Fase 4 — usar estructura_componentes (padre=veta, hijo=grano). */
  grano_id: string | null;
  estructura: unknown;
  funcion: string | null;
  notas: string | null;
  created_at: string;
  updated_at?: string;
}

/** Fila puente formacion_vetas: vincula una Veta a una Formación con una proporción libre. */
export interface FormacionVeta {
  id: string;
  formacion_id: string;
  veta_id: string;
  proporcion: string | null;
  created_at: string;
}

export const CONFIG_GRANOS = {
  tabla: "granos",
  select: "id, nombre, compuesto_id, estructura, funcion, notas, created_at, updated_at",
};

export const CONFIG_VETAS = {
  tabla: "vetas",
  select: "id, nombre, grano_id, estructura, funcion, notas, created_at, updated_at",
};

// ─── estructura_componentes: relación N:M genérica de composición ────────
// Reemplaza los FK singulares grano.compuesto_id y veta.grano_id.
// Diseñada para reutilizarse en Fase 7 (unificación transversal) — mismo
// patrón para cualquier "X está compuesto de Y con proporción Z".
// Combinaciones válidas hoy (constraint CHECK en Supabase):
//   padre_tipo='veta'  + hijo_tipo='grano'
//   padre_tipo='grano' + hijo_tipo='compuesto'
// (Formacion<-Veta sigue viviendo en formacion_vetas, no se toca acá.)
export type EstructuraPadreTipo = "veta" | "grano";
export type EstructuraHijoTipo = "grano" | "compuesto";

export interface EstructuraComponente {
  id: string;
  padre_tipo: EstructuraPadreTipo;
  padre_id: string;
  hijo_tipo: EstructuraHijoTipo;
  hijo_id: string;
  cantidad: number | null;
  proporcion: number | null;
  unidad: string | null;
  rol: string | null;
  created_at: string;
}

export const CONFIG_ESTRUCTURA_COMPONENTES = {
  tabla: "estructura_componentes",
  select: "id, padre_tipo, padre_id, hijo_tipo, hijo_id, cantidad, proporcion, unidad, rol, created_at",
};

// ─── Procesos/Reacciones: recetas reutilizables de consume/produce ────────
// Catálogo propio (tabla real "reacciones", separada de
// "grupos_compuestos") con nombre + consume[] + produce[] + descripción +
// activador — mismo shape que PlantaProceso/MineralProceso. Procesos
// (Biología/Flora/Minerales) y Habilidades (Items) son a propósito EL MISMO
// catálogo — editar una Reacción acá actualiza todos los lugares que la
// usan, sea planta, mineral o item.
export interface EntradaReaccion {
  tipo: "elemento" | "compuesto";
  id: string;
  cantidad: number;
}

/** Fila cruda tal cual vive en Supabase (tabla "reacciones"). */
export interface Reaccion {
  id: string;
  nombre: string;
  consume: EntradaReaccion[];
  produce: EntradaReaccion[];
  descripcion: string | null;
  activador?: string | null;
  created_at: string;
  updated_at?: string;
}

export const CONFIG_REACCIONES = {
  tabla: "reacciones",
  // consume/produce dejaron de persistirse como JSONB en Fase 6.
  // Se reconstruyen desde reaccion_componentes por useReacciones().
  select: "id, nombre, descripcion, activador, created_at, updated_at",
};

export interface ReaccionComponenteRow {
  id: string;
  reaccion_id: string;
  entidad_tipo: "elemento" | "compuesto";
  entidad_id: string;
  direccion: "reactivo" | "producto";
  cantidad: number;
  created_at: string;
}

export interface Proceso {
  id: string;
  nombre: string;
  tipo: string | null;
  descripcion: string | null;
  condiciones: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  /** Columnas reales de "procesos" que faltaban en tipo/select (2026-08-27,
   *  ver auditoría de columnas faltantes) — describen la receta
   *  entrada→transformación→salida del proceso en lenguaje natural. */
  regla_clave: string | null;
  entrada: string | null;
  transformacion: string | null;
  salida: string | null;
  conservacion: string | null;
  estado_fundamento: string | null;
}

export interface ProcesoReaccion {
  id: string;
  proceso_id: string;
  reaccion_id: string;
  orden: number | null;
  rol: string | null;
  created_at: string;
}

export interface Fenomeno {
  id: string;
  nombre: string;
  simbolo: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface FenomenoProceso {
  id: string;
  fenomeno_id: string;
  proceso_id: string;
  rol: string | null;
  created_at: string;
}

export interface FenomenoElemento {
  id: string;
  fenomeno_id: string;
  elemento_id: string;
  cantidad: number;
  rol: string | null;
  created_at: string;
}

export const CONFIG_PROCESOS = {
  tabla: "procesos",
  // 2026-08-27: agregadas las columnas reales que faltaban (regla_clave,
  // entrada, transformacion, salida, conservacion, estado_fundamento) —
  // ver auditoría de columnas faltantes en elementos/compuestos/materiales.
  select:
    "id, nombre, tipo, descripcion, condiciones, notas, created_at, updated_at, " +
    "regla_clave, entrada, transformacion, salida, conservacion, estado_fundamento",
};

export const CONFIG_FENOMENOS = {
  tabla: "fenomenos",
  select: "id, nombre, simbolo, notas, created_at, updated_at",
};

export const CONFIG_PROCESO_REACCIONES = {
  tabla: "proceso_reacciones",
  select: "id, proceso_id, reaccion_id, orden, rol, created_at",
};

export const CONFIG_FENOMENO_PROCESOS = {
  tabla: "fenomeno_procesos",
  select: "id, fenomeno_id, proceso_id, rol, created_at",
};

export const CONFIG_FENOMENO_ELEMENTOS = {
  tabla: "fenomeno_elementos",
  select: "id, fenomeno_id, elemento_id, cantidad, rol, created_at",
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
