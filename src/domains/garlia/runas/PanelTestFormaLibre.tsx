"use client";

/**
 * PanelTestFormaLibre.tsx
 * ──────────────────────────
 * Panel de prueba para el detector geométrico de forma+secciones
 * (deteccionFormaLibre.ts) — Parte 2 del plan, sub-problemas 1 y 2
 * únicamente (contorno + líneas radiales). Todavía NO interpreta
 * anillos (sub-problema 3, pendiente de umbrales propios).
 *
 * Deliberadamente separado de RunasDibujo.tsx: este panel es para
 * validar el reconocedor con dibujos reales antes de engancharlo al
 * flujo público real (que hoy sigue usando forma/rejilla fija — ver
 * RunasDibujo.tsx). Pensado para probarse a mano, en desktop y mobile,
 * y así calibrar los umbrales de deteccionFormaLibre.ts con casos
 * reales antes de seguir con anillos.
 *
 * No persiste nada — es una herramienta de desarrollo/calibración, no
 * una feature de cara al jugador todavía.
 *
 * Ruta destino (temporal, hasta integrarse a RunasDibujo.tsx):
 *   src/features/garliaPublic/runas/PanelTestFormaLibre.tsx
 */

import { RotateCcw, Sparkles } from "lucide-react";
import React, { useMemo, useState } from "react";

import { CanvasFormaLibre } from "./CanvasFormaLibre";
import { detectarFormaLibre, type FormaDetectada, type TrazoLibre } from "./deteccionFormaLibre";
import type { Punto } from "./dollarOneRecognizer";
import { labelForma } from "./formasLimite";

/** Colores distintos por rol, para que se vea claro en el overlay qué interpretó el detector de cada trazo. */
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
      {/* Centro estimado + radio, para que se vea claro qué "leyó" el detector */}
      <circle
        cx={resultado.centro.x}
        cy={resultado.centro.y}
        r={4}
        fill={COLOR_CONTORNO}
      />
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

export function PanelTestFormaLibre() {
  const [trazos, setTrazos] = useState<TrazoLibre[]>([]);
  const [resetSignal, setResetSignal] = useState(0);
  const [tamanoCanvas] = useState({ w: 400, h: 340 });

  const resultado: FormaDetectada | null = useMemo(() => detectarFormaLibre(trazos), [trazos]);

  const onTrazosChange = (nuevos: Punto[][]) => setTrazos(nuevos);

  return (
    <div className="space-y-4">
      <div className="relative">
        <CanvasFormaLibre
          height={tamanoCanvas.h}
          resetSignal={resetSignal}
          onTrazosChange={onTrazosChange}
        />
        <OverlayInterpretacion
          trazos={trazos}
          resultado={resultado}
          ancho={tamanoCanvas.w}
          alto={tamanoCanvas.h}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-micro">
          <span className="flex items-center gap-1 text-primary/50">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ background: COLOR_CONTORNO }}
            />
            Contorno
          </span>
          <span className="flex items-center gap-1 text-primary/50">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ background: COLOR_SECCION }}
            />
            Sección
          </span>
          <span className="flex items-center gap-1 text-primary/50">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ background: COLOR_IGNORADO }}
            />
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

      <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
        {resultado ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-micro font-black uppercase tracking-widest text-primary/50">
              <Sparkles size={12} /> Interpretación
            </div>
            <p className="text-sm text-primary font-semibold">
              {labelForma(resultado.forma)}
              {resultado.forma.tipo === "poligono" ? ` (${resultado.forma.lados} lados)` : ""}
              {" · "}
              {resultado.secciones === 1 ? "1 sección" : `${resultado.secciones} secciones`}
            </p>
            <p className="text-micro text-primary/40">
              Confianza: {Math.round(resultado.confianza * 100)}%
              {resultado.indicesIgnorados.length > 0 && (
                <> · {resultado.indicesIgnorados.length} trazo(s) sin interpretar</>
              )}
            </p>
          </div>
        ) : (
          <p className="text-micro text-primary/30 text-center py-2">
            Dibujá un contorno cerrado para empezar
          </p>
        )}
      </div>
    </div>
  );
}
