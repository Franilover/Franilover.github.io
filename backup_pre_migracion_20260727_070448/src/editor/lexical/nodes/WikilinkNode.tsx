"use client";
/**
 * WikilinkNode.tsx
 * ────────────────
 * Nodo Lexical inline para [[Nombre de Nota]] — enlaces entre notas/ensayos,
 * estilo Obsidian. Mismo patrón que DropNode: DecoratorNode + payload +
 * raw↔payload converters, pero SIN modal de edición (no hay snippetEditHandler
 * acá — un click navega directo, no abre palette).
 *
 * Formato raw: [[Nombre de Nota]]  (sin "kind|" — es el único snippet que no
 * sigue el patrón [[kind|...]], porque así se guarda hoy en MarkdownEditor
 * y no queremos romper el contenido existente en Supabase).
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
import { Link } from "lucide-react";

import { SnippetChip } from "./SnippetChip";

export interface WikilinkPayload {
  target: string;
  /** Alias opcional a mostrar en vez de `target` — [[target|alias]] */
  alias?: string;
}

export type SerializedWikilinkNode = Spread<
  { type: "wikilink-snippet"; version: 1 } & WikilinkPayload,
  SerializedLexicalNode
>;

function WikilinkChipView({
  payload,
  nodeKey,
  editor,
  onNavigate,
}: {
  payload: WikilinkPayload;
  nodeKey: NodeKey;
  editor: LexicalEditor;
  onNavigate?: (target: string) => void;
}) {
  return (
    <SnippetChip
      icon={<Link size={10} />}
      text={payload.alias?.trim() || payload.target}
      title={`Ir a: ${payload.target}`}
      onClick={() => onNavigate?.(payload.target)}
      onDelete={() =>
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isWikilinkNode(node)) node.remove();
        })
      }
    />
  );
}

// Registro global simple para el callback de navegación — igual patrón que
// snippetEditHandler en sharedTypes.ts. Se setea una vez desde RichEditor.tsx
// vía la prop onWikilinkNavigate, porque DecoratorNode no puede recibir
// props del árbol directamente.
export const wikilinkNavigateHandler: {
  current: ((target: string) => void) | null;
} = { current: null };

export class WikilinkNode extends DecoratorNode<React.ReactNode> {
  __payload: WikilinkPayload;

  static getType(): string {
    return "wikilink-snippet";
  }

  static clone(node: WikilinkNode): WikilinkNode {
    return new WikilinkNode(node.__payload, node.__key);
  }

  constructor(payload: WikilinkPayload, key?: NodeKey) {
    super(key);
    this.__payload = payload;
  }

  static importJSON(
    serialized: SerializedLexicalNode & Record<string, unknown>,
  ): WikilinkNode {
    const { target, alias } = serialized as unknown as SerializedWikilinkNode;
    return $createWikilinkNode({ target, alias });
  }

  exportJSON(): SerializedWikilinkNode {
    return { ...this.__payload, type: "wikilink-snippet", version: 1 };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "inline";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  setPayload(next: WikilinkPayload): void {
    this.getWritable().__payload = next;
  }

  getPayload(): WikilinkPayload {
    return this.__payload;
  }

  getTextContent(): string {
    return wikilinkPayloadToRaw(this.__payload);
  }

  isInline(): true {
    return true;
  }

  decorate(editor: LexicalEditor): React.ReactNode {
    return (
      <WikilinkChipView
        editor={editor}
        nodeKey={this.getKey()}
        payload={this.__payload}
        onNavigate={wikilinkNavigateHandler.current ?? undefined}
      />
    );
  }
}

export function $createWikilinkNode(payload: WikilinkPayload): WikilinkNode {
  return new WikilinkNode(payload);
}

export function $isWikilinkNode(
  node: LexicalNode | null | undefined,
): node is WikilinkNode {
  return node instanceof WikilinkNode;
}

// raw = "[[Nombre de Nota]]" o "[[Nombre de Nota|Alias]]" (SIN kind| —
// distinto del resto de snippets). El alias es opcional; cuando está
// presente se muestra en vez del target, igual que en Obsidian.
export function wikilinkRawToPayload(raw: string): WikilinkPayload | null {
  const m = /^\[\[([^\[\]|]+)(?:\|([^\[\]|]*))?\]\]$/.exec(raw.trim());
  if (!m) return null;
  const target = m[1].trim();
  if (!target) return null;
  const alias = m[2]?.trim();
  return alias ? { target, alias } : { target };
}

export function wikilinkPayloadToRaw(p: WikilinkPayload): string {
  return p.alias?.trim() ? `[[${p.target}|${p.alias}]]` : `[[${p.target}]]`;
}
