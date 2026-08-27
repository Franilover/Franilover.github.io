"use client";

import { Info, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import type { PropiedadCalculada } from "./types";

const RANGOS_GENERALES = [
  { desde: 0.0, hasta: 0.199, nombre: "Muy baja" },
  { desde: 0.2, hasta: 0.399, nombre: "Baja" },
  { desde: 0.4, hasta: 0.599, nombre: "Media" },
  { desde: 0.6, hasta: 0.799, nombre: "Alta" },
  { desde: 0.8, hasta: 1.0, nombre: "Muy alta" },
];

const SIGNIFICADOS: Record<string, string> = {
  rigidez: "Resistencia a cambiar de forma cuando actúa una fuerza.",
  flexibilidad: "Capacidad de cambiar de forma conservando su integridad.",
  estabilidad: "Tendencia a conservar su estado frente a ruptura o transformación.",
  dureza: "Resistencia a penetración, rayado o deformación local.",
  conductividad: "Facilidad para transmitir una influencia a través de su estructura.",
  transparencia: "Facilidad para dejar pasar una influencia sin retenerla.",
  interaccion: "Facilidad para acoplarse o responder a su entorno.",
};

function nivelPara(valor?: number): string | null {
  if (valor === undefined || !Number.isFinite(valor)) return null;
  return RANGOS_GENERALES.find((r) => valor >= r.desde && valor <= r.hasta)?.nombre ?? null;
}

export function InfoFormulasPopover({ propiedades }: { propiedades: PropiedadCalculada[] }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const conFormula = propiedades.filter((p) => p.formula);

  useEffect(() => {
    if (!abierto) return;
    const onClickFuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", onClickFuera);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickFuera);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [abierto]);

  if (conFormula.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        title="Cómo se calcula y cómo interpretar cada propiedad"
        aria-label="Cómo se calcula y cómo interpretar cada propiedad"
        className={`flex items-center justify-center w-4 h-4 rounded-full transition-colors ${
          abierto ? "bg-primary/20 text-primary" : "text-primary/30 hover:text-primary/60 hover:bg-primary/8"
        }`}
      >
        <Info size={11} />
      </button>

      {abierto && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-[min(44rem,calc(100vw-1.5rem))] max-h-[28rem] overflow-y-auto rounded-lg border border-primary/15 shadow-xl p-2.5"
          style={{ background: "var(--bg-main)" }}
        >
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-primary/10">
            <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
              Cómo leer las propiedades
            </span>
            <button type="button" onClick={() => setAbierto(false)} className="text-primary/30 hover:text-primary/60 transition-colors" aria-label="Cerrar">
              <X size={12} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="rounded-md border border-primary/10 bg-primary/[0.025] p-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/35">De dónde sale</span>
            </div>
            <div className="rounded-md border border-primary/10 bg-primary/[0.025] p-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/35">Qué significa</span>
            </div>

            {conFormula.map((p) => {
              const nivel = nivelPara(p.proporcion);
              const significado = SIGNIFICADOS[p.clave] ?? p.descripcion;
              return (
                <React.Fragment key={p.clave}>
                  <div className="rounded-md border border-primary/10 p-2 min-w-0">
                    <div className="text-micro font-bold text-primary/70 mb-0.5">{p.label}</div>
                    <div className="text-micro font-mono text-primary/45 leading-relaxed break-words">{p.formula}</div>
                  </div>
                  <div className="rounded-md border border-primary/10 p-2 min-w-0">
                    <div className="text-micro font-bold text-primary/70 mb-0.5">{significado}</div>
                    {p.proporcion !== undefined ? (
                      <>
                        <div className="text-micro text-primary/50 leading-relaxed">
                          <span className="font-black text-primary/70">{nivel ?? "Intermedio"}</span>{" "}
                          · índice normalizado de <span className="font-mono">0 a 1</span>.
                        </div>
                        <div className="mt-1.5 grid grid-cols-5 gap-1">
                          {RANGOS_GENERALES.map((r) => (
                            <div key={r.nombre} className="text-[9px] leading-tight text-primary/35">
                              <div className="font-bold text-primary/50">{r.nombre}</div>
                              <div>{r.desde.toFixed(1)}–{r.hasta.toFixed(1)}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-micro text-primary/40 leading-relaxed">Este valor no es un índice 0–1.</div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
