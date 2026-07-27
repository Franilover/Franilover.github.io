"use client";
/**
 * TocPlugin.tsx
 * ──────────────
 * Índice (Tabla de Contenidos) para RichEditor, equivalente al TOC del
 * MarkdownEditor viejo pero construido sobre el árbol Lexical en vez de
 * parsear el textarea con regex.
 *
 * Cómo funciona:
 *   - Un hook (useTocItems) recorre el root en cada cambio y junta todos
 *     los HeadingNode (h1..h6) con su nivel, texto plano, y nodeKey.
 *   - El panel flotante (mismo look que WikilinkMenuPanel/FindReplacePlugin)
 *     lista esos headings con indentación según nivel.
 *   - Click en un item: usa el nodeKey para ubicar el DOM element real
 *     vía editor.getElementByKey() y hace scrollIntoView + selecciona el
 *     inicio del heading (mismo patrón de "ir a" que un TOC de Notion).
 *
 * No dependemos de parsear el raw string con regex "^#+ " porque los
 * headings ya son nodos reales (HeadingNode) gracias a MarkdownShortcutPlugin
 * — leer el árbol es más confiable que re-parsear el texto (evita falsos
 * positivos de "#" dentro de un bloque de código, por ejemplo).
 */
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $isHeadingNode } from "@lexical/rich-text";
import { $getNodeByKey, $getRoot } from "lexical";
import { List, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

const PRIMARY = "var(--color-primary, #7c6af7)";
const mono = { fontFamily: "var(--font-mono)" } as const;

export interface TocItem {
  key: string;
  level: number; // 1..6
  text: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: mantiene la lista de headings sincronizada con el documento
// ─────────────────────────────────────────────────────────────────────────────

export function useTocItems(): TocItem[] {
  const [editor] = useLexicalComposerContext();
  const [items, setItems] = useState<TocItem[]>([]);

  useEffect(() => {
    const collect = () => {
      const next: TocItem[] = [];
      editor.getEditorState().read(() => {
        const children = $getRoot().getChildren();
        for (const child of children) {
          if ($isHeadingNode(child)) {
            const tag = (child as any).getTag?.() as string; // "h1".."h6"
            const level = Math.max(1, Math.min(6, parseInt(tag?.[1] ?? "1", 10) || 1));
            const text = child.getTextContent();
            next.push({ key: child.getKey(), level, text: text.trim() || "(sin título)" });
          }
        }
      });
      setItems(next);
    };

    collect(); // estado inicial
    return editor.registerUpdateListener(() => collect());
  }, [editor]);

  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Botón + panel flotante del índice
// ─────────────────────────────────────────────────────────────────────────────

interface TocPanelProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export function TocPanel({ open, onToggle, onClose }: TocPanelProps) {
  const [editor] = useLexicalComposerContext();
  const items = useTocItems();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, onClose]);

  const minLevel = useMemo(
    () => (items.length ? Math.min(...items.map((i) => i.level)) : 1),
    [items],
  );

  const goToHeading = (key: string) => {
    editor.update(() => {
      const node = $getNodeByKey(key);
      if (!node) return;
      (node as any).selectStart?.();
    });
    // El scroll lo hacemos fuera de editor.update() porque necesitamos el
    // DOM element ya montado — getElementByKey funciona con el estado
    // actual, no hace falta estar dentro de un read/update.
    const el = editor.getElementByKey(key);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    onClose();
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 20,
          background: "transparent",
          color: open
            ? "color-mix(in srgb, var(--foreground) 60%, transparent)"
            : "color-mix(in srgb, var(--foreground) 18%, transparent)",
          border: "none",
          cursor: "pointer",
          transition: "color 0.1s",
        }}
        title="Índice"
        type="button"
        onClick={onToggle}
      >
        <List size={9} />
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: "absolute",
            top: 24,
            right: 0,
            zIndex: 9999,
            width: 240,
            maxHeight: 320,
            overflowY: "auto",
            background: "var(--bg-menu, #1a1730)",
            border: `1px solid color-mix(in srgb, ${PRIMARY} 22%, transparent)`,
            borderRadius: 10,
            boxShadow: `0 12px 40px color-mix(in srgb, ${PRIMARY} 18%, black)`,
            backdropFilter: "blur(12px)",
            padding: 6,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "2px 6px 6px",
              borderBottom: `1px solid color-mix(in srgb, var(--foreground) 8%, transparent)`,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 10,
                ...mono,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: "color-mix(in srgb, var(--foreground) 40%, transparent)",
              }}
            >
              Índice
            </span>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 16,
                height: 16,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "color-mix(in srgb, var(--foreground) 40%, transparent)",
              }}
              title="Cerrar"
              type="button"
              onClick={onClose}
            >
              <X size={11} />
            </button>
          </div>

          {items.length === 0 ? (
            <div
              style={{
                padding: "10px 6px",
                fontSize: 11,
                ...mono,
                color: "color-mix(in srgb, var(--foreground) 30%, transparent)",
              }}
            >
              Sin encabezados todavía. Escribí &quot;# &quot; para crear uno.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 8px",
                  paddingLeft: 8 + (item.level - minLevel) * 12,
                  borderRadius: 6,
                  cursor: "pointer",
                }}
                onClick={() => goToHeading(item.key)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `color-mix(in srgb, ${PRIMARY} 14%, transparent)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    ...mono,
                    color: `color-mix(in srgb, ${PRIMARY} 55%, transparent)`,
                    flexShrink: 0,
                  }}
                >
                  H{item.level}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "color-mix(in srgb, var(--foreground) 82%, transparent)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.text}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
