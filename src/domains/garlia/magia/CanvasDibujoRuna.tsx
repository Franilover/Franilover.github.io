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
 * Si se pasa `forma`, además dibuja un marco guía (círculo o polígono
 * regular de N lados) centrado en el canvas, y el trazo del usuario
 * queda recortado (clampeado) para no poder salir de esa forma — es
 * un límite duro de dibujo, no afecta el reconocimiento en sí.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/magia/CanvasDibujoRuna.tsx
 */

import { Eraser, Minus, PenTool, Redo2 } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { suavizarTrazo, type Punto } from "./dollarOneRecognizer";
import { clampAForma, verticesPoligono, type FormaLimite } from "./formasLimite";

type Herramienta = "libre" | "recta";

/** Ángulo de snap más cercano, en incrementos de 45° (0°, 45°, 90°…). */
function snapAngulo(dx: number, dy: number): { x: number; y: number } {
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return { x: 0, y: 0 };
  const anguloRad = Math.atan2(dy, dx);
  const pasoRad = Math.PI / 4; // 45°
  const anguloSnap = Math.round(anguloRad / pasoRad) * pasoRad;
  return { x: Math.cos(anguloSnap) * dist, y: Math.sin(anguloSnap) * dist };
}

export function CanvasDibujoRuna({
  color = "var(--primary)",
  trazoFantasma,
  onTrazoCompleto,
  height = 260,
  resetSignal,
  forma,
  mostrarHerramientas = false,
}: {
  color?: string;
  /** Trazo ya normalizado que se dibuja tenue de fondo, como referencia */
  trazoFantasma?: Punto[] | null;
  onTrazoCompleto: (puntos: Punto[]) => void;
  height?: number;
  /** Cambiando este valor desde afuera se limpia el canvas */
  resetSignal?: number;
  /** Marco guía + límite duro de dibujo. Si no se pasa, no hay restricción. */
  forma?: FormaLimite | null;
  /** Muestra el selector de herramienta (mano alzada / línea recta) —
   *  pensado para el editor admin, donde interesa precisión al grabar
   *  el patrón. Los demás usos (probador, público) quedan en mano alzada. */
  mostrarHerramientas?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dibujando = useRef(false);
  const puntosRef = useRef<Punto[]>([]);
  const [tieneTrazo, setTieneTrazo] = useState(false);
  const [numPuntos, setNumPuntos] = useState(0);
  const [tamano, setTamano] = useState({ w: 320, h: height });
  const [herramienta, setHerramienta] = useState<Herramienta>("libre");
  // Punto inicial del segmento recto en curso (mientras se arrastra).
  const inicioRectaRef = useRef<Punto | null>(null);
  const [previewRecta, setPreviewRecta] = useState<{ a: Punto; b: Punto } | null>(null);
  const snapDesactivadoRef = useRef(false);

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

  // Centro y radio del marco guía, en coordenadas CSS (no de dispositivo).
  const centroYRadio = useCallback(() => {
    const margen = 24;
    const cx = tamano.w / 2;
    const cy = tamano.h / 2;
    const radio = Math.max(20, Math.min(tamano.w, tamano.h) / 2 - margen);
    return { centro: { x: cx, y: cy }, radio };
  }, [tamano]);

  const dibujarMarcoForma = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!forma) return;
      const { centro, radio } = centroYRadio();
      ctx.beginPath();
      if (forma.tipo === "circulo") {
        ctx.arc(centro.x, centro.y, radio, 0, Math.PI * 2);
      } else {
        const vertices = verticesPoligono(forma.lados, centro, radio);
        vertices.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
      }
      ctx.strokeStyle = "color-mix(in srgb, var(--primary) 30%, transparent)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    },
    [forma, centroYRadio],
  );

  const redibujarFondo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    dibujarMarcoForma(ctx);

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
  }, [trazoFantasma, dibujarMarcoForma]);

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
    redibujarFondo();
  }, [tamano, redibujarFondo]);

  useEffect(() => {
    puntosRef.current = [];
    setTieneTrazo(false);
    setNumPuntos(0);
    redibujarFondo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  // Si cambia la forma elegida (ej. el jugador pasa de círculo a
  // triángulo) sin haber dibujado nada, solo hace falta redibujar el
  // marco — no tiene sentido borrar un trazo que no existe, pero
  // tampoco dejar el marco viejo dibujado.
  useEffect(() => {
    if (!tieneTrazo) redibujarFondo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forma]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>): Punto => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const raw = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (!forma) return raw;
    const { centro, radio } = centroYRadio();
    return clampAForma(raw, forma, centro, radio);
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

  const dibujarTrazoConfirmado = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const puntos = puntosRef.current;
    if (puntos.length < 2) return;
    ctx.beginPath();
    puntos.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = color.startsWith("var") ? "currentColor" : color;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }, [color]);

  const redibujarTodo = useCallback(() => {
    redibujarFondo();
    dibujarTrazoConfirmado();
  }, [redibujarFondo, dibujarTrazoConfirmado]);

  // ── Modo mano alzada (comportamiento original) ─────────────────────────
  const onPointerDownLibre = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    dibujando.current = true;
    const p = getPos(e);
    puntosRef.current = [p];
    setTieneTrazo(true);
    setNumPuntos(1);
  };

  const onPointerMoveLibre = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current) return;
    const p = getPos(e);
    const anterior = puntosRef.current[puntosRef.current.length - 1];
    if (anterior) dibujarLinea(anterior, p);
    puntosRef.current.push(p);
    setNumPuntos(puntosRef.current.length);
  };

  const finalizarTrazoLibre = () => {
    if (!dibujando.current) return;
    dibujando.current = false;
    if (puntosRef.current.length > 1) {
      // El suavizado (media móvil) solo tiene sentido para mano alzada:
      // promedia puntos vecinos para limar el temblor del gesto. Aplicado
      // a un trazo de líneas rectas, en cambio, "limaría" los vértices
      // (las esquinas exactas entre segmentos) y deformaría la figura —
      // por eso el modo recta nunca pasa por acá.
      onTrazoCompleto(suavizarTrazo([...puntosRef.current]));
    }
  };

  // ── Modo línea recta: cada gesto agrega un segmento recto (con snap a
  // 0°/45°/90°…) encadenado al punto final del segmento anterior — así se
  // puede armar una runa poligonal (ej. un rayo, una "Z", una cruz) con
  // varios trazos rectos consecutivos sin perder precisión a mano alzada.
  // Mantener Shift apretado desactiva el snap para ese segmento.
  const onPointerDownRecta = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    dibujando.current = true;
    snapDesactivadoRef.current = e.shiftKey;
    const origen =
      puntosRef.current.length > 0
        ? puntosRef.current[puntosRef.current.length - 1]
        : getPos(e);
    inicioRectaRef.current = origen;
    if (puntosRef.current.length === 0) {
      puntosRef.current = [origen];
      setNumPuntos(1);
    }
    setTieneTrazo(true);
    setPreviewRecta({ a: origen, b: origen });
  };

  const onPointerMoveRecta = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current || !inicioRectaRef.current) return;
    snapDesactivadoRef.current = e.shiftKey;
    const actual = getPos(e);
    const inicio = inicioRectaRef.current;
    let destino = actual;
    if (!snapDesactivadoRef.current) {
      const ajustado = snapAngulo(actual.x - inicio.x, actual.y - inicio.y);
      destino = { x: inicio.x + ajustado.x, y: inicio.y + ajustado.y };
    }
    setPreviewRecta({ a: inicio, b: destino });
  };

  const finalizarTrazoRecta = () => {
    if (!dibujando.current || !inicioRectaRef.current || !previewRecta) {
      dibujando.current = false;
      return;
    }
    dibujando.current = false;
    const { a, b } = previewRecta;
    // Segmento demasiado corto (click sin arrastre): lo ignoramos.
    if (Math.hypot(b.x - a.x, b.y - a.y) < 2) {
      setPreviewRecta(null);
      inicioRectaRef.current = null;
      return;
    }
    if (puntosRef.current.length === 0) puntosRef.current = [a];
    puntosRef.current.push(b);
    setNumPuntos(puntosRef.current.length);
    redibujarTodo();
    setPreviewRecta(null);
    inicioRectaRef.current = null;
  };

  // Redibuja fondo + trazo confirmado + segmento en preview mientras se
  // arrastra una línea recta.
  useEffect(() => {
    if (herramienta !== "recta") return;
    redibujarFondo();
    dibujarTrazoConfirmado();
    if (previewRecta) dibujarLinea(previewRecta.a, previewRecta.b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewRecta]);

  const onPointerDown =
    herramienta === "recta" ? onPointerDownRecta : onPointerDownLibre;
  const onPointerMove =
    herramienta === "recta" ? onPointerMoveRecta : onPointerMoveLibre;
  const finalizarTrazo =
    herramienta === "recta" ? finalizarTrazoRecta : finalizarTrazoLibre;

  const confirmarTrazoRecta = () => {
    if (puntosRef.current.length < 2) return;
    onTrazoCompleto([...puntosRef.current]);
  };

  const deshacerUltimoSegmento = () => {
    if (puntosRef.current.length <= 1) {
      limpiar();
      return;
    }
    puntosRef.current = puntosRef.current.slice(0, -1);
    setNumPuntos(puntosRef.current.length);
    redibujarTodo();
  };

  const cambiarHerramienta = (h: Herramienta) => {
    setHerramienta(h);
    dibujando.current = false;
    inicioRectaRef.current = null;
    setPreviewRecta(null);
  };

  const limpiar = () => {
    puntosRef.current = [];
    setTieneTrazo(false);
    setNumPuntos(0);
    setPreviewRecta(null);
    inicioRectaRef.current = null;
    redibujarFondo();
  };

  return (
    <div ref={containerRef} className="w-full relative" style={{ color }}>
      {mostrarHerramientas && (
        <div className="flex items-center gap-1 mb-2">
          <button
            type="button"
            title="Mano alzada"
            onClick={() => cambiarHerramienta("libre")}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest border transition-all"
            style={{
              borderColor:
                herramienta === "libre"
                  ? "color-mix(in srgb, var(--primary) 40%, transparent)"
                  : "color-mix(in srgb, var(--primary) 12%, transparent)",
              background:
                herramienta === "libre"
                  ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                  : "transparent",
              color:
                herramienta === "libre"
                  ? "var(--primary)"
                  : "color-mix(in srgb, var(--primary) 50%, transparent)",
            }}
          >
            <PenTool size={11} /> Mano alzada
          </button>
          <button
            type="button"
            title="Línea recta (con snap a 0°/45°/90°… — mantené Shift para dibujar libre)"
            onClick={() => cambiarHerramienta("recta")}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest border transition-all"
            style={{
              borderColor:
                herramienta === "recta"
                  ? "color-mix(in srgb, var(--primary) 40%, transparent)"
                  : "color-mix(in srgb, var(--primary) 12%, transparent)",
              background:
                herramienta === "recta"
                  ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                  : "transparent",
              color:
                herramienta === "recta"
                  ? "var(--primary)"
                  : "color-mix(in srgb, var(--primary) 50%, transparent)",
            }}
          >
            <Minus size={11} /> Línea recta
          </button>
        </div>
      )}

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

      {herramienta === "recta" && mostrarHerramientas && tieneTrazo && (
        <p className="text-micro text-primary/30 mt-1.5 leading-relaxed">
          Arrastrá para trazar cada segmento — se encadena al anterior.
          Mantené Shift para desactivar el ajuste a ángulos. Confirmá cuando
          termines.
        </p>
      )}

      <div className="absolute top-2 right-2 flex items-center gap-1">
        {herramienta === "recta" && mostrarHerramientas && tieneTrazo && numPuntos > 1 && (
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-bg-main/90 border border-primary/20 text-primary/50 hover:text-primary transition-all"
            onClick={deshacerUltimoSegmento}
            title="Deshacer último segmento"
          >
            <Redo2 size={11} className="scale-x-[-1]" /> Deshacer
          </button>
        )}
        {tieneTrazo && (
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-bg-main/90 border border-primary/20 text-primary/50 hover:text-primary transition-all"
            onClick={limpiar}
          >
            <Eraser size={11} /> Borrar
          </button>
        )}
      </div>

      {herramienta === "recta" && mostrarHerramientas && tieneTrazo && numPuntos > 1 && (
        <button
          type="button"
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all"
          onClick={confirmarTrazoRecta}
        >
          Confirmar trazo
        </button>
      )}
    </div>
  );
}
