"use client";

/**
 * useCSSVar.ts
 * ─────────────
 * Lee el valor actual de una variable CSS del :root. Genérico,
 * sin conocimiento de dominio.
 *
 * Ruta: src/hooks/ui/useCSSVar.ts
 */

import { useEffect, useState } from "react";

export function useCSSVar(name: string): string {
  const [val, setVal] = useState("");
  useEffect(() => {
    setVal(
      getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    );
  }, [name]);
  return val;
}
