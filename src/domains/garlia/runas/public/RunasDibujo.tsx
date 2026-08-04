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
 * La lógica de interpretación/match y la tarjeta de resultado viven en
 * ../ResultadoDibujoLibre.tsx — compartidas con el botón "Ver como
 * jugador" del panel de admin, para que ambos muestren siempre lo mismo.
 *
 * Ruta destino:
 *   src/features/garliaPublic/runas/RunasDibujo.tsx
 */

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import { CanvasFormaLibre } from "../CanvasFormaLibre";
import type { TrazoLibre } from "../deteccionFormaLibre";
import { generarCeldas } from "../formasLimite";
import { PanelNotasJugador } from "./PanelNotasJugador";
import { PanelRunasLogradas } from "./PanelRunasLogradas";
import { PistaInterpretacion, ResultadoDibujoCard, useResultadoDibujoLibre } from "../ResultadoDibujoLibre";
import type { CombinacionRuna, EntidadMagica } from "../types";
import { useConfigRunas } from "../useConfigRunas";

type Estado = "cargando" | "listo" | "sin-runas";

export default function RunasDibujo() {
  const [runas, setRunas] = useState<EntidadMagica[]>([]);
  const [combinaciones, setCombinaciones] = useState<CombinacionRuna[]>([]);
  const [estado, setEstado] = useState<Estado>("cargando");

  const { config: configRunas, loading: cargandoConfig } = useConfigRunas();

  const [trazos, setTrazos] = useState<TrazoLibre[]>([]);
  const [finalizado, setFinalizado] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [intentos, setIntentos] = useState(0);

  React.useEffect(() => {
    let activo = true;
    void Promise.all([
      supabase
        .from("runas")
        .select("id, nombre, explicacion, explicacion_por_rango, patron_trazos"),
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

  const { interpretacion, combinacionEncontrada, cadenas, hayAlgoReconocido } = useResultadoDibujoLibre({
    trazos,
    finalizado,
    runas,
    combinaciones,
    plantillasSeparadores: configRunas.plantillas_separadores,
  });

  const onTrazosChange = (nuevos: TrazoLibre[]) => setTrazos(nuevos);

  const finalizarDibujo = () => {
    setFinalizado(true);
    setIntentos((n) => n + 1);
  };

  const reintentar = () => {
    setTrazos([]);
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
        <div className="w-full max-w-4xl flex flex-col lg:flex-row items-start justify-center gap-6">
          {/* Columna principal: canvas / resultado */}
          <div className="w-full max-w-md flex flex-col items-center gap-4 mx-auto lg:mx-0">
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
                runas={runas}
                onReintentar={reintentar}
              />
            )}
          </div>

          {/* Columna lateral: notas del jugador + runas logradas */}
          <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4 mx-auto lg:mx-0">
            <PanelNotasJugador />
            <PanelRunasLogradas interpretacion={interpretacion} />
          </div>
        </div>
      )}
    </div>
  );
}
