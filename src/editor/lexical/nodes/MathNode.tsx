"use client";
/**
 * MathNode.tsx
 * ────────────
 * Nodo Lexical para fórmulas matemáticas escritas en LaTeX, renderizadas
 * con KaTeX. Soporta dos variantes controladas por el flag `inline`:
 *
 *   - INLINE  ($...$)   → nodo inline, fluye dentro del texto de un párrafo.
 *   - BLOQUE  ($$...$$) → nodo de bloque, ocupa su propia línea centrada
 *                          (igual tratamiento visual que un heading o cita).
 *
 * A diferencia de los SnippetNode (drop, sound, etc. — ver sharedTypes.ts),
 * este nodo NO pasa por SnippetCommandPalette: se edita con un click que
 * abre un input inline sobre el propio nodo (mismo patrón interactivo que
 * cualquier editor de markdown con soporte KaTeX — click en la fórmula
 * renderizada → aparece el código fuente editable, click afuera → vuelve
 * a renderizar).
 *
 * Serialización: igual que headings (ver VariantHeadingNode.tsx) — el
 * texto plano de ida y vuelta usa la sintaxis estándar "$...$"/"$$...$$",
 * así el contenido sigue siendo markdown legible fuera del editor y
 * compatible con cualquier otro renderer que soporte KaTeX/MathJax.
 */
import type {
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { $getNodeByKey, DecoratorNode } from "lexical";
import React, { useEffect, useRef, useState } from "react";

export interface MathPayload {
  formula: string;
  inline: boolean;
}

export type SerializedMathNode = Spread<
  { type: "math"; version: 1 } & MathPayload,
  SerializedLexicalNode
>;

// KaTeX se carga de forma diferida (dynamic import) — evita inflar el
// bundle inicial del editor para usuarios que nunca escriben fórmulas, y
// evita problemas de SSR (KaTeX toca `document` al renderizar a HTML).
let katexModulePromise: Promise<typeof import("katex")> | null = null;
function loadKatex() {
  if (!katexModulePromise) katexModulePromise = import("katex");
  return katexModulePromise;
}

function MathView({
  payload,
  nodeKey,
  editor,
}: {
  payload: MathPayload;
  nodeKey: NodeKey;
  editor: LexicalEditor;
}) {
  // Si la fórmula llega vacía (nodo recién insertado desde "/fórmula"),
  // arrancamos directo en modo edición — no tiene sentido mostrar un
  // renderizado vacío que obligue a un click extra para empezar a
  // escribir.
  const [editing, setEditing] = useState(!payload.formula.trim());
  const [draft, setDraft] = useState(payload.formula);
  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  // Renderiza con KaTeX cada vez que cambia la fórmula persistida (no el
  // draft en edición — el preview en vivo se resuelve aparte más abajo).
  useEffect(() => {
    let cancelled = false;
    loadKatex()
      .then((katex) => {
        if (cancelled) return;
        try {
          const rendered = katex.default.renderToString(payload.formula || " ", {
            throwOnError: true,
            displayMode: !payload.inline,
          });
          setHtml(rendered);
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Fórmula inválida");
          setHtml("");
        }
      })
      .catch(() => setError("No se pudo cargar KaTeX"));
    return () => {
      cancelled = true;
    };
  }, [payload.formula, payload.inline]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isMathNode(node)) {
        if (next) {
          node.setPayload({ ...payload, formula: next });
        } else {
          // Fórmula vacía al confirmar: no dejamos un nodo huérfano.
          node.remove();
        }
      }
    });
    setEditing(false);
  };

  const cancel = () => {
    setDraft(payload.formula);
    setEditing(false);
  };

  if (editing) {
    const commonProps = {
      ref: inputRef as any,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
        setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        } else if (e.key === "Enter" && (payload.inline || e.metaKey || e.ctrlKey)) {
          // Inline: Enter confirma directo (una fórmula corta no necesita
          // salto de línea). Bloque: Enter agrega salto de línea normal
          // en el LaTeX (útil para \begin{aligned}...), y Cmd/Ctrl+Enter
          // confirma.
          e.preventDefault();
          commit();
        }
      },
      style: {
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--foreground)",
        background: "color-mix(in srgb, var(--foreground) 6%, transparent)",
        border: "1px solid color-mix(in srgb, var(--foreground) 25%, transparent)",
        borderRadius: 4,
        padding: "3px 6px",
        outline: "none",
        minWidth: payload.inline ? 80 : 260,
      },
    };
    return payload.inline ? (
      <input type="text" {...commonProps} />
    ) : (
      <div contentEditable={false} style={{ display: "block", margin: "6px 0" }}>
        <textarea rows={2} {...commonProps} style={{ ...commonProps.style, width: "100%", resize: "vertical" }} />
        <div style={{ fontSize: 9, opacity: 0.5, marginTop: 2, fontFamily: "var(--font-mono)" }}>
          Cmd/Ctrl+Enter para confirmar · Esc para cancelar
        </div>
      </div>
    );
  }

  const wrapperStyle: React.CSSProperties = payload.inline
    ? {
        display: "inline-block",
        cursor: "text",
        padding: "0 2px",
        borderRadius: 3,
      }
    : {
        display: "block",
        cursor: "text",
        textAlign: "center",
        padding: "8px 4px",
        margin: "6px 0",
        borderRadius: 4,
      };

  if (error) {
    return (
      <span
        onClick={() => setEditing(true)}
        title={error}
        style={{
          ...wrapperStyle,
          color: "#dc2626",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          background: "color-mix(in srgb, #dc2626 8%, transparent)",
          border: "1px dashed color-mix(in srgb, #dc2626 40%, transparent)",
        }}
      >
        {payload.inline ? "$" : "$$"}
        {payload.formula || "…"}
        {payload.inline ? "$" : "$$"}
      </span>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title="Click para editar la fórmula"
      // eslint-disable-next-line react/no-danger -- salida de KaTeX, no de usuario libre sin sanitizar por fuera de LaTeX
      dangerouslySetInnerHTML={{ __html: html }}
      style={wrapperStyle}
    />
  );
}

export class MathNode extends DecoratorNode<React.ReactNode> {
  __payload: MathPayload;

  static getType(): string {
    return "math";
  }

  static clone(node: MathNode): MathNode {
    return new MathNode(node.__payload, node.__key);
  }

  constructor(payload: MathPayload, key?: NodeKey) {
    super(key);
    this.__payload = payload;
  }

  static importJSON(
    serialized: SerializedLexicalNode & Record<string, unknown>,
  ): MathNode {
    const { formula, inline } = serialized as unknown as SerializedMathNode;
    return $createMathNode({ formula, inline });
  }

  exportJSON(): SerializedMathNode {
    return { ...this.__payload, type: "math", version: 1 };
  }

  createDOM(): HTMLElement {
    const el = document.createElement(this.__payload.inline ? "span" : "div");
    el.style.display = this.__payload.inline ? "inline" : "block";
    return el;
  }

  updateDOM(): false {
    return false;
  }

  setPayload(next: MathPayload): void {
    this.getWritable().__payload = next;
  }

  getPayload(): MathPayload {
    return this.__payload;
  }

  getTextContent(): string {
    return mathPayloadToRaw(this.__payload);
  }

  isInline(): boolean {
    return this.__payload.inline;
  }

  decorate(editor: LexicalEditor): React.ReactNode {
    return <MathView editor={editor} nodeKey={this.getKey()} payload={this.__payload} />;
  }
}

export function $createMathNode(payload: MathPayload): MathNode {
  return new MathNode(payload);
}

export function $isMathNode(
  node: LexicalNode | null | undefined,
): node is MathNode {
  return node instanceof MathNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// raw ↔ payload — usado por richTextSerializer.ts y el transformer de
// MarkdownShortcutPlugin. "$$...$$" (bloque, puede ser multilinea) y
// "$...$" (inline, una sola línea, sin "$" vacío ni espacio pegado al
// delimitador — misma regla que la mayoría de renderers markdown+KaTeX,
// para no confundir un "$5 $10" de precios con una fórmula).
// ─────────────────────────────────────────────────────────────────────────────

export const MATH_BLOCK_RE = /\$\$([\s\S]+?)\$\$/g;
export const MATH_INLINE_RE = /(?<!\$)\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\$)/g;

export function mathPayloadToRaw(p: MathPayload): string {
  return p.inline ? `$${p.formula}$` : `$$${p.formula}$$`;
}
