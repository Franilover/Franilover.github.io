"use client";

/**
 * ResultadoDibujoLibre.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Lógica + UI de "resultado final" del dibujo libre, extraída de
 * RunasDibujo.tsx (público) para que admin (PanelDetectorUnificado, botón
 * "Ver como jugador") pueda mostrar EXACTAMENTE lo mismo que ve el jugador,
 * sin duplicar código que después se desincroniza.
 *
 * Expone:
 *   - useResultadoDibujoLibre: hook que corre el mismo pipeline que la
 *     página pública (interpretarDibujoLibre + buscarCombinacion + cadenas).
 *   - ResultadoDibujoCard: la tarjeta visual (nombre, imagen, descripción).
 *   - PistaInterpretacion: el feedback en vivo mientras se dibuja.
 */

import { PlainMarkdownPreview } from "@/editor/lexical";
import Image from "next/image";

import { armarTodasLasCadenas, type Cadena } from "./cadenasSeparadores";
import type { TrazoLibre } from "./deteccionFormaLibre";
import { labelForma, labelCelda, generarCeldas, generarGaps, type Celda, type Rejilla } from "./formasLimite";
import {
  interpretarDibujoLibre,
  type InterpretacionDibujoLibre,
  type ResultadoCelda,
} from "./interpretarDibujoLibre";
import { buscarCombinacion } from "./matchCombinacion";
import { RunaThumbnail } from "./RunaThumbnail";
import type { CombinacionRuna, EntidadMagica } from "./types";
import type { TipoSeparador } from "./separadores";
import type { Punto } from "./dollarOneRecognizer";
import { useMemo } from "react";

/**
 * Corre el mismo pipeline que RunasDibujo.tsx (público) sobre un conjunto
 * de trazos ya finalizado: interpretación geométrica + match contra el
 * catálogo de combinaciones + armado de cadenas de separadores.
 */
export function useResultadoDibujoLibre({
  trazos,
  finalizado,
  runas,
  combinaciones,
  plantillasSeparadores,
}: {
  trazos: TrazoLibre[];
  finalizado: boolean;
  runas: EntidadMagica[];
  combinaciones: CombinacionRuna[];
  plantillasSeparadores: Partial<Record<TipoSeparador, Punto[][]>> | null;
}) {
  const interpretacion: InterpretacionDibujoLibre | null = useMemo(() => {
    if (trazos.length === 0) return null;
    return interpretarDibujoLibre(trazos, runas, plantillasSeparadores);
  }, [trazos, runas, plantillasSeparadores]);

  const combinacionEncontrada = useMemo(() => {
    if (!finalizado || !interpretacion) return null;
    return buscarCombinacion(
      interpretacion.celdaRunaId,
      combinaciones,
      interpretacion.separadorPorGap,
      { forma: interpretacion.forma, rejilla: interpretacion.rejilla },
    );
  }, [finalizado, interpretacion, combinaciones]);

  const cadenas: Cadena[] = useMemo(() => {
    if (!finalizado || !interpretacion || interpretacion.rejilla.secciones <= 1) return [];
    const celdas = generarCeldas(interpretacion.rejilla);
    const gaps = generarGaps(interpretacion.rejilla);
    return armarTodasLasCadenas(interpretacion.rejilla, celdas, gaps, interpretacion.separadorPorGap);
  }, [finalizado, interpretacion]);

  const hayAlgoReconocido =
    interpretacion !== null && Object.keys(interpretacion.celdaRunaId).length > 0;

  return { interpretacion, combinacionEncontrada, cadenas, hayAlgoReconocido };
}

/**
 * Feedback en vivo mientras se dibuja: qué forma se está leyendo y cuántas
 * runas/separadores ya se reconocieron. No bloquea ni corrige nada.
 */
export function PistaInterpretacion({
  interpretacion,
  trazos,
}: {
  interpretacion: InterpretacionDibujoLibre | null;
  trazos: TrazoLibre[];
}) {
  if (trazos.length === 0) return null;
  if (!interpretacion) {
    return (
      <p className="text-micro text-primary/30 text-center">
        Dibujá un contorno cerrado para que el sistema identifique la forma
      </p>
    );
  }
  const celdasReconocidas = Object.values(interpretacion.resultadosPorCelda).filter(
    (r) => r.mejorMatch,
  ).length;
  const celdasCasi = Object.values(interpretacion.resultadosPorCelda).filter(
    (r) => !r.mejorMatch && r.casi,
  ).length;
  const gapsReconocidos = Object.values(interpretacion.resultadosPorGap).filter(
    (r) => r.tipo,
  ).length;
  return (
    <p className="text-micro text-primary/40 text-center">
      {labelForma(interpretacion.forma)}
      {interpretacion.rejilla.secciones > 1
        ? ` · ${interpretacion.rejilla.secciones} secciones`
        : ""}
      {celdasReconocidas > 0 &&
        ` · ${celdasReconocidas} runa${celdasReconocidas === 1 ? "" : "s"} reconocida${celdasReconocidas === 1 ? "" : "s"}`}
      {celdasCasi > 0 && (
        <span className="text-amber-600">
          {" "}
          · {celdasCasi} cerca (mejorá el trazo)
        </span>
      )}
      {gapsReconocidos > 0 &&
        ` · ${gapsReconocidos} separador${gapsReconocidos === 1 ? "" : "es"}`}
    </p>
  );
}

/**
 * La tarjeta de resultado final: EXACTAMENTE lo que ve el jugador —
 * nombre, imagen y descripción del hechizo compuesto encontrado (o de la
 * runa única, o las runas sueltas reconocidas si no hay combinación).
 */
export function ResultadoDibujoCard({
  combinacion,
  interpretacion,
  rejilla,
  celdas,
  cadenas,
  onReintentar,
}: {
  combinacion: CombinacionRuna | null;
  interpretacion: InterpretacionDibujoLibre;
  rejilla: Rejilla;
  celdas: Celda[];
  cadenas: Cadena[];
  onReintentar: () => void;
}) {
  const resultadosPorCelda: Record<string, ResultadoCelda> = interpretacion.resultadosPorCelda;
  const celdasConRuna = celdas.filter((c) => resultadosPorCelda[c.id]?.mejorMatch);
  const celdasCasi = celdas.filter(
    (c) => !resultadosPorCelda[c.id]?.mejorMatch && resultadosPorCelda[c.id]?.casi,
  );

  const idsEnCadena = new Set(cadenas.flatMap((c) => c.celdaIds));
  const celdasSueltas = celdasConRuna.filter((c) => !idsEnCadena.has(c.id));

  const esRunaUnica = rejilla.secciones <= 1 && celdas.length === 1;
  const runaUnica = esRunaUnica ? (resultadosPorCelda[celdas[0].id]?.mejorMatch ?? null) : null;
  const rankingUnico = esRunaUnica ? (resultadosPorCelda[celdas[0].id]?.ranking ?? []) : [];
  const casiUnica = esRunaUnica ? (resultadosPorCelda[celdas[0].id]?.casi ?? false) : false;

  if (esRunaUnica && !combinacion) {
    return (
      <div className="w-full rounded-2xl border border-primary/15 bg-white-custom p-5 shadow-md flex flex-col items-center gap-3 text-center animate-[fadeIn_0.2s_ease]">
        {runaUnica ? (
          <>
            <div className="flex items-center gap-1.5 text-micro font-black uppercase tracking-[0.3em] text-primary/40">
              Runa reconocida
            </div>
            <div className="w-24 h-24 rounded-xl overflow-hidden border border-primary/10 bg-primary/3 flex items-center justify-center">
              <RunaThumbnail patronTrazos={runaUnica.patron_trazos} />
            </div>
            <h2 className="text-lg font-black text-primary">{runaUnica.nombre}</h2>
            {runaUnica.explicacion && (
              <div className="text-sm text-primary/60 text-left max-h-40 overflow-y-auto w-full">
                <PlainMarkdownPreview value={runaUnica.explicacion} />
              </div>
            )}
          </>
        ) : casiUnica ? (
          <>
            <p className="text-sm font-bold text-amber-600">Estás cerca…</p>
            <p className="text-micro text-primary/40">
              Hay una runa con esa forma
              {rankingUnico[0] ? ` ("${rankingUnico[0].nombre}")` : ""}, pero tenés que mejorar tu
              trazo.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-primary/50">
              No se reconoció ninguna runa conocida
            </p>
            <p className="text-micro text-primary/30">
              {rankingUnico[0]
                ? `Lo más parecido fue "${rankingUnico[0].nombre}", pero no lo suficiente.`
                : "Intentá trazar el símbolo con más cuidado."}
            </p>
          </>
        )}
        <button
          type="button"
          className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-xl text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
          onClick={onReintentar}
        >
          Intentar de nuevo
        </button>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-primary/15 bg-white-custom p-5 shadow-md flex flex-col items-center gap-3 text-center animate-[fadeIn_0.2s_ease]">
      {combinacion ? (
        <>
          <div className="flex items-center gap-1.5 text-micro font-black uppercase tracking-[0.3em] text-primary/40">
            ¡Hechizo compuesto!
          </div>
          {combinacion.imagen_url && (
            <div className="w-24 h-24 rounded-xl overflow-hidden border border-primary/10 bg-primary/3">
              <Image
                alt={combinacion.nombre}
                className="w-full h-full object-cover"
                height={96}
                src={combinacion.imagen_url}
                width={96}
              />
            </div>
          )}
          <h2 className="text-lg font-black text-primary">{combinacion.nombre}</h2>
          {combinacion.explicacion && (
            <div className="text-sm text-primary/60 text-left max-h-40 overflow-y-auto w-full">
              <PlainMarkdownPreview value={combinacion.explicacion} />
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-sm font-bold text-primary/50">
            {celdasConRuna.length === 0
              ? "No se reconoció ninguna runa en el dibujo"
              : "No hay un hechizo compuesto para esta combinación, pero se reconocieron estas runas:"}
          </p>
        </>
      )}

      {!combinacion && cadenas.length > 0 && (
        <div className="w-full flex flex-col gap-2 text-left">
          {cadenas.map((cadena, i) => {
            const nombresRunas = cadena.celdaIds
              .map((id) => resultadosPorCelda[id]?.mejorMatch?.nombre)
              .filter((n): n is string => Boolean(n));
            return (
              <div
                key={cadena.celdaInicioId}
                className="flex flex-col gap-1 px-3 py-2 rounded-lg bg-primary/5"
              >
                <span className="text-micro font-black uppercase tracking-widest text-primary/30">
                  Secuencia {i + 1}
                </span>
                <span className="text-sm text-primary font-semibold">
                  {nombresRunas.length > 0
                    ? nombresRunas.join(" → ")
                    : "(sin runas dibujadas en esta cadena)"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!combinacion && celdasSueltas.length > 0 && (
        <div className="w-full flex flex-col gap-1.5 text-left">
          {cadenas.length > 0 && (
            <span className="text-micro font-black uppercase tracking-widest text-primary/30">
              Runas sueltas
            </span>
          )}
          {celdasSueltas.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-primary/5 text-xs"
            >
              <span className="text-primary/40 font-bold">{labelCelda(c, rejilla)}</span>
              <span className="text-primary font-semibold">
                {resultadosPorCelda[c.id].mejorMatch!.nombre}
              </span>
            </div>
          ))}
        </div>
      )}

      {!combinacion && celdasCasi.length > 0 && (
        <div className="w-full flex flex-col gap-1.5 text-left">
          <span className="text-micro font-black uppercase tracking-widest text-amber-600/70">
            Estás cerca…
          </span>
          {celdasCasi.map((c) => {
            const top = resultadosPorCelda[c.id]?.ranking[0];
            return (
              <div
                key={c.id}
                className="flex flex-col gap-0.5 px-3 py-1.5 rounded-lg bg-amber-500/5 text-xs"
              >
                <span className="text-primary/40 font-bold">{labelCelda(c, rejilla)}</span>
                <span className="text-primary/60">
                  Hay una runa con esa forma
                  {top ? ` ("${top.nombre}")` : ""}, pero tenés que mejorar tu trazo.
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-xl text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
        onClick={onReintentar}
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
