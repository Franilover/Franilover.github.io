"use client";

/**
 * RunasDibujo.tsx (público)
 * ────────────────────────────────────────────────────────────────────
 * /garlia/runas — el usuario dibuja un trazo en un canvas y el sistema
 * intenta reconocer cuál de las runas definidas en el mundo dibujó,
 * usando el algoritmo $1 Unistroke Recognizer contra los patrones que
 * el admin grabó en el editor (PanelPatronRuna).
 *
 * Además del modo simple (un solo dibujo), el jugador puede dividir el
 * tablero en celdas (secciones × anillos) y dibujar una runa distinta
 * en cada una — ver TableroCeldas.tsx y SelectorRejilla.tsx. Al terminar,
 * se evalúan todas las celdas dibujadas: si coinciden exactamente con
 * una combinación definida en admin (matchCombinacion.ts), se muestra
 * el resultado compuesto; si no, se muestra la lista de runas
 * individuales reconocidas por celda.
 *
 * Si el mejor match de una celda supera un umbral de confianza, se
 * cuenta como "reconocida". Si no, se invita a intentar de nuevo.
 *
 * Ruta destino:
 *   src/features/garliaPublic/runas/RunasDibujo.tsx
 */

import { ArrowLeft, Loader2, ScrollText, Sparkles, Wand2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { useMemo, useState } from "react";

import { PlainMarkdownPreview } from "@/editor/lexical";
import { supabase } from "@/infra/supabase/supabase";

import { CanvasDibujoRuna } from "../CanvasDibujoRuna";
import {
  reconocerRuna,
  type PatronRuna,
  type Punto,
  type ResultadoReconocimiento,
} from "../dollarOneRecognizer";
import {
  esRejillaSimple,
  FORMA_CIRCULO,
  generarCeldas,
  labelCelda,
  REJILLA_SIMPLE,
  type Celda,
  type FormaLimite,
  type Rejilla,
} from "../formasLimite";
import { buscarCombinacion } from "../matchCombinacion";
import type { CombinacionRuna, EntidadMagica } from "../types";

import { SelectorFormaLimite } from "./SelectorFormaLimite";
import { SelectorRejilla } from "./SelectorRejilla";
import { TableroCeldas } from "./TableroCeldas";

// Por debajo de este score no se considera un match confiable: se anima
// al usuario a intentar de nuevo en vez de mostrarle un resultado dudoso.
const UMBRAL_CONFIANZA = 0.72;

type Estado = "cargando" | "listo" | "sin-runas";

/** Resultado de reconocimiento guardado por celda. */
type ResultadoCelda = {
  ranking: ResultadoReconocimiento[];
  mejorMatch: EntidadMagica | null;
};

export default function RunasDibujo() {
  const [runas, setRunas] = useState<EntidadMagica[]>([]);
  const [combinaciones, setCombinaciones] = useState<CombinacionRuna[]>([]);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [forma, setForma] = useState<FormaLimite>(FORMA_CIRCULO);
  const [rejilla, setRejilla] = useState<Rejilla>(REJILLA_SIMPLE);

  // Modo simple (1×1): un solo resultado, igual que antes.
  const [resultadoSimple, setResultadoSimple] = useState<
    ResultadoReconocimiento[] | null
  >(null);

  // Modo rejilla: resultado por celda + cuál está activa para dibujar.
  const [resultadosPorCelda, setResultadosPorCelda] = useState<
    Record<string, ResultadoCelda>
  >({});
  const [celdaActivaId, setCeldaActivaId] = useState<string | null>(null);
  const [finalizado, setFinalizado] = useState(false);

  const [resetSignal, setResetSignal] = useState(0);
  const [intentos, setIntentos] = useState(0);

  React.useEffect(() => {
    let activo = true;
    void Promise.all([
      supabase
        .from("runas")
        .select("id, nombre, explicacion, imagen_url, patron_trazos"),
      supabase
        .from("combinaciones_runas")
        .select("id, nombre, explicacion, imagen_url, celdas"),
    ]).then(([runasRes, comboRes]) => {
      if (!activo) return;
      if (runasRes.error || !runasRes.data) {
        setEstado("sin-runas");
        return;
      }
      const conPatron = (runasRes.data as unknown as EntidadMagica[]).filter(
        (r) => r.patron_trazos && r.patron_trazos.length > 0,
      );
      setRunas(conPatron);
      if (!comboRes.error && comboRes.data) {
        setCombinaciones(comboRes.data as unknown as CombinacionRuna[]);
      }
      setEstado(conPatron.length > 0 ? "listo" : "sin-runas");
    });
    return () => {
      activo = false;
    };
  }, []);

  const patrones: PatronRuna[] = useMemo(
    () =>
      runas.map((r) => ({
        runaId: r.id,
        nombre: r.nombre,
        trazos: r.patron_trazos ?? [],
      })),
    [runas],
  );

  const simple = esRejillaSimple(rejilla);
  const celdas = useMemo(() => generarCeldas(rejilla), [rejilla]);

  // ── Modo simple ──────────────────────────────────────────────────────
  const mejorMatchSimple: EntidadMagica | null = useMemo(() => {
    if (!resultadoSimple || resultadoSimple.length === 0) return null;
    const top = resultadoSimple[0];
    if (top.score < UMBRAL_CONFIANZA) return null;
    return runas.find((r) => r.id === top.runaId) ?? null;
  }, [resultadoSimple, runas]);

  const onTrazoCompletoSimple = (puntos: Punto[]) => {
    const ranking = reconocerRuna(puntos, patrones);
    setResultadoSimple(ranking);
    setIntentos((n) => n + 1);
  };

  const reintentarSimple = () => {
    setResultadoSimple(null);
    setResetSignal((s) => s + 1);
  };

  // ── Modo rejilla ─────────────────────────────────────────────────────
  const onTrazoCompletoCelda = (puntos: Punto[]) => {
    if (!celdaActivaId) return;
    const ranking = reconocerRuna(puntos, patrones);
    const top = ranking[0];
    const mejorMatch =
      top && top.score >= UMBRAL_CONFIANZA
        ? (runas.find((r) => r.id === top.runaId) ?? null)
        : null;
    setResultadosPorCelda((prev) => ({
      ...prev,
      [celdaActivaId]: { ranking, mejorMatch },
    }));
  };

  const seleccionarCelda = (celda: Celda) => {
    setCeldaActivaId(celda.id);
    setResetSignal((s) => s + 1);
  };

  const celdasDibujadas = Object.keys(resultadosPorCelda).filter(
    (id) => resultadosPorCelda[id].mejorMatch,
  );

  const mapaCeldaRuna: Record<string, string> = {};
  for (const id of celdasDibujadas) {
    mapaCeldaRuna[id] = resultadosPorCelda[id].mejorMatch!.id;
  }

  const combinacionEncontrada = useMemo(() => {
    if (!finalizado) return null;
    return buscarCombinacion(mapaCeldaRuna, combinaciones);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalizado, resultadosPorCelda, combinaciones]);

  const finalizarRejilla = () => {
    setFinalizado(true);
    setIntentos((n) => n + 1);
  };

  const reintentarRejilla = () => {
    setResultadosPorCelda({});
    setCeldaActivaId(null);
    setFinalizado(false);
    setResetSignal((s) => s + 1);
  };

  const cambiarForma = (f: FormaLimite) => {
    setForma(f);
    reiniciarTodo();
  };

  const cambiarRejilla = (r: Rejilla) => {
    setRejilla(r);
    reiniciarTodo();
  };

  function reiniciarTodo() {
    setResultadoSimple(null);
    setResultadosPorCelda({});
    setCeldaActivaId(null);
    setFinalizado(false);
    setResetSignal((s) => s + 1);
  }

  const runaPorCeldaParaTablero: Record<
    string,
    EntidadMagica | null | undefined
  > = {};
  for (const [id, r] of Object.entries(resultadosPorCelda)) {
    runaPorCeldaParaTablero[id] = r.mejorMatch;
  }

  return (
    <div
      className="relative flex flex-col items-center p-4 md:p-8 gap-6"
      style={{ minHeight: "calc(100svh - 64px)" }}
    >
      <Link
        href="/garlia/aventura"
        className="absolute top-2 left-2 md:top-4 md:left-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-main/90 backdrop-blur-sm border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/30 transition-colors shadow-sm text-micro font-black uppercase tracking-widest"
      >
        <ArrowLeft size={12} /> Volver
      </Link>

      <div className="flex flex-col items-center gap-1.5 pt-8 md:pt-2 text-center">
        <div className="flex items-center gap-2">
          <ScrollText size={20} style={{ color: "var(--primary)" }} />
        </div>
      </div>

      {estado === "cargando" && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-primary/20" size={28} />
        </div>
      )}

      {estado === "sin-runas" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-4">
          <ScrollText size={40} strokeWidth={1} className="text-primary/15" />
          <p className="text-sm text-primary/40 max-w-sm">
            Todavía no hay runas con patrón de trazo definido.
          </p>
        </div>
      )}

      {estado === "listo" && (
        <div className="w-full max-w-md flex flex-col items-center gap-4">
          <SelectorFormaLimite value={forma} onChange={cambiarForma} />
          <SelectorRejilla value={rejilla} onChange={cambiarRejilla} />

          {simple ? (
            <>
              <div className="w-full rounded-2xl border border-primary/15 bg-white-custom/60 p-3 shadow-sm">
                <CanvasDibujoRuna
                  forma={forma}
                  height={300}
                  resetSignal={resetSignal}
                  onTrazoCompleto={onTrazoCompletoSimple}
                />
              </div>

              {resultadoSimple && (
                <ResultadoCard
                  key={intentos}
                  mejorMatch={mejorMatchSimple}
                  resultado={resultadoSimple}
                  onReintentar={reintentarSimple}
                />
              )}
            </>
          ) : (
            <>
              <TableroCeldas
                celdaActivaId={celdaActivaId}
                forma={forma}
                rejilla={rejilla}
                runaPorCelda={runaPorCeldaParaTablero}
                onSeleccionarCelda={seleccionarCelda}
              />

              {celdaActivaId && !finalizado && (
                <div className="w-full rounded-2xl border border-primary/15 bg-white-custom/60 p-3 shadow-sm">
                  <CanvasDibujoRuna
                    height={220}
                    resetSignal={resetSignal}
                    onTrazoCompleto={onTrazoCompletoCelda}
                  />
                  {resultadosPorCelda[celdaActivaId] && (
                    <p className="text-micro text-center pt-2 font-bold text-primary/50">
                      {resultadosPorCelda[celdaActivaId].mejorMatch
                        ? `Reconocida: ${resultadosPorCelda[celdaActivaId].mejorMatch!.nombre}`
                        : "No se reconoció ninguna runa en esta celda"}
                    </p>
                  )}
                </div>
              )}

              {!finalizado && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-micro text-primary/25 tracking-widest uppercase font-bold text-center">
                    Tocá una celda del tablero para dibujar ahí
                  </p>
                  <button
                    type="button"
                    disabled={celdasDibujadas.length === 0}
                    onClick={finalizarRejilla}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-40"
                  >
                    Terminar y ver resultado
                  </button>
                </div>
              )}

              {finalizado && (
                <ResultadoRejillaCard
                  key={intentos}
                  combinacion={combinacionEncontrada}
                  resultadosPorCelda={resultadosPorCelda}
                  rejilla={rejilla}
                  celdas={celdas}
                  onReintentar={reintentarRejilla}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResultadoCard({
  resultado,
  mejorMatch,
  onReintentar,
}: {
  resultado: ResultadoReconocimiento[];
  mejorMatch: EntidadMagica | null;
  onReintentar: () => void;
}) {
  return (
    <div className="w-full rounded-2xl border border-primary/15 bg-white-custom p-5 shadow-md flex flex-col items-center gap-3 text-center animate-[fadeIn_0.2s_ease]">
      {mejorMatch ? (
        <>
          <div className="flex items-center gap-1.5 text-micro font-black uppercase tracking-[0.3em] text-primary/40">
            <Sparkles size={12} /> Runa reconocida
          </div>
          {mejorMatch.imagen_url && (
            <div className="w-24 h-24 rounded-xl overflow-hidden border border-primary/10 bg-primary/3">
              <Image
                alt={mejorMatch.nombre}
                className="w-full h-full object-cover"
                height={96}
                src={mejorMatch.imagen_url}
                width={96}
              />
            </div>
          )}
          <h2 className="text-lg font-black text-primary">
            {mejorMatch.nombre}
          </h2>
          {mejorMatch.explicacion && (
            <div className="text-sm text-primary/60 text-left max-h-40 overflow-y-auto w-full">
              <PlainMarkdownPreview value={mejorMatch.explicacion} />
            </div>
          )}
        </>
      ) : (
        <>
          <Wand2 size={28} className="text-primary/20" />
          <p className="text-sm font-bold text-primary/50">
            No se reconoció ninguna runa conocida
          </p>
          <p className="text-micro text-primary/30">
            {resultado[0]
              ? `Lo más parecido fue "${resultado[0].nombre}", pero no lo suficiente.`
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

function ResultadoRejillaCard({
  combinacion,
  resultadosPorCelda,
  rejilla,
  celdas,
  onReintentar,
}: {
  combinacion: CombinacionRuna | null;
  resultadosPorCelda: Record<string, ResultadoCelda>;
  rejilla: Rejilla;
  celdas: Celda[];
  onReintentar: () => void;
}) {
  const celdasConRuna = celdas.filter(
    (c) => resultadosPorCelda[c.id]?.mejorMatch,
  );

  return (
    <div className="w-full rounded-2xl border border-primary/15 bg-white-custom p-5 shadow-md flex flex-col items-center gap-3 text-center animate-[fadeIn_0.2s_ease]">
      {combinacion ? (
        <>
          <div className="flex items-center gap-1.5 text-micro font-black uppercase tracking-[0.3em] text-primary/40">
            <Sparkles size={12} /> ¡Hechizo compuesto!
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
          <h2 className="text-lg font-black text-primary">
            {combinacion.nombre}
          </h2>
          {combinacion.explicacion && (
            <div className="text-sm text-primary/60 text-left max-h-40 overflow-y-auto w-full">
              <PlainMarkdownPreview value={combinacion.explicacion} />
            </div>
          )}
        </>
      ) : (
        <>
          <Wand2 size={28} className="text-primary/20" />
          <p className="text-sm font-bold text-primary/50">
            {celdasConRuna.length === 0
              ? "No se reconoció ninguna runa en el tablero"
              : "No hay un hechizo compuesto para esta combinación, pero se reconocieron estas runas:"}
          </p>
        </>
      )}

      {!combinacion && celdasConRuna.length > 0 && (
        <div className="w-full flex flex-col gap-1.5 text-left">
          {celdasConRuna.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-primary/5 text-xs"
            >
              <span className="text-primary/40 font-bold">
                {labelCelda(c, rejilla)}
              </span>
              <span className="text-primary font-semibold">
                {resultadosPorCelda[c.id].mejorMatch!.nombre}
              </span>
            </div>
          ))}
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
