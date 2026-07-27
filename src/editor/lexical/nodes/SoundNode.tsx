"use client";
/**
 * SoundNode.tsx
 * ─────────────
 * Nodo Lexical inline para [[sound|url|volume]].
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
import { Music2 } from "lucide-react";

import { snippetEditHandler } from "./sharedTypes";
import { SnippetChip } from "./SnippetChip";

export interface SoundPayload {
  url: string;
  volume: number;
}

export type SerializedSoundNode = Spread<
  { type: "sound-snippet"; version: 1 } & SoundPayload,
  SerializedLexicalNode
>;

function soundLabel(url: string): string {
  const file = url.split("/").pop() ?? url;
  return file.replace(/\.[a-z0-9]+$/i, "");
}

function SoundChipView({
  payload,
  nodeKey,
  editor,
}: {
  payload: SoundPayload;
  nodeKey: NodeKey;
  editor: LexicalEditor;
}) {
  return (
    <SnippetChip
      icon={<Music2 size={10} />}
      text={soundLabel(payload.url)}
      title={`Sonido — volumen ${payload.volume}`}
      onClick={() =>
        snippetEditHandler.current?.({
          kind: "sound",
          nodeKey,
          payload,
          replace: (next) =>
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isSoundNode(node)) node.setPayload(next);
            }),
          remove: () =>
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isSoundNode(node)) node.remove();
            }),
        })
      }
      onDelete={() =>
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isSoundNode(node)) node.remove();
        })
      }
    />
  );
}

export class SoundNode extends DecoratorNode<React.ReactNode> {
  __payload: SoundPayload;

  static getType(): string {
    return "sound-snippet";
  }

  static clone(node: SoundNode): SoundNode {
    return new SoundNode(node.__payload, node.__key);
  }

  constructor(payload: SoundPayload, key?: NodeKey) {
    super(key);
    this.__payload = payload;
  }

  static importJSON(
    serialized: SerializedLexicalNode & Record<string, unknown>,
  ): SoundNode {
    const { url, volume } = serialized as unknown as SerializedSoundNode;
    return $createSoundNode({ url, volume });
  }

  exportJSON(): SerializedSoundNode {
    return { ...this.__payload, type: "sound-snippet", version: 1 };
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "inline";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  setPayload(next: SoundPayload): void {
    this.getWritable().__payload = next;
  }

  getPayload(): SoundPayload {
    return this.__payload;
  }

  getTextContent(): string {
    return soundLabel(this.__payload.url);
  }

  isInline(): true {
    return true;
  }

  decorate(editor: LexicalEditor): React.ReactNode {
    return (
      <SoundChipView editor={editor} nodeKey={this.getKey()} payload={this.__payload} />
    );
  }
}

export function $createSoundNode(payload: SoundPayload): SoundNode {
  return new SoundNode(payload);
}

export function $isSoundNode(
  node: LexicalNode | null | undefined,
): node is SoundNode {
  return node instanceof SoundNode;
}

export function soundRawToPayload(raw: string): SoundPayload | null {
  const inner = raw.startsWith("[[") && raw.endsWith("]]") ? raw.slice(2, -2) : raw;
  const parts = inner.split("|").map((p) => p.trim());
  if (parts[0] !== "sound") return null;
  return {
    url: parts[1] ?? "",
    volume: parseFloat(parts[2] ?? "0.5"),
  };
}

export function soundPayloadToRaw(p: SoundPayload): string {
  return `[[sound|${p.url}|${p.volume}]]`;
}
