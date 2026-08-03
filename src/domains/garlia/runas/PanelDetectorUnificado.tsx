"use client";

/**
 * PanelDetectorUnificado.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Un solo dibujo, dos interpretaciones en paralelo:
 *   - dollarOneRecognizer: ¿el último trazo matchea alguna runa guardada?
 *   - deteccionFormaLibre: ¿el conjunto de trazos forma un contorno +
 *     líneas de sección?
 *
 * Reemplaza a los dos paneles separados (PanelTestReconocimiento +
 * PanelTestFormaLibre) — antes eran dos canvases/bloques distintos;
 * ahora comparten el mismo CanvasFormaLibre (multi-trazo) y cada
 * detector corre sobre esos mismos trazos.
 */

import { RotateCcw, ScrollText, Sparkles } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { CanvasFormaLibre } from "./CanvasFormaLibre";
import { detectarFormaLibre, type FormaDetectada, type TrazoLibre } from "./deteccionFormaLibre";
import {
  reconocerRuna,
  type PatronRuna,
  type Punto,
  type ResultadoReconocimiento,
} from "./dollarOneRecognizer";
import { labelForma } from "./formasLimite";
import type { EntidadMagica } from "./types";

const COLOR_CONTORNO = "#1e3a8a"; // azul oscuro
const COLOR_SECCION = "#38bdf8"; // celeste
const COLOR_IGNORADO = "#ef4444"; // rojo

function OverlayInterpretacion({
  trazos,
  resultado,
  ancho,
  alto,
}: {
  trazos: TrazoLibre[];
  resultado: FormaDetectada | null;
  ancho: number;
  alto: number;
}) {
  if (!resultado) return null;

  const colorDe = (indice: number): string => {
    if (indice === resultado.indiceContorno) return COLOR_CONTORNO;
    if (resultado.indicesSecciones.includes(indice)) return COLOR_SECCION;
    return COLOR_IGNORADO;
  };

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      viewBox={`0 0 ${ancho} ${alto}`}
      width={ancho}
      height={alto}
    >
      {trazos.map((trazo, i) => (
        <polyline
          key={i}
          points={trazo.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={colorDe(i)}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
      ))}
      <circle cx={resultado.centro.x} cy={resultado.centro.y} r={4} fill={COLOR_CONTORNO} />
      <circle
        cx={resultado.centro.x}
        cy={resultado.centro.y}
        r={resultado.radio}
        fill="none"
        stroke={COLOR_CONTORNO}
        strokeWidth={1}
        strokeDasharray="4 4"
        opacity={0.5}
      />
    </svg>
  );
}

/**
 * Panel lateral vertical: detector de Forma + detector de Runa, apilados.
 * Antes vivían en un grid 2 columnas debajo del canvas; ahora se muestran
 * al lado del canvas (que pasó a ser un cuadrado 1:1), en una sola columna
 * angosta.
 */
function PanelLateralDetectores({
  forma,
  patrones,
  resultadosRuna,
}: {
  forma: FormaDetectada | null;
  patrones: PatronRuna[];
  resultadosRuna: ResultadoReconocimiento[] | null;
}) {
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Interpretación de forma */}
      <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
        <div className="flex items-center gap-1.5 text-micro font-black uppercase tracking-widest text-primary/50 mb-1.5">
          <Sparkles size={12} /> Forma
        </div>
        {forma ? (
          <div className="flex flex-col gap-1">
            <p className="text-sm text-primary font-semibold">
              {labelForma(forma.forma)}
              {forma.forma.tipo === "poligono" ? ` (${forma.forma.lados} lados)` : ""}
              {" · "}
              {forma.secciones === 1 ? "1 sección" : `${forma.secciones} secciones`}
            </p>
            <p className="text-micro text-primary/40">
              Confianza: {Math.round(forma.confianza * 100)}%
              {forma.indicesIgnorados.length > 0 && (
                <> · {forma.indicesIgnorados.length} trazo(s) sin interpretar</>
              )}
            </p>
          </div>
        ) : (
          <p className="text-micro text-primary/30 py-2">Dibujá un contorno cerrado para empezar</p>
        )}
      </div>

      {/* Interpretación de runa */}
      <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 flex-1">
        <div className="flex items-center gap-1.5 text-micro font-black uppercase tracking-widest text-primary/50 mb-1.5">
          <ScrollText size={12} /> Runa (último trazo)
        </div>
        {patrones.length === 0 ? (
          <p className="text-micro text-primary/30 py-2">Sin patrones guardados para comparar.</p>
        ) : resultadosRuna && resultadosRuna.length > 0 ? (
          <div className="space-y-1">
            {resultadosRuna.slice(0, 3).map((r, idx) => (
              <div key={r.runaId} className="flex items-center gap-2 text-micro">
                <span className={`font-black w-4 shrink-0 ${idx === 0 ? "text-primary" : "text-primary/30"}`}>
                  {idx + 1}
                </span>
                <span className={`flex-1 truncate ${idx === 0 ? "font-bold text-primary" : "text-primary/50"}`}>
                  {r.nombre}
                </span>
                <span className="text-primary/30 shrink-0 tabular-nums">{Math.round(r.score * 100)}%</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-micro text-primary/30 py-2">Dibujá al menos un trazo para comparar.</p>
        )}
      </div>
    </div>
  );
}

export function PanelDetectorUnificado({ runas }: { runas: EntidadMagica[] }) {
  const [trazos, setTrazos] = useState<TrazoLibre[]>([]);
  const [resetSignal, setResetSignal] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [lado, setLado] = useState(340);

  // El canvas ocupa un cuadrado perfecto (1:1): el lado se recalcula
  // según el ancho disponible del contenedor.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => setLado(entries[0].contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const patrones: PatronRuna[] = useMemo(
    () =>
      runas
        .map((r) => ({
          runaId: r.id,
          nombre: r.nombre || "(sin nombre)",
          trazos: (r.patron_trazos as Punto[][]) ?? [],
        }))
        .filter((p) => p.trazos.length > 0),
    [runas],
  );

  const forma: FormaDetectada | null = useMemo(() => detectarFormaLibre(trazos), [trazos]);

  // El detector de runas compara contra el último trazo dibujado —
  // el gesto más reciente es el candidato natural a "esto es una runa".
  const resultadosRuna: ResultadoReconocimiento[] | null = useMemo(() => {
    const ultimo = trazos[trazos.length - 1];
    if (!ultimo || patrones.length === 0) return null;
    return reconocerRuna(ultimo, patrones);
  }, [trazos, patrones]);

  const onTrazosChange = (nuevos: Punto[][]) => setTrazos(nuevos);

  return (
    <div className="space-y-3">
      {/* Fila superior: canvas cuadrado 1:1 a la izquierda + panel lateral
          vertical (Forma + Runa) al lado. */}
      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <div ref={containerRef} className="relative w-full sm:w-1/2 aspect-square shrink-0">
          <CanvasFormaLibre height={lado} resetSignal={resetSignal} onTrazosChange={onTrazosChange} />
          <OverlayInterpretacion trazos={trazos} resultado={forma} ancho={lado} alto={lado} />
        </div>

        <div className="w-full sm:w-1/2 sm:self-stretch">
          <PanelLateralDetectores forma={forma} patrones={patrones} resultadosRuna={resultadosRuna} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-micro">
          <span className="flex items-center gap-1 text-primary/50">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COLOR_CONTORNO }} />
            Contorno
          </span>
          <span className="flex items-center gap-1 text-primary/50">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COLOR_SECCION }} />
            Sección
          </span>
          <span className="flex items-center gap-1 text-primary/50">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COLOR_IGNORADO }} />
            Ignorado
          </span>
        </div>
        <button
          type="button"
          onClick={() => setResetSignal((s) => s + 1)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-micro font-black uppercase tracking-widest bg-primary/10 hover:bg-primary/20 transition-colors text-primary"
        >
          <RotateCcw size={11} /> Reiniciar
        </button>
      </div>
    </div>
  );
}
