"use client";
/**
 * RichEditor.tsx
 * ──────────────
 * Reemplaza el MarkdownEditor.tsx basado en <textarea> + SnippetOverlay.
 *
 * Diferencias clave:
 *   - Los snippets son NODOS REALES del documento (DropNode, SoundNode, etc.)
 *     → el chip ocupa su espacio real, el texto fluye alrededor de verdad
 *     → ya no hay overlay ni "trampa" de tapar texto con un div encima
 *   - Mismo formato de guardado: [[drop|...]], [[sound|...]], etc.
 *     → parseContenido(), ContenidoInteractivo, SegmentRenderers: sin cambios
 *   - Markdown shortcuts preservados (**, *, #, ##, etc.)
 *   - Modo preview genérico vía prop `renderPreview` — cada consumidor
 *     decide cómo renderizar. EditorCapitulos pasa ContenidoInteractivo
 *     (mismo componente del lector real) para resolver [[drop|...]] y
 *     similares; sin esa prop, cae a un fallback local de markdown
 *     plano (sin dependencia de features/ ni de markdownRenderer.ts).
 *   - SnippetCommandPalette existente conectado sin cambios
 *
 * Props compatibles con las del MarkdownEditor anterior para simplificar
 * la migración en EditorCapitulos.tsx.
 */
import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListNode, ListItemNode } from "@lexical/list";

import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { QuoteNode } from "@lexical/rich-text";
import {
  VariantHeadingNode,
  $isVariantHeadingNode,
  stripVariantSuffix,
  RICH_TRANSFORMERS,
} from "./nodes/VariantHeadingNode";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  FORMAT_TEXT_COMMAND,
} from "lexical";
import { $setBlocksType } from "@lexical/selection";
import type { EditorState, LexicalEditor, LexicalNode } from "lexical";
import { Edit3, Eye, Columns2, SpellCheck2 } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AutoClosePlugin } from "./plugins/AutoClosePlugin";
import {
  FindReplacePlugin,
  initialFindReplaceState,
  type FindReplaceState,
} from "./plugins/FindReplacePlugin";
import { HeadingBackspacePlugin } from "./plugins/HeadingBackspacePlugin";
import { ListBackspacePlugin } from "./plugins/ListBackspacePlugin";
import {
  MarkdownCommandInsertPlugin,
  MarkdownCommandPalette,
  filterMarkdownCommands,
  MARKDOWN_COMMAND_ITEMS,
} from "./plugins/MarkdownCommandPalette";
import { ChoiceNode } from "./nodes/ChoiceNode";
import { DropNode } from "./nodes/DropNode";
import { FlagNode } from "./nodes/FlagNode";
import { CondicionNode } from "./nodes/CondicionNode";
import { ImgNode } from "./nodes/ImgNode";
import { SectionNode, $createSectionNode, SectionCloserView } from "./nodes/SectionNode";
import {
  snippetEditHandler,
  setKnownSectionIds,
  createMissingSectionHandler,
  type SnippetEditRequest,
} from "./nodes/sharedTypes";
import { SoundNode } from "./nodes/SoundNode";
import { UseNode } from "./nodes/UseNode";
import { WikilinkNode, wikilinkNavigateHandler } from "./nodes/WikilinkNode";
import {
  rawTextToLexicalTree,
  serializeRootToRaw,
  insertSnippetNode,
} from "./richTextSerializer";
import { SlashCommandPlugin, type SlashMatch } from "./plugins/SlashCommandPlugin";
import { TABLE_NODES, TablePlugin, insertTable } from "./plugins/TablePlugin";
import { TocPanel } from "./plugins/TocPlugin";
import { WikilinkMenuPanel, type WikiEntity } from "./WikilinkMenuPanel";
import { WikilinkPlugin, type WikilinkMatch } from "./plugins/WikilinkPlugin";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type ViewMode = "edit" | "preview" | "split";

/**
 * Comandos de formato aplicables desde afuera del editor vía
 * formatCommandRef (ver RichEditorProps). Dos familias:
 *   - Formato de texto en línea (bold/italic/underline/strikethrough):
 *     aplican sobre la SELECCIÓN actual, vía FORMAT_TEXT_COMMAND nativo.
 *   - Formato de bloque (h1-h4, alineación, cita, listas): mismos ids que
 *     MARKDOWN_COMMAND_ITEMS del menú "/", para no duplicar la lógica de
 *     inserción — FormatCommandPlugin delega en MARKDOWN_COMMAND_ITEMS
 *     para estos casos.
 */
export type RichEditorFormatCommand =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "paragraph"
  | "bullet"
  | "numbered"
  | "quote"
  | "align-left"
  | "align-center"
  | "align-right"
  | "align-justify"
  // Variantes de heading (independientes del nivel h1-h4) — ver
  // applyHeadingVariant en MarkdownCommandPalette.tsx. Mismos ids que
  // MARKDOWN_COMMAND_ITEMS, aplican el ornamento al heading donde está
  // el cursor sin cambiar su nivel.
  | "variant-linea"
  | "variant-barra"
  | "variant-portada"
  | "variant-dropcap"
  | "variant-primeramayuscula"
  | "variant-none";

export interface RichEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number | string;
  maxHeight?: number | string;
  /**
   * Si se pasa `mode` SIN `onModeChange`, el toggle interno de RichEditor
   * (Editar/Split/Preview) NO se renderiza — el padre controla el modo
   * por su cuenta (ej. EditorCapitulos usa el botón "Modo foco" para
   * alternar edit/split) y sin esto el toggle quedaba montado pero sin
   * efecto real: clickearlo solo actualizaba un estado interno invisible,
   * porque `mode` (prop) siempre ganaba sobre el estado interno.
   * Si además pasás `onModeChange`, el toggle sí se muestra y queda
   * sincronizado con tu estado externo (ver EditorEnsayo.tsx).
   */
  mode?: ViewMode;
  onModeChange?: (mode: ViewMode) => void;
  autoFocus?: boolean;
  /**
   * false deshabilita la edición (ContentEditable no editable) sin ocultar
   * el contenido — pensado para el estado "cargando datos reales del
   * capítulo todavía no llegaron" en EditorCapitulos. Evita que el usuario
   * pueda escribir sobre un editor cuyo `value` todavía no es el contenido
   * real del capítulo (lo cual, combinado con el guard de EditorCapitulos,
   * es la defensa completa contra el bug de "carga lenta → autosave vacío
   * pisa el capítulo real"). Default true (comportamiento normal).
   */
  editable?: boolean;
  /** Ref imperativo para insertar snippets desde EditorCapitulos */
  insertRef?: React.MutableRefObject<((raw: string) => void) | null>;
  /**
   * Ref imperativo para insertar una tabla en la posición del cursor.
   * El padre lo invoca desde su palette al elegir el comando "/tabla"
   * (o el item "table" de COMMAND_ITEMS si reutiliza ese menú).
   */
  insertTableRef?: React.MutableRefObject<
    ((rows?: number, cols?: number) => void) | null
  >;
  /**
   * Ref imperativo para aplicar comandos de formato desde un panel externo
   * (ej. la tab "formato" de NotaPanel en EditorEnsayo). Cubre lo mismo que
   * el menú "/" (MARKDOWN_COMMAND_ITEMS) pero invocable con un solo click
   * desde fuera del árbol de Lexical, sin que el usuario tenga que escribir
   * "/" dentro del editor. Además de los bloques (headings, alineación)
   * cubre formato de texto en línea (bold/italic/etc) que el menú "/" no
   * maneja porque opera sobre selección, no sobre el bloque completo.
   */
  formatCommandRef?: React.MutableRefObject<
    ((commandId: RichEditorFormatCommand) => void) | null
  >;
  /** Handler de edición de un snippet existente → abre SnippetCommandPalette */
  onSnippetEdit?: (req: SnippetEditRequest<any>) => void;
  /**
   * Se llama cuando el usuario escribe "/" para abrir el menú de comandos.
   * El padre (EditorCapitulos) abre su <SnippetCommandPalette/> en
   * anchorRect. Al elegir un comando, debe llamar a removeSlashQuery()
   * (expuesto vía slashRemoveRef) antes de insertar el snippet, para
   * borrar el "/texto" que quedó escrito.
   */
  onOpenPalette?: (
    anchorRect: { top: number; left: number },
    query: string,
  ) => void;
  /** Se llama con null cuando el "/" deja de coincidir (se cierra el menú) */
  onClosePalette?: () => void;
  /**
   * Ref imperativo: el padre lo invoca cuando SnippetCommandPalette se
   * cierra por CUALQUIER motivo (click afuera, Escape, o tras insertar
   * un comando). Sin esto, el plugin de "/" queda "trabado" en estado
   * abierto para siempre después del primer uso, porque nada le avisa
   * que puede volver a escuchar.
   */
  closePaletteRef?: React.MutableRefObject<(() => void) | null>;
  /** Entidades para autocompletado de wikilinks (opcional) */
  wikiEntities?: { name: string; type: string }[];
  /**
   * Se llama cuando el usuario hace click en un wikilink [[Nombre]] ya
   * insertado en el editor (tanto en modo edición como en preview).
   * Sin esta prop, los wikilinks se renderizan pero no navegan a nada.
   */
  onWikilinkNavigate?: (target: string) => void;
  /**
   * false oculta TODO el toggle de modo (Editar/Split/Vista previa) —
   * pensado para editores de notas/ensayos donde el markdown ya se ve
   * formateado en modo edición (bold, listas, headers reales, no texto
   * crudo con asteriscos), así que ni Split ni Preview aportan nada
   * distinto de Edit. Default true porque EditorCapitulos (con
   * ContenidoInteractivo) sí lo necesita: preview ahí resuelve
   * drop/choice/gate, visualmente muy distinto del raw.
   */
  showSplitMode?: boolean;
  /**
   * Nodo extra para renderizar en la toolbar interna, justo a la derecha
   * del toggle de corrector ortográfico. Pensado para acciones del padre
   * que necesitan vivir visualmente "dentro" del editor en vez de en una
   * barra externa — ej. el botón "+ bloque" de LayoutCanvas en
   * EditorEnsayo/EditorCapitulos. Opcional: si no se pasa, la toolbar se
   * ve exactamente igual que antes.
   */
  extraToolbarAction?: React.ReactNode;
  /**
   * Cómo renderizar el panel de "Preview"/"Split". RichEditor es
   * genérico — no todos los consumidores usan el formato [[kind|...]]
   * de snippets (drop/choice/gate/etc). Por defecto usa un fallback
   * local de markdown plano (bold/italic/code/wikilinks + soft-break
   * vs blank-line), sin dependencias de features/.
   *
   * EditorCapitulos debe pasar una función que use ContenidoInteractivo
   * (el mismo componente del lector real) para que el preview resuelva
   * [[drop|...]], [[choice|...]], etc. correctamente — con el fallback
   * genérico esos snippets se muestran como texto raw literal, porque
   * ese fallback solo entiende markdown normal y wikilinks simples.
   *
   *   // En EditorCapitulos.tsx:
   *   renderPreview={(raw) => (
   *     <ContenidoInteractivo texto={raw} onNavigate={() => {}} />
   *   )}
   *
   * Otros editores que solo necesiten markdown normal no pasan nada y
   * siguen funcionando igual que siempre.
   */
  renderPreview?: (raw: string) => React.ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config del composer (nodos registrados)
// ─────────────────────────────────────────────────────────────────────────────

// RICH_TRANSFORMERS (con soporte de variante en headings) se importa desde
// VariantHeadingNode.tsx — fuente única compartida con richTextSerializer.ts.

const RICH_EDITOR_NODES = [
  VariantHeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  LinkNode,
  DropNode,
  SoundNode,
  ImgNode,
  ChoiceNode,
  UseNode,
  CondicionNode,
  FlagNode,
  SectionNode,
  WikilinkNode,
  ...TABLE_NODES,
];

// ─────────────────────────────────────────────────────────────────────────────
// Plugin: carga el contenido inicial desde el raw string
// ─────────────────────────────────────────────────────────────────────────────

function InitialContentPlugin({
  initialRaw,
  skipNextChangeRef,
}: {
  initialRaw: string;
  skipNextChangeRef: React.MutableRefObject<boolean>;
}) {
  const [editor] = useLexicalComposerContext();
  const isFirstRun = useRef(true);

  useEffect(() => {
    // En vez de rastrear "quién emitió este valor" con una ref que puede
    // desincronizarse entre cambios de capítulo (causaba que el editor
    // quedara vacío al seleccionar un capítulo con contenido real),
    // comparamos directamente contra lo que el árbol de Lexical tiene
    // AHORA MISMO serializado. Si coincide, no tocamos nada (evita perder
    // cursor/foco mientras el usuario escribe). Si no coincide —porque es
    // la carga inicial, cambiaste de capítulo, o llegó un refresh remoto
    // con contenido distinto— recargamos el árbol completo.
    const currentSerialized = isFirstRun.current
      ? null
      : editor.read(() => serializeRootToRaw());

    if (!isFirstRun.current && currentSerialized === initialRaw) {
      return;
    }
    isFirstRun.current = false;

    // editor.update() dispara OnChangePlugin igual que si el usuario
    // hubiera tecleado — Lexical no distingue "cambio programático" de
    // "cambio del usuario". Sin este flag, cargar el contenido real del
    // capítulo (carga inicial, cambio de capítulo, o refresh remoto)
    // generaba un onChange(raw) fantasma que el padre (EditorCapitulos)
    // interpretaba como una edición real del usuario: seteaba
    // saveStatus="saving" y arrancaba el debounce de guardado, mostrando
    // "Guardando…" apenas se abría el capítulo aunque nadie hubiera
    // escrito nada todavía.
    skipNextChangeRef.current = true;

    editor.update(() => {
      rawTextToLexicalTree(initialRaw);
    });
  }, [editor, initialRaw, skipNextChangeRef]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin: sincroniza editor.setEditable() con la prop `editable` de forma
// reactiva. initialConfig.editable solo cubre el primer mount — esto cubre
// cambios posteriores (ej: EditorCapitulos pasa editable={false} mientras
// el capítulo todavía está cargando, y luego lo habilita cuando cap llega).
// Con esto el usuario NO puede escribir en el editor mientras está en
// estado "cargando", cortando de raíz la posibilidad de que un onChange
// con contenido fantasma dispare un guardado que pise el capítulo real.
// ─────────────────────────────────────────────────────────────────────────────

function EditablePlugin({ editable }: { editable: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin: si el usuario tipea manualmente "{barra}" (o linea/portada/dropcap)
// al final de un heading, lo convierte en la variante real en vez de dejarlo
// como texto literal. VARIANT_SUFFIX_RE/stripVariantSuffix (ver
// nodes/VariantHeadingNode.tsx) ya se usan para el round-trip de
// guardado/carga vía richTextSerializer.ts — este transform cubre el caso
// EN VIVO, mientras se escribe, para que el comportamiento sea consistente
// sin importar si la variante se "recuerda" desde antes (recarga) o se
// escribe a mano ahora mismo. Sin este plugin, "{barra}" tipeado a mano
// quedaría como texto visible normal hasta el próximo guardado/recarga.
function VariantSuffixTransformPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerNodeTransform(VariantHeadingNode, (heading) => {
      const textChildren = heading.getChildren().filter((c) => c.getType() === "text");
      const lastText = textChildren[textChildren.length - 1] as
        | (LexicalNode & { getTextContent(): string; setTextContent(t: string): unknown })
        | undefined;
      if (!lastText) return;
      const raw = lastText.getTextContent() as string;
      const { text, variant } = stripVariantSuffix(raw);
      if (variant === "none") return;
      lastText.setTextContent(text.trimEnd());
      if (heading.getVariant() !== variant) heading.setVariant(variant);
    });
  }, [editor]);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin: expone insertRef para que EditorCapitulos pueda insertar snippets
// ─────────────────────────────────────────────────────────────────────────────

function InsertSnippetPlugin({
  insertRef,
  slashRemoveRef,
}: {
  insertRef: React.MutableRefObject<((raw: string) => void) | null>;
  slashRemoveRef: React.MutableRefObject<(() => void) | null>;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    insertRef.current = (raw: string) => {
      // Si había un "/query" pendiente de cuando se abrió la palette,
      // lo borramos antes de insertar el nodo del snippet elegido.
      slashRemoveRef.current?.();
      editor.update(() => insertSnippetNode(raw));
    };
  }, [editor, insertRef, slashRemoveRef]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin: mantiene knownSectionIds sincronizado con las SectionNode reales
// del documento (para pintar destino válido/roto en choice/condicion/use),
// y registra el handler que crea una SectionNode faltante al final del
// documento cuando el autor hace click en "Crear sección faltante".
// ─────────────────────────────────────────────────────────────────────────────

function SectionGraphPlugin({
  onHasSectionsChange,
}: {
  onHasSectionsChange?: (has: boolean) => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const syncSectionIds = () => {
      editor.getEditorState().read(() => {
        const ids = new Set<string>();
        const root = $getRoot();
        const visit = (node: any) => {
          if (node.getType?.() === "section-snippet") {
            const p = node.getPayload?.();
            if (p?.id) ids.add(p.id);
          }
          const children = node.getChildren?.();
          if (children) children.forEach(visit);
        };
        visit(root);
        setKnownSectionIds(ids);
        onHasSectionsChange?.(ids.size > 0);
      });
    };

    syncSectionIds();
    return editor.registerUpdateListener(() => syncSectionIds());
  }, [editor, onHasSectionsChange]);

  useEffect(() => {
    createMissingSectionHandler.current = (id: string) => {
      editor.update(() => {
        const root = $getRoot();
        root.append($createSectionNode({ id, label: id }));
      });
    };
    return () => {
      createMissingSectionHandler.current = null;
    };
  }, [editor]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin: extiende la barra vertical (border-left) de cada H3 hacia abajo
// hasta el próximo heading de nivel <= 3 (otro H3, o un H2/H1), para que la
// línea "abrace" visualmente todo el contenido de esa sub-sección en vez de
// ser una rayita corta pegada solo al título. Además marca con
// data-in-h3-section="true" a cada bloque (párrafo, lista, etc. — cualquier
// top-level child que NO sea heading) que cae dentro de esa sección, para
// que el theme pueda darles sangría (pl-3, igual que el H4) y así no choquen
// visualmente con la barra que ahora pasa por al lado.
//
// Por qué necesita JS (no se puede resolver con CSS de hermanos): la altura
// de la barra depende de CUÁNTO contenido variable hay entre este H3 y el
// próximo heading de rango mayor o igual — un dato que solo conocemos
// midiendo el DOM real después de cada render, no algo expresable con
// selectores CSS estáticos. Lo mismo aplica para saber CUÁLES bloques caen
// "dentro" de la sección: depende del orden real de los nodos del documento,
// no de un patrón de hermanos fijo.
//
// Cómo funciona:
//   1. Tras cada update del editor, recorre TODOS los top-level children.
//   2. Para cada H3, busca el próximo heading con tag h1/h2/h3 (se detiene
//      ahí — un h4 no corta la sección, sigue perteneciendo a este H3) y
//      mide con getBoundingClientRect() la distancia real hasta ahí.
//   3. Escribe esa altura como CSS custom property (--h3-rail-h) en el
//      propio elemento DOM del H3 — el border-left "extendido" se dibuja
//      con un pseudo-elemento ::after posicionado absoluto que lee esa
//      variable (ver theme.heading.h3 más abajo).
//   4. Marca con data-in-h3-section="true" cada nodo NO-heading entre un H3
//      y el siguiente heading de nivel <=3, y lo limpia (removeAttribute)
//      en cualquier otro caso — necesario porque el usuario puede borrar un
//      H3 y ese párrafo debe perder la sangría en el próximo render.
function HeadingRailPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const updateRails = () => {
      // Lista ordenada de TODOS los top-level children con su key, tag
      // ("h1".."h6" para headings, null para el resto) — necesitamos el
      // documento completo, no solo los headings, para poder marcar los
      // párrafos intermedios de cada sección.
      const nodes: { key: string; tag: string | null; variant: string | null }[] = [];
      editor.getEditorState().read(() => {
        const children = $getRoot().getChildren();
        for (const child of children) {
          if ($isVariantHeadingNode(child)) {
            const tag = child.getTag(); // "h1".."h6"
            nodes.push({ key: child.getKey(), tag: tag ?? "h1", variant: child.getVariant() });
          } else {
            nodes.push({ key: child.getKey(), tag: null, variant: null });
          }
        }
      });

      const rootEl = editor.getRootElement();
      if (!rootEl) return;
      const rootRect = rootEl.getBoundingClientRect();

      nodes.forEach((n, i) => {
        // La barra extendida (::after con altura variable) es propia de
        // la variante "barra" — ANTES estaba atada al nivel h3; ahora
        // cualquier heading (h1-h4) puede llevar esta variante, así que
        // el trigger es n.variant, no n.tag.
        if (n.variant !== "barra") return;
        const el = editor.getElementByKey(n.key) as HTMLElement | null;
        if (!el) return;

        // Buscar el próximo heading (cualquier nivel) — corta ahí la
        // barra y la sangría de sección. También vamos marcando cada nodo
        // NO-heading en el camino con data-in-h3-section, hasta llegar al
        // stop (o al final del documento).
        let stopEl: HTMLElement | null = null;
        let stopIdx = nodes.length;
        for (let j = i + 1; j < nodes.length; j++) {
          if (nodes[j].tag !== null) {
            stopEl = editor.getElementByKey(nodes[j].key) as HTMLElement | null;
            stopIdx = j;
            break;
          }
        }
        for (let j = i + 1; j < stopIdx; j++) {
          if (nodes[j].tag !== null) continue; // otro heading: no se toca acá
          const bodyEl = editor.getElementByKey(nodes[j].key) as HTMLElement | null;
          bodyEl?.setAttribute("data-in-h3-section", "true");
        }

        const startTop = el.getBoundingClientRect().top;
        const endTop = stopEl
          ? stopEl.getBoundingClientRect().top
          : rootRect.bottom;

        // Alto de la barra: desde el tope del H3 hasta el tope del próximo
        // heading relevante (o el fondo del editor si es el último). Se
        // resta la altura del propio H3 porque el ::after arranca desde
        // abajo de su bloque, no desde su tope — así no se solapa con la
        // línea corta que ya dibuja border-l en el propio H3.
        //
        // STOP_GAP_PX: además, si hay un próximo heading (stopEl !== null),
        // recortamos unos píxeles extra para que la barra termine ANTES de
        // tocar ese heading — sin esto, la línea llegaba justo hasta el
        // borde superior del siguiente título y se sentía "pegada"/como si
        // lo tocara, en vez de leerse como el cierre de la sección
        // anterior. Si no hay próximo heading (es la última sección del
        // documento), no aplica: ahí la barra sí llega hasta el fondo real
        // del contenido.
        const STOP_GAP_PX = 12;
        const ownHeight = el.getBoundingClientRect().height;
        const gap = stopEl ? STOP_GAP_PX : 0;
        const railHeight = Math.max(0, endTop - startTop - ownHeight - gap);

        el.style.setProperty("--h3-rail-h", `${railHeight}px`);
      });

      // Limpieza: cualquier nodo NO-heading que NO haya sido marcado en
      // este pase (porque ya no está dentro de ninguna sección H3 — el
      // usuario borró el H3, o movió el párrafo afuera) pierde el
      // atributo. Sin esto, un párrafo que salió de una sección quedaría
      // con la sangría "pegada" para siempre.
      const markedKeys = new Set<string>();
      nodes.forEach((n, i) => {
        if (n.variant !== "barra") return;
        let stopIdx = nodes.length;
        for (let j = i + 1; j < nodes.length; j++) {
          if (nodes[j].tag !== null) {
            stopIdx = j;
            break;
          }
        }
        for (let j = i + 1; j < stopIdx; j++) {
          if (nodes[j].tag === null) markedKeys.add(nodes[j].key);
        }
      });
      nodes.forEach((n) => {
        if (n.tag !== null) return;
        if (markedKeys.has(n.key)) return;
        const el = editor.getElementByKey(n.key) as HTMLElement | null;
        el?.removeAttribute("data-in-h3-section");
      });
    };

    updateRails();
    // También recalcular en resize — el reflow del texto puede cambiar
    // cuánto ocupa cada sección aunque el contenido no haya cambiado.
    window.addEventListener("resize", updateRails);
    const unregister = editor.registerUpdateListener(() => {
      // rAF: esperamos al frame siguiente para medir DOM ya actualizado
      // por Lexical (registerUpdateListener dispara antes de que el
      // reconciler termine de pintar en algunos casos).
      requestAnimationFrame(updateRails);
    });
    return () => {
      window.removeEventListener("resize", updateRails);
      unregister();
    };
  }, [editor]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin: expone insertTableRef para que el padre inserte tablas desde /tabla
// ─────────────────────────────────────────────────────────────────────────────

function InsertTablePlugin({
  insertTableRef,
}: {
  insertTableRef?: React.MutableRefObject<
    ((rows?: number, cols?: number) => void) | null
  >;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!insertTableRef) return;
    insertTableRef.current = (rows = 3, cols = 3) => {
      insertTable(editor, rows, cols);
    };
    return () => {
      if (insertTableRef) insertTableRef.current = null;
    };
  }, [editor, insertTableRef]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin: expone formatCommandRef para aplicar comandos de formato desde un
// panel externo (ej. tab "formato" de NotaPanel en EditorEnsayo) sin que el
// usuario tenga que escribir "/" dentro del editor.
//
// Dos caminos según el tipo de comando:
//   - Texto en línea (bold/italic/underline/strikethrough): usa el comando
//     nativo FORMAT_TEXT_COMMAND de Lexical, que alterna el formato sobre
//     la SELECCIÓN actual (igual que Ctrl+B nativo del navegador).
//   - Bloque (headings, alineación, listas, cita): delega en
//     MARKDOWN_COMMAND_ITEMS (mismo array que usa el menú "/"), evitando
//     reimplementar esa lógica de inserción dos veces. Los ids coinciden
//     a propósito con los de MARKDOWN_COMMAND_ITEMS para este subconjunto.
function FormatCommandPlugin({
  formatCommandRef,
}: {
  formatCommandRef?: React.MutableRefObject<
    ((commandId: RichEditorFormatCommand) => void) | null
  >;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!formatCommandRef) return;
    formatCommandRef.current = (commandId) => {
      if (
        commandId === "bold" ||
        commandId === "italic" ||
        commandId === "underline" ||
        commandId === "strikethrough"
      ) {
        editor.focus();
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, commandId);
        return;
      }
      // "paragraph" no existe en MARKDOWN_COMMAND_ITEMS (ese menú solo
      // inserta bloques nuevos, nunca "vuelve a texto normal" — no hace
      // falta ahí porque no hay forma de escribir "/parrafo" con sentido).
      // Este panel sí lo necesita: si el cursor está en un heading, la
      // persona debe poder volver a párrafo normal con un click.
      if (commandId === "paragraph") {
        editor.focus();
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          $setBlocksType(selection, () => $createParagraphNode());
        });
        return;
      }
      const item = MARKDOWN_COMMAND_ITEMS.find((i) => i.id === commandId);
      item?.run(editor);
    };
    return () => {
      if (formatCommandRef) formatCommandRef.current = null;
    };
  }, [editor, formatCommandRef]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle de modo — icon-only, sin caja ni bordes (igual que el mobile toggle
// de MarkdownEditor). Sin botones de formato: bold/italic/etc ya se aplican
// con los shortcuts de markdown (**, *, #...) vía MarkdownShortcutPlugin.
// ─────────────────────────────────────────────────────────────────────────────

function ModeTogglePlugin({
  mode,
  onModeChange,
}: {
  mode: ViewMode;
  onModeChange: (m: ViewMode) => void;
}) {
  const items: { m: ViewMode; Icon: typeof Edit3; title: string }[] = [
    { m: "edit", Icon: Edit3, title: "Editar" },
    { m: "split", Icon: Columns2, title: "Split" },
    { m: "preview", Icon: Eye, title: "Vista previa" },
  ];

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 2,
        padding: "3px 6px",
        flexShrink: 0,
      }}
    >
      {items.map(({ m, Icon, title }) => {
        const isActive = mode === m;
        return (
          <button
            key={m}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 20,
              background: "transparent",
              color: isActive
                ? "color-mix(in srgb, var(--foreground) 60%, transparent)"
                : "color-mix(in srgb, var(--foreground) 18%, transparent)",
              border: "none",
              cursor: "pointer",
              transition: "color 0.1s",
            }}
            title={title}
            type="button"
            onClick={() => onModeChange(m)}
          >
            <Icon size={9} />
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback de preview genérico (sin dominio, sin features/)
// ─────────────────────────────────────────────────────────────────────────────
// RichEditor es UI genérica (editor/lexical/) y no debe
// importar de features/ (mismo principio que ya documentaba MarkdownEditor.tsx:
// "no debe conocer features/"). Por eso este fallback es local y chico, en vez
// de reusar ContenidoInteractivo (que vive en features/garlia/).
//
// Mismo criterio que el resto del sistema (editor Lexical y
// ContenidoInteractivo/TextoMarkdown): una línea en blanco separa párrafos
// reales; un solo "\n" dentro de un bloque es un salto de línea suave (<br/>),
// no un párrafo nuevo.
function applyInlinePlainMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /\[\[([^\]|#]+?)(?:\|([^\]]+))?\]\]/g,
      (_, target: string, alias?: string) => {
        const label = (alias?.trim() || target.trim()).replace(/"/g, "&quot;");
        const safeTarget = target.trim().replace(/"/g, "&quot;");
        return `<a class="wikilink" data-wikilink="${safeTarget}" href="javascript:void(0)" title="Ir a: ${safeTarget}">${label}</a>`;
      },
    )
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/==(.+?)==/g, '<mark class="md-mark">$1</mark>');
}

// Detecta "# ".."#### " al inicio de un bloque (1 a 4 "#", con espacio) —
// mismo límite de niveles que expone MarkdownCommandPalette (H1-H4).
// "#####"/"######" (h5/h6) caen al párrafo normal, igual que antes.
const HEADING_LINE_RE = /^(#{1,4})\s+(.*)$/;

const ACCENT = "var(--color-primary, #7c6af7)";

// Cada nivel de heading tiene su propio lenguaje visual — no un único
// patrón escalado por tamaño — para que la jerarquía se lea de un
// vistazo. Replica en HTML/inline-styles exactamente lo que hace
// theme.heading en initialConfig (más abajo en este archivo) para que
// un heading se vea IGUAL en modo edición y en este fallback de preview.
// No podemos compartir las clases Tailwind del theme de Lexical porque
// ese objeto vive en otro componente (RichEditor no lo exporta), así que
// se replica acá — cambiar un nivel implica tocar ambos lugares.
function renderHeadingBlock(
  level: 1 | 2 | 3 | 4,
  text: string,
  key: number,
  prevLevel: 1 | 2 | 3 | 4 | null,
) {
  const html = applyInlinePlainMarkdown(text);

  // H1 — "portada de sección": centrado, ancho acotado a 500px (mx-auto)
  // para que títulos largos hagan wrap sin desalinear las líneas
  // laterales; las líneas van a los costados vía posicionamiento
  // absoluto dentro de un wrapper relative. Cada costado tiene DOS líneas
  // (una principal + una fina debajo vía boxShadow) — replica en inline
  // styles lo mismo que el theme.heading.h1 de Lexical hace con
  // ::before/::after + box-shadow arbitrario de Tailwind.
  if (level === 1) {
    return (
      <div
        key={key}
        style={{
          position: "relative",
          maxWidth: 500,
          margin: "32px auto 24px",
          padding: "0 20px",
          textAlign: "center",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            width: 12,
            height: 1,
            transform: "translateY(-50%)",
            background: "color-mix(in srgb, " + ACCENT + " 40%, transparent)",
            boxShadow:
              "0 4px 0 -0.5px color-mix(in srgb, " +
              ACCENT +
              " 25%, transparent)",
          }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: "50%",
            right: 0,
            width: 12,
            height: 1,
            transform: "translateY(-50%)",
            background: "color-mix(in srgb, " + ACCENT + " 40%, transparent)",
            boxShadow:
              "0 4px 0 -0.5px color-mix(in srgb, " +
              ACCENT +
              " 25%, transparent)",
          }}
        />
        <span
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.25,
            display: "inline",
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }

  // H2 — línea horizontal completa debajo del título.
  if (level === 2) {
    return (
      <div
        key={key}
        style={{
          margin: "24px 0 16px",
          paddingBottom: 8,
          borderBottom:
            "1px solid color-mix(in srgb, " + ACCENT + " 25%, transparent)",
        }}
      >
        <span
          style={{
            fontSize: "1.25rem",
            fontWeight: 600,
            lineHeight: 1.3,
            display: "block",
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }

  // H3 — barra vertical de acento corta al costado del texto.
  // Si viene inmediatamente después de un H2 (prevLevel === 2), quitamos
  // el margen superior — mismo criterio que "[h2+&]:mt-0" en el theme de
  // Lexical — para que la barra vertical del H3 quede pegada al borde
  // inferior del H2 de arriba, como un solo trazo en L.
  if (level === 3) {
    return (
      <div
        key={key}
        style={{
          position: "relative",
          paddingLeft: 12,
          margin: prevLevel === 2 ? "0 0 8px" : "20px 0 8px",
          borderLeft:
            "2px solid color-mix(in srgb, " + ACCENT + " 50%, transparent)",
        }}
      >
        <span
          style={{
            fontSize: "1.1rem",
            fontWeight: 600,
            lineHeight: 1.3,
            display: "block",
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }

  // H4 — "drop-cap invertido": primera letra grande y de color, resto
  // del texto en tamaño normal. Se separa el primer carácter del resto
  // manualmente (en vez de CSS ::first-letter) porque acá el contenido
  // ya pasó por applyInlinePlainMarkdown y puede empezar con una etiqueta
  // HTML (ej. un wikilink) — ::first-letter tomaría la primera letra del
  // markup, no del texto visible. Tomamos el primer carácter del texto
  // PLANO (antes de convertir a HTML) y renderizamos el resto aparte.
  const firstChar = text.charAt(0);
  const rest = text.slice(1);
  return (
    <div
      key={key}
      style={{ margin: prevLevel === 4 ? "6px 0 6px" : "16px 0 6px" }}
    >
      <span
        style={{
          fontSize: "1.1rem",
          fontWeight: 700,
          color: "color-mix(in srgb, " + ACCENT + " 70%, transparent)",
          lineHeight: 0.8,
          marginRight: 1,
        }}
      >
        {firstChar}
      </span>
      <span
        style={{ fontSize: "0.95rem", fontWeight: 600 }}
        dangerouslySetInnerHTML={{ __html: applyInlinePlainMarkdown(rest) }}
      />
    </div>
  );
}

function PlainMarkdownFallback({ value }: { value: string }) {
  const bloques = value.split(/\n{2,}/);
  // Rastrea el nivel del ÚLTIMO heading renderizado (bloques vacíos o de
  // texto normal no lo tocan) para que renderHeadingBlock pueda achicar el
  // margen cuando dos headings de niveles específicos quedan adyacentes
  // (H2→H3, H4→H4) — ver comentarios dentro de renderHeadingBlock.
  let prevHeadingLevel: 1 | 2 | 3 | 4 | null = null;
  return (
    <>
      {bloques.map((bloque, bi) => {
        if (bloque.trim() === "") {
          return (
            <p key={bi} aria-hidden style={{ margin: 0, minHeight: "1em" }} />
          );
        }

        const headingMatch = HEADING_LINE_RE.exec(bloque);
        if (headingMatch) {
          const level = Math.min(4, headingMatch[1].length) as 1 | 2 | 3 | 4;
          const block = renderHeadingBlock(
            level,
            headingMatch[2],
            bi,
            prevHeadingLevel,
          );
          prevHeadingLevel = level;
          return block;
        }
        prevHeadingLevel = null;

        const lineas = bloque.split("\n");
        return (
          <p key={bi} style={{ margin: "0 0 0.6em 0" }}>
            {lineas.map((linea, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                <span
                  dangerouslySetInnerHTML={{
                    __html: applyInlinePlainMarkdown(linea),
                  }}
                />
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RichEditor
// ─────────────────────────────────────────────────────────────────────────────

export function RichEditor({
  value,
  onChange,
  placeholder = "Escribe aquí…",
  minHeight = "12rem",
  maxHeight,
  mode: modeProp,
  onModeChange,
  autoFocus = false,
  editable = true,
  insertRef,
  insertTableRef,
  formatCommandRef,
  onSnippetEdit,
  onOpenPalette,
  onClosePalette,
  closePaletteRef,
  wikiEntities,
  onWikilinkNavigate,
  showSplitMode = true,
  renderPreview,
  extraToolbarAction,
}: RichEditorProps) {
  const [internalMode, setInternalMode] = useState<ViewMode>("edit");
  const mode = modeProp ?? internalMode;
  const handleModeChange = onModeChange ?? setInternalMode;
  const [hasSections, setHasSections] = useState(false);
  // Toggle de corrector ortográfico nativo del navegador (spellCheck de
  // ContentEditable). Persistido en localStorage porque es una preferencia
  // de la persona que escribe, no del documento — debe mantenerse igual al
  // cambiar de capítulo/ensayo o recargar la página. Arranca en `true`
  // (comportamiento actual, sin cambios, para quien nunca lo tocó).
  const [spellCheckOn, setSpellCheckOn] = useState(true);
  useEffect(() => {
    const stored = localStorage.getItem("rich-editor-spellcheck");
    if (stored !== null) setSpellCheckOn(stored === "true");
  }, []);
  const toggleSpellCheck = useCallback(() => {
    setSpellCheckOn((prev) => {
      const next = !prev;
      localStorage.setItem("rich-editor-spellcheck", String(next));
      return next;
    });
  }, []);

  // Conecta el handler global de edición de snippets con la callback del padre
  useEffect(() => {
    snippetEditHandler.current = onSnippetEdit ?? null;
  }, [onSnippetEdit]);

  // Conecta el handler global de navegación de wikilinks — mismo patrón
  // que snippetEditHandler, necesario porque DecoratorNode no puede
  // recibir props del árbol de React directamente.
  useEffect(() => {
    wikilinkNavigateHandler.current = onWikilinkNavigate ?? null;
    return () => {
      wikilinkNavigateHandler.current = null;
    };
  }, [onWikilinkNavigate]);

  // ── Wikilink menu state ───────────────────────────────────────────────
  const [wikiMenu, setWikiMenu] = useState<{
    open: boolean;
    query: string;
    selectedIdx: number;
    pos: { top: number; left: number };
  }>({ open: false, query: "", selectedIdx: 0, pos: { top: 0, left: 0 } });
  const wikiMenuRef = useRef<HTMLDivElement>(null);
  const wikiInsertRef = useRef<((target: string) => void) | null>(null);
  const wikiNotifyClosedRef = useRef<(() => void) | null>(null);

  const normalizedWikiEntities: WikiEntity[] = wikiEntities ?? [];
  const filteredWikiEntities = wikiMenu.query
    ? normalizedWikiEntities.filter((e) =>
        e.name.toLowerCase().includes(wikiMenu.query.toLowerCase()),
      )
    : normalizedWikiEntities;

  const handleWikilinkMatch = useCallback((match: WikilinkMatch | null) => {
    if (match) {
      setWikiMenu({
        open: true,
        query: match.query,
        selectedIdx: 0,
        pos: match.anchorRect,
      });
    } else {
      setWikiMenu((m) => ({ ...m, open: false }));
    }
  }, []);

  const closeWikiMenu = useCallback(() => {
    setWikiMenu((m) => ({ ...m, open: false }));
    wikiNotifyClosedRef.current?.();
  }, []);

  const selectWikiEntity = useCallback((entity: WikiEntity) => {
    wikiInsertRef.current?.(entity.name);
    setWikiMenu((m) => ({ ...m, open: false }));
  }, []);

  // ── Find & Replace state ──────────────────────────────────────────────
  const [findReplace, setFindReplace] = useState<FindReplaceState>(
    initialFindReplaceState,
  );
  const [tocOpen, setTocOpen] = useState(false);

  // Ref interno para insertar snippets (si el padre no pasa el suyo)
  const internalInsertRef = useRef<((raw: string) => void) | null>(null);
  const activeInsertRef = insertRef ?? internalInsertRef;

  // Borra el "/query" pendiente del documento — InsertSnippetPlugin lo
  // invoca automáticamente antes de insertar el nodo elegido.
  const slashRemoveRef = useRef<(() => void) | null>(null);

  // Le avisa al plugin que la palette se cerró (por cualquier motivo)
  // para que vuelva a escuchar el próximo "/". Sin esto, tras la
  // primera apertura el plugin quedaba permanentemente en estado
  // "activo" y ya no detectaba nuevos "/".
  const notifyClosedRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!closePaletteRef) return;
    closePaletteRef.current = () => {
      notifyClosedRef.current?.();
    };
    return () => {
      if (closePaletteRef) closePaletteRef.current = null;
    };
  }, [closePaletteRef]);

  // ── Panel de "/" para markdown (modo NORMAL, sin onOpenPalette) ──────
  // Modo libro (EditorCapitulos) pasa onOpenPalette y usa su propio
  // SnippetCommandPalette — este estado interno queda sin uso en ese
  // caso. Modo normal no pasa onOpenPalette, así que RichEditor abre
  // su propio panel de comandos markdown en vez de delegarlo al padre.
  const [mdPalette, setMdPalette] = useState<{
    open: boolean;
    query: string;
    pos: { top: number; left: number };
    selectedIdx: number;
  }>({ open: false, query: "", pos: { top: 0, left: 0 }, selectedIdx: 0 });
  const mdInsertRef = useRef<((itemId: string) => void) | null>(null);

  const filteredMdCommands = useMemo(
    () => filterMarkdownCommands(mdPalette.query),
    [mdPalette.query],
  );

  const handleSlashMatch = useCallback(
    (match: SlashMatch | null) => {
      if (onOpenPalette || onClosePalette) {
        // Modo libro: delega 100% al padre, comportamiento sin cambios.
        if (match) onOpenPalette?.(match.anchorRect, match.query);
        else onClosePalette?.();
        return;
      }
      // Modo normal: RichEditor maneja su propio panel de markdown.
      if (match) {
        // selectedIdx se resetea a 0 en cada match nuevo (typing "/" de
        // cero) pero SE CONSERVA si solo cambió la query mientras el
        // panel ya estaba abierto — clampeado abajo, en el useEffect.
        setMdPalette((s) => ({
          open: true,
          query: match.query,
          pos: match.anchorRect,
          selectedIdx: s.open ? s.selectedIdx : 0,
        }));
      } else {
        setMdPalette((s) => ({ ...s, open: false }));
      }
    },
    [onOpenPalette, onClosePalette],
  );

  // Si la query cambia y el índice seleccionado queda fuera de rango de
  // la lista filtrada (ej: escribiste más letras y ahora hay menos
  // resultados), lo clampeamos al último item válido.
  useEffect(() => {
    if (!mdPalette.open) return;
    const maxIdx = Math.max(0, filteredMdCommands.length - 1);
    if (mdPalette.selectedIdx > maxIdx) {
      setMdPalette((s) => ({ ...s, selectedIdx: maxIdx }));
    }
  }, [filteredMdCommands.length, mdPalette.open, mdPalette.selectedIdx]);

  const closeMdPalette = useCallback(() => {
    setMdPalette((s) => ({ ...s, open: false }));
    notifyClosedRef.current?.();
  }, []);

  const selectMdCommand = useCallback((itemId: string) => {
    slashRemoveRef.current?.();
    mdInsertRef.current?.(itemId);
    setMdPalette((s) => ({ ...s, open: false }));
    notifyClosedRef.current?.();
  }, []);

  const mdArrowDown = useCallback(() => {
    setMdPalette((s) => ({
      ...s,
      selectedIdx:
        filteredMdCommands.length > 0
          ? (s.selectedIdx + 1) % filteredMdCommands.length
          : 0,
    }));
  }, [filteredMdCommands.length]);

  const mdArrowUp = useCallback(() => {
    setMdPalette((s) => ({
      ...s,
      selectedIdx:
        filteredMdCommands.length > 0
          ? (s.selectedIdx - 1 + filteredMdCommands.length) %
            filteredMdCommands.length
          : 0,
    }));
  }, [filteredMdCommands.length]);

  const mdConfirmSelection = useCallback(() => {
    const item = filteredMdCommands[mdPalette.selectedIdx];
    if (item) selectMdCommand(item.id);
    else closeMdPalette();
  }, [
    filteredMdCommands,
    mdPalette.selectedIdx,
    selectMdCommand,
    closeMdPalette,
  ]);

  const initialConfig = useMemo(
    () => ({
      namespace: "agenda-next-rich-editor",
      nodes: RICH_EDITOR_NODES,
      editable,
      onError(error: Error) {
        console.error("Lexical error:", error);
      },
      theme: {
        paragraph:
          "mb-[0.4em] leading-[1.7] data-[in-h3-section=true]:pl-[14px]",
        // ── Headings ──────────────────────────────────────────────────
        // Rediseño final — cada nivel tiene su propio lenguaje visual en
        // vez de repetir el mismo patrón (borde + etiqueta) escalado por
        // tamaño, para que la jerarquía se lea de inmediato incluso
        // salteando líneas:
        //
        //   H1 — "portada de sección": centrado, ancho acotado (máx
        //        500px, mx-auto) para que el texto haga wrap en varias
        //        líneas si es largo sin que las líneas laterales queden
        //        desalineadas. Las líneas van a los costados del texto
        //        vía ::before/::after posicionados absolutos (Lexical
        //        aplica el theme directo al <h1>, no hay wrapper propio
        //        para un flex con líneas + texto, así que se resuelven
        //        con pseudo-elementos position:absolute centrados en el
        //        alto del bloque).
        //   H2 — línea horizontal completa debajo del título (border-b).
        //   H3 — barra vertical de acento corta al costado del texto.
        //   H4 — "drop-cap invertido": primera letra grande y de color,
        //        resto del texto en tamaño normal. Se resuelve 100% con
        //        el pseudo-elemento CSS ::first-letter (variante
        //        `first-letter:` de Tailwind) — no requiere envolver el
        //        primer carácter en un span aparte, así que no toca el
        //        árbol de nodos de Lexical ni interfiere con el cursor.
        // Todo con utilidades Tailwind arbitrarias — sin depender de
        // CSS externo, autocontenido en este archivo.
        // ── Jerarquía de headings ────────────────────────────────────
        // Rediseño: dos ejes INDEPENDIENTES en vez de uno solo.
        //
        //   1) NIVEL (h1-h4, clases de abajo): controla SOLO tamaño +
        //      peso + color + espaciado. Es lo que el ojo humano procesa
        //      primero y más rápido para "qué tan importante es esto" —
        //      antes cada nivel además cambiaba de "truco" decorativo
        //      (centrado / borde / barra / drop-cap), lo cual hacía que
        //      reconocer el nivel dependiera de qué ornamento tenía en
        //      vez de cuán grande/oscuro es. Acá los 4 niveles bajan
        //      SIEMPRE en conjunto (tamaño↓ + peso↓/igual + color más
        //      apagado↓), nunca solo un eje.
        //
        //   2) VARIANTE (data-[variant=...] de abajo): el ornamento
        //      visual — línea inferior, barra lateral, portada
        //      centrada, drop-cap — ahora es un atributo separado
        //      (VariantHeadingNode.variant, ver nodes/VariantHeadingNode.tsx)
        //      que el usuario elige desde el menú "/" independientemente
        //      del nivel: un H2 puede llevar "portada", un H4 puede
        //      llevar "barra", etc. El selector [&[data-variant=x]] se
        //      aplica sobre CUALQUIER tag h1-h4 por igual — la variante
        //      nunca redefine tamaño/peso, solo agrega el ornamento.
        heading: {
          h1: "mt-8 mb-3 scroll-mt-4 text-2xl font-bold tracking-tight leading-tight text-foreground",
          h2: "mt-6 mb-2.5 scroll-mt-4 text-xl font-semibold leading-snug text-foreground",
          h3: "mt-5 mb-2 scroll-mt-4 text-base font-semibold leading-snug text-foreground",
          h4: [
            "mt-4 mb-1.5 scroll-mt-4",
            "text-sm font-semibold uppercase tracking-wide leading-snug",
            // Un H4 es el escalón más bajo: además de ser el más chico,
            // baja también en color (texto secundario/muted en vez de
            // texto principal) — tercera señal bajando junto a
            // tamaño+mayúsculas, patrón reconocible tipo "eyebrow/label".
            "text-foreground/70",
          ].join(" "),
          // ── Variantes (independientes del nivel) ──────────────────
          // Nota: Lexical solo permite un string por tag en theme.heading
          // (no hay "extraHeadingClass"), así que las variantes NO viven
          // acá — se aplican por separado como reglas CSS globales sobre
          // cualquier heading vía selector de atributo [data-variant=...],
          // inyectadas con un <style> inline justo dentro de
          // <LexicalComposer> (ver más abajo en el JSX de este componente).
        },
        quote: "border-l-2 border-primary/30 pl-4 italic opacity-75 my-4",
        code: "font-mono text-[0.875em] bg-surface-1 px-1.5 py-0.5 rounded",
        list: {
          ul: "list-disc pl-6 my-2",
          ol: "list-decimal pl-6 my-2",
          listitem: "my-1",
        },
        text: {
          bold: "font-bold",
          italic: "italic",
          underline: "underline",
          strikethrough: "line-through",
          code: "font-mono text-[0.875em] bg-surface-1 px-1 rounded",
        },
        table: "border-collapse my-3 w-full",
        tableRow: "",
        tableCell:
          "border border-[color-mix(in_srgb,var(--foreground)_12%,transparent)] px-2 py-1 align-top",
        tableCellHeader:
          "border border-[color-mix(in_srgb,var(--foreground)_12%,transparent)] px-2 py-1 align-top font-bold bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)]",
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const skipNextChangeRef = useRef(false);

  const handleChange = useCallback(
    (_state: EditorState, editor: LexicalEditor) => {
      if (skipNextChangeRef.current) {
        // Este onChange es el eco del editor.update() programático que
        // hizo InitialContentPlugin al cargar el contenido real del
        // capítulo — no una edición del usuario. Lo consumimos una sola
        // vez y no lo propagamos, para no disparar "Guardando…" al abrir.
        skipNextChangeRef.current = false;
        return;
      }
      editor.read(() => {
        const raw = serializeRootToRaw();
        onChange(raw);
      });
    },
    [onChange],
  );

  const editorStyle: React.CSSProperties = {
    minHeight,
    flex: 1,
    ...(maxHeight ? { maxHeight, overflowY: "auto" } : {}),
    padding: "4px 8px 8px",
    outline: "none",
    fontSize: 11,
    lineHeight: 1.7,
    fontFamily: "var(--font-mono)",
    color: "color-mix(in srgb, var(--foreground) 75%, transparent)",
    ...(editable
      ? null
      : { opacity: 0.5, cursor: "wait", pointerEvents: "none" }),
  };

  return (
    <div className="flex flex-col w-full h-full">
      <LexicalComposer initialConfig={initialConfig}>
        {/* Variantes de heading — ver theme.heading arriba: el nivel
            (h1-h4) solo controla tamaño/peso/color; el ornamento visual
            vive acá, aplicado por data-variant sin importar el tag, así
            que cualquier nivel puede llevar cualquier variante. Estas 4
            reglas son la migración 1:1 de los ornamentos que antes
            estaban hardcodeados por nivel (h1=portada, h2=linea,
            h3=barra, h4=dropcap) — mismo look, ahora elegible desde "/". */}
        <style>{`
          [data-variant="linea"] {
            padding-bottom: 0.5rem;
            border-bottom: 1px solid color-mix(in srgb, var(--color-primary, #7c6af7) 25%, transparent);
          }
          [data-variant="barra"] {
            position: relative;
            padding-left: 0.75rem;
            border-left: 2px solid color-mix(in srgb, var(--color-primary, #7c6af7) 50%, transparent);
          }
          [data-variant="barra"]::after {
            content: "";
            position: absolute;
            left: 0;
            top: 100%;
            width: 0;
            height: var(--h3-rail-h, 0px);
            border-left: 2px solid color-mix(in srgb, var(--color-primary, #7c6af7) 50%, transparent);
          }
          [data-variant="portada"] {
            position: relative;
            margin-left: auto;
            margin-right: auto;
            max-width: 500px;
            text-align: center;
            padding-left: 1.25rem;
            padding-right: 1.25rem;
          }
          [data-variant="portada"]::before,
          [data-variant="portada"]::after {
            content: "";
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            width: 0.75rem;
            height: 1px;
            background: color-mix(in srgb, var(--color-primary, #7c6af7) 40%, transparent);
            box-shadow: 0 4px 0 -0.5px color-mix(in srgb, var(--color-primary, #7c6af7) 25%, transparent);
          }
          [data-variant="portada"]::before { left: 0; }
          [data-variant="portada"]::after { right: 0; }
          [data-variant="dropcap"] {
            position: relative;
            padding-left: 1rem;
          }
          [data-variant="dropcap"]::before {
            content: "-";
            position: absolute;
            left: 0;
            top: 0;
            font-weight: 400;
            color: color-mix(in srgb, var(--color-primary, #7c6af7) 60%, transparent);
          }
          [data-variant="dropcap"]::first-letter {
            font-size: 1.3em;
            font-weight: 700;
            color: color-mix(in srgb, var(--color-primary, #7c6af7) 70%, transparent);
            margin-right: 1px;
          }
          /* Variante sutil: SOLO la primera letra cambia de color (al
             acento), sin el guión ni el aumento de tamaño de "dropcap" —
             útil cuando se quiere marcar el inicio del heading sin que
             compita visualmente con el resto del texto. Nota: por
             limitación real de CSS, no existe un selector que detecte
             "cada letra mayúscula" dentro de una cadena de texto — eso
             requeriría envolver cada mayúscula en su propio <span>, lo
             cual rompería la edición en vivo de Lexical (el reconciler
             gestiona el contenido de los TextNode como texto plano, no
             tolera DOM inyectado manualmente ahí). Por eso esta variante
             se limita a ::first-letter, que sí es 100% CSS y no interfiere
             con el modelo del editor. */
          [data-variant="primeramayuscula"]::first-letter {
            color: color-mix(in srgb, var(--color-primary, #7c6af7) 75%, transparent);
          }
        `}</style>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 4,
          }}
        >
          <TocPanel
            open={tocOpen}
            onClose={() => setTocOpen(false)}
            onToggle={() => setTocOpen((o) => !o)}
          />
          <button
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 20,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: spellCheckOn
                ? "color-mix(in srgb, var(--foreground) 60%, transparent)"
                : "color-mix(in srgb, var(--foreground) 18%, transparent)",
              transition: "color 0.1s",
            }}
            title={
              spellCheckOn
                ? "Corrector ortográfico activado — click para desactivar"
                : "Corrector ortográfico desactivado — click para activar"
            }
            type="button"
            onClick={toggleSpellCheck}
          >
            <SpellCheck2 size={11} />
          </button>
          {extraToolbarAction}
          {showSplitMode && (modeProp === undefined || onModeChange) && (
            <ModeTogglePlugin mode={mode} onModeChange={handleModeChange} />
          )}
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: mode === "split" ? "row" : "column",
            position: "relative",
          }}
        >
          {/* Panel de edición */}
          {mode !== "preview" && (
            <div
              style={{
                flex: 1,
                overflow: "auto",
                position: "relative",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <FindReplacePlugin
                state={findReplace}
                onStateChange={setFindReplace}
              />
              <RichTextPlugin
                ErrorBoundary={LexicalErrorBoundary}
                contentEditable={
                  // key={spellCheckOn}: fuerza a React a desmontar y volver
                  // a montar el <div contentEditable> cuando cambia el
                  // toggle. Necesario porque varios navegadores (Chrome
                  // incluido) NO vuelven a correr el corrector ortográfico
                  // sobre texto que ya estaba en pantalla si solo cambia el
                  // atributo spellcheck de un elemento ya montado — las
                  // líneas onduladas rojas que ya se dibujaron quedan
                  // "pegadas" hasta que ese texto puntual se edite. Remontar
                  // el elemento entero es la única forma confiable de que
                  // el navegador vuelva a evaluar (o deje de evaluar) todo
                  // el contenido de una.
                  <ContentEditable
                    key={String(spellCheckOn)}
                    spellCheck={spellCheckOn}
                    style={editorStyle}
                  />
                }
                placeholder={
                  <div
                    style={{
                      position: "absolute",
                      top: 4,
                      left: 8,
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      color:
                        "color-mix(in srgb, var(--foreground) 25%, transparent)",
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  >
                    {placeholder}
                  </div>
                }
              />
              <MarkdownShortcutPlugin transformers={RICH_TRANSFORMERS} />
              <HistoryPlugin />
              {autoFocus && <AutoFocusPlugin />}
              <InitialContentPlugin
                initialRaw={value}
                skipNextChangeRef={skipNextChangeRef}
              />
              <InsertSnippetPlugin
                insertRef={activeInsertRef}
                slashRemoveRef={slashRemoveRef}
              />
              <MarkdownCommandInsertPlugin insertRef={mdInsertRef} />
              <SectionGraphPlugin onHasSectionsChange={setHasSections} />
              <HeadingRailPlugin />
              <EditablePlugin editable={editable} />
              <VariantSuffixTransformPlugin />
              <SlashCommandPlugin
                isMenuOpen={mdPalette.open}
                notifyClosedRef={notifyClosedRef}
                removeMatchRef={slashRemoveRef}
                onArrowDown={mdArrowDown}
                onArrowUp={mdArrowUp}
                onConfirmSelection={mdConfirmSelection}
                onMatch={handleSlashMatch}
              />
              <WikilinkPlugin
                insertRef={wikiInsertRef}
                isMenuOpen={wikiMenu.open}
                notifyClosedRef={wikiNotifyClosedRef}
                onArrowDown={() =>
                  setWikiMenu((m) => ({
                    ...m,
                    selectedIdx:
                      filteredWikiEntities.length > 0
                        ? (m.selectedIdx + 1) % filteredWikiEntities.length
                        : 0,
                  }))
                }
                onArrowUp={() =>
                  setWikiMenu((m) => ({
                    ...m,
                    selectedIdx:
                      filteredWikiEntities.length > 0
                        ? (m.selectedIdx - 1 + filteredWikiEntities.length) %
                          filteredWikiEntities.length
                        : 0,
                  }))
                }
                onConfirmSelection={() => {
                  const entity = filteredWikiEntities[wikiMenu.selectedIdx];
                  if (entity) selectWikiEntity(entity);
                  else closeWikiMenu();
                }}
                onMatch={handleWikilinkMatch}
              />
              <TablePlugin />
              <ListPlugin />
              <InsertTablePlugin insertTableRef={insertTableRef} />
              <FormatCommandPlugin formatCommandRef={formatCommandRef} />
              <AutoClosePlugin />
              <HeadingBackspacePlugin />
              <ListBackspacePlugin />
              <OnChangePlugin onChange={handleChange} />

              {wikiMenu.open && normalizedWikiEntities.length > 0 && (
                <WikilinkMenuPanel
                  entities={normalizedWikiEntities}
                  menuRef={wikiMenuRef}
                  pos={wikiMenu.pos}
                  query={wikiMenu.query}
                  selectedIdx={wikiMenu.selectedIdx}
                  onClose={closeWikiMenu}
                  onHover={(idx) =>
                    setWikiMenu((m) => ({ ...m, selectedIdx: idx }))
                  }
                  onSelect={selectWikiEntity}
                />
              )}

              {mdPalette.open && (
                <MarkdownCommandPalette
                  pos={mdPalette.pos}
                  query={mdPalette.query}
                  selectedIdx={mdPalette.selectedIdx}
                  onClose={closeMdPalette}
                  onHover={(idx) =>
                    setMdPalette((s) => ({ ...s, selectedIdx: idx }))
                  }
                  onSelect={selectMdCommand}
                />
              )}

              {hasSections && (
                <div style={{ padding: "0 8px" }}>
                  <SectionCloserView />
                </div>
              )}
            </div>
          )}

          {/* Panel de preview — usa renderPreview del padre si lo pasa
              (p. ej. EditorCapitulos con ContenidoInteractivo para
              resolver [[drop|...]] etc.), si no cae al markdown plano
              estándar de siempre. */}
          {mode !== "edit" &&
            (renderPreview ? (
              <div
                className="prose-mundo"
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  overflowY: "auto",
                  fontSize: "clamp(0.9rem, 2vw, 1rem)",
                  lineHeight: 1.8,
                }}
              >
                {renderPreview(value)}
              </div>
            ) : (
              <div
                className="prose-mundo"
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  overflowY: "auto",
                  fontSize: "clamp(0.9rem, 2vw, 1rem)",
                  lineHeight: 1.8,
                }}
                onClick={(e) => {
                  // Mismo mecanismo que antes: los wikilinks se marcan con
                  // data-wikilink, acá solo conectamos el click a
                  // onWikilinkNavigate.
                  const a = (e.target as HTMLElement).closest(
                    "a[data-wikilink]",
                  );
                  if (!a) return;
                  e.preventDefault();
                  const target = a.getAttribute("data-wikilink");
                  if (target) onWikilinkNavigate?.(target);
                }}
              >
                <PlainMarkdownFallback value={value} />
              </div>
            ))}
        </div>
      </LexicalComposer>
    </div>
  );
}
