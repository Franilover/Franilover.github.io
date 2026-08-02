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

import { ArrowLeft, Bug, Plus, Sparkle, Trash2, X } from "lucide-react";
import React, { useEffect, useState } from "react";

import { useCriaturasPorIds } from "./useCriaturasPorIds";
import type { SubsistemaFila, SubsistemaMagia } from "./useSubsistemasMagia";

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

// ─── Editor completo de un subsistema (inline, sin modal) ──────────────────
// Antes era un modal flotante (ModalEditorSubsistema) que tapaba la
// pantalla. Ahora vive inline: se muestra donde antes estaba el ensayo de
// Energías, reemplazándolo mientras hay un subsistema seleccionado.

export function PanelEditorSubsistema({
  subsistema,
  onVolver,
  onSave,
  onDelete,
  onSelectCriatura,
}: {
  subsistema: SubsistemaMagia;
  /** Vuelve a mostrar el ensayo de Energías en vez de este editor. */
  onVolver: () => void;
  onSave: (updates: Partial<SubsistemaMagia>) => void;
  onDelete: () => void;
  /** Se dispara al clickear una criatura de la lista — el padre decide
   *  a dónde navegar (p. ej. abrir su editor). */
  onSelectCriatura?: (id: string) => void;
}) {
  const [nombre, setNombre] = useState(subsistema.nombre);
  const [descripcion, setDescripcion] = useState(subsistema.descripcion ?? "");
  const [canales, setCanales] = useState<SubsistemaFila[]>(subsistema.canales ?? []);
  const [filtros, setFiltros] = useState<SubsistemaFila[]>(subsistema.filtros ?? []);
  const [complementos, setComplementos] = useState<SubsistemaFila[]>(subsistema.complementos ?? []);
  const { criaturas: criaturasDelSubsistema, loading: loadingCriaturas } =
    useCriaturasPorIds(subsistema.criatura_ids ?? []);

  // Si se selecciona otro subsistema (o se vuelve a abrir el mismo tras
  // guardar en otro lado), sincronizamos el form local con la nueva prop.
  useEffect(() => {
    setNombre(subsistema.nombre);
    setDescripcion(subsistema.descripcion ?? "");
    setCanales(subsistema.canales ?? []);
    setFiltros(subsistema.filtros ?? []);
    setComplementos(subsistema.complementos ?? []);
  }, [subsistema.id]);

  const guardar = () => {
    onSave({ nombre: nombre.trim() || subsistema.nombre, descripcion, canales, filtros, complementos });
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <button
          type="button"
          onClick={() => {
            guardar();
            onVolver();
          }}
          title="Volver a Energías"
          className="shrink-0 p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <Sparkle size={12} className="text-accent/60 shrink-0" />
          <input
            className="flex-1 min-w-0 bg-transparent text-sm font-black uppercase italic tracking-tight text-primary truncate outline-none placeholder:text-primary/25 px-1 py-0.5 rounded hover:bg-primary/5 focus:bg-primary/8"
            placeholder="Nombre del subsistema…"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={guardar}
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
            onClick={guardar}
            className="text-micro font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-primary text-bg-main hover:opacity-90 transition-opacity"
          >
            Guardar
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="mb-4">
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1.5">
          Reglas / Info
        </span>
        <textarea
          className="w-full min-h-[100px] bg-primary/[0.02] border border-primary/10 rounded-lg px-2.5 py-2 text-xs text-primary/80 outline-none placeholder:text-primary/25 focus:border-primary/25 resize-y leading-relaxed"
          placeholder="Descripción libre: qué canaliza, cómo funciona, reglas particulares…"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          onBlur={guardar}
        />
      </div>

      <EditorFilas titulo="Canales" filas={canales} onChange={setCanales} />
      <EditorFilas titulo="Filtros" filas={filtros} onChange={setFiltros} />
      <EditorFilas titulo="Complementos" filas={complementos} onChange={setComplementos} conCanaliza={false} />

      {/* Criaturas que usan este subsistema — asignadas desde el editor de
          criaturas (botón Clasificación → Subsistema Mágico). Solo lectura
          acá: el vínculo se cambia desde la criatura, no desde aquí. */}
      <div className="mt-2">
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1.5">
          Criaturas que lo usan
        </span>
        {loadingCriaturas ? (
          <p className="text-micro text-primary/25 italic py-1">Cargando…</p>
        ) : criaturasDelSubsistema.length === 0 ? (
          <p className="text-micro text-primary/25 italic py-1">
            Ninguna criatura asignada todavía
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {criaturasDelSubsistema.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.nombre}
                className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border border-primary/10 bg-primary/[0.02] hover:bg-primary/6 hover:border-primary/25 transition-colors"
                onClick={() => onSelectCriatura?.(c.id)}
              >
                <span className="shrink-0 w-5 h-5 rounded-full overflow-hidden bg-primary/8 flex items-center justify-center">
                  {c.imagen_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={c.nombre}
                      className="w-full h-full object-cover"
                      src={c.imagen_url}
                    />
                  ) : (
                    <Bug size={9} className="text-primary/25" />
                  )}
                </span>
                <span className="text-micro font-bold text-primary/70 truncate max-w-[120px]">
                  {c.nombre}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chip de subsistema (vista colapsada) ──────────────────────────────────

function ChipSubsistema({
  subsistema,
  activo,
  onClick,
}: {
  subsistema: SubsistemaMagia;
  activo?: boolean;
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
      className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border transition-colors text-left min-w-[140px] max-w-[220px] ${
        activo
          ? "border-primary/40 bg-primary/8"
          : "border-primary/10 bg-primary/[0.02] hover:bg-primary/5 hover:border-primary/25"
      }`}
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

export function BloqueSubsistemasMagia({
  subsistemas,
  loading,
  creating,
  crear,
  subsistemaSeleccionadoId,
  onSelect,
}: {
  subsistemas: SubsistemaMagia[];
  loading: boolean;
  creating: boolean;
  crear: (nombre: string) => Promise<SubsistemaMagia | null>;
  /** Id del subsistema actualmente mostrado en el panel derecho (o null). */
  subsistemaSeleccionadoId?: string | null;
  /** Se dispara al clickear un chip — el padre decide qué mostrar. */
  onSelect: (id: string) => void;
}) {
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [creandoAbierto, setCreandoAbierto] = useState(false);

  const handleCrear = async () => {
    const nombre = nombreNuevo.trim();
    if (!nombre) return;
    const nuevo = await crear(nombre);
    setNombreNuevo("");
    setCreandoAbierto(false);
    if (nuevo) onSelect(nuevo.id);
  };

  return (
    <div className="mb-6">
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
      ) : (
        <div className="flex flex-wrap items-start gap-2">
          {subsistemas.map((s) => (
            <ChipSubsistema
              key={s.id}
              subsistema={s}
              activo={s.id === subsistemaSeleccionadoId}
              onClick={() => onSelect(s.id)}
            />
          ))}
          {subsistemas.length === 0 && (
            <span className="self-center text-xs text-primary/25 py-2">
              Sin subsistemas todavía
            </span>
          )}
          <button
            type="button"
            onClick={() => setCreandoAbierto((o) => !o)}
            title="Añadir subsistema"
            className="shrink-0 p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <Plus size={9} className="text-primary/60" />
          </button>
        </div>
      )}
    </div>
  );
}
