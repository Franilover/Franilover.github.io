/**
 * cadenasSeparadores.ts
 * ────────────────────────
 * Dado un anillo con sus celdas (runas reconocidas) y sus gaps
 * (separadores reconocidos), arma las cadenas de runas resultantes.
 *
 * Reglas (ver charla de diseño en el editor de runas):
 *   - Cada gap con separador "inicio" (⟩⟩) arranca una cadena nueva.
 *     Puede haber varias en el mismo anillo — cada una es independiente.
 *   - Desde una celda, se avanza a la siguiente si el gap que las separa
 *     es "continua" (⟩, agrega al final) o "continua_inv" (⟨, agrega al
 *     principio). Se sigue avanzando aunque la celda esté vacía (no
 *     dibujada) — no corta la cadena, solo no aporta runa a la secuencia.
 *   - Un gap "corta" (|) o sin separador dibujado termina la cadena ahí.
 *   - Una cadena nunca visita la misma celda dos veces (evita loops
 *     infinitos si el jugador arma un anillo cerrado en círculo).
 *
 * Ruta destino:
 *   src/features/garliaPublic/runas/cadenasSeparadores.ts
 */

import type { Celda, Gap, Rejilla } from "./formasLimite";
import type { TipoSeparador } from "./separadores";

export type Cadena = {
  /** Id de la celda de inicio (donde estaba el ⟩⟩ que la disparó). */
  celdaInicioId: string;
  anillo: number;
  /** Ids de celda en el orden final de la secuencia (ya resuelto continua/continua_inv). */
  celdaIds: string[];
};

/**
 * Arma todas las cadenas de un anillo dado.
 *
 * @param celdasDelAnillo celdas de ese anillo, en orden de sección (0..N-1)
 * @param gapsDelAnillo gaps de ese anillo (uno por celda, cíclico)
 * @param separadorPorGap mapa gapId → tipo reconocido (ausente = sin dibujar = corta)
 */
export function armarCadenasDeAnillo(
  celdasDelAnillo: Celda[],
  gapsDelAnillo: Gap[],
  separadorPorGap: Record<string, TipoSeparador | undefined>,
): Cadena[] {
  const n = celdasDelAnillo.length;
  if (n === 0) return [];

  const celdaPorSeccion = new Map(celdasDelAnillo.map((c) => [c.seccion, c]));
  // El gap "gS-aA" definido en generarGaps tiene seccionDespues = S, o sea
  // es el gap que hay que cruzar para ENTRAR a la celda de sección S viniendo
  // de la anterior. Lo indexamos por seccionDespues para caminar hacia adelante.
  const gapEntrandoA = new Map(gapsDelAnillo.map((g) => [g.seccionDespues, g]));

  const cadenas: Cadena[] = [];

  for (const gap of gapsDelAnillo) {
    const tipo = separadorPorGap[gap.id];
    if (tipo !== "inicio") continue;

    // El ⟩⟩ está en el gap que separa seccionAntes de seccionDespues: la
    // cadena arranca en la celda "después" de ese gap (hacia donde apunta).
    const celdaInicio = celdaPorSeccion.get(gap.seccionDespues);
    if (!celdaInicio) continue;

    const visitadas = new Set<number>();
    const secuencia: string[] = [celdaInicio.id];
    visitadas.add(celdaInicio.seccion);

    let seccionActual = celdaInicio.seccion;
    // Avanza mientras el gap de salida (hacia la siguiente sección) siga la cadena.
    for (let paso = 0; paso < n; paso++) {
      const siguienteSeccion = (seccionActual + 1) % n;
      const gapSalida = gapEntrandoA.get(siguienteSeccion);
      if (!gapSalida) break;
      const tipoSalida = separadorPorGap[gapSalida.id];
      if (tipoSalida !== "continua" && tipoSalida !== "continua_inv") break;

      const celdaSiguiente = celdaPorSeccion.get(siguienteSeccion);
      if (!celdaSiguiente || visitadas.has(siguienteSeccion)) break;
      visitadas.add(siguienteSeccion);

      if (tipoSalida === "continua") secuencia.push(celdaSiguiente.id);
      else secuencia.unshift(celdaSiguiente.id);

      seccionActual = siguienteSeccion;
    }

    cadenas.push({
      celdaInicioId: celdaInicio.id,
      anillo: celdaInicio.anillo,
      celdaIds: secuencia,
    });
  }

  return cadenas;
}

/** Agrupa gaps por anillo (mismo formato que agrupar celdas), para iterar anillo por anillo. */
export function agruparPorAnillo<T extends { anillo: number }>(
  items: T[],
): Map<number, T[]> {
  const mapa = new Map<number, T[]>();
  for (const item of items) {
    const lista = mapa.get(item.anillo) ?? [];
    lista.push(item);
    mapa.set(item.anillo, lista);
  }
  return mapa;
}

/** Arma las cadenas de TODOS los anillos de una rejilla, de una sola vez. */
export function armarTodasLasCadenas(
  rejilla: Rejilla,
  celdas: Celda[],
  gaps: Gap[],
  separadorPorGap: Record<string, TipoSeparador | undefined>,
): Cadena[] {
  const celdasPorAnillo = agruparPorAnillo(celdas);
  const gapsPorAnillo = agruparPorAnillo(gaps);
  const todas: Cadena[] = [];
  for (let a = 0; a < rejilla.anillos; a++) {
    todas.push(
      ...armarCadenasDeAnillo(
        celdasPorAnillo.get(a) ?? [],
        gapsPorAnillo.get(a) ?? [],
        separadorPorGap,
      ),
    );
  }
  return todas;
}
