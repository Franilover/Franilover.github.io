"use client";

/**
 * BloqueSubsistemasMagia
 * ───────────────────────────────────────────────────────────────────────────
 * Sección de "Subsistemas de Magia" (Luminia, Sintonía, Litonio, Fitonio,
 * Hemonia, etc. — ver el documento de referencia del sistema de magia).
 * Cada subsistema es una entidad propia (tabla subsistemas_magia) con:
 *   - nombre
 *   - descripción libre (qué canaliza, cómo funciona)
 *   - tabla de Canales   (nombre / descripción / qué Oris canaliza)
 *   - tabla de Filtros   (idem)
 *   - tabla de Complementos (idem, sin columna "canaliza" obligatoria)
 *
 * Se muestra debajo del bloque de Ensayos GOS+Magia en MagiaPorTipo.
 */

import { Plus, Sparkle, Trash2, X } from "lucide-react";
import React, { useState } from "react";

import { MotionDiv } from "@/ui/Motion";

import {
  useSubsistemasMagia,
  type SubsistemaFila,
  type SubsistemaMagia,
} from "./useSubsistemasMagia";

// ─── Editor de tabla de filas (Canales / Filtros / Complementos) ───────────

function EditorFilas({
  titulo,
  filas,
  onChange,
  conCanaliza = true,
}: {
  titulo: string;
  filas: SubsistemaFila[];
  onChange: (filas: SubsistemaFila[]) => void;
  conCanaliza?: boolean;
}) {
  const actualizarFila = (idx: number, patch: Partial<SubsistemaFila>) => {
    onChange(filas.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };
  const eliminarFila = (idx: number) => {
    onChange(filas.filter((_, i) => i !== idx));
  };
  const agregarFila = () => {
    onChange([...filas, { nombre: "", descripcion: "", canaliza: "" }]);
  };

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
          {titulo}
        </span>
        <button
          type="button"
          onClick={agregarFila}
          className="flex items-center gap-1 text-micro font-bold text-primary/40 hover:text-primary transition-colors"
        >
          <Plus size={10} /> Añadir fila
        </button>
      </div>

      {filas.length === 0 ? (
        <p className="text-micro text-primary/25 italic py-1">Sin filas todavía</p>
      ) : (
        <div className="space-y-1.5">
          {filas.map((f, idx) => (
            <div
              key={idx}
              className="group flex items-start gap-1.5 p-2 rounded-lg border border-primary/10 bg-primary/[0.02]"
            >
              <div className="flex-1 min-w-0 grid gap-1.5" style={{ gridTemplateColumns: conCanaliza ? "1fr 2fr 1fr" : "1fr 2fr" }}>
                <input
                  className="min-w-0 bg-transparent text-xs font-bold text-primary/80 outline-none placeholder:text-primary/25 placeholder:font-normal px-1 py-0.5 rounded hover:bg-primary/5 focus:bg-primary/8"
                  placeholder="Nombre"
                  value={f.nombre}
                  onChange={(e) => actualizarFila(idx, { nombre: e.target.value })}
                />
                <input
                  className="min-w-0 bg-transparent text-xs text-primary/65 outline-none placeholder:text-primary/25 px-1 py-0.5 rounded hover:bg-primary/5 focus:bg-primary/8"
                  placeholder="Descripción"
                  value={f.descripcion ?? ""}
                  onChange={(e) => actualizarFila(idx, { descripcion: e.target.value })}
                />
                {conCanaliza && (
                  <input
                    className="min-w-0 bg-transparent text-xs text-accent/80 font-semibold outline-none placeholder:text-primary/25 placeholder:font-normal px-1 py-0.5 rounded hover:bg-primary/5 focus:bg-primary/8"
                    placeholder="Canaliza (Oris)"
                    value={f.canaliza ?? ""}
                    onChange={(e) => actualizarFila(idx, { canaliza: e.target.value })}
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => eliminarFila(idx)}
                title="Eliminar fila"
                className="shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-primary/25 hover:text-red-400 hover:bg-red-400/10"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal editor completo de un subsistema ────────────────────────────────

function ModalEditorSubsistema({
  subsistema,
  onClose,
  onSave,
  onDelete,
}: {
  subsistema: SubsistemaMagia;
  onClose: () => void;
  onSave: (updates: Partial<SubsistemaMagia>) => void;
  onDelete: () => void;
}) {
  const [nombre, setNombre] = useState(subsistema.nombre);
  const [descripcion, setDescripcion] = useState(subsistema.descripcion ?? "");
  const [canales, setCanales] = useState<SubsistemaFila[]>(subsistema.canales ?? []);
  const [filtros, setFiltros] = useState<SubsistemaFila[]>(subsistema.filtros ?? []);
  const [complementos, setComplementos] = useState<SubsistemaFila[]>(subsistema.complementos ?? []);

  const guardarYCerrar = () => {
    onSave({ nombre: nombre.trim() || subsistema.nombre, descripcion, canales, filtros, complementos });
    onClose();
  };

  return (
    <>
      <MotionDiv
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[9999]"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        style={{ background: "color-mix(in srgb, var(--bg-main) 70%, transparent)", backdropFilter: "blur(6px)" }}
        onClick={guardarYCerrar}
      />
      <MotionDiv
        animate={{ opacity: 1, scale: 1, y: 0, x: "-50%" }}
        className="fixed z-[9999] flex flex-col"
        exit={{ opacity: 0, scale: 0.97, y: -8, x: "-50%" }}
        initial={{ opacity: 0, scale: 0.97, y: -8, x: "-50%" }}
        style={{
          top: "6%",
          left: "50%",
          width: "min(640px, calc(100vw - 32px))",
          maxHeight: "88vh",
          background: "var(--bg-menu)",
          border: "1px solid color-mix(in srgb, var(--foreground) 12%, transparent)",
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: "0 24px 80px color-mix(in srgb, var(--bg-main) 60%, transparent)",
        }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/10 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Sparkle size={12} className="text-accent/60 shrink-0" />
            <input
              className="flex-1 min-w-0 bg-transparent text-sm font-black uppercase italic tracking-tight text-primary truncate outline-none placeholder:text-primary/25 px-1 py-0.5 rounded hover:bg-primary/5 focus:bg-primary/8"
              placeholder="Nombre del subsistema…"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onDelete}
              title="Eliminar subsistema"
              className="p-1.5 rounded-lg text-primary/25 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <Trash2 size={13} />
            </button>
            <button
              type="button"
              onClick={guardarYCerrar}
              title="Cerrar"
              className="p-1.5 rounded-lg text-primary/25 hover:text-primary hover:bg-primary/5 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4">
            <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1.5">
              Reglas / Info
            </span>
            <textarea
              className="w-full min-h-[100px] bg-primary/[0.02] border border-primary/10 rounded-lg px-2.5 py-2 text-xs text-primary/80 outline-none placeholder:text-primary/25 focus:border-primary/25 resize-y leading-relaxed"
              placeholder="Descripción libre: qué canaliza, cómo funciona, reglas particulares…"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          <EditorFilas titulo="Canales" filas={canales} onChange={setCanales} />
          <EditorFilas titulo="Filtros" filas={filtros} onChange={setFiltros} />
          <EditorFilas titulo="Complementos" filas={complementos} onChange={setComplementos} conCanaliza={false} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-4 py-2.5 border-t border-primary/10 shrink-0">
          <button
            type="button"
            onClick={guardarYCerrar}
            className="text-micro font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-primary text-bg-main hover:opacity-90 transition-opacity"
          >
            Guardar
          </button>
        </div>
      </MotionDiv>
    </>
  );
}

// ─── Chip de subsistema (vista colapsada) ──────────────────────────────────

function ChipSubsistema({
  subsistema,
  onClick,
}: {
  subsistema: SubsistemaMagia;
  onClick: () => void;
}) {
  const totalFilas =
    (subsistema.canales?.length ?? 0) +
    (subsistema.filtros?.length ?? 0) +
    (subsistema.complementos?.length ?? 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border border-primary/10 bg-primary/[0.02] hover:bg-primary/5 hover:border-primary/25 transition-colors text-left min-w-[140px] max-w-[220px]"
    >
      <span className="flex items-center gap-1.5 text-xs font-bold text-primary/80 truncate w-full">
        <Sparkle size={11} className="text-accent/60 shrink-0" />
        {subsistema.nombre || "Sin nombre"}
      </span>
      {subsistema.descripcion ? (
        <span className="text-micro text-primary/40 line-clamp-2 leading-snug">
          {subsistema.descripcion}
        </span>
      ) : (
        <span className="text-micro text-primary/25 italic">Sin descripción</span>
      )}
      {totalFilas > 0 && (
        <span className="text-micro font-bold text-primary/30 uppercase tracking-wide">
          {totalFilas} {totalFilas === 1 ? "fila" : "filas"}
        </span>
      )}
    </button>
  );
}

// ─── Bloque principal ───────────────────────────────────────────────────────

export function BloqueSubsistemasMagia() {
  const { subsistemas, loading, creating, crear, actualizar, eliminar } = useSubsistemasMagia();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [creandoAbierto, setCreandoAbierto] = useState(false);

  const subsistemaEditando = subsistemas.find((s) => s.id === editandoId) ?? null;

  const handleCrear = async () => {
    const nombre = nombreNuevo.trim();
    if (!nombre) return;
    const nuevo = await crear(nombre);
    setNombreNuevo("");
    setCreandoAbierto(false);
    if (nuevo) setEditandoId(nuevo.id);
  };

  return (
    <div className="rounded-xl border border-primary/10 bg-primary/[0.03] overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-3 py-1.5 bg-primary/10 border-b border-primary/10">
        <span />
        <span className="justify-self-center max-w-[280px] truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70 flex items-center gap-1">
          <Sparkle size={9} className="shrink-0" />
          Subsistemas de Magia
        </span>
        <div className="justify-self-end">
          <button
            type="button"
            onClick={() => setCreandoAbierto((o) => !o)}
            title="Añadir subsistema"
            className="p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <Plus size={9} className="text-primary/60" />
          </button>
        </div>
      </div>

      <div className="p-4">
        {creandoAbierto && (
          <div className="flex items-center gap-1.5 mb-3">
            <input
              autoFocus
              className="flex-1 min-w-0 bg-primary/[0.02] border border-primary/10 rounded-lg px-2.5 py-1.5 text-xs text-primary/80 outline-none placeholder:text-primary/30 focus:border-primary/25"
              placeholder="Nombre del subsistema (ej. Luminia)…"
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
        ) : subsistemas.length === 0 ? (
          <div className="w-full py-6 text-xs text-primary/25 text-center">
            Sin subsistemas todavía
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {subsistemas.map((s) => (
              <ChipSubsistema key={s.id} subsistema={s} onClick={() => setEditandoId(s.id)} />
            ))}
          </div>
        )}
      </div>

      {subsistemaEditando && (
        <ModalEditorSubsistema
          subsistema={subsistemaEditando}
          onClose={() => setEditandoId(null)}
          onSave={(updates) => void actualizar(subsistemaEditando.id, updates)}
          onDelete={() => {
            void eliminar(subsistemaEditando.id);
            setEditandoId(null);
          }}
        />
      )}
    </div>
  );
}
