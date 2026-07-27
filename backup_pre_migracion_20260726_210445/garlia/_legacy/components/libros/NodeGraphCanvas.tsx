"use client";
/**
 * NodeGraphCanvas.tsx
 * ────────────────────
 * Fase 3 del rediseño Choice/Gate: editor visual de grafo por capítulo.
 * Nodos arrastrables (posición persistida vía usePosicionesNodos) + drag
 * desde el borde de un nodo a otro para crear un [[choice]] nuevo.
 *
 * Deliberadamente NO intenta ser un editor de grafo genérico — está atado
 * al modelo StoryGraph que ya calcula storyGraph.ts, y su única forma de
 * escribir de vuelta al markdown es insertChoiceAtEndOfSection (agregar al
 * final de la sección, nunca reescribir texto existente).
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";

import type { StoryEdge, StoryNode } from "@/domains/garlia/_legacy/hooks/capitulos/storyGraph";

const NODE_W = 170;
const NODE_H = 56;
const GRID_X = 220;
const GRID_Y = 110;

interface Pos {
  x: number;
  y: number;
}

/**
 * Auto-layout simple por niveles (BFS desde el nodo raíz), para nodos que
 * todavía no tienen posición guardada. No es un layout "bonito" — es un
 * punto de partida razonable que el autor reacomoda arrastrando.
 */
function autoLayout(
  nodes: StoryNode[],
  edges: StoryEdge[],
  existentes: Record<string, Pos>,
): Record<string, Pos> {
  const result: Record<string, Pos> = { ...existentes };
  const pendientes = nodes.filter((n) => !result[n.id]);
  if (pendientes.length === 0) return result;

  const adyacencia = new Map<string, string[]>();
  for (const e of edges) {
    if (!adyacencia.has(e.from)) adyacencia.set(e.from, []);
    adyacencia.get(e.from)!.push(e.to);
  }

  const nivelDe = new Map<string, number>();
  const root = nodes.find((n) => n.kind === "chapter-start");
  if (root) nivelDe.set(root.id, 0);

  // BFS desde el raíz para asignar niveles; lo que no sea alcanzable
  // (huérfanas) se apila aparte al final.
  const queue = root ? [root.id] : [];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const nivel = nivelDe.get(cur) ?? 0;
    for (const to of adyacencia.get(cur) ?? []) {
      if (!nivelDe.has(to)) {
        nivelDe.set(to, nivel + 1);
        queue.push(to);
      }
    }
  }

  const porNivel = new Map<number, string[]>();
  for (const n of pendientes) {
    const nivel = nivelDe.get(n.id) ?? -1; // -1 = huérfana, va a su propia columna
    if (!porNivel.has(nivel)) porNivel.set(nivel, []);
    porNivel.get(nivel)!.push(n.id);
  }

  for (const [nivel, ids] of porNivel) {
    const col = nivel === -1 ? Math.max(...[...porNivel.keys()], 0) + 1 : nivel;
    ids.forEach((id, i) => {
      result[id] = { x: 40 + col * GRID_X, y: 40 + i * GRID_Y };
    });
  }

  return result;
}

const EDGE_COLOR: Record<StoryEdge["type"], string> = {
  choice: "#5b8def",
  "condicion-si": "#22c55e",
  "condicion-no": "#ef4444",
};

export function NodeGraphCanvas({
  graph,
  posicionesGuardadas,
  onMoveNode,
  onConnect,
  onSelectNode,
}: {
  graph: { nodes: StoryNode[]; edges: StoryEdge[] };
  posicionesGuardadas: Record<string, Pos>;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  /** Se dispara al soltar un drag-to-connect sobre otro nodo. */
  onConnect: (fromNodeId: string, toNodeId: string) => void;
  onSelectNode?: (nodeId: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(
    null,
  );
  const [connecting, setConnecting] = useState<{ fromId: string; x: number; y: number } | null>(
    null,
  );
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);

  const positions = useMemo(
    () => autoLayout(graph.nodes, graph.edges, posicionesGuardadas),
    [graph.nodes, graph.edges, posicionesGuardadas],
  );

  const toSvgPoint = useCallback((clientX: number, clientY: number): Pos => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const handleNodePointerDown = useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      e.stopPropagation();
      const p = positions[nodeId];
      if (!p) return;
      const pt = toSvgPoint(e.clientX, e.clientY);
      setDragging({ nodeId, offsetX: pt.x - p.x, offsetY: pt.y - p.y });
    },
    [positions, toSvgPoint],
  );

  const handleConnectorPointerDown = useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      e.stopPropagation();
      const pt = toSvgPoint(e.clientX, e.clientY);
      setConnecting({ fromId: nodeId, x: pt.x, y: pt.y });
    },
    [toSvgPoint],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const pt = toSvgPoint(e.clientX, e.clientY);
      if (dragging) {
        onMoveNode(dragging.nodeId, pt.x - dragging.offsetX, pt.y - dragging.offsetY);
      } else if (connecting) {
        setConnecting((prev) => (prev ? { ...prev, x: pt.x, y: pt.y } : prev));
        // detectar sobre qué nodo está el cursor, para feedback visual
        const under = graph.nodes.find((n) => {
          const p = positions[n.id];
          if (!p || n.id === connecting.fromId) return false;
          return (
            pt.x >= p.x &&
            pt.x <= p.x + NODE_W &&
            pt.y >= p.y &&
            pt.y <= p.y + NODE_H
          );
        });
        setHoverTarget(under?.id ?? null);
      }
    },
    [dragging, connecting, onMoveNode, toSvgPoint, graph.nodes, positions],
  );

  const handlePointerUp = useCallback(() => {
    if (connecting && hoverTarget) {
      onConnect(connecting.fromId, hoverTarget);
    }
    setDragging(null);
    setConnecting(null);
    setHoverTarget(null);
  }, [connecting, hoverTarget, onConnect]);

  const width = Math.max(600, ...Object.values(positions).map((p) => p.x + NODE_W + 60));
  const height = Math.max(400, ...Object.values(positions).map((p) => p.y + NODE_H + 60));

  return (
    <div className="relative w-full overflow-auto rounded-xl border border-primary/8 bg-primary/[0.015]" style={{ maxHeight: 560 }}>
      <svg
        ref={svgRef}
        height={height}
        width={width}
        style={{ display: "block", touchAction: "none" }}
        onPointerLeave={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* aristas existentes */}
        {graph.edges.map((edge) => {
          const from = positions[edge.from];
          const to = positions[edge.to];
          if (!from) return null;
          const x1 = from.x + NODE_W;
          const y1 = from.y + NODE_H / 2;
          const x2 = to ? to.x : x1 + 80;
          const y2 = to ? to.y + NODE_H / 2 : y1;
          const midX = (x1 + x2) / 2;
          return (
            <g key={edge.id}>
              <path
                d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={edge.isBroken ? "#ef4444" : EDGE_COLOR[edge.type]}
                strokeDasharray={edge.isBroken || !to ? "4 3" : undefined}
                strokeWidth={1.5}
              />
              <text
                fill="color-mix(in srgb, var(--foreground) 45%, transparent)"
                fontSize={9}
                fontWeight={700}
                x={midX}
                y={(y1 + y2) / 2 - 4}
              >
                {edge.label}
              </text>
            </g>
          );
        })}

        {/* línea de conexión en progreso (drag-to-connect) */}
        {connecting && (
          <line
            stroke="#5b8def"
            strokeDasharray="4 3"
            strokeWidth={2}
            x1={positions[connecting.fromId]?.x != null ? positions[connecting.fromId].x + NODE_W : 0}
            x2={connecting.x}
            y1={positions[connecting.fromId]?.y != null ? positions[connecting.fromId].y + NODE_H / 2 : 0}
            y2={connecting.y}
          />
        )}

        {/* nodos */}
        {graph.nodes.map((node) => {
          const p = positions[node.id];
          if (!p) return null;
          const isHoverTarget = hoverTarget === node.id;
          return (
            <g
              key={node.id}
              style={{ cursor: dragging?.nodeId === node.id ? "grabbing" : "grab" }}
              transform={`translate(${p.x}, ${p.y})`}
              onPointerDown={(e) => handleNodePointerDown(e, node.id)}
            >
              <rect
                fill={node.kind === "chapter-start" ? "#5b8def" : "var(--surface-2, var(--background))"}
                height={NODE_H}
                rx={10}
                stroke={
                  isHoverTarget
                    ? "#5b8def"
                    : node.isOrphan
                      ? "#ef4444"
                      : "color-mix(in srgb, var(--foreground) 12%, transparent)"
                }
                strokeWidth={isHoverTarget ? 2.5 : 1}
                width={NODE_W}
                onClick={() => onSelectNode?.(node.id)}
              />
              <text
                fill={node.kind === "chapter-start" ? "#fff" : "var(--foreground)"}
                fontSize={11}
                fontWeight={700}
                x={12}
                y={22}
              >
                {node.label.length > 22 ? `${node.label.slice(0, 22)}…` : node.label}
              </text>
              <text
                fill={
                  node.kind === "chapter-start"
                    ? "rgba(255,255,255,0.6)"
                    : "color-mix(in srgb, var(--foreground) 35%, transparent)"
                }
                fontSize={9}
                fontWeight={600}
                x={12}
                y={38}
              >
                {node.id}
                {node.isOrphan ? " · huérfana" : ""}
              </text>
              {/* conector para drag-to-connect, en el borde derecho */}
              <circle
                cx={NODE_W}
                cy={NODE_H / 2}
                fill="#5b8def"
                r={7}
                style={{ cursor: "crosshair" }}
                onPointerDown={(e) => handleConnectorPointerDown(e, node.id)}
              />
              <text
                dominantBaseline="middle"
                fill="#fff"
                fontSize={8}
                pointerEvents="none"
                textAnchor="middle"
                x={NODE_W}
                y={NODE_H / 2 + 0.5}
              >
                ⤷
              </text>
            </g>
          );
        })}
      </svg>

      <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/5 text-micro font-bold text-primary/40">
        <Plus size={10} />
        Arrastrá desde el círculo azul de un nodo hasta otro para conectar
      </div>
    </div>
  );
}
