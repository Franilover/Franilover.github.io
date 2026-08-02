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

/**
 * Se mantiene el nombre `EntidadMagica` (en vez de renombrar a algo como
 * `EntidadRuna`) para minimizar diffs con el resto de los archivos
 * copiados sin cambios de lógica, que ya importan este tipo por ese
 * nombre. No tiene impacto funcional.
 */
export type EntidadMagica = {
  id: string;
  nombre: string;
  explicacion?: string;
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
  /** Mapa celdaId → runaId. El match debe ser exacto: mismas celdas, ni de más ni de menos. */
  celdas: Record<string, string>;
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
