"use client";

/**
 * PanelFlotanteGlobal
 * ───────────────────────────────────────────────────────────────────────────
 * Único punto de renderizado para la "vista rápida" de Personaje/Criatura/
 * Reino/Item/Flora/Mineral: el EDITOR COMPLETO (mismo PersonajeEditor/
 * CriaturaEditor/ReinoEditor/ItemEditor/FloraEditor/MineralEditor que se usa
 * a pantalla completa en EntidadesPage), pero flotando centrado en pantalla por encima de la vista actual — sin
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

import { Bug, Check, Crown, Diamond, Gem, Leaf, Save, Trash2, Users, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { SaveIndicator as SaveIndicatorInline } from "@/domains/garlia/_shared/UIComponents";

import { type EditorHeaderControls } from "./useEditorHeaderControls";

import { useSupabaseData } from "@/infra/sync/useSupabaseData";
import { PersonajeEditor } from "@/domains/garlia/personajes/PersonajeEditor";
import { CriaturaEditor } from "@/domains/garlia/criaturas/CriaturaEditor";
import { ReinoEditor } from "@garlia/reinos";
import { ItemEditor } from "@garlia/items";
import { FloraEditor } from "@/domains/garlia/flora/FloraEditor";
import { useFlora } from "@/domains/garlia/flora/useFlora";
import { type Flora } from "@/domains/garlia/flora/types";
import { MineralEditor } from "@/domains/garlia/minerales/MineralEditor";
import { useMinerales } from "@/domains/garlia/minerales/useMinerales";
import { type Mineral } from "@/domains/garlia/minerales/types";
import type { Personaje } from "@garlia/personajes";
import type { Criatura } from "@/domains/garlia/criaturas/types";
import type { Reino } from "@garlia/reinos";
import type { Item } from "@garlia/items";

import { usePanelFlotante } from "./usePanelFlotanteStore";

export function PanelFlotanteGlobal() {
  const entidad = usePanelFlotante((s) => s.entidad);
  const cerrar = usePanelFlotante((s) => s.cerrar);

  // Controles publicados por el editor activo (nombre editable, guardar,
  // eliminar, extras específicos) — reemplazan la barra propia que cada
  // editor solía renderizar, así solo hay UNA barra superior en la vista
  // rápida en vez de dos casi idénticas apiladas.
  const [headerControls, setHeaderControls] = useState<EditorHeaderControls | null>(null);
  // Confirmación inline (ver EditorHeaderBar): evita el modal centrado que
  // parpadeaba al chocar con el backdrop-filter de este mismo panel.
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);

  // Al cambiar de entidad (o cerrar), se limpia lo publicado por la
  // anterior para no arrastrar controles obsoletos mientras el nuevo
  // editor todavía no publica los suyos.
  useEffect(() => {
    setHeaderControls(null);
    setConfirmandoEliminar(false);
  }, [entidad?.kind, entidad?.id]);

  const { data: personajes } = useSupabaseData<Personaje>("personajes");
  const { data: criaturas } = useSupabaseData<Criatura>("criaturas");
  const { data: reinos } = useSupabaseData<Reino>("reinos");
  const { data: items } = useSupabaseData<Item>("items");
  const { flora } = useFlora();
  const { minerales } = useMinerales();

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
  const floraSel = entidad.kind === "flora" ? flora.find((x) => x.id === entidad.id) : null;
  const mineralSel = entidad.kind === "mineral" ? minerales.find((x) => x.id === entidad.id) : null;
  if (entidad.kind === "personaje" && !personaje) return null;
  if (entidad.kind === "criatura" && !criatura) return null;
  if (entidad.kind === "reino" && !reino) return null;
  if (entidad.kind === "item" && !item) return null;
  if (entidad.kind === "flora" && !floraSel) return null;
  if (entidad.kind === "mineral" && !mineralSel) return null;

  const Icon =
    entidad.kind === "personaje"
      ? Users
      : entidad.kind === "criatura"
        ? Bug
        : entidad.kind === "reino"
          ? Crown
          : entidad.kind === "item"
            ? Gem
            : entidad.kind === "flora"
              ? Leaf
              : Diamond;
  const label =
    entidad.kind === "personaje"
      ? "Personaje"
      : entidad.kind === "criatura"
        ? "Criatura"
        : entidad.kind === "reino"
          ? "Reino"
          : entidad.kind === "item"
            ? "Item"
            : entidad.kind === "flora"
              ? "Flora"
              : "Mineral";
  const nombre =
    entidad.kind === "personaje"
      ? personaje!.nombre
      : entidad.kind === "criatura"
        ? criatura!.nombre
        : entidad.kind === "reino"
          ? reino!.nombre
          : entidad.kind === "item"
            ? item!.nombre
            : entidad.kind === "flora"
              ? floraSel!.nombre
              : mineralSel!.nombre;

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
          <p className="shrink-0 text-micro font-black uppercase tracking-[0.15em] text-primary/40">
            {label}
          </p>

          {/* Nombre editable + acciones del editor activo (guardar,
              eliminar, extras) — publicados por el editor vía
              onHeaderControlsChange. Mientras no haya llegado la primera
              publicación (frame inicial), se muestra el nombre de solo
              lectura como fallback para no parpadear a vacío. */}
          {headerControls ? (
            <>
              <input
                className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
                placeholder={headerControls.placeholderNombre}
                value={headerControls.nombre ?? ""}
                onChange={(e) => headerControls.onChangeNombre(e.target.value)}
                onBlur={headerControls.onBlurNombre}
              />
              {headerControls.subtitulo && (
                <span
                  className="shrink min-w-0 truncate text-micro font-bold text-primary/40"
                  title={
                    typeof headerControls.subtitulo === "string"
                      ? headerControls.subtitulo
                      : undefined
                  }
                >
                  · {headerControls.subtitulo}
                </span>
              )}
              {headerControls.extra}
              <div className="shrink-0 flex items-center gap-1.5">
                <SaveIndicatorInline status={headerControls.status} />
                {confirmandoEliminar ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-micro font-black uppercase text-red-400 tracking-wide">
                      ¿Eliminar?
                    </span>
                    <button
                      className="flex items-center justify-center w-6 h-6 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all"
                      title="Confirmar"
                      type="button"
                      onClick={() => {
                        setConfirmandoEliminar(false);
                        headerControls.onEliminar();
                      }}
                    >
                      <Check size={11} />
                    </button>
                    <button
                      className="flex items-center justify-center w-6 h-6 rounded-lg border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/30 transition-all"
                      title="Cancelar"
                      type="button"
                      onClick={() => setConfirmandoEliminar(false)}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all"
                    type="button"
                    onClick={() => setConfirmandoEliminar(true)}
                  >
                    <Trash2 size={10} />
                  </button>
                )}
                <button
                  className="flex items-center gap-1 px-3 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
                  disabled={headerControls.status === "saving"}
                  type="button"
                  onClick={headerControls.onGuardar}
                >
                  <Save size={10} /> Guardar
                </button>
              </div>
            </>
          ) : (
            <p className="flex-1 min-w-0 text-xs font-bold text-primary truncate">{nombre}</p>
          )}

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
            <PersonajeEditor
              key={personaje!.id}
              personaje={personaje!}
              onHeaderControlsChange={setHeaderControls}
            />
          ) : entidad.kind === "criatura" ? (
            <CriaturaEditor
              key={criatura!.id}
              criatura={criatura!}
              onHeaderControlsChange={setHeaderControls}
            />
          ) : entidad.kind === "reino" ? (
            <ReinoEditor
              key={reino!.id}
              reino={reino!}
              onHeaderControlsChange={setHeaderControls}
            />
          ) : entidad.kind === "item" ? (
            <ItemEditor
              key={item!.id}
              item={item!}
              onDeleted={() => cerrar()}
              onHeaderControlsChange={setHeaderControls}
            />
          ) : entidad.kind === "flora" ? (
            <FloraEditor
              key={floraSel!.id}
              flora={floraSel as Flora}
              onDeleted={() => cerrar()}
              onHeaderControlsChange={setHeaderControls}
            />
          ) : (
            <MineralEditor
              key={mineralSel!.id}
              mineral={mineralSel as Mineral}
              onDeleted={() => cerrar()}
              onHeaderControlsChange={setHeaderControls}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
