"use client";

/**
 * PanelEcosistema.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Panel de detalle de un ecosistema (bioma/clima + criaturas que lo habitan)
 * y, dentro de él, sus cadenas alimenticias (eslabones ordenados por rol
 * trófico, cada uno con 1+ criaturas).
 *
 * La página de lista/chips de ecosistemas se eliminó — Ecosistemas ahora se
 * navegan y editan desde Entidades → EcosistemaEditor.tsx, que renderiza
 * este panel directamente.
 */

import { ArrowLeft, Bug, Compass, Gem, Leaf, Plus, Salad, Trash2, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { RichEditor } from "@/editor/lexical";
import { SeccionEntidad } from "@/ui/SeccionEntidad";

import { SelectorFloraMulti } from "@/domains/garlia/flora/SelectorFloraMulti";
import { useFloraCatalogoMin } from "@/domains/garlia/flora/useFloraCatalogoMin";
import { SelectorMineralesMulti } from "@/domains/garlia/minerales/SelectorMineralesMulti";
import { useMineralesCatalogoMin } from "@/domains/garlia/minerales/useMineralesCatalogoMin";
import { useReinosMin } from "@/domains/garlia/reinos/useReinosMin";
import { useCriaturasCatalogoMin } from "@/domains/garlia/runas/useCriaturasCatalogoMin";

import { SelectorCriaturasMulti } from "./SelectorCriaturasMulti";
import { useBiomas, useEcosistemaCriaturas } from "./useBiologia";
import {
  ROL_TROFICO_LABEL,
  ROLES_TROFICOS,
  type CadenaAlimenticia,
  type Ecosistema,
  type EslabonTrofico,
  type RolTrofico,
} from "./types";

// ─── Editor de un eslabón trófico ───────────────────────────────────────────

function EditorEslabon({
  eslabon,
  onChange,
  onDelete,
  onSelectCriatura,
}: {
  eslabon: EslabonTrofico;
  onChange: (patch: Partial<EslabonTrofico>) => void;
  onDelete: () => void;
  onSelectCriatura?: (id: string) => void;
}) {
  return (
    <div className="p-2.5 rounded-xl border border-primary/10 bg-primary/[0.02]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <select
          className="bg-transparent text-xs font-bold text-primary/80 outline-none"
          value={eslabon.rol}
          onChange={(e) => onChange({ rol: e.target.value as RolTrofico })}
        >
          {ROLES_TROFICOS.map((r) => (
            <option key={r} value={r}>
              {ROL_TROFICO_LABEL[r]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 p-1 rounded-md text-primary/25 hover:text-red-400 hover:bg-red-400/10"
        >
          <X size={11} />
        </button>
      </div>
      <input
        className="w-full mb-2 bg-transparent text-micro text-primary/60 outline-none placeholder:text-primary/25 px-0.5"
        placeholder="Nota (opcional): qué come, cómo encaja acá…"
        value={eslabon.nota ?? ""}
        onChange={(e) => onChange({ nota: e.target.value })}
      />
      <SelectorCriaturasMulti
        ids={eslabon.criatura_ids ?? []}
        onChange={(ids) => onChange({ criatura_ids: ids })}
        onSelectCriatura={onSelectCriatura}
        compacto
        label="Criaturas en este rol"
      />
      {eslabon.rol === "productor" && (
        <div className="mt-2">
          <SelectorFloraMulti
            ids={eslabon.flora_ids ?? []}
            onChange={(ids) => onChange({ flora_ids: ids })}
            compacto
            label="Flora en este rol"
          />
        </div>
      )}
    </div>
  );
}

// ─── Editor de una cadena alimenticia completa ──────────────────────────────

function PanelCadena({
  cadena,
  onSave,
  onDelete,
  onSelectCriatura,
}: {
  cadena: CadenaAlimenticia;
  onSave: (updates: Partial<CadenaAlimenticia>) => void;
  onDelete: () => void;
  onSelectCriatura?: (id: string) => void;
}) {
  const [nombre, setNombre] = useState(cadena.nombre);
  const [descripcion, setDescripcion] = useState(cadena.descripcion ?? "");
  const [eslabones, setEslabones] = useState<EslabonTrofico[]>(cadena.eslabones ?? []);

  useEffect(() => {
    setNombre(cadena.nombre);
    setDescripcion(cadena.descripcion ?? "");
    setEslabones(cadena.eslabones ?? []);
  }, [cadena.id]);

  const guardar = (patch?: Partial<CadenaAlimenticia>) => {
    onSave({
      nombre: nombre.trim() || cadena.nombre,
      descripcion,
      eslabones,
      ...patch,
    });
  };

  const agregarEslabon = () => {
    const nuevo: EslabonTrofico = {
      id: crypto.randomUUID(),
      rol: "productor",
      criatura_ids: [],
      flora_ids: [],
    };
    const next = [...eslabones, nuevo];
    setEslabones(next);
    guardar({ eslabones: next });
  };

  const actualizarEslabon = (id: string, patch: Partial<EslabonTrofico>) => {
    const next = eslabones.map((e) => (e.id === id ? { ...e, ...patch } : e));
    setEslabones(next);
    guardar({ eslabones: next });
  };

  const eliminarEslabon = (id: string) => {
    const next = eslabones.filter((e) => e.id !== id);
    setEslabones(next);
    guardar({ eslabones: next });
  };

  return (
    <div className="p-3 rounded-xl border border-primary/10 bg-white-custom/60">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <Salad size={11} className="text-accent/60 shrink-0" />
          <input
            className="flex-1 min-w-0 bg-transparent text-xs font-black text-primary truncate outline-none placeholder:text-primary/25 px-1 py-0.5 rounded hover:bg-primary/5 focus:bg-primary/8"
            placeholder="Nombre de la cadena…"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={() => guardar()}
          />
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 p-1 rounded-md text-primary/25 hover:text-red-400 hover:bg-red-400/10"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <input
        className="w-full mb-2.5 bg-transparent text-micro text-primary/50 outline-none placeholder:text-primary/25 px-1"
        placeholder="Descripción corta…"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        onBlur={() => guardar()}
      />

      <div className="space-y-1.5">
        {eslabones.map((e) => (
          <EditorEslabon
            key={e.id}
            eslabon={e}
            onChange={(patch) => actualizarEslabon(e.id, patch)}
            onDelete={() => eliminarEslabon(e.id)}
            onSelectCriatura={onSelectCriatura}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={agregarEslabon}
        className="mt-2 flex items-center gap-1.5 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors"
      >
        <Plus size={10} /> Añadir eslabón
      </button>
    </div>
  );
}

// ─── Panel de detalle de ecosistema ──────────────────────────────────────────

export function PanelEcosistema({
  ecosistema,
  cadenas,
  creandoCadena,
  onSave,
  onDelete,
  onVolver,
  onCrearCadena,
  onActualizarCadena,
  onEliminarCadena,
  onSelectCriatura,
  onSelectFlora,
  onSelectMineral,
  onSelectBioma,
  modoPopover = false,
}: {
  ecosistema: Ecosistema;
  cadenas: CadenaAlimenticia[];
  creandoCadena: boolean;
  onSave: (updates: Partial<Ecosistema>) => void;
  onDelete: () => void;
  onVolver: () => void;
  onCrearCadena: () => void;
  onActualizarCadena: (id: string, updates: Partial<CadenaAlimenticia>) => void;
  onEliminarCadena: (id: string) => void;
  onSelectCriatura?: (id: string) => void;
  /** Abre el editor/panel flotante de la Flora o Mineral clickeada en la
   *  barra lateral — mismo patrón que onSelectCriatura. */
  onSelectFlora?: (id: string) => void;
  onSelectMineral?: (id: string) => void;
  /** Abre el editor completo del bioma actualmente seleccionado. */
  onSelectBioma?: (id: string) => void;
  /** true cuando se renderiza dentro de un popover flotante: el botón
   *  izquierdo pasa de "volver" (flecha) a "cerrar" (X). */
  modoPopover?: boolean;
}) {
  const { biomas } = useBiomas();
  const [nombre, setNombre] = useState(ecosistema.nombre);
  const [clima, setClima] = useState(ecosistema.clima ?? "");
  const [descripcion, setDescripcion] = useState(ecosistema.descripcion ?? "");

  useEffect(() => {
    setNombre(ecosistema.nombre);
    setClima(ecosistema.clima ?? "");
    setDescripcion(ecosistema.descripcion ?? "");
  }, [ecosistema.id]);

  const guardar = () => {
    onSave({ nombre: nombre.trim() || ecosistema.nombre, clima, descripcion });
  };

  // ── Barra lateral — Criaturas / Flora / Minerales / Reino, mismo patrón
  // que Personajes/Criaturas/Ítems en LoreTab (reinos/EditorReino). El
  // Reino no vive en el ecosistema directamente: se deriva del bioma_id
  // (bioma.reino_ids), y esta sección solo lo muestra como referencia
  // navegable — no es editable desde acá (se edita en el Bioma).
  // Ruta canónica v226: la pertenencia de criaturas a este ecosistema vive
  // en la tabla puente ecosistema_criaturas, no en una columna embebida.
  const { criaturaIdsDe, asignar: asignarCriaturaAEcosistema, desasignar: desasignarCriaturaDeEcosistema } =
    useEcosistemaCriaturas();
  const criaturaIds = criaturaIdsDe(ecosistema.id);
  const floraIds = ecosistema.flora_ids ?? [];
  const mineralIds = ecosistema.mineral_ids ?? [];

  const { criaturas: catalogoCriaturas, loading: loadingCatalogoCriaturas } =
    useCriaturasCatalogoMin();
  const { flora: catalogoFlora, loading: loadingCatalogoFlora } = useFloraCatalogoMin();
  const { minerales: catalogoMinerales, loading: loadingCatalogoMinerales } =
    useMineralesCatalogoMin();
  const catalogoReinos = useReinosMin();

  const biomaActual = biomas.find((b) => b.id === ecosistema.bioma_id);
  const reinoIdsDelBioma = biomaActual?.reino_ids ?? [];
  const allReinosEntidad = useMemo(
    () => catalogoReinos.map((r) => ({ id: r.id, nombre: r.nombre })),
    [catalogoReinos],
  );

  const handleToggleCriatura = (id: string, add: boolean) =>
    add
      ? asignarCriaturaAEcosistema(id, ecosistema.id)
      : desasignarCriaturaDeEcosistema(id, ecosistema.id);
  const handleToggleFlora = (id: string, add: boolean) =>
    onSave({
      flora_ids: add ? [...floraIds, id] : floraIds.filter((x) => x !== id),
    });
  const handleToggleMineral = (id: string, add: boolean) =>
    onSave({
      mineral_ids: add
        ? [...mineralIds, id]
        : mineralIds.filter((x) => x !== id),
    });

  const sectionDivider = (
    <div
      style={{
        borderTop: "1px solid color-mix(in srgb, var(--primary) 7%, transparent)",
      }}
    />
  );

  const sidebar = (
    <>
      <SeccionEntidad
        allEntities={catalogoCriaturas.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          imagen_url: c.imagen_url,
        }))}
        emptyLabel="Sin criaturas"
        fallbackIcon={<Bug size={14} strokeWidth={1} />}
        fill={false}
        icon={<Bug size={9} />}
        label="Criaturas"
        loading={loadingCatalogoCriaturas}
        saving={false}
        selectedIds={criaturaIds}
        onEntityClick={onSelectCriatura}
        onToggle={handleToggleCriatura}
      />
      {sectionDivider}
      <SeccionEntidad
        allEntities={catalogoFlora.map((f) => ({
          id: f.id,
          nombre: f.nombre,
          imagen_url: f.imagen_url,
        }))}
        emptyLabel="Sin flora"
        fallbackIcon={<Leaf size={14} strokeWidth={1} />}
        fill={false}
        icon={<Leaf size={9} />}
        label="Flora"
        loading={loadingCatalogoFlora}
        saving={false}
        selectedIds={floraIds}
        onEntityClick={onSelectFlora}
        onToggle={handleToggleFlora}
      />
      {sectionDivider}
      <SeccionEntidad
        allEntities={catalogoMinerales.map((m) => ({
          id: m.id,
          nombre: m.nombre,
          imagen_url: m.imagen_url,
        }))}
        emptyLabel="Sin minerales"
        fallbackIcon={<Gem size={14} strokeWidth={1} />}
        fill={false}
        icon={<Gem size={9} />}
        label="Minerales"
        loading={loadingCatalogoMinerales}
        saving={false}
        selectedIds={mineralIds}
        onEntityClick={onSelectMineral}
        onToggle={handleToggleMineral}
      />
      {sectionDivider}
      <SeccionEntidad
        allEntities={allReinosEntidad}
        emptyLabel="Sin reinos (vía bioma)"
        fallbackIcon={<Compass size={14} strokeWidth={1} />}
        fill={false}
        icon={<Compass size={9} />}
        label="Reinos"
        loading={false}
        saving={false}
        selectedIds={reinoIdsDelBioma}
        onEntityClick={onSelectBioma ? () => onSelectBioma(ecosistema.bioma_id!) : undefined}
        onToggle={() => {}}
      />
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
          <Leaf size={12} className="text-accent/60 shrink-0" />
          <input
            className="flex-1 min-w-0 bg-transparent text-sm font-black uppercase italic tracking-tight text-primary truncate outline-none placeholder:text-primary/25 px-1 py-0.5 rounded hover:bg-primary/5 focus:bg-primary/8"
            placeholder="Nombre del ecosistema…"
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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
                  Bioma
                </span>
                {ecosistema.bioma_id && onSelectBioma && (
                  <button
                    type="button"
                    onClick={() => onSelectBioma(ecosistema.bioma_id!)}
                    className="text-micro font-bold text-accent/60 hover:text-accent transition-colors"
                  >
                    Abrir
                  </button>
                )}
              </div>
              <select
                className="w-full bg-primary/[0.02] border border-primary/10 rounded-lg px-2.5 py-1.5 text-xs outline-none placeholder:text-primary/30"
                value={ecosistema.bioma_id ?? ""}
                onChange={(e) => onSave({ bioma_id: e.target.value || null })}
              >
                <option value="">Sin bioma</option>
                {biomas.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1">
                Clima
              </span>
              <input
                className="w-full bg-primary/[0.02] border border-primary/10 rounded-lg px-2.5 py-1.5 text-xs outline-none placeholder:text-primary/30"
                placeholder="Ej. húmedo templado…"
                value={clima}
                onChange={(e) => setClima(e.target.value)}
                onBlur={guardar}
              />
            </div>
          </div>

          <div>
            <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1.5">
              Descripción
            </span>
            <RichEditor
              minHeight="5rem"
              placeholder="Cómo es el ecosistema, particularidades, peligros…"
              value={descripcion}
              onChange={setDescripcion}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
                Cadenas alimenticias
              </span>
              <button
                type="button"
                disabled={creandoCadena}
                onClick={onCrearCadena}
                className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors disabled:opacity-40"
              >
                <Plus size={10} /> Nueva cadena
              </button>
            </div>

            {cadenas.length === 0 ? (
              <p className="text-micro text-primary/25 italic py-1">Sin cadenas todavía</p>
            ) : (
              <div className="space-y-2.5">
                {cadenas.map((c) => (
                  <PanelCadena
                    key={c.id}
                    cadena={c}
                    onSave={(updates) => onActualizarCadena(c.id, updates)}
                    onDelete={() => onEliminarCadena(c.id)}
                    onSelectCriatura={onSelectCriatura}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
                  Bioma
                </span>
                {ecosistema.bioma_id && onSelectBioma && (
                  <button
                    type="button"
                    onClick={() => onSelectBioma(ecosistema.bioma_id!)}
                    className="text-micro font-bold text-accent/60 hover:text-accent transition-colors"
                  >
                    Abrir
                  </button>
                )}
              </div>
              <select
                className="w-full bg-primary/[0.02] border border-primary/10 rounded-lg px-2.5 py-1.5 text-xs outline-none placeholder:text-primary/30"
                value={ecosistema.bioma_id ?? ""}
                onChange={(e) => onSave({ bioma_id: e.target.value || null })}
              >
                <option value="">Sin bioma</option>
                {biomas.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1">
                Clima
              </span>
              <input
                className="w-full bg-primary/[0.02] border border-primary/10 rounded-lg px-2.5 py-1.5 text-xs outline-none placeholder:text-primary/30"
                placeholder="Ej. húmedo templado…"
                value={clima}
                onChange={(e) => setClima(e.target.value)}
                onBlur={guardar}
              />
            </div>
          </div>

          <div className="mb-4">
            <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1.5">
              Descripción
            </span>
            <RichEditor
              minHeight="6.25rem"
              placeholder="Cómo es el ecosistema, particularidades, peligros…"
              value={descripcion}
              onChange={setDescripcion}
            />
          </div>

          <div className="mb-4">
            <SelectorCriaturasMulti
              ids={criaturaIds}
              onChange={(nuevosIds) => {
                const anteriores = new Set(criaturaIds);
                const siguientes = new Set(nuevosIds);
                for (const id of nuevosIds) {
                  if (!anteriores.has(id)) asignarCriaturaAEcosistema(id, ecosistema.id);
                }
                for (const id of criaturaIds) {
                  if (!siguientes.has(id)) desasignarCriaturaDeEcosistema(id, ecosistema.id);
                }
              }}
              onSelectCriatura={onSelectCriatura}
              label="Criaturas que lo habitan"
            />
          </div>

          <div className="mb-4">
            <SelectorFloraMulti
              ids={ecosistema.flora_ids ?? []}
              onChange={(ids) => onSave({ flora_ids: ids })}
              label="Flora del ecosistema"
            />
          </div>

          <div className="mb-4">
            <SelectorMineralesMulti
              ids={ecosistema.mineral_ids ?? []}
              onChange={(ids) => onSave({ mineral_ids: ids })}
              label="Minerales del ecosistema"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
                Cadenas alimenticias
              </span>
              <button
                type="button"
                disabled={creandoCadena}
                onClick={onCrearCadena}
                className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors disabled:opacity-40"
              >
                <Plus size={10} /> Nueva cadena
              </button>
            </div>

            {cadenas.length === 0 ? (
              <p className="text-micro text-primary/25 italic py-1">Sin cadenas todavía</p>
            ) : (
              <div className="space-y-2.5">
                {cadenas.map((c) => (
                  <PanelCadena
                    key={c.id}
                    cadena={c}
                    onSave={(updates) => onActualizarCadena(c.id, updates)}
                    onDelete={() => onEliminarCadena(c.id)}
                    onSelectCriatura={onSelectCriatura}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
      </div>

      {/* ── Barra lateral — sección Entidad (Criaturas/Flora/Minerales/Reinos) ──
          Solo en modo popover: la pantalla completa (EcosistemaEditor) mantiene
          el layout original de una sola columna. */}
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
