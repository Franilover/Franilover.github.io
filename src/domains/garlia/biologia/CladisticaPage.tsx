"use client";

/**
 * CladisticaPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Cladograma de Biología: árbol filogenético SIN rangos fijos (nada de
 * Reino/Filo/Clase/Orden…), fiel al criterio de la cladística moderna —
 * cada nodo es un grupo monofilético definido por su sinapomorfía
 * (carácter derivado compartido por todos sus descendientes), no por un
 * nivel jerárquico arbitrario.
 *
 * Visualización: diagrama de ramas real (estilo árbol filogenético
 * rectangular — troncos horizontales que se bifurcan verticalmente en cada
 * nodo interno, hojas alineadas a la derecha), no una lista anidada tipo
 * carpeta. Layout calculado en SVG a partir del árbol.
 *
 * Panel de detalle del clado seleccionado a la derecha (nombre,
 * sinapomorfía, descripción, criaturas asignadas) — mismo patrón
 * "diagrama + editor lateral" que el resto de Física/Runas.
 */

import { Dna, Plus, Trash2 } from "lucide-react";
import React, { useMemo, useState } from "react";

import { RichEditor } from "@/editor/lexical";

import { SelectorCriaturasMulti } from "./SelectorCriaturasMulti";
import { useClados } from "./useBiologia";
import type { Clado } from "./types";

interface Props {
  onSelectCriatura?: (id: string) => void;
}

// ─── Layout del cladograma ──────────────────────────────────────────────────
// Árbol rectangular clásico: cada hoja ocupa una fila (ROW_H), cada nivel de
// profundidad ocupa una columna (COL_W). La posición Y de un nodo interno es
// el promedio de sus hijos — así las bifurcaciones quedan centradas, como en
// cualquier cladograma real.

const ROW_H = 34;
const COL_W = 150;
const PAD_X = 16;
const PAD_Y = 20;
const LEAF_LABEL_W = 210;

interface NodoLayout {
  clado: Clado;
  x: number;
  y: number;
  hijos: NodoLayout[];
}

function construirLayout(clados: Clado[]): { nodos: NodoLayout[]; raices: NodoLayout[]; alturaTotal: number } {
  const porPadre = new Map<string | null, Clado[]>();
  for (const c of clados) {
    const arr = porPadre.get(c.padre_id) ?? [];
    arr.push(c);
    porPadre.set(c.padre_id, arr);
  }

  const nodos: NodoLayout[] = [];
  let cursorFila = 0;

  function build(clado: Clado, profundidad: number): NodoLayout {
    const hijosData = porPadre.get(clado.id) ?? [];
    const nodo: NodoLayout = { clado, x: PAD_X + profundidad * COL_W, y: 0, hijos: [] };
    nodos.push(nodo);

    if (hijosData.length === 0) {
      nodo.y = PAD_Y + cursorFila * ROW_H;
      cursorFila += 1;
    } else {
      nodo.hijos = hijosData.map((h) => build(h, profundidad + 1));
      const ys = nodo.hijos.map((h) => h.y);
      nodo.y = (Math.min(...ys) + Math.max(...ys)) / 2;
    }
    return nodo;
  }

  const raicesData = porPadre.get(null) ?? [];
  const raices = raicesData.map((r) => build(r, 0));
  const alturaTotal = PAD_Y * 2 + Math.max(cursorFila, 1) * ROW_H;

  return { nodos, raices, alturaTotal };
}

function anchoMaximo(nodos: NodoLayout[]): number {
  return nodos.reduce((max, n) => Math.max(max, n.x), 0) + COL_W + LEAF_LABEL_W;
}

// ─── Diagrama SVG ────────────────────────────────────────────────────────────

function DiagramaCladograma({
  clados,
  seleccionadoId,
  onSelect,
}: {
  clados: Clado[];
  seleccionadoId: string | null;
  onSelect: (id: string) => void;
}) {
  const { nodos, alturaTotal } = useMemo(() => construirLayout(clados), [clados]);
  const ancho = useMemo(() => anchoMaximo(nodos), [nodos]);

  if (clados.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-2xl border border-primary/10 bg-white-custom/60 p-2">
      <svg width={ancho} height={alturaTotal} className="block">
        {/* Ramas: para cada nodo con hijos, un tronco horizontal hasta la
            columna del hijo + una barra vertical que conecta las Y de todos
            los hijos + un horizontal corto desde la barra hasta cada hijo. */}
        {nodos.map((n) => {
          if (n.hijos.length === 0) return null;
          const xHijos = n.x + COL_W;
          const ys = n.hijos.map((h) => h.y);
          const yMin = Math.min(...ys);
          const yMax = Math.max(...ys);
          return (
            <g key={`ramas-${n.clado.id}`}>
              {/* tronco desde el nodo hasta la columna de bifurcación */}
              <line
                x1={n.x}
                y1={n.y}
                x2={xHijos}
                y2={n.y}
                stroke="currentColor"
                strokeWidth={1.5}
                className="text-primary/25"
              />
              {/* barra vertical de bifurcación */}
              <line
                x1={xHijos}
                y1={yMin}
                x2={xHijos}
                y2={yMax}
                stroke="currentColor"
                strokeWidth={1.5}
                className="text-primary/25"
              />
              {/* horizontales cortas hacia cada hijo (si el hijo no está ya en xHijos) */}
              {n.hijos.map((h) => (
                <line
                  key={`h-${h.clado.id}`}
                  x1={xHijos}
                  y1={h.y}
                  x2={h.x}
                  y2={h.y}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="text-primary/25"
                />
              ))}
            </g>
          );
        })}

        {/* Nodos + etiquetas */}
        {nodos.map((n) => {
          const activo = n.clado.id === seleccionadoId;
          const esHoja = n.hijos.length === 0;
          return (
            <g
              key={n.clado.id}
              transform={`translate(${n.x}, ${n.y})`}
              onClick={() => onSelect(n.clado.id)}
              className="cursor-pointer"
            >
              <circle
                r={esHoja ? 3.5 : 4.5}
                className={activo ? "fill-accent" : esHoja ? "fill-primary/40" : "fill-primary/60"}
              />
              <text
                x={8}
                y={4}
                className={`text-[11px] font-bold select-none ${
                  activo ? "fill-accent" : "fill-primary/75"
                }`}
              >
                {n.clado.nombre || "Sin nombre"}
              </text>
              {n.clado.criatura_ids?.length > 0 && (
                <text
                  x={8 + (n.clado.nombre?.length ?? 0) * 6.2 + 6}
                  y={4}
                  className="text-[9px] font-bold fill-accent/60 select-none"
                >
                  {n.clado.criatura_ids.length}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Panel de detalle del clado seleccionado ────────────────────────────────

function PanelClado({
  clado,
  onSave,
  onDelete,
  onCrearHijo,
  onSelectCriatura,
}: {
  clado: Clado;
  onSave: (updates: Partial<Clado>) => void;
  onDelete: () => void;
  onCrearHijo: () => void;
  onSelectCriatura?: (id: string) => void;
}) {
  const [nombre, setNombre] = useState(clado.nombre);
  const [sinapomorfia, setSinapomorfia] = useState(clado.sinapomorfia ?? "");
  const [descripcion, setDescripcion] = useState(clado.descripcion ?? "");

  React.useEffect(() => {
    setNombre(clado.nombre);
    setSinapomorfia(clado.sinapomorfia ?? "");
    setDescripcion(clado.descripcion ?? "");
  }, [clado.id]);

  const guardar = () => {
    onSave({
      nombre: nombre.trim() || clado.nombre,
      sinapomorfia: sinapomorfia.trim(),
      descripcion,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <Dna size={12} className="text-accent/60 shrink-0" />
          <input
            className="flex-1 min-w-0 bg-transparent text-sm font-black uppercase italic tracking-tight text-primary truncate outline-none placeholder:text-primary/25 px-1 py-0.5 rounded hover:bg-primary/5 focus:bg-primary/8"
            placeholder="Nombre del clado…"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={guardar}
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onDelete}
            title="Eliminar clado"
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

      <div className="mb-4">
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1.5">
          Sinapomorfía (carácter derivado)
        </span>
        <p className="text-micro text-primary/35 mb-1.5">
          El rasgo compartido por todos los descendientes de este clado — lo
          que lo define como grupo monofilético. Ej. &quot;Presencia de
          vejiga de veneno dorsal&quot;.
        </p>
        <input
          className="w-full bg-primary/[0.02] border border-primary/10 rounded-lg px-2.5 py-1.5 text-xs font-bold text-primary/80 outline-none placeholder:text-primary/30 placeholder:font-normal focus:border-primary/25"
          placeholder="¿Qué carácter derivado comparten todos los descendientes?"
          value={sinapomorfia}
          onChange={(e) => setSinapomorfia(e.target.value)}
          onBlur={guardar}
        />
      </div>

      <div className="mb-4">
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1.5">
          Descripción
        </span>
        <RichEditor
          minHeight="6.25rem"
          placeholder="Notas evolutivas, contexto del linaje, cómo se diferencia de clados hermanos…"
          value={descripcion}
          onChange={setDescripcion}
        />
      </div>

      <button
        type="button"
        onClick={onCrearHijo}
        className="flex items-center gap-1.5 mb-4 px-2.5 py-1.5 rounded-lg border border-dashed text-micro font-black uppercase tracking-widest transition-all"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
          color: "color-mix(in srgb, var(--primary) 35%, transparent)",
        }}
      >
        <Plus size={10} /> Añadir clado hijo
      </button>

      <SelectorCriaturasMulti
        ids={clado.criatura_ids ?? []}
        onChange={(ids) => onSave({ criatura_ids: ids })}
        onSelectCriatura={onSelectCriatura}
        label="Criaturas de este clado"
      />
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export function CladisticaPage({ onSelectCriatura }: Props) {
  const { clados, loading, creating, crear, actualizar, eliminar } = useClados();
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  const seleccionado = clados.find((c) => c.id === seleccionadoId) ?? null;

  const crearRaiz = async () => {
    const nuevo = await crear("Nuevo clado", null);
    if (nuevo) setSeleccionadoId(nuevo.id);
  };

  const crearHijo = async (padreId: string) => {
    const nuevo = await crear("Nuevo clado", padreId);
    if (nuevo) setSeleccionadoId(nuevo.id);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
            Cladograma
          </span>
          <button
            type="button"
            disabled={creating}
            onClick={() => void crearRaiz()}
            className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors disabled:opacity-40"
          >
            <Plus size={10} /> Nuevo ancestro común
          </button>
        </div>

        {loading ? (
          <div className="w-full py-6 text-xs text-primary/30 text-center">Cargando…</div>
        ) : clados.length === 0 ? (
          <p className="text-xs text-primary/25 italic py-4 text-center">
            Sin clados todavía — creá el primer nodo (el ancestro común más
            lejano que quieras registrar).
          </p>
        ) : (
          <DiagramaCladograma
            clados={clados}
            seleccionadoId={seleccionadoId}
            onSelect={setSeleccionadoId}
          />
        )}
      </div>

      <div className="flex-1 min-w-0 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        {seleccionado ? (
          <PanelClado
            key={seleccionado.id}
            clado={seleccionado}
            onSave={(updates) => void actualizar(seleccionado.id, updates)}
            onDelete={() => {
              void eliminar(seleccionado.id);
              setSeleccionadoId(null);
            }}
            onCrearHijo={() => void crearHijo(seleccionado.id)}
            onSelectCriatura={onSelectCriatura}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-primary/15 p-6 text-center">
            <p className="text-xs text-primary/30">
              Seleccioná un clado del cladograma para ver o editar su
              detalle.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
