"use client";

/**
 * CapitulosSection
 * ───────────────────────────────────────────────────────────────────────────
 * `EditorCapitulos.tsx` (export default `EstudioCapitulos`) ya es un módulo
 * completamente autónomo (libros, capítulos, línea de tiempo interna). No
 * necesita props de navegación del store — es una hoja del árbol.
 */

import EstudioCapitulos from "@/domains/garlia/libros/EditorCapitulos";

export function CapitulosSection() {
  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
      <EstudioCapitulos />
    </div>
  );
}
