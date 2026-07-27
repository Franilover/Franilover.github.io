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
import { TRANSFORMERS, type ElementTransformer } from "@lexical/markdown";
import type { EditorConfig, LexicalNode, NodeKey, Spread } from "lexical";

export type HeadingVariant = "none" | "linea" | "barra" | "portada" | "dropcap";

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
    const node = new VariantHeadingNode(serializedNode.tag);
    node.setVariant(serializedNode.variant ?? "none");
    node.setFormat(serializedNode.format);
    node.setIndent(serializedNode.indent);
    node.setDirection(serializedNode.direction);
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
export const VARIANT_SUFFIX_RE = /\s*\{(linea|barra|portada|dropcap)\}\s*$/;

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
  regExp: /^(#{1,6})\s/,
  replace: (parentNode, children, match) => {
    const tag = `h${match[1].length}` as HeadingTagType;
    const heading = $createVariantHeadingNode(tag);
    heading.append(...children);
    parentNode.replace(heading);
    heading.selectEnd();
  },
  type: "element",
};

export const RICH_TRANSFORMERS = TRANSFORMERS.map((t) =>
  (t as ElementTransformer).dependencies?.includes(HeadingNode as any)
    ? HEADING_TRANSFORMER
    : t,
);
