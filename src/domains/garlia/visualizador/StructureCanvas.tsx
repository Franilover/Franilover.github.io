"use client";

/**
 * StructureCanvas.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Canvas orbital genérico, sin conocimiento de dominio — implementa el
 * diseño aprobado de VIS-01 ("Partículas → IUM → Elemento", documento
 * maestro del Visualizador, Parte 2):
 *
 *   - El último nivel de `columns` es el "centro de gravedad" (un único
 *     nodo, normalmente tone="accent"): IUM, Oris, capa o Elemento según
 *     quién llame. Todo lo demás no está "conectado en fila" — orbita
 *     alrededor de ese centro.
 *   - Los niveles intermedios se dibujan como anillos concéntricos: cada
 *     nivel es un anillo, más cerca del centro cuanto más "profundo"
 *     jerárquicamente. Dentro de un mismo anillo, la distancia real al
 *     centro puede variar según edge.weight (contribución/peso), pero
 *     SOLO si ese dato viene definido — si no, todos los nodos del anillo
 *     quedan a la misma distancia (ninguna magnitud se inventa).
 *   - Al cambiar el centro (nueva selección raíz), se reproduce una
 *     animación de construcción en fases: partículas separadas → convergen
 *     → se forma el nivel intermedio → el centro emerge → estado estable.
 *     Ocurre una sola vez por cambio de centro, no en loop.
 *
 * No sabe qué es un IUM, un Oris, un Elemento ni una Partícula. Sigue
 * recibiendo columnas + edges ya resueltos por el llamador y se limita a
 * layout, animación, hover/click y eventos (onHoverNode, onSelectNode).
 */

import React, { useEffect, useMemo, useRef, useState } from "react";

export interface CanvasNode {
  id: string;
  label: string;
  sublabel?: string;
  /** Contenido visual del nodo (ej. <ParticulaVisual/>, <IumVisual/>).
   *  StructureCanvas no sabe qué es esto, solo lo posiciona. */
  visual?: React.ReactNode;
  /** Tono semántico opcional (el llamador decide qué significa "accent"). */
  tone?: "default" | "accent" | "muted";
  /** Si es true, no dibuja el círculo de borde/fondo del nodo (orbitante o
   *  central) y el `visual` interno aprovecha todo el espacio disponible.
   *  Default false — no cambia el comportamiento de los usos existentes. */
  hideBorder?: boolean;
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
   *  significado (ej. proporción, cantidad). Sin dato, se dibuja neutra
   *  y a distancia orbital neutra (no se infiere ninguna magnitud). */
  weight?: number;
  /** Punto exacto dentro del nodo destino al que debe llegar la línea, en
   *  vez del centro del nodo — ej. la posición de una Partícula específica
   *  dibujada dentro del círculo de su IUM (mismo layout orbital que usa
   *  IumVisual internamente). `angle` en radianes (mismo sistema que el
   *  ángulo de layout: 0 = derecha, -π/2 = arriba), `radiusRatio` 0..1
   *  como fracción del radio del nodo destino (0 = centro, 1 = borde). Sin
   *  este dato, la línea llega al centro del nodo (comportamiento actual). */
  toPoint?: { angle: number; radiusRatio: number };
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
  /** Multiplicador del tamaño de los círculos de nodo (central y
   *  orbitantes), sin tocar CENTER_R/ORBIT_R globales que usan el resto de
   *  perspectivas. Default 1 (comportamiento actual, sin cambios). Ej. 1.4
   *  agranda un 40% los círculos de esta instancia del canvas nomás. */
  nodeScale?: number;
}

const CENTER_R = 48; // radio del nodo central (el "centro de gravedad"). Subido
// de 40 → 48: pedido explícito de que la esfera del Oris se vea más
// grande — sigue siendo el mismo contenedor que usan IUM/Elemento/capas
// en otras perspectivas, pero da más margen para que el visual interno
// (ver size={} en VisualizadorPage) crezca sin recortarse contra el
// borde del círculo.
const ORBIT_R = 118; // radio de referencia del nodo orbitante
const RING_GAP = 128; // separación entre anillos concéntricos
const RING_0_R = 130; // radio del primer anillo (el más externo/profundo)
const PAD = 40;

interface LaidOutNode extends CanvasNode {
  ringIndex: number; // 0 = anillo más externo, ringCount-1 = más interno (el previo al centro)
  isCenter: boolean;
  angle: number; // radianes
  radius: number; // distancia real al centro en este layout
  x: number;
  y: number;
}

/** Fases de la animación de construcción (sección 3 del diseño VIS-01).
 *  Ocurre una vez por cada nuevo "centro" — no hay loop. */
type BuildPhase = "scattered" | "converging" | "forming" | "emerging" | "stable";
const PHASE_SEQUENCE: { phase: BuildPhase; durationMs: number }[] = [
  { phase: "scattered", durationMs: 30 },
  { phase: "converging", durationMs: 220 },
  { phase: "forming", durationMs: 150 },
  { phase: "emerging", durationMs: 140 },
  { phase: "stable", durationMs: 0 },
];

export function StructureCanvas({
  columns,
  edges = [],
  selectedNodeId = null,
  onHoverNode,
  onSelectNode,
  highlightedNodeIds = [],
  className,
  nodeScale = 1,
}: StructureCanvasProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  // Radios reales de esta instancia del canvas: CENTER_R/ORBIT_R son la
  // base compartida por todas las perspectivas; nodeScale permite que
  // Rutas (u otra vista puntual) pida círculos más grandes sin afectar
  // Alquimia/Elementos/otras vistas que no pasan la prop (quedan en 1).
  const centerR = CENTER_R * nodeScale;
  const orbitNodeR = (ORBIT_R / 2.9) * nodeScale;

  // ─── Identidad del "centro" actual: el diseño pide que la animación de
  // construcción se repita cuando cambia QUÉ está emergiendo (nuevo Oris,
  // nuevo Elemento, nuevo Ium al hacer zoom...), no en cada render.
  const centerId = columns.length > 0 ? columns[columns.length - 1]?.nodes[0]?.id ?? null : null;

  const [phase, setPhase] = useState<BuildPhase>("stable");
  const phaseTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    phaseTimers.current.forEach(clearTimeout);
    phaseTimers.current = [];
    if (!centerId) return;
    let elapsed = 0;
    PHASE_SEQUENCE.forEach(({ phase: p, durationMs }) => {
      const t = setTimeout(() => setPhase(p), elapsed);
      phaseTimers.current.push(t);
      elapsed += durationMs;
    });
    return () => {
      phaseTimers.current.forEach(clearTimeout);
    };
    // Se re-dispara solo cuando cambia el centro real, no en cada nuevo
    // array de columns con el mismo centro (evita reiniciar la animación
    // en cada render por referencias nuevas de objetos).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId]);

  const { laidOut, size, ringCount } = useMemo(() => {
    const nodesById = new Map<string, LaidOutNode>();
    if (columns.length === 0) {
      return { laidOut: nodesById, size: 320, ringCount: 0 };
    }

    // Último nivel = centro de gravedad. Todo lo anterior son anillos,
    // del más profundo (índice 0, el más externo) al más cercano al centro.
    const orbitLevels = columns.slice(0, -1);
    const centerLevel = columns[columns.length - 1];
    const centerNode = centerLevel?.nodes[0];

    const weightByFromId = new Map<string, number>();
    edges.forEach((e) => {
      if (e.weight !== undefined) weightByFromId.set(e.fromNodeId, e.weight);
    });

    // Radio mínimo para que `n` nodos, cada uno de diámetro ~2r + margen,
    // quepan en su propia circunferencia sin superponerse: arco disponible
    // por nodo = 2π·radius / n ≥ nodeDiameter + gap.
    const nodeDiameter = orbitNodeR * 2;
    // Gap subido de 18 → 42: con pocos nodos por anillo (típico en el
    // Oris, que suele tener 2-4 IUMs) el radio mínimo resultante era casi
    // el mismo que el diámetro del nodo, así que los IUM terminaban muy
    // pegados entre sí — se leían como un grupo borroso en vez de nodos
    // individuales y distinguibles. Con más separación angular cada IUM
    // queda claramente aislado del vecino.
    const nodeGap = 42;
    const minRadiusForNodes = (n: number) => (n * (nodeDiameter + nodeGap)) / (2 * Math.PI);

    // Radios por anillo: se construyen de ADENTRO hacia AFUERA (el anillo
    // más cercano al centro primero) para que cada uno reciba el radio
    // mínimo que sus propios nodos necesitan, sin heredar un radio ajeno
    // que podría ser insuficiente (bug: antes todos los anillos derivaban
    // su radio de uno solo "outerRingRadius" calculado con el anillo de
    // MÁS nodos, así que un anillo interno con muchos nodos podía terminar
    // con radio menor al que le tocaba y sus nodos se superponían).
    const ringRadii: number[] = new Array(orbitLevels.length);
    let previousRadius = centerR + 40; // primer anillo (el más interno) empieza fuera del centro
    for (let ringIndex = orbitLevels.length - 1; ringIndex >= 0; ringIndex--) {
      const nodeCount = orbitLevels[ringIndex].nodes.length;
      const minRadius = Math.max(RING_0_R - (orbitLevels.length - 1 - ringIndex) * RING_GAP, minRadiusForNodes(nodeCount));
      const radius = Math.max(minRadius, previousRadius + RING_GAP);
      ringRadii[ringIndex] = radius;
      previousRadius = radius;
    }
    const outerRingRadius = ringRadii.length > 0 ? ringRadii[0] : 0;

    orbitLevels.forEach((level, ringIndex) => {
      // ringIndex 0 = nivel más externo (ej. Partículas); a mayor índice,
      // más cerca del centro (ej. IUM justo antes del Oris).
      const baseRadius = ringRadii[ringIndex];
      const nodeCount = level.nodes.length;
      // Offset angular por anillo: todos los anillos arrancaban en el
      // mismo ángulo base (-π/2), así que un nodo del anillo N quedaba
      // exactamente "en línea" (mismo radio angular) que uno del anillo
      // N-1 — ej. el primer IUM siempre alineado con la primera partícula.
      // Se desfasa cada anillo medio paso angular respecto al anterior
      // (mitad del hueco entre nodos de ESTE anillo), así los nodos caen
      // en los huecos que dejan los del anillo vecino en vez de en línea.
      const angleOffset = ringIndex % 2 === 0 ? 0 : Math.PI / nodeCount;
      level.nodes.forEach((node, i) => {
        // Distancia real: si hay peso definido para ESTE nodo (edge saliente
        // con weight), nodos con más peso quedan más cerca del centro dentro
        // de su propio anillo (contribución = cercanía). Sin dato, todos a
        // la misma distancia — ninguna magnitud se inventa (regla del diseño).
        // El jitter nunca reduce el radio por debajo del mínimo sin
        // superposición del propio anillo (antes podía acercar demasiado
        // y volver a solapar nodos vecinos).
        const w = weightByFromId.get(node.id);
        const maxJitter = Math.min(34, Math.max(0, baseRadius - minRadiusForNodes(nodeCount)));
        const radialJitter = w !== undefined ? (1 - Math.max(0, Math.min(1, w))) * maxJitter : 0;
        const angle = (2 * Math.PI * i) / nodeCount - Math.PI / 2 + angleOffset;
        nodesById.set(node.id, {
          ...node,
          ringIndex,
          isCenter: false,
          angle,
          radius: baseRadius + radialJitter,
          x: 0,
          y: 0,
        });
      });
    });

    if (centerNode) {
      nodesById.set(centerNode.id, {
        ...centerNode,
        ringIndex: orbitLevels.length,
        isCenter: true,
        angle: 0,
        radius: 0,
        x: 0,
        y: 0,
      });
    }

    // Margen: el nodo más externo necesita espacio no solo para su propio
    // círculo, sino para el texto que dibuja DEBAJO de él (label + sublabel,
    // hasta y = r + 33). Antes el margen era una fracción fija de ORBIT_R
    // que no crecía con outerRingRadius, así que al aumentar el radio para
    // evitar superposición (fix anterior), el nodo/texto del borde exterior
    // quedaba recortado por el viewBox — por eso "algunos no se muestran".
    const nodeOuterMargin = orbitNodeR + 40; // radio del nodo + espacio para 2 líneas de texto
    const maxRadius = orbitLevels.length > 0 ? outerRingRadius : 0;
    const totalSize = PAD * 2 + maxRadius * 2 + nodeOuterMargin * 2;

    // Coordenadas absolutas centradas en el canvas.
    const cx = totalSize / 2;
    const cy = totalSize / 2;
    nodesById.forEach((n) => {
      n.x = cx + Math.cos(n.angle) * n.radius;
      n.y = cy + Math.sin(n.angle) * n.radius;
    });

    return { laidOut: nodesById, size: totalSize, ringCount: orbitLevels.length };
  }, [columns, edges, centerR, orbitNodeR]);

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

  const cx = size / 2;
  const cy = size / 2;

  // Progreso 0..1 de la animación de construcción, usado para interpolar
  // radio (convergencia) y opacidad (emergencia) de forma continua en vez
  // de saltos discretos entre fases.
  const scatterScale = phase === "scattered" ? 1.9 : 1;
  const centerScale = phase === "scattered" || phase === "converging" ? 0 : phase === "forming" ? 0.6 : 1;
  const centerOpacity = phase === "scattered" || phase === "converging" ? 0 : phase === "forming" ? 0.5 : 1;
  const orbitOpacity = phase === "scattered" ? 0.35 : 1;
  const transitionAll = "transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease";

  return (
    <div className={`w-full ${className ?? ""}`} style={{ aspectRatio: "1 / 1", maxWidth: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        className="block"
        role="img"
        aria-label="Diagrama orbital de estructura"
      >
        {/* Anillos de referencia — sutiles, solo para dar sensación de
            órbita real, no representan una magnitud física. */}
        {ringCount > 0
          ? Array.from(new Set([...laidOut.values()].filter((n) => !n.isCenter).map((n) => Math.round(n.radius)))).map(
              (r) => (
                <circle
                  key={`ring-${r}`}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  style={{
                    stroke: "color-mix(in srgb, var(--primary) 6%, transparent)",
                    strokeWidth: 1,
                  }}
                />
              ),
            )
          : null}

        {/* Conexiones — cada partícula/nodo orbitante hacia su destino,
            debajo de los nodos. */}
        <g>
          {edges.map((edge, i) => {
            const from = laidOut.get(edge.fromNodeId);
            const to = laidOut.get(edge.toNodeId);
            if (!from || !to) return null;
            const isActive =
              activeHoverId === edge.fromNodeId ||
              activeHoverId === edge.toNodeId ||
              selectedNodeId === edge.fromNodeId ||
              selectedNodeId === edge.toNodeId ||
              highlightSet.has(edge.fromNodeId) ||
              highlightSet.has(edge.toNodeId);
            const weight = edge.weight ?? 0.5;
            const strokeWidth = 1 + Math.max(0, Math.min(1, weight)) * 2;
            // Punto de llegada real: por defecto el centro del nodo destino
            // (to.x, to.y). Si el edge trae `toPoint`, se apunta en cambio a
            // una posición específica DENTRO del nodo destino (ej. la
            // Partícula exacta dibujada dentro de su círculo de IUM), usando
            // el mismo radio que ese nodo tiene en este layout (central o
            // orbitante) para que el punto caiga sobre el dibujo real.
            let toX = to.x;
            let toY = to.y;
            if (edge.toPoint) {
              const nodeRadius = to.isCenter ? centerR : orbitNodeR;
              const dist = nodeRadius * edge.toPoint.radiusRatio;
              toX = to.x + Math.cos(edge.toPoint.angle) * dist;
              toY = to.y + Math.sin(edge.toPoint.angle) * dist;
            }
            // Durante "scattered" las líneas nacen invisibles para que la
            // conexión se sienta como un hilo que "tira" de la partícula
            // hacia el centro, no como un elemento que aparece de golpe.
            const lineOpacity = (phase === "scattered" ? 0 : 1) * (isActive ? 1 : activeHoverId || selectedNodeId ? 0.3 : 0.85);
            return (
              <line
                key={`${edge.fromNodeId}-${edge.toNodeId}-${i}`}
                x1={from.x}
                y1={from.y}
                x2={toX}
                y2={toY}
                strokeWidth={strokeWidth}
                style={{
                  stroke: isActive
                    ? "color-mix(in srgb, var(--primary) 65%, transparent)"
                    : "color-mix(in srgb, var(--primary) 18%, transparent)",
                  opacity: lineOpacity,
                  transition: "stroke 150ms ease, opacity 380ms ease",
                }}
              />
            );
          })}
        </g>

        {/* Nodos orbitantes */}
        <g>
          {[...laidOut.values()]
            .filter((n) => !n.isCenter)
            .map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isHovered = activeHoverId === node.id;
              const isHighlighted = highlightSet.has(node.id);
              const emphasized = isSelected || isHovered || isHighlighted;
              const dim = Boolean(activeHoverId || selectedNodeId) && !emphasized;
              const toneBorder = emphasized
                ? "color-mix(in srgb, var(--primary) 60%, transparent)"
                : "color-mix(in srgb, var(--primary) 16%, transparent)";
              // Posición animada: en "scattered" el nodo se dibuja más
              // lejos de su radio final, y converge suavemente vía CSS
              // transition al pasar a "converging"/"stable".
              const animRadius = node.radius * (phase === "scattered" ? scatterScale : 1);
              const nx = cx + Math.cos(node.angle) * animRadius;
              const ny = cy + Math.sin(node.angle) * animRadius;
              const r = orbitNodeR;
              return (
                <g
                  key={node.id}
                  transform={`translate(${nx}, ${ny})`}
                  onMouseEnter={() => handleEnter(node.id)}
                  onMouseLeave={handleLeave}
                  onClick={() => handleClick(node.id)}
                  style={{
                    cursor: "pointer",
                    opacity: orbitOpacity * (dim ? 0.3 : 1),
                    transition: transitionAll,
                  }}
                >
                  {!node.hideBorder && (
                    <circle
                      r={r}
                      strokeWidth={isSelected ? 2 : 1.25}
                      style={{ fill: "var(--bg-main)", stroke: toneBorder, transition: "stroke 150ms ease" }}
                    />
                  )}
                  {node.visual ? (
                    node.hideBorder ? (
                      // Sin borde: el foreignObject aprovecha todo el radio
                      // orbital (sin el margen de 6px que antes dejaba lugar
                      // al trazo del círculo), así el gráfico interno se ve
                      // más grande.
                      <foreignObject x={-r} y={-r} width={r * 2} height={r * 2}>
                        <div className="flex h-full w-full items-center justify-center">{node.visual}</div>
                      </foreignObject>
                    ) : (
                      <foreignObject x={-r + 6} y={-r + 6} width={(r - 6) * 2} height={(r - 6) * 2}>
                        <div className="flex h-full w-full items-center justify-center">{node.visual}</div>
                      </foreignObject>
                    )
                  ) : null}
                  <text
                    y={r + 15}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={900}
                    style={{ fill: "color-mix(in srgb, var(--primary) 82%, transparent)" }}
                  >
                    {node.label.length > 16 ? <title>{node.label}</title> : null}
                    {node.label.length > 16 ? `${node.label.slice(0, 15)}…` : node.label}
                  </text>
                  {node.sublabel ? (
                    <text
                      y={r + 29}
                      textAnchor="middle"
                      fontSize={9.5}
                      style={{ fill: "color-mix(in srgb, var(--primary) 38%, transparent)" }}
                    >
                      {node.sublabel.length > 20 ? <title>{node.sublabel}</title> : null}
                      {node.sublabel.length > 20 ? `${node.sublabel.slice(0, 19)}…` : node.sublabel}
                    </text>
                  ) : null}
                </g>
              );
            })}
        </g>

        {/* Centro de gravedad — el nodo hacia el que todo converge (IUM,
            Oris, capa o Elemento, según quién llame). Emerge después de
            que los orbitantes convergen (fases "forming"/"emerging"),
            con una pequeña expansión visual, no una explosión. */}
        {[...laidOut.values()]
          .filter((n) => n.isCenter)
          .map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isHovered = activeHoverId === node.id;
            const isHighlighted = highlightSet.has(node.id);
            const emphasized = isSelected || isHovered || isHighlighted;
            const scale = centerScale * (phase === "emerging" ? 1.08 : 1);
            return (
              <g
                key={node.id}
                transform={`translate(${cx}, ${cy}) scale(${scale})`}
                onMouseEnter={() => handleEnter(node.id)}
                onMouseLeave={handleLeave}
                onClick={() => handleClick(node.id)}
                style={{
                  cursor: "pointer",
                  opacity: centerOpacity,
                  transformOrigin: "center",
                  transition:
                    "transform 220ms cubic-bezier(0.34, 1.2, 0.64, 1), opacity 200ms ease",
                }}
              >
                {!node.hideBorder && (
                  <circle
                    r={centerR}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    style={{
                      fill: "color-mix(in srgb, var(--primary) 5%, transparent)",
                      stroke: emphasized ? "var(--primary)" : "color-mix(in srgb, var(--primary) 45%, transparent)",
                      transition: "stroke 150ms ease",
                    }}
                  />
                )}
                {node.visual ? (
                  node.hideBorder ? (
                    // Sin borde: aprovecha todo el centerR (antes se
                    // recortaba 8px de margen para dejar lugar al trazo).
                    <foreignObject x={-centerR} y={-centerR} width={centerR * 2} height={centerR * 2}>
                      <div className="flex h-full w-full items-center justify-center">{node.visual}</div>
                    </foreignObject>
                  ) : (
                    <foreignObject x={-centerR + 8} y={-centerR + 8} width={(centerR - 8) * 2} height={(centerR - 8) * 2}>
                      <div className="flex h-full w-full items-center justify-center">{node.visual}</div>
                    </foreignObject>
                  )
                ) : null}
                <text
                  y={centerR + 18}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={900}
                  style={{ fill: "color-mix(in srgb, var(--primary) 90%, transparent)" }}
                >
                  {node.label.length > 20 ? <title>{node.label}</title> : null}
                  {node.label.length > 20 ? `${node.label.slice(0, 19)}…` : node.label}
                </text>
                {node.sublabel ? (
                  <text
                    y={centerR + 33}
                    textAnchor="middle"
                    fontSize={10.5}
                    style={{ fill: "color-mix(in srgb, var(--primary) 42%, transparent)" }}
                  >
                    {node.sublabel.length > 24 ? <title>{node.sublabel}</title> : null}
                    {node.sublabel.length > 24 ? `${node.sublabel.slice(0, 23)}…` : node.sublabel}
                  </text>
                ) : null}
              </g>
            );
          })}
      </svg>
    </div>
  );
}
