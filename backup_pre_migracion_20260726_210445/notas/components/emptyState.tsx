"use client";
import { PenTool, Plus } from "lucide-react";
import React from "react";

import { MotionDiv } from "@/components/ui/Motion";

interface EmptyStateProps {
  onCrearEnsayo?: () => void;
}

export function EmptyState({ onCrearEnsayo }: EmptyStateProps) {
  const monoStyle: React.CSSProperties = { fontFamily: "var(--font-mono)" };

  return (
    <MotionDiv
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center gap-6"
      initial={{ opacity: 0 }}
    >
      {/* ASCII-style decorative border */}
      <div style={{ color: "color-mix(in srgb, var(--foreground) 6%, transparent)", ...monoStyle, fontSize: 11, lineHeight: 1.4, userSelect: "none" }}>
        {"┌─────────────────────────────────┐"}<br />
        {"│                                 │"}<br />
        {"│                                 │"}<br />
        {"│                                 │"}<br />
        {"└─────────────────────────────────┘"}
      </div>

      <div style={{ position: "absolute" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            background: "color-mix(in srgb, var(--foreground) 4%, transparent)",
            border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "color-mix(in srgb, var(--foreground) 15%, transparent)",
            margin: "0 auto 16px",
          }}
        >
          <PenTool size={20} />
        </div>
        <p
          style={{
            fontSize: 14,
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            color: "color-mix(in srgb, var(--foreground) 25%, transparent)",
            marginBottom: 6,
          }}
        >
          ninguna nota seleccionada
        </p>
        <p style={{ fontSize: 10, color: "color-mix(in srgb, var(--foreground) 12%, transparent)", ...monoStyle }}>
          selecciona una nota del panel o crea una nueva
        </p>

        {onCrearEnsayo && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              className="flex items-center gap-2"
              style={{
                fontSize: 11,
                padding: "7px 16px",
                background: "color-mix(in srgb, var(--foreground) 6%, transparent)",
                border: "1px solid color-mix(in srgb, var(--foreground) 12%, transparent)",
                borderRadius: 6,
                color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
                cursor: "pointer",
                ...monoStyle,
              }}
              onClick={onCrearEnsayo}
            >
              <Plus size={12} />
              nueva nota
              <kbd
                style={{
                  fontSize: 9,
                  padding: "1px 5px",
                  borderRadius: 3,
                  background: "color-mix(in srgb, var(--foreground) 6%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
                  color: "color-mix(in srgb, var(--foreground) 25%, transparent)",
                  ...monoStyle,
                }}
              >
                N
              </kbd>
            </button>
          </div>
        )}
      </div>
    </MotionDiv>
  );
}

export default EmptyState;