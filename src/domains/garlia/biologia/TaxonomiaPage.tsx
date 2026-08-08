"use client";

/**
 * TaxonomiaPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Árbol filogenético de Biología: jerarquía de rangos CONFIGURABLE (7 por
 * defecto tipo Reino→Especie, ver RANGOS_TAXONOMICOS_DEFAULT) pero
 * editable/renombrable/extendible — no es una copia 1:1 de la taxonomía
 * real, es un árbol propio para el mundo ficticio.
 *
 * Layout: árbol colapsable a la izquierda, panel de detalle del taxón
 * seleccionado a la derecha (nombre, rango, descripción, criaturas
 * asignadas) — mismo patrón "grid + editor lateral" que Física/Runas.
 */

import { ChevronDown, ChevronRight, Dna, Pencil, Plus, Trash2, X } from "lucide-react";
import React, { useMemo, useState } from "react";

import { RichEditor } from "@/editor/lexical";

import { SelectorCriaturasMulti } from "./SelectorCriaturasMulti";
import { useBiologiaConfig, useTaxones } from "./useBiologia";
import type { Taxon } from "./types";

interface Props {
  onSelectCriatura?: (id: string) => void;
}

// ─── Nodo del árbol (recursivo) ─────────────────────────────────────────────

function NodoTaxon({
  taxon,
  hijos,
  nivel,
  seleccionadoId,
  onSelect,
  colapsados,
  onToggleColapso,
}: {
  taxon: Taxon;
  hijos: Map<string | null, Taxon[]>;
  nivel: number;
  seleccionadoId: string | null;
  onSelect: (id: string) => void;
  colapsados: Set<string>;
  onToggleColapso: (id: string) => void;
}) {
  const propiosHijos = hijos.get(taxon.id) ?? [];
  const tieneHijos = propiosHijos.length > 0;
  const colapsado = colapsados.has(taxon.id);
  const activo = taxon.id === seleccionadoId;

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(taxon.id)}
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left transition-colors ${
          activo ? "bg-primary/10 text-primary" : "hover:bg-primary/5 text-primary/70"
        }`}
        style={{ paddingLeft: 8 + nivel * 16 }}
      >
        {tieneHijos ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onToggleColapso(taxon.id);
            }}
            className="shrink-0 p-0.5 rounded hover:bg-primary/10"
          >
            {colapsado ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
          </span>
        ) : (
          <span className="shrink-0 w-[15px]" />
        )}
        <span className="text-micro font-black uppercase tracking-wide text-primary/30 shrink-0">
          {taxon.rango}
        </span>
        <span className="text-xs font-bold truncate">{taxon.nombre || "Sin nombre"}</span>
        {taxon.criatura_ids?.length > 0 && (
          <span className="ml-auto shrink-0 text-micro font-bold text-accent/60">
            {taxon.criatura_ids.length}
          </span>
        )}
      </button>

      {tieneHijos && !colapsado && (
        <div>
          {propiosHijos.map((h) => (
            <NodoTaxon
              key={h.id}
              taxon={h}
              hijos={hijos}
              nivel={nivel + 1}
              seleccionadoId={seleccionadoId}
              onSelect={onSelect}
              colapsados={colapsados}
              onToggleColapso={onToggleColapso}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Editor de rangos (config global, no por taxón) ─────────────────────────

function EditorRangos({
  rangos,
  onChange,
}: {
  rangos: string[];
  onChange: (rangos: string[]) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nuevoRango, setNuevoRango] = useState("");

  const renombrar = (idx: number, valor: string) => {
    onChange(rangos.map((r, i) => (i === idx ? valor : r)));
  };
  const eliminar = (idx: number) => {
    onChange(rangos.filter((_, i) => i !== idx));
  };
  const agregar = () => {
    const v = nuevoRango.trim();
    if (!v) return;
    onChange([...rangos, v]);
    setNuevoRango("");
  };

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setAbierto((o) => !o)}
        className="flex items-center gap-1.5 text-micro font-black uppercase tracking-[0.15em] text-primary/40 hover:text-primary/70 transition-colors"
      >
        <Pencil size={10} /> Rangos de la jerarquía
      </button>

      {abierto && (
        <div className="mt-2 p-2.5 rounded-xl border border-primary/10 bg-primary/[0.02]">
          <p className="text-micro text-primary/35 mb-2">
            Orden de mayor a menor — libre de renombrar, agregar o quitar niveles.
          </p>
          <div className="space-y-1">
            {rangos.map((r, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="text-micro text-primary/25 w-4 shrink-0">{idx + 1}</span>
                <input
                  className="flex-1 min-w-0 bg-transparent text-xs font-bold text-primary/80 outline-none px-1 py-0.5 rounded hover:bg-primary/5 focus:bg-primary/8"
                  value={r}
                  onChange={(e) => renombrar(idx, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => eliminar(idx)}
                  className="shrink-0 p-1 rounded-md text-primary/25 hover:text-red-400 hover:bg-red-400/10"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <input
              className="flex-1 min-w-0 bg-primary/[0.02] border border-primary/10 rounded-lg px-2 py-1 text-xs outline-none placeholder:text-primary/30"
              placeholder="Nuevo rango (ej. Subespecie)…"
              value={nuevoRango}
              onChange={(e) => setNuevoRango(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && agregar()}
            />
            <button
              type="button"
              onClick={agregar}
              className="shrink-0 text-micro font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-primary text-bg-main hover:opacity-90"
            >
              <Plus size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel de detalle del taxón seleccionado ────────────────────────────────

function PanelTaxon({
  taxon,
  rangos,
  onSave,
  onDelete,
  onCrearHijo,
  onSelectCriatura,
}: {
  taxon: Taxon;
  rangos: string[];
  onSave: (updates: Partial<Taxon>) => void;
  onDelete: () => void;
  onCrearHijo: (rango: string) => void;
  onSelectCriatura?: (id: string) => void;
}) {
  const [nombre, setNombre] = useState(taxon.nombre);
  const [descripcion, setDescripcion] = useState(taxon.descripcion ?? "");
  const [rango, setRango] = useState(taxon.rango);

  React.useEffect(() => {
    setNombre(taxon.nombre);
    setDescripcion(taxon.descripcion ?? "");
    setRango(taxon.rango);
  }, [taxon.id]);

  const guardar = () => {
    onSave({ nombre: nombre.trim() || taxon.nombre, descripcion, rango });
  };

  // Próximo rango en la jerarquía, sugerido para crear un hijo directo.
  const idxActual = rangos.indexOf(rango);
  const rangoHijoSugerido = idxActual >= 0 && idxActual < rangos.length - 1
    ? rangos[idxActual + 1]
    : rangos[rangos.length - 1] ?? rango;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <Dna size={12} className="text-accent/60 shrink-0" />
          <input
            className="flex-1 min-w-0 bg-transparent text-sm font-black uppercase italic tracking-tight text-primary truncate outline-none placeholder:text-primary/25 px-1 py-0.5 rounded hover:bg-primary/5 focus:bg-primary/8"
            placeholder="Nombre del taxón…"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={guardar}
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onDelete}
            title="Eliminar taxón"
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

      <div className="mb-3">
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1.5">
          Rango
        </span>
        <select
          className="bg-primary/[0.02] border border-primary/10 rounded-lg px-2.5 py-1.5 text-xs font-bold text-primary/80 outline-none"
          value={rango}
          onChange={(e) => {
            setRango(e.target.value);
            onSave({ rango: e.target.value });
          }}
        >
          {rangos.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1.5">
          Descripción
        </span>
        <RichEditor
          minHeight="6.25rem"
          placeholder="Características del taxón, cómo se diferencia de sus parientes, notas evolutivas…"
          value={descripcion}
          onChange={setDescripcion}
        />
      </div>

      <button
        type="button"
        onClick={() => onCrearHijo(rangoHijoSugerido)}
        className="flex items-center gap-1.5 mb-4 px-2.5 py-1.5 rounded-lg border border-dashed text-micro font-black uppercase tracking-widest transition-all"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
          color: "color-mix(in srgb, var(--primary) 35%, transparent)",
        }}
      >
        <Plus size={10} /> Añadir sub-taxón ({rangoHijoSugerido})
      </button>

      <SelectorCriaturasMulti
        ids={taxon.criatura_ids ?? []}
        onChange={(ids) => onSave({ criatura_ids: ids })}
        onSelectCriatura={onSelectCriatura}
        label="Criaturas de este taxón"
      />
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export function TaxonomiaPage({ onSelectCriatura }: Props) {
  const { taxones, loading, creating, crear, actualizar, eliminar } = useTaxones();
  const { rangos, actualizarRangos } = useBiologiaConfig();
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());

  const hijosPorPadre = useMemo(() => {
    const map = new Map<string | null, Taxon[]>();
    for (const t of taxones) {
      const arr = map.get(t.padre_id) ?? [];
      arr.push(t);
      map.set(t.padre_id, arr);
    }
    return map;
  }, [taxones]);

  const raices = hijosPorPadre.get(null) ?? [];
  const seleccionado = taxones.find((t) => t.id === seleccionadoId) ?? null;

  const toggleColapso = (id: string) => {
    setColapsados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const crearRaiz = async () => {
    const nuevo = await crear("Nuevo taxón", rangos[0] ?? "Reino", null);
    if (nuevo) setSeleccionadoId(nuevo.id);
  };

  const crearHijo = async (padreId: string, rango: string) => {
    const nuevo = await crear("Nuevo taxón", rango, padreId);
    if (nuevo) setSeleccionadoId(nuevo.id);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <EditorRangos rangos={rangos} onChange={actualizarRangos} />

        <div className="flex items-center justify-between mb-2">
          <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
            Árbol filogenético
          </span>
          <button
            type="button"
            disabled={creating}
            onClick={() => void crearRaiz()}
            className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors disabled:opacity-40"
          >
            <Plus size={10} /> Nueva raíz
          </button>
        </div>

        {loading ? (
          <div className="w-full py-6 text-xs text-primary/30 text-center">Cargando…</div>
        ) : raices.length === 0 ? (
          <p className="text-xs text-primary/25 italic py-4 text-center">
            Sin taxones todavía — creá el primer nodo raíz (ej. un Reino).
          </p>
        ) : (
          <div className="rounded-2xl border border-primary/10 bg-white-custom/60 p-2">
            {raices.map((r) => (
              <NodoTaxon
                key={r.id}
                taxon={r}
                hijos={hijosPorPadre}
                nivel={0}
                seleccionadoId={seleccionadoId}
                onSelect={setSeleccionadoId}
                colapsados={colapsados}
                onToggleColapso={toggleColapso}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        {seleccionado ? (
          <PanelTaxon
            key={seleccionado.id}
            taxon={seleccionado}
            rangos={rangos}
            onSave={(updates) => void actualizar(seleccionado.id, updates)}
            onDelete={() => {
              void eliminar(seleccionado.id);
              setSeleccionadoId(null);
            }}
            onCrearHijo={(rango) => void crearHijo(seleccionado.id, rango)}
            onSelectCriatura={onSelectCriatura}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-primary/15 p-6 text-center">
            <p className="text-xs text-primary/30">
              Seleccioná un taxón del árbol para ver o editar su detalle.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
