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
  centerVertically = false,
  centerHorizontally = false,
  backdrop = false,
}: {
  /** Elemento al que se ancla el popover. Si es null, no se renderiza nada. */
  anchor: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  maxHeight?: number;
  /**
   * Si true, el panel ignora el anclaje vertical arriba/abajo del trigger
   * y en cambio se centra verticalmente en el viewport — útil para
   * editores con muchas secciones (ej. Ecosistema) que se cortaban contra
   * el borde superior o inferior de la pantalla al abrir cerca de los
   * extremos.
   */
  centerVertically?: boolean;
  /**
   * Si true, el panel se centra horizontalmente en el viewport en vez de
   * alinearse a la izquierda del trigger.
   */
  centerHorizontally?: boolean;
  /**
   * Si true, renderiza un fondo oscuro fullscreen detrás del panel y el
   * cierre por click-afuera escucha ese fondo en vez de depender de
   * `anchor` (necesario cuando el panel no tiene un elemento DOM de origen
   * real, ej. el panel flotante global montado una sola vez en la raíz —
   * ahí `anchor.contains(target)` sería siempre true si se usara
   * document.body como anchor, porque todo click cae dentro de <body>).
   * Requiere anchor no-nulo igual (se usa solo para el cálculo de
   * posición inicial), pero ignora `anchor.contains` en el cierre.
   */
  backdrop?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    openUp: boolean;
  } | null>(null);

  // Fase 1: posicionamiento inicial (estimado) en cuanto aparece el anchor,
  // usando maxHeight como techo — esto es lo que se ve en el primer frame,
  // antes de conocer la altura real del contenido ya renderizado.
  useEffect(() => {
    if (!anchor) {
      setPos(null);
      return;
    }
    const MARGIN = 8;
    const update = () => {
      const r = anchor.getBoundingClientRect();
      const effectiveWidth = Math.min(width, window.innerWidth - MARGIN * 2);
      const left = centerHorizontally
        ? Math.max(MARGIN, (window.innerWidth - effectiveWidth) / 2)
        : Math.min(Math.max(r.left, MARGIN), window.innerWidth - effectiveWidth - MARGIN);

      if (centerVertically) {
        const espacioVertical = window.innerHeight - MARGIN * 2;
        const cappedMaxHeight = Math.min(maxHeight, espacioVertical);
        // Estimación inicial: centra asumiendo que el panel va a ocupar el
        // techo completo. La fase 2 (abajo) corrige esto con la altura real
        // apenas el contenido termina de renderizar, así que este valor solo
        // se ve durante un frame.
        const top = Math.max(MARGIN, (window.innerHeight - cappedMaxHeight) / 2);
        setPos({ top, left, width: effectiveWidth, maxHeight: cappedMaxHeight, openUp: false });
        return;
      }

      const espacioAbajo = window.innerHeight - r.bottom - MARGIN;
      const espacioArriba = r.top - MARGIN;
      const openUp = espacioAbajo < Math.min(maxHeight, 280) && espacioArriba > espacioAbajo;
      const espacioDisponible = Math.max(120, openUp ? espacioArriba : espacioAbajo);
      const cappedMaxHeight = Math.min(maxHeight, espacioDisponible);

      const top = openUp ? r.top - MARGIN : r.bottom + MARGIN;
      setPos({ top, left, width: effectiveWidth, maxHeight: cappedMaxHeight, openUp });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor, width, maxHeight, centerVertically, centerHorizontally]);

  // Fase 2: una vez el panel está en el DOM, si centerVertically está
  // activo, recalcula `top` usando la altura REAL del panel (que puede ser
  // menor a maxHeight si el contenido es corto) — sin esto, el panel queda
  // centrado respecto a un techo que nunca ocupa entero y se ve pegado
  // arriba en vez de centrado.
  useEffect(() => {
    if (!anchor || !centerVertically || !pos) return;
    const el = panelRef.current;
    if (!el) return;
    const MARGIN = 8;
    const recenter = () => {
      const altura = el.getBoundingClientRect().height;
      const top = Math.max(MARGIN, (window.innerHeight - altura) / 2);
      setPos((prev) => (prev && Math.abs(prev.top - top) > 0.5 ? { ...prev, top } : prev));
    };
    recenter();
    const ro = new ResizeObserver(recenter);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, centerVertically, pos?.maxHeight, pos?.width]);

  useEffect(() => {
    if (!anchor) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      // Modo backdrop: no depende de anchor.contains (sería siempre true
      // si anchor fuera document.body) — el fondo propio (data-popover-backdrop)
      // es el único elemento "afuera" que cierra el panel.
      if (backdrop) {
        if ((target as HTMLElement)?.dataset?.popoverBackdrop) onClose();
        return;
      }
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
  }, [anchor, onClose, backdrop]);

  if (!anchor || !pos) return null;

  return createPortal(
    <>
      {backdrop && (
        <div
          data-popover-backdrop="true"
          className="fixed inset-0 z-[9998]"
          style={{
            background: "color-mix(in srgb, var(--primary) 35%, transparent)",
            backdropFilter: "blur(8px)",
          }}
        />
      )}
      <div
        ref={panelRef}
        className="fixed z-[9999] rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
        style={{
          top: pos.top,
          left: pos.left,
          width: pos.width,
          maxHeight: pos.maxHeight,
          transform: pos.openUp ? "translateY(-100%)" : undefined,
          background: "var(--bg-main)",
          borderColor: "color-mix(in srgb, var(--primary) 14%, transparent)",
        }}
      >
        <div className="overflow-y-auto flex-1 min-h-0">
          <div className="p-4 h-full min-h-0 flex flex-col">{children}</div>
        </div>
      </div>
    </>,
    document.body,
  );
}
