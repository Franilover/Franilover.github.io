/**
 * types.ts
 * ──────────
 * Tipos y configuración compartida entre los componentes/hooks de
 * components/magia/.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/magia/types.ts
 */

import { Sparkles, Star, ScrollText } from "lucide-react";
import type React from "react";

import type { Punto } from "./dollarOneRecognizer";

export type Hechizo = {
  id: string;
  nombre: string;
  explicacion?: string;
  grupo_ids?: string[];
  imagen_url?: string | null;
  /**
   * Solo para runas: lista de trazos-ejemplo (cada uno una polilínea de
   * puntos crudos) que definen cómo se "dibuja" esta runa. Se usan como
   * plantillas del reconocedor $1 Unistroke. Guardado como jsonb.
   */
  patron_trazos?: Punto[][] | null;
};

export type Don = Hechizo;

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

export type EntidadMagica = Hechizo;
export type Modo = "hechizos" | "dones" | "runas";

// Grupo mínimo de criaturas
export type GrupoMin = {
  id: string;
  nombre: string;
  miembro_ids: string[];
};

export const CONFIG: Record<
  Modo,
  {
    tabla: string;
    label: string;
    labelSing: string;
    Icon: React.ElementType;
    color: string;
    placeholder: string;
  }
> = {
  hechizos: {
    tabla: "hechizos",
    label: "Hechizos",
    labelSing: "Hechizo",
    Icon: Sparkles,
    color: "var(--accent)",
    placeholder: "Qué hace este hechizo, cómo se lanza, sus efectos…",
  },
  dones: {
    tabla: "dones",
    label: "Dones",
    labelSing: "Don",
    Icon: Star,
    color: "color-mix(in srgb, var(--accent) 70%, var(--primary))",
    placeholder: "Qué otorga este don, su origen, sus limitaciones…",
  },
  runas: {
    tabla: "runas",
    label: "Runas",
    labelSing: "Runa",
    Icon: ScrollText,
    color: "var(--primary)",
    placeholder: "Qué significa esta runa, cómo se activa, su poder…",
  },
};
