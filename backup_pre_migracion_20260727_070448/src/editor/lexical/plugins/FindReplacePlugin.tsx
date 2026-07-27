"use client";
/**
 * FindReplacePlugin.tsx
 * ──────────────────────
 * Buscar y reemplazar para RichEditor. Mismo look que FindReplacePanel de
 * EditorFloatingPanels.tsx (MarkdownEditor), pero opera sobre el árbol
 * Lexical en vez de un textarea:
 *
 *   - Buscar: recorre los TextNode del documento y arma una lista global
 *     de matches (nodeKey + offsets dentro de ese nodo).
 *   - Navegar: selecciona el match actual con $setSelection para que el
 *     usuario vea el highlight nativo de Lexical.
 *   - Reemplazar uno: usa node.spliceText() sobre el TextNode del match.
 *   - Reemplazar todos: recorre matches de atrás hacia adelante (para no
 *     invalidar offsets de matches previos) y hace spliceText en cada uno.
 *
 * Nota: los matches solo se buscan dentro de TextNode — el texto "visible"
 * de un DropNode/ChoiceNode/etc (via getTextContent()) NO se incluye,
 * porque reemplazar dentro de un snippet no tiene un buen UX (habría que
 * editar el payload, no el texto plano). Esto es una limitación aceptada,
 * igual que el MarkdownEditor viejo tampoco distinguía snippets del texto.
 */
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type {
  LexicalEditor,
  TextNode} from "lexical";
import {
  $getRoot,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  KEY_MODIFIER_COMMAND
} from "lexical";
import { ChevronDown, ChevronUp, Replace, X } from "lucide-react";
import React, { useCallback, useEffect, useRef } from "react";

const PRIMARY = "var(--color-primary, #7c6af7)";
const mono = { fontFamily: "var(--font-mono)" } as const;

interface Match {
  nodeKey: string;
  start: number;
  end: number;
}

function findAllMatches(
  editor: LexicalEditor,
  query: string,
  caseSensitive: boolean,
): Match[] {
  if (!query) return [];
  const matches: Match[] = [];
  editor.getEditorState().read(() => {
    const root = $getRoot();
    const q = caseSensitive ? query : query.toLowerCase();

    // Mismo patrón que walkNode() en richTextSerializer.ts: recorrido
    // genérico de nodos Lexical, tipado laxo porque LexicalNode base no
    // expone getChildren() (solo los nodos contenedor lo tienen).
    function walk(node: any) {
      const children = node.getChildren ? node.getChildren() : [];
      for (const child of children) {
        if ($isTextNode(child)) {
          const text = child.getTextContent();
          const haystack = caseSensitive ? text : text.toLowerCase();
          let from = 0;
          let idx: number;
          while ((idx = haystack.indexOf(q, from)) !== -1) {
            matches.push({
              nodeKey: child.getKey(),
              start: idx,
              end: idx + query.length,
            });
            from = idx + query.length;
          }
        } else {
          walk(child);
        }
      }
    }
    walk(root);
  });
  return matches;
}

export interface FindReplaceState {
  open: boolean;
  find: string;
  replace: string;
  caseSensitive: boolean;
  currentMatch: number;
  totalMatches: number;
}

export const initialFindReplaceState: FindReplaceState = {
  open: false,
  find: "",
  replace: "",
  caseSensitive: false,
  currentMatch: 0,
  totalMatches: 0,
};

interface FindReplacePluginProps {
  state: FindReplaceState;
  onStateChange: (updater: (s: FindReplaceState) => FindReplaceState) => void;
}

export function FindReplacePlugin({ state, onStateChange }: FindReplacePluginProps) {
  const [editor] = useLexicalComposerContext();
  const findInputRef = useRef<HTMLInputElement>(null);
  const matchesRef = useRef<Match[]>([]);

  // Recalcula matches cuando cambia la query, case-sensitivity, o el
  // contenido del documento.
  useEffect(() => {
    if (!state.find) {
      matchesRef.current = [];
      onStateChange((s) => ({ ...s, totalMatches: 0, currentMatch: 0 }));
      return;
    }
    const matches = findAllMatches(editor, state.find, state.caseSensitive);
    matchesRef.current = matches;
    onStateChange((s) => ({
      ...s,
      totalMatches: matches.length,
      currentMatch: Math.min(s.currentMatch, Math.max(0, matches.length - 1)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.find, state.caseSensitive, editor]);

  // Ctrl+F abre el panel
  useEffect(() => {
    return editor.registerCommand(
      KEY_MODIFIER_COMMAND,
      (payload: KeyboardEvent) => {
        if ((payload.ctrlKey || payload.metaKey) && payload.key === "f") {
          payload.preventDefault();
          onStateChange((s) => ({ ...s, open: true }));
          setTimeout(() => findInputRef.current?.focus(), 50);
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, onStateChange]);

  const selectMatch = useCallback(
    (match: Match) => {
      editor.update(() => {
        const node = editor.getEditorState()._nodeMap.get(match.nodeKey) as
          | TextNode
          | undefined;
        if (!node || !$isTextNode(node)) return;
        node.select(match.start, match.end);
      });
    },
    [editor],
  );

  const findAndHighlight = useCallback(
    (dir: 1 | -1 = 1) => {
      const matches = matchesRef.current;
      if (!matches.length) return;
      onStateChange((s) => {
        const next = (s.currentMatch + dir + matches.length) % matches.length;
        selectMatch(matches[next]);
        return { ...s, currentMatch: next };
      });
    },
    [onStateChange, selectMatch],
  );

  const replaceOne = useCallback(() => {
    const matches = matchesRef.current;
    const match = matches[state.currentMatch];
    if (!match) return;
    editor.update(() => {
      const node = editor.getEditorState()._nodeMap.get(match.nodeKey) as
        | TextNode
        | undefined;
      if (!node || !$isTextNode(node)) return;
      node.spliceText(match.start, match.end - match.start, state.replace, true);
    });
    // El próximo tick, los matches se recalculan por el useEffect (el
    // contenido cambió), así que no avanzamos manualmente el índice.
  }, [editor, state.currentMatch, state.replace]);

  const replaceAll = useCallback(() => {
    const matches = [...matchesRef.current].sort((a, b) => {
      if (a.nodeKey !== b.nodeKey) return 0;
      return b.start - a.start; // de atrás hacia adelante dentro del mismo nodo
    });
    editor.update(() => {
      for (const match of matches) {
        const node = editor.getEditorState()._nodeMap.get(match.nodeKey) as
          | TextNode
          | undefined;
        if (!node || !$isTextNode(node)) continue;
        node.spliceText(match.start, match.end - match.start, state.replace, true);
      }
    });
    onStateChange((s) => ({ ...s, currentMatch: 0, totalMatches: 0 }));
  }, [editor, state.replace, onStateChange]);

  if (!state.open) return null;

  const actionBtn = (enabled: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    background: "transparent",
    border: `1px solid color-mix(in srgb, var(--foreground) 12%, transparent)`,
    borderRadius: 5,
    color: enabled
      ? "color-mix(in srgb, var(--foreground) 55%, transparent)"
      : "color-mix(in srgb, var(--foreground) 20%, transparent)",
    cursor: enabled ? "pointer" : "default",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "8px 10px",
        borderBottom: `1px solid color-mix(in srgb, var(--foreground) 8%, transparent)`,
        background: "color-mix(in srgb, var(--foreground) 2%, transparent)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          ref={findInputRef}
          placeholder="Buscar…"
          style={{
            flex: 1,
            background: "transparent",
            border: `1px solid color-mix(in srgb, var(--foreground) 12%, transparent)`,
            borderRadius: 5,
            padding: "3px 8px",
            fontSize: 12,
            outline: "none",
            color: "color-mix(in srgb, var(--foreground) 85%, transparent)",
          }}
          type="text"
          value={state.find}
          onChange={(e) =>
            onStateChange((s) => ({ ...s, find: e.target.value, currentMatch: 0 }))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (e.shiftKey) {
                findAndHighlight(-1);
              } else {
                findAndHighlight(1);
              }
            }
            if (e.key === "Escape") onStateChange((s) => ({ ...s, open: false }));
          }}
        />
        <span style={{ fontSize: 10, ...mono, color: "color-mix(in srgb, var(--foreground) 30%, transparent)", whiteSpace: "nowrap" }}>
          {state.totalMatches > 0 ? `${state.currentMatch + 1}/${state.totalMatches}` : "0/0"}
        </span>
        <button style={actionBtn(state.totalMatches > 0)} title="Anterior" type="button" onClick={() => findAndHighlight(-1)}>
          <ChevronUp size={12} />
        </button>
        <button style={actionBtn(state.totalMatches > 0)} title="Siguiente" type="button" onClick={() => findAndHighlight(1)}>
          <ChevronDown size={12} />
        </button>
        <button style={actionBtn(true)} title="Cerrar" type="button" onClick={() => onStateChange((s) => ({ ...s, open: false }))}>
          <X size={12} />
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          placeholder="Reemplazar…"
          style={{
            flex: 1,
            background: "transparent",
            border: `1px solid color-mix(in srgb, var(--foreground) 12%, transparent)`,
            borderRadius: 5,
            padding: "3px 8px",
            fontSize: 12,
            outline: "none",
            color: "color-mix(in srgb, var(--foreground) 85%, transparent)",
          }}
          type="text"
          value={state.replace}
          onChange={(e) => onStateChange((s) => ({ ...s, replace: e.target.value }))}
        />
        <button style={actionBtn(state.totalMatches > 0)} title="Reemplazar este" type="button" onClick={replaceOne}>
          <Replace size={12} />
        </button>
        <button
          style={{ ...actionBtn(state.totalMatches > 0), width: "auto", padding: "0 8px", fontSize: 10, ...mono }}
          title="Reemplazar todos"
          type="button"
          onClick={replaceAll}
        >
          All
        </button>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
            fontSize: 10,
            color: "color-mix(in srgb, var(--foreground) 45%, transparent)",
            ...mono,
          }}
        >
          <input
            checked={state.caseSensitive}
            style={{ accentColor: PRIMARY, width: 11, height: 11 }}
            type="checkbox"
            onChange={(e) =>
              onStateChange((s) => ({ ...s, caseSensitive: e.target.checked, currentMatch: 0 }))
            }
          />
          Aa
        </label>
      </div>
    </div>
  );
}
