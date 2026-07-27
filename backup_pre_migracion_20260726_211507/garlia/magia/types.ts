/**
 * types.ts
 * ──────────
 * Tipos y configuración compartida entre la view EditorHechizos
 * y los componentes/hooks de components/magia/.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/magia/types.ts
 */

import { Sparkles, Star, ScrollText } from "lucide-react";
import type React from "react";

export type Hechizo = {
  id: string;
  nombre: string;
  explicacion?: string;
  grupo_ids?: string[];
  imagen_url?: string | null;
  criatura_id?: string | null;
  criatura?: { id: string; nombre: string; imagen_url?: string | null } | null;
};

export type Don = Hechizo;

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
