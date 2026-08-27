"use client";

/**
 * InfoFormulasPopover.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Ícono "i" que se coloca junto al título de una sección de propiedades
 * calculadas (ej. "Propiedades físicas" en ElementoEditor/CompuestoEditor)
 * y al hacer click/hover muestra, para cada propiedad con fórmula
 * documentada, de dónde sale ese número — en una línea corta y legible
 * (ej. "Cap. transformación = 0.60·transición + 0.20·(1−catálisis) + ...").
 *
 * Las fórmulas vienen ya resueltas en PropiedadCalculada.formula (ver
 * propiedadesCalculadasDeElemento/propiedadesCalculadasDeCompuesto en
 * types.ts) — este componente solo las lista, no calcula ni traduce nada.
 * Fuente canónica de esas fórmulas: elemento_propiedad_reglas /
 * compuesto_reglas en Supabase, reformuladas a lenguaje corto en vez de la
 * notación SQL/matemática literal.
 *
 * Solo se listan propiedades con `formula` definida — las que no tienen
 * fórmula documentada (ej. clasificaciones textuales simples) se omiten
 * en vez de mostrar un hueco vacío.
 */

import { Info, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import type { PropiedadCalculada } from "./types";

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
        title="Cómo se calcula cada propiedad"
        className={`flex items-center justify-center w-4 h-4 rounded-full transition-colors ${
          abierto ? "bg-primary/20 text-primary" : "text-primary/30 hover:text-primary/60 hover:bg-primary/8"
        }`}
      >
        <Info size={11} />
      </button>

      {abierto && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-72 sm:w-80 max-h-80 overflow-y-auto rounded-lg border border-primary/15 shadow-xl p-2.5 flex flex-col gap-1.5"
          style={{ background: "var(--bg-main)" }}
        >
          <div className="flex items-center justify-between gap-2 pb-1 border-b border-primary/10">
            <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
              De dónde sale cada valor
            </span>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="text-primary/30 hover:text-primary/60 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
          {conFormula.map((p) => (
            <div key={p.clave} className="flex flex-col gap-0.5">
              <span className="text-micro font-bold text-primary/70">{p.label}</span>
              <span className="text-micro font-mono text-primary/45 leading-relaxed break-words">
                {p.formula}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
