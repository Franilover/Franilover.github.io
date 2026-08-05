"use client";

/**
 * BuscadorInline
 * ───────────────────────────────────────────────────────────────────────────
 * Input de búsqueda reutilizable para las barras superiores de las vistas
 * de Entidades (Letras, Criaturas, Geografía/Reinos, Items…). Mismo diseño
 * en todos lados: ícono de lupa, se expande horizontalmente (flex-1) para
 * ocupar el espacio libre de la barra, y botón "✕" para limpiar cuando hay
 * texto.
 */

import { Search, X } from "lucide-react";
import React from "react";

export function BuscadorInline({
  value,
  onChange,
  placeholder = "Buscar…",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative flex-1 min-w-[160px] ${className ?? ""}`}>
      <Search
        size={12}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-primary/30"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-primary/[0.04] border border-primary/10 rounded-lg pl-8 pr-7 py-1.5 text-micro font-semibold text-primary outline-none focus:border-primary/25 placeholder:text-primary/30 placeholder:font-normal placeholder:normal-case"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          title="Limpiar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-primary/30 hover:text-primary/60 transition-colors"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
