"use client";

/**
 * PopoverFlotante.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Panel flotante genérico (portal) anclado a un elemento trigger — mismo
 * mecanismo anti-clip que el buscador de SelectorReinosMulti, pero pensado
 * para contenido más grande (editor de bioma / ecosistema) en vez de un
 * dropdown de búsqueda: tamaño fijo configurable, scroll interno propio,
 * cierre con click afuera o Escape.
 *
 * Uso:
 *   const [anchor, setAnchor] = useState<HTMLElement | null>(null);
 *   <button onClick={(e) => setAnchor(e.currentTarget)}>Abrir</button>
 *   <PopoverFlotante anchor={anchor} onClose={() => setAnchor(null)}>
 *     ...contenido...
 *   </PopoverFlotante>
 */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function PopoverFlotante({
  anchor,
  onClose,
  children,
  width = 380,
  maxHeight = 520,
}: {
  /** Elemento al que se ancla el popover. Si es null, no se renderiza nada. */
  anchor: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  maxHeight?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; openUp: boolean } | null>(null);

  useEffect(() => {
    if (!anchor) {
      setPos(null);
      return;
    }
    const update = () => {
      const r = anchor.getBoundingClientRect();
      const espacioAbajo = window.innerHeight - r.bottom;
      const espacioArriba = r.top;
      const openUp = espacioAbajo < Math.min(maxHeight, 320) && espacioArriba > espacioAbajo;
      const left = Math.min(Math.max(r.left, 8), window.innerWidth - width - 8);
      const top = openUp ? r.top - 8 : r.bottom + 8;
      setPos({ top, left, openUp });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor, width, maxHeight]);

  useEffect(() => {
    if (!anchor) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchor.contains(target)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchor, onClose]);

  if (!anchor || !pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[9999] rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
      style={{
        top: pos.top,
        left: pos.left,
        width,
        maxHeight: `min(${maxHeight}px, calc(100vh - 16px))`,
        transform: pos.openUp ? "translateY(-100%)" : undefined,
        background: "var(--bg-main)",
        borderColor: "color-mix(in srgb, var(--primary) 14%, transparent)",
      }}
    >
      <div className="overflow-y-auto p-4">{children}</div>
    </div>,
    document.body,
  );
}
