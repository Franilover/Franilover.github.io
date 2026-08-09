"use client";

/**
 * DragDropReasignable
 * ───────────────────────────────────────────────────────────────────────────
 * Hook compartido para el patrón "click izquierdo abre / click derecho
 * arrastra" usado en las vistas jerárquicas de Entidades (GeografiaJerarquica,
 * CriaturasJerarquica). Reemplaza el drag & drop HTML5 nativo (que está
 * atado al botón izquierdo del mouse y genera conflicto con el click normal
 * de "abrir") por un drag manual basado en mouse events, disparado solo con
 * el botón derecho.
 *
 * Uso:
 *
 *   const dragReino = useRightClickDrag<string>({
 *     label: (id) => reinos.find((r) => r.id === id)?.nombre ?? "",
 *   });
 *
 *   // en el elemento que se puede arrastrar (origen):
 *   <div {...dragReino.dragHandlers(reino.id)}>...</div>
 *
 *   // en el elemento que puede recibir el drop (destino):
 *   <div {...dragReino.dropHandlers(ecosistemaId, (draggedId) => {
 *     onAsignarReinoAEcosistema(draggedId, ecosistemaId);
 *   })}>...</div>
 *
 *   // una sola vez, al final del árbol de la vista:
 *   {dragReino.overlay}
 *
 * El botón izquierdo (click normal / onClick de un <button>) queda
 * completamente libre y no se ve afectado — el hook solo escucha
 * mousedown con button === 2 (derecho) y contextmenu (para prevenir el
 * menú contextual del navegador mientras se arrastra).
 */

import { createPortal } from "react-dom";
import React, { useCallback, useEffect, useRef, useState } from "react";

const UMBRAL_ARRASTRE_PX = 4;

interface EstadoArrastre<T> {
  payload: T;
  originZoneId: string | null;
  x: number;
  y: number;
  /** true una vez que el mouse se movió lo suficiente como para considerarse
   *  un arrastre real (evita que un click derecho corto dispare el overlay). */
  activo: boolean;
}

export interface UseRightClickDragOptions<T> {
  /** Texto a mostrar en el chip flotante mientras se arrastra. */
  label: (payload: T) => string;
}

export function useRightClickDrag<T>({ label }: UseRightClickDragOptions<T>) {
  const [estado, setEstado] = useState<EstadoArrastre<T> | null>(null);
  const [dropZoneActivaId, setDropZoneActivaId] = useState<string | null>(null);
  const estadoRef = useRef<EstadoArrastre<T> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const dropTargetsRef = useRef<
    Map<string, { onDrop: (payload: T) => void }>
  >(new Map());

  estadoRef.current = estado;

  const limpiar = useCallback(() => {
    setEstado(null);
    setDropZoneActivaId(null);
    startRef.current = null;
  }, []);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!startRef.current) return;
      const cur = estadoRef.current;
      if (!cur) return;

      if (!cur.activo) {
        const dx = e.clientX - startRef.current.x;
        const dy = e.clientY - startRef.current.y;
        if (Math.hypot(dx, dy) < UMBRAL_ARRASTRE_PX) return;
        setEstado({ ...cur, activo: true, x: e.clientX, y: e.clientY });
      } else {
        setEstado({ ...cur, x: e.clientX, y: e.clientY });
      }

      // Detecta la zona de drop bajo el cursor vía elementFromPoint +
      // closest(), buscando el atributo data-drop-zone-id más cercano.
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const zona = el?.closest<HTMLElement>("[data-drop-zone-id]");
      setDropZoneActivaId(zona?.getAttribute("data-drop-zone-id") ?? null);
    }

    function onMouseUp(e: MouseEvent) {
      if (!startRef.current) return;
      const cur = estadoRef.current;
      startRef.current = null;
      if (!cur) return;

      if (cur.activo) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const zona = el?.closest<HTMLElement>("[data-drop-zone-id]");
        const zonaId = zona?.getAttribute("data-drop-zone-id") ?? null;
        if (zonaId) {
          const target = dropTargetsRef.current.get(zonaId);
          target?.onDrop(cur.payload);
        }
      }
      limpiar();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") limpiar();
    }

    if (estado) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("keydown", onKeyDown);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado !== null]);

  /** Handlers para el elemento arrastrable (origen). `zoneId` es el id de
   *  zona de drop que representa a este mismo elemento (si también puede
   *  recibir drops); puede omitirse si el elemento solo es origen. */
  const dragHandlers = useCallback(
    (payload: T, originZoneId?: string) => ({
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
      },
      onMouseDown: (e: React.MouseEvent) => {
        if (e.button !== 2) return;
        e.preventDefault();
        startRef.current = { x: e.clientX, y: e.clientY };
        setEstado({
          payload,
          originZoneId: originZoneId ?? null,
          x: e.clientX,
          y: e.clientY,
          activo: false,
        });
      },
      title: `${label(payload)} — click derecho para mover`,
    }),
    [label],
  );

  /** Handlers para el elemento que puede recibir un drop. `onDrop` recibe el
   *  payload arrastrado. Se registra/desregistra en un ref (no en el DOM)
   *  para no depender de eventos nativos onDrop/onDragOver del navegador. */
  const dropHandlers = useCallback((zoneId: string, onDrop: (payload: T) => void) => {
    dropTargetsRef.current.set(zoneId, { onDrop });
    return {
      "data-drop-zone-id": zoneId,
    } as React.HTMLAttributes<HTMLElement> & { "data-drop-zone-id": string };
  }, []);

  const esZonaActiva = useCallback(
    (zoneId: string) => !!estado?.activo && dropZoneActivaId === zoneId,
    [estado, dropZoneActivaId],
  );

  const arrastrando = !!estado?.activo;

  const overlay =
    estado?.activo && typeof document !== "undefined"
      ? createPortal(
          <div
            style={{
              position: "fixed",
              left: estado.x + 12,
              top: estado.y + 12,
              zIndex: 9999,
              pointerEvents: "none",
            }}
            className="px-2.5 py-1 rounded-full text-micro font-bold tracking-wide bg-accent text-white shadow-lg"
          >
            {label(estado.payload)}
          </div>,
          document.body,
        )
      : null;

  return { dragHandlers, dropHandlers, esZonaActiva, arrastrando, overlay };
}
