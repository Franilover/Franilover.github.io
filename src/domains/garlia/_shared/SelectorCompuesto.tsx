"use client";

/**
 * SelectorCompuesto.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Reemplaza a SelectorComposicionElementos para entidades (Flora, Mineral)
 * cuya composición ahora es una referencia a un Compuesto del catálogo
 * (compuesto_id) en vez de una lista de elementos sueltos armada a mano.
 *
 * En vez de mostrar TODOS los elementos disponibles a la vez (patrón
 * antiguo de SelectorComposicionElementos, que sigue usando Criatura), acá
 * se busca/filtra por texto sobre el catálogo de Compuestos ya existentes
 * — mismo espíritu que el selector de elementos dentro de CompuestosPage,
 * pero eligiendo un Compuesto entero en vez de un Elemento individual.
 *
 * Si no existe el Compuesto que se necesita, permite crear uno nuevo desde
 * acá mismo (con un nombre inicial) y lo deja seleccionado — abrir su
 * edición completa (elegir sus Elementos componentes) se hace después desde
 * la sección Compuestos, o vía el botón "Editar" que abre el mismo panel
 * flotante que usa esa sección.
 */

import { Beaker, Check, Plus, Search, X } from "lucide-react";
import React, { useMemo, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import type { Compuesto } from "@/domains/garlia/elementos/types";

interface Props {
  compuestos: Compuesto[];
  loadingCompuestos?: boolean;
  compuestoId: string | null;
  onChange: (compuestoId: string | null) => void;
  /** Se llama tras crear un compuesto nuevo, para que el caller lo agregue
   *  a su lista local (mismo patrón que setCompuestos en ElementosPage). */
  onCompuestoCreado?: (compuesto: Compuesto) => void;
  /** Abre el editor completo del compuesto elegido (panel flotante), para
   *  poder definir/ajustar sus elementos componentes sin salir de acá. */
  onEditarCompuesto?: (compuestoId: string) => void;
}

export function SelectorCompuesto({
  compuestos,
  loadingCompuestos,
  compuestoId,
  onChange,
  onCompuestoCreado,
  onEditarCompuesto,
}: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);

  const elegido = useMemo(
    () => compuestos.find((c) => c.id === compuestoId) ?? null,
    [compuestos, compuestoId],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return compuestos;
    return compuestos.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) || (c.simbolo ?? "").toLowerCase().includes(q),
    );
  }, [compuestos, busqueda]);

  function elegirCompuesto(c: Compuesto) {
    onChange(c.id);
    setAbierto(false);
    setBusqueda("");
  }

  function onKeyDownBusqueda(e: React.KeyboardEvent<HTMLInputElement>) {
    if (filtrados.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => (i + 1) % filtrados.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => (i - 1 + filtrados.length) % filtrados.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = filtrados[activo];
      if (c) elegirCompuesto(c);
    }
  }

  async function crearCompuesto(nombreBase: string) {
    setCreando(true);
    try {
      const { data, error } = await supabase
        .from("compuestos")
        .insert([{ nombre: nombreBase || "Nuevo compuesto", simbolo: "??", componentes: [] }])
        .select()
        .single();
      if (error) throw error;
      const nuevo = data as Compuesto;
      onCompuestoCreado?.(nuevo);
      onChange(nuevo.id);
      setAbierto(false);
      setBusqueda("");
      onEditarCompuesto?.(nuevo.id);
    } catch (e) {
      console.error("[SelectorCompuesto] error creando compuesto:", e);
    } finally {
      setCreando(false);
    }
  }

  // ── Ya hay un compuesto elegido: mostrar chip compacto en vez del buscador ──
  if (elegido && !abierto) {
    return (
      <div className="flex items-center gap-1.5 bg-primary/5 rounded-md pl-2.5 pr-1.5 py-1.5 border border-primary/10">
        <Beaker size={12} className="text-accent/60 shrink-0" />
        <span className="flex-1 min-w-0 truncate text-micro font-bold text-primary/80">
          {elegido.simbolo ? `${elegido.simbolo} · ` : ""}
          {elegido.nombre}
        </span>
        <div className="shrink-0 flex items-center gap-1">
          {onEditarCompuesto && (
            <button
              type="button"
              onClick={() => onEditarCompuesto(elegido.id)}
              title="Editar este compuesto (elementos, notas…)"
              className="px-1.5 py-1 rounded border border-primary/15 text-micro font-black uppercase tracking-wide text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
            >
              Editar
            </button>
          )}
          <button
            type="button"
            onClick={() => setAbierto(true)}
            title="Cambiar de compuesto"
            className="px-1.5 py-1 rounded border border-primary/15 text-micro font-black uppercase tracking-wide text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
          >
            Cambiar
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            title="Quitar composición"
            className="w-6 h-6 flex items-center justify-center rounded border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 transition-all cursor-pointer"
          >
            <X size={11} />
          </button>
        </div>
      </div>
    );
  }

  // ── Buscar / elegir / crear ──────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <div className="flex-1 min-w-0 flex items-center gap-1.5 bg-primary/5 rounded-md px-2 py-1.5 border border-primary/10 focus-within:border-primary/30">
          <Search size={11} className="text-primary/30 shrink-0" />
          <input
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setActivo(0);
            }}
            onKeyDown={onKeyDownBusqueda}
            placeholder="Buscar compuesto por nombre o símbolo…"
            className="flex-1 min-w-0 bg-transparent text-micro font-bold text-primary outline-none placeholder:text-primary/30 placeholder:font-normal"
          />
        </div>
        {elegido && (
          <button
            type="button"
            onClick={() => {
              setAbierto(false);
              setBusqueda("");
            }}
            title="Cancelar"
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 transition-all cursor-pointer"
          >
            <X size={12} />
          </button>
        )}
      </div>

      <div className="max-h-48 overflow-y-auto rounded-md border border-primary/10 flex flex-col divide-y divide-primary/8">
        {loadingCompuestos ? (
          <div className="py-3 text-micro text-primary/30 text-center">Cargando…</div>
        ) : filtrados.length === 0 && !busqueda.trim() ? (
          <div className="py-3 text-micro text-primary/25 text-center">
            Todavía no hay compuestos en el catálogo.
          </div>
        ) : filtrados.length === 0 ? (
          <div className="py-3 text-micro text-primary/25 text-center">
            Ningún compuesto coincide con "{busqueda}".
          </div>
        ) : (
          filtrados.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onMouseEnter={() => setActivo(i)}
              onClick={() => elegirCompuesto(c)}
              className={`flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
                i === activo ? "bg-primary/8" : "hover:bg-primary/5"
              }`}
            >
              {c.id === compuestoId ? (
                <Check size={12} className="text-accent shrink-0" />
              ) : (
                <Beaker size={11} className="text-primary/25 shrink-0" />
              )}
              <span className="text-micro font-black text-primary/70 shrink-0">
                {c.simbolo || "??"}
              </span>
              <span className="flex-1 min-w-0 truncate text-micro text-primary/60">
                {c.nombre}
              </span>
              <span className="shrink-0 text-micro text-primary/25">
                {(c.componentes?.length ?? 0)} elem.
              </span>
            </button>
          ))
        )}
      </div>

      <button
        type="button"
        disabled={creando}
        onClick={() => crearCompuesto(busqueda.trim())}
        title="Crear un compuesto nuevo con este nombre"
        className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-micro font-black uppercase tracking-wide border border-dashed border-primary/20 text-primary/50 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus size={11} />
        {creando
          ? "Creando…"
          : busqueda.trim()
            ? `Crear compuesto "${busqueda.trim()}"`
            : "Crear compuesto nuevo"}
      </button>
    </div>
  );
}
