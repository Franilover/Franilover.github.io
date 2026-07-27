"use client";
import { Copy, GripVertical, SendToBack, BringToFront, Trash2 } from "lucide-react";
import React, { useCallback, useRef } from "react";

import { RichEditor } from "@/editor/lexical";

import { LAYOUT_BOX_MIN_HEIGHT, LAYOUT_BOX_MIN_WIDTH, type LayoutBox } from "./types";

type ResizeHandle =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

const RESIZE_HANDLES: { dir: ResizeHandle; style: React.CSSProperties }[] = [
  { dir: "nw", style: { top: -4, left: -4, cursor: "nwse-resize" } },
  { dir: "n", style: { top: -4, left: "50%", marginLeft: -4, cursor: "ns-resize" } },
  { dir: "ne", style: { top: -4, right: -4, cursor: "nesw-resize" } },
  { dir: "w", style: { top: "50%", left: -4, marginTop: -4, cursor: "ew-resize" } },
  { dir: "e", style: { top: "50%", right: -4, marginTop: -4, cursor: "ew-resize" } },
  { dir: "sw", style: { bottom: -4, left: -4, cursor: "nesw-resize" } },
  { dir: "s", style: { bottom: -4, left: "50%", marginLeft: -4, cursor: "ns-resize" } },
  { dir: "se", style: { bottom: -4, right: -4, cursor: "nwse-resize" } },
];

interface FloatingTextBoxProps {
  box: LayoutBox;
  selected: boolean;
  /** Límites del canvas contenedor, en px locales (0,0 = esquina sup. izq. del canvas). */
  bounds: { width: number; height: number };
  onSelect: () => void;
  onChange: (patch: Partial<LayoutBox>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
}

export function FloatingTextBox({
  box,
  selected,
  bounds,
  onSelect,
  onChange,
  onDelete,
  onDuplicate,
  onBringToFront,
  onSendToBack,
}: FloatingTextBoxProps) {
  const dragState = useRef<{
    startX: number;
    startY: number;
    boxX: number;
    boxY: number;
  } | null>(null);
  const resizeState = useRef<{
    dir: ResizeHandle;
    startX: number;
    startY: number;
    box: LayoutBox;
  } | null>(null);

  const clamp = useCallback(
    (x: number, y: number, width: number, height: number) => {
      // No permitir sacar la caja completamente del área visible: exigimos
      // que al menos ~24px de la caja sigan dentro del canvas en cada eje.
      const minVisible = 24;
      const clampedX = Math.min(
        Math.max(x, minVisible - width),
        bounds.width - minVisible,
      );
      const clampedY = Math.min(
        Math.max(y, minVisible - height),
        bounds.height - minVisible,
      );
      return { x: clampedX, y: clampedY };
    },
    [bounds.width, bounds.height],
  );

  // ── Drag ────────────────────────────────────────────────────────────────
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect();
      dragState.current = { startX: e.clientX, startY: e.clientY, boxX: box.x, boxY: box.y };

      const onMove = (ev: MouseEvent) => {
        if (!dragState.current) return;
        const dx = ev.clientX - dragState.current.startX;
        const dy = ev.clientY - dragState.current.startY;
        const { x, y } = clamp(
          dragState.current.boxX + dx,
          dragState.current.boxY + dy,
          box.width,
          box.height,
        );
        onChange({ x, y });
      };
      const onUp = () => {
        dragState.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [box.x, box.y, box.width, box.height, clamp, onChange, onSelect],
  );

  // ── Resize ──────────────────────────────────────────────────────────────
  const handleResizeStart = useCallback(
    (dir: ResizeHandle) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect();
      resizeState.current = { dir, startX: e.clientX, startY: e.clientY, box: { ...box } };

      const onMove = (ev: MouseEvent) => {
        const state = resizeState.current;
        if (!state) return;
        const dx = ev.clientX - state.startX;
        const dy = ev.clientY - state.startY;
        let { x, y, width, height } = state.box;

        if (state.dir.includes("e")) width = state.box.width + dx;
        if (state.dir.includes("s")) height = state.box.height + dy;
        if (state.dir.includes("w")) {
          width = state.box.width - dx;
          x = state.box.x + dx;
        }
        if (state.dir.includes("n")) {
          height = state.box.height - dy;
          y = state.box.y + dy;
        }

        // Mínimos: si el ancho/alto cae debajo del mínimo, anclamos el
        // borde opuesto en vez de dejar que la caja "brinque".
        if (width < LAYOUT_BOX_MIN_WIDTH) {
          if (state.dir.includes("w")) x = state.box.x + state.box.width - LAYOUT_BOX_MIN_WIDTH;
          width = LAYOUT_BOX_MIN_WIDTH;
        }
        if (height < LAYOUT_BOX_MIN_HEIGHT) {
          if (state.dir.includes("n")) y = state.box.y + state.box.height - LAYOUT_BOX_MIN_HEIGHT;
          height = LAYOUT_BOX_MIN_HEIGHT;
        }

        onChange({ x, y, width, height });
      };
      const onUp = () => {
        resizeState.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [box, onChange, onSelect],
  );

  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        zIndex: box.zIndex,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-main)",
        border: selected
          ? "1.5px solid color-mix(in srgb, var(--accent) 70%, transparent)"
          : "1px solid color-mix(in srgb, var(--foreground) 12%, transparent)",
        borderRadius: 6,
        boxShadow: selected
          ? "0 6px 24px color-mix(in srgb, var(--bg-main) 45%, transparent)"
          : "0 2px 10px color-mix(in srgb, var(--bg-main) 25%, transparent)",
        overflow: "hidden",
      }}
      onMouseDown={onSelect}
    >
      {/* Barra superior: drag handle + controles rápidos (solo si seleccionada) */}
      <div
        style={{
          flexShrink: 0,
          height: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 4px",
          background: selected
            ? "color-mix(in srgb, var(--accent) 10%, var(--bg-menu))"
            : "color-mix(in srgb, var(--foreground) 4%, var(--bg-menu))",
          borderBottom: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)",
          cursor: "grab",
        }}
        onMouseDown={handleDragStart}
      >
        <GripVertical
          size={12}
          style={{ color: "color-mix(in srgb, var(--foreground) 30%, transparent)" }}
        />
        {selected && (
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button
              style={iconBtnStyle}
              title="Traer al frente"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onBringToFront}
            >
              <BringToFront size={11} />
            </button>
            <button
              style={iconBtnStyle}
              title="Enviar atrás"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onSendToBack}
            >
              <SendToBack size={11} />
            </button>
            <button
              style={iconBtnStyle}
              title="Duplicar"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onDuplicate}
            >
              <Copy size={11} />
            </button>
            <button
              style={{ ...iconBtnStyle, color: "#e05a5a" }}
              title="Eliminar"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onDelete}
            >
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>

      {/* Contenido: RichEditor completo, independiente por caja */}
      <div
        style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "2px 8px" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <RichEditor
          mode="edit"
          placeholder="escribí acá..."
          showSplitMode={false}
          value={box.content}
          onChange={(value) => onChange({ content: value })}
        />
      </div>

      {/* Handles de resize — solo visibles/activos cuando está seleccionada */}
      {selected &&
        RESIZE_HANDLES.map(({ dir, style }) => (
          <div
            key={dir}
            style={{
              position: "absolute",
              width: 8,
              height: 8,
              borderRadius: 2,
              background: "var(--accent)",
              border: "1px solid var(--bg-main)",
              zIndex: 10,
              ...style,
            }}
            onMouseDown={handleResizeStart(dir)}
          />
        ))}
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 18,
  height: 18,
  border: "none",
  background: "transparent",
  borderRadius: 3,
  cursor: "pointer",
  color: "color-mix(in srgb, var(--foreground) 45%, transparent)",
};
