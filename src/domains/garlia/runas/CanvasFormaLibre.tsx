"use client";

/**
 * CanvasFormaLibre.tsx
 * ──────────────────────
 * Canvas de dibujo a mano alzada para la Parte 2 del plan de forma
 * libre: a diferencia de CanvasDibujoRuna.tsx (un solo trazo por
 * gesto, pensado para comparar contra una plantilla $1), acá el
 * jugador dibuja VARIOS trazos independientes sobre la misma
 * superficie — uno el contorno, otros las líneas divisorias — y cada
 * gesto de "levantar el dedo" cierra un trazo y empieza a acumular
 * para el siguiente, sin borrar los anteriores.
 *
 * No tiene noción de "forma límite" ni clamp: acá la forma es
 * justamente lo que hay que averiguar (ver deteccionFormaLibre.ts),
 * así que no hay nada contra qué recortar el dibujo.
 *
 * Expone la lista completa de trazos vía onTrazosChange en cada
 * cambio (agregar trazo, deshacer, limpiar) — pensado para que el
 * padre corra el detector geométrico en vivo y muestre un preview de
 * interpretación mientras el jugador sigue dibujando.
 *
 * Ruta destino:
 *   src/features/garliaPublic/runas/CanvasFormaLibre.tsx
 */

import { Eraser, Redo2 } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import type { Punto } from "./dollarOneRecognizer";

export function CanvasFormaLibre({
  color = "var(--primary)",
  height = 320,
  resetSignal,
  onTrazosChange,
}: {
  color?: string;
  height?: number;
  /** Cambiando este valor desde afuera se limpia el canvas. */
  resetSignal?: number;
  /** Se llama con la lista completa de trazos cada vez que cambia (nuevo trazo, deshacer, limpiar). */
  onTrazosChange: (trazos: Punto[][]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dibujando = useRef(false);
  const trazoActualRef = useRef<Punto[]>([]);
  const trazosRef = useRef<Punto[][]>([]);
  const [tamano, setTamano] = useState({ w: 320, h: height });
  const [tieneTrazos, setTieneTrazos] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setTamano({ w, h: height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [height]);

  const redibujarTodo = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, tamano.w, tamano.h);
    const strokeColor = color.startsWith("var") ? "currentColor" : color;
    for (const trazo of trazosRef.current) {
      if (trazo.length < 2) continue;
      ctx.beginPath();
      trazo.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  }, [color, tamano]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = tamano.w * dpr;
    canvas.height = tamano.h * dpr;
    canvas.style.width = `${tamano.w}px`;
    canvas.style.height = `${tamano.h}px`;
    const ctx = canvas.getContext("2d");
    ctx?.scale(dpr, dpr);
    redibujarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tamano]);

  useEffect(() => {
    trazosRef.current = [];
    trazoActualRef.current = [];
    setTieneTrazos(false);
    redibujarTodo();
    onTrazosChange([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>): Punto => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    dibujando.current = true;
    trazoActualRef.current = [getPos(e)];
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current) return;
    const p = getPos(e);
    const ctx = canvasRef.current?.getContext("2d");
    const anterior = trazoActualRef.current[trazoActualRef.current.length - 1];
    if (ctx && anterior) {
      ctx.beginPath();
      ctx.moveTo(anterior.x, anterior.y);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = color.startsWith("var") ? "currentColor" : color;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
    trazoActualRef.current.push(p);
  };

  const finalizarTrazo = () => {
    if (!dibujando.current) return;
    dibujando.current = false;
    if (trazoActualRef.current.length > 1) {
      trazosRef.current = [...trazosRef.current, trazoActualRef.current];
      setTieneTrazos(true);
      onTrazosChange(trazosRef.current);
    }
    trazoActualRef.current = [];
  };

  const deshacerUltimoTrazo = () => {
    if (trazosRef.current.length === 0) return;
    trazosRef.current = trazosRef.current.slice(0, -1);
    setTieneTrazos(trazosRef.current.length > 0);
    redibujarTodo();
    onTrazosChange(trazosRef.current);
  };

  const limpiar = () => {
    trazosRef.current = [];
    trazoActualRef.current = [];
    setTieneTrazos(false);
    redibujarTodo();
    onTrazosChange([]);
  };

  return (
    <div ref={containerRef} className="w-full relative" style={{ color }}>
      <canvas
        ref={canvasRef}
        className="w-full rounded-xl border-2 border-dashed touch-none bg-primary/3"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 20%, transparent)",
          height,
          color,
          cursor: "crosshair",
        }}
        onPointerDown={onPointerDown}
        onPointerLeave={finalizarTrazo}
        onPointerMove={onPointerMove}
        onPointerUp={finalizarTrazo}
      />

      {tieneTrazos && (
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-bg-main/90 border border-primary/20 text-primary/50 hover:text-primary transition-all"
            onClick={deshacerUltimoTrazo}
            title="Deshacer último trazo"
          >
            <Redo2 size={11} className="scale-x-[-1]" /> Deshacer
          </button>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-bg-main/90 border border-primary/20 text-primary/50 hover:text-primary transition-all"
            onClick={limpiar}
          >
            <Eraser size={11} /> Borrar todo
          </button>
        </div>
      )}
    </div>
  );
}
