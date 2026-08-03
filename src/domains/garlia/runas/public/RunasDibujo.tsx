"use client";

/**
 * RunasDibujo.tsx (público)
 * ────────────────────────────────────────────────────────────────────
 * /garlia/runas — el jugador dibuja TODO a mano alzada sobre un único
 * canvas libre: el contorno que quiera (círculo, triángulo, cuadrado,
 * lo que sea), opcionalmente líneas radiales para dividirlo en
 * secciones, y dentro de cada sección la runa que corresponda —
 * separando secciones consecutivas con uno de los 4 símbolos de
 * separador si así lo requiere la combinación que está intentando armar.
 *
 * No hay selectores de forma, ni de celda, ni de separador: todo se
 * infiere geométricamente del dibujo (ver interpretarDibujoLibre.ts,
 * que a su vez usa detectarFormaLibre.ts para el contorno/secciones y
 * dollarOneRecognizer.ts para reconocer cada runa/separador). El
 * resultado (mapa celdaId→runaId + gapId→separador) se compara contra
 * el catálogo de combinaciones definidas en admin (matchCombinacion.ts):
 * si matchea exactamente una, se muestra el hechizo compuesto; si no,
 * se listan las runas sueltas que sí se reconocieron.
 *
 * Solo soporta 1 anillo por ahora — igual que detectarFormaLibre.ts, la
 * detección de anillos concéntricos queda para una iteración futura.
 *
 * Ruta destino:
 *   src/features/garliaPublic/runas/RunasDibujo.tsx
 */

import { ArrowLeft, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { useMemo, useState } from "react";

import { PlainMarkdownPreview } from "@/editor/lexical";
import { supabase } from "@/infra/supabase/supabase";

import { armarTodasLasCadenas, type Cadena } from "../cadenasSeparadores";
import { CanvasFormaLibre } from "../CanvasFormaLibre";
import type { TrazoLibre } from "../deteccionFormaLibre";
import { labelForma, labelCelda, generarCeldas, generarGaps, type Celda, type Rejilla } from "../formasLimite";
import {
  interpretarDibujoLibre,
  type InterpretacionDibujoLibre,
  type ResultadoCelda,
} from "../interpretarDibujoLibre";
import { buscarCombinacion } from "../matchCombinacion";
import { RunaThumbnail } from "../RunaThumbnail";
import type { CombinacionRuna, EntidadMagica } from "../types";
import { useConfigRunas } from "../useConfigRunas";

type Estado = "cargando" | "listo" | "sin-runas";

export default function RunasDibujo() {
  const [runas, setRunas] = useState<EntidadMagica[]>([]);
  const [combinaciones, setCombinaciones] = useState<CombinacionRuna[]>([]);
  const [estado, setEstado] = useState<Estado>("cargando");

  const { config: configRunas, loading: cargandoConfig } = useConfigRunas();

  const [trazos, setTrazos] = useState<TrazoLibre[]>([]);
  const [interpretacion, setInterpretacion] = useState<InterpretacionDibujoLibre | null>(null);
  const [finalizado, setFinalizado] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [intentos, setIntentos] = useState(0);

  React.useEffect(() => {
    let activo = true;
    void Promise.all([
      supabase
        .from("runas")
        .select("id, nombre, explicacion, patron_trazos"),
      supabase
        .from("combinaciones_runas")
        .select("id, nombre, explicacion, imagen_url, forma, rejilla, celdas, separadores"),
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

  // Se re-interpreta el dibujo completo en cada cambio de trazos — el
  // costo es bajo (unos pocos trazos, cada uno de a lo sumo unas
  // decenas de puntos) y así el jugador puede ver feedback en vivo de
  // qué se está reconociendo antes de finalizar.
  const onTrazosChange = (nuevos: TrazoLibre[]) => {
    setTrazos(nuevos);
    setInterpretacion(interpretarDibujoLibre(nuevos, runas, configRunas.plantillas_separadores));
  };

  const combinacionEncontrada = useMemo(() => {
    if (!finalizado || !interpretacion) return null;
    return buscarCombinacion(
      interpretacion.celdaRunaId,
      combinaciones,
      interpretacion.separadorPorGap,
      { forma: interpretacion.forma, rejilla: interpretacion.rejilla },
    );
  }, [finalizado, interpretacion, combinaciones]);

  // Cadenas formadas por los separadores — solo tiene sentido si el
  // jugador dibujó más de una sección (si dibujó un contorno sin
  // dividir, no hay gaps que interpretar).
  const cadenas: Cadena[] = useMemo(() => {
    if (!finalizado || !interpretacion || interpretacion.rejilla.secciones <= 1) return [];
    const celdas = generarCeldas(interpretacion.rejilla);
    const gaps = generarGaps(interpretacion.rejilla);
    return armarTodasLasCadenas(interpretacion.rejilla, celdas, gaps, interpretacion.separadorPorGap);
  }, [finalizado, interpretacion]);

  const hayAlgoReconocido =
    interpretacion !== null && Object.keys(interpretacion.celdaRunaId).length > 0;

  const finalizarDibujo = () => {
    setFinalizado(true);
    setIntentos((n) => n + 1);
  };

  const reintentar = () => {
    setTrazos([]);
    setInterpretacion(null);
    setFinalizado(false);
    setResetSignal((s) => s + 1);
  };

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

      {(estado === "cargando" || cargandoConfig) && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-primary/20" size={28} />
        </div>
      )}

      {estado === "sin-runas" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-4">
          <p className="text-sm text-primary/40 max-w-sm">
            Todavía no hay runas con patrón de trazo definido.
          </p>
        </div>
      )}

      {estado === "listo" && (
        <div className="w-full max-w-md flex flex-col items-center gap-4">
          {!finalizado && (
            <>
              <div className="w-full rounded-2xl border border-primary/15 bg-white-custom/60 p-3 shadow-sm">
                <CanvasFormaLibre height={340} resetSignal={resetSignal} onTrazosChange={onTrazosChange} />
              </div>

              <PistaInterpretacion interpretacion={interpretacion} trazos={trazos} />

              <div className="flex flex-col items-center gap-2">
                <p className="text-micro text-primary/25 tracking-widest uppercase font-bold text-center max-w-xs">
                  Dibujá tu forma, dividila en secciones si querés, y una
                  runa (o separador) en cada una
                </p>
                <button
                  type="button"
                  disabled={!hayAlgoReconocido}
                  onClick={finalizarDibujo}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-40"
                >
                  Terminar y ver resultado
                </button>
              </div>
            </>
          )}

          {finalizado && interpretacion && (
            <ResultadoDibujoCard
              key={intentos}
              cadenas={cadenas}
              celdas={generarCeldas(interpretacion.rejilla)}
              combinacion={combinacionEncontrada}
              interpretacion={interpretacion}
              rejilla={interpretacion.rejilla}
              onReintentar={reintentar}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Feedback en vivo mientras el jugador dibuja: qué forma se está
 * leyendo y cuántas runas/separadores ya se reconocieron. No bloquea
 * ni corrige nada — solo informa, para que el jugador sepa si el
 * sistema está entendiendo su trazo antes de finalizar.
 */
function PistaInterpretacion({
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
      {gapsReconocidos > 0 &&
        ` · ${gapsReconocidos} separador${gapsReconocidos === 1 ? "" : "es"}`}
    </p>
  );
}

function ResultadoDibujoCard({
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

  // Celdas que ya forman parte de alguna cadena — el resto (si las hay)
  // se sigue mostrando suelto abajo.
  const idsEnCadena = new Set(cadenas.flatMap((c) => c.celdaIds));
  const celdasSueltas = celdasConRuna.filter((c) => !idsEnCadena.has(c.id));

  // Caso más simple de todos: contorno sin dividir en secciones (1 sola
  // "celda") y esa celda tiene una runa reconocida — se muestra igual
  // que el viejo modo simple (1 runa, sin hablar de tablero ni celdas).
  const esRunaUnica = rejilla.secciones <= 1 && celdas.length === 1;
  const runaUnica = esRunaUnica ? (resultadosPorCelda[celdas[0].id]?.mejorMatch ?? null) : null;
  const rankingUnico = esRunaUnica ? (resultadosPorCelda[celdas[0].id]?.ranking ?? []) : [];

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
