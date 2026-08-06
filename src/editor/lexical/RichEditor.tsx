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
 *   - Sin modo preview/split interno: RichEditor es solo edición. Para
 *     mostrar texto ya escrito de solo lectura, usar PlainMarkdownPreview
 *     (editor/lexical/PlainMarkdownPreview.tsx) o, si necesita resolver
 *     snippets [[drop|...]] etc., ContenidoInteractivo directamente.
 *   - SnippetCommandPalette existente conectado sin cambios
 *
 * Props compatibles con las del MarkdownEditor anterior para simplificar
 * la migración en EditorCapitulos.tsx.
 */
import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListNode, ListItemNode } from "@lexical/list";
import {
  HorizontalRuleNode,
  $isHorizontalRuleNode,
} from "@lexical/react/LexicalHorizontalRuleNode";

import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
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
import { SpellCheck2, Download, FileText, Copy, Check } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AutoClosePlugin } from "./plugins/AutoClosePlugin";
import { MarkdownPastePlugin } from "./plugins/MarkdownPastePlugin";
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
import { DialogoNode } from "./nodes/DialogoNode";
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
import { MathNode } from "./nodes/MathNode";
import {
  rawTextToLexicalTree,
  serializeRootToRaw,
  insertSnippetNode,
} from "./richTextSerializer";
import { SlashCommandPlugin, type SlashMatch } from "./plugins/SlashCommandPlugin";
import { TABLE_NODES, TablePlugin, insertTable } from "./plugins/TablePlugin";
import { TableControlsPlugin } from "./plugins/TableControlsPlugin";
import { TocPanel } from "./plugins/TocPlugin";
import { WikilinkMenuPanel, type WikiEntity } from "./WikilinkMenuPanel";
import { WikilinkPlugin, type WikilinkMatch } from "./plugins/WikilinkPlugin";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

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
   * Nodo extra para renderizar en la toolbar interna, justo a la derecha
   * del toggle de corrector ortográfico. Pensado para acciones del padre
   * que necesitan vivir visualmente "dentro" del editor en vez de en una
   * barra externa — ej. el botón "+ bloque" de LayoutCanvas en
   * EditorEnsayo/EditorCapitulos. Opcional: si no se pasa, la toolbar se
   * ve exactamente igual que antes.
   */
  extraToolbarAction?: React.ReactNode;
  /**
   * Nombre de archivo (sin extensión) usado por el botón de exportar
   * (.md / .pdf). Si no se pasa, cae a "documento". El botón de exportar
   * se muestra siempre — usa directamente `value` (markdown crudo).
   */
  exportFileName?: string;
  /**
   * Lista de TODAS las secciones del ensayo (documento principal +
   * sub-bloques), para que el menú de exportar pueda ofrecer "solo esta
   * sección" vs "todas las secciones" en vez de exportar siempre
   * únicamente `value` (la sección actualmente abierta). RichEditor no
   * conoce los sub-bloques por su cuenta — viven en el padre
   * (EditorEnsayo) — así que se los pasamos ya armados. Opcional: si no
   * se pasa (o solo hay una sección), el menú se comporta como antes,
   * sin la opción de alcance.
   */
  allSections?: { nombre: string; contenido: string }[];
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
  HorizontalRuleNode,
  LinkNode,
  DropNode,
  DialogoNode,
  SoundNode,
  ImgNode,
  ChoiceNode,
  UseNode,
  CondicionNode,
  FlagNode,
  SectionNode,
  WikilinkNode,
  MathNode,
  ...TABLE_NODES,
];

// ─────────────────────────────────────────────────────────────────────────────
// Plugin: carga el contenido inicial desde el raw string
// ─────────────────────────────────────────────────────────────────────────────

function InitialContentPlugin({
  initialRaw,
  skipNextChangeRef,
  lastEmittedRawRef,
}: {
  initialRaw: string;
  skipNextChangeRef: React.MutableRefObject<boolean>;
  /**
   * Último raw que ESTE editor emitió vía onChange (ver handleChange más
   * abajo). Si initialRaw coincide con esto, sabemos sin serializar nada
   * que es el eco de vuelta del propio editor (el padre hizo
   * setState(raw) con el mismo raw que le acabamos de mandar) — no hace
   * falta comparar contra el árbol.
   *
   * Antes de esto, CADA tecla escrita disparaba una serialización
   * completa del árbol acá (editor.read(() => serializeRootToRaw()))
   * solo para descubrir que no había cambiado nada — además de la
   * serialización que ya hacía handleChange para guardar. En documentos
   * grandes (Historia completa, Documento del libro: miles de líneas)
   * eso duplicaba el costo de serializar por cada letra tipeada y era
   * la causa principal de la lentitud al escribir/cargar esas vistas.
   */
  lastEmittedRawRef: React.MutableRefObject<string | null>;
}) {
  const [editor] = useLexicalComposerContext();
  const isFirstRun = useRef(true);

  useEffect(() => {
    // Eco del propio editor: no re-serializamos, sabemos que coincide.
    if (!isFirstRun.current && lastEmittedRawRef.current === initialRaw) {
      return;
    }

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
  }, [editor, initialRaw, skipNextChangeRef, lastEmittedRawRef]);

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
// Exportar markdown — botón con menú desplegable: descargar .md, descargar
// PDF (vía ventana de impresión del navegador, sin dependencias externas) o
// copiar el markdown crudo al portapapeles. Usa directamente `value` (el
// mismo string raw que maneja onChange), no un snapshot del árbol Lexical —
// así queda perfectamente sincronizado con lo que ya se está guardando.
// ─────────────────────────────────────────────────────────────────────────────

function slugifyFileName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "documento"
  );
}

// Escapado mínimo para que el markdown crudo no rompa el HTML al inyectarlo
// dentro de un <pre> en la ventana de impresión (export a PDF).
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function downloadTextFile(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Combina el documento principal + sub-bloques en un solo string markdown,
// separando cada sección con un heading "## Nombre" — así queda legible y
// navegable como un único documento al exportar "todas las secciones".
function combineSections(sections: { nombre: string; contenido: string }[]): string {
  return sections
    .map((s) => `## ${s.nombre}\n\n${s.contenido}`)
    .join("\n\n---\n\n");
}

function exportMarkdownAsPdf(title: string, markdown: string) {
  // Sin librerías de PDF: abrimos una ventana nueva con el markdown crudo
  // formateado como texto preformateado y disparamos window.print() — el
  // usuario elige "Guardar como PDF" en el diálogo de impresión del
  // navegador. Funciona en cualquier navegador moderno, sin deps extra.
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 2cm; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #1a1a1a;
    max-width: 720px;
    margin: 0 auto;
    padding: 24px;
  }
  h1 { font-size: 1.4rem; margin-bottom: 1.2rem; }
  pre {
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 0.85rem;
    line-height: 1.7;
  }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<pre>${escapeHtml(markdown)}</pre>
<script>
  window.onload = function () {
    window.focus();
    window.print();
  };
</script>
</body>
</html>`);
  win.document.close();
}

function ExportMenuButton({
  markdown,
  fileName,
  allSections,
}: {
  markdown: string;
  fileName: string;
  allSections?: { nombre: string; contenido: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Submenú de alcance abierto: qué acción (md/pdf/copy) está esperando
  // que el usuario elija "solo esta sección" o "todas las secciones".
  // null = ningún submenú abierto (vista de acciones normal).
  const [scopeFor, setScopeFor] = useState<"md" | "pdf" | "copy" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setScopeFor(null);
  }, [open]);

  const slug = slugifyFileName(fileName);
  // Solo tiene sentido preguntar el alcance si hay más de una sección —
  // con una sola (o sin sub-bloques), "todas" y "esta" son lo mismo.
  const hasMultipleSections = (allSections?.length ?? 0) > 1;

  const runDownloadMd = (content: string, name: string) => {
    downloadTextFile(`${slugifyFileName(name)}.md`, "text/markdown;charset=utf-8", content);
    setOpen(false);
  };

  const runDownloadPdf = (content: string, title: string) => {
    exportMarkdownAsPdf(title, content);
    setOpen(false);
  };

  const runCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback silencioso: si el navegador bloquea la API de portapapeles
      // (permiso denegado, contexto no seguro), no rompemos nada más.
    }
    setOpen(false);
  };

  // Cada acción: si hay múltiples secciones, abre el submenú de alcance
  // en vez de ejecutar directo. Con una sola sección, se comporta exactamente
  // como antes (usa `markdown`/`fileName` de la sección actual sin preguntar).
  const handleDownloadMd = () => {
    if (hasMultipleSections) {
      setScopeFor("md");
      return;
    }
    runDownloadMd(markdown, fileName);
  };

  const handleDownloadPdf = () => {
    if (hasMultipleSections) {
      setScopeFor("pdf");
      return;
    }
    runDownloadPdf(markdown, fileName);
  };

  const handleCopy = () => {
    if (hasMultipleSections) {
      setScopeFor("copy");
      return;
    }
    void runCopy(markdown);
  };

  const chooseScope = (scope: "current" | "all") => {
    if (!scopeFor) return;
    const content = scope === "all" ? combineSections(allSections!) : markdown;
    if (scopeFor === "md") runDownloadMd(content, fileName);
    else if (scopeFor === "pdf") runDownloadPdf(content, fileName);
    else void runCopy(content);
    setScopeFor(null);
  };

  const menuItems: {
    key: string;
    label: string;
    Icon: typeof Download;
    onClick: () => void;
  }[] = [
    { key: "md", label: "Descargar Markdown (.md)", Icon: Download, onClick: handleDownloadMd },
    { key: "pdf", label: "Descargar como PDF", Icon: FileText, onClick: handleDownloadPdf },
    { key: "copy", label: copied ? "¡Copiado!" : "Copiar Markdown", Icon: copied ? Check : Copy, onClick: handleCopy },
  ];

  const scopeLabels: Record<"md" | "pdf" | "copy", string> = {
    md: "Descargar Markdown",
    pdf: "Descargar como PDF",
    copy: "Copiar Markdown",
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
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
          color: open
            ? "color-mix(in srgb, var(--foreground) 60%, transparent)"
            : "color-mix(in srgb, var(--foreground) 18%, transparent)",
          transition: "color 0.1s",
        }}
        title="Exportar documento"
        type="button"
        onClick={() => setOpen((o) => !o)}
      >
        <Download size={11} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            background: "var(--background, #fff)",
            border: "1px solid color-mix(in srgb, var(--foreground) 12%, transparent)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            padding: 4,
            minWidth: 200,
            zIndex: 50,
          }}
        >
          {scopeFor ? (
            <>
              <div
                style={{
                  padding: "6px 8px 4px",
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "color-mix(in srgb, var(--foreground) 40%, transparent)",
                }}
              >
                {scopeLabels[scopeFor]}
              </div>
              {[
                { key: "current" as const, label: "Solo esta sección" },
                { key: "all" as const, label: "Todas las secciones" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  role="menuitem"
                  type="button"
                  onClick={() => chooseScope(key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    padding: "6px 8px",
                    background: "transparent",
                    border: "none",
                    borderRadius: 5,
                    cursor: "pointer",
                    fontSize: 12,
                    color: "var(--foreground)",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "color-mix(in srgb, var(--foreground) 8%, transparent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {label}
                </button>
              ))}
              <button
                role="menuitem"
                type="button"
                onClick={() => setScopeFor(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "6px 8px",
                  marginTop: 2,
                  borderTop: "1px solid color-mix(in srgb, var(--foreground) 7%, transparent)",
                  background: "transparent",
                  border: "none",
                  borderTopWidth: 1,
                  borderTopStyle: "solid",
                  borderTopColor: "color-mix(in srgb, var(--foreground) 7%, transparent)",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "color-mix(in srgb, var(--foreground) 45%, transparent)",
                  textAlign: "left",
                }}
              >
                ← Volver
              </button>
            </>
          ) : (
            menuItems.map(({ key, label, Icon, onClick }) => (
              <button
                key={key}
                role="menuitem"
                type="button"
                onClick={onClick}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "6px 8px",
                  background: "transparent",
                  border: "none",
                  borderRadius: 5,
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--foreground)",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "color-mix(in srgb, var(--foreground) 8%, transparent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <Icon size={13} />
                {label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
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
  extraToolbarAction,
  exportFileName,
  allSections,
}: RichEditorProps) {
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
        // theme.code es el CodeNode de BLOQUE (```código```) — distinto de
        // theme.text.code, que es el código INLINE (`código`) de más abajo.
        // Antes compartían prácticamente el mismo estilo achicado (mismo
        // padding chico, sin salto de línea propio), así que un bloque de
        // código se veía igual que un fragmento inline. Bloque real: fondo
        // más marcado, padding de bloque, ancho completo, scroll horizontal
        // si una línea es muy larga (en vez de romper el layout).
        code: "block font-mono text-[0.875em] leading-relaxed whitespace-pre overflow-x-auto bg-surface-1 border border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] rounded-lg px-4 py-3 my-4",
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
        hr: "border-0 border-t border-[color-mix(in_srgb,var(--foreground)_15%,transparent)] my-6",
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const skipNextChangeRef = useRef(false);
  // Ver InitialContentPlugin — guarda el último raw que este editor emitió
  // para que, cuando el padre nos lo devuelva vía prop `value`, sepamos que
  // es nuestro propio eco sin tener que re-serializar el árbol para
  // comprobarlo.
  const lastEmittedRawRef = useRef<string | null>(null);

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
        lastEmittedRawRef.current = raw;
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
          <ExportMenuButton
            markdown={value}
            fileName={exportFileName || "documento"}
            allSections={allSections}
          />
          {extraToolbarAction}
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            position: "relative",
          }}
        >
          {/* Panel de edición */}
          {(
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
              <MarkdownPastePlugin />
              <HistoryPlugin />
              {/* Habilita el nodo HorizontalRuleNode que ya registra el
                  transformer HR estándar de @lexical/markdown (incluido en
                  RICH_TRANSFORMERS vía TRANSFORMERS) — sin este plugin, el
                  transformer intenta crear el nodo pero Lexical no sabe
                  cómo montarlo/seleccionarlo en el DOM. */}
              <HorizontalRulePlugin />
              {autoFocus && <AutoFocusPlugin />}
              <InitialContentPlugin
                initialRaw={value}
                lastEmittedRawRef={lastEmittedRawRef}
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
              <TableControlsPlugin />
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
        </div>
      </LexicalComposer>
    </div>
  );
}
