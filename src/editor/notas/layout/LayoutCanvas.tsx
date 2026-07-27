"use client";
import { Plus } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { FloatingTextBox } from "./FloatingTextBox";
import { makeDefaultBox, type LayoutBox } from "./types";

interface LayoutCanvasProps {
  boxes: LayoutBox[];
  onBoxesChange: (boxes: LayoutBox[]) => void;
}

/**
 * Capa superpuesta al editor de ensayos ("modo maquetación"). Vive montada
 * con position:relative del mismo ancho que el editor de fondo; cada
 * LayoutBox se renderiza como un div position:absolute encima. El documento
 * de texto normal sigue existiendo debajo, sin reflow ni interferencia —
 * este componente no lo toca ni lo conoce.
 */
export function LayoutCanvas({ boxes, onBoxesChange }: LayoutCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bounds, setBounds] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () =>
      setBounds({ width: el.clientWidth, height: Math.max(el.clientHeight, 400) });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const updateBox = (id: string, patch: Partial<LayoutBox>) => {
    onBoxesChange(boxes.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const addBox = () => {
    const box = makeDefaultBox(boxes);
    onBoxesChange([...boxes, box]);
    setSelectedId(box.id);
  };

  const deleteBox = (id: string) => {
    onBoxesChange(boxes.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateBox = (id: string) => {
    const src = boxes.find((b) => b.id === id);
    if (!src) return;
    const topZ = boxes.reduce((max, b) => Math.max(max, b.zIndex), 0);
    const copy: LayoutBox = {
      ...src,
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `box-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      x: src.x + 24,
      y: src.y + 24,
      zIndex: topZ + 1,
    };
    onBoxesChange([...boxes, copy]);
    setSelectedId(copy.id);
  };

  const bringToFront = (id: string) => {
    const topZ = boxes.reduce((max, b) => Math.max(max, b.zIndex), 0);
    updateBox(id, { zIndex: topZ + 1 });
  };

  const sendToBack = (id: string) => {
    const bottomZ = boxes.reduce((min, b) => Math.min(min, b.zIndex), 0);
    updateBox(id, { zIndex: bottomZ - 1 });
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 25,
        // El fondo del canvas es transparente: el documento de texto sigue
        // visible detrás, en solo-lectura mientras este modo está activo.
        background: "transparent",
      }}
      onMouseDown={(e) => {
        // Click en el canvas vacío (no en una caja) → deseleccionar.
        if (e.target === containerRef.current) setSelectedId(null);
      }}
    >
      {boxes.map((box) => (
        <FloatingTextBox
          key={box.id}
          bounds={bounds}
          box={box}
          selected={selectedId === box.id}
          onBringToFront={() => bringToFront(box.id)}
          onChange={(patch) => updateBox(box.id, patch)}
          onDelete={() => deleteBox(box.id)}
          onDuplicate={() => duplicateBox(box.id)}
          onSelect={() => setSelectedId(box.id)}
          onSendToBack={() => sendToBack(box.id)}
        />
      ))}

      {/* Botón flotante para agregar una caja nueva */}
      <button
        style={{
          position: "absolute",
          bottom: 16,
          right: 16,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 12px",
          borderRadius: 20,
          border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
          background: "color-mix(in srgb, var(--accent) 12%, var(--bg-main))",
          color: "var(--accent)",
          fontSize: 11,
          fontFamily: "var(--font-mono)",
          cursor: "pointer",
          boxShadow: "0 4px 16px color-mix(in srgb, var(--bg-main) 40%, transparent)",
        }}
        onClick={addBox}
      >
        <Plus size={13} />
        caja de texto
      </button>
    </div>
  );
}
