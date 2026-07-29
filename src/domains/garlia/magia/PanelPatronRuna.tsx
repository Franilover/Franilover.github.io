"use client";

/**
 * PanelPatronRuna.tsx
 * ──────────────────────
 * Panel de admin (dentro de FormularioMagico, modo="runas") donde se
 * dibuja el/los trazo(s) de referencia que definen visualmente la runa.
 * Estos trazos son los que después el reconocedor $1 usa como plantilla
 * para comparar lo que dibuja el usuario en la página pública.
 *
 * Se pueden grabar varios ejemplos por runa (distintas variantes de
 * cómo se puede dibujar el mismo símbolo) para mejorar el reconocimiento.
 * El estado se guarda en memoria (form.patron_trazos) y se persiste
 * recién al apretar "Guardar" en el formulario padre.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/magia/PanelPatronRuna.tsx
 */

import { PenTool, Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";

import { CanvasDibujoRuna } from "./CanvasDibujoRuna";
import { normalizarTrazo, suavizarTrazo, type Punto } from "./dollarOneRecognizer";

export function PanelPatronRuna({
  patronTrazos,
  onChange,
  color = "var(--primary)",
}: {
  patronTrazos: Punto[][];
  onChange: (trazos: Punto[][]) => void;
  color?: string;
}) {
  const [resetSignal, setResetSignal] = useState(0);
  const trazoSeleccionado = patronTrazos[patronTrazos.length - 1] ?? null;

  const agregarTrazo = (puntos: Punto[]) => {
    const suavizado = suavizarTrazo(puntos);
    onChange([...patronTrazos, suavizado]);
    setResetSignal((s) => s + 1);
  };

  const eliminarTrazo = (idx: number) => {
    onChange(patronTrazos.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35 flex items-center gap-1.5">
        <PenTool size={11} /> Patrón de trazo ({patronTrazos.length} ejemplo
        {patronTrazos.length === 1 ? "" : "s"})
      </label>
      <p className="text-micro text-primary/30 leading-relaxed">
        Dibujá cómo se traza esta runa. Podés grabar varios ejemplos (distintas
        formas válidas de dibujarla) para que el reconocimiento sea más flexible.
      </p>

      <CanvasDibujoRuna
        color={color}
        height={220}
        resetSignal={resetSignal}
        trazoFantasma={trazoSeleccionado ? normalizarTrazo(trazoSeleccionado) : null}
        onTrazoCompleto={agregarTrazo}
      />

      {patronTrazos.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {patronTrazos.map((_, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-micro font-bold border border-primary/15 text-primary/50 bg-primary/5"
            >
              <PenTool size={10} />
              Ejemplo {idx + 1}
              <button
                type="button"
                className="text-red-400/60 hover:text-red-400 transition-colors"
                onClick={() => eliminarTrazo(idx)}
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {patronTrazos.length === 0 && (
        <div className="flex items-center gap-1.5 text-micro text-primary/25 pt-1">
          <Plus size={10} /> Dibujá arriba para agregar el primer ejemplo
        </div>
      )}
    </div>
  );
}
