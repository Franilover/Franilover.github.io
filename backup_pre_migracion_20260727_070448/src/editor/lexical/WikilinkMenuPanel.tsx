"use client";
/**
 * WikilinkMenuPanel.tsx
 * ──────────────────────
 * Menú flotante de autocompletado de [[wikilinks]] para RichEditor.
 * Componente presentacional puro — mismo estilo visual que el WikilinkMenu
 * de EditorFloatingPanels.tsx (MarkdownEditor), adaptado para recibir
 * su estado desde WikilinkPlugin en vez de un textarea.
 */
import React, { useEffect, useMemo } from "react";

const PRIMARY = "var(--color-primary, #7c6af7)";
const mono = { fontFamily: "var(--font-mono)" } as const;

export interface WikiEntity {
  name: string;
  type: string;
}

interface WikilinkMenuPanelProps {
  entities: WikiEntity[];
  query: string;
  pos: { top: number; left: number };
  selectedIdx: number;
  onSelect: (entity: WikiEntity) => void;
  onHover: (idx: number) => void;
  onClose: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

export function WikilinkMenuPanel({
  entities,
  query,
  pos,
  selectedIdx,
  onSelect,
  onHover,
  onClose,
  menuRef,
}: WikilinkMenuPanelProps) {
  const filtered = useMemo(() => {
    if (!query) return entities;
    const q = query.toLowerCase();
    return entities.filter((e) => e.name.toLowerCase().includes(q));
  }, [entities, query]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuRef, onClose]);

  if (filtered.length === 0 && !query) return null;

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: pos.top,
        left: Math.max(8, pos.left),
        zIndex: 9999,
        width: 260,
        maxHeight: 260,
        overflowY: "auto",
        background: "var(--bg-menu, #1a1730)",
        border: `1px solid color-mix(in srgb, ${PRIMARY} 22%, transparent)`,
        borderRadius: 10,
        boxShadow: `0 12px 40px color-mix(in srgb, ${PRIMARY} 18%, black)`,
        backdropFilter: "blur(12px)",
        padding: 4,
      }}
    >
      {filtered.length === 0 ? (
        <div
          style={{
            padding: "10px 12px",
            fontSize: 11,
            ...mono,
            color: "color-mix(in srgb, var(--foreground) 30%, transparent)",
          }}
        >
          Sin resultados — Enter crea &quot;{query}&quot;
        </div>
      ) : (
        filtered.map((entity, idx) => (
          <div
            key={entity.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 10px",
              borderRadius: 6,
              cursor: "pointer",
              background:
                idx === selectedIdx
                  ? `color-mix(in srgb, ${PRIMARY} 14%, transparent)`
                  : "transparent",
            }}
            onClick={() => onSelect(entity)}
            onMouseEnter={() => onHover(idx)}
          >
            <span
              style={{
                fontSize: 13,
                color: `color-mix(in srgb, ${PRIMARY} 60%, transparent)`,
              }}
            >
              »
            </span>
            <span
              style={{
                flex: 1,
                fontSize: 12,
                color: "color-mix(in srgb, var(--foreground) 82%, transparent)",
              }}
            >
              {entity.name}
            </span>
            <span
              style={{
                fontSize: 9,
                ...mono,
                color: "color-mix(in srgb, var(--foreground) 25%, transparent)",
              }}
            >
              {entity.type}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
