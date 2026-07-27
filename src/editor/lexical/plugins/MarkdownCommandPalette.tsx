"use client";
/**
 * MarkdownCommandPalette.tsx
 * ────────────────────────────
 * Panel flotante de "/" para el modo NORMAL de RichEditor (no-libro).
 *
 * Contexto: RichEditor tiene dos modos de uso.
 *   - Modo LIBRO (EditorCapitulos): "/" abre <SnippetCommandPalette/> del
 *     padre, que inserta snippets narrativos (drop, choice, gate, sound,
 *     img, use) en formato "[[kind|...]]" vía insertSnippetNode(). Ese
 *     flujo NO cambia — sigue siendo 100% responsabilidad del padre a
 *     través de onOpenPalette/onClosePalette/closePaletteRef.
 *   - Modo NORMAL (cualquier otro consumidor de RichEditor: notas,
 *     ensayos, etc.): no hay SnippetCommandPalette porque no hay
 *     snippets narrativos. Acá "/" debe ofrecer elementos de markdown
 *     estándar (encabezados, listas, cita, código, tabla, línea
 *     divisoria) — este archivo implementa ESE panel.
 *
 * RichEditor decide cuál usar: si el padre pasó onOpenPalette, es modo
 * libro y delega como siempre; si NO lo pasó, usa este panel interno.
 * Los dos NUNCA se muestran a la vez.
 *
 * Inserción: a diferencia de insertSnippetNode() (que parsea un string
 * "[[kind|...]]"), acá insertamos nodos Lexical reales directamente
 * ($createHeadingNode, $createQuoteNode, insertList, insertTable, etc.)
 * porque un heading/lista de markdown no es un snippet — es contenido
 * de documento normal, mismo tipo de nodo que produce MarkdownShortcutPlugin
 * al escribir "# " a mano.
 */
import { $createCodeNode } from "@lexical/code";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createQuoteNode } from "@lexical/rich-text";
import type { HeadingTagType } from "@lexical/rich-text";
import {
  $createVariantHeadingNode,
  $isVariantHeadingNode,
  type HeadingVariant,
} from "../nodes/VariantHeadingNode";
import {
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  FORMAT_ELEMENT_COMMAND,
} from "lexical";
import type { LexicalEditor, LexicalNode } from "lexical";
import {
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List as ListIcon,
  ListOrdered,
  Quote,
  Code,
  Table as TableIcon,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  PanelBottom,
  PanelLeft,
  Sparkles,
  Baseline,
  Eraser,
  CaseSensitive,
} from "lucide-react";
import React, { useEffect, useMemo, useRef } from "react";

import { insertTable } from "./TablePlugin";

const PRIMARY = "var(--color-primary, #7c6af7)";
const mono = { fontFamily: "var(--font-mono)" } as const;

export interface MarkdownCommandItem {
  id: string;
  label: string;
  hint: string;
  keywords: string[]; // para filtrar con la query de "/"
  Icon: typeof Heading1;
  run: (editor: LexicalEditor) => void;
}

// Defensa en profundidad: normalmente onMouseDown+preventDefault en el
// panel evita que el editor pierda el foco/selección antes de correr un
// comando (ver render más abajo). Pero por si algo más disparara run()
// con la selección ya perdida (foco movido por otro medio), en vez de
// silenciosamente no insertar nada, caemos al final del documento —
// mejor insertar "en algún lugar razonable" que directamente no hacer
// nada y confundir al usuario. IMPORTANTE: esto se llama DENTRO de un
// editor.update() — no debe llamar a editor.focus() acá (eso es una
// operación DOM que no pertenece dentro de un update). El foco físico
// se restaura por separado antes de abrir el update, ver cada run().
function getUsableSelection() {
  const selection = $getSelection();
  if ($isRangeSelection(selection)) return selection;
  const root = $getRoot();
  root.selectEnd();
  const fallback = $getSelection();
  return $isRangeSelection(fallback) ? fallback : null;
}

export const MARKDOWN_COMMAND_ITEMS: MarkdownCommandItem[] = [
  {
    id: "h1",
    label: "Título 1",
    hint: "#",
    keywords: ["h1", "titulo", "encabezado", "heading"],
    Icon: Heading1,
    run: (editor) => insertHeading(editor, "h1"),
  },
  {
    id: "h2",
    label: "Título 2",
    hint: "##",
    keywords: ["h2", "titulo", "subtitulo", "encabezado", "heading"],
    Icon: Heading2,
    run: (editor) => insertHeading(editor, "h2"),
  },
  {
    id: "h3",
    label: "Título 3",
    hint: "###",
    keywords: ["h3", "titulo", "subtitulo", "encabezado", "heading"],
    Icon: Heading3,
    run: (editor) => insertHeading(editor, "h3"),
  },
  {
    id: "h4",
    label: "Título 4",
    hint: "####",
    keywords: ["h4", "titulo", "subtitulo", "encabezado", "heading"],
    Icon: Heading4,
    run: (editor) => insertHeading(editor, "h4"),
  },
  // ── Variantes de heading (independientes del nivel) ────────────────
  // A diferencia de h1-h4 de arriba, estos NO crean un heading nuevo: le
  // aplican un ornamento visual al heading donde ya está el cursor, sin
  // tocar su nivel. Así cualquier # / ## / ### / #### puede llevar
  // cualquiera de estas variantes — antes cada nivel tenía su ornamento
  // fijo (h1=portada, h2=línea, h3=barra, h4=drop-cap); ahora nivel y
  // variante son dos decisiones separadas.
  {
    id: "variant-linea",
    label: "Variante: línea inferior",
    hint: "—",
    keywords: ["linea", "línea", "subrayado", "variante", "heading"],
    Icon: PanelBottom,
    run: (editor) => applyHeadingVariant(editor, "linea"),
  },
  {
    id: "variant-barra",
    label: "Variante: barra lateral",
    hint: "│",
    keywords: ["barra", "lateral", "variante", "heading"],
    Icon: PanelLeft,
    run: (editor) => applyHeadingVariant(editor, "barra"),
  },
  {
    id: "variant-portada",
    label: "Variante: portada centrada",
    hint: "◦ ◦",
    keywords: ["portada", "centrada", "centrado", "variante", "heading"],
    Icon: Sparkles,
    run: (editor) => applyHeadingVariant(editor, "portada"),
  },
  {
    id: "variant-dropcap",
    label: "Variante: drop-cap",
    hint: "A",
    keywords: ["dropcap", "drop-cap", "capitular", "variante", "heading"],
    Icon: Baseline,
    run: (editor) => applyHeadingVariant(editor, "dropcap"),
  },
  {
    id: "variant-primeramayuscula",
    label: "Variante: primera letra en acento",
    hint: "A",
    keywords: [
      "primera",
      "letra",
      "mayuscula",
      "mayúscula",
      "acento",
      "color",
      "variante",
      "heading",
    ],
    Icon: CaseSensitive,
    run: (editor) => applyHeadingVariant(editor, "primeramayuscula"),
  },
  {
    id: "variant-none",
    label: "Quitar variante",
    hint: "×",
    keywords: ["quitar", "sin", "ninguna", "variante", "heading"],
    Icon: Eraser,
    run: (editor) => applyHeadingVariant(editor, "none"),
  },
  {
    id: "bullet",
    label: "Lista con viñetas",
    hint: "-",
    keywords: ["lista", "bullet", "viñeta", "ul"],
    Icon: ListIcon,
    run: (editor) => {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    },
  },
  {
    id: "numbered",
    label: "Lista numerada",
    hint: "1.",
    keywords: ["lista", "numerada", "ordenada", "ol"],
    Icon: ListOrdered,
    run: (editor) => {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    },
  },
  {
    id: "quote",
    label: "Cita",
    hint: ">",
    keywords: ["cita", "quote", "blockquote"],
    Icon: Quote,
    run: (editor) => {
      editor.focus();
      editor.update(() => {
        const selection = getUsableSelection();
        if (!selection) return;
        const quote = $createQuoteNode();
        selection.insertNodes([quote]);
        quote.selectStart();
      });
    },
  },
  {
    id: "code",
    label: "Bloque de código",
    hint: "```",
    keywords: ["codigo", "code", "bloque"],
    Icon: Code,
    run: (editor) => {
      editor.update(() => {
        const selection = getUsableSelection();
        if (!selection) return;
        const code = $createCodeNode();
        // CRÍTICO: un CodeNode recién creado no tiene hijos. Llamar
        // selectStart()/selectEnd() sobre un ElementNode vacío falla
        // (Lexical no tiene un punto de texto válido donde posicionar
        // el cursor) — eso hacía que el bloque de código pareciera "no
        // insertarse": en realidad SÍ se creaba el nodo, pero la
        // selección posterior tiraba un error interno que Lexical
        // capturaba en su onError, dejando el update a medio aplicar
        // en algunos casos. Insertamos un TextNode vacío como hijo
        // ANTES de seleccionar, igual que hace MarkdownShortcutPlugin
        // cuando convierte ``` a código a mano.
        const textNode = $createTextNode("");
        code.append(textNode);
        selection.insertNodes([code]);
        textNode.select(0, 0);
      });
    },
  },
  {
    id: "table",
    label: "Tabla",
    hint: "3×3",
    keywords: ["tabla", "table"],
    Icon: TableIcon,
    run: (editor) => {
      editor.focus();
      insertTable(editor, 3, 3);
    },
  },
  {
    id: "hr",
    label: "Línea divisoria",
    hint: "---",
    keywords: ["linea", "divisoria", "separador", "hr"],
    Icon: Minus,
    run: (editor) => {
      editor.focus();
      editor.update(() => {
        const selection = getUsableSelection();
        if (!selection) return;
        selection.insertText("—".repeat(3));
      });
    },
  },
  // ── Alineación de párrafo ────────────────────────────────────────────
  // FORMAT_ELEMENT_COMMAND es el comando nativo de Lexical para alinear
  // el bloque completo donde está el cursor (funciona con paragraph,
  // heading, quote, listitem — cualquier ElementNode). No requiere crear
  // un nodo nuevo como los headings de arriba: solo setea la propiedad
  // "format" del bloque actual, que el reconciler traduce a
  // text-align en el DOM automáticamente. editor.focus() antes de
  // dispatchCommand asegura que la selección siga viva si el usuario
  // llegó acá con el mouse (mismo patrón que insertHeading/tabla).
  {
    id: "align-left",
    label: "Alinear a la izquierda",
    hint: "←",
    keywords: ["alinear", "izquierda", "left", "align"],
    Icon: AlignLeft,
    run: (editor) => {
      editor.focus();
      editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left");
    },
  },
  {
    id: "align-center",
    label: "Centrar",
    hint: "↔",
    keywords: ["alinear", "centrar", "centro", "center", "align"],
    Icon: AlignCenter,
    run: (editor) => {
      editor.focus();
      editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center");
    },
  },
  {
    id: "align-right",
    label: "Alinear a la derecha",
    hint: "→",
    keywords: ["alinear", "derecha", "right", "align"],
    Icon: AlignRight,
    run: (editor) => {
      editor.focus();
      editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "right");
    },
  },
  {
    id: "align-justify",
    label: "Justificar",
    hint: "≡",
    keywords: ["alinear", "justificar", "justify", "align"],
    Icon: AlignJustify,
    run: (editor) => {
      editor.focus();
      editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "justify");
    },
  },
];

function insertHeading(editor: LexicalEditor, tag: HeadingTagType) {
  editor.focus();
  editor.update(() => {
    const selection = getUsableSelection();
    if (!selection) return;
    const heading = $createVariantHeadingNode(tag);
    selection.insertNodes([heading]);
    heading.selectStart();
  });
}

// Aplica (o quita) una variante visual al heading donde está el cursor,
// SIN tocar su nivel (h1-h4) — es el mecanismo que hace que las 4
// variantes (línea, barra, portada, drop-cap) sean independientes del
// nivel: el usuario puede tener cualquier combinación nivel×variante. Si
// el cursor no está dentro de un heading, no hace nada (no tiene sentido
// aplicar una variante a un párrafo).
function applyHeadingVariant(editor: LexicalEditor, variant: HeadingVariant) {
  editor.focus();
  editor.update(() => {
    const selection = getUsableSelection();
    if (!selection) return;
    const anchorNode = selection.anchor.getNode();
    let node: LexicalNode | null = anchorNode;
    while (node && !$isVariantHeadingNode(node)) {
      node = (node as any).getParent?.() ?? null;
    }
    if (node && $isVariantHeadingNode(node)) {
      node.setVariant(variant);
    }
  });
}

// Extraído como función pura (no hook) para que RichEditor pueda calcular
// la misma lista filtrada fuera del componente visual — necesario para
// que la navegación con flechas (en SlashCommandPlugin, que vive en el
// árbol Lexical, no en este panel) sepa cuántos items hay y cuál confirmar
// con Enter, sin duplicar la lógica de filtrado en dos lugares.
export function filterMarkdownCommands(query: string): MarkdownCommandItem[] {
  if (!query) return MARKDOWN_COMMAND_ITEMS;
  const q = query.toLowerCase();
  return MARKDOWN_COMMAND_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q)),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin: expone insertRef para que RichEditor ejecute un comando elegido
// ─────────────────────────────────────────────────────────────────────────────

export function MarkdownCommandInsertPlugin({
  insertRef,
}: {
  insertRef: React.MutableRefObject<((itemId: string) => void) | null>;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    insertRef.current = (itemId: string) => {
      const item = MARKDOWN_COMMAND_ITEMS.find((i) => i.id === itemId);
      item?.run(editor);
    };
    return () => {
      insertRef.current = null;
    };
  }, [editor, insertRef]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel flotante — mismo look visual que WikilinkMenuPanel/SnippetCommandPalette
// ─────────────────────────────────────────────────────────────────────────────

interface MarkdownCommandPaletteProps {
  query: string;
  pos: { top: number; left: number };
  selectedIdx: number;
  onSelect: (itemId: string) => void;
  onHover: (idx: number) => void;
  onClose: () => void;
}

export function MarkdownCommandPalette({
  query,
  pos,
  selectedIdx,
  onSelect,
  onHover,
  onClose,
}: MarkdownCommandPaletteProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => filterMarkdownCommands(query), [query]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  // Mismo fix que en SnippetCommandPalette: sin esto, navegar con flechas
  // avanzaba el índice pero la fila resaltada podía quedar fuera del área
  // visible del scroll, obligando a scrollear a mano.
  useEffect(() => {
    const el = menuRef.current?.querySelector<HTMLElement>(
      `[data-idx="${selectedIdx}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: pos.top,
        left: Math.max(8, pos.left),
        zIndex: 9999,
        width: 240,
        maxHeight: 300,
        overflowY: "auto",
        background: "var(--bg-menu, #1a1730)",
        border: `1px solid color-mix(in srgb, ${PRIMARY} 22%, transparent)`,
        borderRadius: 10,
        boxShadow: `0 12px 40px color-mix(in srgb, ${PRIMARY} 18%, black)`,
        backdropFilter: "blur(12px)",
        padding: 4,
      }}
    >
      {filtered.length === 0 ? (
        <div
          style={{
            padding: "10px 12px",
            fontSize: 11,
            ...mono,
            color: "color-mix(in srgb, var(--foreground) 30%, transparent)",
          }}
        >
          Sin resultados
        </div>
      ) : (
        filtered.map((item, idx) => (
          <div
            key={item.id}
            data-idx={idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 10px",
              borderRadius: 6,
              cursor: "pointer",
              background:
                idx === selectedIdx
                  ? `color-mix(in srgb, ${PRIMARY} 14%, transparent)`
                  : "transparent",
            }}
            onClick={() => onSelect(item.id)}
            onMouseDown={(e) => {
              // CRÍTICO: sin esto, el mousedown le saca el foco al
              // contenteditable del editor ANTES de que el click dispare
              // onSelect. Al perder el foco, la RangeSelection de Lexical
              // colapsa/deja de ser válida, así que insertHeading/etc
              // (que hacen $getSelection() + $isRangeSelection check)
              // fallan el check y retornan sin insertar nada — el usuario
              // ve que "elige" el comando pero no pasa nada. preventDefault
              // acá evita el blur, la selección se mantiene intacta.
              e.preventDefault();
            }}
            onMouseEnter={() => onHover(idx)}
          >
            <item.Icon
              color={`color-mix(in srgb, ${PRIMARY} 65%, transparent)`}
              size={13}
            />
            <span
              style={{
                flex: 1,
                fontSize: 12,
                color: "color-mix(in srgb, var(--foreground) 82%, transparent)",
              }}
            >
              {item.label}
            </span>
            <span
              style={{
                fontSize: 9,
                ...mono,
                color: "color-mix(in srgb, var(--foreground) 25%, transparent)",
              }}
            >
              {item.hint}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
