"use client";

import React, { useEffect, useState } from "react";

import type { SaveStatus } from "@/ui/saveStatus";

/**
 * Punto de color que refleja el estado de guardado:
 *   - amarillo pulsante → guardando
 *   - verde             → guardado con éxito
 *   - rojo              → error al guardar
 *   - (nada)            → idle, o pasaron 5s desde el último resultado
 *
 * Se auto-oculta 5s después de llegar a "saved" o "error" — no hace falta
 * que el padre limpie el status con un timeout propio, este componente ya
 * lo maneja con un pequeño estado de visibilidad interno.
 */
export function SaveDot({
  status,
  title,
}: {
  status: SaveStatus;
  title?: string;
}) {
  const [visible, setVisible] = useState(status !== "idle");

  useEffect(() => {
    if (status === "idle") {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (status === "saving") return; // se queda visible mientras dure

    const t = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(t);
  }, [status]);

  if (!visible || status === "idle") return null;

  const color =
    status === "saving"
      ? "#eab308" // amarillo
      : status === "saved"
        ? "#22c55e" // verde
        : "#ef4444"; // rojo (error)

  const label =
    status === "saving" ? "Guardando…" : status === "saved" ? "Guardado" : "Error al guardar";

  return (
    <span
      aria-label={label}
      className="inline-flex items-center justify-center shrink-0 transition-opacity duration-300"
      style={{ width: 8, height: 8 }}
      title={title ?? label}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 0 0 ${color}`,
          animation: status === "saving" ? "save-dot-pulse 1s ease-in-out infinite" : undefined,
        }}
      />
      <style jsx>{`
        @keyframes save-dot-pulse {
          0% {
            opacity: 1;
            transform: scale(0.85);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.15);
          }
          100% {
            opacity: 1;
            transform: scale(0.85);
          }
        }
      `}</style>
    </span>
  );
}
