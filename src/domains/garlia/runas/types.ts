/**
 * types.ts
 * ──────────
 * Tipos y configuración de domains/garlia/runas/.
 *
 * Antes vivía en domains/garlia/magia/types.ts y era compartido entre
 * Hechizos/Dones/Runas (con `Modo` y `CONFIG` por modo). Ahora que solo
 * queda Runas, se achica a constantes fijas — ya no hay nada que
 * seleccionar por modo.
 */

import { ScrollText } from "lucide-react";

import type { Punto } from "./dollarOneRecognizer";
import type { FormaLimite, Rejilla } from "./formasLimite";
import type { TipoSeparador } from "./separadores";

/**
 * Rango de precisión (score $1, 0..1) sobre el que se puede definir una
 * explicación distinta — pensado para dar feedback progresivo al
 * jugador según qué tan bien dibujó el trazo, no solo al llegar al
 * umbral de reconocimiento "oficial".
 */
export type RangoAcierto = "50-70" | "70-85" | "85-98" | "98-100";

export const RANGOS_ACIERTO: { key: RangoAcierto; label: string; min: number; max: number }[] = [
  { key: "50-70", label: "50% – 70%", min: 0.5, max: 0.7 },
  { key: "70-85", label: "70% – 85%", min: 0.7, max: 0.85 },
  { key: "85-98", label: "85% – 98%", min: 0.85, max: 0.98 },
  { key: "98-100", label: "98% – 100%", min: 0.98, max: 1.001 },
];

/** Encuentra el rango al que pertenece un score (0..1). Null si no llega al 50%. */
export function rangoParaScore(score: number): RangoAcierto | null {
  for (const r of RANGOS_ACIERTO) {
    if (score >= r.min && score < r.max) return r.key;
  }
  if (score >= 1) return "98-100";
  return null;
}

/**
 * Elige el texto a mostrarle al jugador según su score: primero busca la
 * explicación específica del rango correspondiente; si esa runa no tiene
 * una definida para ese rango, cae a la explicación general. Null si no
 * hay ninguna de las dos (o si el score no llegó al 50%).
 */
export function explicacionParaScore(
  runa: Pick<EntidadMagica, "explicacion" | "explicacion_por_rango">,
  score: number,
): string | null {
  const rango = rangoParaScore(score);
  if (!rango) return null;
  const especifica = runa.explicacion_por_rango?.[rango];
  if (especifica) return especifica;
  return runa.explicacion || null;
}

/**
 * Se mantiene el nombre `EntidadMagica` (en vez de renombrar a algo como
 * `EntidadRuna`) para minimizar diffs con el resto de los archivos
 * copiados sin cambios de lógica, que ya importan este tipo por ese
 * nombre. No tiene impacto funcional.
 */
export type EntidadMagica = {
  id: string;
  nombre: string;
  /** Explicación general/por defecto — se usa si no hay una específica
   *  del rango de acierto, o en contextos donde no aplica un score. */
  explicacion?: string;
  /** Explicación distinta según qué tan preciso fue el trazo del
   *  jugador (feedback progresivo). Cada clave es opcional — si el
   *  rango correspondiente no tiene texto propio, se cae a `explicacion`. */
  explicacion_por_rango?: Partial<Record<RangoAcierto, string>> | null;
  grupo_ids?: string[];
  /**
   * Lista de trazos-ejemplo (cada uno una polilínea de puntos crudos) que
   * definen cómo se "dibuja" esta runa. Se usan como plantillas del
   * reconocedor $1 Unistroke y también para el preview visual de la runa
   * (RunaThumbnail). Guardado como jsonb.
   */
  patron_trazos?: Punto[][] | null;
};

/**
 * Combinación de runas por celda ("hechizo compuesto"): definida en admin,
 * asocia un mapa exacto de celda→runa a un resultado especial distinto de
 * las runas individuales. Ej: celda "s0-a0" (centro) = runa Fuego + celda
 * "s0-a1" (anillo exterior) = runa Agua → resultado "Vapor".
 */
export type CombinacionRuna = {
  id: string;
  nombre: string;
  explicacion?: string | null;
  imagen_url?: string | null;
  /**
   * Forma exterior y rejilla (secciones × anillos) propias de esta
   * combinación. Antes eran una config global única (`config_runas`);
   * ahora cada combinación define su propio tablero, y el match exige
   * que el jugador haya dibujado sobre exactamente esta forma+rejilla
   * antes de siquiera comparar celdas/separadores (ver matchCombinacion.ts).
   */
  forma: FormaLimite;
  rejilla: Rejilla;
  /** Mapa celdaId → runaId. El match debe ser exacto: mismas celdas, ni de más ni de menos. */
  celdas: Record<string, string>;
  /**
   * Mapa gapId → tipo de separador exigido en ese gap. Igual de estricto
   * que `celdas`: el match exige exactamente estos gaps con exactamente
   * estos separadores, ni de más ni de menos. Opcional/vacío para
   * combinaciones que no dependen de separadores (rejillas de 1 sola
   * sección, o combinaciones que solo importan por runas).
   */
  separadores?: Record<string, TipoSeparador>;
};

// Grupo mínimo de criaturas
export type GrupoMin = {
  id: string;
  nombre: string;
  miembro_ids: string[];
};

export const CONFIG = {
  tabla: "runas",
  label: "Runas",
  labelSing: "Runa",
  Icon: ScrollText,
  color: "var(--primary)",
  placeholder: "Qué significa esta runa, cómo se activa, su poder…",
} as const;
