"use client";
/**
 * FlagNode.tsx
 * ────────────
 * Nodo Lexical inline para el sistema de flags narrativos — ahora solo
 * cubre la variante "Acción" (antes "set"):
 *
 *   [[flag|set|flagId|valor]] — escribe flagId=valor cuando el lector pasa
 *   por ahí. Single-line, no navega, no ramifica (no es una decisión, es
 *   una asignación).
 *
 * La variante "if" (condición automática que ramifica) se fusionó con
 * gate en CondicionNode.tsx — ver ese archivo.
 *
 * `valor` es texto libre — "true"/"false" para el caso booleano, o
 * cualquier string (ej. "hostil") para el caso de texto libre.
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
import { Flag } from "lucide-react";

import { snippetEditHandler } from "./sharedTypes";
import { SnippetChip } from "./SnippetChip";

export interface FlagPayload {
  op: "set";
  flagId: string;
  /** El valor a guardar. */
  valor?: string;
}

export type SerializedFlagNode = Spread<
  { type: "flag-snippet"; version: 1 } & FlagPayload,
  SerializedLexicalNode
>;

function FlagChipView({
  payload,
  nodeKey,
  editor,
}: {
  payload: FlagPayload;
  nodeKey: NodeKey;
  editor: LexicalEditor;
}) {
  const flagChipText = `Flag: ${payload.flagId} = ${payload.valor || "(vacío)"}`;
  const title = `Setea flag "${payload.flagId}" = "${payload.valor || ""}" al pasar por acá`;

  return (
    <SnippetChip
      icon={<Flag size={10} />}
      maxTextWidth={220}
      text={flagChipText}
      title={title}
      onClick={() =>
        snippetEditHandler.current?.({
          kind: "flag",
          nodeKey,
          payload,
          replace: (next) =>
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isFlagNode(node)) node.setPayload(next);
            }),
          remove: () =>
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isFlagNode(node)) node.remove();
            }),
        })
      }
      onDelete={() =>
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isFlagNode(node)) node.remove();
        })
      }
    />
  );
}

export class FlagNode extends DecoratorNode<React.ReactNode> {
  __payload: FlagPayload;

  static getType(): string {
    return "flag-snippet";
  }

  static clone(node: FlagNode): FlagNode {
    return new FlagNode(node.__payload, node.__key);
  }

  constructor(payload: FlagPayload, key?: NodeKey) {
    super(key);
    this.__payload = payload;
  }

  static importJSON(
    serialized: SerializedLexicalNode & Record<string, unknown>,
  ): FlagNode {
    const s = serialized as unknown as SerializedFlagNode;
    return $createFlagNode({
      op: "set",
      flagId: s.flagId,
      valor: s.valor,
    });
  }

  exportJSON(): SerializedFlagNode {
    return { ...this.__payload, type: "flag-snippet", version: 1 };
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "inline";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  setPayload(next: FlagPayload): void {
    this.getWritable().__payload = next;
  }

  getPayload(): FlagPayload {
    return this.__payload;
  }

  getTextContent(): string {
    return `[flag: ${this.__payload.flagId}]`;
  }

  isInline(): true {
    return true;
  }

  decorate(editor: LexicalEditor): React.ReactNode {
    return (
      <FlagChipView editor={editor} nodeKey={this.getKey()} payload={this.__payload} />
    );
  }
}

export function $createFlagNode(payload: FlagPayload): FlagNode {
  return new FlagNode(payload);
}

export function $isFlagNode(
  node: LexicalNode | null | undefined,
): node is FlagNode {
  return node instanceof FlagNode;
}

export function flagRawToPayload(raw: string): FlagPayload | null {
  // [[flag|set|flagId|valor]] — single-line. (El caso "if" ahora se
  // reconoce en CondicionNode.tsx / condicionRawToPayload.)
  const setMatch = /^\[\[flag\|set\|([^\|]*)\|([^\]]*)\]\]$/.exec(raw);
  if (!setMatch) return null;
  return { op: "set", flagId: setMatch[1].trim(), valor: setMatch[2].trim() };
}

export function flagPayloadToRaw(p: FlagPayload): string {
  return `[[flag|set|${p.flagId}|${p.valor ?? ""}]]`;
}
