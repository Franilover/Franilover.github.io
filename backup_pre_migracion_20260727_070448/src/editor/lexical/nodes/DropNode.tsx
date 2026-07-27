"use client";
/**
 * DropNode.tsx
 * ────────────
 * Nodo Lexical inline para [[drop|word|tipo|entidadId|entidadNombre]].
 * Entidad clickeable (personaje, criatura o item) que el lector puede tocar
 * en RenderSegmentos para revelar info y, en el editor, click para editar.
 */
import type {
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { $getNodeByKey, DecoratorNode } from "lexical";
import React from "react";
import { Swords, User, PawPrint, Package } from "lucide-react";

import { snippetEditHandler } from "./sharedTypes";
import { SnippetChip } from "./SnippetChip";

export interface DropPayload {
  word: string;
  tipo: "item" | "criatura" | "personaje";
  entidadId: string;
  entidadNombre: string;
}

export type SerializedDropNode = Spread<
  { type: "drop-snippet"; version: 1 } & DropPayload,
  SerializedLexicalNode
>;

const ICONS: Record<DropPayload["tipo"], React.ReactNode> = {
  personaje: <User size={10} />,
  criatura: <PawPrint size={10} />,
  item: <Package size={10} />,
};

function DropChipView({
  payload,
  nodeKey,
  editor,
}: {
  payload: DropPayload;
  nodeKey: NodeKey;
  editor: LexicalEditor;
}) {
  return (
    <SnippetChip
      icon={ICONS[payload.tipo] ?? <Swords size={10} />}
      text={payload.word}
      title={`Drop: ${payload.entidadNombre}`}
      onClick={() =>
        snippetEditHandler.current?.({
          kind: "drop",
          nodeKey,
          payload,
          replace: (next) =>
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isDropNode(node)) node.setPayload(next);
            }),
          remove: () =>
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isDropNode(node)) node.remove();
            }),
        })
      }
      onDelete={() =>
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isDropNode(node)) node.remove();
        })
      }
    />
  );
}

export class DropNode extends DecoratorNode<React.ReactNode> {
  __payload: DropPayload;

  static getType(): string {
    return "drop-snippet";
  }

  static clone(node: DropNode): DropNode {
    return new DropNode(node.__payload, node.__key);
  }

  constructor(payload: DropPayload, key?: NodeKey) {
    super(key);
    this.__payload = payload;
  }

  static importJSON(
    serialized: SerializedLexicalNode & Record<string, unknown>,
  ): DropNode {
    const { word, tipo, entidadId, entidadNombre } =
      serialized as unknown as SerializedDropNode;
    return $createDropNode({ word, tipo, entidadId, entidadNombre });
  }

  exportJSON(): SerializedDropNode {
    return { ...this.__payload, type: "drop-snippet", version: 1 };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "inline";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  setPayload(next: DropPayload): void {
    this.getWritable().__payload = next;
  }

  getPayload(): DropPayload {
    return this.__payload;
  }

  getTextContent(): string {
    return this.__payload.word;
  }

  isInline(): true {
    return true;
  }

  decorate(editor: LexicalEditor): React.ReactNode {
    return (
      <DropChipView editor={editor} nodeKey={this.getKey()} payload={this.__payload} />
    );
  }
}

export function $createDropNode(payload: DropPayload): DropNode {
  return new DropNode(payload);
}

export function $isDropNode(
  node: LexicalNode | null | undefined,
): node is DropNode {
  return node instanceof DropNode;
}

export function dropRawToPayload(raw: string): DropPayload | null {
  const inner = raw.startsWith("[[") && raw.endsWith("]]") ? raw.slice(2, -2) : raw;
  const parts = inner.split("|").map((p) => p.trim());
  if (parts[0] !== "drop") return null;
  return {
    word: parts[1] ?? "",
    tipo: (parts[2] ?? "personaje") as DropPayload["tipo"],
    entidadId: parts[3] ?? "",
    entidadNombre: parts[4] ?? parts[1] ?? "",
  };
}

export function dropPayloadToRaw(p: DropPayload): string {
  return `[[drop|${p.word}|${p.tipo}|${p.entidadId}|${p.entidadNombre}]]`;
}
