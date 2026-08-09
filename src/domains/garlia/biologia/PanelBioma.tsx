"use client";

/**
 * PanelBioma.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Panel de detalle de un Bioma: nombre, afinidad con Oris/elementos,
 * descripción, reinos vinculados (M:N) y la lista de sus ecosistemas
 * (subzonas concretas dentro de este bioma).
 */

import { ArrowLeft, Compass, Leaf, Plus, Trash2, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { RichEditor } from "@/editor/lexical";
import { SeccionEntidad } from "@/ui/SeccionEntidad";

import { useReinosMin } from "@/domains/garlia/reinos/useReinosMin";

import { SelectorReinosMulti } from "./SelectorReinosMulti";
import { BIOMA_ICON, type Bioma, type Ecosistema } from "./types";
import { useEcosistemas } from "./useBiologia";

export function PanelBioma({
  bioma,
  ecosistemas,
  onSave,
  onDelete,
  onVolver,
  onSelectReino,
  onSelectEcosistema,
  onCrearEcosistema,
  creandoEcosistema,
  modoPopover = false,
}: {
  bioma: Bioma;
  /** Ecosistemas cuyo bioma_id apunta a este bioma. */
  ecosistemas: Ecosistema[];
  onSave: (updates: Partial<Bioma>) => void;
  onDelete: () => void;
  onVolver: () => void;
  onSelectReino?: (id: string) => void;
  onSelectEcosistema?: (id: string) => void;
  onCrearEcosistema?: () => void;
  creandoEcosistema?: boolean;
  /** true cuando se renderiza dentro de un popover flotante: el botón
   *  izquierdo pasa de "volver" (flecha) a "cerrar" (X), ya que no hay
   *  navegación de por medio — el popover se cierra con click afuera,
   *  Escape, o este botón. */
  modoPopover?: boolean;
}) {
  const [nombre, setNombre] = useState(bioma.nombre);
  const [afinidad, setAfinidad] = useState(bioma.afinidad ?? "");
  const [descripcion, setDescripcion] = useState(bioma.descripcion ?? "");

  useEffect(() => {
    setNombre(bioma.nombre);
    setAfinidad(bioma.afinidad ?? "");
    setDescripcion(bioma.descripcion ?? "");
  }, [bioma.id]);

  const guardar = () => {
    onSave({ nombre: nombre.trim() || bioma.nombre, afinidad, descripcion });
  };

  // ── Reinos (M:N vía bioma.reino_ids) — sección de barra lateral, mismo
  // patrón que Personajes/Criaturas/Ítems en LoreTab (reinos/EditorReino). ──
  const catalogoReinos = useReinosMin();
  const reinoIds = bioma.reino_ids ?? [];
  const allReinosEntidad = useMemo(
    () => catalogoReinos.map((r) => ({ id: r.id, nombre: r.nombre })),
    [catalogoReinos],
  );
  const handleToggleReino = (id: string, add: boolean) => {
    const next = add
      ? [...reinoIds, id]
      : reinoIds.filter((x) => x !== id);
    onSave({ reino_ids: next });
  };

  // ── Ecosistemas (1:N vía ecosistema.bioma_id) — misma sección Entidad,
  // pero el "toggle" acá vincula/desvincula el ecosistema a ESTE bioma
  // (add=true → bioma_id = bioma.id, add=false → bioma_id = null). ──
  const { ecosistemas: catalogoEcosistemas, loading: loadingEcosistemas, actualizar: actualizarEcosistema } =
    useEcosistemas();
  const ecosistemaIds = useMemo(
    () => catalogoEcosistemas.filter((e) => e.bioma_id === bioma.id).map((e) => e.id),
    [catalogoEcosistemas, bioma.id],
  );
  const allEcosistemasEntidad = useMemo(
    () => catalogoEcosistemas.map((e) => ({ id: e.id, nombre: e.nombre })),
    [catalogoEcosistemas],
  );
  const handleToggleEcosistema = (id: string, add: boolean) => {
    void actualizarEcosistema(id, { bioma_id: add ? bioma.id : null });
  };

  const sidebar = (
    <>
      <SeccionEntidad
        allEntities={allReinosEntidad}
        emptyLabel="Sin reinos"
        fallbackIcon={<Compass size={14} strokeWidth={1} />}
        fill={false}
        icon={<Compass size={9} />}
        label="Reinos"
        loading={false}
        saving={false}
        selectedIds={reinoIds}
        onEntityClick={onSelectReino}
        onToggle={handleToggleReino}
      />
      <div
        style={{
          borderTop:
            "1px solid color-mix(in srgb, var(--primary) 7%, transparent)",
        }}
      />
      <SeccionEntidad
        allEntities={allEcosistemasEntidad}
        emptyLabel="Sin ecosistemas"
        fallbackIcon={<Leaf size={14} strokeWidth={1} />}
        fill={false}
        icon={<Leaf size={9} />}
        label="Ecosistemas"
        loading={loadingEcosistemas}
        saving={false}
        selectedIds={ecosistemaIds}
        onEntityClick={onSelectEcosistema}
        onToggle={handleToggleEcosistema}
      />
      {onCrearEcosistema && (
        <div className="shrink-0 px-2 pb-1.5">
          <button
            type="button"
            disabled={creandoEcosistema}
            onClick={onCrearEcosistema}
            className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors disabled:opacity-40"
          >
            <Plus size={10} /> Nuevo ecosistema
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className={modoPopover ? "flex h-full min-h-0" : undefined}>
      <div className={modoPopover ? "flex-1 min-w-0 flex flex-col min-h-0" : undefined}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <button
          type="button"
          onClick={() => {
            guardar();
            onVolver();
          }}
          className="shrink-0 p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
        >
          {modoPopover ? <X size={14} /> : <ArrowLeft size={14} />}
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <BIOMA_ICON size={12} className="text-accent/60 shrink-0" />
          <input
            className="flex-1 min-w-0 bg-transparent text-sm font-black uppercase italic tracking-tight text-primary truncate outline-none placeholder:text-primary/25 px-1 py-0.5 rounded hover:bg-primary/5 focus:bg-primary/8"
            placeholder="Nombre del bioma…"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={guardar}
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg text-primary/25 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <Trash2 size={13} />
          </button>
          <button
            type="button"
            onClick={guardar}
            className="text-micro font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-primary text-bg-main hover:opacity-90 transition-opacity"
          >
            Guardar
          </button>
        </div>
      </div>

      {modoPopover ? (
        <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
          <div>
            <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1">
              Afinidad con Oris / elementos
            </span>
            <input
              className="w-full bg-primary/[0.02] border border-primary/10 rounded-lg px-2.5 py-1.5 text-xs outline-none placeholder:text-primary/30"
              placeholder="Ej. Tierra + Fuego dominantes, Runa ambiental que satura el aire…"
              value={afinidad}
              onChange={(e) => setAfinidad(e.target.value)}
              onBlur={guardar}
            />
          </div>

          <div>
            <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1.5">
              Descripción
            </span>
            <RichEditor
              minHeight="5rem"
              placeholder="Cómo es el bioma, su relación con la física del mundo, particularidades…"
              value={descripcion}
              onChange={setDescripcion}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3">
            <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1">
              Afinidad con Oris / elementos
            </span>
            <input
              className="w-full bg-primary/[0.02] border border-primary/10 rounded-lg px-2.5 py-1.5 text-xs outline-none placeholder:text-primary/30"
              placeholder="Ej. Tierra + Fuego dominantes, Runa ambiental que satura el aire…"
              value={afinidad}
              onChange={(e) => setAfinidad(e.target.value)}
              onBlur={guardar}
            />
          </div>

          <div className="mb-4">
            <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1.5">
              Descripción
            </span>
            <RichEditor
              minHeight="6.25rem"
              placeholder="Cómo es el bioma, su relación con la física del mundo, particularidades…"
              value={descripcion}
              onChange={setDescripcion}
            />
          </div>

          <div className="mb-4">
            <SelectorReinosMulti
              ids={bioma.reino_ids ?? []}
              onChange={(ids) => onSave({ reino_ids: ids })}
              onSelectReino={onSelectReino}
              label="Reinos con territorio en este bioma"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
                Ecosistemas de este bioma
              </span>
              {onCrearEcosistema && (
                <button
                  type="button"
                  disabled={creandoEcosistema}
                  onClick={onCrearEcosistema}
                  className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors disabled:opacity-40"
                >
                  <Plus size={10} /> Nuevo ecosistema
                </button>
              )}
            </div>

            {ecosistemas.length === 0 ? (
              <p className="text-micro text-primary/25 italic py-1">Sin ecosistemas todavía</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {ecosistemas.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onSelectEcosistema?.(e.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-micro font-bold bg-primary/10 hover:bg-primary/20 text-primary/70 border border-primary/15 transition-colors truncate max-w-[200px]"
                    title={e.nombre}
                  >
                    <Leaf size={9} className="text-accent/60 shrink-0" />
                    <span className="truncate">{e.nombre}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      </div>

      {/* ── Barra lateral — sección Entidad (Reinos + Ecosistemas) ──
          Solo en modo popover: la pantalla completa (EditorReino-like)
          mantiene el layout original de una sola columna. */}
      {modoPopover && (
        <aside
          className="shrink-0 w-44 flex flex-col border-l overflow-y-auto overflow-x-hidden -my-4 -mr-4 pl-0"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 7%, transparent)",
            background: "color-mix(in srgb, var(--primary) 1%, transparent)",
            scrollbarWidth: "none",
          }}
        >
          {sidebar}
        </aside>
      )}
    </div>
  );
}
