"use client";

/**
 * PanelFlotanteGlobal
 * ───────────────────────────────────────────────────────────────────────────
 * Único punto de renderizado para la "vista rápida" de Personaje/Criatura/
 * Reino/Item: el EDITOR COMPLETO (mismo PersonajeEditor/CriaturaEditor/
 * ReinoEditor/ItemEditor que se usa a pantalla completa en EntidadesPage), pero
 * flotando centrado en pantalla por encima de la vista actual — sin
 * navegar, sin perder el lugar donde estabas. Es el mismo comportamiento
 * que antes daba el click del medio + FullscreenEntityPanel, solo que
 * ahora se dispara con click izquierdo normal desde cualquier parte de la
 * app vía usePanelFlotante().abrir(kind, id), y el panel no ocupa el 100%
 * de la pantalla sino un modal grande centrado con backdrop.
 *
 * Resuelve los datos por id vía useSupabaseData (mismo cache que ya usa
 * EntidadesPage — sin fetch nuevo). Reusa PersonajeEditor/CriaturaEditor/
 * ReinoEditor/ItemEditor tal cual (mismos wrappers que ya resuelven toda su
 * navegación interna contra el store global, incluido abrirPanel() para
 * entidades relacionadas), así que una entidad relacionada abierta desde
 * acá reemplaza el contenido del mismo panel en vez de apilar otro.
 *
 * Se monta UNA sola vez en EditorMundoRoot. Cierre: botón X, Escape, o
 * click en el backdrop.
 */

import { Bug, Crown, Gem, Users, X } from "lucide-react";
import React, { useEffect } from "react";
import { createPortal } from "react-dom";

import { useSupabaseData } from "@/infra/sync/useSupabaseData";
import { PersonajeEditor } from "@/domains/garlia/personajes/PersonajeEditor";
import { CriaturaEditor } from "@/domains/garlia/criaturas/CriaturaEditor";
import { ReinoEditor } from "@garlia/reinos";
import { ItemEditor } from "@garlia/items";
import type { Personaje } from "@garlia/personajes";
import type { Criatura } from "@/domains/garlia/criaturas/types";
import type { Reino } from "@garlia/reinos";
import type { Item } from "@garlia/items";

import { usePanelFlotante } from "./usePanelFlotanteStore";

export function PanelFlotanteGlobal() {
  const entidad = usePanelFlotante((s) => s.entidad);
  const cerrar = usePanelFlotante((s) => s.cerrar);

  const { data: personajes } = useSupabaseData<Personaje>("personajes");
  const { data: criaturas } = useSupabaseData<Criatura>("criaturas");
  const { data: reinos } = useSupabaseData<Reino>("reinos");
  const { data: items } = useSupabaseData<Item>("items");

  useEffect(() => {
    if (!entidad) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", onKeyDown);
    // Evita el scroll del fondo mientras el panel está abierto.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [entidad, cerrar]);

  if (!entidad || typeof document === "undefined") return null;

  const personaje = entidad.kind === "personaje" ? personajes.find((x) => x.id === entidad.id) : null;
  const criatura = entidad.kind === "criatura" ? criaturas.find((x) => x.id === entidad.id) : null;
  const reino = entidad.kind === "reino" ? reinos.find((x) => x.id === entidad.id) : null;
  const item = entidad.kind === "item" ? items.find((x) => x.id === entidad.id) : null;
  if (entidad.kind === "personaje" && !personaje) return null;
  if (entidad.kind === "criatura" && !criatura) return null;
  if (entidad.kind === "reino" && !reino) return null;
  if (entidad.kind === "item" && !item) return null;

  const Icon =
    entidad.kind === "personaje" ? Users : entidad.kind === "criatura" ? Bug : entidad.kind === "reino" ? Crown : Gem;
  const label =
    entidad.kind === "personaje"
      ? "Personaje"
      : entidad.kind === "criatura"
        ? "Criatura"
        : entidad.kind === "reino"
          ? "Reino"
          : "Item";
  const nombre =
    entidad.kind === "personaje"
      ? personaje!.nombre
      : entidad.kind === "criatura"
        ? criatura!.nombre
        : entidad.kind === "reino"
          ? reino!.nombre
          : item!.nombre;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
      style={{
        background: "color-mix(in srgb, var(--primary) 35%, transparent)",
        backdropFilter: "blur(8px)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cerrar();
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
            <p className="text-xs font-bold text-primary truncate">{nombre}</p>
          </div>
          <button
            type="button"
            onClick={cerrar}
            title="Cerrar (Esc)"
            className="shrink-0 p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/8 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {entidad.kind === "personaje" ? (
            <PersonajeEditor key={personaje!.id} personaje={personaje!} />
          ) : entidad.kind === "criatura" ? (
            <CriaturaEditor key={criatura!.id} criatura={criatura!} />
          ) : entidad.kind === "reino" ? (
            <ReinoEditor key={reino!.id} reino={reino!} />
          ) : (
            <ItemEditor key={item!.id} item={item!} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
