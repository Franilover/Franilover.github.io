"use client";
/**
 * MarkdownPastePlugin.tsx
 * ─────────────────────────
 * Detecta cuando el usuario pega texto con "forma" de markdown (headings,
 * listas, negrita/cursiva, citas, código, tablas, links, fórmulas $/$$)
 * y lo convierte en nodos reales de Lexical en vez de pegarlo como texto
 * plano.
 *
 * Por qué un plugin aparte y no reusar rawTextToLexicalTree() tal cual:
 * esa función hace $getRoot().clear() — está pensada para cargar el
 * documento completo (InitialContentPlugin), no para insertar en medio
 * de uno existente. Acá necesitamos insertar EN el punto del cursor sin
 * tocar el resto del documento, así que:
 *
 *   1) Interceptamos PASTE_COMMAND con prioridad alta (antes que el
 *      handler default de RichTextPlugin, que pegaría el texto plano tal
 *      cual carácter por carácter).
 *   2) Heurística looksLikeMarkdown(): si el texto pegado no tiene ninguna
 *      marca de markdown reconocible, no interceptamos — dejamos pasar
 *      (return false) para que el paste plano normal de Lexical ocurra.
 *   3) Si parece markdown: usamos un LexicalEditor headless *temporal*
 *      (createEditor con los mismos nodes que el editor real) para
 *      correr $convertFromMarkdownString ahí — así el root.clear() que
 *      hace esa función limpia el documento temporal, no el real. Leemos
 *      los nodos resultantes, los clonamos hacia el editor real y los
 *      insertamos en la posición del cursor con selection.insertNodes().
 *      Este es el patrón que la propia documentación de Lexical
 *      recomienda para "convertir markdown sin perder el documento
 *      actual" (evita el bug de pasar nodo destino, facebook/lexical#7663
 *      mencionado en richTextSerializer.ts).
 *
 * No reintenta la sintaxis extendida del proyecto (snippets [[drop|...]],
 * tablas con parseTableBlock, etc. — ver richTextSerializer.ts): eso es
 * deliberado. El texto que alguien pega desde afuera (un editor externo,
 * ChatGPT, un README) es markdown estándar; si además contuviera nuestra
 * sintaxis propia de snippets, $convertFromMarkdownString simplemente la
 * deja como texto plano (no rompe nada), y rawTextToLexicalTree sigue
 * siendo el único punto de entrada para *cargar* documentos con esa
 * sintaxis completa.
 *
 * FÓRMULAS ($ / $$): "$formula$" inline ya está cubierto por
 * MATH_INLINE_TRANSFORMER dentro de RICH_TRANSFORMERS (ver
 * VariantHeadingNode.tsx), así que $convertFromMarkdownString lo resuelve
 * solo. "$$formula$$" en bloque es multilinea — igual que las tablas en
 * rawTextToLexicalTree, se extrae ANTES de pasarle el texto al editor
 * headless (si no, $convertFromMarkdownString vería el "$$" como texto
 * plano de un párrafo cualquiera) y se reinserta como MathNode real
 * después de la conversión.
 */
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $convertFromMarkdownString } from "@lexical/markdown";
import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListNode, ListItemNode } from "@lexical/list";
import { QuoteNode } from "@lexical/rich-text";
import {
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  createEditor,
  COMMAND_PRIORITY_HIGH,
  PASTE_COMMAND,
} from "lexical";
import { useEffect } from "react";
import { RICH_TRANSFORMERS, VariantHeadingNode } from "../nodes/VariantHeadingNode";
import { $createMathNode, MATH_BLOCK_RE, MathNode } from "../nodes/MathNode";
import { TABLE_NODES } from "./TablePlugin";

// Nodos mínimos necesarios para que $convertFromMarkdownString reconozca
// heading, cita, lista, código, link, tabla y fórmulas — el subconjunto
// de RICH_EDITOR_NODES relevante a markdown estándar. No incluye los
// nodos custom del proyecto (DropNode, ChoiceNode, etc.) porque texto
// pegado desde afuera nunca va a producir esa sintaxis propia.
const SCRATCH_EDITOR_NODES = [
  VariantHeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  LinkNode,
  MathNode,
  ...TABLE_NODES,
];

// ── Heurística: ¿esto "parece" markdown? ──────────────────────────────
// Deliberadamente conservadora: preferimos NO interceptar texto ambiguo
// (por ej. una frase suelta con un "*" de multiplicación) antes que
// convertir de más y sorprender al usuario. Pedimos evidencia razonable:
// o bien una marca de bloque al inicio de línea (heading/lista/cita/
// código/tabla), o bien un patrón inline claro y repetido (negrita,
// cursiva, link) — una sola ocurrencia aislada de "*" o "_" no cuenta.
const BLOCK_MARK_RE = /^(#{1,6}\s+\S|>\s?\S|```|[-*+]\s+\S|\d+\.\s+\S|\|.+\|\s*$)/m;
const TABLE_SEP_RE = /^\|?[\s:-]+\|[\s:|-]+$/m;
const BOLD_RE = /\*\*[^*\n]+\*\*|__[^_\n]+__/;
const LINK_RE = /\[[^\]\n]+\]\([^)\n]+\)/;
const INLINE_CODE_RE = /`[^`\n]+`/;
const MATH_RE = /\$\$[\s\S]+?\$\$|(?<!\$)\$(?!\s)[^$\n]+?(?<!\s)\$(?!\$)/;

export function looksLikeMarkdown(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Evita disparar en un párrafo plano de una sola línea sin ninguna
  // marca — el caso más común de "pegué texto normal, no markdown".
  if (BLOCK_MARK_RE.test(trimmed)) return true;
  if (TABLE_SEP_RE.test(trimmed)) return true;
  if (BOLD_RE.test(trimmed)) return true;
  if (LINK_RE.test(trimmed)) return true;
  if (MATH_RE.test(trimmed)) return true;
  // Código inline solo cuenta si aparece junto con al menos otra marca
  // débil (evita falsos positivos con texto que usa comillas simples de
  // otro idioma o acentos graves sueltos).
  if (INLINE_CODE_RE.test(trimmed) && /\n/.test(trimmed)) return true;
  return false;
}

export function MarkdownPastePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        // Si el origen ya provee HTML enriquecido, dejamos que el
        // handler default de RichTextPlugin lo procese (ya sabe pegar
        // HTML preservando formato) — este plugin es específicamente
        // para cuando lo que llega es TEXTO PLANO con sintaxis markdown.
        if (clipboardData.types.includes("text/html")) return false;

        const text = clipboardData.getData("text/plain");
        if (!text || !looksLikeMarkdown(text)) return false;

        event.preventDefault();

        // 0) "$$formula$$" en bloque es multilinea (puede contener \n
        // propios del LaTeX, ej: \begin{aligned}...) — igual que las
        // tablas en rawTextToLexicalTree, lo sacamos ANTES de que
        // $convertFromMarkdownString toque el texto, y lo reemplazamos
        // por un token ASCII de una sola palabra que no colisiona con
        // ninguna sintaxis markdown real.
        const mathBlocks: string[] = [];
        const textWithMathTokens = text.replace(MATH_BLOCK_RE, (_m, formula: string) => {
          const idx = mathBlocks.push(formula.trim()) - 1;
          return `xMathBlockTokenxx${idx}xx`;
        });

        // 1) Editor headless temporal, descartable — el root.clear() que
        // hace $convertFromMarkdownString actúa sobre este documento
        // aislado, nunca sobre el editor real visible en pantalla.
        const scratchEditor = createEditor({ nodes: SCRATCH_EDITOR_NODES });
        let serializedNodes: Array<Record<string, unknown>> = [];

        scratchEditor.update(
          () => {
            $convertFromMarkdownString(textWithMathTokens, RICH_TRANSFORMERS);

            // Reemplazamos cada token de bloque math por su MathNode
            // real, recorriendo los TextNode resultantes (mismo patrón
            // que resolveTextNode en richTextSerializer.ts).
            const tokenRe = /xMathBlockTokenxx(\d+)xx/;
            const walk = (node: any): void => {
              if (node.getType?.() === "text") {
                const content: string = node.getTextContent();
                const match = tokenRe.exec(content);
                if (!match) return;
                const formula = mathBlocks[Number(match[1])];
                if (formula === undefined) return;
                const before = content.slice(0, match.index);
                const after = content.slice(match.index + match[0].length);
                const mathNode = $createMathNode({ formula, inline: false });
                if (before) node.insertBefore($createTextNode(before));
                node.insertBefore(mathNode);
                if (after) node.insertBefore($createTextNode(after));
                node.remove();
                return;
              }
              const children = node.getChildren?.() ?? [];
              for (const child of [...children]) walk(child);
            };
            walk($getRoot());

            serializedNodes = $getRoot()
              .getChildren()
              .map((n) => n.exportJSON());
          },
          { discrete: true },
        );

        if (serializedNodes.length === 0) return true; // nada que insertar, pero ya hicimos preventDefault

        // 2) De vuelta en el editor real: reconstruimos cada nodo desde
        // su JSON (LexicalNode.importJSON) y lo insertamos en el punto
        // del cursor. Reconstruir desde JSON en vez de mover instancias
        // directamente evita el problema de "un nodo no puede tener dos
        // editores dueños" entre el editor headless y el real.
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const klassMap = new Map(
            SCRATCH_EDITOR_NODES.map((klass) => [(klass as any).getType(), klass]),
          );

          const rebuilt = serializedNodes
            .map((json) => {
              const klass = klassMap.get(json.type) as any;
              if (!klass || typeof klass.importJSON !== "function") return null;
              return klass.importJSON(json);
            })
            .filter((n): n is NonNullable<typeof n> => n !== null);

          if (rebuilt.length > 0) {
            selection.insertNodes(rebuilt);
          }
        });

        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}
