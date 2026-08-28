"use client";

/**
 * StructureCanvas.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Canvas de nodos + conexiones, genérico y sin conocimiento de dominio.
 *
 * No sabe qué es un IUM, un Oris, un Elemento ni una Partícula. Recibe:
 *   - una lista de "columnas" (niveles), cada una con sus nodos ya resueltos
 *     (id, label, sublabel, contenido visual opcional);
 *   - una lista de conexiones entre nodos (por id).
 * y se limita a: posicionar en columnas, dibujar las conexiones, manejar
 * hover/click, y emitir eventos hacia quien lo use (onHoverNode, onSelectNode).
 *
 * Pensado para reutilizarse en: Microestructura, A/T/S, Composición,
 * Compatibilidad, Materiales, Biología, Sandbox, etc. — cualquier vista que
 * sea "nodos organizados en niveles + conexiones con significado".
 */

import React, { useMemo, useState } from "react";

export interface CanvasNode {
  id: string;
  label: string;
  sublabel?: string;
  /** Contenido visual del nodo (ej. <ParticulaVisual/>, <IumVisual/>).
   *  StructureCanvas no sabe qué es esto, solo lo posiciona. */
  visual?: React.ReactNode;
  /** Tono semántico opcional (el llamador decide qué significa "accent"). */
  tone?: "default" | "accent" | "muted";
}

export interface CanvasColumn {
  id: string;
  label: string;
  nodes: CanvasNode[];
}

export interface CanvasEdge {
  fromNodeId: string;
  toNodeId: string;
  /** Intensidad visual 0..1 (grosor/opacidad) — el llamador decide su
   *  significado (ej. proporción, cantidad). Sin dato, se dibuja neutra. */
  weight?: number;
}

export interface StructureCanvasProps {
  columns: CanvasColumn[];
  edges?: CanvasEdge[];
  selectedNodeId?: string | null;
  onHoverNode?: (nodeId: string | null) => void;
  onSelectNode?: (nodeId: string) => void;
  /** Nodo(s) a resaltar externamente (ej. desde TraceView) sin necesidad de click. */
  highlightedNodeIds?: string[];
  className?: string;
}

const NODE_W = 128;
const NODE_H = 92;
const COL_GAP = 96;
const ROW_GAP = 20;
const PAD = 32;

interface LaidOutNode extends CanvasNode {
  colIndex: number;
  x: number;
  y: number;
}

export function StructureCanvas({
  columns,
  edges = [],
  selectedNodeId = null,
  onHoverNode,
  onSelectNode,
  highlightedNodeIds = [],
  className,
}: StructureCanvasProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const { laidOut, width, height } = useMemo(() => {
    const nodesById = new Map<string, LaidOutNode>();
    let maxRows = 1;
    columns.forEach((col) => {
      maxRows = Math.max(maxRows, col.nodes.length);
    });
    const totalHeight = PAD * 2 + maxRows * NODE_H + (maxRows - 1) * ROW_GAP;

    columns.forEach((col, colIndex) => {
      const colHeight = col.nodes.length * NODE_H + (col.nodes.length - 1) * ROW_GAP;
      const startY = PAD + (totalHeight - PAD * 2 - colHeight) / 2;
      col.nodes.forEach((node, rowIndex) => {
        nodesById.set(node.id, {
          ...node,
          colIndex,
          x: PAD + colIndex * (NODE_W + COL_GAP),
          y: startY + rowIndex * (NODE_H + ROW_GAP),
        });
      });
    });

    const totalWidth =
      PAD * 2 + columns.length * NODE_W + Math.max(0, columns.length - 1) * COL_GAP;

    return { laidOut: nodesById, width: totalWidth, height: totalHeight };
  }, [columns]);

  const activeHoverId = hoverId;
  const highlightSet = useMemo(() => new Set(highlightedNodeIds), [highlightedNodeIds]);

  function handleEnter(id: string) {
    setHoverId(id);
    onHoverNode?.(id);
  }
  function handleLeave() {
    setHoverId(null);
    onHoverNode?.(null);
  }
  function handleClick(id: string) {
    onSelectNode?.(id);
  }

  return (
    <div className={`w-full overflow-x-auto ${className ?? ""}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="block"
        role="img"
        aria-label="Diagrama de estructura"
      >
        {/* Columnas: etiqueta de nivel arriba */}
        {columns.map((col, i) => (
          <text
            key={col.id}
            x={PAD + i * (NODE_W + COL_GAP) + NODE_W / 2}
            y={16}
            textAnchor="middle"
            fontSize={10}
            fontWeight={900}
            letterSpacing="0.14em"
            style={{ fill: "color-mix(in srgb, var(--primary) 40%, transparent)", textTransform: "uppercase" }}
          >
            {col.label}
          </text>
        ))}

        {/* Conexiones — debajo de los nodos */}
        <g>
          {edges.map((edge, i) => {
            const from = laidOut.get(edge.fromNodeId);
            const to = laidOut.get(edge.toNodeId);
            if (!from || !to) return null;
            const x1 = from.x + NODE_W;
            const y1 = from.y + NODE_H / 2;
            const x2 = to.x;
            const y2 = to.y + NODE_H / 2;
            const midX = (x1 + x2) / 2;
            const isActive =
              activeHoverId === edge.fromNodeId ||
              activeHoverId === edge.toNodeId ||
              selectedNodeId === edge.fromNodeId ||
              selectedNodeId === edge.toNodeId ||
              highlightSet.has(edge.fromNodeId) ||
              highlightSet.has(edge.toNodeId);
            const weight = edge.weight ?? 0.5;
            const strokeWidth = 1 + Math.max(0, Math.min(1, weight)) * 2.5;
            return (
              <path
                key={`${edge.fromNodeId}-${edge.toNodeId}-${i}`}
                d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                fill="none"
                strokeWidth={strokeWidth}
                style={{
                  stroke: isActive
                    ? "color-mix(in srgb, var(--primary) 65%, transparent)"
                    : "color-mix(in srgb, var(--primary) 16%, transparent)",
                  transition: "stroke 150ms ease",
                }}
              />
            );
          })}
        </g>

        {/* Nodos */}
        <g>
          {[...laidOut.values()].map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isHovered = activeHoverId === node.id;
            const isHighlighted = highlightSet.has(node.id);
            const emphasized = isSelected || isHovered || isHighlighted;
            const toneBorder =
              node.tone === "accent"
                ? "var(--primary)"
                : emphasized
                  ? "color-mix(in srgb, var(--primary) 55%, transparent)"
                  : "color-mix(in srgb, var(--primary) 14%, transparent)";
            const toneFill =
              node.tone === "accent"
                ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                : emphasized
                  ? "color-mix(in srgb, var(--primary) 7%, transparent)"
                  : "color-mix(in srgb, var(--primary) 2.5%, transparent)";
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => handleEnter(node.id)}
                onMouseLeave={handleLeave}
                onClick={() => handleClick(node.id)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={14}
                  strokeWidth={isSelected ? 2 : 1.25}
                  style={{
                    fill: toneFill,
                    stroke: toneBorder,
                    transition: "fill 150ms ease, stroke 150ms ease",
                  }}
                />
                {node.visual ? (
                  <foreignObject x={8} y={6} width={NODE_W - 16} height={NODE_H - 34}>
                    <div className="flex h-full w-full items-center justify-center">{node.visual}</div>
                  </foreignObject>
                ) : null}
                <text
                  x={NODE_W / 2}
                  y={NODE_H - (node.sublabel ? 22 : 12)}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={900}
                  style={{ fill: "color-mix(in srgb, var(--primary) 85%, transparent)" }}
                >
                  {node.label.length > 16 ? `${node.label.slice(0, 15)}…` : node.label}
                </text>
                {node.sublabel ? (
                  <text
                    x={NODE_W / 2}
                    y={NODE_H - 8}
                    textAnchor="middle"
                    fontSize={9}
                    style={{ fill: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
                  >
                    {node.sublabel.length > 20 ? `${node.sublabel.slice(0, 19)}…` : node.sublabel}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
