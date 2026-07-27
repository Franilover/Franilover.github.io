"use client";

import { FileText, Plus } from "lucide-react";
import React from "react";

import { MotionDiv } from "@/components/ui/Motion";

interface WikilinkPopupProps {
  ensayos: any[];
  query: string;
  activeIndex: number;
  onSelect: (name: string) => void;
  onClose: () => void;
}

export function WikilinkPopup({
  ensayos,
  query,
  activeIndex,
  onSelect,
  onClose: _onClose,
}: WikilinkPopupProps) {
  const q = query.toLowerCase();

  // Filter existing notes matching the query
  const filtered = ensayos
    .filter((e) => !q || e.titulo?.toLowerCase().includes(q))
    .slice(0, 7);

  // Check if there's an exact match already
  const hasExact = ensayos.some((e) => e.titulo?.toLowerCase() === q);

  // If query typed and no exact match, show "create" option
  const showCreate = query.trim().length > 0 && !hasExact;

  const totalItems = filtered.length + (showCreate ? 1 : 0);
  if (totalItems === 0) return null;

  const monoStyle: React.CSSProperties = { fontFamily: "var(--font-mono)" };
  const serifStyle: React.CSSProperties = {
    fontFamily: "var(--font-serif)",
    fontStyle: "italic",
  };

  return (
    <MotionDiv
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      style={{
        minWidth: 300,
        maxWidth: 420,
        background: "var(--bg-menu)",
        border:
          "1px solid color-mix(in srgb, var(--foreground) 12%, transparent)",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow:
          "0 16px 48px color-mix(in srgb, var(--bg-main) 0%, transparent)",
      }}
      transition={{ duration: 0.1 }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          borderBottom:
            "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
        }}
      >
        <span
          style={{
            fontSize: 9,
            color: "color-mix(in srgb, var(--foreground) 20%, transparent)",
            ...monoStyle,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
          }}
        >
          [[ enlazar nota{filtered.length > 0 ? ` · ${filtered.length}` : ""}
          {showCreate ? " + nueva" : ""}]
        </span>
      </div>

      {/* Results */}
      <div style={{ maxHeight: 280, overflowY: "auto" }}>
        {/* Existing notes */}
        {filtered.map((note, i) => {
          const isActive = i === activeIndex;
          const noteTags: string[] = note.tags || [];
          return (
            <button
              key={note.id}
              className="w-full text-left"
              style={{
                display: "block",
                padding: "8px 12px",
                background: isActive
                  ? "color-mix(in srgb, var(--foreground) 6%, transparent)"
                  : "transparent",
                borderLeft: `2px solid ${isActive ? "color-mix(in srgb, var(--foreground) 30%, transparent)" : "transparent"}`,
                border: "none",
                borderLeftWidth: 2,
                borderLeftStyle: "solid",
                borderLeftColor: isActive
                  ? "color-mix(in srgb, var(--foreground) 30%, transparent)"
                  : "transparent",
                cursor: "pointer",
                transition: "background 0.08s",
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(note.titulo);
              }}
            >
              <div className="flex items-center gap-2">
                <FileText
                  size={10}
                  style={{
                    color:
                      "color-mix(in srgb, var(--foreground) 25%, transparent)",
                    flexShrink: 0,
                  }}
                />
                <p
                  style={{
                    fontSize: 12,
                    color:
                      "color-mix(in srgb, var(--foreground) 75%, transparent)",
                    ...serifStyle,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {note.titulo || "Sin título"}
                </p>
              </div>
              {noteTags.length > 0 && (
                <div className="flex items-center gap-1 mt-1 ml-5">
                  {noteTags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 8,
                        padding: "1px 5px",
                        borderRadius: 3,
                        background:
                          "color-mix(in srgb, var(--foreground) 5%, transparent)",
                        border:
                          "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)",
                        color:
                          "color-mix(in srgb, var(--foreground) 25%, transparent)",
                        ...monoStyle,
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}

        {/* Create new page option */}
        {showCreate && (
          <button
            className="w-full text-left"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background:
                activeIndex === filtered.length
                  ? "color-mix(in srgb, var(--accent) 8%, transparent)"
                  : "transparent",
              borderLeft: "2px solid transparent",
              borderLeftColor:
                activeIndex === filtered.length
                  ? "color-mix(in srgb, var(--accent) 40%, transparent)"
                  : "transparent",
              border: "none",
              borderLeftWidth: 2,
              borderLeftStyle: "solid",
              cursor: "pointer",
              borderTop:
                filtered.length > 0
                  ? "1px solid color-mix(in srgb, var(--foreground) 5%, transparent)"
                  : "none",
              transition: "background 0.08s",
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(query.trim());
            }}
          >
            <Plus
              size={10}
              style={{
                color: "color-mix(in srgb, var(--accent) 60%, transparent)",
                flexShrink: 0,
              }}
            />
            <div>
              <span
                style={{
                  fontSize: 11,
                  color: "color-mix(in srgb, var(--accent) 70%, transparent)",
                  ...monoStyle,
                }}
              >
                crear &ldquo;{query.trim()}&rdquo;
              </span>
              <span
                style={{
                  fontSize: 9,
                  color:
                    "color-mix(in srgb, var(--foreground) 20%, transparent)",
                  ...monoStyle,
                  marginLeft: 6,
                }}
              >
                nueva página
              </span>
            </div>
          </button>
        )}
      </div>

      {/* Footer hint */}
      <div
        className="px-3 py-1.5"
        style={{
          borderTop:
            "1px solid color-mix(in srgb, var(--foreground) 4%, transparent)",
          background: "color-mix(in srgb, var(--foreground) 2%, transparent)",
        }}
      >
        <span
          style={{
            fontSize: 8,
            color: "color-mix(in srgb, var(--foreground) 15%, transparent)",
            ...monoStyle,
          }}
        >
          ↑↓ navegar · enter enlazar · esc cancelar
        </span>
      </div>
    </MotionDiv>
  );
}
