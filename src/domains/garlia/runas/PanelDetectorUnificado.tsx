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

import { Eye, RotateCcw, ScrollText, Sparkles, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import { CanvasFormaLibre } from "./CanvasFormaLibre";
import { detectarFormaLibre, type FormaDetectada, type TrazoLibre } from "./deteccionFormaLibre";
import {
  reconocerRuna,
  type PatronRuna,
  type Punto,
  type ResultadoReconocimiento,
} from "./dollarOneRecognizer";
import { generarCeldas, labelForma } from "./formasLimite";
import { ResultadoDibujoCard, useResultadoDibujoLibre } from "./ResultadoDibujoLibre";
import type { TipoSeparador } from "./separadores";
import type { CombinacionRuna, EntidadMagica } from "./types";

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

export function PanelDetectorUnificado({
  runas,
  plantillasSeparadores,
}: {
  runas: EntidadMagica[];
  /** Plantillas custom de separador (configRunas.plantillas_separadores) — mismo pipeline que la página pública. */
  plantillasSeparadores?: Partial<Record<TipoSeparador, Punto[][]>> | null;
}) {
  const [trazos, setTrazos] = useState<TrazoLibre[]>([]);
  const [resetSignal, setResetSignal] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(400);
  const alto = 340;

  const [mostrarComoJugador, setMostrarComoJugador] = useState(false);
  const [combinaciones, setCombinaciones] = useState<CombinacionRuna[]>([]);

  // Se cargan una sola vez, al primer render — autocontenido para no tener
  // que enhebrar `combinaciones` por 3 niveles de componentes padre.
  useEffect(() => {
    let activo = true;
    void supabase
      .from("combinaciones_runas")
      .select("id, nombre, explicacion, imagen_url, forma, rejilla, celdas, separadores")
      .then(({ data, error }) => {
        if (!activo || error || !data) return;
        setCombinaciones(data as unknown as CombinacionRuna[]);
      });
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => setAncho(entries[0].contentRect.width));
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
  //
  // Filtramos trazos vacíos/degenerados (< 2 puntos) antes de tomar
  // "el último": si CanvasFormaLibre llega a emitir un trazo vacío al
  // reiniciar o al cancelar un gesto a mitad de camino (ej. el usuario
  // levanta el dedo sin mover el mouse), "el último trazo" pasaba a ser
  // ese trazo vacío y reconocerRuna comparaba contra basura en vez del
  // gesto real anterior. Tomar el último trazo *válido* es más robusto
  // sin cambiar el comportamiento en el caso normal.
  const resultadosRuna: ResultadoReconocimiento[] | null = useMemo(() => {
    const trazosValidos = trazos.filter((t) => t.length >= 2);
    const ultimo = trazosValidos[trazosValidos.length - 1];
    if (!ultimo || patrones.length === 0) return null;
    return reconocerRuna(ultimo, patrones);
  }, [trazos, patrones]);

  const onTrazosChange = (nuevos: Punto[][]) => setTrazos(nuevos);

  // Mismo pipeline que la página pública (interpretarDibujoLibre +
  // buscarCombinacion), corrido sobre los trazos actuales del panel de
  // test, "finalizado" fijo en true porque acá no hay paso de "terminar
  // dibujo": el admin quiere ver el resultado tal cual está en cada momento.
  const { interpretacion, combinacionEncontrada, cadenas } = useResultadoDibujoLibre({
    trazos,
    finalizado: true,
    runas,
    combinaciones,
    plantillasSeparadores: plantillasSeparadores ?? null,
  });

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="relative">
        <CanvasFormaLibre height={alto} resetSignal={resetSignal} onTrazosChange={onTrazosChange} />
        <OverlayInterpretacion trazos={trazos} resultado={forma} ancho={ancho} alto={alto} />

        <button
          type="button"
          onClick={() => setMostrarComoJugador(true)}
          disabled={!interpretacion}
          title="Ver el resultado exacto que vería el jugador"
          className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-micro font-black uppercase tracking-widest bg-bg-main/90 backdrop-blur-sm border border-primary/15 text-primary/60 hover:text-primary hover:border-primary/30 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Eye size={11} /> Ver como jugador
        </button>
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

      {mostrarComoJugador && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto relative">
            <button
              type="button"
              onClick={() => setMostrarComoJugador(false)}
              className="absolute -top-2 -right-2 z-10 p-1.5 rounded-full bg-white-custom border border-primary/15 text-primary/50 hover:text-primary transition-colors shadow-sm"
              title="Cerrar"
            >
              <X size={14} />
            </button>
            {interpretacion ? (
              <ResultadoDibujoCard
                cadenas={cadenas}
                celdas={generarCeldas(interpretacion.rejilla)}
                combinacion={combinacionEncontrada}
                interpretacion={interpretacion}
                rejilla={interpretacion.rejilla}
                onReintentar={() => setMostrarComoJugador(false)}
              />
            ) : (
              <div className="w-full rounded-2xl border border-primary/15 bg-white-custom p-5 shadow-md text-center">
                <p className="text-sm text-primary/40">Dibujá algo primero para ver el resultado.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
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
        <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
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
    </div>
  );
}
