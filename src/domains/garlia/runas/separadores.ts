/**
 * separadores.ts
 * ────────────────
 * Sistema de separadores entre celdas de un mismo anillo.
 *
 * Cada anillo con N secciones tiene N "gaps" (uno por cada línea radial
 * que separa una sección de la siguiente, cíclico). En cada gap el
 * jugador dibuja uno de 4 símbolos, reconocidos con el mismo motor $1
 * que ya se usa para las runas (ver dollarOneRecognizer.ts):
 *
 *   INICIO      ⟩⟩  arranca una cadena nueva en esta celda
 *   CONTINUA    ⟩   la señal pasa a la siguiente celda (orden normal)
 *   CONTINUA_INV ⟨  la señal pasa a la siguiente celda, pero esa celda
 *                   se antepone a la secuencia en vez de agregarse al final
 *   CORTA       |   no propaga — la cadena termina acá (default)
 *
 * Las plantillas de trazo de estos 4 símbolos son fijas (definidas acá
 * como puntos, no dibujadas por cada admin) pero editables: ver
 * PanelPlantillasSeparadores.tsx para redibujarlas con el mismo canvas
 * que usa PanelPatronRuna. Se guardan en la tabla config_runas junto
 * con la rejilla (ver configRunas.ts) para que cualquier admin que las
 * cambie las cambie para todos.
 *
 * Ruta destino:
 *   src/features/editorGarlia/lib/separadores.ts
 */

import type { PatronRuna, Punto } from "./dollarOneRecognizer";

export type TipoSeparador = "inicio" | "continua" | "continua_inv" | "corta";

export const TIPOS_SEPARADOR: TipoSeparador[] = [
  "inicio",
  "continua",
  "continua_inv",
  "corta",
];

export const SIMBOLO_SEPARADOR: Record<TipoSeparador, string> = {
  inicio: "⟩⟩",
  continua: "⟩",
  continua_inv: "⟨",
  corta: "|",
};

export const LABEL_SEPARADOR: Record<TipoSeparador, string> = {
  inicio: "Inicio",
  continua: "Continúa",
  continua_inv: "Continúa invertido",
  corta: "Corta",
};

/**
 * Plantillas de trazo por defecto para cada separador, en un cuadrado
 * lógico de 100×100 (se reescalan solas al comparar, el $1 recognizer
 * es indiferente a tamaño/posición). Sirven como fallback si el admin
 * todavía no redibujó las suyas.
 *
 * — inicio ⟩⟩: doble flecha, dos trazos en V encadenados
 * — continua ⟩: una sola flecha en V apuntando a la derecha
 * — continua_inv ⟨: una sola flecha en V apuntando a la izquierda
 * — corta ⊥: una línea vertical con un travesaño en la base (forma de T
 *   invertida), no una línea recta simple.
 *
 * Nota sobre "corta": antes era solo 2 puntos, una línea perfectamente
 * recta. El $1 recognizer normaliza todo trazo a un cuadrado 250×250
 * antes de comparar — una línea recta pura no tiene ninguna geometría
 * interna distintiva contra la que rotar/matchear, así que terminaba
 * confundida con cualquier trazo corto y recto en cualquier ángulo
 * (incluida media línea radial mal dibujada, o el tramo inicial de
 * "continua"/"continua_inv" antes de que el jugador llegara al quiebre
 * de la V). Agregarle el travesaño le da una forma con esquina real,
 * igual que los otros tres símbolos, y la vuelve distinguible.
 */
export const PLANTILLAS_SEPARADOR_DEFAULT: Record<TipoSeparador, Punto[]> = {
  inicio: [
    { x: 20, y: 10 },
    { x: 45, y: 50 },
    { x: 20, y: 90 },
    { x: 50, y: 90 },
    { x: 75, y: 50 },
    { x: 50, y: 10 },
  ],
  continua: [
    { x: 30, y: 10 },
    { x: 70, y: 50 },
    { x: 30, y: 90 },
  ],
  continua_inv: [
    { x: 70, y: 10 },
    { x: 30, y: 50 },
    { x: 70, y: 90 },
  ],
  corta: [
    { x: 50, y: 10 },
    { x: 50, y: 90 },
    { x: 30, y: 90 },
    { x: 70, y: 90 },
  ],
};

/** Convierte el mapa de plantillas (custom o default) al formato que espera reconocerRuna. */
export function patronesSeparadores(
  plantillas: Partial<Record<TipoSeparador, Punto[][]>> | null | undefined,
): PatronRuna[] {
  return TIPOS_SEPARADOR.map((tipo) => ({
    runaId: tipo,
    nombre: LABEL_SEPARADOR[tipo],
    trazos: plantillas?.[tipo]?.length
      ? plantillas[tipo]
      : [PLANTILLAS_SEPARADOR_DEFAULT[tipo]],
  }));
}

/** Path SVG (para <polyline points="...">) de una plantilla, útil para previsualizarla en admin. */
export function pathPreviewSeparador(puntos: Punto[]): string {
  return puntos.map((p) => `${p.x},${p.y}`).join(" ");
}
