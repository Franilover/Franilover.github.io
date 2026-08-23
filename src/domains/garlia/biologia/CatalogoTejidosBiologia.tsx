"use client";

/**
 * CatalogoTejidosBiologia.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Biblioteca global de Células y Tejidos — dos grids navegables, cada una
 * con su editor propio (crear/editar/borrar), sin necesidad de pasar por
 * ningún Órgano. Nace del pedido explícito de mostrar en Biología, arriba
 * de Órganos, la misma jerarquía Compuesto→Célula→Tejido pero como
 * catálogo de solo composición — separado de "Usar existente" (que vive
 * dentro de la fórmula de un Órgano puntual, ver SelectorFormulaTejidos.tsx).
 *
 * Ojo con la cadena real (ver elementos/types.ts): Célula → compuesto_id
 * (apunta directo a un Compuesto), pero Tejido → celula_id (apunta a una
 * Célula, NO a un Compuesto directo). Por eso son dos paneles distintos,
 * no uno genérico: el de Célula usa SelectorCompuesto, el de Tejido usa
 * SelectorCelula (nuevo, definido acá mismo).
 *
 * Mismo lenguaje visual que GridCatalogoGrupo (grid de 3 columnas, click
 * abre panel flotante centrado).
 */

import { Beaker, Layers, Plus, Trash2, X, Search, Check } from "lucide-react";
import React, { useMemo, useState } from "react";

import { useConfirm } from "@/ui/ConfirmModal";
import { SelectorCompuesto } from "@/domains/garlia/_shared/SelectorCompuesto";
import { useCelulas } from "@/domains/garlia/elementos/useCelulas";
import { useTejidos } from "@/domains/garlia/elementos/useTejidos";
import type { Celula, Compuesto, Tejido } from "@/domains/garlia/elementos/types";

interface Props {
  compuestos: Compuesto[];
  loadingCompuestos?: boolean;
  onCompuestoCreado?: (c: Compuesto) => void;
  onAbrirCompuesto?: (compuestoId: string) => void;
}

export function CatalogoTejidosBiologia({
  compuestos,
  loadingCompuestos,
  onCompuestoCreado,
  onAbrirCompuesto,
}: Props) {
  const celulas = useCelulas();
  const tejidos = useTejidos();

  const [celulaSeleccionadaId, setCelulaSeleccionadaId] = useState<string | null>(null);
  const [tejidoSeleccionadoId, setTejidoSeleccionadoId] = useState<string | null>(null);

  const celulaActiva = celulas.items.find((c) => c.id === celulaSeleccionadaId) ?? null;
  const tejidoActivo = tejidos.items.find((t) => t.id === tejidoSeleccionadoId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Células ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/50">
            Células · {celulas.items.length}
          </p>
          <button
            type="button"
            onClick={() => void celulas.crear()}
            disabled={celulas.creando}
            title="Crear célula nueva"
            className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Plus size={10} /> Nueva
          </button>
        </div>

        <GridSimple
          items={celulas.items}
          loading={celulas.loading}
          icono={<Beaker size={12} className="text-primary/40 shrink-0" />}
          seleccionadoId={celulaSeleccionadaId}
          onSeleccionar={setCelulaSeleccionadaId}
          labelVacio="células"
        />

        {celulaActiva && (
          <PanelEditorCelula
            item={celulaActiva}
            compuestos={compuestos}
            loadingCompuestos={loadingCompuestos}
            onCerrar={() => setCelulaSeleccionadaId(null)}
            onActualizar={celulas.actualizar}
            onEliminar={async (id) => {
              const res = await celulas.eliminar(id);
              if (res.ok) setCelulaSeleccionadaId(null);
              return res;
            }}
            onCompuestoCreado={onCompuestoCreado}
            onAbrirCompuesto={onAbrirCompuesto}
          />
        )}
      </div>

      {/* ── Tejidos ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 border-t border-primary/10 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/50">
            Tejidos · {tejidos.items.length}
          </p>
          <button
            type="button"
            onClick={() => void tejidos.crear()}
            disabled={tejidos.creando}
            title="Crear tejido nuevo"
            className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Plus size={10} /> Nuevo
          </button>
        </div>

        <GridSimple
          items={tejidos.items}
          loading={tejidos.loading}
          icono={<Layers size={12} className="text-primary/40 shrink-0" />}
          seleccionadoId={tejidoSeleccionadoId}
          onSeleccionar={setTejidoSeleccionadoId}
          labelVacio="tejidos"
        />

        {tejidoActivo && (
          <PanelEditorTejido
            item={tejidoActivo}
            celulas={celulas.items}
            loadingCelulas={celulas.loading}
            onCerrar={() => setTejidoSeleccionadoId(null)}
            onActualizar={tejidos.actualizar}
            onEliminar={async (id) => {
              const res = await tejidos.eliminar(id);
              if (res.ok) setTejidoSeleccionadoId(null);
              return res;
            }}
            onAbrirCelula={(celulaId) => {
              setTejidoSeleccionadoId(null);
              setCelulaSeleccionadaId(celulaId);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Grid genérica (solo lista + click, sin lógica de edición) ─────────────

function GridSimple<T extends { id: string; nombre: string }>({
  items,
  loading,
  icono,
  seleccionadoId,
  onSeleccionar,
  labelVacio,
}: {
  items: T[];
  loading: boolean;
  icono: React.ReactNode;
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
  labelVacio: string;
}) {
  // Mismo fix que CatalogoVetasFisica.tsx: no tapar la grid con "Cargando…"
  // si ya hay items (Dexie o fetch previo) — solo cuando no hay nada todavía.
  if (loading && items.length === 0) {
    return <p className="text-micro text-primary/25 italic py-2">Cargando…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="py-4 text-micro text-primary/25 text-center border border-dashed border-primary/10 rounded-md">
        Sin {labelVacio} todavía
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 items-start">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSeleccionar(item.id)}
          className={`w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-left transition-all cursor-pointer ${
            seleccionadoId === item.id
              ? "border-primary/30 bg-primary/5"
              : "border-primary/10 bg-primary/[0.02] hover:border-primary/25 hover:bg-primary/5"
          }`}
        >
          {icono}
          <span className="text-micro font-black text-primary truncate">
            {item.nombre || "(sin nombre)"}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Panel Célula: nombre, función, notas, Compuesto (compuesto_id) ────────
// Exportado: reutilizado directo desde SelectorFormulaTejidos (fila "hecho
// de" de un Tejido en la fórmula de un Órgano) — clickear ahí debe abrir
// ESTE panel (Célula), no el del Compuesto directo, ver cadena real en el
// comentario de arriba del archivo.

export function PanelEditorCelula({
  item,
  compuestos,
  loadingCompuestos,
  onCerrar,
  onActualizar,
  onEliminar,
  onCompuestoCreado,
  onAbrirCompuesto,
}: {
  item: Celula;
  compuestos: Compuesto[];
  loadingCompuestos?: boolean;
  onCerrar: () => void;
  onActualizar: (id: string, cambios: Partial<Celula>) => void;
  onEliminar: (id: string) => Promise<{ ok: boolean; error: unknown }>;
  onCompuestoCreado?: (c: Compuesto) => void;
  onAbrirCompuesto?: (compuestoId: string) => void;
}) {
  const { confirm, ConfirmModal } = useConfirm();
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  async function handleEliminar() {
    const ok = await confirm({
      title: "Eliminar célula",
      message: `¿Eliminar "${item.nombre}"? Esta acción no se puede deshacer. Si algún Tejido la usa, no se va a poder borrar.`,
    });
    if (!ok) return;
    setEliminando(true);
    setErrorEliminar(null);
    const res = await onEliminar(item.id);
    setEliminando(false);
    if (!res.ok) {
      setErrorEliminar(
        "No se pudo eliminar — probablemente algún Tejido todavía la usa. Cambiale el compuesto desde ahí o quitala primero.",
      );
    }
  }

  return (
    <PanelFlotanteBase onCerrar={onCerrar}>
      <ConfirmModal />
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-primary/10">
        <input
          className="min-w-0 flex-1 bg-transparent px-0 py-1 text-sm font-semibold text-primary/80 outline-none placeholder:text-primary/25"
          placeholder="Nombre…"
          value={item.nombre ?? ""}
          onChange={(e) => onActualizar(item.id, { nombre: e.target.value })}
        />
        <button
          type="button"
          onClick={handleEliminar}
          disabled={eliminando}
          title="Eliminar"
          className="shrink-0 p-1 rounded hover:bg-red-500/10 text-red-500/40 hover:text-red-500 transition disabled:opacity-40"
        >
          <Trash2 size={14} />
        </button>
        <button
          type="button"
          onClick={onCerrar}
          title="Cerrar"
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-primary/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {errorEliminar && <ErrorBanner texto={errorEliminar} />}

        <input
          className="w-full bg-transparent px-0 py-0.5 text-micro font-bold text-primary/60 outline-none placeholder:text-primary/25"
          placeholder="Función…"
          value={item.funcion ?? ""}
          onChange={(e) => onActualizar(item.id, { funcion: e.target.value })}
        />

        <div>
          <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">
            Compuesto
          </p>
          <SelectorCompuesto
            compuestos={compuestos}
            loadingCompuestos={loadingCompuestos}
            compuestoId={item.compuesto_id}
            onChange={(compuestoId) => onActualizar(item.id, { compuesto_id: compuestoId })}
            onCompuestoCreado={onCompuestoCreado}
            onEditarCompuesto={onAbrirCompuesto}
          />
        </div>

        <NotasField
          value={item.notas ?? ""}
          onChange={(notas) => onActualizar(item.id, { notas })}
        />

        <NotaReutilizable />
      </div>
    </PanelFlotanteBase>
  );
}

// ─── Panel Tejido: nombre, función, notas, Célula (celula_id) ──────────────
// Exportado: reutilizado directo desde SelectorFormulaTejidos/GruposCompuestosPage
// (editor de la fórmula de un Órgano) para abrir el mismo editor completo al
// clickear el nombre de una fila — un solo editor de Tejido en toda la app.

export function PanelEditorTejido({
  item,
  celulas,
  loadingCelulas,
  onCerrar,
  onActualizar,
  onEliminar,
  onAbrirCelula,
}: {
  item: Tejido;
  celulas: Celula[];
  loadingCelulas?: boolean;
  onCerrar: () => void;
  onActualizar: (id: string, cambios: Partial<Tejido>) => void;
  onEliminar: (id: string) => Promise<{ ok: boolean; error: unknown }>;
  /** Cierra este panel y abre el de la Célula elegida — navegación cruzada. */
  onAbrirCelula?: (celulaId: string) => void;
}) {
  const { confirm, ConfirmModal } = useConfirm();
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  async function handleEliminar() {
    const ok = await confirm({
      title: "Eliminar tejido",
      message: `¿Eliminar "${item.nombre}"? Esta acción no se puede deshacer. Si algún Órgano lo usa, no se va a poder borrar.`,
    });
    if (!ok) return;
    setEliminando(true);
    setErrorEliminar(null);
    const res = await onEliminar(item.id);
    setEliminando(false);
    if (!res.ok) {
      setErrorEliminar(
        "No se pudo eliminar — probablemente algún Órgano todavía lo usa. Quitalo de esa fórmula primero.",
      );
    }
  }

  return (
    <PanelFlotanteBase onCerrar={onCerrar}>
      <ConfirmModal />
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-primary/10">
        <input
          className="min-w-0 flex-1 bg-transparent px-0 py-1 text-sm font-semibold text-primary/80 outline-none placeholder:text-primary/25"
          placeholder="Nombre…"
          value={item.nombre ?? ""}
          onChange={(e) => onActualizar(item.id, { nombre: e.target.value })}
        />
        <button
          type="button"
          onClick={handleEliminar}
          disabled={eliminando}
          title="Eliminar"
          className="shrink-0 p-1 rounded hover:bg-red-500/10 text-red-500/40 hover:text-red-500 transition disabled:opacity-40"
        >
          <Trash2 size={14} />
        </button>
        <button
          type="button"
          onClick={onCerrar}
          title="Cerrar"
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-primary/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {errorEliminar && <ErrorBanner texto={errorEliminar} />}

        <input
          className="w-full bg-transparent px-0 py-0.5 text-micro font-bold text-primary/60 outline-none placeholder:text-primary/25"
          placeholder="Función…"
          value={item.funcion ?? ""}
          onChange={(e) => onActualizar(item.id, { funcion: e.target.value })}
        />

        <div>
          <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">
            Célula
          </p>
          <SelectorCelula
            celulas={celulas}
            loadingCelulas={loadingCelulas}
            celulaId={item.celula_id}
            onChange={(celulaId) => onActualizar(item.id, { celula_id: celulaId })}
            onAbrirCelula={onAbrirCelula}
          />
        </div>

        <NotasField
          value={item.notas ?? ""}
          onChange={(notas) => onActualizar(item.id, { notas })}
        />

        <NotaReutilizable />
      </div>
    </PanelFlotanteBase>
  );
}

// ─── SelectorCelula: mismo lenguaje visual que SelectorCompuesto, pero
// eligiendo una Célula del catálogo (para Tejido.celula_id) — no crea
// Células nuevas desde acá (para eso está el botón "Nueva" de la grid).
// Exportado junto con PanelEditorTejido — ver nota arriba. ────────────────

export function SelectorCelula({
  celulas,
  loadingCelulas,
  celulaId,
  onChange,
  onAbrirCelula,
}: {
  celulas: Celula[];
  loadingCelulas?: boolean;
  celulaId: string | null;
  onChange: (celulaId: string | null) => void;
  onAbrirCelula?: (celulaId: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);

  const elegida = useMemo(() => celulas.find((c) => c.id === celulaId) ?? null, [celulas, celulaId]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return celulas;
    return celulas.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [celulas, busqueda]);

  function elegir(c: Celula) {
    onChange(c.id);
    setAbierto(false);
    setBusqueda("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (filtradas.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => (i + 1) % filtradas.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => (i - 1 + filtradas.length) % filtradas.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = filtradas[activo];
      if (c) elegir(c);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  if (elegida && !abierto) {
    return (
      <div className="flex items-center gap-1.5 bg-primary/5 rounded-md pl-2.5 pr-1.5 py-1.5 border border-primary/10">
        <Beaker size={12} className="text-accent/60 shrink-0" />
        <button
          type="button"
          onClick={() => onAbrirCelula?.(elegida.id)}
          disabled={!onAbrirCelula}
          className="flex-1 min-w-0 truncate text-left text-micro font-bold text-primary/80 disabled:cursor-default hover:enabled:text-accent hover:enabled:underline cursor-pointer"
        >
          {elegida.nombre || "Sin nombre"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          title="Cambiar"
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-primary/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
        >
          <Search size={11} />
        </button>
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Quitar"
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-primary/40 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
        >
          <X size={11} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 bg-primary/5 rounded-md pl-2.5 pr-1.5 py-1.5 border border-primary/15">
        <Search size={12} className="text-primary/30 shrink-0" />
        <input
          autoFocus
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setActivo(0);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setAbierto(false), 120)}
          placeholder={loadingCelulas ? "Cargando…" : "Buscar célula…"}
          className="flex-1 min-w-0 bg-transparent px-0 py-0.5 text-micro font-bold text-primary outline-none placeholder:text-primary/30 placeholder:font-normal"
        />
        {elegida && (
          <button
            type="button"
            onMouseDown={() => setAbierto(false)}
            title="Cancelar"
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-primary/30 hover:text-primary transition-colors cursor-pointer"
          >
            <X size={10} />
          </button>
        )}
      </div>

      <div
        className="absolute z-20 mt-1 left-0 right-0 max-h-48 overflow-y-auto rounded-md border shadow-lg"
        style={{
          background: "var(--bg-main)",
          borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
        }}
      >
        {filtradas.length === 0 ? (
          <p className="text-micro text-primary/25 italic text-center py-2">Sin resultados</p>
        ) : (
          filtradas.slice(0, 30).map((c, i) => (
            <button
              key={c.id}
              type="button"
              onMouseEnter={() => setActivo(i)}
              onMouseDown={() => elegir(c)}
              className={`w-full flex items-center gap-1.5 px-2 py-1 text-left text-micro font-bold transition-colors truncate ${
                i === activo ? "bg-primary/10 text-primary" : "text-primary/75 hover:bg-primary/6 hover:text-primary"
              }`}
            >
              {c.id === celulaId && <Check size={10} className="text-accent shrink-0" />}
              {c.nombre || "Sin nombre"}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Piezas chicas compartidas ──────────────────────────────────────────────

function PanelFlotanteBase({
  children,
  onCerrar,
}: {
  children: React.ReactNode;
  onCerrar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "color-mix(in srgb, black 45%, transparent)" }}
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-md flex flex-col rounded-xl border shadow-2xl overflow-hidden"
        style={{
          background: "var(--bg-main)",
          borderColor: "color-mix(in srgb, var(--primary) 14%, transparent)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ErrorBanner({ texto }: { texto: string }) {
  return (
    <p className="text-micro text-red-500/80 bg-red-500/5 border border-red-500/15 rounded-md px-2 py-1.5">
      {texto}
    </p>
  );
}

function NotasField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">Notas</p>
      <textarea
        className="w-full min-h-[4rem] bg-transparent px-0 py-1 text-primary/70 resize-none outline-none placeholder:text-primary/25"
        placeholder="Notas…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function NotaReutilizable() {
  return (
    <p className="text-micro text-primary/25 italic">
      Reutilizable: se puede vincular a varios Órganos desde el botón &quot;Usar existente&quot;
      en la fórmula de cada Órgano.
    </p>
  );
}
