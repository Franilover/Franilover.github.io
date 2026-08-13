"use client";
/**
 * VariantHeadingNode.tsx
 * ───────────────────────
 * Extiende el HeadingNode estándar de Lexical (@lexical/rich-text) para
 * agregar un campo "variant" — el ornamento visual (línea inferior, barra
 * lateral, portada centrada, drop-cap) — que es INDEPENDIENTE del nivel
 * h1-h4. Antes, cada nivel tenía su propio ornamento fijo hardcodeado en
 * el theme (h1=portada, h2=línea, h3=barra, h4=dropcap); ahora el nivel
 * solo controla tamaño/peso/color (ver theme.heading en RichEditor.tsx,
 * sistema "Opción A" / escala tipográfica), y la variante se aplica por
 * separado vía data-variant en el DOM, elegible desde el menú "/" sin
 * importar el nivel del heading.
 *
 * Por qué extender en vez de usar un atributo suelto: Lexical no permite
 * "propiedades libres" en nodos nativos — hay que subclasificar el nodo,
 * redeclarar createDOM/updateDOM (para reflejar data-variant en el <hN>
 * real) y exportJSON/importJSON (para persistir el campo en el árbol
 * serializado). $convertFromMarkdownString (usado por
 * rawTextToLexicalTree) sigue creando HeadingNode base al parsear "#" —
 * por eso el registro en RICH_EDITOR_NODES reemplaza HeadingNode por
 * este subtipo (mismo "type": "heading", ver replaceHeadingNode más abajo)
 * y richTextSerializer post-procesa la sintaxis "{variante}" al final de
 * la línea de heading para setear el campo tras la conversión estándar.
 */
import {
  HeadingNode,
  type SerializedHeadingNode,
  type HeadingTagType,
} from "@lexical/rich-text";
import { TRANSFORMERS, type ElementTransformer, type TextMatchTransformer } from "@lexical/markdown";
import {
  $applyNodeReplacement,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type Spread,
} from "lexical";
import { $createMathNode, $isMathNode, MathNode } from "./MathNode";

export type HeadingVariant =
  | "none"
  | "linea"
  | "barra"
  | "portada"
  | "dropcap"
  | "primeramayuscula";

export type SerializedVariantHeadingNode = Spread<
  { variant: HeadingVariant },
  SerializedHeadingNode
>;

export class VariantHeadingNode extends HeadingNode {
  __variant: HeadingVariant = "none";

  static getType(): string {
    return "heading";
  }

  static clone(node: VariantHeadingNode): VariantHeadingNode {
    const cloned = new VariantHeadingNode(node.__tag, node.__key);
    cloned.__variant = node.__variant;
    return cloned;
  }

  constructor(tag: HeadingTagType, key?: NodeKey) {
    super(tag, key);
  }

  getVariant(): HeadingVariant {
    const self = this.getLatest();
    return self.__variant;
  }

  setVariant(variant: HeadingVariant): void {
    const self = this.getWritable();
    self.__variant = variant;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    if (this.__variant !== "none") {
      dom.setAttribute("data-variant", this.__variant);
    }
    return dom;
  }

  updateDOM(
    prevNode: VariantHeadingNode,
    dom: HTMLElement,
    config: EditorConfig,
  ): boolean {
    // HeadingNode.updateDOM tipa su parámetro como "this" (polimórfico) —
    // TS no puede garantizar que un VariantHeadingNode sea asignable a
    // ese "this" genérico dentro de la propia subclase, aunque en runtime
    // es exactamente el mismo objeto. Cast explícito para pasar el check
    // de tipos; el comportamiento de super.updateDOM no cambia (solo lee
    // props del nodo base como tag/format, que sí existen acá).
    const changed = super.updateDOM(
      prevNode as unknown as this,
      dom,
      config,
    );
    if (prevNode.__variant !== this.__variant) {
      if (this.__variant === "none") {
        dom.removeAttribute("data-variant");
      } else {
        dom.setAttribute("data-variant", this.__variant);
      }
    }
    return changed;
  }

  static importJSON(serializedNode: SerializedVariantHeadingNode): VariantHeadingNode {
    // CORRECCIÓN (ver historial de debug): en un momento pensamos que
    // hacía falta reconstruir "children" acá a mano, llamando
    // $parseSerializedNode(childJSON) + node.append() por cada hijo.
    // Estaba mal — verificado contra el código fuente real de Lexical
    // instalado (node_modules/lexical, $parseSerializedNodeImpl):
    //
    //   const node = nodeClass.importJSON(serializedNode);  // esto
    //   if ($isElementNode(node) && Array.isArray(children)) {
    //     for (...) node.append($parseSerializedNodeImpl(child, ...));
    //   }
    //
    // O sea: $parseSerializedNode YA reconstruye children automáticamente
    // DESPUÉS de llamar a este importJSON, recorriendo
    // serializedNode.children del propio nodo. Si este método también
    // los agrega acá adentro, terminan agregados DOS VECES (bug real que
    // reprodujimos: "Titulo con formulaTitulo con formula"). Este método
    // es responsable ÚNICAMENTE de reconstruirse a sí mismo (tag, format,
    // indent, direction, variant) — nunca debe tocar children.
    const node = $applyNodeReplacement(new VariantHeadingNode(serializedNode.tag));
    node.setFormat(serializedNode.format);
    node.setIndent(serializedNode.indent);
    node.setDirection(serializedNode.direction);
    node.setVariant(serializedNode.variant ?? "none");
    return node;
  }

  exportJSON(): SerializedVariantHeadingNode {
    return {
      ...super.exportJSON(),
      variant: this.__variant,
    };
  }
}

export function $isVariantHeadingNode(
  node: LexicalNode | null | undefined,
): node is VariantHeadingNode {
  return node instanceof VariantHeadingNode;
}

export function $createVariantHeadingNode(
  tag: HeadingTagType,
  variant: HeadingVariant = "none",
): VariantHeadingNode {
  const node = new VariantHeadingNode(tag);
  if (variant !== "none") node.setVariant(variant);
  return node;
}

// Sintaxis inline usada en el raw markdown para PERSISTIR la variante en
// el string guardado (round-trip guardar/cargar) — "{barra}" / "{linea}" /
// "{portada}" / "{dropcap}" al final del texto del heading, ej:
// "### Título {barra}". NO es un atajo pensado para que el usuario lo
// tipee a mano en vivo (MarkdownShortcutPlugin no lo intercepta mientras
// se escribe, solo actúa sobre el "### " inicial) — la única vía
// soportada para aplicar una variante es el menú "/" (ver
// applyHeadingVariant en MarkdownCommandPalette.tsx), que llama
// node.setVariant() directamente sobre el nodo ya creado. El sufijo
// existe para que esa elección sobreviva un guardado/recarga del
// documento, ya que el contenido persiste como texto plano, no como JSON
// de Lexical (ver richTextSerializer.ts). Se eligió "{...}" porque no
// colisiona con ninguna sintaxis markdown estándar que
// $convertFromMarkdownString ya interprete, y es fácil de
// detectar/quitar con una regex simple sobre la línea cruda.
export const VARIANT_SUFFIX_RE =
  /\s*\{(linea|barra|portada|dropcap|primeramayuscula)\}\s*$/;

export function stripVariantSuffix(text: string): {
  text: string;
  variant: HeadingVariant;
} {
  const match = VARIANT_SUFFIX_RE.exec(text);
  if (!match) return { text, variant: "none" };
  return {
    text: text.slice(0, match.index),
    variant: match[1] as HeadingVariant,
  };
}

export function appendVariantSuffix(text: string, variant: HeadingVariant): string {
  if (variant === "none") return text;
  return `${text} {${variant}}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Set de TRANSFORMERS compartido: idéntico al default de @lexical/markdown
// excepto que el transformer "HEADING" crea VariantHeadingNode (con soporte
// de variante) en vez del HeadingNode nativo. Usado tanto por
// MarkdownShortcutPlugin (escritura en vivo de "# ") como por
// rawTextToLexicalTree en richTextSerializer.ts (carga inicial / parseo
// completo) — un único lugar, para que ambos flujos produzcan exactamente
// el mismo tipo de nodo.
// ─────────────────────────────────────────────────────────────────────────────
const HEADING_TRANSFORMER: ElementTransformer = {
  dependencies: [VariantHeadingNode],
  export: (node) => {
    if (!$isVariantHeadingNode(node)) return null;
    const level = Number((node as VariantHeadingNode).getTag().slice(1));
    const text = node.getTextContent();
    return "#".repeat(level) + " " + appendVariantSuffix(text, node.getVariant());
  },
  regExp: /^(#{1,6}) /,
  replace: (parentNode, children, match) => {
    const tag = `h${match[1].length}` as HeadingTagType;
    const heading = $createVariantHeadingNode(tag);
    heading.append(...children);
    parentNode.replace(heading);
    heading.selectEnd();
  },
  type: "element",
};

// MATH_INLINE_TRANSFORMER: soporte de "$formula$" tanto al tipear en vivo
// (MarkdownShortcutPlugin, dispara con "$" como trigger) como al cargar/
// pegar texto vía $convertFromMarkdownString. El bloque "$$...$$"
// multilinea NO se cubre acá — es un TextMatchTransformer de una sola
// línea, igual que LINK; el bloque se resuelve aparte con un paso de
// tokenización previo (ver richTextSerializer.ts y MarkdownPastePlugin),
// mismo patrón que usan tablas/condiciones para contenido multilinea.
const MATH_INLINE_TRANSFORMER: TextMatchTransformer = {
  dependencies: [MathNode],
  export: (node) => {
    if (!$isMathNode(node) || node.getPayload().inline !== true) return null;
    return `$${node.getPayload().formula}$`;
  },
  importRegExp: /(?<!\$)\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\$)/,
  regExp: /(?<!\$)\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\$)$/,
  replace: (textNode, match) => {
    const [, formula] = match;
    const mathNode = $createMathNode({ formula, inline: true });
    textNode.replace(mathNode);
  },
  trigger: "$",
  type: "text-match",
};

export const RICH_TRANSFORMERS = [
  ...TRANSFORMERS.map((t) =>
    (t as ElementTransformer).dependencies?.includes(HeadingNode as any)
      ? HEADING_TRANSFORMER
      : t,
  ),
  MATH_INLINE_TRANSFORMER,
];
