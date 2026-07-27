"use client";
/**
 * SnippetChip.tsx
 * ───────────────
 * Componente visual reutilizable para el chip inline de cualquier
 * SnippetNode. Cada nodo (DropNode, SoundNode, etc.) lo usa pasándole su
 * ícono, label corto y un click handler — así no se repite el mismo JSX
 * de chip 7 veces.
 */
import React, { useState, useCallback } from "react";

import {
  chipBaseStyle,
  chipColorStyle,
  chipDotStyle,
  chipDeleteBtnStyle,
} from "./sharedTypes";

export function SnippetChip({
  icon,
  text,
  title,
  maxTextWidth = 140,
  onClick,
  onDelete,
}: {
  icon: React.ReactNode;
  text: string;
  title: string;
  maxTextWidth?: number;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick();
    },
    [onClick],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete();
    },
    [onDelete],
  );

  return (
    <span
      contentEditable={false}
      style={{ ...chipBaseStyle, ...chipColorStyle(hovered) }}
      title={title}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={chipDotStyle} />
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          lineHeight: 1,
        }}
      >
        {icon}
      </span>
      <span
        style={{
          maxWidth: maxTextWidth,
          overflow: "hidden",
          textOverflow: "ellipsis",
          opacity: 0.95,
        }}
      >
        {text}
      </span>
      {hovered && (
        <button
          style={chipDeleteBtnStyle}
          title="Eliminar"
          type="button"
          onClick={handleDelete}
        >
          ×
        </button>
      )}
    </span>
  );
}
