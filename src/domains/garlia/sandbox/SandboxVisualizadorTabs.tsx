"use client";

import React, { useState } from "react";
import { SandboxPage } from "./SandboxPage";
import VisualizadorPage from "../visualizador/VisualizadorPage";

/**
 * Shell compartido para el laboratorio:
 * - No crea una ruta nueva.
 * - Mantiene Sandbox y Visualizador como dos tabs hermanas.
 * - Sandbox conserva toda su lógica y estado actuales.
 * - Visualizador sigue siendo una capa de presentación experimental.
 *
 * Integración: sustituir el montaje directo de <SandboxPage /> por
 * <SandboxVisualizadorTabs /> en el punto donde hoy se renderiza Sandbox.
 */
export default function SandboxVisualizadorTabs() {
  const [tab, setTab] = useState<"sandbox" | "visualizador">("sandbox");

  return (
    <div className="w-full">
      <div className="mx-auto flex max-w-6xl items-center gap-1 border-b border-primary/10 px-3 pt-2 sm:px-4">
        <button
          type="button"
          onClick={() => setTab("sandbox")}
          className={`border-b-2 px-3 py-2 text-micro font-black uppercase tracking-[0.16em] transition-colors ${
            tab === "sandbox"
              ? "border-primary text-primary"
              : "border-transparent text-primary/35 hover:text-primary/60"
          }`}
          aria-selected={tab === "sandbox"}
          role="tab"
        >
          Sandbox
        </button>
        <button
          type="button"
          onClick={() => setTab("visualizador")}
          className={`border-b-2 px-3 py-2 text-micro font-black uppercase tracking-[0.16em] transition-colors ${
            tab === "visualizador"
              ? "border-primary text-primary"
              : "border-transparent text-primary/35 hover:text-primary/60"
          }`}
          aria-selected={tab === "visualizador"}
          role="tab"
        >
          Visualizador
        </button>
      </div>

      <div hidden={tab !== "sandbox"} role="tabpanel">
        <SandboxPage />
      </div>
      <div hidden={tab !== "visualizador"} role="tabpanel">
        <VisualizadorPage />
      </div>
    </div>
  );
}
