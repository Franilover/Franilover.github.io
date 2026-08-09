"use client";

/**
 * FullscreenEntityPanel
 * ───────────────────────────────────────────────────────────────────────────
 * Panel flotante a PANTALLA COMPLETA (portal, overlay por encima de todo)
 * que muestra el editor completo de Personaje o Criatura — el mismo
 * PersonajeEditor/CriaturaEditor que se usa en EntidadesPage, solo que acá
 * flota sobre la vista actual en vez de reemplazarla.
 *
 * Se abre exclusivamente vía useFullscreenEntityPanel (click del medio en
 * una EntityCard de Personaje/Criatura dentro de GeografiaJerarquica o
 * CriaturasJerarquica). Se monta una sola vez en EditorMundoRoot y no
 * renderiza nada mientras el store no tenga una entidad abierta.
 *
 * Cierre: botón X, tecla Escape, o click en el fondo (fuera del panel).
 */

import { Bug, Users, X } from "lucide-react";
import React, { useEffect } from "react";
import { createPortal } from "react-dom";

import { CriaturaEditor } from "@/domains/garlia/criaturas/CriaturaEditor";
import { PersonajeEditor } from "@garlia/personajes";

import { useFullscreenEntityPanel } from "./useFullscreenEntityPanelStore";

export function FullscreenEntityPanel() {
  const entity = useFullscreenEntityPanel((s) => s.entity);
  const close = useFullscreenEntityPanel((s) => s.close);

  useEffect(() => {
    if (!entity) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    // Evita el scroll del fondo mientras el panel está abierto.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [entity, close]);

  if (!entity || typeof document === "undefined") return null;

  const Icon = entity.kind === "personaje" ? Users : Bug;
  const label = entity.kind === "personaje" ? "Personaje" : "Criatura";

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
      style={{
        background: "color-mix(in srgb, var(--primary) 35%, transparent)",
        backdropFilter: "blur(8px)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="w-full h-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: "var(--bg-main)",
          border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
          animation: "popIn 160ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div
          className="shrink-0 flex items-center gap-3 px-4 py-3 border-b"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
          }}
        >
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              background: "color-mix(in srgb, var(--primary) 8%, transparent)",
              borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
            }}
          >
            <Icon className="text-primary/50" size={12} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
              {label} · vista rápida
            </p>
            <p className="text-xs font-bold text-primary truncate">{entity.data.nombre}</p>
          </div>
          <button
            type="button"
            onClick={close}
            title="Cerrar (Esc)"
            className="shrink-0 p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/8 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {entity.kind === "personaje" ? (
            <PersonajeEditor key={entity.data.id} personaje={entity.data} />
          ) : (
            <CriaturaEditor key={entity.data.id} criatura={entity.data} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
