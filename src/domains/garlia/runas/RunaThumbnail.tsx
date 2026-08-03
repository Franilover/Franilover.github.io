"use client";

/**
 * RunaThumbnail.tsx
 * ───────────────────
 * Preview visual de una runa a partir de su patron_trazos (en vez de una
 * imagen subida): dibuja todos los trazos guardados como un mini-SVG,
 * normalizados al mismo viewBox. Se usa en el grid de la página de Magia
 * y en cualquier otro lugar donde antes se mostraba imagen_url de una runa.
 */

import React from "react";

import type { Punto } from "./dollarOneRecognizer";
import { trazosAPathsSvg, TRAZO_THUMBNAIL_VIEWBOX } from "./trazoThumbnail";

export function RunaThumbnail({
  patronTrazos,
  color = "var(--primary)",
  className,
}: {
  patronTrazos: Punto[][] | null | undefined;
  color?: string;
  className?: string;
}) {
  const paths = trazosAPathsSvg(patronTrazos ?? []);

  if (paths.length === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${TRAZO_THUMBNAIL_VIEWBOX} ${TRAZO_THUMBNAIL_VIEWBOX}`}
      // Centra el trazo y lo encoge/agranda para que siempre quepa entero
      // en el cuadro disponible, sin deformarlo (mantiene su proporción).
      preserveAspectRatio="xMidYMid meet"
      className={`${className ?? "w-full h-full"} overflow-hidden block`}
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
