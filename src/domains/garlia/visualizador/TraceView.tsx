"use client";

/**
 * TraceView.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Muestra una ruta/cadena YA RESUELTA por el llamador (ej. Partícula → IUM
 * → Oris, o Partícula → Capa → Elemento). No calcula procedencia ni
 * relaciones — solo recibe los pasos en orden y los pinta como una traza
 * iluminada, con soporte para click (navegar a ese paso) y para marcar
 * pasos sin dato disponible ("—") sin inventar contenido.
 */

import React from "react";
import { ChevronDown } from "lucide-react";

export interface TraceStep {
  id: string;
  levelLabel: string;
  title: string | null;
  subtitle?: string | null;
}

export function TraceView({
  steps,
  activeStepId,
  onSelectStep,
  direction = "down",
}: {
  steps: TraceStep[];
  activeStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
  /** Solo afecta el ícono de flecha entre pasos; el orden de "steps" manda. */
  direction?: "down" | "up";
}) {
  if (steps.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-primary/12 p-4 text-center text-[11px] text-primary/35">
        Sin traza disponible.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-stretch gap-0">
      {steps.map((step, i) => {
        const isActive = activeStepId === step.id;
        const hasData = step.title !== null;
        const Comp: any = onSelectStep ? "button" : "div";
        return (
          <React.Fragment key={step.id}>
            <Comp
              type={onSelectStep ? "button" : undefined}
              onClick={onSelectStep ? () => onSelectStep(step.id) : undefined}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                isActive
                  ? "border-primary/40 bg-primary/10"
                  : "border-primary/10 bg-primary/[0.02]"
              } ${onSelectStep ? "hover:border-primary/30 hover:bg-primary/8 cursor-pointer" : ""}`}
            >
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-primary/35">
                {step.levelLabel}
              </p>
              <p className={`mt-0.5 text-xs font-black ${hasData ? "text-primary/85" : "text-primary/30"}`}>
                {hasData ? step.title : "Sin dato"}
              </p>
              {step.subtitle ? (
                <p className="mt-0.5 text-[10px] text-primary/45">{step.subtitle}</p>
              ) : null}
            </Comp>
            {i < steps.length - 1 ? (
              <div className="flex justify-center py-0.5">
                <ChevronDown
                  size={14}
                  className={direction === "down" ? "text-primary/25" : "text-primary/25 rotate-180"}
                />
              </div>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}
