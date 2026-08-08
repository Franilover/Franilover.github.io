"use client";

/**
 * EcosistemasPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Ecosistemas (bioma/clima + criaturas que lo habitan) y, dentro de cada
 * uno, sus cadenas alimenticias (eslabones ordenados por rol trófico, cada
 * uno con 1+ criaturas). Mismo patrón visual "chips arriba + panel abajo"
 * que BloqueSubsistemasMagia.
 */

import { ArrowLeft, Leaf, Plus, Salad, Trash2, X } from "lucide-react";
import React, { useEffect, useState } from "react";

import { RichEditor } from "@/editor/lexical";

import { SelectorCriaturasMulti } from "./SelectorCriaturasMulti";
import { useCadenasAlimenticias, useEcosistemas } from "./useBiologia";
import {
  ROL_TROFICO_LABEL,
  ROLES_TROFICOS,
  type CadenaAlimenticia,
  type Ecosistema,
  type EslabonTrofico,
  type RolTrofico,
} from "./types";

interface Props {
  onSelectCriatura?: (id: string) => void;
}

// ─── Chip de ecosistema ──────────────────────────────────────────────────────

function ChipEcosistema({
  ecosistema,
  activo,
  onClick,
}: {
  ecosistema: Ecosistema;
  activo?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border transition-colors text-left min-w-[140px] max-w-[220px] ${
        activo
          ? "border-primary/40 bg-primary/8"
          : "border-primary/10 bg-primary/[0.02] hover:bg-primary/5 hover:border-primary/25"
      }`}
    >
      <span className="flex items-center gap-1.5 text-xs font-bold text-primary/80 truncate w-full">
        <Leaf size={11} className="text-accent/60 shrink-0" />
        {ecosistema.nombre || "Sin nombre"}
      </span>
      {ecosistema.bioma ? (
        <span className="text-micro text-primary/40 truncate w-full">{ecosistema.bioma}</span>
      ) : (
        <span className="text-micro text-primary/25 italic">Sin bioma</span>
      )}
      {ecosistema.criatura_ids?.length > 0 && (
        <span className="text-micro font-bold text-primary/30 uppercase tracking-wide">
          {ecosistema.criatura_ids.length} criaturas
        </span>
      )}
    </button>
  );
}

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
}) {
  const [nombre, setNombre] = useState(ecosistema.nombre);
  const [bioma, setBioma] = useState(ecosistema.bioma ?? "");
  const [clima, setClima] = useState(ecosistema.clima ?? "");
  const [descripcion, setDescripcion] = useState(ecosistema.descripcion ?? "");

  useEffect(() => {
    setNombre(ecosistema.nombre);
    setBioma(ecosistema.bioma ?? "");
    setClima(ecosistema.clima ?? "");
    setDescripcion(ecosistema.descripcion ?? "");
  }, [ecosistema.id]);

  const guardar = () => {
    onSave({ nombre: nombre.trim() || ecosistema.nombre, bioma, clima, descripcion });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-4">
        <button
          type="button"
          onClick={() => {
            guardar();
            onVolver();
          }}
          className="shrink-0 p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
        >
          <ArrowLeft size={14} />
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

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1">
            Bioma
          </span>
          <input
            className="w-full bg-primary/[0.02] border border-primary/10 rounded-lg px-2.5 py-1.5 text-xs outline-none placeholder:text-primary/30"
            placeholder="Ej. selva luminiscente…"
            value={bioma}
            onChange={(e) => setBioma(e.target.value)}
            onBlur={guardar}
          />
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
          ids={ecosistema.criatura_ids ?? []}
          onChange={(ids) => onSave({ criatura_ids: ids })}
          onSelectCriatura={onSelectCriatura}
          label="Criaturas que lo habitan"
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
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export function EcosistemasPage({ onSelectCriatura }: Props) {
  const {
    ecosistemas,
    loading,
    creating,
    crear,
    actualizar,
    eliminar,
  } = useEcosistemas();
  const {
    cadenas,
    creating: creandoCadena,
    crear: crearCadena,
    actualizar: actualizarCadena,
    eliminar: eliminarCadena,
  } = useCadenasAlimenticias();

  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [creandoAbierto, setCreandoAbierto] = useState(false);

  const seleccionado = ecosistemas.find((e) => e.id === seleccionadoId) ?? null;
  const cadenasDelEcosistema = cadenas.filter((c) => c.ecosistema_id === seleccionadoId);

  const handleCrear = async () => {
    const nombre = nombreNuevo.trim();
    if (!nombre) return;
    const nuevo = await crear(nombre);
    setNombreNuevo("");
    setCreandoAbierto(false);
    if (nuevo) setSeleccionadoId(nuevo.id);
  };

  if (seleccionado) {
    return (
      <PanelEcosistema
        ecosistema={seleccionado}
        cadenas={cadenasDelEcosistema}
        creandoCadena={creandoCadena}
        onSave={(updates) => void actualizar(seleccionado.id, updates)}
        onDelete={() => {
          void eliminar(seleccionado.id);
          setSeleccionadoId(null);
        }}
        onVolver={() => setSeleccionadoId(null)}
        onCrearCadena={() => void crearCadena("Nueva cadena", seleccionado.id)}
        onActualizarCadena={(id, updates) => void actualizarCadena(id, updates)}
        onEliminarCadena={(id) => void eliminarCadena(id)}
        onSelectCriatura={onSelectCriatura}
      />
    );
  }

  return (
    <div>
      {creandoAbierto && (
        <div className="flex items-center gap-1.5 mb-3">
          <input
            autoFocus
            className="flex-1 min-w-0 bg-primary/[0.02] border border-primary/10 rounded-lg px-2.5 py-1.5 text-xs text-primary/80 outline-none placeholder:text-primary/30 focus:border-primary/25"
            placeholder="Nombre del ecosistema…"
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCrear();
              if (e.key === "Escape") setCreandoAbierto(false);
            }}
          />
          <button
            type="button"
            disabled={!nombreNuevo.trim() || creating}
            onClick={() => void handleCrear()}
            className="shrink-0 text-micro font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-primary text-bg-main hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Crear
          </button>
        </div>
      )}

      {loading ? (
        <div className="w-full py-6 text-xs text-primary/30 text-center">Cargando…</div>
      ) : (
        <div className="flex flex-wrap items-start gap-2">
          {ecosistemas.map((e) => (
            <ChipEcosistema
              key={e.id}
              ecosistema={e}
              onClick={() => setSeleccionadoId(e.id)}
            />
          ))}
          {ecosistemas.length === 0 && (
            <span className="self-center text-xs text-primary/25 py-2">
              Sin ecosistemas todavía
            </span>
          )}
          <button
            type="button"
            onClick={() => setCreandoAbierto((o) => !o)}
            title="Añadir ecosistema"
            className="shrink-0 p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <Plus size={9} className="text-primary/60" />
          </button>
        </div>
      )}
    </div>
  );
}
