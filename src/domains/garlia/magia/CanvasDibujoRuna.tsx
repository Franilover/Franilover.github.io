"use client";

/**
 * CanvasDibujoRuna.tsx
 * ──────────────────────
 * Canvas de dibujo a mano alzada, reusado tanto por el editor admin
 * (para grabar el patrón de referencia de una runa) como por la página
 * pública (para que el usuario dibuje e intente adivinar la runa).
 *
 * Soporta un solo trazo continuo por gesto de "levantar el dedo/mouse".
 * Expone los puntos crudos capturados vía onTrazoCompleto, y puede
 * dibujar una "plantilla fantasma" de fondo (para el modo admin, como
 * guía de ejemplos previos).
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/magia/CanvasDibujoRuna.tsx
 */

import { Eraser } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import type { Punto } from "./dollarOneRecognizer";

export function CanvasDibujoRuna({
  color = "var(--primary)",
  trazoFantasma,
  onTrazoCompleto,
  height = 260,
  resetSignal,
}: {
  color?: string;
  /** Trazo ya normalizado que se dibuja tenue de fondo, como referencia */
  trazoFantasma?: Punto[] | null;
  onTrazoCompleto: (puntos: Punto[]) => void;
  height?: number;
  /** Cambiando este valor desde afuera se limpia el canvas */
  resetSignal?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dibujando = useRef(false);
  const puntosRef = useRef<Punto[]>([]);
  const [tieneTrazo, setTieneTrazo] = useState(false);
  const [tamano, setTamano] = useState({ w: 320, h: height });

  // Ajustar tamaño del canvas al contenedor (responsive)
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

  const redibujarFantasma = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (trazoFantasma && trazoFantasma.length > 1) {
      // El trazo fantasma viene normalizado en un cuadrado de ~250x250
      // centrado en el origen; lo reescalamos y centramos en el canvas.
      const xs = trazoFantasma.map((p) => p.x);
      const ys = trazoFantasma.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const w = maxX - minX || 1;
      const h = maxY - minY || 1;
      const margen = 32;
      const escala = Math.min(
        (canvas.width - margen * 2) / w,
        (canvas.height - margen * 2) / h,
      );
      const offX = (canvas.width - w * escala) / 2;
      const offY = (canvas.height - h * escala) / 2;

      ctx.beginPath();
      trazoFantasma.forEach((p, i) => {
        const x = (p.x - minX) * escala + offX;
        const y = (p.y - minY) * escala + offY;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "rgba(150,150,150,0.35)";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([2, 10]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [trazoFantasma]);

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
    redibujarFantasma();
  }, [tamano, redibujarFantasma]);

  useEffect(() => {
    puntosRef.current = [];
    setTieneTrazo(false);
    redibujarFantasma();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>): Punto => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const dibujarLinea = (a: Punto, b: Punto) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color.startsWith("var") ? "currentColor" : color;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    dibujando.current = true;
    const p = getPos(e);
    puntosRef.current = [p];
    setTieneTrazo(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current) return;
    const p = getPos(e);
    const anterior = puntosRef.current[puntosRef.current.length - 1];
    if (anterior) dibujarLinea(anterior, p);
    puntosRef.current.push(p);
  };

  const finalizarTrazo = () => {
    if (!dibujando.current) return;
    dibujando.current = false;
    if (puntosRef.current.length > 1) {
      onTrazoCompleto([...puntosRef.current]);
    }
  };

  const limpiar = () => {
    puntosRef.current = [];
    setTieneTrazo(false);
    redibujarFantasma();
  };

  return (
    <div ref={containerRef} className="w-full relative" style={{ color }}>
      <canvas
        ref={canvasRef}
        className="w-full rounded-xl border-2 border-dashed touch-none cursor-crosshair bg-primary/3"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 20%, transparent)",
          height,
          color,
        }}
        onPointerDown={onPointerDown}
        onPointerLeave={finalizarTrazo}
        onPointerMove={onPointerMove}
        onPointerUp={finalizarTrazo}
      />
      {tieneTrazo && (
        <button
          type="button"
          className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-bg-main/90 border border-primary/20 text-primary/50 hover:text-primary transition-all"
          onClick={limpiar}
        >
          <Eraser size={11} /> Borrar
        </button>
      )}
    </div>
  );
}
