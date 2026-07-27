"use client";
/**
 * ImgNode.tsx
 * ───────────
 * Nodo Lexical inline para [[img|url|caption]] y [[float|word|url|caption]].
 * Ambos tipos comparten el mismo nodo — la diferencia es el campo `float`
 * y `word` (solo float tiene palabra asociada).
 */
import type {
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { $getNodeByKey, DecoratorNode } from "lexical";
import React from "react";
import { Image as ImageIcon, WrapText } from "lucide-react";

import { snippetEditHandler } from "./sharedTypes";
import { SnippetChip } from "./SnippetChip";

export interface ImgPayload {
  url: string;
  caption?: string;
  float: boolean;
  word?: string; // solo cuando float=true
}

export type SerializedImgNode = Spread<
  { type: "img-snippet"; version: 1 } & ImgPayload,
  SerializedLexicalNode
>;

function imgLabel(p: ImgPayload): string {
  if (p.caption) return p.caption.slice(0, 20);
  const file = p.url.split("/").pop() ?? p.url;
  return file;
}

function ImgChipView({
  payload,
  nodeKey,
  editor,
}: {
  payload: ImgPayload;
  nodeKey: NodeKey;
  editor: LexicalEditor;
}) {
  return (
    <SnippetChip
      icon={payload.float ? <WrapText size={10} /> : <ImageIcon size={10} />}
      text={payload.float ? (payload.word ?? imgLabel(payload)) : imgLabel(payload)}
      title={payload.float ? `Float: ${payload.word}` : `Imagen: ${imgLabel(payload)}`}
      onClick={() =>
        snippetEditHandler.current?.({
          kind: payload.float ? "float" : "img",
          nodeKey,
          payload,
          replace: (next) =>
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isImgNode(node)) node.setPayload(next);
            }),
          remove: () =>
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isImgNode(node)) node.remove();
            }),
        })
      }
      onDelete={() =>
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isImgNode(node)) node.remove();
        })
      }
    />
  );
}

export class ImgNode extends DecoratorNode<React.ReactNode> {
  __payload: ImgPayload;

  static getType(): string {
    return "img-snippet";
  }

  static clone(node: ImgNode): ImgNode {
    return new ImgNode(node.__payload, node.__key);
  }

  constructor(payload: ImgPayload, key?: NodeKey) {
    super(key);
    this.__payload = payload;
  }

  static importJSON(
    serialized: SerializedLexicalNode & Record<string, unknown>,
  ): ImgNode {
    const { url, caption, float, word } = serialized as unknown as SerializedImgNode;
    return $createImgNode({ url, caption, float, word });
  }

  exportJSON(): SerializedImgNode {
    return { ...this.__payload, type: "img-snippet", version: 1 };
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "inline";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  setPayload(next: ImgPayload): void {
    this.getWritable().__payload = next;
  }

  getPayload(): ImgPayload {
    return this.__payload;
  }

  getTextContent(): string {
    return this.__payload.float
      ? (this.__payload.word ?? "")
      : `[imagen: ${imgLabel(this.__payload)}]`;
  }

  isInline(): true {
    return true;
  }

  decorate(editor: LexicalEditor): React.ReactNode {
    return (
      <ImgChipView editor={editor} nodeKey={this.getKey()} payload={this.__payload} />
    );
  }
}

export function $createImgNode(payload: ImgPayload): ImgNode {
  return new ImgNode(payload);
}

export function $isImgNode(
  node: LexicalNode | null | undefined,
): node is ImgNode {
  return node instanceof ImgNode;
}

export function imgRawToPayload(raw: string): ImgPayload | null {
  const inner = raw.startsWith("[[") && raw.endsWith("]]") ? raw.slice(2, -2) : raw;
  const parts = inner.split("|").map((p) => p.trim());
  if (parts[0] === "img") {
    return { url: parts[1] ?? "", caption: parts[2], float: false };
  }
  if (parts[0] === "float") {
    return { word: parts[1], url: parts[2] ?? "", caption: parts[3], float: true };
  }
  return null;
}

export function imgPayloadToRaw(p: ImgPayload): string {
  if (p.float) {
    return `[[float|${p.word ?? ""}|${p.url}|${p.caption ?? ""}]]`;
  }
  return `[[img|${p.url}|${p.caption ?? ""}]]`;
}
