"use client";

/**
 * SelectorFormaLimite.tsx
 * ─────────────────────────
 * Selector que el jugador usa en /garlia/runas para elegir la forma
 * que va a limitar su dibujo: círculo, triángulo, cuadrado, o un
 * polígono de N lados vía slider.
 *
 * Ruta destino:
 *   src/features/garliaPublic/runas/SelectorFormaLimite.tsx
 */

import { Circle, Hexagon, Square, Triangle } from "lucide-react";
import React from "react";

import {
  FORMA_CIRCULO,
  FORMA_CUADRADO,
  FORMA_TRIANGULO,
  MAX_LADOS,
  MIN_LADOS,
  labelForma,
  type FormaLimite,
} from "../formasLimite";

const ATAJOS: { forma: FormaLimite; Icon: React.ElementType }[] = [
  { forma: FORMA_CIRCULO, Icon: Circle },
  { forma: FORMA_TRIANGULO, Icon: Triangle },
  { forma: FORMA_CUADRADO, Icon: Square },
];

function mismaForma(a: FormaLimite, b: FormaLimite): boolean {
  return a.tipo === b.tipo && a.lados === b.lados;
}

export function SelectorFormaLimite({
  value,
  onChange,
}: {
  value: FormaLimite;
  onChange: (forma: FormaLimite) => void;
}) {
  const esPoligonoLibre =
    value.tipo === "poligono" &&
    !ATAJOS.some((a) => mismaForma(a.forma, value));

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        {ATAJOS.map(({ forma, Icon }) => {
          const activo = mismaForma(value, forma);
          return (
            <button
              key={labelForma(forma)}
              type="button"
              onClick={() => onChange(forma)}
              title={labelForma(forma)}
              className="flex items-center justify-center w-10 h-10 rounded-xl border transition-all"
              style={{
                background: activo
                  ? "var(--primary)"
                  : "color-mix(in srgb, var(--primary) 6%, transparent)",
                borderColor: activo
                  ? "var(--primary)"
                  : "color-mix(in srgb, var(--primary) 20%, transparent)",
                color: activo ? "var(--btn-text)" : "var(--primary)",
              }}
            >
              <Icon size={17} strokeWidth={activo ? 2.5 : 2} />
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onChange({ tipo: "poligono", lados: 5 })}
          title="Elegir cantidad de lados"
          className="flex items-center justify-center w-10 h-10 rounded-xl border transition-all"
          style={{
            background: esPoligonoLibre
              ? "var(--primary)"
              : "color-mix(in srgb, var(--primary) 6%, transparent)",
            borderColor: esPoligonoLibre
              ? "var(--primary)"
              : "color-mix(in srgb, var(--primary) 20%, transparent)",
            color: esPoligonoLibre ? "var(--btn-text)" : "var(--primary)",
          }}
        >
          <Hexagon size={17} strokeWidth={esPoligonoLibre ? 2.5 : 2} />
        </button>
      </div>

      {esPoligonoLibre && (
        <div className="flex items-center gap-2 w-full max-w-[220px]">
          <input
            className="flex-1 accent-[var(--primary)]"
            max={MAX_LADOS}
            min={MIN_LADOS}
            type="range"
            value={value.lados}
            onChange={(e) =>
              onChange({ tipo: "poligono", lados: Number(e.target.value) })
            }
          />
          <span className="text-micro font-black text-primary/50 w-6 text-right">
            {value.lados}
          </span>
        </div>
      )}

      <p className="text-micro font-black uppercase tracking-[0.25em] text-primary/30">
        {labelForma(value)}
      </p>
    </div>
  );
}
