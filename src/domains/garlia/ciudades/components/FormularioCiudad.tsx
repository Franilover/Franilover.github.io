"use client";

/**
 * FormularioCiudad.tsx
 * ──────────────────────
 * Formulario completo de edición de una ciudad: header, imagen, tipo,
 * reino, descripción, historia, secretos y entidades relacionadas
 * (personajes / criaturas / ítems). Extraído de EditorCiudad.tsx, que
 * solo orquesta form/status/save/delete y monta este componente.
 *
 * Migrado desde _legacy/components/ciudades/FormularioCiudad.tsx a
 * domains/garlia/ciudades, siguiendo el patrón de reinos. Los
 * supabase.from(...) sueltos de link/unlink (personajes, criaturas, items)
 * pasaron a ciudadesQueries.
 */

import { MapPin, Save, Trash2, Users, Bug, Package, Mountain, ScrollText } from "lucide-react";
import Image from "next/image";
import React, { useState } from "react";

import type { WikiEntity } from "@/ui/Markdown/commandItems";
import { RichEditor } from "@/editor/lexical";
import { ComboSelector } from "@/ui/ComboSelector";
import { SeccionEntidad } from "@/ui/SeccionEntidad";
import { SelectorImagen, SaveIndicator } from "@/domains/garlia/_shared/UIComponents";
import { useWikilink } from "@/domains/garlia/_shared/WikilinkContext";
import { type SaveStatus } from "@/domains/garlia/_shared/types";
import { db } from "@/infra/supabase/db";

import {
  useReinos,
  usePersonajesDelCiudad,
  useCriaturasDeCiudad,
  useItemsDelCiudad,
  useTodosPersonajes,
  useTodasCriaturas,
  useTodosItems,
  type PersonajeMin,
  type CriaturaMin,
  type ItemMin,
} from "../useCiudadCatalogos";
import { type Ciudad } from "../types";
import { ciudadesQueries } from "../queries";

// ─── Tipos de ciudad predefinidos ──────────────────────────────────────────────
const TIPOS_CIUDAD = [
  "Ciudad",
  "Aldea",
  "Fortaleza",
  "Castillo",
  "Torre",
  "Ruinas",
  "Bosque",
  "Montaña",
  "Caverna",
  "Isla",
  "Desierto",
  "Pantano",
  "Templo",
  "Mazmorra",
  "Puerto",
  "Mercado",
  "Taberna",
  "Biblioteca",
];

export function FormularioCiudad({
  form,
  setForm,
  status,
  onSave,
  onDelete,
  entities = [],
  onSelectPersonaje,
  onSelectCriatura,
  onSelectItem,
  onNavigateReino,
}: {
  form: Ciudad;
  setForm: React.Dispatch<React.SetStateAction<Ciudad>>;
  status: SaveStatus;
  onSave: () => void;
  onDelete: () => void;
  entities?: WikiEntity[];
  onSelectPersonaje?: (id: string) => void;
  onSelectCriatura?: (id: string) => void;
  onSelectItem?: (id: string) => void;
  onNavigateReino?: (id: string) => void;
}) {
  const reinos = useReinos();
  const {
    personajes,
    loading: loadingP,
    reload: reloadP,
  } = usePersonajesDelCiudad(form.id);
  const {
    criaturas,
    loading: loadingC,
    reload: reloadC,
  } = useCriaturasDeCiudad(form.id);
  const {
    items,
    loading: loadingI,
    reload: reloadI,
  } = useItemsDelCiudad(form.id);
  const todosPersonajes = useTodosPersonajes();
  const todasCriaturas = useTodasCriaturas();
  const todosItems = useTodosItems();
  const { onWikilink } = useWikilink();

  const [addingP, setAddingP] = useState<string | null>(null);
  const [addingC, setAddingC] = useState<string | null>(null);
  const [addingI, setAddingI] = useState<string | null>(null);
  const [_removingP, setRemovingP] = useState<string | null>(null);
  const [_removingC, setRemovingC] = useState<string | null>(null);
  const [_removingI, setRemovingI] = useState<string | null>(null);

  const reinoActual = reinos.find((r) => r.id === form.reino_id);

  const handleAddPersonaje = async (p: PersonajeMin) => {
    setAddingP(p.id);
    await ciudadesQueries.linkPersonaje(form.id, p.id);
    if (db)
      try {
        await (db as any).personajes?.update(p.id, { ciudad_id: form.id });
      } catch {}
    await reloadP();
    setAddingP(null);
  };

  const handleAddCriatura = async (c: CriaturaMin) => {
    setAddingC(c.id);
    await ciudadesQueries.linkCriatura(form.id, c.id);
    if (db)
      try {
        await (db as any).criaturas?.update(c.id, { ciudad_id: form.id });
      } catch {}
    await reloadC();
    setAddingC(null);
  };

  const handleAddItem = async (i: ItemMin) => {
    setAddingI(i.id);
    await ciudadesQueries.linkItem(form.id, i.id);
    if (db)
      try {
        await (db as any).items?.update(i.id, { ciudad_id: form.id });
      } catch {}
    await reloadI();
    setAddingI(null);
  };

  const handleRemovePersonaje = async (id: string) => {
    setRemovingP(id);
    await ciudadesQueries.unlinkPersonaje(id);
    if (db)
      try {
        await (db as any).personajes?.update(id, { ciudad_id: null });
      } catch {}
    await reloadP();
    setRemovingP(null);
  };

  const handleRemoveCriatura = async (id: string) => {
    setRemovingC(id);
    await ciudadesQueries.unlinkCriatura(id);
    if (db)
      try {
        await (db as any).criaturas?.update(id, { ciudad_id: null });
      } catch {}
    await reloadC();
    setRemovingC(null);
  };

  const handleRemoveItem = async (id: string) => {
    setRemovingI(id);
    await ciudadesQueries.unlinkItem(id);
    if (db)
      try {
        await (db as any).items?.update(id, { ciudad_id: null });
      } catch {}
    await reloadI();
    setRemovingI(null);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* ── Header fijo ───────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center gap-2 px-3 py-2 border-b"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
          background: "color-mix(in srgb, var(--primary) 3%, transparent)",
        }}
      >
        {/* Thumbnail */}
        <div className="shrink-0 w-8 h-8 rounded-lg overflow-hidden border border-primary/15 bg-primary/5 flex items-center justify-center">
          {form.imagen_url ? (
            <Image
              alt={form.nombre}
              className="w-full h-full object-cover"
              src={form.imagen_url}
            />
          ) : (
            <MapPin className="text-primary/25" size={16} />
          )}
        </div>

        {/* Nombre editable */}
        <input
          className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
          placeholder="Nombre de la ciudad"
          value={form.nombre ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
        />

        {/* Acciones */}
        <div className="shrink-0 flex items-center gap-1.5">
          <SaveIndicator status={status} />
          <button
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all cursor-pointer"
            onClick={onDelete}
          >
            <Trash2 size={10} />
          </button>
          <button
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            disabled={status === "saving"}
            onClick={onSave}
          >
            <Save size={10} /> Guardar
          </button>
        </div>
      </div>

      {/* ── Cuerpo scrolleable ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4 space-y-5">
          {/* Fila superior: imagen + datos básicos */}
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Columna izquierda: imagen */}
            <div className="shrink-0 sm:w-52 w-full max-w-xs mx-auto sm:mx-0">
              <SelectorImagen
                aspect="square"
                label="Ilustración"
                placeholder={<MapPin className="opacity-20" size={20} />}
                value={form.imagen_url ?? ""}
                onChange={(url) => setForm((f) => ({ ...f, imagen_url: url }))}
              />
            </div>

            {/* Columna central: tipo + reino + descripción */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* Tipo + Reino en fila */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ComboSelector
                  allowNone
                  items={TIPOS_CIUDAD.map((t) => ({ id: t, label: t }))}
                  label="Tipo"
                  mode="single"
                  noneLabel="Sin tipo"
                  placeholder="Ciudad, ruinas, bosque…"
                  value={form.tipo ?? null}
                  onChange={(v) => setForm((f) => ({ ...f, tipo: v }))}
                />
                <ComboSelector
                  allowNone
                  items={reinos.map((r) => ({ id: r.id, label: r.nombre }))}
                  label="Reino"
                  mode="single"
                  noneLabel="Sin reino"
                  placeholder="Sin reino asignado…"
                  value={form.reino_id ?? null}
                  onChange={(id) => setForm((f) => ({ ...f, reino_id: id }))}
                  onNavigate={
                    onNavigateReino && reinoActual
                      ? () => onNavigateReino(reinoActual.id)
                      : undefined
                  }
                />
              </div>

              {/* Descripción */}
              <div className="space-y-1.5">
                <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35">
                  Descripción
                </label>
                <RichEditor
                  minHeight="8rem"
                  mode="edit"
                  placeholder="Aspecto, atmósfera, primeras impresiones…"
                  showSplitMode={false}
                  value={form.descripcion ?? ""}
                  wikiEntities={entities}
                  onChange={(v) => setForm((f) => ({ ...f, descripcion: v }))}
                  onWikilinkNavigate={onWikilink}
                />
              </div>
            </div>
          </div>

          {/* Historia + Secretos en fila */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 min-w-0 space-y-1.5">
              <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35 flex items-center gap-1.5">
                <ScrollText size={9} /> Historia
              </label>
              <RichEditor
                minHeight="10rem"
                mode="edit"
                placeholder="Origen, eventos importantes, eras pasadas…"
                showSplitMode={false}
                value={form.historia ?? ""}
                wikiEntities={entities}
                onChange={(v) => setForm((f) => ({ ...f, historia: v }))}
                onWikilinkNavigate={onWikilink}
              />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35 flex items-center gap-1.5">
                <Mountain size={9} /> Secretos
              </label>
              <RichEditor
                minHeight="10rem"
                mode="edit"
                placeholder="Lo que pocos saben, pasajes ocultos, maldiciones…"
                showSplitMode={false}
                value={form.secretos ?? ""}
                wikiEntities={entities}
                onChange={(v) => setForm((f) => ({ ...f, secretos: v }))}
                onWikilinkNavigate={onWikilink}
              />
            </div>
          </div>

          {/* Entidades relacionadas */}
          <div className="flex flex-col sm:flex-row sm:items-stretch gap-4">
            {/* Personajes */}
            <div
              className="min-w-0 rounded-xl overflow-hidden flex flex-col bg-primary/[0.015]"
              style={{ flexGrow: Math.max(personajes.length, 1), flexBasis: 0 }}
            >
              <SeccionEntidad
                allEntities={todosPersonajes.map((p) => ({
                  id: p.id,
                  nombre: p.nombre,
                  imagen_url: p.img_url ?? null,
                }))}
                emptyLabel="Sin personajes en esta ciudad"
                fallbackIcon={<Users size={10} />}
                icon={<Users size={10} />}
                label="Personajes"
                loading={loadingP}
                saving={!!addingP}
                selectedIds={personajes.map((p) => p.id)}
                onEntityClick={onSelectPersonaje}
                onToggle={(id, add) =>
                  add
                    ? handleAddPersonaje(
                        todosPersonajes.find((p) => p.id === id)!,
                      )
                    : handleRemovePersonaje(id)
                }
              />
            </div>

            {/* Criaturas */}
            <div
              className="min-w-0 rounded-xl overflow-hidden flex flex-col bg-primary/[0.015]"
              style={{ flexGrow: Math.max(criaturas.length, 1), flexBasis: 0 }}
            >
              <SeccionEntidad
                allEntities={todasCriaturas}
                emptyLabel="Sin criaturas en esta ciudad"
                fallbackIcon={<Bug size={10} />}
                icon={<Bug size={10} />}
                label="Criaturas"
                loading={loadingC}
                saving={!!addingC}
                selectedIds={criaturas.map((c) => c.id)}
                onEntityClick={onSelectCriatura}
                onToggle={(id, add) =>
                  add
                    ? handleAddCriatura(
                        todasCriaturas.find((c) => c.id === id)!,
                      )
                    : handleRemoveCriatura(id)
                }
              />
            </div>

            {/* Ítems */}
            <div
              className="min-w-0 rounded-xl overflow-hidden flex flex-col bg-primary/[0.015]"
              style={{ flexGrow: Math.max(items.length, 1), flexBasis: 0 }}
            >
              <SeccionEntidad
                allEntities={todosItems}
                emptyLabel="Sin ítems en esta ciudad"
                fallbackIcon={<Package size={10} />}
                icon={<Package size={10} />}
                label="Ítems"
                loading={loadingI}
                saving={!!addingI}
                selectedIds={items.map((i) => i.id)}
                onEntityClick={onSelectItem}
                onToggle={(id, add) =>
                  add
                    ? handleAddItem(todosItems.find((i) => i.id === id)!)
                    : handleRemoveItem(id)
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
