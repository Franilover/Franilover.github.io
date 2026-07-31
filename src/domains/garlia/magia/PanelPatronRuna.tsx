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
 * Mejoras sobre la versión original:
 *   - Galería de miniaturas de TODOS los ejemplos guardados (no solo el
 *     último), con click para usar cualquiera como plantilla fantasma.
 *   - Reordenar ejemplos (mover a la izquierda/derecha) y eliminar
 *     cualquiera, no solo el último.
 *   - Deshacer el borrado de un ejemplo (por si se eliminó sin querer).
 *   - Panel de auto-test: dibujar una prueba y ver el ranking de
 *     coincidencias contra el resto de las runas, para detectar
 *     ambigüedades antes de guardar.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/magia/PanelPatronRuna.tsx
 */

import {
  ChevronLeft,
  ChevronRight,
  PenTool,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";
import React, { useState } from "react";

import { CanvasDibujoRuna } from "./CanvasDibujoRuna";
import {
  normalizarTrazo,
  suavizarTrazo,
  type Punto,
} from "./dollarOneRecognizer";
import { trazoAPathSvg, TRAZO_THUMBNAIL_VIEWBOX } from "./trazoThumbnail";

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
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [ultimoBorrado, setUltimoBorrado] = useState<{
    trazo: Punto[];
    idx: number;
  } | null>(null);

  const idxFantasma = seleccionado ?? patronTrazos.length - 1;
  const trazoFantasma = patronTrazos[idxFantasma] ?? null;

  const agregarTrazo = (puntos: Punto[]) => {
    const suavizado = suavizarTrazo(puntos);
    onChange([...patronTrazos, suavizado]);
    setSeleccionado(null); // el nuevo (último) pasa a ser el fantasma
    setUltimoBorrado(null);
    setResetSignal((s) => s + 1);
  };

  const eliminarTrazo = (idx: number) => {
    setUltimoBorrado({ trazo: patronTrazos[idx], idx });
    onChange(patronTrazos.filter((_, i) => i !== idx));
    if (seleccionado === idx) setSeleccionado(null);
    else if (seleccionado !== null && seleccionado > idx)
      setSeleccionado(seleccionado - 1);
  };

  const deshacerBorrado = () => {
    if (!ultimoBorrado) return;
    const copia = [...patronTrazos];
    copia.splice(ultimoBorrado.idx, 0, ultimoBorrado.trazo);
    onChange(copia);
    setUltimoBorrado(null);
  };

  const mover = (idx: number, delta: number) => {
    const destino = idx + delta;
    if (destino < 0 || destino >= patronTrazos.length) return;
    const copia = [...patronTrazos];
    [copia[idx], copia[destino]] = [copia[destino], copia[idx]];
    onChange(copia);
    if (seleccionado === idx) setSeleccionado(destino);
    else if (seleccionado === destino) setSeleccionado(idx);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35 flex items-center gap-1.5">
          <PenTool size={11} /> Patrón de trazo ({patronTrazos.length} ejemplo
          {patronTrazos.length === 1 ? "" : "s"})
        </label>

        <CanvasDibujoRuna
          color={color}
          height={220}
          mostrarHerramientas
          resetSignal={resetSignal}
          trazoFantasma={trazoFantasma ? normalizarTrazo(trazoFantasma) : null}
          onTrazoCompleto={agregarTrazo}
        />

        {/* ── Galería de ejemplos guardados ──────────────────────────── */}
        {patronTrazos.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {patronTrazos.map((trazo, idx) => {
              const activo = idxFantasma === idx;
              return (
                <div
                  key={idx}
                  className="group relative flex flex-col items-center gap-1"
                >
                  <button
                    type="button"
                    className="w-14 h-14 rounded-lg border overflow-hidden transition-all"
                    style={{
                      borderColor: activo
                        ? "color-mix(in srgb, var(--primary) 60%, transparent)"
                        : "color-mix(in srgb, var(--primary) 12%, transparent)",
                      background: activo
                        ? "color-mix(in srgb, var(--primary) 8%, transparent)"
                        : "color-mix(in srgb, var(--primary) 3%, transparent)",
                    }}
                    title={`Usar ejemplo ${idx + 1} como guía`}
                    onClick={() => setSeleccionado(activo ? null : idx)}
                  >
                    <svg
                      viewBox={`0 0 ${TRAZO_THUMBNAIL_VIEWBOX} ${TRAZO_THUMBNAIL_VIEWBOX}`}
                      className="w-full h-full"
                    >
                      <path
                        d={trazoAPathSvg(trazo)}
                        fill="none"
                        stroke={activo ? "var(--primary)" : "currentColor"}
                        strokeOpacity={activo ? 1 : 0.4}
                        strokeWidth={6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ color }}
                      />
                    </svg>
                  </button>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      className="p-0.5 text-primary/25 hover:text-primary disabled:opacity-0 transition-colors"
                      title="Mover antes"
                      onClick={() => mover(idx, -1)}
                    >
                      <ChevronLeft size={10} />
                    </button>
                    <span className="text-micro font-bold text-primary/40 w-4 text-center">
                      {idx + 1}
                    </span>
                    <button
                      type="button"
                      disabled={idx === patronTrazos.length - 1}
                      className="p-0.5 text-primary/25 hover:text-primary disabled:opacity-0 transition-colors"
                      title="Mover después"
                      onClick={() => mover(idx, 1)}
                    >
                      <ChevronRight size={10} />
                    </button>
                    <button
                      type="button"
                      className="p-0.5 text-red-400/50 hover:text-red-400 transition-colors"
                      title="Eliminar ejemplo"
                      onClick={() => eliminarTrazo(idx)}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {patronTrazos.length === 0 && !ultimoBorrado && (
          <div className="flex items-center gap-1.5 text-micro text-primary/25 pt-1">
            <Plus size={10} /> Dibujá arriba para agregar el primer ejemplo
          </div>
        )}

        {ultimoBorrado && (
          <div className="flex items-center gap-1.5 text-micro text-primary/40 pt-1">
            <button
              type="button"
              className="flex items-center gap-1 font-black uppercase tracking-widest hover:text-primary transition-colors"
              onClick={deshacerBorrado}
            >
              <Undo2 size={10} /> Deshacer borrado del ejemplo{" "}
              {ultimoBorrado.idx + 1}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
