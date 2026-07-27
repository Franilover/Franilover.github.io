"use client";
import React, { useEffect, useImperativeHandle, useRef, useState } from "react";

import { FloatingTextBox } from "./FloatingTextBox";
import { makeDefaultBox, type LayoutBox } from "./types";

export interface LayoutCanvasHandle {
  addBox: () => void;
}

interface LayoutCanvasProps {
  boxes: LayoutBox[];
  onBoxesChange: (boxes: LayoutBox[]) => void;
}

/**
 * Capa superpuesta al editor de ensayos con las cajas de texto flotantes.
 * Siempre visible (no hay modo on/off): vive montada con position:relative
 * del mismo ancho que el editor de fondo, y cada LayoutBox se renderiza como
 * un div position:absolute encima. El documento de texto normal sigue
 * existiendo debajo, siempre editable — el contenedor de esta capa tiene
 * pointerEvents:none para no capturar clicks en el área vacía; solo las
 * cajas individuales (pointerEvents:auto) son interactivas. Así ambas capas
 * conviven: click en una caja edita la caja, click afuera edita el fondo.
 */
export const LayoutCanvas = React.forwardRef<LayoutCanvasHandle, LayoutCanvasProps>(
  function LayoutCanvas({ boxes, onBoxesChange }, ref) {
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

    useImperativeHandle(ref, () => ({ addBox }), [boxes]);

    // Como el contenedor tiene pointerEvents:none, un click en el área
    // vacía (fuera de toda caja) nunca llega acá — cae directo en el
    // documento de fondo. Para deseleccionar igual escuchamos a nivel
    // documento y chequeamos si el click cayó dentro de alguna caja.
    useEffect(() => {
      if (!selectedId) return;
      const onDocMouseDown = (e: MouseEvent) => {
        const container = containerRef.current;
        if (!container) return;
        const target = e.target as Node;
        if (!container.contains(target)) setSelectedId(null);
      };
      document.addEventListener("mousedown", onDocMouseDown);
      return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, [selectedId]);

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
          background: "transparent",
          // No capturar clicks en el área vacía — deja pasar el click al
          // documento de fondo, que siempre está editable debajo. Cada
          // FloatingTextBox reactiva pointerEvents:auto sobre sí misma.
          pointerEvents: "none",
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
      </div>
    );
  },
);
