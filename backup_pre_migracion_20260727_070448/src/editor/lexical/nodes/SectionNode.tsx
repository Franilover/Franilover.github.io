"use client";
/**
 * SectionNode.tsx
 * ───────────────
 * Nodo Lexical inline para [[section|id|label]].
 * Ancla/destino al que apuntan los ChoiceNode.
 */
import type {
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { $getNodeByKey, $getRoot, DecoratorNode } from "lexical";
import React from "react";
import { Bookmark } from "lucide-react";

import { snippetEditHandler, useKnownSectionIdsVersion } from "./sharedTypes";

export interface SectionPayload {
  id: string;
  label?: string;
}

export type SerializedSectionNode = Spread<
  { type: "section-snippet"; version: 1 } & SectionPayload,
  SerializedLexicalNode
>;

function SectionChipView({
  payload,
  nodeKey,
  editor,
}: {
  payload: SectionPayload;
  nodeKey: NodeKey;
  editor: LexicalEditor;
}) {
  useKnownSectionIdsVersion();
  const [refCount, setRefCount] = React.useState<number | null>(null);
  const [isFirstSection, setIsFirstSection] = React.useState(true);

  React.useEffect(() => {
    editor.getEditorState().read(() => {
      let count = 0;
      let firstSectionKey: string | null = null;
      const rootNode = $getRoot();
      const visit = (node: any) => {
        const type = node.getType?.();
        if (type === "choice-snippet") {
          const p = node.getPayload?.();
          if (p?.target === payload.id) count++;
        } else if (type === "use-snippet") {
          const p = node.getPayload?.();
          if (p?.sectionOk === payload.id || p?.sectionFail === payload.id) count++;
        } else if (type === "condicion-snippet") {
          const p = node.getPayload?.();
          if (p?.siTarget === payload.id || p?.noTarget === payload.id) count++;
        } else if (type === "section-snippet") {
          if (firstSectionKey === null) firstSectionKey = node.getKey();
        }
        const children = node.getChildren?.();
        if (children) children.forEach(visit);
      };
      visit(rootNode);
      setRefCount(count);
      setIsFirstSection(firstSectionKey === nodeKey);
    });
  });

  const label = payload.label ?? payload.id;
  const refsSuffix = refCount !== null ? ` · ${refCount} ref${refCount === 1 ? "" : "s"}` : "";

  return (
    <span contentEditable={false} style={{ display: "block", userSelect: "none" }}>
      {!isFirstSection && <SectionCloserView />}
      <span
        onClick={() =>
          snippetEditHandler.current?.({
            kind: "section",
            nodeKey,
            payload,
            replace: (next) =>
              editor.update(() => {
                const node = $getNodeByKey(nodeKey);
                if ($isSectionNode(node)) node.setPayload(next);
              }),
            remove: () =>
              editor.update(() => {
                const node = $getNodeByKey(nodeKey);
                if ($isSectionNode(node)) node.remove();
              }),
          })
        }
        title={`Sección — id: ${payload.id}`}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "18px 0 8px",
          cursor: "pointer",
          fontFamily: "var(--font-sans, system-ui)",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "50%",
            height: 1,
            background: "var(--border-strong, #B4B2A9)",
          }}
        />
        <span
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "0 10px",
            background: "var(--surface-1, var(--background, #fff))",
            fontSize: 12,
            fontWeight: 500,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
          }}
        >
          <Bookmark size={12} />
          {label}
          {refsSuffix && <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>{refsSuffix}</span>}
        </span>
      </span>
    </span>
  );
}

/**
 * Separador "fin de sección" — puramente visual, se calcula en cada render
 * a partir de la posición del SectionNode en el árbol (no es texto real
 * guardado, así que nunca se desincroniza con ediciones del contenido).
 * Se dibuja ANTES de cada SectionNode que no sea la primera, y — vía
 * EndOfDocumentSectionCloser más abajo — al final del documento si la
 * última sección quedó abierta.
 */
export function SectionCloserView() {
  return (
    <span
      contentEditable={false}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "18px 0 4px",
        userSelect: "none",
        fontFamily: "var(--font-sans, system-ui)",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          height: 1,
          background: "var(--border, #D3D1C7)",
        }}
      />
      <span
        style={{
          position: "relative",
          padding: "0 10px",
          background: "var(--surface-1, var(--background, #fff))",
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        fin de sección
      </span>
    </span>
  );
}

export class SectionNode extends DecoratorNode<React.ReactNode> {
  __payload: SectionPayload;

  static getType(): string {
    return "section-snippet";
  }

  static clone(node: SectionNode): SectionNode {
    return new SectionNode(node.__payload, node.__key);
  }

  constructor(payload: SectionPayload, key?: NodeKey) {
    super(key);
    this.__payload = payload;
  }

  static importJSON(
    serialized: SerializedLexicalNode & Record<string, unknown>,
  ): SectionNode {
    const s = serialized as unknown as SerializedSectionNode;
    return $createSectionNode({ id: s.id, label: s.label });
  }

  exportJSON(): SerializedSectionNode {
    return { ...this.__payload, type: "section-snippet", version: 1 };
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "inline";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  setPayload(next: SectionPayload): void {
    this.getWritable().__payload = next;
  }

  getPayload(): SectionPayload {
    return this.__payload;
  }

  getTextContent(): string {
    return `[§${this.__payload.id}]`;
  }

  isInline(): true {
    return true;
  }

  decorate(editor: LexicalEditor): React.ReactNode {
    return (
      <SectionChipView editor={editor} nodeKey={this.getKey()} payload={this.__payload} />
    );
  }
}

export function $createSectionNode(payload: SectionPayload): SectionNode {
  return new SectionNode(payload);
}

export function $isSectionNode(
  node: LexicalNode | null | undefined,
): node is SectionNode {
  return node instanceof SectionNode;
}

export function sectionRawToPayload(raw: string): SectionPayload | null {
  const inner = raw.startsWith("[[") && raw.endsWith("]]") ? raw.slice(2, -2) : raw;
  const parts = inner.split("|").map((p) => p.trim());
  if (parts[0] !== "section") return null;
  return { id: parts[1] ?? "", label: parts[2] };
}

export function sectionPayloadToRaw(p: SectionPayload): string {
  return `[[section|${p.id}|${p.label ?? ""}]]`;
}
