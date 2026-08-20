"use client";

/**
 * SelectorTipoGrupoCompuesto.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Dropdown compacto para elegir el `tipo` de un GrupoCompuesto: genérico,
 * órgano (Flora) o formación (Minerales). El tipo determina en qué
 * buscadores aparece este grupo — ver TIPOS_GRUPO_COMPUESTO en types.ts.
 */

import { ChevronDown } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { TIPOS_GRUPO_COMPUESTO, type TipoGrupoCompuesto } from "./types";

export function SelectorTipoGrupoCompuesto({
  value,
  onChange,
}: {
  value: TipoGrupoCompuesto;
  onChange: (tipo: TipoGrupoCompuesto) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const actual = TIPOS_GRUPO_COMPUESTO.find((t) => t.value === value) ?? TIPOS_GRUPO_COMPUESTO[0];

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        title="Tipo de grupo — determina en qué buscadores aparece"
        className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-bold border border-primary/15 text-primary/60 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer"
      >
        {actual.label}
        <ChevronDown size={10} />
      </button>

      {abierto && (
        <div
          className="absolute z-20 mt-1 right-0 w-44 rounded-md border shadow-lg overflow-hidden"
          style={{
            background: "var(--bg-main)",
            borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
          }}
        >
          {TIPOS_GRUPO_COMPUESTO.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                onChange(t.value);
                setAbierto(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 text-micro font-bold transition-colors ${
                t.value === value ? "bg-primary/10 text-primary" : "text-primary/70 hover:bg-primary/6 hover:text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
