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
 * Panel de detalle del clado seleccionado como panel flotante centrado
 * (mismo patrón que Elementos/Personajes/Criaturas — modal grande con
 * backdrop blur), no una barra lateral fija.
 */

import { Dna, Plus, Trash2, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

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

const ROW_H = 38;
const COL_W = 170;
const PAD_X = 20;
const PAD_Y = 24;
const LEAF_LABEL_W = 220;

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

// Devuelve el set de ids descendientes (incluyendo el propio) de un clado,
// para impedir soltar un nodo dentro de su propia rama (eso crearía un
// ciclo padre_id → hijo → …→ el mismo padre).
function descendientesDe(id: string, clados: Clado[]): Set<string> {
  const set = new Set<string>([id]);
  let cambiado = true;
  while (cambiado) {
    cambiado = false;
    for (const c of clados) {
      if (c.padre_id && set.has(c.padre_id) && !set.has(c.id)) {
        set.add(c.id);
        cambiado = true;
      }
    }
  }
  return set;
}

function DiagramaCladograma({
  clados,
  seleccionadoId,
  seleccionMultiple,
  onSelect,
  onToggleMultiple,
  onMover,
  onMoverGrupo,
}: {
  clados: Clado[];
  seleccionadoId: string | null;
  seleccionMultiple: Set<string>;
  onSelect: (id: string) => void;
  onToggleMultiple: (id: string) => void;
  onMover: (cladoId: string, nuevoPadreId: string | null) => void;
  onMoverGrupo: (cladoIds: string[], nuevoPadreId: string | null) => void;
}) {
  const { nodos, alturaTotal } = useMemo(() => construirLayout(clados), [clados]);
  const ancho = useMemo(() => anchoMaximo(nodos), [nodos]);

  const svgRef = React.useRef<SVGSVGElement>(null);

  // Arrastre manual con mouse events (más confiable que drag&drop HTML5
  // dentro de SVG, que varios navegadores manejan mal sobre <g>).
  // arrastrandoIds: uno o varios clados (selección múltiple con Shift+click
  // izquierdo, luego arrastrados juntos con click derecho).
  const [arrastrandoIds, setArrastrandoIds] = useState<string[] | null>(null);
  const [huboMovimiento, setHuboMovimiento] = useState(false);
  const [posMouse, setPosMouse] = useState<{ x: number; y: number } | null>(null);
  const [hoverDestinoId, setHoverDestinoId] = useState<string | null>(null);
  const [hoverRaiz, setHoverRaiz] = useState(false);

  // Unión de descendientes de TODOS los nodos que se están arrastrando —
  // ninguno de ellos puede recibirse a sí mismo ni a un hermano de grupo
  // como nuevo padre (evita ciclos).
  const bloqueados = useMemo(() => {
    if (!arrastrandoIds) return null;
    const set = new Set<string>();
    for (const id of arrastrandoIds) {
      for (const d of descendientesDe(id, clados)) set.add(d);
    }
    return set;
  }, [arrastrandoIds, clados]);

  if (clados.length === 0) return null;

  const puntoSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const nodoEnPunto = (x: number, y: number) =>
    nodos.find((n) => Math.hypot(n.x - x, n.y - y) < 16);

  const confirmarMoverGrupo = (cladoIds: string[], destinoId: string | null) => {
    const desc = new Set<string>();
    for (const id of cladoIds) for (const d of descendientesDe(id, clados)) desc.add(d);
    if (destinoId !== null && desc.has(destinoId)) return; // ciclo
    const idsAMover = cladoIds.filter((id) => {
      const origenActual = clados.find((c) => c.id === id)?.padre_id ?? null;
      return origenActual !== destinoId && id !== destinoId;
    });
    if (idsAMover.length === 0) return;
    if (idsAMover.length === 1) onMover(idsAMover[0], destinoId);
    else onMoverGrupo(idsAMover, destinoId);
  };

  const handleMouseDown = (e: React.MouseEvent, cladoId: string) => {
    if (e.button !== 2) return; // solo click derecho arranca el arrastre
    e.preventDefault();
    e.stopPropagation();
    // Si el nodo sobre el que se apretó click derecho ya forma parte de la
    // selección múltiple, arrastramos todo el grupo; si no, solo ese nodo.
    const grupo = seleccionMultiple.has(cladoId) && seleccionMultiple.size > 0
      ? Array.from(seleccionMultiple)
      : [cladoId];
    setArrastrandoIds(grupo);
    setHuboMovimiento(false);
    setPosMouse(puntoSvg(e.clientX, e.clientY));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!arrastrandoIds) return;
    setHuboMovimiento(true);
    const p = puntoSvg(e.clientX, e.clientY);
    setPosMouse(p);
    const destino = nodoEnPunto(p.x, p.y);
    const esBloqueado = destino && bloqueados?.has(destino.clado.id);
    setHoverDestinoId(destino && !esBloqueado ? destino.clado.id : null);
    setHoverRaiz(!destino && p.x < PAD_X + 40);
  };

  const finalizarArrastre = () => {
    if (arrastrandoIds && huboMovimiento) {
      if (hoverDestinoId) confirmarMoverGrupo(arrastrandoIds, hoverDestinoId);
      else if (hoverRaiz) confirmarMoverGrupo(arrastrandoIds, null);
    }
    setArrastrandoIds(null);
    setHuboMovimiento(false);
    setPosMouse(null);
    setHoverDestinoId(null);
    setHoverRaiz(false);
  };

  const nodosArrastrados = arrastrandoIds
    ? nodos.filter((n) => arrastrandoIds.includes(n.clado.id))
    : [];

  return (
    <div className="overflow-auto rounded-2xl border border-primary/10 bg-white-custom/60 p-3 relative">
      {arrastrandoIds && huboMovimiento && (
        <p className="text-micro font-black uppercase tracking-widest text-accent/70 mb-2 px-1">
          Soltá el click derecho sobre otro clado para reasignar
          {arrastrandoIds.length > 1 ? ` los ${arrastrandoIds.length} seleccionados` : "lo"} como su hijo — o
          a la izquierda para volverlo{arrastrandoIds.length > 1 ? "s" : ""} ancestro común
        </p>
      )}
      {!arrastrandoIds && seleccionMultiple.size > 0 && (
        <p className="text-micro font-black uppercase tracking-widest text-accent/60 mb-2 px-1">
          {seleccionMultiple.size} clados seleccionados — Shift+click para sumar o quitar, click derecho y
          arrastrá uno de ellos para moverlos juntos
        </p>
      )}
      <svg
        ref={svgRef}
        width={ancho}
        height={alturaTotal}
        className="block select-none"
        style={{ minWidth: "100%", cursor: arrastrandoIds ? "grabbing" : "default" }}
        onMouseMove={handleMouseMove}
        onMouseUp={finalizarArrastre}
        onMouseLeave={finalizarArrastre}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Ramas */}
        {nodos.map((n) => {
          if (n.hijos.length === 0) return null;
          const xHijos = n.x + COL_W;
          const ys = n.hijos.map((h) => h.y);
          const yMin = Math.min(...ys);
          const yMax = Math.max(...ys);
          return (
            <g key={`ramas-${n.clado.id}`}>
              <line x1={n.x} y1={n.y} x2={xHijos} y2={n.y} stroke="currentColor" strokeWidth={1.5} className="text-primary/25" />
              <line x1={xHijos} y1={yMin} x2={xHijos} y2={yMax} stroke="currentColor" strokeWidth={1.5} className="text-primary/25" />
              {n.hijos.map((h) => (
                <line key={`h-${h.clado.id}`} x1={xHijos} y1={h.y} x2={h.x} y2={h.y} stroke="currentColor" strokeWidth={1.5} className="text-primary/25" />
              ))}
            </g>
          );
        })}

        {/* Franja de "soltar como raíz" a la izquierda, visible al arrastrar */}
        {arrastrandoIds && huboMovimiento && arrastrandoIds.some((id) => clados.find((c) => c.id === id)?.padre_id !== null) && (
          <rect x={0} y={0} width={PAD_X + 40} height={alturaTotal} className={hoverRaiz ? "fill-accent/15" : "fill-primary/5"} />
        )}

        {/* Nodos + etiquetas */}
        {nodos.map((n) => {
          const activo = n.clado.id === seleccionadoId;
          const enSeleccionMultiple = seleccionMultiple.has(n.clado.id);
          const esHoja = n.hijos.length === 0;
          const siendoArrastrado = arrastrandoIds?.includes(n.clado.id) ?? false;
          const esDestinoInvalido = arrastrandoIds !== null && bloqueados?.has(n.clado.id);
          const esHoverDestino = hoverDestinoId === n.clado.id && !esDestinoInvalido;

          return (
            <g
              key={n.clado.id}
              transform={`translate(${n.x}, ${n.y})`}
              onMouseDown={(e) => handleMouseDown(e, n.clado.id)}
              onClick={(e) => {
                if (e.shiftKey) onToggleMultiple(n.clado.id);
                else onSelect(n.clado.id);
              }}
              onContextMenu={(e) => {
                // El menú nativo del navegador se previene siempre acá;
                // el click derecho se usa para arrastrar (ver handleMouseDown),
                // no para abrir un menú.
                e.preventDefault();
              }}
              className={siendoArrastrado ? "cursor-grabbing" : "cursor-pointer"}
            >
              {esHoverDestino && (
                <circle r={10} className="fill-none stroke-accent" strokeWidth={1.5} strokeDasharray="3 2" />
              )}
              {enSeleccionMultiple && !siendoArrastrado && (
                <circle r={9} className="fill-none stroke-accent/50" strokeWidth={1.5} strokeDasharray="2 2" />
              )}
              <circle
                r={esHoja ? 3.5 : 4.5}
                className={
                  siendoArrastrado
                    ? "fill-accent/40"
                    : activo || enSeleccionMultiple
                      ? "fill-accent"
                      : esHoja
                        ? "fill-primary/40"
                        : "fill-primary/60"
                }
                opacity={esDestinoInvalido ? 0.25 : 1}
              />
              <text
                x={8}
                y={4}
                opacity={siendoArrastrado ? 0.4 : esDestinoInvalido ? 0.3 : 1}
                className={`text-[11px] font-bold select-none ${
                  activo || enSeleccionMultiple ? "fill-accent" : esHoverDestino ? "fill-accent" : "fill-primary/75"
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

        {/* "Fantasma" de los nodos mientras se arrastran, siguiendo al mouse */}
        {nodosArrastrados.length > 0 && huboMovimiento && posMouse && (
          <g transform={`translate(${posMouse.x}, ${posMouse.y})`} className="pointer-events-none" opacity={0.85}>
            <circle r={5} className="fill-accent" />
            <text x={8} y={4} className="text-[11px] font-black fill-accent select-none">
              {nodosArrastrados.length === 1
                ? nodosArrastrados[0].clado.nombre || "Sin nombre"
                : `${nodosArrastrados.length} clados`}
            </text>
          </g>
        )}
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
      <div className="flex items-center gap-1.5 mb-3">
        <Dna size={12} className="text-accent/60 shrink-0" />
        <input
          className="flex-1 min-w-0 bg-transparent text-xs font-black uppercase italic tracking-tight text-primary truncate outline-none placeholder:text-primary/25 px-1 py-0.5 rounded hover:bg-primary/5 focus:bg-primary/8"
          placeholder="Nombre del clado…"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={guardar}
        />
      </div>

      <div className="flex items-center gap-1.5 mb-4">
        <button
          type="button"
          onClick={guardar}
          className="flex-1 text-micro font-black uppercase tracking-widest px-2 py-1.5 rounded-lg bg-primary text-bg-main hover:opacity-90 transition-opacity"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Eliminar clado"
          className="shrink-0 p-1.5 rounded-lg text-primary/25 hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="mb-3.5">
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1">
          Sinapomorfía
        </span>
        <p className="text-micro text-primary/35 mb-1.5 leading-snug">
          Carácter derivado compartido por todos los descendientes.
        </p>
        <input
          className="w-full bg-primary/[0.02] border border-primary/10 rounded-lg px-2 py-1.5 text-xs font-bold text-primary/80 outline-none placeholder:text-primary/30 placeholder:font-normal focus:border-primary/25"
          placeholder="Ej. vejiga de veneno dorsal…"
          value={sinapomorfia}
          onChange={(e) => setSinapomorfia(e.target.value)}
          onBlur={guardar}
        />
      </div>

      <div className="mb-3.5">
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1">
          Descripción
        </span>
        <RichEditor
          minHeight="4.5rem"
          placeholder="Notas evolutivas, contexto del linaje…"
          value={descripcion}
          onChange={setDescripcion}
        />
      </div>

      <button
        type="button"
        onClick={onCrearHijo}
        className="w-full flex items-center justify-center gap-1.5 mb-3.5 px-2 py-1.5 rounded-lg border border-dashed text-micro font-black uppercase tracking-widest transition-all"
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

// ─── Panel flotante centrado (mismo patrón que ElementoPanelFlotante en
// Química y los paneles de Personaje/Criatura) ─────────────────────────────
// Reemplaza el sidebar fijo: al clickear un clado se abre un modal grande
// centrado con backdrop blur, en vez de una barra lateral angosta.
function CladoPanelFlotante({
  clado,
  onCerrar,
  onSave,
  onDelete,
  onCrearHijo,
  onSelectCriatura,
}: {
  clado: Clado;
  onCerrar: () => void;
  onSave: (updates: Partial<Clado>) => void;
  onDelete: () => void;
  onCrearHijo: () => void;
  onSelectCriatura?: (id: string) => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onCerrar]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
      style={{
        background: "color-mix(in srgb, var(--primary) 35%, transparent)",
        backdropFilter: "blur(8px)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        className="w-full h-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: "var(--bg-main)",
          border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
          animation: "popIn 160ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div
          className="shrink-0 flex items-center gap-3 px-4 py-3 border-b"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
          }}
        >
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              background: "color-mix(in srgb, var(--primary) 8%, transparent)",
              borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
            }}
          >
            <Dna className="text-primary/50" size={12} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
              Clado · vista rápida
            </p>
            <p className="text-xs font-bold text-primary truncate">{clado.nombre}</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar (Esc)"
            className="shrink-0 p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/8 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3.5">
          <PanelClado
            key={clado.id}
            clado={clado}
            onSave={onSave}
            onDelete={onDelete}
            onCrearHijo={onCrearHijo}
            onSelectCriatura={onSelectCriatura}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export function CladisticaPage({ onSelectCriatura }: Props) {
  const { clados, loading, creating, crear, actualizar, eliminar } = useClados();
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [seleccionMultiple, setSeleccionMultiple] = useState<Set<string>>(new Set());

  const seleccionado = clados.find((c) => c.id === seleccionadoId) ?? null;

  const crearRaiz = async () => {
    const nuevo = await crear("Nuevo clado", null);
    if (nuevo) setSeleccionadoId(nuevo.id);
  };

  const crearHijo = async (padreId: string) => {
    const nuevo = await crear("Nuevo clado", padreId);
    if (nuevo) setSeleccionadoId(nuevo.id);
  };

  const toggleMultiple = (id: string) => {
    setSeleccionMultiple((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Al armar/editar la selección múltiple, el panel lateral sigue el
    // último nodo tocado con Shift — así se puede ver su detalle también.
    setSeleccionadoId(id);
  };

  const moverGrupo = async (ids: string[], nuevoPadreId: string | null) => {
    await Promise.all(ids.map((id) => actualizar(id, { padre_id: nuevoPadreId })));
    setSeleccionMultiple(new Set());
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
          Cladograma
        </span>
        <div className="flex items-center gap-3">
          {seleccionMultiple.size > 0 && (
            <button
              type="button"
              onClick={() => setSeleccionMultiple(new Set())}
              className="text-micro font-black uppercase tracking-widest text-accent/60 hover:text-accent transition-colors"
            >
              Limpiar selección ({seleccionMultiple.size})
            </button>
          )}
          <button
            type="button"
            disabled={creating}
            onClick={() => void crearRaiz()}
            className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors disabled:opacity-40"
          >
            <Plus size={10} /> Nuevo ancestro común
          </button>
        </div>
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
          seleccionMultiple={seleccionMultiple}
          onSelect={(id) => {
            setSeleccionadoId(id);
            setSeleccionMultiple(new Set());
          }}
          onToggleMultiple={toggleMultiple}
          onMover={(cladoId, nuevoPadreId) => void actualizar(cladoId, { padre_id: nuevoPadreId })}
          onMoverGrupo={(ids, nuevoPadreId) => void moverGrupo(ids, nuevoPadreId)}
        />
      )}

      {/* Panel flotante centrado: mismo patrón que Elementos/Personajes/
          Criaturas — modal grande centrado con backdrop blur, en vez de
          sidebar fijo. Se cierra con click en el backdrop, Escape, o X. */}
      {seleccionado && (
        <CladoPanelFlotante
          clado={seleccionado}
          onCerrar={() => setSeleccionadoId(null)}
          onSave={(updates) => void actualizar(seleccionado.id, updates)}
          onDelete={() => {
            void eliminar(seleccionado.id);
            setSeleccionadoId(null);
          }}
          onCrearHijo={() => void crearHijo(seleccionado.id)}
          onSelectCriatura={onSelectCriatura}
        />
      )}
    </div>
  );
}
