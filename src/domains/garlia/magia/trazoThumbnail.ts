/**
 * trazoThumbnail.ts
 * ────────────────────
 * Convierte un trazo crudo (Punto[]) en un path SVG normalizado a un
 * viewBox fijo, para poder mostrar mini-previews de cada ejemplo
 * guardado en PanelPatronRuna sin tener que reabrir el canvas grande.
 *
 * Ruta destino:
 *   src/features/editorGarlia/lib/trazoThumbnail.ts
 */

import type { Punto } from "./dollarOneRecognizer";

const VIEWBOX = 100;
const MARGEN = 10;

/** Genera un `d` de <path> que encaja el trazo en un viewBox de 100x100 con margen. */
export function trazoAPathSvg(puntos: Punto[]): string {
  if (puntos.length < 2) return "";
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const disponible = VIEWBOX - MARGEN * 2;
  const escala = Math.min(disponible / w, disponible / h);
  const offX = (VIEWBOX - w * escala) / 2;
  const offY = (VIEWBOX - h * escala) / 2;

  return puntos
    .map((p, i) => {
      const x = (p.x - minX) * escala + offX;
      const y = (p.y - minY) * escala + offY;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export const TRAZO_THUMBNAIL_VIEWBOX = VIEWBOX;
