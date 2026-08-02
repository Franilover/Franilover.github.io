"use client";

/**
 * PanelPatronRuna.tsx
 * ──────────────────────
 * Panel de admin (dentro de FormularioMagico, modo="runas") donde se
 * dibuja el trazo de referencia que define visualmente la runa. Este
 * trazo es el que después el reconocedor $1 usa como plantilla para
 * comparar lo que dibuja el usuario en la página pública.
 *
 * Cada runa tiene un único trazo (no varios ejemplos): dibujar uno
 * nuevo reemplaza al anterior. El estado se guarda en memoria
 * (form.patron_trazos, como array de máximo 1 elemento por
 * compatibilidad con el formato que espera el reconocedor $1 y la
 * columna en DB) y se persiste recién al apretar "Guardar" en el
 * formulario padre.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/magia/PanelPatronRuna.tsx
 */

import { PenTool, Trash2, Undo2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { CanvasDibujoRuna } from "./CanvasDibujoRuna";
import type { Punto } from "./dollarOneRecognizer";

export function PanelPatronRuna({
  patronTrazos,
  onChange,
  color = "var(--primary)",
}: {
  /** Array de máximo 1 trazo — se mantiene como array por compatibilidad
   *  con el formato que usan el reconocedor $1 y la columna en DB. */
  patronTrazos: Punto[][];
  onChange: (trazos: Punto[][]) => void;
  color?: string;
}) {
  const [resetSignal, setResetSignal] = useState(0);
  const [ultimoBorrado, setUltimoBorrado] = useState<Punto[] | null>(null);
  // Medimos el ancho disponible para que el canvas sea siempre cuadrado
  // (antes tenía una altura fija de 220px sobre un ancho variable, dando
  // un rectángulo). El lado del cuadrado = ancho del contenedor.
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [lado, setLado] = useState(220);

  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setLado(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // El trazo que se le pasa a CanvasDibujoRuna para precargar como
  // confirmado. Arranca con lo que ya estaba guardado (al montar, o sea
  // al abrir esta runa) y solo se vuelve a tocar explícitamente en
  // "deshacer borrado" — nunca en cada trazo que el usuario dibuja,
  // porque eso pisaría lo que el canvas ya está mostrando con una copia
  // recalculada del mismo trazo.
  const [trazoParaPrecargar, setTrazoParaPrecargar] = useState<Punto[] | null>(
    patronTrazos[0] ?? null,
  );

  const trazoActual = patronTrazos[0] ?? null;

  const fijarTrazo = (puntos: Punto[]) => {
    onChange([puntos]);
    setUltimoBorrado(null);
  };

  const eliminarTrazo = () => {
    if (trazoActual) setUltimoBorrado(trazoActual);
    onChange([]);
    setResetSignal((s) => s + 1);
  };

  const deshacerBorrado = () => {
    if (!ultimoBorrado) return;
    onChange([ultimoBorrado]);
    // Como CanvasDibujoRuna ya se vació (por el resetSignal de
    // eliminarTrazo), hay que decirle explícitamente que vuelva a
    // mostrar este trazo como confirmado.
    setTrazoParaPrecargar(ultimoBorrado);
    setUltimoBorrado(null);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35 flex items-center gap-1.5">
          <PenTool size={11} /> Patrón de trazo
        </label>

        <div ref={contenedorRef}>
          <CanvasDibujoRuna
            color={color}
            height={lado}
            mostrarHerramientas
            resetSignal={resetSignal}
            trazoInicial={trazoParaPrecargar}
            onTrazoCompleto={fijarTrazo}
          />
        </div>

        {trazoActual && (
          <div className="flex items-center gap-1.5 text-micro text-primary/40 pt-1">
            <button
              type="button"
              className="flex items-center gap-1 font-black uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors"
              onClick={eliminarTrazo}
            >
              <Trash2 size={10} /> Borrar trazo
            </button>
            <span className="text-primary/20">·</span>
            <span className="text-primary/25">
              Dibujá de nuevo arriba para reemplazarlo
            </span>
          </div>
        )}

        {!trazoActual && !ultimoBorrado && (
          <div className="flex items-center gap-1.5 text-micro text-primary/25 pt-1">
            <PenTool size={10} /> Dibujá arriba el trazo de la runa
          </div>
        )}

        {ultimoBorrado && (
          <div className="flex items-center gap-1.5 text-micro text-primary/40 pt-1">
            <button
              type="button"
              className="flex items-center gap-1 font-black uppercase tracking-widest hover:text-primary transition-colors"
              onClick={deshacerBorrado}
            >
              <Undo2 size={10} /> Deshacer borrado
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
