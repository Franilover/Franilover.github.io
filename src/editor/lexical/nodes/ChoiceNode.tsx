"use client";
/**
 * ChoiceNode.tsx
 * ──────────────
 * Nodo Lexical inline para [[choice|label|sectionId]].
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
import { GitBranch } from "lucide-react";

import {
  snippetEditHandler,
  createMissingSectionHandler,
  isSectionTargetValid,
  useKnownSectionIdsVersion,
} from "./sharedTypes";
import { SnippetBlockChip } from "./SnippetBlockChip";

export interface ChoicePayload {
  label: string;
  target: string;
}

export type SerializedChoiceNode = Spread<
  { type: "choice-snippet"; version: 1 } & ChoicePayload,
  SerializedLexicalNode
>;

function ChoiceChipView({
  payload,
  nodeKey,
  editor,
}: {
  payload: ChoicePayload;
  nodeKey: NodeKey;
  editor: LexicalEditor;
}) {
  useKnownSectionIdsVersion();
  const targetValid = isSectionTargetValid(payload.target);

  return (
    <SnippetBlockChip
      icon={<GitBranch size={14} />}
      title={payload.label || "decisión"}
      branches={[
        {
          label: payload.label || "(sin texto)",
          target: payload.target || undefined,
          targetValid: payload.target ? targetValid : undefined,
        },
      ]}
      onClick={() =>
        snippetEditHandler.current?.({
          kind: "choice",
          nodeKey,
          payload,
          replace: (next) =>
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isChoiceNode(node)) node.setPayload(next);
            }),
          remove: () =>
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isChoiceNode(node)) node.remove();
            }),
        })
      }
      onDelete={() =>
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isChoiceNode(node)) node.remove();
        })
      }
      onCreateMissingSection={(b) => {
        if (b.target) createMissingSectionHandler.current?.(b.target);
      }}
    />
  );
}

export class ChoiceNode extends DecoratorNode<React.ReactNode> {
  __payload: ChoicePayload;

  static getType(): string {
    return "choice-snippet";
  }

  static clone(node: ChoiceNode): ChoiceNode {
    return new ChoiceNode(node.__payload, node.__key);
  }

  constructor(payload: ChoicePayload, key?: NodeKey) {
    super(key);
    this.__payload = payload;
  }

  static importJSON(
    serialized: SerializedLexicalNode & Record<string, unknown>,
  ): ChoiceNode {
    const s = serialized as unknown as SerializedChoiceNode;
    return $createChoiceNode({ label: s.label, target: s.target });
  }

  exportJSON(): SerializedChoiceNode {
    return { ...this.__payload, type: "choice-snippet", version: 1 };
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "inline";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  setPayload(next: ChoicePayload): void {
    this.getWritable().__payload = next;
  }

  getPayload(): ChoicePayload {
    return this.__payload;
  }

  getTextContent(): string {
    return this.__payload.label;
  }

  isInline(): true {
    return true;
  }

  decorate(editor: LexicalEditor): React.ReactNode {
    return (
      <ChoiceChipView editor={editor} nodeKey={this.getKey()} payload={this.__payload} />
    );
  }
}

export function $createChoiceNode(payload: ChoicePayload): ChoiceNode {
  return new ChoiceNode(payload);
}

export function $isChoiceNode(
  node: LexicalNode | null | undefined,
): node is ChoiceNode {
  return node instanceof ChoiceNode;
}

export function choiceRawToPayload(raw: string): ChoicePayload | null {
  const inner = raw.startsWith("[[") && raw.endsWith("]]") ? raw.slice(2, -2) : raw;
  const parts = inner.split("|").map((p) => p.trim());
  if (parts[0] !== "choice") return null;
  return { label: parts[1] ?? "", target: parts[2] ?? "" };
}

export function choicePayloadToRaw(p: ChoicePayload): string {
  return `[[choice|${p.label}|${p.target}]]`;
}
