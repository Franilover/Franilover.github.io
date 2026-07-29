"use client";

/**
 * RunasDibujo.tsx (público)
 * ────────────────────────────────────────────────────────────────────
 * /garlia/runas — el usuario dibuja un trazo en un canvas y el sistema
 * intenta reconocer cuál de las runas definidas en el mundo dibujó,
 * usando el algoritmo $1 Unistroke Recognizer contra los patrones que
 * el admin grabó en el editor (PanelPatronRuna).
 *
 * Si el mejor match supera un umbral de confianza, se muestra la runa
 * reconocida (imagen + nombre + explicación). Si no, se invita a
 * intentar de nuevo o se muestran los candidatos más cercanos.
 *
 * Ruta destino:
 *   src/features/garliaPublic/runas/RunasDibujo.tsx
 */

import { ArrowLeft, Loader2, ScrollText, Sparkles, Wand2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { useMemo, useState } from "react";

import { RichEditor } from "@/editor/lexical";
import { supabase } from "@/infra/supabase/supabase";

import { CanvasDibujoRuna } from "../CanvasDibujoRuna";
import { reconocerRuna, type PatronRuna, type Punto, type ResultadoReconocimiento } from "../dollarOneRecognizer";
import type { EntidadMagica } from "../types";

// Por debajo de este score no se considera un match confiable: se anima
// al usuario a intentar de nuevo en vez de mostrarle un resultado dudoso.
const UMBRAL_CONFIANZA = 0.72;

type Estado = "cargando" | "listo" | "sin-runas";

export default function RunasDibujo() {
  const [runas, setRunas] = useState<EntidadMagica[]>([]);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [resultado, setResultado] = useState<ResultadoReconocimiento[] | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [intentos, setIntentos] = useState(0);

  React.useEffect(() => {
    let activo = true;
    supabase
      .from("runas")
      .select("id, nombre, explicacion, imagen_url, patron_trazos")
      .then(({ data, error }) => {
        if (!activo) return;
        if (error || !data) {
          setEstado("sin-runas");
          return;
        }
        const conPatron = (data as unknown as EntidadMagica[]).filter(
          (r) => r.patron_trazos && r.patron_trazos.length > 0,
        );
        setRunas(conPatron);
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

  const mejorMatch: EntidadMagica | null = useMemo(() => {
    if (!resultado || resultado.length === 0) return null;
    const top = resultado[0];
    if (top.score < UMBRAL_CONFIANZA) return null;
    return runas.find((r) => r.id === top.runaId) ?? null;
  }, [resultado, runas]);

  const onTrazoCompleto = (puntos: Punto[]) => {
    const ranking = reconocerRuna(puntos, patrones);
    setResultado(ranking);
    setIntentos((n) => n + 1);
  };

  const reintentar = () => {
    setResultado(null);
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

      <div className="flex flex-col items-center gap-1.5 pt-8 md:pt-2 text-center">
        <div className="flex items-center gap-2">
          <ScrollText size={20} style={{ color: "var(--primary)" }} />
          <h1 className="text-xl md:text-2xl font-black text-primary tracking-tight">
            Traza una runa
          </h1>
        </div>
        <p className="text-sm text-primary/40 max-w-md">
          Dibujá el símbolo de una runa en el pergamino. El mundo intentará
          reconocer qué poder invocaste.
        </p>
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
            Todavía no hay runas con patrón de trazo definido en este mundo.
            Volvé pronto.
          </p>
        </div>
      )}

      {estado === "listo" && (
        <div className="w-full max-w-md flex flex-col items-center gap-4">
          <div className="w-full rounded-2xl border border-primary/15 bg-white-custom/60 p-3 shadow-sm">
            <CanvasDibujoRuna
              height={300}
              resetSignal={resetSignal}
              onTrazoCompleto={onTrazoCompleto}
            />
          </div>

          {resultado && (
            <ResultadoCard
              key={intentos}
              mejorMatch={mejorMatch}
              onReintentar={reintentar}
              resultado={resultado}
            />
          )}

          {!resultado && (
            <p className="text-micro text-primary/25 tracking-widest uppercase font-bold">
              Dibujá con el mouse o el dedo, y soltá al terminar
            </p>
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
          <h2 className="text-lg font-black text-primary">{mejorMatch.nombre}</h2>
          {mejorMatch.explicacion && (
            <div className="text-sm text-primary/60 text-left max-h-40 overflow-y-auto w-full">
              <RichEditor
                editable={false}
                mode="preview"
                value={mejorMatch.explicacion}
                onChange={() => {}}
              />
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
