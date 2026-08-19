"use client";

/**
 * SugerenciaReglasDndPanel.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * "Este ítem parece un arma/armadura" — lee sugerirReglasDndDesdeComposicion
 * (afinidad.ts) sobre la composición actual del Item y, si hay una señal
 * clara (Voluntad/Cinética dominante → arma; Catálisis/Equilibrio →
 * armadura), ofrece un botón para aplicarla. Nunca marca nada solo: es una
 * sugerencia que el editor humano acepta o ignora, igual que
 * generarDescripcionElemento sugiere texto sin forzarlo.
 *
 * No se muestra si ya está marcado como arma/armadura (nada que sugerir) ni
 * si la composición no arroja una señal clara.
 */

import { Lightbulb } from "lucide-react";
import React, { useMemo } from "react";

import { sugerirReglasDndDesdeComposicion } from "@/domains/garlia/elementos/afinidad";
import type { Compuesto, Elemento } from "@/domains/garlia/elementos/types";

export function SugerenciaReglasDndPanel({
  composicion,
  compuestos,
  elementos,
  yaEsArma,
  yaEsArmadura,
  onAplicar,
}: {
  composicion: { compuesto_id: string; tag: string }[];
  compuestos: Compuesto[];
  elementos: Elemento[];
  yaEsArma: boolean;
  yaEsArmadura: boolean;
  onAplicar: (cambios: { es_arma?: boolean; es_armadura?: boolean; dado_dano?: string | null }) => void;
}) {
  const sugerencia = useMemo(
    () => sugerirReglasDndDesdeComposicion(composicion, compuestos, elementos),
    [composicion, compuestos, elementos],
  );

  if (!sugerencia) return null;
  if (sugerencia.campo === "es_arma" && yaEsArma) return null;
  if (sugerencia.campo === "es_armadura" && yaEsArmadura) return null;

  return (
    <div className="mt-2 flex items-start gap-2 p-2 rounded-lg border border-dashed border-accent/25 bg-accent/[0.03]">
      <Lightbulb size={12} className="shrink-0 text-accent/60 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-micro text-primary/60 leading-snug">{sugerencia.motivo}</p>
      </div>
      <button
        type="button"
        onClick={() =>
          onAplicar(
            sugerencia.campo === "es_arma"
              ? { es_arma: true, dado_dano: sugerencia.dadoDanoSugerido }
              : { es_armadura: true },
          )
        }
        className="shrink-0 text-micro font-black uppercase tracking-wide px-2 py-1 rounded border border-accent/30 text-accent/70 hover:text-accent hover:border-accent/50 hover:bg-accent/5 transition-all cursor-pointer"
      >
        {sugerencia.campo === "es_arma" ? "Marcar como arma" : "Marcar como armadura"}
      </button>
    </div>
  );
}
