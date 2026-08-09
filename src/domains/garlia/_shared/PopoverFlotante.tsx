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
  width = 560,
  maxHeight = 460,
}: {
  /** Elemento al que se ancla el popover. Si es null, no se renderiza nada. */
  anchor: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  maxHeight?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
    availHeight: number;
    openUp: boolean;
  } | null>(null);

  useEffect(() => {
    if (!anchor) {
      setPos(null);
      return;
    }
    const MARGIN = 8;
    const update = () => {
      const r = anchor.getBoundingClientRect();
      // Ancho efectivo: el pedido, acotado al viewport (con margen), para que
      // el layout horizontal no se corte en pantallas angostas.
      const effectiveWidth = Math.min(width, window.innerWidth - MARGIN * 2);

      const espacioAbajo = window.innerHeight - r.bottom - MARGIN;
      const espacioArriba = r.top - MARGIN;
      // Abre hacia arriba solo si abajo no entra Y arriba hay más lugar que
      // abajo — y en ese caso la altura disponible real es espacioArriba,
      // no un valor fijo: así nunca se corta contra el borde superior.
      const openUp = espacioAbajo < Math.min(maxHeight, 280) && espacioArriba > espacioAbajo;
      // Techo duro: nunca superamos el espacio real disponible en la
      // dirección elegida (evita cortes contra cualquier borde), aunque
      // sea menor a maxHeight — el panel se acota y su scroll interno
      // absorbe el resto.
      const espacioDisponible = Math.max(120, openUp ? espacioArriba : espacioAbajo);
      const availHeight = Math.min(maxHeight, espacioDisponible);

      const left = Math.min(Math.max(r.left, MARGIN), window.innerWidth - effectiveWidth - MARGIN);
      const top = openUp ? r.top - MARGIN : r.bottom + MARGIN;
      setPos({ top, left, width: effectiveWidth, availHeight, openUp });
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
        width: pos.width,
        maxHeight: pos.availHeight,
        transform: pos.openUp ? "translateY(-100%)" : undefined,
        background: "var(--bg-main)",
        borderColor: "color-mix(in srgb, var(--primary) 14%, transparent)",
      }}
    >
      <div className="overflow-y-auto flex-1 min-h-0">
        <div className="p-4 h-full min-h-0 flex flex-col">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
