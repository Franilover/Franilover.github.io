"use client";

/**
 * CatalogoVetasFisica.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Espejo inerte de CatalogoTejidosBiologia.tsx: biblioteca global de Granos
 * y Vetas — dos grids navegables, cada una con su editor propio
 * (crear/editar/borrar), sin necesidad de pasar por ninguna Formación.
 * Nace del mismo pedido que dio origen al catálogo de Biología, ahora
 * aplicado a Física: mostrar arriba de Formaciones la jerarquía
 * Compuesto→Grano→Veta como catálogo de solo composición — separado de
 * "Usar existente" (que vive dentro de la fórmula de una Formación
 * puntual, ver useFormacionVetas.ts).
 *
 * Ojo con la cadena real (ver elementos/types.ts): Grano → compuesto_id
 * (apunta directo a un Compuesto), pero Veta → grano_id (apunta a un
 * Grano, NO a un Compuesto directo). Por eso son dos paneles distintos,
 * no uno genérico: el de Grano usa SelectorCompuesto, el de Veta usa
 * SelectorGrano (nuevo, definido acá mismo).
 *
 * Mismo lenguaje visual que GridCatalogoGrupo (grid de 3 columnas, click
 * abre panel flotante centrado).
 */

import { Gem, Layers, Plus, Trash2, X, Search, Check } from "lucide-react";
import React, { useMemo, useState } from "react";

import { useConfirm } from "@/ui/ConfirmModal";
import { SelectorCompuesto } from "@/domains/garlia/_shared/SelectorCompuesto";
import { useGranos } from "@/domains/garlia/elementos/useGranos";
import { useVetas } from "@/domains/garlia/elementos/useVetas";
import type { Grano, Compuesto, Veta } from "@/domains/garlia/elementos/types";

interface Props {
  compuestos: Compuesto[];
  loadingCompuestos?: boolean;
  onCompuestoCreado?: (c: Compuesto) => void;
  onAbrirCompuesto?: (compuestoId: string) => void;
}

export function CatalogoVetasFisica({
  compuestos,
  loadingCompuestos,
  onCompuestoCreado,
  onAbrirCompuesto,
}: Props) {
  const granos = useGranos();
  const vetas = useVetas();

  const [granoSeleccionadoId, setGranoSeleccionadoId] = useState<string | null>(null);
  const [vetaSeleccionadaId, setVetaSeleccionadaId] = useState<string | null>(null);

  const granoActivo = granos.items.find((g) => g.id === granoSeleccionadoId) ?? null;
  const vetaActiva = vetas.items.find((v) => v.id === vetaSeleccionadaId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Granos ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/50">
            Granos · {granos.items.length}
          </p>
          <button
            type="button"
            onClick={() => void granos.crear()}
            disabled={granos.creando}
            title="Crear grano nuevo"
            className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Plus size={10} /> Nuevo
          </button>
        </div>

        <GridSimple
          items={granos.items}
          loading={granos.loading}
          icono={<Gem size={12} className="text-primary/40 shrink-0" />}
          seleccionadoId={granoSeleccionadoId}
          onSeleccionar={setGranoSeleccionadoId}
          labelVacio="granos"
        />

        {granoActivo && (
          <PanelEditorGrano
            item={granoActivo}
            compuestos={compuestos}
            loadingCompuestos={loadingCompuestos}
            onCerrar={() => setGranoSeleccionadoId(null)}
            onActualizar={granos.actualizar}
            onEliminar={async (id) => {
              const res = await granos.eliminar(id);
              if (res.ok) setGranoSeleccionadoId(null);
              return res;
            }}
            onCompuestoCreado={onCompuestoCreado}
            onAbrirCompuesto={onAbrirCompuesto}
          />
        )}
      </div>

      {/* ── Vetas ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 border-t border-primary/10 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/50">
            Vetas · {vetas.items.length}
          </p>
          <button
            type="button"
            onClick={() => void vetas.crear()}
            disabled={vetas.creando}
            title="Crear veta nueva"
            className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Plus size={10} /> Nueva
          </button>
        </div>

        <GridSimple
          items={vetas.items}
          loading={vetas.loading}
          icono={<Layers size={12} className="text-primary/40 shrink-0" />}
          seleccionadoId={vetaSeleccionadaId}
          onSeleccionar={setVetaSeleccionadaId}
          labelVacio="vetas"
        />

        {vetaActiva && (
          <PanelEditorVeta
            item={vetaActiva}
            granos={granos.items}
            loadingGranos={granos.loading}
            onCerrar={() => setVetaSeleccionadaId(null)}
            onActualizar={vetas.actualizar}
            onEliminar={async (id) => {
              const res = await vetas.eliminar(id);
              if (res.ok) setVetaSeleccionadaId(null);
              return res;
            }}
            onAbrirGrano={(granoId) => {
              setVetaSeleccionadaId(null);
              setGranoSeleccionadoId(granoId);
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
  // Solo mostramos "Cargando…" si todavía no hay NADA que pintar — con
  // items ya presentes (llegados de Dexie o de un fetch anterior), un
  // `loading=true` de revalidación en segundo plano no debe tapar la
  // grid: eso es lo que causaba el parpadeo/"Cargando…" en cada cambio
  // de tab o remount, aunque los datos ya estuvieran en caché local
  // (useSupabaseData vuelve a poner loading=true en cada montaje porque
  // leer Dexie es async, así que el primer render nunca lo sabe todavía).
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

// ─── Panel Grano: nombre, función, notas, Compuesto (compuesto_id) ─────────

function PanelEditorGrano({
  item,
  compuestos,
  loadingCompuestos,
  onCerrar,
  onActualizar,
  onEliminar,
  onCompuestoCreado,
  onAbrirCompuesto,
}: {
  item: Grano;
  compuestos: Compuesto[];
  loadingCompuestos?: boolean;
  onCerrar: () => void;
  onActualizar: (id: string, cambios: Partial<Grano>) => void;
  onEliminar: (id: string) => Promise<{ ok: boolean; error: unknown }>;
  onCompuestoCreado?: (c: Compuesto) => void;
  onAbrirCompuesto?: (compuestoId: string) => void;
}) {
  const { confirm, ConfirmModal } = useConfirm();
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  async function handleEliminar() {
    const ok = await confirm({
      title: "Eliminar grano",
      message: `¿Eliminar "${item.nombre}"? Esta acción no se puede deshacer. Si alguna Veta lo usa, no se va a poder borrar.`,
    });
    if (!ok) return;
    setEliminando(true);
    setErrorEliminar(null);
    const res = await onEliminar(item.id);
    setEliminando(false);
    if (!res.ok) {
      setErrorEliminar(
        "No se pudo eliminar — probablemente alguna Veta todavía lo usa. Cambiale el compuesto desde ahí o quitalo primero.",
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

// ─── Panel Veta: nombre, función, notas, Grano (grano_id) ──────────────────
// Exportado: reutilizado directo desde SelectorFormulaTejidos/GruposCompuestosPage
// (editor de la fórmula de una Formación) para abrir el mismo editor completo
// al clickear el nombre de una fila — un solo editor de Veta en toda la app.

export function PanelEditorVeta({
  item,
  granos,
  loadingGranos,
  onCerrar,
  onActualizar,
  onEliminar,
  onAbrirGrano,
}: {
  item: Veta;
  granos: Grano[];
  loadingGranos?: boolean;
  onCerrar: () => void;
  onActualizar: (id: string, cambios: Partial<Veta>) => void;
  onEliminar: (id: string) => Promise<{ ok: boolean; error: unknown }>;
  /** Cierra este panel y abre el del Grano elegido — navegación cruzada. */
  onAbrirGrano?: (granoId: string) => void;
}) {
  const { confirm, ConfirmModal } = useConfirm();
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  async function handleEliminar() {
    const ok = await confirm({
      title: "Eliminar veta",
      message: `¿Eliminar "${item.nombre}"? Esta acción no se puede deshacer. Si alguna Formación la usa, no se va a poder borrar.`,
    });
    if (!ok) return;
    setEliminando(true);
    setErrorEliminar(null);
    const res = await onEliminar(item.id);
    setEliminando(false);
    if (!res.ok) {
      setErrorEliminar(
        "No se pudo eliminar — probablemente alguna Formación todavía la usa. Quitala de esa fórmula primero.",
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
            Grano
          </p>
          <SelectorGrano
            granos={granos}
            loadingGranos={loadingGranos}
            granoId={item.grano_id}
            onChange={(granoId) => onActualizar(item.id, { grano_id: granoId })}
            onAbrirGrano={onAbrirGrano}
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

// ─── SelectorGrano: mismo lenguaje visual que SelectorCompuesto, pero
// eligiendo un Grano del catálogo (para Veta.grano_id) — no crea Granos
// nuevos desde acá (para eso está el botón "Nuevo" de la grid).
// Exportado junto con PanelEditorVeta — ver nota arriba. ───────────────────

export function SelectorGrano({
  granos,
  loadingGranos,
  granoId,
  onChange,
  onAbrirGrano,
}: {
  granos: Grano[];
  loadingGranos?: boolean;
  granoId: string | null;
  onChange: (granoId: string | null) => void;
  onAbrirGrano?: (granoId: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);

  const elegido = useMemo(() => granos.find((g) => g.id === granoId) ?? null, [granos, granoId]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return granos;
    return granos.filter((g) => g.nombre.toLowerCase().includes(q));
  }, [granos, busqueda]);

  function elegir(g: Grano) {
    onChange(g.id);
    setAbierto(false);
    setBusqueda("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (filtrados.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => (i + 1) % filtrados.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => (i - 1 + filtrados.length) % filtrados.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const g = filtrados[activo];
      if (g) elegir(g);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  if (elegido && !abierto) {
    return (
      <div className="flex items-center gap-1.5 bg-primary/5 rounded-md pl-2.5 pr-1.5 py-1.5 border border-primary/10">
        <Gem size={12} className="text-accent/60 shrink-0" />
        <button
          type="button"
          onClick={() => onAbrirGrano?.(elegido.id)}
          disabled={!onAbrirGrano}
          className="flex-1 min-w-0 truncate text-left text-micro font-bold text-primary/80 disabled:cursor-default hover:enabled:text-accent hover:enabled:underline cursor-pointer"
        >
          {elegido.nombre || "Sin nombre"}
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
          placeholder={loadingGranos ? "Cargando…" : "Buscar grano…"}
          className="flex-1 min-w-0 bg-transparent px-0 py-0.5 text-micro font-bold text-primary outline-none placeholder:text-primary/30 placeholder:font-normal"
        />
        {elegido && (
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
        {filtrados.length === 0 ? (
          <p className="text-micro text-primary/25 italic text-center py-2">Sin resultados</p>
        ) : (
          filtrados.slice(0, 30).map((g, i) => (
            <button
              key={g.id}
              type="button"
              onMouseEnter={() => setActivo(i)}
              onMouseDown={() => elegir(g)}
              className={`w-full flex items-center gap-1.5 px-2 py-1 text-left text-micro font-bold transition-colors truncate ${
                i === activo ? "bg-primary/10 text-primary" : "text-primary/75 hover:bg-primary/6 hover:text-primary"
              }`}
            >
              {g.id === granoId && <Check size={10} className="text-accent shrink-0" />}
              {g.nombre || "Sin nombre"}
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
      Reutilizable: se puede vincular a varias Formaciones desde el botón &quot;Usar existente&quot;
      en la fórmula de cada Formación.
    </p>
  );
}
