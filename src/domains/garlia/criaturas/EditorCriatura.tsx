"use client";

/**
 * EditorCriatura.tsx
 * ───────────────────
 * View principal del editor de criaturas. Solo orquesta:
 * conecta hooks con componentes, no contiene lógica de dominio.
 *
 * Componentes extraídos a components/criaturas/:
 *   PickerImagenCriaturaBtn  → botón mobile de imagen
 *   BloqueGrupoCategoria     → selector de grupo por subtipo (Clasificación)
 *
 * Hooks extraídos a components/criaturas/:
 *   usePersonajesDeCriatura  → personajes de la especie + toggle
 *   useCriaturaAsideCatalogs → catálogos globales del aside
 *
 * Ruta destino:
 *   src/features/editorGarlia/views/EditorCriatura.tsx
 */

import {
  Bug,
  Brain,
  Dices,
  Globe,
  MapPin,
  Package,
  Save,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  UserCircle2,
  Users,
  Wand2,
  Wrench,
  X,
} from "lucide-react";
import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";

import {
  useMobileAsidePanel,
  useRegisterMobileAside,
} from "@/hooks/ui/useMobileAsidePanel";

import type { WikiEntity } from "@/ui/Markdown/commandItems";
import { RichEditor } from "@/editor/lexical";
import { useConfirm } from "@/ui/ConfirmModal";
import { SeccionEntidad } from "@/ui/SeccionEntidad";
import {
  BloqueGrupoCategoria,
  type GrupoMinExt,
} from "@/domains/garlia/criaturas/BloqueGruposCriatura";
import {
  useCriaturaReinos,
  useCriaturaCiudades,
} from "@/domains/garlia/criaturas/CriaturaHabitat";
import { useCraftedItems } from "@/domains/garlia/criaturas/CriaturaItemsCraftedos";
import { BloqueMagico } from "@/domains/garlia/criaturas/CriaturaMagia";
import { CriaturaStatsDndEditor } from "@/domains/garlia/criaturas/CriaturaStatsDnd";
import { PickerImagenCriaturaBtn } from "@/domains/garlia/criaturas/PickerImagenCriaturaBtn";
import {
  SelectorImagen,
  SaveIndicator,
} from "@/domains/garlia/_shared/UIComponents";
import { useWikilink } from "@/domains/garlia/_shared/WikilinkContext";
import { useCriaturaAsideCatalogs } from "@/domains/garlia/criaturas/useCriaturaAsideCatalogs";
import { usePersonajesDeCriatura } from "@/domains/garlia/criaturas/usePersonajesDeCriatura";
import { useMembresiaGruposCriatura } from "@/domains/garlia/grupos/useMembresiaGruposCriatura";
import { supabase } from "@/infra/supabase/supabase";
import { dexiePut, dexieDelete } from "@/lib/utils/dexieHelpers";

import { type Criatura } from "@/domains/garlia/criaturas/types";
import { type SaveStatus } from "@/ui/saveStatus";

// ─── EditorCriatura ───────────────────────────────────────────────────────────
export function EditorCriatura({
  item,
  onSaved,
  onDeleted,
  entities = [],
  onSelectItem,
  onSelectPersonaje,
  onSelectGrupo,
  onNavigateCiudad,
  onNavigateReino,
  onNavigateEntidadMagica,
}: {
  item: Criatura;
  onSaved: (c: Criatura) => void;
  onDeleted: (id: string) => void;
  entities?: WikiEntity[];
  onSelectItem?: (itemId: string) => void;
  onSelectPersonaje?: (personajeId: string) => void;
  onSelectGrupo?: (grupoId: string) => void;
  onNavigateCiudad?: (id: string) => void;
  onNavigateReino?: (id: string) => void;
  /** Navega al editor de un hechizo/don/runa vinculado a esta criatura */
  onNavigateEntidadMagica?: (
    tipo: "hechizos" | "dones" | "runas",
    id: string,
  ) => void;
}) {
  const [form, setForm] = useState<Criatura>(item);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [showModalDnd, setShowModalDnd] = useState(false);
  const { confirm, ConfirmModal } = useConfirm();
  const { onWikilink } = useWikilink();

  // ── Grupos ────────────────────────────────────────────────────────────────
  const {
    grupos: gruposActuales,
    todosGrupos,
    addToGrupo,
    removeFromGrupo,
  } = useMembresiaGruposCriatura(form.id);

  // ── Personajes de la especie ───────────────────────────────────────────────
  const {
    personajes: personajesDeEspecie,
    loading: loadingPersonajes,
    saving: savingPersonajes,
    toggle: togglePersonaje,
  } = usePersonajesDeCriatura(form.id, item.nombre);

  // ── Catálogos del aside ────────────────────────────────────────────────────
  const { allPersonajes, allReinos, allCiudades } = useCriaturaAsideCatalogs();

  // ── Relaciones del aside ───────────────────────────────────────────────────
  const {
    rows: reinoRows,
    loading: loadingReinos,
    add: addReinoSidebar,
    remove: removeReinoSidebar,
  } = useCriaturaReinos(form.id);

  const {
    rows: ciudadRows,
    loading: loadingCiudades,
    add: addCiudadSidebar,
    remove: removeCiudadSidebar,
  } = useCriaturaCiudades(form.id);

  const {
    items: craftedItems,
    allItems: allCraftedItems,
    loading: loadingCrafted,
    add: addCraftedSidebar,
    remove: removeCraftedSidebar,
  } = useCraftedItems(form.id);

  const [savingReinos, setSavingReinos] = useState(false);
  const [savingCiudades, setSavingCiudades] = useState(false);
  const [savingCrafted, setSavingCrafted] = useState(false);
  useRegisterMobileAside();
  const mobileAsideOpen = useMobileAsidePanel((s) => s.open);
  const closeMobileAside = useMobileAsidePanel((s) => s.close);

  // ── Derivados ─────────────────────────────────────────────────────────────
  const reinosSeleccionadosIds = reinoRows.map((r) => r.reinoId);
  const ciudadesConReino = useMemo(
    () =>
      allCiudades.filter(
        (l: { id: string; nombre: string; reino_id: string | null }) =>
          l.reino_id !== null &&
          (reinosSeleccionadosIds.length === 0 ||
            reinosSeleccionadosIds.includes(l.reino_id)),
      ),
    [allCiudades, reinosSeleccionadosIds],
  );

  // ── Sincronizar form cuando cambia el item externo ────────────────────────
  useEffect(() => {
    setForm(item);
    setStatus("idle");
  }, [item.id]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const field =
    (k: keyof Criatura) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setStatus("saving");
    try {
      const { error } = await supabase
        .from("criaturas")
        .update({
          nombre: form.nombre,
          imagen_url: form.imagen_url || null,
          descripcion: form.descripcion,
          descripcion_dnd: form.descripcion_dnd || null,
          stats_dnd: form.stats_dnd || null,
        })
        .eq("id", form.id);
      if (error) throw error;
      setStatus("saved");
      onSaved(form);
      void dexiePut("criaturas", form);
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  };

  const del = async () => {
    const ok = await confirm({
      message: `¿Eliminar a "${form.nombre}"?`,
      danger: true,
    });
    if (!ok) return;
    await supabase.from("criaturas").delete().eq("id", form.id);
    void dexieDelete("criaturas", form.id);
    onDeleted(form.id);
  };

  const handleTogglePersonaje = (id: string, add: boolean) =>
    togglePersonaje(id, add, form.nombre, allPersonajes);

  const handleToggleReino = async (id: string, add: boolean) => {
    setSavingReinos(true);
    const reino = allReinos.find((r) => r.id === id);
    if (add && reino) await addReinoSidebar(reino);
    else {
      const row = reinoRows.find((r) => r.reinoId === id);
      if (row) await removeReinoSidebar(row.rowId);
    }
    setSavingReinos(false);
  };

  const handleToggleCiudad = async (id: string, add: boolean) => {
    setSavingCiudades(true);
    if (add) {
      const ciudad = allCiudades.find((l) => l.id === id);
      if (ciudad) await addCiudadSidebar(ciudad);
    } else {
      const row = ciudadRows.find((r) => r.ciudadId === id);
      if (row) await removeCiudadSidebar(row.rowId);
    }
    setSavingCiudades(false);
  };

  const handleToggleCrafted = async (id: string, add: boolean) => {
    setSavingCrafted(true);
    if (add) {
      const it = allCraftedItems.find((i) => i.id === id);
      if (it) await addCraftedSidebar(it);
    } else {
      const crafted = craftedItems.find((i) => i.itemId === id);
      if (crafted) await removeCraftedSidebar(crafted.crafterId);
    }
    setSavingCrafted(false);
  };

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden relative">
      <ConfirmModal />

      {/* ── CONTENIDO PRINCIPAL ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* ── Header compacto ──────────────────────────────────────────────── */}
        <div
          className="shrink-0 flex items-center gap-2 px-3 py-2 border-b"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background: "color-mix(in srgb, var(--primary) 2%, transparent)",
          }}
        >
          <div className="shrink-0 w-7 h-7 rounded-lg overflow-hidden border border-primary/15 bg-primary/5 flex items-center justify-center">
            {form.imagen_url ? (
              <Image
                alt={form.nombre}
                className="w-full h-full object-cover"
                src={form.imagen_url}
              />
            ) : (
              <Bug className="text-primary/25" size={13} />
            )}
          </div>

          <input
            className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
            placeholder="Nombre de la criatura"
            value={form.nombre ?? ""}
            onChange={field("nombre")}
          />

          <button
            className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all"
            title="Reglas D&D 2024"
            type="button"
            onClick={() => setShowModalDnd(true)}
          >
            <Dices size={13} />
          </button>

          <div className="shrink-0 flex items-center gap-1.5">
            <SaveIndicator status={status} />
            <button
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all cursor-pointer"
              onClick={del}
            >
              <Trash2 size={9} />
            </button>
            <button
              className="flex items-center gap-1 px-3 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              disabled={status === "saving"}
              onClick={save}
            >
              <Save size={10} /> Guardar
            </button>
          </div>
        </div>

        {/* ── Contenido superior ───────────────────────────────────────────── */}
        <div
          className="flex-1 min-h-0 p-3 flex flex-col gap-3 overflow-y-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {/* Imagen + Descripción */}
          <div className="flex gap-3">
            <div className="hidden sm:block shrink-0 w-36">
              <SelectorImagen
                aspect="square"
                label=""
                placeholder={<Bug className="opacity-20" size={20} />}
                value={form.imagen_url ?? ""}
                onChange={(url) => setForm((f) => ({ ...f, imagen_url: url }))}
              />
            </div>
            <div className="sm:hidden shrink-0 relative w-24 h-24 rounded-xl overflow-hidden border border-primary/10 bg-primary/3">
              {form.imagen_url ? (
                <Image
                  alt={form.nombre}
                  className="w-full h-full object-cover"
                  src={form.imagen_url}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Bug className="text-primary/15" size={32} />
                </div>
              )}
              <div className="absolute top-1.5 right-1.5 z-10">
                <PickerImagenCriaturaBtn
                  value={form.imagen_url ?? ""}
                  onChange={(url) =>
                    setForm((f) => ({ ...f, imagen_url: url }))
                  }
                />
              </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/30">
                Descripción
              </label>
              <RichEditor
                minHeight="8rem"
                placeholder="Aspecto físico general…"
                value={form.descripcion ?? ""}
                wikiEntities={entities}
                onChange={(v) => setForm((f) => ({ ...f, descripcion: v }))}
                onWikilinkNavigate={onWikilink}
              />
            </div>
          </div>

          {/* Descripción D&D y Ficha de combate ahora viven en el modal de
              reglas D&D (botón de dado junto al nombre) — ver ModalReglasDndCriatura
              más abajo. */}

          {/* Clasificación */}
          <div
            className="rounded-xl p-2.5"
            style={{
              background: "color-mix(in srgb, var(--primary) 2%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--primary) 7%, transparent)",
            }}
          >
            <p className="text-[7.5px] font-black uppercase tracking-[0.28em] text-primary/25 mb-2 px-0.5">
              Clasificación
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(
                [
                  { label: "Hábitat", subtipo: "Hábitat", icon: Globe },
                  {
                    label: "Inteligencia",
                    subtipo: "Inteligencia",
                    icon: Brain,
                  },
                  { label: "Alma", subtipo: "Alma", icon: Wand2 },
                  { label: "Usar Mana", subtipo: "Usar Mana", icon: Sparkles },
                  {
                    label: "Produce Mana",
                    subtipo: "Produce Mana",
                    icon: Star,
                  },
                ] as const
              ).map(({ label, subtipo, icon }) => (
                <div key={subtipo} className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/30 mb-0.5">
                    {React.createElement(icon, { size: 7 })} {label}
                  </span>
                  <BloqueGrupoCategoria
                    gruposActuales={gruposActuales as GrupoMinExt[]}
                    icon={icon}
                    label={label}
                    subtipo={subtipo}
                    todosGrupos={todosGrupos as GrupoMinExt[]}
                    onAdd={addToGrupo}
                    onRemove={removeFromGrupo}
                    onSelectGrupo={onSelectGrupo}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── BARRA DE ENTIDADES — fila horizontal inferior ────────────────── */}
        <div
          className="shrink-0 hidden sm:flex border-t overflow-y-auto"
          style={{
            maxHeight: "60vh",
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background: "color-mix(in srgb, var(--primary) 1.5%, transparent)",
          }}
        >
          {/* Personajes */}
          <div
            className="flex-1 flex flex-col min-w-0 h-full border-r"
            style={{
              borderColor: "color-mix(in srgb, var(--primary) 7%, transparent)",
            }}
          >
            <SeccionEntidad
              allEntities={allPersonajes.map((p) => ({
                id: p.id,
                nombre: p.nombre,
                imagen_url: p.img_url,
              }))}
              columns={8}
              emptyLabel="Sin personajes"
              fallbackIcon={<UserCircle2 size={14} strokeWidth={1} />}
              fill={false}
              icon={<Users size={9} />}
              label="Personajes"
              loading={loadingPersonajes}
              saving={savingPersonajes}
              selectedIds={personajesDeEspecie.map((p) => p.id)}
              onEntityClick={(id) => onSelectPersonaje?.(id)}
              onToggle={handleTogglePersonaje}
            />
          </div>

          {/* Territorio */}
          <div
            className="shrink-0 flex flex-col h-full border-r"
            style={{
              width: "max-content",
              minWidth: "110px",
              maxWidth: "220px",
              borderColor: "color-mix(in srgb, var(--primary) 7%, transparent)",
            }}
          >
            <SeccionEntidad
              allEntities={allReinos.map((r) => ({
                id: r.id,
                nombre: r.nombre,
              }))}
              emptyLabel="Sin territorio"
              fallbackIcon={<Globe size={14} strokeWidth={1} />}
              fill={false}
              icon={<Globe size={9} />}
              label="Territorio"
              loading={loadingReinos}
              saving={savingReinos}
              selectedIds={reinoRows.map((r) => r.reinoId)}
              onEntityClick={(id) => onNavigateReino?.(id)}
              onToggle={(id, add) => handleToggleReino(id, add)}
            />
          </div>

          {/* Ciudades */}
          <div
            className="shrink-0 flex flex-col h-full border-r"
            style={{
              width: "max-content",
              minWidth: "110px",
              maxWidth: "220px",
              borderColor: "color-mix(in srgb, var(--primary) 7%, transparent)",
            }}
          >
            <SeccionEntidad
              allEntities={ciudadesConReino.map((l) => ({
                id: l.id,
                nombre: l.nombre,
              }))}
              emptyLabel={
                reinosSeleccionadosIds.length > 0
                  ? "Sin ciudades en estos reinos"
                  : "Sin ciudades"
              }
              fallbackIcon={<MapPin size={14} strokeWidth={1} />}
              fill={false}
              icon={<MapPin size={9} />}
              label={
                reinosSeleccionadosIds.length > 0
                  ? `Ciudades (${reinosSeleccionadosIds.length})`
                  : "Ciudades"
              }
              loading={loadingCiudades}
              saving={savingCiudades}
              selectedIds={ciudadRows.map((r) => r.ciudadId)}
              onEntityClick={(id) => onNavigateCiudad?.(id)}
              onToggle={(id, add) => handleToggleCiudad(id, add)}
            />
          </div>

          {/* Creaciones */}
          <div
            className="shrink-0 flex flex-col h-full border-r"
            style={{
              width: "max-content",
              minWidth: "110px",
              maxWidth: "220px",
              borderColor: "color-mix(in srgb, var(--primary) 7%, transparent)",
            }}
          >
            <SeccionEntidad
              allEntities={allCraftedItems.map((i) => ({
                id: i.id,
                nombre: i.nombre,
                imagen_url: i.imagen_url,
              }))}
              emptyLabel="Sin creaciones"
              fallbackIcon={<Package size={14} strokeWidth={1} />}
              fill={false}
              icon={<Wrench size={9} />}
              label="Creaciones"
              loading={loadingCrafted}
              saving={savingCrafted}
              selectedIds={craftedItems.map((i) => i.itemId)}
              onEntityClick={(id) => onSelectItem?.(id)}
              onToggle={handleToggleCrafted}
            />
          </div>

          {/* Dones — este grupo (Personajes/Territorio/Ciudades/Creaciones/
              Dones) es el bloque dinámico real (SeccionEntidad). El bloque
              suelto "Vinculados" (BloqueEntidadesDeCriatura) que estaba
              arriba, fuera de este grupo, se quitó por redundante. */}
          <div
            className="shrink-0 flex flex-col h-full overflow-hidden"
            style={{ width: "110px" }}
          >
            <BloqueMagico
              criaturaId={form.id}
              gruposActuales={gruposActuales.map((g) => g.id)}
              icon={Star}
              label="Dones"
              usarHook="dones"
            />
          </div>
        </div>
      </div>

      {/* ── BARRA DE ENTIDADES — mobile drawer ───────────────────────────────── */}
      {mobileAsideOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0"
            style={{
              background: "color-mix(in srgb, var(--primary) 20%, transparent)",
            }}
            onClick={closeMobileAside}
          />
          <div
            className="relative flex flex-col h-full overflow-y-auto shadow-2xl"
            style={{
              width: "200px",
              background: "var(--white-custom, var(--bg-main))",
              borderLeft:
                "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
              scrollbarWidth: "none",
            }}
          >
            <div
              className="shrink-0 flex items-center justify-between px-3 py-2 border-b"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 10%, transparent)",
              }}
            >
              <span className="text-micro font-black uppercase tracking-[0.2em] flex items-center gap-1.5 text-primary/40">
                <SlidersHorizontal size={9} /> Entidades
              </span>
              <button
                className="p-1 rounded-lg text-primary/30 hover:text-primary hover:bg-primary/8 transition-all"
                onClick={closeMobileAside}
              >
                <X size={13} />
              </button>
            </div>

            <SeccionEntidad
              allEntities={allPersonajes.map((p) => ({
                id: p.id,
                nombre: p.nombre,
                imagen_url: p.img_url,
              }))}
              columns={2}
              emptyLabel="Sin personajes"
              fallbackIcon={<UserCircle2 size={14} strokeWidth={1} />}
              fill={false}
              icon={<Users size={9} />}
              label="Personajes"
              loading={loadingPersonajes}
              saving={savingPersonajes}
              selectedIds={personajesDeEspecie.map((p) => p.id)}
              onEntityClick={(id) => onSelectPersonaje?.(id)}
              onToggle={handleTogglePersonaje}
            />
            <div
              style={{
                borderTop:
                  "1px solid color-mix(in srgb, var(--primary) 7%, transparent)",
              }}
            />
            <SeccionEntidad
              allEntities={allReinos.map((r) => ({
                id: r.id,
                nombre: r.nombre,
              }))}
              emptyLabel="Sin territorio"
              fallbackIcon={<Globe size={14} strokeWidth={1} />}
              fill={false}
              icon={<Globe size={9} />}
              label="Territorio"
              loading={loadingReinos}
              saving={savingReinos}
              selectedIds={reinoRows.map((r) => r.reinoId)}
              onEntityClick={(id) => onNavigateReino?.(id)}
              onToggle={(id, add) => handleToggleReino(id, add)}
            />
            <div
              style={{
                borderTop:
                  "1px solid color-mix(in srgb, var(--primary) 7%, transparent)",
              }}
            />
            <SeccionEntidad
              allEntities={ciudadesConReino.map((l) => ({
                id: l.id,
                nombre: l.nombre,
              }))}
              emptyLabel={
                reinosSeleccionadosIds.length > 0
                  ? "Sin ciudades en estos reinos"
                  : "Sin ciudades"
              }
              fallbackIcon={<MapPin size={14} strokeWidth={1} />}
              fill={false}
              icon={<MapPin size={9} />}
              label={
                reinosSeleccionadosIds.length > 0
                  ? `Ciudades (${reinosSeleccionadosIds.length})`
                  : "Ciudades"
              }
              loading={loadingCiudades}
              saving={savingCiudades}
              selectedIds={ciudadRows.map((r) => r.ciudadId)}
              onEntityClick={(id) => onNavigateCiudad?.(id)}
              onToggle={(id, add) => handleToggleCiudad(id, add)}
            />
            <div
              style={{
                borderTop:
                  "1px solid color-mix(in srgb, var(--primary) 7%, transparent)",
              }}
            />
            <SeccionEntidad
              allEntities={allCraftedItems.map((i) => ({
                id: i.id,
                nombre: i.nombre,
                imagen_url: i.imagen_url,
              }))}
              emptyLabel="Sin creaciones"
              fallbackIcon={<Package size={14} strokeWidth={1} />}
              fill={false}
              icon={<Wrench size={9} />}
              label="Creaciones"
              loading={loadingCrafted}
              saving={savingCrafted}
              selectedIds={craftedItems.map((i) => i.itemId)}
              onEntityClick={(id) => onSelectItem?.(id)}
              onToggle={handleToggleCrafted}
            />
            <div
              style={{
                borderTop:
                  "1px solid color-mix(in srgb, var(--primary) 7%, transparent)",
              }}
            />
            {/* Dones — bloque dinámico real; ver nota arriba en desktop. */}
            <BloqueMagico
              criaturaId={form.id}
              gruposActuales={gruposActuales.map((g) => g.id)}
              icon={Star}
              label="Dones"
              usarHook="dones"
            />
          </div>
        </div>
      )}

      {showModalDnd && (
        <ModalReglasDndCriatura
          descripcionDnd={form.descripcion_dnd ?? ""}
          nombre={form.nombre}
          statsDnd={form.stats_dnd}
          onChangeDescripcionDnd={(v) =>
            setForm((f) => ({ ...f, descripcion_dnd: v || null }))
          }
          onChangeStatsDnd={(v) => setForm((f) => ({ ...f, stats_dnd: v }))}
          onClose={() => setShowModalDnd(false)}
        />
      )}
    </div>
  );
}

// ─── Modal de reglas D&D ────────────────────────────────────────────────────
// Antes "Descripción D&D" y la ficha de combate vivían inline en el cuerpo
// del editor; ahora se acceden desde el botón de dado junto al nombre, así
// el editor principal queda enfocado en lore/hábitat/relaciones y las
// reglas mecánicas (D&D) quedan agrupadas en un modal aparte.
function ModalReglasDndCriatura({
  nombre,
  descripcionDnd,
  statsDnd,
  onChangeDescripcionDnd,
  onChangeStatsDnd,
  onClose,
}: {
  nombre: string;
  descripcionDnd: string;
  statsDnd: Criatura["stats_dnd"];
  onChangeDescripcionDnd: (v: string) => void;
  onChangeStatsDnd: (v: Criatura["stats_dnd"]) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-80 flex items-center justify-center p-4"
      style={{
        background: "color-mix(in srgb, var(--primary) 30%, transparent)",
        backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl overflow-hidden shadow-2xl"
        style={{
          background: "var(--bg-main)",
          border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
          animation: "popIn 160ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
          }}
        >
          <div
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: "color-mix(in srgb, var(--primary) 10%, transparent)",
              color: "var(--primary)",
            }}
          >
            <Dices size={13} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-micro font-black uppercase tracking-widest text-primary/40">
              Reglas D&D
            </p>
            <p className="text-xs font-bold text-primary truncate">{nombre || "Sin nombre"}</p>
          </div>
          <button
            className="shrink-0 p-1 rounded-lg text-primary/30 hover:text-primary hover:bg-primary/8 transition-all"
            type="button"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 max-h-[75vh] overflow-y-auto flex flex-col gap-3">
          {/* Descripción D&D — texto plano, se copia a la ficha del
              personaje que elija esta especie (rasgos raciales, etc). */}
          <div className="flex flex-col gap-1">
            <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/30">
              Descripción D&D
            </label>
            <textarea
              className="w-full bg-primary/[0.03] border border-primary/10 rounded-lg px-2.5 py-1.5 text-micro text-primary outline-none focus:border-primary/25 resize-none placeholder:text-primary/25 leading-relaxed"
              placeholder="Rasgos raciales, resistencias, velocidad especial… lo que verá el jugador en su ficha al elegir esta especie."
              rows={4}
              value={descripcionDnd}
              onChange={(e) => onChangeDescripcionDnd(e.target.value)}
            />
          </div>

          {/* Ficha de combate D&D 2024 — CA, HP, velocidades, stats,
              salvaciones, habilidades, sentidos, RC/PX, resistencias/
              inmunidades, rasgos y acciones. */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 px-0.5">
              <Shield size={11} className="text-primary/35" />
              <span className="text-[7.5px] font-black uppercase tracking-[0.28em] text-primary/25">
                Ficha de combate (D&D 2024)
              </span>
            </div>
            <CriaturaStatsDndEditor valor={statsDnd} onCambiar={onChangeStatsDnd} />
          </div>
        </div>
      </div>
    </div>
  );
}
