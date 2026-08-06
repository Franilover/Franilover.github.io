"use client";

/**
 * useLectorStore (Zustand)
 * ───────────────────────────────────────────────────────────────────────────
 * Estado de navegación del Lector: qué libro/capítulo está activo, la lista
 * de capítulos ya cargados, y el título mostrado en la barra superior.
 *
 * IMPORTANTE — un solo libro/capítulo activo a la vez: este NO es un store de
 * "sesiones abiertas" ni tabs (a diferencia de useMundoNavigationStore). El
 * Lector muestra un capítulo por vez con una barra lateral de índice; no hay
 * multi-libro simultáneo. Por eso no hay keying por libroId ni arrays de
 * pestañas — solo el estado del libro que se está leyendo ahora mismo.
 *
 * Requisito: zustand ya está instalado y en uso en otras partes de
 * editorGarlia (ver useMundoNavigationStore, useFavoritosStore, etc.).
 *
 * NO persiste: es estado de sesión de lectura, no preferencias del usuario.
 * Reemplaza los ~8 useState de leerLibro.tsx (capId, capitulos, loading,
 * esExtra, activeCapTitle, slugCanonico, listaCapitulos, showSidebar) por un
 * único store con selectores granulares, para que un cambio de campo (ej.
 * activeCapTitle en el observer de scroll) no re-renderice todo el árbol del
 * Lector (PanelLateral, BarraProgresoVertical, etc.) — solo los componentes
 * que de verdad leen ese campo.
 *
 * ─── `capitulos` es LIVIANO (sin `contenido`) ─────────────────────────────
 * IMPORTANTE — `capitulos` (y por ende `CapituloScrollItem`) NO trae
 * `contenido`. Es solo metadata (id, orden, título, ids de entidades, etc.)
 * para armar el índice, navegar anterior/siguiente y precargar los mapas de
 * entidades del libro entero. Se arma con un único `select` liviano de TODOS
 * los capítulos del libro.
 *
 * El texto de cada capítulo vive aparte, en `contenidoPorCapId` — un mapa
 * `capId -> contenido` que se va llenando bajo demanda (un fetch puntual por
 * capítulo, solo cuando el lector lo abre, o se prefetchea el siguiente), no
 * de una sola vez para todo el libro. Antes `capitulos` traía el `contenido`
 * de los N capítulos en un solo fetch — para un libro largo eso eran decenas
 * de miles de palabras descargadas y guardadas en memoria/Dexie solo para
 * mostrar una. Ver `cargarContenidoCap` en leerLibro.tsx para el fetch
 * puntual por capítulo.
 *
 * Uso en componentes — seleccioná solo lo que necesitás:
 *
 *   const capId = useLectorStore((s) => s.capId);
 *   const setCapId = useLectorStore((s) => s.setCapId);
 *
 * en vez de:
 *
 *   const { capId, setCapId } = useLectorStore(); // ❌ re-renderiza siempre
 */

import { create } from "zustand";

import type {
  CapituloLista,
  CapituloScrollItem,
} from "@/domains/garlia/libros/capitulos/types";

interface LectorState {
  /** UUID interno del libro resuelto (puede diferir del slug si vino un UUID legacy). */
  libroId: string;
  /** Slug canónico del libro (se puede corregir tras resolver mayúsculas/acentos). */
  slugCanonico: string;
  /** true si es poemario/extra: sin navegación lineal anterior/siguiente. */
  esExtra: boolean;

  /** Capítulos del libro activo — LIVIANOS, sin `contenido` (ver nota de
   *  arriba). Ordenados por `orden`. Usado para índice, navegación y mapas
   *  de entidades. */
  capitulos: CapituloScrollItem[];
  /** Versión liviana (sin contenido) usada por el índice/selector. Hoy es
   *  redundante con `capitulos` (que ya no trae contenido), se mantiene por
   *  compatibilidad con quien ya la consuma. */
  listaCapitulos: CapituloLista[];

  /** Texto completo de cada capítulo, cargado bajo demanda. Clave: capId.
   *  Un capítulo puede estar en `capitulos` (metadata) sin estar acá
   *  todavía — el componente debe mostrar un estado de carga hasta que
   *  aparezca su entrada. */
  contenidoPorCapId: Record<string, string>;
  /** Ids de capítulo cuyo fetch de contenido está en vuelo — evita disparar
   *  el mismo fetch dos veces (ej. prefetch + apertura manual casi
   *  simultáneos). */
  cargandoContenidoIds: Record<string, boolean>;

  /** ID del capítulo actualmente activo/visible. */
  capId: string;
  /** Título mostrado en la barra superior — se actualiza por IntersectionObserver al scrollear. */
  activeCapTitle: string | null;

  /** true mientras se resuelve el libro + primera carga de capítulos. NO se
   *  vuelve a poner en true al cambiar de capítulo — solo al cambiar de libro. */
  loading: boolean;
  error: string | null;

  /** Drawer lateral en móvil. */
  showSidebar: boolean;

  // ── Acciones ────────────────────────────────────────────────────────────
  /** Resetea todo el estado al entrar a un libro distinto (nuevo slugParam). */
  resetLibro: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  /** Aplica el resultado de resolver el libro (Dexie o Supabase) de una sola vez. */
  setLibroResuelto: (payload: {
    libroId: string;
    slugCanonico: string;
    esExtra: boolean;
  }) => void;
  /** Reemplaza la lista completa de capítulos (llega de Dexie-first o de Supabase fresco). */
  setCapitulos: (
    capitulos: CapituloScrollItem[],
    listaCapitulos: CapituloLista[],
  ) => void;
  /** Cambia el capítulo activo — NO toca loading ni capitulos, por eso es
   *  instantáneo y no hace parpadear el índice/paneles. */
  setCapId: (capId: string) => void;
  setActiveCapTitle: (titulo: string | null) => void;
  setShowSidebar: (show: boolean) => void;

  /** Guarda el contenido ya cargado de un capítulo (fetch puntual o Dexie). */
  setContenidoCap: (capId: string, contenido: string) => void;
  /** Precarga varios de una — usado al hidratar desde Dexie al abrir el libro. */
  setContenidoCapBatch: (entries: Record<string, string>) => void;
  setCargandoContenido: (capId: string, cargando: boolean) => void;
}

const initialState = {
  libroId: "",
  slugCanonico: "",
  esExtra: false,
  capitulos: [] as CapituloScrollItem[],
  listaCapitulos: [] as CapituloLista[],
  contenidoPorCapId: {} as Record<string, string>,
  cargandoContenidoIds: {} as Record<string, boolean>,
  capId: "",
  activeCapTitle: null as string | null,
  loading: true,
  error: null as string | null,
  showSidebar: false,
};

export const useLectorStore = create<LectorState>()((set) => ({
  ...initialState,

  resetLibro: () => set({ ...initialState }),

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  setLibroResuelto: ({ libroId, slugCanonico, esExtra }) =>
    set({ libroId, slugCanonico, esExtra }),

  setCapitulos: (capitulos, listaCapitulos) =>
    set({ capitulos, listaCapitulos }),

  setCapId: (capId) => set({ capId }),

  setActiveCapTitle: (activeCapTitle) => set({ activeCapTitle }),

  setShowSidebar: (showSidebar) => set({ showSidebar }),

  setContenidoCap: (capId, contenido) =>
    set((state) => ({
      contenidoPorCapId: { ...state.contenidoPorCapId, [capId]: contenido },
      cargandoContenidoIds: { ...state.cargandoContenidoIds, [capId]: false },
    })),

  setContenidoCapBatch: (entries) =>
    set((state) => ({
      contenidoPorCapId: { ...state.contenidoPorCapId, ...entries },
    })),

  setCargandoContenido: (capId, cargando) =>
    set((state) => ({
      cargandoContenidoIds: { ...state.cargandoContenidoIds, [capId]: cargando },
    })),
}));

// ── Selectores derivados ────────────────────────────────────────────────────
// Fuera del store (no se recalculan en cada set; el componente los deriva
// con su propio useMemo si hace falta), pero se exportan acá para no
// duplicar la lógica de "buscar por orden" en cada componente.

export function capActualDe(
  capitulos: CapituloScrollItem[],
  capId: string,
): CapituloScrollItem | null {
  return capitulos.find((c) => c.id === capId) ?? null;
}

export function capVecino(
  capitulos: CapituloScrollItem[],
  ordenActual: number,
  delta: 1 | -1,
): CapituloScrollItem | null {
  return capitulos.find((c) => c.orden === ordenActual + delta) ?? null;
}
