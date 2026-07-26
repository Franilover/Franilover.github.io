"use client";

import { AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronDown,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
  Check,
  Eye,
  Minimize2,
  Hash,
  Calendar,
  BookMarked,
  Pencil,
  Lock,
  SlidersHorizontal,
  Globe,
  Timer,
  PanelRight,
  AlignLeft,
  TriangleAlert,
  MapPin,
  Waypoints,
  Ban,
  GripVertical,
  History,
} from "lucide-react";
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";

import type { SnippetEditRequest } from "@/components/forms/lexical-editor";
import { RichEditor ,
  type RichEditorFormatCommand,
  dropPayloadToRaw,
  soundPayloadToRaw,
  imgPayloadToRaw,
  choicePayloadToRaw,
  parseUsePayloadToRaw,
  condicionPayloadToRaw,
  sectionPayloadToRaw,
} from "@/components/forms/lexical-editor";
import type {
  Libro,
  Capitulo,
  SaveStatus} from "@/components/forms/lexical-editor/types";
import {
  VISIBILIDAD_CONFIG,
  toDateInput,
  wordCount,
  capUpdateContenido,
  capUpdateMeta,
  capCreate,
  capDelete,
  capGuardarVersion,
  libroUpdateMeta,
  libroDelete,
} from "@/components/forms/lexical-editor/types";
import type {
  CommandItem as MdCommandItem,
  SnippetAction,
} from "@/components/forms/Markdown/commandItems";
import {
  PROSE_STYLES,
} from "@/components/forms/Markdown/proseStyles";
import {
  BannerOffline,
  ModalBase,
  SaveIndicator,
  CampoInput,
  BotonSubmit,
} from "@/components/layout/EstudioTemplates";
import { type ComboItem } from "@/components/ui/ComboSelector";
import { useConfirm } from "@/components/ui/ConfirmModal";
import { MotionDiv } from "@/components/ui/Motion";
import {
  EstadisticasEscritura,
  VisibilidadCapPicker,
  SelectorVisibilidad,
  SelectorNarrador,
  SelectorReino,
  SelectorPersonajesCapitulo,
  SelectorImagenPortada,
  PanelPersonajesCapitulo,
} from "@/features/editorGarlia/components/libros";
import {
  useCapituloEditor,
  useChapterGraph,
  usePosicionesNodos,
  useCapituloVersiones,
} from "@/features/editorGarlia/hooks/capitulos/useCapitulosEditor";
import {
  EntidadesLoreProvider,
  useEntidadesLore,
} from "@/features/editorGarlia/context/EntidadesLoreContext";
import {
  insertChoiceAtEndOfSection,
  type StoryGraph,
} from "@/features/editorGarlia/hooks/capitulos/storyGraph";
import { NodeGraphCanvas } from "@/features/editorGarlia/components/libros/NodeGraphCanvas";
import { SnippetCommandPalette } from "@/features/editorGarlia/components/libros/snippets/SnippetCommandPalette";
// SnippetOverlay eliminado — reemplazado por nodos Lexical reales
import { ContenidoInteractivo } from "@/features/garlia/components/ContenidoInteractivo";
import { isReallyOnline } from "@/hooks/data/useOfflineSync";
import { useSupabaseData } from "@/hooks/data/useSupabaseData";
import {
  useLastOpenedId,
  useDraftRestore,
  DraftRestoreBanner,
  useDebouncedValue,
} from "@/hooks/useEditorShared";
import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";

// ─── Dialog commands ──────────────────────────────────────────────────────────

const DIALOG_COMMANDS: MdCommandItem[] = [
  {
    id: "dial-guion",
    label: "Guión de diálogo",
    description: "— (inicia línea de diálogo)",
    keywords: ["dial", "guion", "—", "add"],
    icon: "—",
    snippet: "— ",
  },
  {
    id: "dial-acotac",
    label: "Acotación entre guiones",
    description: "— … — (acotación narrativa)",
    keywords: ["acot", "dial", "—", "add"],
    icon: "—…—",
    snippet: "— … —",
  },
  {
    id: "dial-comillas",
    label: "Comillas angulares «»",
    description: "«texto» (estilo literario)",
    keywords: ["comi", "angul", "«»", "add"],
    icon: "«»",
    snippet: "«»",
    cursorOffset: 1,
  },
  {
    id: "dial-linea",
    label: "Línea de diálogo completa",
    description: "— (línea entera lista para escribir)",
    keywords: ["linea", "línea", "dial", "add"],
    icon: "—…",
    snippet: "— ",
  },
  {
    id: "dial-puntos",
    label: "Puntos suspensivos",
    description: "… (suspensivos tipográficos)",
    keywords: ["punt", "susp", "…", "add"],
    icon: "…",
    snippet: "…",
  },
  {
    id: "dial-endash",
    label: "Guión corto (en-dash)",
    description: "– (en-dash tipográfico)",
    keywords: ["endash", "corto", "–", "add"],
    icon: "–",
    snippet: "–",
  },
];

// ─── PanelEditor ──────────────────────────────────────────────────────────────

const PanelEditor = ({
  capId,
  libroId,
  onCapitulosChange,
  focusMode,
  onToggleFocus,
  sidebarOpen,
  onToggleSidebar,
}: {
  capId: string;
  libroId: string;
  onCapitulosChange: () => void;
  focusMode: boolean;
  onToggleFocus: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) => {
  const { cap, setCap, loading, isOffline, reload: _reload } = useCapituloEditor(capId);

  // ─── Derived state para contenido ────────────────────────────────────────────
  // Usar useEffect para inicializar contenido provoca un flash inevitable:
  // React pinta el editor vacío, ejecuta el effect, y pinta de nuevo con texto.
  // Con derived state dentro del render, React descarta el render intermedio
  // y pinta directamente con el valor correcto — cero frame vacío.
  //
  // Guardamos el capId que usamos para inicializar los campos de metadata;
  // cuando cambia de capítulo reseteamos todo sincrónicamente.
  const [initializedCapId, setInitializedCapId] = useState<string | null>(null);
  const [contenido, setContenido] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [editingFecha, setEditingFecha] = useState(false);
  const [fecha, setFecha] = useState("");
  const [capVisibilidad, setCapVisibilidad] = useState<
    "publico" | "programado" | "oculto"
  >("oculto");
  const [savingMeta, setSavingMeta] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [personajesIds, setPersonajesIds] = useState<string[]>([]);
  const [criaturasIds, setCriaturasIds] = useState<string[]>([]);
  const [itemsIds, setItemsIds] = useState<string[]>([]);
  const [listaSnippetCaps, setListaSnippetCaps] = useState<
    { id: string; orden: number; titulo_capitulo: string }[]
  >([]);
  // Fase 1 del rediseño Choice/Gate: listaSecciones ahora se deriva del grafo
  // narrativo completo (storyGraph.ts) en vez de un regex suelto acá. Se
  // mantiene la misma forma { id, label }[] que ya consumía FormChoice para
  // no romper nada; `chapterGraph` completo (con huérfanas/rotas) queda
  // disponible para cuando se conecte el panel visual (Fase 3).
  // Debounced: el grafo narrativo (regex sobre todo el texto) y el detector
  // de menciones son cálculos que no necesitan correr en cada tecla — solo
  // cuando el usuario deja de tipear un rato. `contenido` crudo sigue yendo
  // directo al RichEditor, así que la escritura no se siente con lag.
  const contenidoDebounced = useDebouncedValue(contenido, 400);
  const chapterGraph = useChapterGraph(capId, titulo, contenidoDebounced);
  const listaSecciones = useMemo(
    () =>
      chapterGraph.nodes
        .filter((n) => n.kind === "section")
        .map((n) => ({ id: n.id, label: n.label })),
    [chapterGraph],
  );
  const [palette, setPalette] = useState<{
    anchorRect: { top: number; left: number };
    initialRaw?: string;
    initialQuery?: string;
  } | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Fase 2 del rediseño Choice/Gate: toggle "Escribir / Grafo nodo" en el
  // panel central. En modo grafo se reemplaza el RichEditor por dos
  // sub-vistas: "problemas" (huérfanas + links rotos) y "canvas" (Fase 3:
  // editor visual interactivo, nodos arrastrables + drag-to-connect).
  const [vistaEditor, setVistaEditor] = useState<"escribir" | "grafo">(
    "escribir",
  );
  const [vistaGrafo, setVistaGrafo] = useState<"problemas" | "canvas">(
    "canvas",
  );
  const { posiciones, setPos } = usePosicionesNodos(capId);
  const timer = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mdInsertRef = useRef<((raw: string) => void) | null>(null);
  // Ref imperativo de RichEditor para aplicar comandos de formato de
  // bloque (ej. "align-right") desde el menú "/" — ver directAction en
  // SnippetCommandPalette/CATS.
  const formatCommandRef = useRef<
    ((commandId: RichEditorFormatCommand) => void) | null
  >(null);
  const closePaletteRef = useRef<(() => void) | null>(null);
  const pendingReplaceRef = useRef<((next: string) => void) | null>(null);
  const pendingSnippetRawRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  // ── Capa de seguridad anti-pérdida-de-contenido ─────────────────────────
  // Bug que resuelve: RichEditor puede montar/emitir onChange ANTES de que
  // `cap` haya llegado de useCapituloEditor (Dexie/Supabase todavía en
  // vuelo). Si eso pasa, un onChange("") disparado por el propio ciclo de
  // vida de Lexical al inicializar arrancaba el debounce de guardado con
  // un contenido vacío, y 2s después doSave("") pisaba el capítulo real en
  // el servidor con string vacío — pérdida total del capítulo.
  //
  // lastLoadedCapIdRef: el capId para el cual YA terminamos de inicializar
  // `contenido` desde `cap` (ver el bloque de inicialización síncrona más
  // abajo). Mientras el capId actual no coincida con este ref, CUALQUIER
  // onChange/doSave se ignora — no hay forma de que un guardado dispare
  // sin datos reales cargados primero.
  const lastLoadedCapIdRef = useRef<string | null>(null);
  // lastNonEmptyContentRef: última versión NO vacía de contenido que
  // sabemos que es real (vino de `cap` o de un guardado exitoso). Es la
  // segunda red de seguridad: incluso con el capítulo ya inicializado, si
  // en algún punto llega un onChange("") mientras el contenido conocido
  // NO estaba vacío, lo tratamos como sospechoso (ver doSave) en vez de
  // guardarlo ciegamente.
  const lastNonEmptyContentRef = useRef<string>("");
  const { confirm, ConfirmModal } = useConfirm();
  const { versiones, loading: loadingVersiones, reload: reloadVersiones } =
    useCapituloVersiones(capId);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  // Throttle de snapshots: un guardado exitoso dispara un snapshot solo si
  // pasaron al menos 5 minutos desde el último, para no llenar el historial
  // con una entrada cada vez que el debounce de 2s del editor guarda mientras
  // el usuario tipea sin parar. Igual queda un registro cada guardado real
  // si el usuario deja de escribir y vuelve más tarde.
  const lastSnapshotAtRef = useRef<number>(0);
  const SNAPSHOT_MIN_INTERVAL_MS = 5 * 60_000;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  const draft = useDraftRestore({
    key: `cap-draft-${capId}`,
    serverValue: cap?.contenido || "",
    enabled: !!capId && !loading,
  });

  // Inicialización sincrónica al montar o cambiar de capítulo.
  // Al llamar setState durante el render (con guard), React re-renderiza
  // inmediatamente antes de pintar — sin frame intermedio vacío.
  if (cap && cap.id !== initializedCapId) {
    setInitializedCapId(cap.id);
    setContenido(cap.contenido || "");
    setTitulo(cap.titulo_capitulo || "");
    setFecha(toDateInput(cap.fecha_publicacion));
    setCapVisibilidad(cap.visibilidad ?? "oculto");
    setPersonajesIds(cap.personajes_ids ?? []);
    setCriaturasIds((cap as any).criaturas_ids ?? []);
    setItemsIds((cap as any).items_ids ?? []);
    setSaveStatus((cap as any).status === "pending" ? "pending" : "idle");
    // Recién ACÁ el capítulo tiene datos reales cargados — desbloqueamos
    // onChange/doSave para este capId. Cualquier evento emitido antes de
    // esta línea (por ejemplo por RichEditor montando/reconciliando su
    // árbol Lexical mientras `cap` todavía era null) ya fue descartado
    // por el guard en onChange, así que no hay nada que "recuperar" acá.
    lastLoadedCapIdRef.current = cap.id;
    if (cap.contenido) lastNonEmptyContentRef.current = cap.contenido;
  }

  // Cuando el hook refresca cap con datos remotos (mismo id, Supabase llega
  // después de Dexie), actualizar contenido solo si no hay un pending local.
  // Se sigue usando useEffect aquí porque NO es inicialización: el editor ya
  // está visible con datos correctos y solo estamos aplicando un refresh.
  useEffect(() => {
    if (!cap || cap.id !== initializedCapId) return;
    if ((cap as any).status === "pending") return; // no pisar borrador local
    setContenido(cap.contenido || "");
    setTitulo(cap.titulo_capitulo || "");
    setCapVisibilidad(cap.visibilidad ?? "oculto");
    if (cap.contenido) lastNonEmptyContentRef.current = cap.contenido;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cap]);

  useEffect(() => {
    if (!libroId) return;
    supabase
      .from("capitulos")
      .select("id, orden, titulo_capitulo")
      .eq("libro_id", libroId)
      .order("orden")
      .then(({ data }) => {
        setListaSnippetCaps(
          (data ?? []) as {
            id: string;
            orden: number;
            titulo_capitulo: string;
          }[],
        );
      });
  }, [libroId]);

  // Auto-resize eliminado — Lexical maneja el resize internamente

  // centerCursor eliminado — usaba textareaRef/caretMirrorRef del textarea.
  // Lexical maneja el scroll al cursor internamente.
  const centerCursor = useCallback(() => {
    // no-op: mantenido para no romper la referencia en onChange
  }, []);

  // FIX 1: optimistic update del estado React con objeto completo antes del
  // fetch. capUpdateContenido (types.ts) maneja internamente Dexie + enqueue,
  // por lo que no se construyen objetos Capitulo parciales aquí.
  const doSave = useCallback(
    async (val: string) => {
      clearTimeout(timer.current);
      if (!isMountedRef.current) return;

      // GUARD 1: el capítulo todavía no terminó de cargar sus datos reales
      // para este capId. Guardar acá sería escribir sobre un capítulo del
      // que ni siquiera tenemos el contenido real todavía.
      if (lastLoadedCapIdRef.current !== capId) {
        console.warn(
          "[doSave] Bloqueado: capítulo aún no inicializado, se descarta el guardado para evitar pérdida de datos.",
          { capId },
        );
        return;
      }

      // GUARD 2: contenido vacío que reemplazaría contenido previo NO
      // vacío es la firma exacta del bug de carga-lenta-borra-todo. No lo
      // bloqueamos silenciosamente (el usuario puede legítimamente querer
      // vaciar el capítulo) — lo dejamos pasar solo si coincide con un
      // vaciado deliberado detectable, y si no, preservamos el draft local
      // y avisamos en vez de perder el contenido remoto.
      const looksLikeAccidentalWipe =
        val.trim() === "" && lastNonEmptyContentRef.current.trim() !== "";
      if (looksLikeAccidentalWipe) {
        console.warn(
          "[doSave] Bloqueado: se intentó guardar contenido vacío sobre un capítulo con contenido previo. Draft local preservado, no se sobreescribió el servidor.",
          { capId },
        );
        // Mantenemos el draft (IndexedDB local) para no perder lo que sea
        // que el usuario tenga en pantalla, pero NO tocamos el servidor.
        draft.save(val);
        setSaveStatus("pending");
        return;
      }

      setSaveStatus("saving");
      draft.save(val);

      // Optimistic update con objeto completo del estado (sin ir a Dexie)
      setCap((prev) =>
        prev ? { ...prev, contenido: val, status: "pending" } : prev,
      );

      try {
        // capUpdateContenido se encarga de:
        //   - isReallyOnline()
        //   - dexieCapWrite con objeto completo (lee existing de Dexie)
        //   - enqueueOperation si está offline o falla
        //   - marcar "synced" si el servidor confirma
        await capUpdateContenido(capId, val);
        if (!isMountedRef.current) return;
        setCap((prev) =>
          prev ? { ...prev, contenido: val, status: "synced" } : prev,
        );
        if (val.trim() !== "") lastNonEmptyContentRef.current = val;
        draft.clear();
        // Snapshot de versión: solo si pasaron 5+ min desde el último, para
        // no llenar el historial con una entrada por cada auto-guardado
        // mientras el usuario tipea sin parar. best-effort — un fallo acá
        // nunca debe afectar el guardado principal, que ya se confirmó.
        const now = Date.now();
        if (now - lastSnapshotAtRef.current >= SNAPSHOT_MIN_INTERVAL_MS) {
          lastSnapshotAtRef.current = now;
          void capGuardarVersion(capId, val).catch(() => {});
        }
        const stillOnline = await isReallyOnline();
        setSaveStatus(stillOnline ? "saved" : "pending");
        if (stillOnline)
          setTimeout(() => {
            if (isMountedRef.current) setSaveStatus("idle");
          }, 2500);
      } catch {
        if (!isMountedRef.current) return;
        // capUpdateContenido ya dejó el pending en Dexie + encolado para sync
        setSaveStatus("pending");
        setTimeout(() => {
          if (isMountedRef.current)
            setSaveStatus((s) => (s === "pending" ? "idle" : s));
        }, 5000);
      }
    },
    [capId, setCap, draft, titulo],
  );

  const onChange = useCallback(
    (val: string) => {
      // GUARD: mismo criterio que en doSave — si el capítulo activo
      // todavía no cargó datos reales, ignoramos el evento por completo.
      // Esto corta el problema en la raíz: ni siquiera actualizamos
      // `contenido` en React con un valor "fantasma" que no corresponde
      // al capítulo real, así que no hay nada que el debounce pueda
      // guardar mal más adelante.
      if (lastLoadedCapIdRef.current !== capId) {
        console.warn("[onChange] Ignorado: capítulo aún no inicializado.", {
          capId,
        });
        return;
      }
      setContenido(val);
      draft.save(val);
      setSaveStatus("saving");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => doSave(val), 2000);
      const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
      if (!isTouchDevice) requestAnimationFrame(() => centerCursor());
    },
    [doSave, draft, centerCursor, capId],
  );

  // Fase 3 del rediseño Choice/Gate: dispara al soltar un drag-to-connect en
  // NodeGraphCanvas. Agrega un [[choice]] al final de la sección origen —
  // nunca reescribe texto existente. `label` genérico porque el autor puede
  // (y probablemente va a querer) editarlo después desde el chip inline,
  // que ya soporta edición vía FormChoice.
  const handleGraphConnect = useCallback(
    (fromNodeId: string, toNodeId: string) => {
      if (!capId) return;
      const nuevoContenido = insertChoiceAtEndOfSection(
        contenido,
        fromNodeId,
        capId,
        "Continuar…",
        toNodeId,
      );
      onChange(nuevoContenido);
    },
    [capId, contenido, onChange],
  );

  const _handleSnippetAction = useCallback(
    (action: SnippetAction) => {
      switch (action.type) {
        case "choice": {
          const cap = listaSnippetCaps.find((c) => c.id === action.target);
          if (cap) {
            window.dispatchEvent(
              new CustomEvent("snippet:navigate-cap", {
                detail: { capId: action.target },
              }),
            );
          } else {
            const el = document.getElementById(`section-${action.target}`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          break;
        }
        case "section": {
          const el = document.getElementById(`section-${action.id}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("snip-section--highlight");
            setTimeout(
              () => el.classList.remove("snip-section--highlight"),
              1200,
            );
          }
          break;
        }
        default:
          break;
      }
    },
    [listaSnippetCaps],
  );

  const openPalette = useCallback(
    (
      initialRaw?: string,
      anchorRect?: { top: number; left: number },
      initialQuery?: string,
    ) => {
      // Con Lexical ya no hay textarea ni caret que medir —
      // si no nos pasan un anchorRect real (ej. desde "/" en RichEditor),
      // la palette se ancla a una posición fija centrada.
      setPalette({
        anchorRect: anchorRect ?? { top: 200, left: 300 },
        initialRaw,
        initialQuery,
      });
    },
    [],
  );

  // Refs con el último valor de "palette" para comparar sin generar
  // dependencias inestables — evita que handleOpenPaletteFromSlash cambie
  // de identidad en cada render (lo que reiniciaría el listener del
  // plugin de Lexical y podía disparar un loop de renders/foco perdido).
  const paletteRef = useRef(palette);
  paletteRef.current = palette;

  const handleOpenPaletteFromSlash = useCallback(
    (anchorRect: { top: number; left: number }, query: string) => {
      const current = paletteRef.current;
      // Si ya está abierta con el mismo query, no volvemos a setState:
      // registerUpdateListener de Lexical dispara en CADA cambio del
      // editor, y sin este guard, cada render de EditorCapitulos volvía
      // a re-montar el plugin y a re-evaluar el match → loop infinito.
      if (
        current &&
        current.initialQuery === query &&
        current.anchorRect.top === anchorRect.top &&
        current.anchorRect.left === anchorRect.left
      ) {
        return;
      }
      setPalette({ anchorRect, initialRaw: undefined, initialQuery: query });
    },
    [],
  );

  const handleClosePalette = useCallback(() => {
    setPalette((prev) => (prev ? null : prev));
  }, []);

  // Preview de RichEditor: usa ContenidoInteractivo, el MISMO componente
  // que el lector real (CapituloScrollBlock), para que "Preview"/"Split"
  // muestre [[drop|...]], [[choice|...]], etc. ya resueltos en vez del
  // raw literal (antes usaba renderMarkdown, que no entiende ese formato).
  // onNavigate es no-op: dentro del editor no tiene sentido saltar de
  // capítulo/sección al hacer click en un choice/use del preview.
  const renderChapterPreview = useCallback(
    (raw: string) => <ContenidoInteractivo texto={raw} onNavigate={() => {}} />,
    [],
  );

  // Helper: convierte payload de un nodo editado → raw [[kind|...]]
  // para pasárselo a SnippetCommandPalette como initialRaw
  const snippetPayloadToRaw = useCallback(
    (kind: string, payload: any): string => {
      switch (kind) {
        case "drop":
          return dropPayloadToRaw(payload);
        case "sound":
          return soundPayloadToRaw(payload);
        case "img":
        case "float":
          return imgPayloadToRaw(payload);
        case "choice":
          return choicePayloadToRaw(payload);
        case "use":
          return parseUsePayloadToRaw(payload);
        case "condicion":
          return condicionPayloadToRaw(payload);
        case "section":
          return sectionPayloadToRaw(payload);
        default:
          return "";
      }
    },
    [],
  );

  // Handler que RichEditor llama cuando el usuario hace click en un chip
  // existente para editarlo — abre la palette con el raw actual pre-llenado
  const handleSnippetEdit = useCallback(
    (req: SnippetEditRequest<any>) => {
      const raw = snippetPayloadToRaw(req.kind, req.payload);
      pendingReplaceRef.current = (next: string) => req.replace(next);
      pendingSnippetRawRef.current = raw;
      openPalette(raw);
    },
    [openPalette, snippetPayloadToRaw],
  );

  const snippetCommands: MdCommandItem[] = useMemo(
    () => [
      {
        id: "snip-drop",
        label: "Drop (entidad)",
        description: "Inserta personaje, criatura o ítem interactivo",
        keywords: ["drop", "enti", "personaj", "criatur", "item", "add"],
        icon: "drop",
        action: () => openPalette("[[drop||]]"),
      },
      {
        id: "snip-imagen",
        label: "Imagen",
        description: "Inserta imagen inline o flotante",
        keywords: ["img", "imagen", "foto", "imag", "add"],
        icon: "img",
        action: () => openPalette("[[imagen||]]"),
      },
      {
        id: "snip-choice",
        label: "Choice (decisión)",
        description: "Botón de decisión",
        keywords: ["choi", "choice", "decis", "boton", "botón", "add"],
        icon: "choice",
        action: () => openPalette("[[choice||]]"),
      },
      {
        id: "snip-use",
        label: "Use Ítem",
        description: "Interacción con ítem del inventario",
        keywords: ["use", "item", "ítem", "inven", "add"],
        icon: "use",
        action: () => openPalette("[[use||]]"),
      },
      {
        id: "snip-section",
        label: "Sección",
        description: "Marca de sección para choices",
        keywords: ["secc", "section", "ancora", "add"],
        icon: "sec",
        action: () => openPalette("[[section||]]"),
      },
      {
        id: "snip-sound",
        label: "Sonido",
        description: "Inserta un efecto de sonido o música",
        keywords: ["son", "sound", "music", "audio", "add"],
        icon: "snd",
        action: () => openPalette("[[sound||]]"),
      },
      {
        id: "snip-cita",
        label: "Cita",
        description: "[[cita|Texto — Fuente]]",
        keywords: ["cita", "quote", "add"],
        icon: "«»",
        snippet: "[[cita|Texto de la cita — Fuente]]",
      },
      {
        id: "snip-parrafo",
        label: "Párrafo",
        description: "Salto de párrafo doble",
        keywords: ["parr", "párr", "salto", "add"],
        icon: "¶",
        snippet: " ",
      },
    ],
    [openPalette],
  );

  const _extraCommands: MdCommandItem[] = useMemo(
    () => [...snippetCommands, ...DIALOG_COMMANDS],
    [snippetCommands],
  );

  // snippetOverlay eliminado — los chips son nodos Lexical reales,
  // la edición se maneja via handleSnippetEdit pasado a RichEditor

  const insertOrReplace = useCallback((s: string) => {
    if (pendingReplaceRef.current) {
      pendingReplaceRef.current(s);
      pendingReplaceRef.current = null;
      pendingSnippetRawRef.current = null;
    } else {
      mdInsertRef.current?.(s);
    }
  }, []);

  const handleSaveTitle = async () => {
    if (!titulo.trim()) return;
    setSavingMeta(true);
    try {
      await capUpdateMeta(capId, {
        titulo_capitulo: titulo.trim().toUpperCase(),
      });
      setCap((prev) =>
        prev ? { ...prev, titulo_capitulo: titulo.trim().toUpperCase() } : prev,
      );
      onCapitulosChange();
    } catch {}
    setEditingTitle(false);
    setSavingMeta(false);
  };

  const handleSaveFecha = async () => {
    if (!fecha) return;
    setSavingMeta(true);
    try {
      await capUpdateMeta(capId, { fecha_publicacion: fecha });
      setCap((prev) => (prev ? { ...prev, fecha_publicacion: fecha } : prev));
      onCapitulosChange();
    } catch {}
    setEditingFecha(false);
    setSavingMeta(false);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      message: `¿Eliminar permanentemente "${cap?.titulo_capitulo}"?`,
      danger: true,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    try {
      await capDelete(capId);
      onCapitulosChange();
    } catch {}
  };

  const handleRestaurarVersion = async (version: {
    id: string;
    contenido_delta: string;
    fecha: string;
  }) => {
    const fechaLabel = new Date(version.fecha).toLocaleString("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const ok = await confirm({
      title: "Restaurar versión",
      message: `Se reemplazará el contenido actual por la versión del ${fechaLabel}. Esto no se puede deshacer.`,
      danger: true,
      confirmLabel: "Restaurar",
    });
    if (!ok) return;
    setRestaurando(true);
    try {
      // Actualiza el editor y dispara el guardado real inmediatamente (sin
      // esperar el debounce de 2s) — restaurar es una acción explícita, no
      // tipeo continuo, así que no tiene sentido diferirla.
      setContenido(version.contenido_delta);
      draft.save(version.contenido_delta);
      clearTimeout(timer.current);
      await doSave(version.contenido_delta);
      setHistorialOpen(false);
    } finally {
      setRestaurando(false);
    }
  };

  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center text-primary/30">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  if (!cap) return null;

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* ── Columna principal: título + editor (la barra lateral queda afuera) ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* ── Vista previa fullscreen ── */}
        <AnimatePresence>
          {previewOpen && (
            <div className="fixed inset-0 z-[200] flex flex-col">
              <MotionDiv
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-bg-main"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
              />
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between px-6 py-3 bg-white-custom/80 backdrop-blur-md border-b border-primary/10 shrink-0">
                  <div className="flex items-center gap-3">
                    <Eye className="text-primary/40" size={14} />
                    <span className="text-micro font-black uppercase tracking-widest text-primary/50 italic">
                      Vista previa — {cap?.titulo_capitulo}
                    </span>
                    {cap?.visibilidad !== "publico" && (
                      <span className="flex items-center gap-1 text-micro font-black uppercase px-2 py-0.5 rounded-full border border-[color-mix(in_srgb,var(--callout-warning-border)_30%,transparent)] bg-[color-mix(in_srgb,var(--callout-warning-border)_10%,transparent)] text-[var(--callout-warning-title)] tracking-wide">
                        <Lock size={8} />
                        {
                          VISIBILIDAD_CONFIG[cap?.visibilidad ?? "oculto"]
                            ?.label
                        }
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      className="text-micro font-bold text-primary/25 uppercase tracking-widest hover:text-primary/50 transition-colors flex items-center gap-1"
                      href={`/garliaia/libros/${libroId}/leer/${capId}`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Abrir página pública ↗
                    </a>
                    <button
                      className="p-1.5 rounded-lg hover:bg-primary/8 text-primary/30 hover:text-primary transition-all"
                      onClick={() => setPreviewOpen(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <style>{PROSE_STYLES}</style>
                  <div className="max-w-2xl mx-auto px-8 py-12">
                    <h1 className="text-3xl font-black uppercase italic tracking-tight text-primary mb-8 leading-tight">
                      {cap?.titulo_capitulo}
                    </h1>
                    {contenido ? (
                      <ContenidoInteractivo texto={contenido} onNavigate={() => {}} />
                    ) : (
                      <span className="text-primary/25 italic text-sm">
                        Sin contenido aún…
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>

        <DraftRestoreBanner
          draft={draft}
          label="Hay un borrador local de este capítulo"
          onRestore={(v) => {
            setContenido(v);
            draft.dismiss();
          }}
        />
        {isOffline && (
          <BannerOffline
            color="blue"
            mensaje="Sin conexión — los cambios se guardan localmente"
          />
        )}

        {saveStatus === "pending" && !isOffline && (
          <div
            className="shrink-0 flex items-center gap-2 px-4 sm:px-8 py-2 bg-[color-mix(in_srgb,var(--callout-info-border)_8%,transparent)] border-b border-[color-mix(in_srgb,var(--callout-info-border)_15%,transparent)] text-micro font-black uppercase tracking-widest text-[var(--callout-info-title)]"
            style={{ opacity: 0.7 }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-callout-info-border" />
            Cambios pendientes de sincronizar
          </div>
        )}

        {(
          <div className="shrink-0 px-5 pt-4 pb-2 border-b border-primary/8 space-y-1.5">
            {/* Título editable */}
            {editingTitle ? (
              <div className="flex items-center gap-1.5">
                {!sidebarOpen && (
                  <button
                    className="shrink-0 p-1.5 rounded hover:bg-primary/8 text-primary/30 hover:text-primary transition-all"
                    title="Abrir panel de capítulos"
                    onClick={onToggleSidebar}
                  >
                    <PanelRight size={12} />
                  </button>
                )}
                <input
                  autoFocus
                  className="flex-1 bg-transparent text-base font-black uppercase italic tracking-tight text-primary outline-none border-b border-primary/30 focus:border-primary pb-0.5"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSaveTitle();
                    if (e.key === "Escape") {
                      setEditingTitle(false);
                      setTitulo(cap.titulo_capitulo);
                    }
                  }}
                />
                <button
                  className="p-1 rounded hover:bg-primary/10 text-primary transition-all disabled:opacity-40"
                  disabled={savingMeta}
                  onClick={handleSaveTitle}
                >
                  {savingMeta ? (
                    <Loader2 className="animate-spin" size={11} />
                  ) : (
                    <Check size={11} />
                  )}
                </button>
                <button
                  className="p-1 rounded text-primary/30 hover:text-primary transition-all"
                  onClick={() => {
                    setEditingTitle(false);
                    setTitulo(cap.titulo_capitulo);
                  }}
                >
                  <X size={11} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {!sidebarOpen && (
                  <button
                    className="shrink-0 p-1.5 rounded hover:bg-primary/8 text-primary/30 hover:text-primary transition-all"
                    title="Abrir panel de capítulos"
                    onClick={onToggleSidebar}
                  >
                    <PanelRight size={12} />
                  </button>
                )}
                <h1
                  className="text-base font-black uppercase italic tracking-tight text-primary leading-tight cursor-pointer hover:text-primary/60 transition-colors"
                  onClick={() => setEditingTitle(true)}
                >
                  {cap.titulo_capitulo}
                </h1>
              </div>
            )}

            {/* Meta row compacta */}
            <div className="flex items-center gap-2">
              {/* Info pills */}
              <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap text-micro font-black uppercase tracking-widest text-primary/30">
                {/* Orden editable */}
                <span className="flex items-center gap-0.5 shrink-0">
                  <Hash size={8} />
                  <input
                    className="w-6 bg-transparent outline-none text-micro font-black tabular-nums text-center border-b border-transparent focus:border-primary/30 transition-all"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    title="Orden del capítulo"
                    value={cap.orden}
                    onChange={async (e) => {
                      const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                      if (!isNaN(n) && n > 0) {
                        try {
                          await capUpdateMeta(capId, { orden: n });
                        } catch {}
                      }
                    }}
                  />
                </span>

                <VisibilidadCapPicker
                  capId={capId}
                  current={capVisibilidad}
                  onChanged={(v) => {
                    setCapVisibilidad(v);
                    setCap((prev) =>
                      prev ? { ...prev, visibilidad: v } : prev,
                    );
                    if (v !== "programado") {
                      setFecha("");
                      void capUpdateMeta(capId, { fecha_publicacion: null as any });
                    }
                  }}
                />

                {capVisibilidad === "programado" &&
                  (editingFecha ? (
                    <span className="flex items-center gap-1">
                      <input
                        autoFocus
                        className="bg-primary/5 border border-primary/20 rounded px-1.5 py-0.5 text-micro font-bold text-primary outline-none"
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleSaveFecha();
                          if (e.key === "Escape") {
                            setEditingFecha(false);
                            setFecha(toDateInput(cap.fecha_publicacion));
                          }
                        }}
                      />
                      <button
                        className="p-0.5 rounded bg-primary/10 text-primary disabled:opacity-40"
                        disabled={savingMeta}
                        onClick={handleSaveFecha}
                      >
                        {savingMeta ? (
                          <Loader2 className="animate-spin" size={8} />
                        ) : (
                          <Check size={8} />
                        )}
                      </button>
                      <button
                        className="p-0.5 rounded text-primary/30"
                        onClick={() => {
                          setEditingFecha(false);
                          setFecha(toDateInput(cap.fecha_publicacion));
                        }}
                      >
                        <X size={8} />
                      </button>
                    </span>
                  ) : (
                    <button
                      className="flex items-center gap-0.5 hover:text-primary transition-colors"
                      onClick={() => setEditingFecha(true)}
                    >
                      <Calendar size={8} />
                      {fecha
                        ? new Date(fecha).toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "short",
                          })
                        : "Sin fecha"}
                    </button>
                  ))}

                <EstadisticasEscritura compact={true} texto={contenido} />
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-0.5 shrink-0">
                <SaveIndicator status={saveStatus} />
                <button
                  className="p-1.5 rounded hover:bg-primary/8 text-primary/25 hover:text-primary transition-all disabled:opacity-30"
                  disabled={saveStatus === "saving"}
                  title="Guardar (Ctrl+S)"
                  onClick={() => doSave(contenido)}
                >
                  <Save size={11} />
                </button>
                <button
                  className="p-1.5 rounded hover:bg-primary/8 text-primary/25 hover:text-primary transition-all"
                  title="Vista previa"
                  onClick={() => setPreviewOpen(true)}
                >
                  <Eye size={11} />
                </button>
                <button
                  className={`p-1.5 rounded transition-all disabled:opacity-30 relative ${
                    vistaEditor === "grafo"
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-primary/8 text-primary/25 hover:text-primary"
                  }`}
                  title={
                    vistaEditor === "grafo"
                      ? "Volver a escribir"
                      : "Ver problemas del capítulo (huérfanas / rotas)"
                  }
                  onClick={() =>
                    setVistaEditor((v) =>
                      v === "grafo" ? "escribir" : "grafo",
                    )
                  }
                >
                  <Waypoints size={11} />
                  {chapterGraph.orphanNodes.length +
                    chapterGraph.brokenEdges.length >
                    0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center leading-none">
                      {chapterGraph.orphanNodes.length +
                        chapterGraph.brokenEdges.length}
                    </span>
                  )}
                </button>
                <button
                  className="p-1.5 rounded hover:bg-primary/8 text-primary/25 hover:text-primary transition-all"
                  title="Modo foco"
                  onClick={onToggleFocus}
                >
                  <Minimize2 size={11} />
                </button>
                <div className="relative">
                  <button
                    className={`p-1.5 rounded transition-all ${
                      historialOpen
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-primary/8 text-primary/25 hover:text-primary"
                    }`}
                    title="Historial de versiones"
                    onClick={() => {
                      setHistorialOpen((v) => !v);
                      if (!historialOpen) void reloadVersiones();
                    }}
                  >
                    <History size={11} />
                  </button>
                  {historialOpen && (
                    <>
                      {/* Overlay para cerrar al hacer click afuera */}
                      <div
                        className="fixed inset-0 z-[55]"
                        onClick={() => setHistorialOpen(false)}
                      />
                      <div
                        className="absolute right-0 top-full mt-1 w-72 max-h-96 overflow-y-auto rounded-[var(--radius-btn)] border shadow-2xl z-[56] bg-white-custom"
                        style={{
                          borderColor:
                            "color-mix(in srgb, var(--primary) 12%, transparent)",
                        }}
                      >
                        <div
                          className="sticky top-0 px-3 py-2 border-b text-micro font-black uppercase tracking-[0.2em] text-primary/50 bg-white-custom"
                          style={{
                            borderColor:
                              "color-mix(in srgb, var(--primary) 10%, transparent)",
                          }}
                        >
                          Versiones
                        </div>
                        {loadingVersiones ? (
                          <div className="p-4 flex items-center justify-center text-primary/30">
                            <Loader2 className="animate-spin" size={16} />
                          </div>
                        ) : versiones.length === 0 ? (
                          <div className="p-4 text-micro text-primary/40 text-center">
                            Todavía no hay versiones guardadas de este
                            capítulo.
                          </div>
                        ) : (
                          <div className="py-1">
                            {versiones.map((v, i) => {
                              const fecha = new Date(v.fecha);
                              const esActual = i === 0;
                              return (
                                <div
                                  key={v.id}
                                  className="px-3 py-2 flex items-center gap-2 hover:bg-primary/5 transition-colors"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="text-micro font-bold text-primary/70">
                                      {fecha.toLocaleDateString("es-AR", {
                                        day: "numeric",
                                        month: "short",
                                      })}{" "}
                                      ·{" "}
                                      {fecha.toLocaleTimeString("es-AR", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </div>
                                    <div className="text-[10px] text-primary/35">
                                      {wordCount(v.contenido_delta)} palabras
                                      {esActual ? " · más reciente" : ""}
                                    </div>
                                  </div>
                                  <button
                                    className="shrink-0 px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary text-micro font-black uppercase tracking-wide transition-all disabled:opacity-30"
                                    disabled={restaurando}
                                    title="Restaurar esta versión"
                                    onClick={() =>
                                      handleRestaurarVersion(v)
                                    }
                                  >
                                    Restaurar
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <button
                  className="p-1.5 rounded hover:bg-red-500/10 text-primary/20 hover:text-red-400 transition-all"
                  title="Eliminar capítulo"
                  onClick={handleDelete}
                >
                  <Trash2 size={11} />
                </button>
                <button
                  className="lg:hidden p-1.5 rounded hover:bg-primary/8 text-primary/25 hover:text-primary transition-all"
                  title="Metadatos"
                  onClick={() => setMobileSidebarOpen(true)}
                >
                  <SlidersHorizontal size={11} />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div
            ref={scrollRef}
            className={`flex-1 overflow-y-auto relative ${focusMode ? "px-5 sm:px-16 py-8 sm:py-12" : "px-4 sm:px-8 py-4 sm:py-6"}`}
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className={focusMode ? "max-w-3xl mx-auto w-full" : ""}>
              {vistaEditor === "grafo" ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-center">
                    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-primary/5">
                      <button
                        className={`px-3 py-1 rounded-md text-micro font-black uppercase tracking-wide transition-all ${
                          vistaGrafo === "canvas"
                            ? "bg-primary/10 text-primary"
                            : "text-primary/35 hover:text-primary/60"
                        }`}
                        onClick={() => setVistaGrafo("canvas")}
                      >
                        Canvas
                      </button>
                      <button
                        className={`px-3 py-1 rounded-md text-micro font-black uppercase tracking-wide transition-all ${
                          vistaGrafo === "problemas"
                            ? "bg-primary/10 text-primary"
                            : "text-primary/35 hover:text-primary/60"
                        }`}
                        onClick={() => setVistaGrafo("problemas")}
                      >
                        Problemas
                        {chapterGraph.orphanNodes.length +
                          chapterGraph.brokenEdges.length >
                          0 && (
                          <span className="ml-1.5 text-red-400">
                            {chapterGraph.orphanNodes.length +
                              chapterGraph.brokenEdges.length}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {vistaGrafo === "canvas" ? (
                    <NodeGraphCanvas
                      graph={chapterGraph}
                      posicionesGuardadas={posiciones}
                      onConnect={handleGraphConnect}
                      onMoveNode={setPos}
                    />
                  ) : (
                    <PanelProblemasCapitulo
                      graph={chapterGraph}
                      onVolverAEscribir={() => setVistaEditor("escribir")}
                    />
                  )}
                </div>
              ) : (
                <RichEditor
                  key={capId}
                  autoFocus={focusMode}
                  // Bloquea la edición mientras `cap` todavía no cargó datos
                  // reales para este capId. Es la defensa física: sin esto,
                  // el usuario podía escribir en el editor durante el frame
                  // en que `contenido` seguía siendo el valor del capítulo
                  // anterior (o "") mientras Dexie/Supabase resolvían — y ese
                  // texto fantasma terminaba autoguardándose sobre el
                  // capítulo equivocado o vacío. Ver doSave/onChange guards
                  // más arriba para la segunda capa de esta protección.
                  closePaletteRef={closePaletteRef}
                  editable={!loading && initializedCapId === cap?.id}
                  formatCommandRef={formatCommandRef}
                  insertRef={mdInsertRef}
                  minHeight={focusMode ? "30rem" : "20rem"}
                  mode={focusMode ? "split" : "edit"}
                  placeholder="Empieza a escribir…"
                  renderPreview={renderChapterPreview}
                  value={contenido}
                  onChange={onChange}
                  onClosePalette={handleClosePalette}
                  onOpenPalette={handleOpenPaletteFromSlash}
                  onSnippetEdit={handleSnippetEdit}
                />
              )}
            </div>
          </div>
        </div>

        {(
          <div className="shrink-0 px-3 sm:px-8 py-2 sm:py-2.5 border-t border-primary/5 flex items-center justify-between">
            <EstadisticasEscritura texto={contenido} />
          </div>
        )}
      </div>
      {/* ── Barra lateral: Narrador / línea de tiempo / territorio / personajes ── */}
      {/* Ahora es una columna independiente a la altura completa, al lado del */}
      {/* editor — ya no queda debajo del título del capítulo. */}
      {(
        <PanelPersonajesCapitulo
          capId={capId}
          contenido={contenidoDebounced}
          criaturas_ids={criaturasIds}
          items_ids={itemsIds}
          mobileOpen={mobileSidebarOpen}
          value={personajesIds}
          onChange={setPersonajesIds}
          onCriaturasChange={setCriaturasIds}
          onItemsChange={setItemsIds}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
      )}

      <ConfirmModal />

      {palette && (
        <SnippetCommandPalette
          anchorRect={palette.anchorRect}
          initialQuery={palette.initialQuery}
          initialRaw={palette.initialRaw}
          listaCapitulos={listaSnippetCaps}
          listaSecciones={listaSecciones}
          onClose={() => {
            setPalette(null);
            pendingReplaceRef.current = null;
            pendingSnippetRawRef.current = null;
            // Le avisa al SlashCommandPlugin que puede volver a escuchar
            // el próximo "/" — sin esto quedaba trabado tras el primer uso.
            closePaletteRef.current?.();
          }}
          onInsert={(raw) => {
            insertOrReplace(raw);
            setPalette(null);
            pendingReplaceRef.current = null;
            pendingSnippetRawRef.current = null;
            closePaletteRef.current?.();
          }}
          onFormatCommand={(commandId) => {
            formatCommandRef.current?.(commandId);
          }}
        />
      )}
    </div>
  );
};

// ─── Modales ──────────────────────────────────────────────────────────────────

const ModalNuevoLibro = ({
  onCreated,
  onClose,
}: {
  onCreated: (titulo: string) => Promise<void>;
  onClose: () => void;
}) => {
  const [titulo, setTitulo] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;
    setSaving(true);
    setErrorMsg("");
    try {
      await onCreated(titulo);
      onClose();
    } catch {
      setErrorMsg("No se pudo crear el libro. Inténtalo de nuevo.");
    }
    setSaving(false);
  };

  return (
    <ModalBase onClose={onClose}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-micro font-black uppercase tracking-[0.3em] text-primary/50 italic flex items-center gap-2">
          <BookMarked size={12} /> Nuevo Libro
        </h3>
        <button
          className="text-primary/30 hover:text-primary transition-colors"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <CampoInput
          autoFocus
          label="Título"
          placeholder="TÍTULO DEL LIBRO…"
          value={titulo}
          onChange={setTitulo}
        />
        {errorMsg && (
          <p className="text-micro text-red-400 font-black uppercase tracking-widest">
            {errorMsg}
          </p>
        )}
        <div className="pt-1">
          <BotonSubmit
            disabled={!titulo.trim()}
            labelLoading={
              <>
                <Loader2 className="animate-spin" size={13} />
                Creando…
              </>
            }
            labelNormal={
              <>
                <Plus size={13} />
                Crear Libro
              </>
            }
            loading={saving}
          />
        </div>
      </form>
    </ModalBase>
  );
};

// ─── PanelProblemasCapitulo ────────────────────────────────────────────────────
// Fase 2 del rediseño Choice/Gate: reemplaza el RichEditor cuando el toggle
// "Escribir / Grafo nodo" está en modo grafo. Lista las secciones huérfanas
// (sin ninguna arista entrante) y las aristas rotas (choice/gate cuyo target
// no corresponde a ninguna sección conocida) de `chapterGraph`. Ambas listas
// ya vienen calculadas por storyGraph.ts — este componente solo las muestra.
function PanelProblemasCapitulo({
  graph,
  onVolverAEscribir,
}: {
  graph: StoryGraph;
  onVolverAEscribir: () => void;
}) {
  const sinProblemas =
    graph.orphanNodes.length === 0 && graph.brokenEdges.length === 0;

  return (
    <div className="max-w-2xl mx-auto w-full py-2">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-primary/70">
          <Waypoints size={14} />
          <span className="text-small font-black uppercase tracking-wide">
            Problemas del capítulo
          </span>
        </div>
        <button
          className="text-micro font-bold text-primary/40 hover:text-primary transition-colors flex items-center gap-1"
          onClick={onVolverAEscribir}
        >
          <Pencil size={11} />
          Volver a escribir
        </button>
      </div>

      {sinProblemas ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-primary/30">
          <Check size={22} />
          <p className="text-small font-bold">
            No hay secciones huérfanas ni links rotos en este capítulo.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {graph.orphanNodes.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-red-400/80 mb-2">
                <MapPin size={11} />
                <span className="text-micro font-black uppercase tracking-wide">
                  Secciones huérfanas ({graph.orphanNodes.length})
                </span>
              </div>
              <p className="text-micro text-primary/35 mb-3">
                Nada en el capítulo apunta a estas secciones — solo son
                alcanzables si alguien las abre a mano o por link externo.
              </p>
              <div className="flex flex-col gap-1.5">
                {graph.orphanNodes.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10 text-small"
                  >
                    <TriangleAlert
                      className="shrink-0 text-red-400/70"
                      size={12}
                    />
                    <span className="font-bold text-primary/80 truncate">
                      {n.label}
                    </span>
                    <span className="text-micro text-primary/30 shrink-0">
                      {n.id}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {graph.brokenEdges.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-red-400/80 mb-2">
                <Ban size={11} />
                <span className="text-micro font-black uppercase tracking-wide">
                  Links rotos ({graph.brokenEdges.length})
                </span>
              </div>
              <p className="text-micro text-primary/35 mb-3">
                Choices o gates que apuntan a una sección que no existe (o
                todavía no se creó).
              </p>
              <div className="flex flex-col gap-1.5">
                {graph.brokenEdges.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10 text-small"
                  >
                    <TriangleAlert
                      className="shrink-0 text-red-400/70"
                      size={12}
                    />
                    <span className="font-bold text-primary/80 truncate">
                      {e.label}
                    </span>
                    <span className="text-micro text-primary/30 shrink-0">
                      {e.type === "choice" ? "🔀" : "🔒"} → {e.to}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Hook: cargar grupos de tipo "libros" para el ComboSelector ───────────────
function useGruposLibros() {
  const [items, setItems] = useState<ComboItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("grupos_mundo")
      .select("id, nombre, subtipo")
      .eq("tipo", "libros")
      .order("nombre")
      .then(({ data }) => {
        if (cancelled) return;
        setItems(
          (data ?? []).map((g) => ({
            id: g.id,
            label: g.nombre,
            sublabel: g.subtipo ?? undefined,
          })),
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading };
}

const ModalNuevoCapitulo = ({
  libroId,
  ordenSiguiente,
  onCreated,
  onClose,
}: {
  libroId: string;
  ordenSiguiente: number;
  onCreated: (cap: Capitulo) => void;
  onClose: () => void;
}) => {
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [visibilidad, setVisibilidad] = useState<
    "publico" | "programado" | "oculto"
  >("oculto");
  const [personajesIds, setPersonajesIds] = useState<string[]>([]);
  const [narradorId, setNarradorId] = useState<string | null>(null);
  const [reinoId, setReinoId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;
    setSaving(true);
    try {
      const nuevo = await capCreate(
        libroId,
        titulo,
        ordenSiguiente,
        visibilidad,
        fecha || undefined,
        narradorId,
      );
      const extraFields: Partial<Capitulo> = {};
      if (personajesIds.length > 0) extraFields.personajes_ids = personajesIds;
      if (reinoId) extraFields.reino_id = reinoId;
      if (Object.keys(extraFields).length > 0) {
        await capUpdateMeta(nuevo.id, extraFields);
        Object.assign(nuevo, extraFields);
      }
      onCreated(nuevo);
      onClose();
    } catch {}
    setSaving(false);
  };

  return (
    <ModalBase onClose={onClose}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-micro font-black uppercase tracking-[0.3em] text-primary/50 italic">
          Nuevo Capítulo
        </h3>
        <button
          className="text-primary/30 hover:text-primary"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      <form
        className="space-y-4 max-h-[72vh] overflow-y-auto pr-1"
        onSubmit={handleSubmit}
      >
        <CampoInput
          autoFocus
          label="Título"
          placeholder="NOMBRE DEL CAPÍTULO…"
          value={titulo}
          onChange={setTitulo}
        />
        <SelectorVisibilidad
          fechaPublicacion={fecha}
          label="Visibilidad del Capítulo"
          value={visibilidad}
          onChange={(v) => {
            setVisibilidad(v);
            if (v !== "programado") setFecha("");
          }}
          onFechaChange={setFecha}
        />
        <SelectorNarrador value={narradorId} onChange={setNarradorId} />
        <SelectorReino
          value={reinoId ? [reinoId] : []}
          onChange={(ids) => setReinoId(ids[0] ?? null)}
        />
        <SelectorPersonajesCapitulo
          value={personajesIds}
          onChange={setPersonajesIds}
        />
        <BotonSubmit
          disabled={!titulo.trim()}
          labelLoading={
            <>
              <Loader2 className="animate-spin" size={13} />
              Creando…
            </>
          }
          labelNormal={
            <>
              <Plus size={13} />
              Crear Capítulo
            </>
          }
          loading={saving}
        />
      </form>
    </ModalBase>
  );
};

// ─── BibliotecaPortadas ───────────────────────────────────────────────────────
// Panel inicial: grid de portadas de libros. Click → abre sidebar de caps.

function BibliotecaPortadas({
  libros,
  loading,
  selectedLibroId,
  onSelectLibro,
  onNuevoLibro,
  onEditLibro,
  onDeleteLibro,
}: {
  libros: Libro[];
  loading: boolean;
  selectedLibroId: string | null;
  onSelectLibro: (id: string) => void;
  onNuevoLibro: () => void;
  onEditLibro: (l: Libro) => void;
  onDeleteLibro: (id: string) => void;
}) {
  const VISIBILIDAD_ICON: Record<string, React.ReactNode> = {
    publico: <Globe size={9} />,
    programado: <Timer size={9} />,
    oculto: <Lock size={9} />,
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between px-6 py-3 border-b"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
        }}
      >
        <span className="text-micro font-black uppercase tracking-[0.25em] text-primary/40 italic flex items-center gap-1.5">
          <BookMarked size={11} /> Biblioteca
        </span>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-btn)] bg-primary/8 hover:bg-primary/15 text-primary/50 hover:text-primary text-micro font-black uppercase tracking-widest transition-all"
          onClick={onNuevoLibro}
        >
          <Plus size={10} /> Nuevo Libro
        </button>
      </div>

      {/* Grid de portadas */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-primary/20">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : libros.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-primary/20">
            <BookMarked size={28} />
            <p className="text-micro font-black uppercase tracking-widest">
              Sin libros · crea el primero
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {libros.map((libro) => (
              <div
                key={libro.id}
                className="group relative flex flex-col gap-2 cursor-pointer"
                onClick={() => onSelectLibro(libro.id)}
              >
                {/* Portada */}
                <div
                  className="relative aspect-[2/3] rounded-lg overflow-hidden border transition-all"
                  style={{
                    borderColor:
                      selectedLibroId === libro.id
                        ? "var(--primary)"
                        : "color-mix(in srgb, var(--primary) 10%, transparent)",
                    boxShadow:
                      selectedLibroId === libro.id
                        ? "0 0 0 2px var(--primary)"
                        : "none",
                  }}
                >
                  {libro.portada_url ? (
                    <img
                      alt={libro.titulo}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      src={libro.portada_url}
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{
                        background:
                          "color-mix(in srgb, var(--primary) 6%, transparent)",
                      }}
                    >
                      <BookMarked className="text-primary/15" size={24} />
                    </div>
                  )}

                  {/* Overlay acciones */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end gap-1 p-1.5">
                    <button
                      className="p-1.5 rounded bg-white/10 hover:bg-white/25 text-white transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditLibro(libro);
                      }}
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      className="p-1.5 rounded bg-white/10 hover:bg-red-500/60 text-white transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteLibro(libro.id);
                      }}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>

                  {/* Badge visibilidad */}
                  <div
                    className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded text-micro font-black uppercase tracking-wide backdrop-blur-sm"
                    style={{
                      background:
                        "color-mix(in srgb, var(--bg-main) 70%, transparent)",
                      color:
                        "color-mix(in srgb, var(--primary) 55%, transparent)",
                    }}
                  >
                    {VISIBILIDAD_ICON[libro.visibilidad ?? "oculto"]}
                  </div>

                  {/* Badge TW */}
                  {(libro as any).trigger_warnings?.length > 0 && (
                    <div
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded flex items-center justify-center backdrop-blur-sm"
                      style={{
                        background:
                          "color-mix(in srgb, var(--bg-main) 70%, transparent)",
                        color: "var(--callout-warning-title)",
                      }}
                      title="Tiene Trigger Warnings"
                    >
                      <TriangleAlert size={10} />
                    </div>
                  )}
                </div>

                {/* Título */}
                <p
                  className="text-micro font-black uppercase tracking-wide leading-tight text-center px-0.5 truncate"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 65%, transparent)",
                  }}
                >
                  {libro.titulo}
                </p>

                {/* Estado */}
                {libro.estado && (
                  <p className="text-micro font-black uppercase tracking-widest text-center text-primary/25 -mt-1">
                    {libro.estado}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BarraLibro ───────────────────────────────────────────────────────────────
// Barra superior + panel de configuración expandible del libro.
// Reemplaza ModalEditarLibro: todo editable inline.

// ─── BarraLibro constants ─────────────────────────────────────────────────────
const ESTADOS_LIBRO = ["BORRADOR", "EN PROCESO", "FINALIZADO", "PAUSADO"];
const TW_PREDEFINIDOS_BARRA = [
  "Suicidio",
  "Trastornos Alimenticios",
  "Violencia",
  "Abuso Sexual",
  "Autolesiones",
  "Abuso de Sustancias",
  "Muerte",
  "Trauma",
];

function BarraLibro({
  libro,
  capitulos,
  onLibroChange,
}: {
  libro: Libro | undefined;
  capitulos: Capitulo[];
  onLibroChange: (l: Libro) => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [dropVis, setDropVis] = useState(false);
  const [dropEstado, setDropEstado] = useState(false);
  const [dropPortada, setDropPortada] = useState(false);
  const [dropGrupo, setDropGrupo] = useState(false);
  const [dropTW, setDropTW] = useState(false);
  const dropVisRef = useRef<HTMLDivElement>(null);
  const dropEstRef = useRef<HTMLDivElement>(null);
  const dropPortadaRef = useRef<HTMLDivElement>(null);
  const dropGrupoRef = useRef<HTMLDivElement>(null);
  const dropTWRef = useRef<HTMLDivElement>(null);

  const closeAll = (except?: string) => {
    if (except !== "vis") setDropVis(false);
    if (except !== "estado") setDropEstado(false);
    if (except !== "portada") setDropPortada(false);
    if (except !== "grupo") setDropGrupo(false);
    if (except !== "tw") setDropTW(false);
  };

  // ── Estado local sincronizado con el libro ────────────────────────────────
  const [titulo, setTitulo] = useState(libro?.titulo ?? "");
  const [sinopsis, setSinopsis] = useState(libro?.sinopsis ?? "");
  const [portada, setPortada] = useState(libro?.portada_url ?? "");
  const [estado, setEstado] = useState(libro?.estado ?? "BORRADOR");
  const [visibilidad, setVisibilidad] = useState<
    "publico" | "programado" | "oculto"
  >(libro?.visibilidad ?? "oculto");
  const [_fechaLibro, setFechaLibro] = useState(libro?.fecha_publicacion ?? "");
  const [grupoId, setGrupoId] = useState<string | null>(
    libro?.categoria ?? null,
  );
  const [tws, setTws] = useState<string[]>(
    (libro as any)?.trigger_warnings ?? [],
  );
  const [twCustom, setTwCustom] = useState("");
  const [twAdding, setTwAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitulo, setEditTitulo] = useState(false);
  const titRef = useRef<HTMLInputElement>(null);

  const { items: gruposItems, loading: _loadingGrupos } = useGruposLibros();
  const { reinos, ciudades } = useEntidadesLore();

  // Reinos y ciudades únicos de todos los capítulos del libro
  const reinosIdsUnicos = Array.from(
    new Set(capitulos.flatMap((c) => (c as any).reinos_ids ?? [])),
  ) as string[];
  const ciudadesIdsUnicas = Array.from(
    new Set(capitulos.flatMap((c) => (c as any).ciudades_ids ?? [])),
  ) as string[];
  const reinosDelLibro = reinos.filter((r: any) =>
    reinosIdsUnicos.includes(r.id),
  );
  const ciudadesDelLibro = ciudades.filter((c: any) =>
    ciudadesIdsUnicas.includes(c.id),
  );

  // Re-sync cuando cambia el libro activo
  useEffect(() => {
    if (!libro) return;
    setTitulo(libro.titulo ?? "");
    setSinopsis(libro.sinopsis ?? "");
    setPortada(libro.portada_url ?? "");
    setEstado(libro.estado ?? "BORRADOR");
    setVisibilidad(libro.visibilidad ?? "oculto");
    setFechaLibro(libro.fecha_publicacion ?? "");
    setGrupoId(libro.categoria ?? null);
    setTws((libro as any).trigger_warnings ?? []);
  }, [libro?.id]);

  useEffect(() => {
    if (editTitulo) titRef.current?.focus();
  }, [editTitulo]);

  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropVisRef.current && !dropVisRef.current.contains(e.target as Node))
        setDropVis(false);
      if (dropEstRef.current && !dropEstRef.current.contains(e.target as Node))
        setDropEstado(false);
      if (
        dropPortadaRef.current &&
        !dropPortadaRef.current.contains(e.target as Node)
      )
        setDropPortada(false);
      if (
        dropGrupoRef.current &&
        !dropGrupoRef.current.contains(e.target as Node)
      )
        setDropGrupo(false);
      if (dropTWRef.current && !dropTWRef.current.contains(e.target as Node))
        setDropTW(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const save = async (fields: Partial<Libro>) => {
    if (!libro) return;
    setSaving(true);
    try {
      await libroUpdateMeta(libro.id, fields as any);
      onLibroChange({ ...libro, ...fields } as Libro);
    } catch {}
    setSaving(false);
  };

  const saveTitulo = () => {
    const t = titulo.trim().toUpperCase();
    if (t && t !== libro?.titulo) void save({ titulo: t });
    setEditTitulo(false);
  };

  const selectVis = (v: "publico" | "programado" | "oculto") => {
    setVisibilidad(v);
    void save({ visibilidad: v });
    setDropVis(false);
  };

  const selectEstado = (e: string) => {
    setEstado(e);
    void save({ estado: e });
    setDropEstado(false);
  };

  const toggleTw = (tw: string) => {
    const next = tws.includes(tw) ? tws.filter((x) => x !== tw) : [...tws, tw];
    setTws(next);
    void save({ trigger_warnings: next } as any);
  };

  const addCustomTw = () => {
    const v = twCustom.trim();
    if (v && !tws.includes(v)) {
      const next = [...tws, v];
      setTws(next);
      void save({ trigger_warnings: next } as any);
    }
    setTwCustom("");
    setTwAdding(false);
  };

  const VISIBILIDAD_LABEL: Record<string, string> = {
    publico: "Público",
    programado: "Programado",
    oculto: "Borrador",
  };
  const VISIBILIDAD_ICON: Record<string, React.ReactNode> = {
    publico: <Globe size={9} />,
    programado: <Timer size={9} />,
    oculto: <Lock size={9} />,
  };
  const vis = visibilidad;

  const sep = (
    <div
      className="w-px h-3 shrink-0"
      style={{
        background: "color-mix(in srgb, var(--primary) 10%, transparent)",
      }}
    />
  );

  return (
    <div
      className="shrink-0 flex flex-col"
      style={{
        borderBottom:
          "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
      }}
    >
      {/* ── Fila principal ── */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          borderBottom:
            reinosDelLibro.length > 0 || ciudadesDelLibro.length > 0
              ? "1px solid color-mix(in srgb, var(--primary) 6%, transparent)"
              : "none",
          background: "color-mix(in srgb, var(--primary) 2%, var(--bg-main))",
        }}
      >
        {/* Portada — click abre selector */}
        <div ref={dropPortadaRef} className="relative shrink-0">
          <button
            className="w-6 h-8 rounded overflow-hidden border border-primary/10 hover:border-primary/40 transition-all group flex items-center justify-center"
            style={{
              background: "color-mix(in srgb, var(--primary) 5%, transparent)",
            }}
            title="Cambiar portada"
            onClick={() => {
              setDropPortada((o) => !o);
              closeAll("portada");
            }}
          >
            {portada ? (
              <img
                alt=""
                className="w-full h-full object-cover"
                src={portada}
              />
            ) : (
              <BookMarked
                className="text-primary/20 group-hover:text-primary/50 transition-colors"
                size={9}
              />
            )}
          </button>
          {dropPortada && (
            <div
              className="absolute left-0 top-full mt-1 z-50 rounded-lg border shadow-xl p-3"
              style={{
                background: "var(--bg-main)",
                borderColor:
                  "color-mix(in srgb, var(--primary) 12%, transparent)",
                width: 240,
              }}
            >
              <SelectorImagenPortada
                value={portada}
                onChange={(v) => {
                  setPortada(v);
                  void save({ portada_url: v });
                  setDropPortada(false);
                }}
              />
            </div>
          )}
        </div>

        {/* Título editable inline */}
        {editTitulo ? (
          <input
            ref={titRef}
            className="flex-1 min-w-0 bg-transparent outline-none border-b text-micro font-black uppercase italic tracking-tight text-primary"
            style={{
              borderColor:
                "color-mix(in srgb, var(--primary) 30%, transparent)",
            }}
            value={titulo}
            onBlur={saveTitulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitulo();
              if (e.key === "Escape") {
                setTitulo(libro?.titulo ?? "");
                setEditTitulo(false);
              }
            }}
          />
        ) : (
          <button
            className="flex-1 min-w-0 text-left text-micro font-black uppercase italic tracking-tight text-primary/70 hover:text-primary truncate transition-colors"
            title="Click para editar título"
            onClick={() => setEditTitulo(true)}
          >
            {titulo || "…"}
          </button>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Visibilidad dropdown */}
          <div ref={dropVisRef} className="relative">
            <button
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-micro font-black uppercase tracking-wide border transition-all"
              style={{
                borderColor:
                  vis === "publico"
                    ? "color-mix(in srgb, var(--callout-success-border) 40%, transparent)"
                    : "color-mix(in srgb, var(--primary) 15%, transparent)",
                color:
                  vis === "publico"
                    ? "var(--callout-success-title)"
                    : "color-mix(in srgb, var(--primary) 40%, transparent)",
                background:
                  vis === "publico"
                    ? "color-mix(in srgb, var(--callout-success-border) 8%, transparent)"
                    : "transparent",
              }}
              onClick={() => {
                setDropVis((o) => !o);
                closeAll("vis");
              }}
            >
              {VISIBILIDAD_ICON[vis]}
              {VISIBILIDAD_LABEL[vis]}
              <ChevronDown size={7} style={{ opacity: 0.5, marginLeft: 1 }} />
            </button>
            {dropVis && (
              <div
                className="absolute left-0 top-full mt-1 z-50 rounded-lg border shadow-xl overflow-hidden"
                style={{
                  background: "var(--bg-main)",
                  borderColor:
                    "color-mix(in srgb, var(--primary) 12%, transparent)",
                  minWidth: 130,
                }}
              >
                {(["publico", "programado", "oculto"] as const).map((v) => (
                  <button
                    key={v}
                    className="w-full flex items-center gap-2 px-3 py-2 text-micro font-black uppercase tracking-wide text-left hover:bg-primary/6 transition-all"
                    style={{
                      color:
                        visibilidad === v
                          ? "var(--primary)"
                          : "color-mix(in srgb, var(--primary) 45%, transparent)",
                    }}
                    onClick={() => selectVis(v)}
                  >
                    {VISIBILIDAD_ICON[v]}
                    {VISIBILIDAD_LABEL[v]}
                    {visibilidad === v && (
                      <Check
                        className="ml-auto"
                        size={8}
                        style={{ color: "var(--primary)" }}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Estado dropdown */}
          <div ref={dropEstRef} className="relative">
            <button
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-micro font-black uppercase tracking-wide border transition-all hover:border-primary/25 hover:text-primary/60"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 12%, transparent)",
                color: "color-mix(in srgb, var(--primary) 35%, transparent)",
              }}
              onClick={() => {
                setDropEstado((o) => !o);
                closeAll("estado");
              }}
            >
              {estado}
              <ChevronDown size={7} style={{ opacity: 0.5, marginLeft: 1 }} />
            </button>
            {dropEstado && (
              <div
                className="absolute left-0 top-full mt-1 z-50 rounded-lg border shadow-xl overflow-hidden"
                style={{
                  background: "var(--bg-main)",
                  borderColor:
                    "color-mix(in srgb, var(--primary) 12%, transparent)",
                  minWidth: 130,
                }}
              >
                {ESTADOS_LIBRO.map((est) => (
                  <button
                    key={est}
                    className="w-full flex items-center gap-2 px-3 py-2 text-micro font-black uppercase tracking-wide text-left hover:bg-primary/6 transition-all"
                    style={{
                      color:
                        estado === est
                          ? "var(--primary)"
                          : "color-mix(in srgb, var(--primary) 45%, transparent)",
                    }}
                    onClick={() => selectEstado(est)}
                  >
                    {est}
                    {estado === est && (
                      <Check
                        className="ml-auto"
                        size={8}
                        style={{ color: "var(--primary)" }}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Grupo dropdown */}
          <div ref={dropGrupoRef} className="relative">
            <button
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-micro font-black uppercase tracking-wide border transition-all hover:border-primary/25 hover:text-primary/60"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 12%, transparent)",
                color: "color-mix(in srgb, var(--primary) 35%, transparent)",
              }}
              onClick={() => {
                setDropGrupo((o) => !o);
                closeAll("grupo");
              }}
            >
              <BookMarked size={8} />
              {gruposItems.find((g) => g.id === grupoId)?.label ?? "Sin grupo"}
              <ChevronDown size={7} style={{ opacity: 0.5, marginLeft: 1 }} />
            </button>
            {dropGrupo && (
              <div
                className="absolute left-0 top-full mt-1 z-50 rounded-lg border shadow-xl overflow-hidden"
                style={{
                  background: "var(--bg-main)",
                  borderColor:
                    "color-mix(in srgb, var(--primary) 12%, transparent)",
                  minWidth: 150,
                }}
              >
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-micro font-black uppercase tracking-wide text-left hover:bg-primary/6 transition-all"
                  style={{
                    color: !grupoId
                      ? "var(--primary)"
                      : "color-mix(in srgb, var(--primary) 45%, transparent)",
                  }}
                  onClick={() => {
                    setGrupoId(null);
                    void save({ categoria: null });
                    setDropGrupo(false);
                  }}
                >
                  Sin grupo{" "}
                  {!grupoId && (
                    <Check
                      className="ml-auto"
                      size={8}
                      style={{ color: "var(--primary)" }}
                    />
                  )}
                </button>
                {gruposItems.map((g: any) => (
                  <button
                    key={g.id}
                    className="w-full flex items-center gap-2 px-3 py-2 text-micro font-black uppercase tracking-wide text-left hover:bg-primary/6 transition-all"
                    style={{
                      color:
                        grupoId === g.id
                          ? "var(--primary)"
                          : "color-mix(in srgb, var(--primary) 45%, transparent)",
                    }}
                    onClick={() => {
                      setGrupoId(g.id);
                      void save({ categoria: g.id });
                      setDropGrupo(false);
                    }}
                  >
                    {g.label}
                    {grupoId === g.id && (
                      <Check
                        className="ml-auto"
                        size={8}
                        style={{ color: "var(--primary)" }}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* TW — siempre visible, opaco si no tiene */}
          <div ref={dropTWRef} className="relative">
            <button
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-micro border transition-all"
              style={{
                opacity: tws.length > 0 ? 1 : 0.3,
                borderColor:
                  tws.length > 0
                    ? "color-mix(in srgb, var(--callout-warning-border) 40%, transparent)"
                    : "color-mix(in srgb, var(--primary) 15%, transparent)",
                background:
                  tws.length > 0
                    ? "color-mix(in srgb, var(--callout-warning-border) 8%, transparent)"
                    : "transparent",
              }}
              title="Trigger Warnings"
              onClick={() => {
                setDropTW((o) => !o);
                closeAll("tw");
              }}
            >
              <TriangleAlert
                size={10}
                style={{
                  color:
                    tws.length > 0 ? "var(--callout-warning-title)" : undefined,
                }}
              />
            </button>
            {dropTW && (
              <div
                className="absolute right-0 top-full mt-1 z-50 rounded-lg border shadow-xl p-2"
                style={{
                  background: "var(--bg-main)",
                  borderColor:
                    "color-mix(in srgb, var(--primary) 12%, transparent)",
                  minWidth: 190,
                }}
              >
                <div className="flex flex-col gap-0.5 mb-1">
                  {TW_PREDEFINIDOS_BARRA.map((tw) => {
                    const on = tws.includes(tw);
                    return (
                      <button
                        key={tw}
                        className="flex items-center gap-2 w-full text-left px-2 py-1 rounded transition-all"
                        style={{
                          background: on
                            ? "color-mix(in srgb, var(--callout-warning-border) 10%, transparent)"
                            : "transparent",
                        }}
                        onClick={() => toggleTw(tw)}
                      >
                        <div
                          className="shrink-0 flex items-center justify-center rounded"
                          style={{
                            width: 11,
                            height: 11,
                            border: `1px solid ${on ? "var(--callout-warning-border)" : "color-mix(in srgb, var(--primary) 20%, transparent)"}`,
                            background: on
                              ? "var(--callout-warning-border)"
                              : "transparent",
                          }}
                        >
                          {on && (
                            <Check
                              size={7}
                              style={{ color: "var(--bg-main)" }}
                            />
                          )}
                        </div>
                        <span
                          className="text-micro font-bold"
                          style={{
                            color: on
                              ? "var(--callout-warning-title)"
                              : "color-mix(in srgb, var(--primary) 45%, transparent)",
                          }}
                        >
                          {tw}
                        </span>
                      </button>
                    );
                  })}
                  {tws
                    .filter((tw) => !TW_PREDEFINIDOS_BARRA.includes(tw))
                    .map((tw) => (
                      <button
                        key={tw}
                        className="flex items-center gap-2 w-full text-left px-2 py-1 rounded"
                        style={{
                          background:
                            "color-mix(in srgb, var(--callout-warning-border) 10%, transparent)",
                        }}
                        onClick={() => toggleTw(tw)}
                      >
                        <div
                          className="shrink-0 flex items-center justify-center rounded"
                          style={{
                            width: 11,
                            height: 11,
                            border: "1px solid var(--callout-warning-border)",
                            background: "var(--callout-warning-border)",
                          }}
                        >
                          <Check size={7} style={{ color: "var(--bg-main)" }} />
                        </div>
                        <span
                          className="text-micro font-bold flex-1 truncate"
                          style={{ color: "var(--callout-warning-title)" }}
                        >
                          {tw}
                        </span>
                        <X className="text-primary/30" size={8} />
                      </button>
                    ))}
                </div>
                {twAdding ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      className="flex-1 min-w-0 rounded px-2 py-1 text-micro font-bold outline-none border text-primary bg-transparent"
                      placeholder="Ej: Acoso…"
                      style={{
                        borderColor:
                          "color-mix(in srgb, var(--primary) 20%, transparent)",
                      }}
                      value={twCustom}
                      onChange={(e) => setTwCustom(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addCustomTw();
                        if (e.key === "Escape") {
                          setTwCustom("");
                          setTwAdding(false);
                        }
                      }}
                    />
                    <button
                      className="p-1 rounded bg-primary/10 text-primary"
                      onClick={addCustomTw}
                    >
                      <Check size={9} />
                    </button>
                    <button
                      className="p-1 rounded text-primary/30"
                      onClick={() => {
                        setTwCustom("");
                        setTwAdding(false);
                      }}
                    >
                      <X size={9} />
                    </button>
                  </div>
                ) : (
                  <button
                    className="w-full flex items-center justify-center gap-1 py-1 rounded border border-dashed text-micro font-black uppercase tracking-widest text-primary/25 hover:text-primary hover:border-primary/25 transition-all"
                    style={{
                      borderColor:
                        "color-mix(in srgb, var(--primary) 12%, transparent)",
                    }}
                    onClick={() => setTwAdding(true)}
                  >
                    <Plus size={8} /> Añadir
                  </button>
                )}
              </div>
            )}
          </div>

          {saving && (
            <Loader2 className="animate-spin text-primary/30" size={10} />
          )}

          {sep}

          {/* Sinopsis toggle */}
          <button
            className="p-1.5 rounded hover:bg-primary/8 transition-all"
            style={{
              color: panelOpen
                ? "var(--primary)"
                : "color-mix(in srgb, var(--primary) 30%, transparent)",
            }}
            title="Sinopsis"
            onClick={() => setPanelOpen((o) => !o)}
          >
            <AlignLeft size={11} />
          </button>
        </div>
      </div>

      {/* ── Fila de pills: Reinos y Ciudades ── */}
      {(reinosDelLibro.length > 0 || ciudadesDelLibro.length > 0) && (
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto"
          style={{
            borderBottom:
              "1px solid color-mix(in srgb, var(--primary) 6%, transparent)",
            background: "color-mix(in srgb, var(--primary) 1%, var(--bg-main))",
          }}
        >
          {reinosDelLibro.map((r: any) => (
            <span
              key={r.id}
              className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-micro font-black uppercase tracking-wide border"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 12%, transparent)",
                color: "color-mix(in srgb, var(--primary) 45%, transparent)",
                background:
                  "color-mix(in srgb, var(--primary) 3%, transparent)",
              }}
            >
              <Globe size={8} /> {r.nombre}
            </span>
          ))}
          {reinosDelLibro.length > 0 && ciudadesDelLibro.length > 0 && (
            <div
              className="w-px h-3 shrink-0"
              style={{
                background:
                  "color-mix(in srgb, var(--primary) 10%, transparent)",
              }}
            />
          )}
          {ciudadesDelLibro.map((c: any) => (
            <span
              key={c.id}
              className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-micro font-black uppercase tracking-wide border"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 10%, transparent)",
                color: "color-mix(in srgb, var(--primary) 35%, transparent)",
                background:
                  "color-mix(in srgb, var(--primary) 2%, transparent)",
              }}
            >
              <MapPin size={8} /> {c.nombre}
            </span>
          ))}
        </div>
      )}

      {/* ── Panel sinopsis expandible ── */}
      {panelOpen && (
        <div
          className="px-4 py-3 border-b"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background:
              "color-mix(in srgb, var(--primary) 1.5%, var(--bg-main))",
          }}
        >
          <label className="text-micro font-black uppercase tracking-widest text-primary/35 block mb-1.5">
            Sinopsis
          </label>
          <textarea
            className="w-full bg-transparent border rounded px-2 py-1.5 text-micro text-primary outline-none focus:border-primary/30 resize-none transition-colors"
            placeholder="Descripción del libro…"
            rows={3}
            style={{
              borderColor:
                "color-mix(in srgb, var(--primary) 15%, transparent)",
            }}
            value={sinopsis}
            onBlur={() => save({ sinopsis: sinopsis.trim() })}
            onChange={(e) => setSinopsis(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

// ─── SidebarLibros ────────────────────────────────────────────────────────────
// Barra lateral única: lista todos los libros como acordeón, cada uno con sus
// capítulos anidados. Reemplaza la antigua vista de "Biblioteca" + sidebar de
// capítulos de un solo libro — todo vive en una sola pantalla ahora.

function SidebarLibros({
  libros,
  loadingLibros,
  porLibro,
  loadingCapsIds,
  selectedLibroId,
  selectedCapId,
  open,
  onCargarCapsLibro,
  onSelectCap,
  onDeleteCap,
  onNuevoCap,
  onNuevoLibro,
  onDeleteLibro,
  onToggleSidebar,
  onReorderCaps,
}: {
  libros: Libro[];
  loadingLibros: boolean;
  porLibro: Record<string, Capitulo[]>;
  loadingCapsIds: Set<string>;
  selectedLibroId: string | null;
  selectedCapId: string | null;
  open: boolean;
  onCargarCapsLibro: (libroId: string) => void;
  onSelectCap: (libroId: string, capId: string) => void;
  onDeleteCap: (id: string, libroId: string) => void;
  onNuevoCap: (libroId: string) => void;
  onNuevoLibro: () => void;
  onDeleteLibro: (libroId: string) => void;
  onToggleSidebar: () => void;
  onReorderCaps: (libroId: string, orderedIds: string[]) => void;
}) {
  // ── Drag-and-drop de capítulos (reordenar) ────────────────────────────────
  // Nativo (HTML5 DnD), sin dependencias nuevas. `dragCapId` es el capítulo
  // que se está arrastrando; `overCapId` el que está debajo del cursor
  // (para pintar el indicador de "soltar acá").
  const [dragCapId, setDragCapId] = useState<string | null>(null);
  const [overCapId, setOverCapId] = useState<string | null>(null);

  const handleDropCap = (libroId: string, targetCapId: string) => {
    const caps = porLibro[libroId] ?? [];
    if (!dragCapId || dragCapId === targetCapId) {
      setDragCapId(null);
      setOverCapId(null);
      return;
    }
    const ordenados = [...caps].sort((a, b) => a.orden - b.orden);
    const fromIdx = ordenados.findIndex((c) => c.id === dragCapId);
    const toIdx = ordenados.findIndex((c) => c.id === targetCapId);
    if (fromIdx === -1 || toIdx === -1) {
      setDragCapId(null);
      setOverCapId(null);
      return;
    }
    const reordenados = [...ordenados];
    const [moved] = reordenados.splice(fromIdx, 1);
    reordenados.splice(toIdx, 0, moved);
    onReorderCaps(
      libroId,
      reordenados.map((c) => c.id),
    );
    setDragCapId(null);
    setOverCapId(null);
  };
  const [expandidos, setExpandidos] = useState<Set<string>>(
    new Set(selectedLibroId ? [selectedLibroId] : []),
  );

  // Auto-expandir (y cargar) el libro del capítulo activo cuando cambia desde
  // afuera (p. ej. al restaurar la última sesión).
  useEffect(() => {
    if (!selectedLibroId) return;
    setExpandidos((prev) => {
      if (prev.has(selectedLibroId)) return prev;
      const next = new Set(prev);
      next.add(selectedLibroId);
      return next;
    });
    onCargarCapsLibro(selectedLibroId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLibroId]);

  const toggleLibro = (libroId: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(libroId)) {
        next.delete(libroId);
      } else {
        next.add(libroId);
        onCargarCapsLibro(libroId);
      }
      return next;
    });
  };

  if (!open) return null;

  return (
    <div
      className="shrink-0 flex flex-col border-r overflow-hidden"
      style={{
        width: "clamp(160px, 14vw, 220px)",
        borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
        background: "color-mix(in srgb, var(--primary) 1.5%, var(--bg-main))",
      }}
    >
      {/* Header sidebar */}
      <div
        className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
        }}
      >
        <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/35 flex-1 flex items-center gap-1">
          <BookMarked size={10} /> Libros · {libros.length}
        </span>
        <button
          className="p-1 rounded hover:bg-primary/8 text-primary/30 hover:text-primary transition-all"
          title="Nuevo libro"
          onClick={onNuevoLibro}
        >
          <Plus size={10} />
        </button>
        <button
          className="p-1 rounded hover:bg-primary/8 text-primary/30 hover:text-primary transition-all"
          title="Cerrar panel"
          onClick={onToggleSidebar}
        >
          <X size={10} />
        </button>
      </div>

      {/* Lista de libros con caps anidados */}
      <div className="flex-1 overflow-y-auto py-1">
        {loadingLibros ? (
          <div className="flex items-center justify-center py-10 text-primary/20">
            <Loader2 className="animate-spin" size={16} />
          </div>
        ) : libros.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-primary/20">
            <BookMarked size={16} />
            <p className="text-micro font-black uppercase tracking-widest text-center px-2">
              Sin libros · crea el primero
            </p>
          </div>
        ) : (
          libros.map((libro) => {
            const abierto = expandidos.has(libro.id);
            const caps = porLibro[libro.id];
            const cargandoCaps = loadingCapsIds.has(libro.id);
            const libroActivo = libro.id === selectedLibroId;

            return (
              <div key={libro.id} className="mb-0.5">
                {/* Header del libro */}
                <div
                  className="group relative flex items-center gap-1 px-2 py-1.5 cursor-pointer transition-all"
                  style={{
                    background: libroActivo
                      ? "color-mix(in srgb, var(--primary) 6%, transparent)"
                      : "transparent",
                  }}
                  onClick={() => toggleLibro(libro.id)}
                >
                  {abierto ? (
                    <ChevronDown
                      className="shrink-0 text-primary/30"
                      size={11}
                    />
                  ) : (
                    <ChevronRight
                      className="shrink-0 text-primary/30"
                      size={11}
                    />
                  )}
                  <span
                    className="flex-1 min-w-0 text-micro font-black uppercase tracking-wide leading-tight truncate"
                    style={{
                      color: libroActivo
                        ? "var(--primary)"
                        : "color-mix(in srgb, var(--primary) 55%, transparent)",
                    }}
                  >
                    {libro.titulo}
                  </span>

                  {/* Acciones hover del libro */}
                  <div className="shrink-0 hidden group-hover:flex items-center gap-0.5">
                    <button
                      className="p-0.5 rounded hover:bg-primary/10 text-primary/30 hover:text-primary transition-colors"
                      title="Nuevo capítulo"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNuevoCap(libro.id);
                      }}
                    >
                      <Plus size={9} />
                    </button>
                    <button
                      className="p-0.5 rounded hover:bg-red-500/10 text-primary/25 hover:text-red-400 transition-colors"
                      title="Eliminar libro"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteLibro(libro.id);
                      }}
                    >
                      <Trash2 size={9} />
                    </button>
                  </div>
                </div>

                {/* Capítulos del libro */}
                {abierto && (
                  <div>
                    {cargandoCaps && !caps ? (
                      <div className="flex items-center justify-center py-3 text-primary/15">
                        <Loader2 className="animate-spin" size={12} />
                      </div>
                    ) : caps && caps.length === 0 ? (
                      <p className="pl-7 pr-2 py-1.5 text-micro font-black uppercase tracking-widest text-primary/20">
                        Sin capítulos
                      </p>
                    ) : (
                      (caps ?? []).map((cap) => {
                        const activo = cap.id === selectedCapId;
                        const arrastrando = dragCapId === cap.id;
                        const esDestino =
                          overCapId === cap.id && dragCapId !== cap.id;
                        return (
                          <div
                            key={cap.id}
                            className="group relative flex items-center gap-1 pl-1 pr-2.5 py-1.5 cursor-pointer transition-all"
                            style={{
                              background: activo
                                ? "color-mix(in srgb, var(--primary) 8%, transparent)"
                                : "transparent",
                              borderLeft: activo
                                ? "2px solid var(--primary)"
                                : "2px solid transparent",
                              borderTop: esDestino
                                ? "2px solid var(--primary)"
                                : "2px solid transparent",
                              opacity: arrastrando ? 0.4 : 1,
                            }}
                            onClick={() => onSelectCap(libro.id, cap.id)}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (dragCapId && dragCapId !== cap.id)
                                setOverCapId(cap.id);
                            }}
                            onDragLeave={() => {
                              setOverCapId((prev) =>
                                prev === cap.id ? null : prev,
                              );
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              handleDropCap(libro.id, cap.id);
                            }}
                          >
                            {/* Handle de drag — visible en hover, evita arrastrar
                                toda la fila por error al querer solo abrir el capítulo */}
                            <span
                              className="shrink-0 hidden group-hover:flex items-center justify-center text-primary/20 hover:text-primary/50 cursor-grab active:cursor-grabbing"
                              draggable
                              title="Arrastrar para reordenar"
                              onClick={(e) => e.stopPropagation()}
                              onDragEnd={() => {
                                setDragCapId(null);
                                setOverCapId(null);
                              }}
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = "move";
                                setDragCapId(cap.id);
                              }}
                            >
                              <GripVertical size={10} />
                            </span>

                            {/* Número de orden */}
                            <span
                              className="shrink-0 text-micro font-black tabular-nums"
                              style={{
                                color: activo
                                  ? "var(--primary)"
                                  : "color-mix(in srgb, var(--primary) 25%, transparent)",
                                width: 14,
                                textAlign: "right",
                              }}
                            >
                              {cap.orden}
                            </span>

                            {/* Título */}
                            <span
                              className="flex-1 min-w-0 text-micro font-bold uppercase tracking-wide leading-tight truncate"
                              style={{
                                color: activo
                                  ? "var(--primary)"
                                  : "color-mix(in srgb, var(--primary) 55%, transparent)",
                              }}
                            >
                              {cap.titulo_capitulo}
                            </span>

                            {/* Visibilidad dot */}
                            <div
                              className="shrink-0 w-1.5 h-1.5 rounded-full"
                              style={{
                                background:
                                  cap.visibilidad === "publico"
                                    ? "var(--callout-success-border)"
                                    : cap.visibilidad === "programado"
                                      ? "var(--callout-warning-border)"
                                      : "color-mix(in srgb, var(--primary) 15%, transparent)",
                              }}
                            />

                            {/* Acciones hover */}
                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-bg-main border border-primary/10 rounded px-0.5 py-0.5 shadow-sm">
                              <button
                                className="p-0.5 rounded hover:bg-red-500/10 text-primary/25 hover:text-red-400 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteCap(cap.id, libro.id);
                                }}
                              >
                                <Trash2 size={9} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── EditorCapitulosPanel ─────────────────────────────────────────────────────

export function EditorCapitulosPanel() {
  const {
    data: libros,
    setData: setLibros,
    loading: loadingLibros,
    addRow: addLibro,
  } = useSupabaseData<Libro>("libros", {
    isAdmin: true,
    order: { campo: "created_at", asc: false },
  });

  const [lastCapId, setLastCapId] = useLastOpenedId("estudio-caps-last-cap");
  const [lastLibroId, setLastLibroId] = useLastOpenedId(
    "estudio-caps-last-libro",
  );

  const [selectedLibroId, _setSelectedLibroId] = useState<string | null>(
    lastLibroId,
  );
  const [selectedCapId, _setSelectedCapId] = useState<string | null>(lastCapId);

  const setSelectedLibroId = (id: string | null) => {
    _setSelectedLibroId(id);
    setLastLibroId(id);
  };
  const setSelectedCapId = (id: string | null) => {
    _setSelectedCapId(id);
    setLastCapId(id);
  };

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [showNuevoCap, setShowNuevoCap] = useState(false);
  const [showNuevoLibro, setShowNuevoLibro] = useState(false);
  const [_capRefreshKey, setCapRefreshKey] = useState(0);
  const handleLibroEditado = (libro: Libro) => {
    setLibros((prev: Libro[]) =>
      prev.map((l) => (l.id === libro.id ? libro : l)),
    );
  };

  // ── Capítulos por libro, cargados bajo demanda ──────────────────────────
  // La sidebar es ahora un acordeón con TODOS los libros; en vez de traer
  // los caps de uno solo (como antes), mantenemos un mapa libroId → caps
  // que se va llenando a medida que el usuario expande cada libro (o al
  // restaurar la última sesión / crear un capítulo).
  const [porLibro, setPorLibro] = useState<Record<string, Capitulo[]>>({});
  const [loadingCapsIds, setLoadingCapsIds] = useState<Set<string>>(new Set());

  const cargarCapsLibro = useCallback(
    async (libroId: string, force = false): Promise<Capitulo[]> => {
      if (!force && porLibro[libroId]) return porLibro[libroId];
      setLoadingCapsIds((prev) => new Set(prev).add(libroId));

      // ── 1) Dexie primero: instantáneo y funciona offline ──────────────────
      let local: Capitulo[] = [];
      try {
        if (db) {
          const rows = await (db as any).capitulos
            .where("libro_id")
            .equals(libroId)
            .toArray();
          local = (rows as any[])
            .filter((c) => !c.deleted)
            .sort((a, b) => a.orden - b.orden) as Capitulo[];
        }
      } catch {}
      if (local.length > 0) {
        setPorLibro((prev) => ({ ...prev, [libroId]: local }));
      }

      try {
        const online = await isReallyOnline();
        if (!online) {
          // Sin red: nos quedamos con lo que había en Dexie (puede ser []).
          setPorLibro((prev) => ({
            ...prev,
            [libroId]: prev[libroId] ?? local,
          }));
          return local;
        }

        // ── 2) Supabase, y sincronizamos Dexie con lo remoto ───────────────
        const { data, error } = await supabase
          .from("capitulos")
          .select("*")
          .eq("libro_id", libroId)
          .order("orden", { ascending: true });
        if (error) return local;
        const remote = (data ?? []) as Capitulo[];
        setPorLibro((prev) => ({ ...prev, [libroId]: remote }));

        try {
          if (db) {
            // No pisar filas con cambios offline aún no sincronizados.
            const localAll = await (db as any).capitulos
              .where("libro_id")
              .equals(libroId)
              .toArray();
            const pendingIds = new Set(
              (localAll as any[])
                .filter((r) => r.status === "pending")
                .map((r) => String(r.id)),
            );
            const toUpsert = remote
              .filter((r: any) => !pendingIds.has(String(r.id)))
              .map((r: any) => ({ ...r, status: "synced" }));
            if (toUpsert.length > 0) {
              await (db as any).capitulos.bulkPut(toUpsert);
            }
            // Borrar de Dexie los que ya no existen en remoto (y no están pendientes).
            const remoteIds = new Set(remote.map((r: any) => String(r.id)));
            const toDelete = (localAll as any[])
              .filter(
                (r) => !remoteIds.has(String(r.id)) && r.status !== "pending",
              )
              .map((r) => r.id);
            if (toDelete.length > 0) {
              await (db as any).capitulos.bulkDelete(toDelete);
            }
          }
        } catch (e) {
          console.warn("[Dexie] No se pudo sincronizar 'capitulos':", e);
        }
        return remote;
      } finally {
        setLoadingCapsIds((prev) => {
          const next = new Set(prev);
          next.delete(libroId);
          return next;
        });
      }
    },
    [porLibro],
  );

  // Recargar (forzado) los caps de un libro — usado tras crear/borrar cap.
  const reloadCapsLibro = useCallback(
    (libroId: string) => cargarCapsLibro(libroId, true),
    [cargarCapsLibro],
  );

  const capitulosLibroActivo = selectedLibroId
    ? (porLibro[selectedLibroId] ?? [])
    : [];

  useEffect(() => {
    const check = () => {
      const action = localStorage.getItem("estudio-caps-action");
      const capId = localStorage.getItem("estudio-caps-last-cap");
      const libroId = localStorage.getItem("estudio-caps-last-libro");
      if (capId && libroId) {
        setSelectedLibroId(libroId);
        setSelectedCapId(capId);
        setFocusMode(false);
        setSidebarOpen(true);
      }
      if (!action) return;
      localStorage.removeItem("estudio-caps-action");
      if (action === "nuevo-libro")
        setTimeout(() => setShowNuevoLibro(true), 120);
      if (action === "nuevo-cap") setTimeout(() => setShowNuevoCap(true), 120);
    };
    check();
    window.addEventListener("estudio-caps-action", check);
    return () => window.removeEventListener("estudio-caps-action", check);
  }, []);

  // Si no hay capítulo seleccionado (primera vez, o se borró el libro/cap
  // guardado) apenas cargan los libros abrimos el primero disponible con su
  // primer capítulo, para no dejar la pantalla vacía.
  useEffect(() => {
    if (selectedCapId || loadingLibros || libros.length === 0) return;
    const libro = libros.find((l) => l.id === selectedLibroId) ?? libros[0];
    void (async () => {
      const caps = await cargarCapsLibro(libro.id);
      setSelectedLibroId(libro.id);
      if (caps.length > 0) setSelectedCapId(caps[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingLibros, libros.length]);

  // Reordenar capítulos (drag-and-drop en la sidebar). `orderedIds` ya viene
  // en el nuevo orden deseado — reindexamos 1..n y guardamos.
  // Optimista: el estado local se actualiza al toque (se siente instantáneo);
  // capUpdateMeta ya maneja offline/pending por su cuenta, así que si falla
  // la red el cambio queda encolado igual que el resto de la app.
  const handleReorderCaps = (libroId: string, orderedIds: string[]) => {
    const capsActuales = porLibro[libroId] ?? [];
    const porId = new Map(capsActuales.map((c) => [c.id, c]));
    const reindexados = orderedIds
      .map((id, i) => {
        const c = porId.get(id);
        return c ? { ...c, orden: i + 1 } : null;
      })
      .filter((c): c is Capitulo => c !== null);

    setPorLibro((prev) => ({ ...prev, [libroId]: reindexados }));

    void Promise.all(
      reindexados.map((c) =>
        capUpdateMeta(c.id, { orden: c.orden }).catch(() => {}),
      ),
    );
  };

  const handleSelectCap = (libroId: string, capId: string) => {
    setSelectedLibroId(libroId);
    setSelectedCapId(capId);
    setFocusMode(false);
    setSidebarOpen(true);
  };

  const handleCapCreada = (cap: Capitulo) => {
    setPorLibro((prev) => ({
      ...prev,
      [cap.libro_id]: [...(prev[cap.libro_id] ?? []), cap],
    }));
    setSelectedLibroId(cap.libro_id);
    setSelectedCapId(cap.id);
    setCapRefreshKey((k) => k + 1);
  };

  const handleLibroCreado = async (titulo: string) => {
    const { data, error } = await addLibro({
      titulo: titulo.trim().toUpperCase(),
      estado: "BORRADOR",
      visibilidad: "oculto",
    });
    if (error || !data) throw new Error(error ?? "Error al crear libro");
    setShowNuevoLibro(false);
    setShowNuevoCap(true);
    setSelectedLibroId(data.id);
  };

  const handleCapEliminada = async (id: string, libroId: string) => {
    try {
      await capDelete(id);
      setPorLibro((prev) => ({
        ...prev,
        [libroId]: (prev[libroId] ?? []).filter((c) => c.id !== id),
      }));
      if (selectedCapId === id) setSelectedCapId(null);
      setCapRefreshKey((k) => k + 1);
    } catch {}
  };

  const handleLibroEliminado = async (libroId: string) => {
    try {
      await libroDelete(libroId);
      setLibros((prev) => prev.filter((l) => l.id !== libroId));
      setPorLibro((prev) => {
        const next = { ...prev };
        delete next[libroId];
        return next;
      });
      if (selectedLibroId === libroId) {
        setSelectedLibroId(null);
        setSelectedCapId(null);
      }
      setCapRefreshKey((k) => k + 1);
    } catch {}
  };

  const libroActivo = libros.find((l) => l.id === selectedLibroId);
  const hayCapAbierto = !!selectedCapId && !!selectedLibroId;

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* ── Barra superior del libro — se re-sincroniza sola al cambiar de libro ── */}
        {hayCapAbierto && (
          <BarraLibro
            capitulos={capitulosLibroActivo}
            libro={libroActivo}
            onLibroChange={handleLibroEditado}
          />
        )}

        {/* ── Contenido principal: sidebar de libros/caps + editor, todo en una pantalla ── */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <SidebarLibros
            libros={libros}
            loadingCapsIds={loadingCapsIds}
            loadingLibros={loadingLibros}
            open={sidebarOpen}
            porLibro={porLibro}
            selectedCapId={selectedCapId}
            selectedLibroId={selectedLibroId}
            onCargarCapsLibro={cargarCapsLibro}
            onDeleteCap={handleCapEliminada}
            onDeleteLibro={handleLibroEliminado}
            onNuevoCap={(libroId) => {
              setSelectedLibroId(libroId);
              setShowNuevoCap(true);
            }}
            onNuevoLibro={() => setShowNuevoLibro(true)}
            onReorderCaps={handleReorderCaps}
            onSelectCap={handleSelectCap}
            onToggleSidebar={() => setSidebarOpen((o) => !o)}
          />

          {/* Editor del capítulo activo */}
          {hayCapAbierto ? (
            <div className="flex-1 min-h-0 flex overflow-hidden">
              <PanelEditor
                key={selectedCapId}
                capId={selectedCapId!}
                focusMode={focusMode}
                libroId={selectedLibroId!}
                sidebarOpen={sidebarOpen}
                onCapitulosChange={() => {
                  setCapRefreshKey((k) => k + 1);
                  if (selectedLibroId) void reloadCapsLibro(selectedLibroId);
                }}
                onToggleFocus={() => setFocusMode((m) => !m)}
                onToggleSidebar={() => setSidebarOpen((o) => !o)}
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 text-primary/20">
              <BookMarked size={28} />
              <p className="text-micro font-black uppercase tracking-widest text-center px-4">
                {loadingLibros
                  ? "Cargando…"
                  : libros.length === 0
                    ? "Sin libros · crea el primero"
                    : "Elige un capítulo en la barra lateral"}
              </p>
              {!loadingLibros && libros.length === 0 && (
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-btn)] bg-primary/8 hover:bg-primary/15 text-primary/50 hover:text-primary text-micro font-black uppercase tracking-widest transition-all"
                  onClick={() => setShowNuevoLibro(true)}
                >
                  <Plus size={10} /> Nuevo Libro
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showNuevoLibro && (
        <ModalNuevoLibro
          onClose={() => setShowNuevoLibro(false)}
          onCreated={handleLibroCreado}
        />
      )}
      {showNuevoCap && selectedLibroId && (
        <ModalNuevoCapitulo
          libroId={selectedLibroId}
          ordenSiguiente={capitulosLibroActivo.length + 1}
          onClose={() => setShowNuevoCap(false)}
          onCreated={handleCapCreada}
        />
      )}
    </>
  );
}

export default function EstudioCapitulos() {
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-bg-main">
      <EntidadesLoreProvider>
        <EditorCapitulosPanel />
      </EntidadesLoreProvider>
    </div>
  );
}
