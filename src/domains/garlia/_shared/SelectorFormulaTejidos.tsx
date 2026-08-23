"use client";

/**
 * SelectorFormulaTejidos.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Editor visual de la composición de un Órgano/Formación — reemplaza al
 * viejo SelectorFormulaOrgano (que editaba un array plano `componentes`
 * directo en la fila). Hoy la composición vive en una cadena de 2 niveles
 * (Tejido→Célula para Órganos, Veta→Grano para Formaciones), así que este
 * componente es agnóstico al hook concreto: recibe `items` ya resueltos
 * (ver TejidoDeOrgano/VetaDeFormacion) y callbacks async
 * agregar/actualizar/proporcion/quitar — funciona igual con
 * useOrganoTejidos o useFormacionVetas.
 *
 * Mismo lenguaje visual que el viejo SelectorFormulaOrgano (buscador +
 * fila con nombre/proporción/menú), pero "cantidad" pasa a ser
 * "proporción" en texto libre (columna `proporcion` de organo_tejidos/
 * formacion_vetas) en vez de un entero — la Célula/Tejido no tienen
 * cantidad propia, son una fila de catálogo reutilizable.
 */

import { Plus, Trash2, Pencil, MoreVertical } from "lucide-react";
import React, { useMemo, useState } from "react";

import type { Compuesto } from "@/domains/garlia/elementos/types";

/** Shape mínimo de una fila de fórmula ya resuelta — cumplen TejidoDeOrgano y VetaDeFormacion.
 *  `catalogo_id` es el id de la Célula (Órgano) o Grano (Formación) — el
 *  nivel que realmente guarda `compuesto_id` — distinto de `vinculo_id`
 *  (la fila puente organo_tejidos/formacion_vetas). */
export interface FilaFormulaTejido {
  vinculo_id: string;
  catalogo_id: string | null;
  compuesto_id: string | null;
  proporcion: string | null;
}

export function SelectorFormulaTejidos({
  compuestos,
  items,
  onAgregar,
  onActualizarCompuesto,
  onActualizarProporcion,
  onQuitar,
  onAbrirCompuesto,
  ocultarBotonAgregar,
}: {
  compuestos: Compuesto[];
  items: FilaFormulaTejido[];
  onAgregar: (compuestoId: string) => void;
  onActualizarCompuesto: (celulaOGranoId: string, compuestoId: string) => void;
  onActualizarProporcion: (vinculoId: string, proporcion: string) => void;
  onQuitar: (vinculoId: string) => void;
  /** Abre el panel flotante del Compuesto elegido en una fila. */
  onAbrirCompuesto?: (compuestoId: string) => void;
  /** Oculta el botón "Agregar" interno — usar cuando el padre renderiza su propio botón. */
  ocultarBotonAgregar?: boolean;
}) {
  function agregar() {
    const elegidos = new Set(items.map((c) => c.compuesto_id));
    const primero = compuestos.find((c) => !elegidos.has(c.id)) ?? compuestos[0];
    if (!primero) return;
    onAgregar(primero.id);
  }

  return (
    <div className="flex flex-col">
      {items.length === 0 && (
        <p className="text-micro text-primary/25 italic mb-1.5">Nada definido todavía.</p>
      )}

      {items.length > 0 && (
        <div className="divide-y divide-primary/10 mb-1.5">
          {items.map((item) => (
            <FilaFormulaTejidoRow
              key={item.vinculo_id}
              item={item}
              compuestos={compuestos}
              onCambiarCompuesto={(compuestoId) => {
                if (item.catalogo_id) onActualizarCompuesto(item.catalogo_id, compuestoId);
              }}
              onCambiarProporcion={(proporcion) => onActualizarProporcion(item.vinculo_id, proporcion)}
              onQuitar={() => onQuitar(item.vinculo_id)}
              onAbrir={
                onAbrirCompuesto && item.compuesto_id
                  ? () => onAbrirCompuesto(item.compuesto_id as string)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {!ocultarBotonAgregar && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={agregar}
            disabled={compuestos.length === 0}
            className="flex items-center justify-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-dashed border-primary/20 text-primary/50 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={10} />
            Agregar
          </button>
        </div>
      )}

      {compuestos.length === 0 && (
        <p className="text-micro text-primary/25">
          Todavía no hay compuestos en la Tabla Química para asignar.
        </p>
      )}
    </div>
  );
}

function FilaFormulaTejidoRow({
  item,
  compuestos,
  onCambiarCompuesto,
  onCambiarProporcion,
  onQuitar,
  onAbrir,
}: {
  item: FilaFormulaTejido;
  compuestos: Compuesto[];
  onCambiarCompuesto: (compuestoId: string) => void;
  onCambiarProporcion: (proporcion: string) => void;
  onQuitar: () => void;
  onAbrir?: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [activo, setActivo] = useState(0);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [proporcionLocal, setProporcionLocal] = useState(item.proporcion ?? "");

  const elegido = useMemo(
    () => compuestos.find((c) => c.id === item.compuesto_id) ?? null,
    [compuestos, item.compuesto_id],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return compuestos;
    return compuestos.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [compuestos, busqueda]);

  const opciones = filtrados.slice(0, 30);

  function elegir(c: Compuesto) {
    onCambiarCompuesto(c.id);
    setBusqueda("");
    setBuscando(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!buscando || opciones.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => (i + 1) % opciones.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => (i - 1 + opciones.length) % opciones.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = opciones[activo];
      if (c) elegir(c);
    } else if (e.key === "Escape") {
      setBuscando(false);
    }
  }

  return (
    <div className="flex items-center gap-2 py-1">
      {/* Valor elegido (clickeable → abre panel) o buscador */}
      <div className="flex-1 min-w-0 relative">
        {elegido && !buscando ? (
          <div className="flex items-center gap-1 group/item">
            <button
              type="button"
              onClick={onAbrir}
              disabled={!onAbrir}
              title={onAbrir ? `Abrir ${elegido.nombre}` : undefined}
              className="min-w-0 flex-1 text-left px-0 py-1 text-micro font-bold text-primary truncate transition-colors disabled:cursor-default hover:enabled:text-accent hover:enabled:underline cursor-pointer"
            >
              {elegido.nombre}
            </button>
            <button
              type="button"
              onClick={() => {
                setBuscando(true);
                setBusqueda("");
                setActivo(0);
              }}
              title="Reemplazar"
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-primary/25 hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover/item:opacity-100 cursor-pointer"
            >
              <Pencil size={10} />
            </button>
          </div>
        ) : (
          <input
            autoFocus={buscando}
            value={busqueda}
            onBlur={() => {
              setTimeout(() => setBuscando(false), 120);
            }}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setActivo(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={elegido ? undefined : "Buscar compuesto…"}
            className="w-full bg-transparent px-0 py-1 text-micro font-bold text-primary outline-none placeholder:text-primary/30 placeholder:font-normal transition-colors"
          />
        )}
        {buscando && (
          <div
            className="absolute z-20 mt-1 left-0 right-0 max-h-40 overflow-y-auto rounded-md border shadow-lg"
            style={{
              background: "var(--bg-main)",
              borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            {opciones.length === 0 ? (
              <p className="text-micro text-primary/25 italic text-center py-2">Sin resultados</p>
            ) : (
              opciones.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseEnter={() => setActivo(i)}
                  onMouseDown={() => elegir(c)}
                  className={`w-full flex items-center gap-1.5 px-2 py-1 text-left text-micro font-bold transition-colors truncate ${
                    i === activo ? "bg-primary/10 text-primary" : "text-primary/75 hover:bg-primary/6 hover:text-primary"
                  }`}
                >
                  {c.nombre}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Proporción: texto libre (ej. "60%", "mayoritario", "trazas") */}
      <input
        value={proporcionLocal}
        onChange={(e) => setProporcionLocal(e.target.value)}
        onBlur={() => {
          if (proporcionLocal !== (item.proporcion ?? "")) onCambiarProporcion(proporcionLocal);
        }}
        placeholder="Proporción…"
        className="shrink-0 w-20 bg-transparent px-0 py-1 text-micro font-black text-primary/70 text-right outline-none placeholder:text-primary/25 placeholder:font-normal tabular-nums"
      />

      {/* Menú de 3 puntos: Quitar */}
      <div
        className="relative shrink-0"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setMenuAbierto(false);
        }}
      >
        <button
          type="button"
          onClick={() => setMenuAbierto((v) => !v)}
          title="Más opciones"
          className="w-5 h-5 flex items-center justify-center rounded text-primary/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
        >
          <MoreVertical size={12} />
        </button>

        {menuAbierto && (
          <div
            className="absolute z-20 mt-1 right-0 rounded-md border shadow-lg overflow-hidden"
            style={{
              background: "var(--bg-main)",
              borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMenuAbierto(false);
                onQuitar();
              }}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left text-micro font-bold whitespace-nowrap text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
            >
              <Trash2 size={11} /> Quitar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
