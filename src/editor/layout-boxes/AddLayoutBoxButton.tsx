"use client";
import { PlusSquare } from "lucide-react";
import React from "react";

/**
 * Botón "añadir bloque" pensado para inyectarse en la toolbar interna de
 * RichEditor vía la prop `extraToolbarAction` — mismo tamaño/estilo que el
 * toggle de corrector ortográfico que vive al lado, para que se sienta
 * nativo de esa barra y no un control externo pegado con cinta.
 */
export function AddLayoutBoxButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 20,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: "color-mix(in srgb, var(--foreground) 60%, transparent)",
        transition: "color 0.1s",
      }}
      title="Añadir bloque de texto flotante"
      type="button"
      onClick={onClick}
    >
      <PlusSquare size={11} />
    </button>
  );
}
