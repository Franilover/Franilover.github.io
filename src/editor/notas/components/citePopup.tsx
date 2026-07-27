"use client";
import React from "react";

import { MotionDiv } from "@/ui/Motion";
import type { ZoteroSource } from "@/editor/notas/hooks/useZotero";

interface CitePopupProps {
  sources: ZoteroSource[];
  query: string;
  position: { top: number; left: number };
  onSelect: (source: ZoteroSource) => void;
  onClose: () => void;
  activeIndex: number;
}

export function CitePopup({ sources, query, position: _position, onSelect, onClose: _onClose, activeIndex }: CitePopupProps) {
  const filtered = sources
    .filter(s =>
      !query ||
      s.citekey?.toLowerCase().includes(query.toLowerCase()) ||
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.author.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 8);

  if (filtered.length === 0) return null;

  const monoStyle: React.CSSProperties = { fontFamily: "var(--font-mono)" };

  return (
    <MotionDiv
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      style={{
        minWidth: 300,
        maxWidth: 420,
        background: "var(--bg-menu)",
        border: "1px solid color-mix(in srgb, var(--foreground) 12%, transparent)",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 16px 48px color-mix(in srgb, var(--bg-main) 0%, transparent)",
      }}
      transition={{ duration: 0.1 }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}
      >
        <span style={{ fontSize: 9, color: "color-mix(in srgb, var(--foreground) 20%, transparent)", ...monoStyle, textTransform: "uppercase", letterSpacing: "0.15em" }}>
          @ zotero · {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Results */}
      <div style={{ maxHeight: 280, overflowY: "auto" }}>
        {filtered.map((src, i) => {
          const isActive = i === activeIndex;
          return (
            <button
              key={src.citekey || i}
              className="w-full text-left"
              style={{
                display: "block",
                padding: "8px 12px",
                background: isActive ? "color-mix(in srgb, var(--foreground) 6%, transparent)" : "transparent",
                borderLeft: `2px solid ${isActive ? "var(--accent)" : "transparent"}`,
                border: "none",
                cursor: "pointer",
                transition: "background 0.08s",
              }}
              onMouseDown={e => { e.preventDefault(); onSelect(src); }}
            >
              <p style={{ fontSize: 11, color: "color-mix(in srgb, var(--foreground) 75%, transparent)", ...monoStyle, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {src.title}
              </p>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 9, color: "color-mix(in srgb, var(--foreground) 30%, transparent)", ...monoStyle }}>
                  {src.author}{src.year ? ` · ${src.year}` : ""}
                </span>
                {src.citekey && (
                  <span
                    style={{
                      fontSize: 8,
                      padding: "1px 5px",
                      borderRadius: 3,
                      background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
                      color: "color-mix(in srgb, var(--accent) 70%, transparent)",
                      ...monoStyle,
                    }}
                  >
                    @{src.citekey}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer hint */}
      <div
        className="px-3 py-1.5"
        style={{ borderTop: "1px solid color-mix(in srgb, var(--foreground) 4%, transparent)", background: "color-mix(in srgb, var(--foreground) 2%, transparent)" }}
      >
        <span style={{ fontSize: 8, color: "color-mix(in srgb, var(--foreground) 15%, transparent)", ...monoStyle }}>
          ↑↓ navegar · enter insertar · esc cancelar
        </span>
      </div>
    </MotionDiv>
  );
}