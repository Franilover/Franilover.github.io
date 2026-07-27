/**
 * richTextSerializer.ts
 * ─────────────────────
 * Serialización BIDIRECCIONAL entre:
 *   - string raw con [[kind|...]] (lo que guardas en Supabase)
 *   - árbol de nodos Lexical (lo que vive en el editor en runtime)
 *
 * DESERIALIZAR (cargar): rawTextToEditorNodes()
 *   Se llama una vez al montar el editor con el contenido guardado.
 *   Parsea el string, detecta cada [[kind|...]] y crea el nodo Lexical
 *   correspondiente. El resto del texto queda como TextNode normal.
 *
 * SERIALIZAR (guardar): serializeRootToRaw()
 *   Se llama antes de mandar el contenido a Supabase.
 *   Recorre el árbol de nodos y reconstruye el string con [[kind|...]].
 *   El resultado es IDÉNTICO al formato actual — parseContenido() y
 *   SegmentRenderers (render de lectura) no cambian nada.
 *
 * Nodos soportados: drop, img, float, sound, choice, use, gate, section
 * (El nodo "cita" no es un snippet con modal — es markup puro [[cita|...]]
 *  que se maneja como TextNode y se renderiza en la vista de lectura.)
 */
import { $isCodeNode } from "@lexical/code";
import { $isListNode, $isListItemNode } from "@lexical/list";
import { $convertFromMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { $isHeadingNode, $isQuoteNode } from "@lexical/rich-text";
import {
  $isTableNode,
  $isTableRowNode,
  $isTableCellNode,
  $createTableNodeWithDimensions,
} from "@lexical/table";
import type {
  LexicalNode} from "lexical";
import {
  $createLineBreakNode,
  $createTextNode,
  $getRoot,
  $insertNodes,
  $isLineBreakNode,
} from "lexical";

import {
  $createChoiceNode,
  $isChoiceNode,
  choicePayloadToRaw,
  choiceRawToPayload,
} from "./nodes/ChoiceNode";
import {
  $createDropNode,
  $isDropNode,
  dropPayloadToRaw,
  dropRawToPayload,
} from "./nodes/DropNode";
import {
  $createFlagNode,
  $isFlagNode,
  flagPayloadToRaw,
  flagRawToPayload,
} from "./nodes/FlagNode";
import {
  $createCondicionNode,
  $isCondicionNode,
  condicionPayloadToRaw,
  condicionRawToPayload,
} from "./nodes/CondicionNode";
import {
  $createImgNode,
  $isImgNode,
  imgPayloadToRaw,
  imgRawToPayload,
} from "./nodes/ImgNode";
import {
  $createSectionNode,
  $isSectionNode,
  sectionPayloadToRaw,
  sectionRawToPayload,
} from "./nodes/SectionNode";
import {
  $createSoundNode,
  $isSoundNode,
  soundPayloadToRaw,
  soundRawToPayload,
} from "./nodes/SoundNode";
import {
  $createUseNode,
  $isUseNode,
  parseUsePayloadToRaw,
  parseUseRawToPayload,
} from "./nodes/UseNode";
import {
  $createWikilinkNode,
  $isWikilinkNode,
  wikilinkPayloadToRaw,
  wikilinkRawToPayload,
} from "./nodes/WikilinkNode";

// ─────────────────────────────────────────────────────────────────────────────
// Regex de detección de snippets
// Los condicion (y sus formatos legacy gate/flag|if) son multilinea, los
// demás son single-line
// ─────────────────────────────────────────────────────────────────────────────

const CONDICION_RE =
  /\[\[condicion\|(?:item|flag)\|[^\|]+\|[^\|]*\|[\s\S]+?\]\]/g;
// Legacy — contenido guardado antes de la fusión Gate+Flag-if. Se siguen
// reconociendo al cargar para migrar automáticamente a CondicionNode.
const GATE_RE = /\[\[gate\|[^\|]+\|[\s\S]+?\]\]/g;
// [[flag|if|...]] es multilinea igual que gate/condicion (mismo motivo: el
// cuerpo contiene "===" y texto libre). [[flag|set|...]] en cambio es
// single-line y cae en SNIPPET_RE junto a los demás snippets simples.
const FLAG_IF_RE = /\[\[flag\|if\|[^\|]+\|[^\|]*\|[\s\S]+?\]\]/g;
const SNIPPET_RE =
  /\[\[(?:drop|img|float|sound|choice|use|section|cita|flag\|set)[^\]]*\]\]/g;
// Wikilinks: [[Nombre]] o [[Nombre|Alias]] SIN "kind|" — debe evaluarse
// por separado porque el resto de snippets usa "[[palabra|...]]" con un
// kind reservado como primer segmento. Excluye explícitamente los kind
// conocidos para no capturar snippets malformados como si fueran
// wikilinks; el segundo segmento (alias), si existe, es libre.
const WIKILINK_RE =
  /\[\[(?!(?:drop|img|float|sound|choice|use|section|cita|condicion|gate|flag)\|)([^\[\]|]+)(?:\|([^\[\]|]*))?\]\]/g;

// ─────────────────────────────────────────────────────────────────────────────
// Convierte un raw [[kind|...]] string → LexicalNode
// ─────────────────────────────────────────────────────────────────────────────

export function rawSnippetToNode(raw: string): LexicalNode | null {
  const inner =
    raw.startsWith("[[") && raw.endsWith("]]") ? raw.slice(2, -2) : raw;
  const kind = inner.split("|")[0]?.trim();

  switch (kind) {
    case "drop": {
      const p = dropRawToPayload(raw);
      return p ? $createDropNode(p) : null;
    }
    case "img": {
      const p = imgRawToPayload(raw);
      return p ? $createImgNode(p) : null;
    }
    case "float": {
      const p = imgRawToPayload(raw);
      return p ? $createImgNode(p) : null;
    }
    case "sound": {
      const p = soundRawToPayload(raw);
      return p ? $createSoundNode(p) : null;
    }
    case "choice": {
      const p = choiceRawToPayload(raw);
      return p ? $createChoiceNode(p) : null;
    }
    case "use": {
      const p = parseUseRawToPayload(raw);
      return p ? $createUseNode(p) : null;
    }
    case "condicion": {
      const p = condicionRawToPayload(raw);
      return p ? $createCondicionNode(p) : null;
    }
    case "gate": {
      // Legacy — migra automáticamente a CondicionNode al leerlo.
      const p = condicionRawToPayload(raw);
      return p ? $createCondicionNode(p) : null;
    }
    case "flag": {
      // "flag|if|..." es legacy y migra a CondicionNode; "flag|set|..."
      // sigue siendo una Acción (FlagNode).
      if (raw.startsWith("[[flag|if|")) {
        const p = condicionRawToPayload(raw);
        return p ? $createCondicionNode(p) : null;
      }
      const p = flagRawToPayload(raw);
      return p ? $createFlagNode(p) : null;
    }
    case "section": {
      const p = sectionRawToPayload(raw);
      return p ? $createSectionNode(p) : null;
    }
    // "cita" queda como texto plano — se maneja solo en lectura
    default: {
      // Los wikilinks no tienen "kind|" así que caen acá — reintentamos
      // como wikilink antes de rendirnos a texto plano.
      const wp = wikilinkRawToPayload(raw);
      if (wp) return $createWikilinkNode(wp);
      return $createTextNode(raw);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DESERIALIZAR: raw string → árbol Lexical
// Llama a esto dentro de editor.update(() => { rawTextToLexicalTree(text); })
// ─────────────────────────────────────────────────────────────────────────────

// Detecta un bloque de tabla markdown: línea "| ... |", seguida de línea
// separadora "|---|---|", seguida de N líneas de datos. Igual criterio que
// parseTableMd/tableRegex del MarkdownEditor.tsx original.
const TABLE_BLOCK_RE = /^(\|.+\|)\n(\|[-: |]+\|)\n((?:\|.+\|\n?)*)/;

function parseTableBlock(block: string): string[][] {
  const lines = block.split("\n").filter((l) => l.trim());
  const parseRow = (row: string) =>
    row
      .trim()
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
  const isSep = (r: string) => /^\|[-| :]+\|$/.test(r.trim());
  return lines.filter((l) => !isSep(l)).map(parseRow);
}

export function rawTextToLexicalTree(raw: string): void {
  const root = $getRoot();
  root.clear();

  if (!raw.trim()) return; // documento vacío — Lexical deja su párrafo por defecto

  // Extraemos TODO lo que no es markdown estándar (gates, snippets,
  // wikilinks, tablas) y lo reemplazamos por un placeholder de texto
  // plano de una sola palabra, ASCII, sin espacios ni símbolos markdown
  // — algo que $convertFromMarkdownString jamás interpretará como
  // sintaxis (a diferencia de "[[...]]", que si quedara mezclado con
  // markdown real podría chocar con la sintaxis de link de markdown).
  //
  // Estrategia (por qué NO llamamos $convertFromMarkdownString varias
  // veces intercalado con inserciones manuales): esa función SIEMPRE
  // hace root.clear() al no recibir nodo destino, y pasar un nodo
  // destino tiene comportamiento ambiguo/con bugs conocidos entre
  // versiones de Lexical (ver facebook/lexical#7663). Una sola llamada
  // sobre el documento completo es su caso de uso documentado y estable
  // — así que convertimos TODO de una vez con placeholders, y después
  // recorremos el árbol resultante reemplazando cada placeholder por su
  // nodo real (snippet, tabla, wikilink).
  const registry = new Map<
    string,
    { kind: "snippet" | "table"; raw?: string; rows?: string[][] }
  >();
  let counter = 0;
  const nextToken = () => `xSnippetTokenxx${counter++}xx`;

  // 1) Tablas primero (son bloques multilinea, deben extraerse antes de
  // que cualquier otra cosa toque los saltos de línea internos).
  let working = raw.replace(
    new RegExp(TABLE_BLOCK_RE.source, "gm"),
    (match) => {
      const token = nextToken();
      registry.set(token, { kind: "table", rows: parseTableBlock(match) });
      return token;
    },
  );

  // 2) Condicion (y sus formatos legacy gate/flag-if) multilinea (mismo
  // motivo: cuerpo con "===" y texto libre que no debe tocar el resto del
  // pipeline de markdown).
  working = working.replace(CONDICION_RE, (match) => {
    const token = nextToken();
    registry.set(token, { kind: "snippet", raw: match });
    return token;
  });
  working = working.replace(GATE_RE, (match) => {
    const token = nextToken();
    registry.set(token, { kind: "snippet", raw: match });
    return token;
  });
  working = working.replace(FLAG_IF_RE, (match) => {
    const token = nextToken();
    registry.set(token, { kind: "snippet", raw: match });
    return token;
  });

  // 3) Snippets de una línea y wikilinks.
  working = working.replace(
    new RegExp(`${SNIPPET_RE.source}|${WIKILINK_RE.source}`, "g"),
    (match) => {
      const token = nextToken();
      registry.set(token, { kind: "snippet", raw: match });
      return token;
    },
  );

  // 4) Saltos de línea simples: $convertFromMarkdownString sigue la spec
  // de Markdown, donde un solo "\n" dentro de un párrafo NO es un salto
  // de línea (se junta con la línea siguiente) — solo una línea en
  // blanco separa párrafos. Eso hacía desaparecer los saltos de línea
  // simples que el usuario escribe con Enter. Para preservarlos,
  // reemplazamos cada "\n" simple (uno solo, no parte de una línea en
  // blanco) por un token propio ASCII sin espacios — mismo mecanismo que
  // ya se usa para snippets — y luego, en el post-proceso, lo
  // convertimos en un LineBreakNode real dentro del párrafo.
  const linebreakToken = "xSoftBreakTokenxx";
  working = working.replace(/([^\n])\n(?!\n)/g, `$1${linebreakToken}`);

  // 5) Una sola conversión de markdown → árbol Lexical real (listas,
  // headings, bold, italic, etc. — todo lo que MarkdownShortcutPlugin
  // aplicaría si el usuario lo tipeara a mano).
  $convertFromMarkdownString(working, TRANSFORMERS);

  // 6) Post-proceso: recorremos todos los TextNode del árbol recién
  // creado buscando nuestros tokens y los reemplazamos in-place por el
  // nodo real (DropNode, ChoiceNode, WikilinkNode, TableNode, LineBreakNode).
  // Un TextNode puede contener el token pegado a texto real a los
  // lados (ej: "Miras al xSnippetTokenxx0xx." tras la conversión), así
  // que separamos manualmente el texto sobrante alrededor del token.
  const tokenRe = /xSnippetTokenxx(\d+)xx|xSoftBreakTokenxx/;

  function resolveTextNode(node: LexicalNode): void {
    if (node.getType() !== "text") return;
    const text = (node as any).getTextContent() as string;
    const match = tokenRe.exec(text);
    if (!match) return;

    const token = match[0];
    const isSoftBreak = token === linebreakToken;
    const entry = isSoftBreak ? null : registry.get(token);
    if (!isSoftBreak && !entry) return;

    const before = text.slice(0, match.index);
    const after = text.slice(match.index + token.length);

    let replacement: LexicalNode | null = null;
    if (isSoftBreak) {
      replacement = $createLineBreakNode();
    } else if (entry?.kind === "table" && entry.rows) {
      replacement = buildTableNode(entry.rows);
    } else if (entry?.kind === "snippet" && entry.raw) {
      replacement = rawSnippetToNode(entry.raw);
    }

    const parent = (node as any).getParent?.();
    if (!parent) return;

    if (before) (node as any).insertBefore($createTextNode(before));
    if (replacement) (node as any).insertBefore(replacement);
    if (after) {
      const afterNode = $createTextNode(after);
      (node as any).insertBefore(afterNode);
      // El texto "after" puede contener OTRO token si había varios
      // snippets/saltos en la misma línea original — lo resolvemos
      // recursivo.
      resolveTextNode(afterNode);
    }
    node.remove();
  }

  function walk(node: LexicalNode): void {
    if (node.getType() === "text") {
      resolveTextNode(node);
      return;
    }
    const children: LexicalNode[] = (node as any).getChildren?.() ?? [];
    // Copiamos el array porque resolveTextNode muta la lista de hijos
    // del padre (insertBefore/remove) mientras iteramos.
    for (const child of [...children]) {
      walk(child);
    }
  }

  walk($getRoot());

  // Las tablas quedan envueltas dentro de un ParagraphNode (porque el
  // token vivía en un TextNode dentro de un párrafo), pero TableNode
  // debe ser hijo directo del root, no de un párrafo — lo sacamos.
  hoistTableNodes($getRoot());
}

function buildTableNode(rows: string[][]) {
  const tableNode = $createTableNodeWithDimensions(
    rows.length,
    Math.max(1, ...rows.map((r) => r.length)),
    true,
  );
  const rowNodes: LexicalNode[] = (tableNode as any).getChildren?.() ?? [];
  rowNodes.forEach((rowNode, ri) => {
    if (!$isTableRowNode(rowNode)) return;
    const cellNodes: LexicalNode[] = (rowNode as any).getChildren?.() ?? [];
    cellNodes.forEach((cellNode, ci) => {
      if (!$isTableCellNode(cellNode)) return;
      const text = rows[ri]?.[ci] ?? "";
      if (!text) return;
      const p = (cellNode as any).getChildren?.()[0];
      if (p && typeof p.append === "function") {
        p.append($createTextNode(text));
      }
    });
  });
  return tableNode as unknown as LexicalNode;
}

// Un TableNode insertado vía insertBefore() dentro de un párrafo termina
// como hijo de ese ParagraphNode, lo cual Lexical no permite como
// estructura estable (TableNode espera ser top-level). Lo movemos a ser
// hermano del párrafo que lo contenía.
function hoistTableNodes(root: LexicalNode): void {
  const children: LexicalNode[] = (root as any).getChildren?.() ?? [];
  for (const child of [...children]) {
    if (child.getType() !== "paragraph") continue;
    const innerChildren: LexicalNode[] = (child as any).getChildren?.() ?? [];
    const tableChild = innerChildren.find((c) => $isTableNode(c));
    if (!tableChild) continue;
    (child as any).insertBefore(tableChild);
    // Si el párrafo quedó vacío tras sacar la tabla, lo eliminamos; si
    // tenía texto antes/después de la tabla, esos quedan como párrafos
    // separados automáticamente por cómo insertBefore reordena.
    if ((child as any).getChildrenSize?.() === 0) {
      (child as any).remove();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERIALIZAR: árbol Lexical → raw string
// Llama a esto dentro de editor.read(() => { const raw = serializeRootToRaw(); })
// ─────────────────────────────────────────────────────────────────────────────

// Serializa una TableNode a markdown pipe-table: "| a | b |\n|---|---|\n|c|d|"
// — mismo formato que generaba serializeTableMd() en MarkdownEditor.tsx,
// para que parseContenido()/renderMarkdown() del lado de lectura no
// necesiten ningún cambio.
function serializeTableNode(
  tableNode: LexicalNode,
  walkInline: (n: LexicalNode) => string,
): string {
  const rowNodes: LexicalNode[] = (tableNode as any).getChildren?.() ?? [];
  const rows: string[][] = rowNodes
    .filter((r) => $isTableRowNode(r))
    .map((row) => {
      const cellNodes: LexicalNode[] = (row as any).getChildren?.() ?? [];
      return cellNodes
        .filter((c) => $isTableCellNode(c))
        .map((cell) => {
          const cellChildren: LexicalNode[] =
            (cell as any).getChildren?.() ?? [];
          return cellChildren.map(walkInline).join("").trim();
        });
    });

  if (!rows.length) return "";
  const cols = Math.max(...rows.map((r) => r.length));
  const padded = rows.map((r) => [...r, ...Array(cols - r.length).fill("")]);
  const formatRow = (r: string[]) => "| " + r.join(" | ") + " |";
  const sep = "| " + Array(cols).fill("---").join(" | ") + " |";
  return [formatRow(padded[0]), sep, ...padded.slice(1).map(formatRow)].join(
    "\n",
  );
}

export function serializeRootToRaw(): string {
  const root = $getRoot();
  const lines: string[] = [];

  function walkNode(node: LexicalNode): string {
    if ($isDropNode(node)) return dropPayloadToRaw(node.getPayload());
    if ($isImgNode(node)) return imgPayloadToRaw(node.getPayload());
    if ($isSoundNode(node)) return soundPayloadToRaw(node.getPayload());
    if ($isChoiceNode(node)) return choicePayloadToRaw(node.getPayload());
    if ($isUseNode(node)) return parseUsePayloadToRaw(node.getPayload());
    if ($isCondicionNode(node)) return condicionPayloadToRaw(node.getPayload());
    if ($isFlagNode(node)) return flagPayloadToRaw(node.getPayload());
    if ($isSectionNode(node)) return sectionPayloadToRaw(node.getPayload());
    if ($isWikilinkNode(node)) return wikilinkPayloadToRaw(node.getPayload());
    if ($isTableNode(node)) return serializeTableNode(node, walkNode);
    if ($isLineBreakNode(node)) return "\n";

    if (node.getType() === "text") {
      return (node as any).getTextContent();
    }

    // Para párrafos y otros nodos contenedores, concatenamos sus hijos
    const children: LexicalNode[] = (node as any).getChildren?.() ?? [];
    return children.map(walkNode).join("");
  }

  // Serializa un bloque top-level a su línea markdown correspondiente,
  // reanteponiendo la sintaxis que MarkdownShortcutPlugin/$convertFromMarkdownString
  // ya convirtió a nodo estructural (heading → "#", quote → ">", code → "```",
  // lista → "- "/"1. "). Sin esto, serializeRootToRaw() devolvía el heading
  // como texto plano sin "#", lo cual rompía el round-trip: InitialContentPlugin
  // comparaba ese raw (sin "#") contra el árbol actual (con HeadingNode real),
  // nunca coincidían, y disparaba root.clear() + reconstrucción completa en
  // cada tecla — eso es lo que "desordenaba" todo al escribir "# ".
  function inlineText(node: LexicalNode): string {
    const children: LexicalNode[] = (node as any).getChildren?.() ?? [];
    return children.map(walkNode).join("");
  }

  function serializeBlock(child: LexicalNode): string {
    if ($isHeadingNode(child)) {
      const tag = (child as any).getTag?.() as string; // "h1".."h6"
      const level = Math.max(
        1,
        Math.min(6, parseInt(tag?.[1] ?? "1", 10) || 1),
      );
      return "#".repeat(level) + " " + inlineText(child);
    }

    if ($isQuoteNode(child)) {
      return inlineText(child)
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");
    }

    if ($isCodeNode(child)) {
      const lang = (child as any).getLanguage?.() || "";
      return "```" + lang + "\n" + inlineText(child) + "\n```";
    }

    if ($isListNode(child)) {
      const isOrdered = (child as any).getListType?.() === "number";
      const items: LexicalNode[] = (child as any).getChildren?.() ?? [];
      return items
        .map((item, i) => {
          if (!$isListItemNode(item)) return walkNode(item);
          const nested = (item as any)
            .getChildren?.()
            .find((c: LexicalNode) => $isListNode(c));
          const ownText = ((item as any).getChildren?.() ?? [])
            .filter((c: LexicalNode) => !$isListNode(c))
            .map(walkNode)
            .join("");
          const marker = isOrdered ? `${i + 1}. ` : "- ";
          const line = marker + ownText;
          return nested ? line + "\n" + serializeBlock(nested) : line;
        })
        .join("\n");
    }

    if ($isTableNode(child)) {
      // La tabla es su propio bloque — no se mezcla con el join("\n\n") de
      // párrafos porque ya contiene sus propios saltos de línea internos.
      return walkNode(child);
    }

    if (child.getType() === "paragraph") {
      return inlineText(child);
    }

    return walkNode(child);
  }

  const rootChildren: LexicalNode[] = (root as any).getChildren();
  for (const child of rootChildren) {
    lines.push(serializeBlock(child));
  }

  // "\n\n" — separador real de párrafo en Markdown. Con un solo "\n" acá,
  // el siguiente re-parseo (rawTextToLexicalTree) trataba el bloque previo
  // y el siguiente como si fueran la MISMA línea de texto (el paso de
  // soft-breaks los fusiona), lo que hacía que gates/choices/sections
  // quedaran "atrapados" dentro de un párrafo de texto plano tras un
  // roundtrip serialize→parse (ej: salir y volver a entrar al modo
  // preview) — se veían como texto crudo sin chip. Bug preexistente que
  // rara vez se disparaba porque escribir con Enter en el editor ya deja
  // línea en blanco real entre bloques; se volvió visible al agregar más
  // nodos (gate con target, flag) que dependen de este roundtrip.
  return lines.join("\n\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper para insertar un snippet en la posición del cursor actual
// ─────────────────────────────────────────────────────────────────────────────

export function insertSnippetNode(raw: string): void {
  const node = rawSnippetToNode(raw);
  if (node) $insertNodes([node]);
}
