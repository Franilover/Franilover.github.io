/**
 * matchCombinacion.ts
 * ──────────────────────
 * Compara el mapa de celdas dibujadas (celdaId → runaId reconocida) contra
 * el catálogo de combinaciones definidas en admin, y devuelve la que
 * coincide exactamente (mismas celdas ocupadas, ni de más ni de menos,
 * cada una con la runa exacta), o null si ninguna matchea.
 *
 * El match es estricto a propósito (decisión de diseño): evita resultados
 * "casi correctos" confusos quen el jugador no entienda por qué activó
 * un hechizo compuesto.
 *
 * Ruta destino:
 *   src/features/garliaPublic/runas/matchCombinacion.ts
 */

import type { CombinacionRuna } from "./types";

/**
 * @param celdasDibujadas mapa celdaId → runaId reconocida en esa celda.
 *   Solo debe incluir celdas donde SÍ se reconoció una runa (con score
 *   suficiente) — las celdas vacías o sin match confiable no deben estar
 *   en este mapa.
 * @param combinaciones catálogo completo definido en admin.
 */
export function buscarCombinacion(
  celdasDibujadas: Record<string, string>,
  combinaciones: CombinacionRuna[],
): CombinacionRuna | null {
  const idsDibujadas = Object.keys(celdasDibujadas);
  if (idsDibujadas.length === 0) return null;

  for (const combo of combinaciones) {
    const idsCombo = Object.keys(combo.celdas);
    if (idsCombo.length !== idsDibujadas.length) continue;

    const coincideExacto = idsCombo.every(
      (celdaId) => celdasDibujadas[celdaId] === combo.celdas[celdaId],
    );
    if (coincideExacto) return combo;
  }
  return null;
}
