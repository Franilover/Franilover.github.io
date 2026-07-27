"use client";
/**
 * UseNode.tsx
 * ───────────
 * Nodo Lexical inline para [[use|word|itemId|sectionOk|sectionFail]].
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
import { MousePointerClick } from "lucide-react";

import {
  snippetEditHandler,
  createMissingSectionHandler,
  isSectionTargetValid,
  useKnownSectionIdsVersion,
} from "./sharedTypes";
import { SnippetBlockChip } from "./SnippetBlockChip";

export interface UsePayload {
  word: string;
  itemId: string;
  sectionOk: string;
  sectionFail?: string;
}

export type SerializedUseNode = Spread<
  { type: "use-snippet"; version: 1 } & UsePayload,
  SerializedLexicalNode
>;

function UseChipView({
  payload,
  nodeKey,
  editor,
}: {
  payload: UsePayload;
  nodeKey: NodeKey;
  editor: LexicalEditor;
}) {
  useKnownSectionIdsVersion();

  const branches = [
    {
      label: "ok",
      target: payload.sectionOk || undefined,
      targetValid: payload.sectionOk ? isSectionTargetValid(payload.sectionOk) : undefined,
    },
    {
      label: "fail",
      target: payload.sectionFail || undefined,
      targetValid: payload.sectionFail ? isSectionTargetValid(payload.sectionFail) : undefined,
    },
  ];

  return (
    <SnippetBlockChip
      icon={<MousePointerClick size={14} />}
      title={`usar objeto — ${payload.word || payload.itemId}`}
      branches={branches}
      onClick={() =>
        snippetEditHandler.current?.({
          kind: "use",
          nodeKey,
          payload,
          replace: (next) =>
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isUseNode(node)) node.setPayload(next);
            }),
          remove: () =>
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isUseNode(node)) node.remove();
            }),
        })
      }
      onDelete={() =>
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isUseNode(node)) node.remove();
        })
      }
      onCreateMissingSection={(b) => {
        if (b.target) createMissingSectionHandler.current?.(b.target);
      }}
    />
  );
}

export class UseNode extends DecoratorNode<React.ReactNode> {
  __payload: UsePayload;

  static getType(): string {
    return "use-snippet";
  }

  static clone(node: UseNode): UseNode {
    return new UseNode(node.__payload, node.__key);
  }

  constructor(payload: UsePayload, key?: NodeKey) {
    super(key);
    this.__payload = payload;
  }

  static importJSON(
    serialized: SerializedLexicalNode & Record<string, unknown>,
  ): UseNode {
    const s = serialized as unknown as SerializedUseNode;
    return $createUseNode({
      word: s.word,
      itemId: s.itemId,
      sectionOk: s.sectionOk,
      sectionFail: s.sectionFail,
    });
  }

  exportJSON(): SerializedUseNode {
    return { ...this.__payload, type: "use-snippet", version: 1 };
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "inline";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  setPayload(next: UsePayload): void {
    this.getWritable().__payload = next;
  }

  getPayload(): UsePayload {
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
      <UseChipView editor={editor} nodeKey={this.getKey()} payload={this.__payload} />
    );
  }
}

export function $createUseNode(payload: UsePayload): UseNode {
  return new UseNode(payload);
}

export function $isUseNode(
  node: LexicalNode | null | undefined,
): node is UseNode {
  return node instanceof UseNode;
}

export function parseUseRawToPayload(raw: string): UsePayload | null {
  const inner = raw.startsWith("[[") && raw.endsWith("]]") ? raw.slice(2, -2) : raw;
  const parts = inner.split("|").map((p) => p.trim());
  if (parts[0] !== "use") return null;
  return {
    word: parts[1] ?? "",
    itemId: parts[2] ?? "",
    sectionOk: parts[3] ?? "",
    sectionFail: parts[4],
  };
}

export function parseUsePayloadToRaw(p: UsePayload): string {
  return `[[use|${p.word}|${p.itemId}|${p.sectionOk}|${p.sectionFail ?? ""}]]`;
}
