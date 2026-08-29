"use client";

/**
 * CompatibilidadNetwork.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Canvas propio de VIS-04 ("Mapa de Compatibilidad", documento maestro del
 * Visualizador, Parte 5) — deliberadamente NO reusa StructureCanvas.
 *
 * StructureCanvas (VIS-01/Alquimia/Química) dibuja una JERARQUÍA que
 * converge y EMERGE en un centro (partículas → IUM → Oris), con una
 * animación de construcción en fases. VIS-04 es otra cosa: una RED radial
 * de posibilidades alrededor de una entidad ya existente, sin jerarquía ni
 * emergencia — el docx (Parte 5, punto 1) es explícito: "no se busca que
 * parezca una tabla química tradicional, sino que se sienta como explorar
 * el espacio de relaciones posibles". Forzar esto dentro de StructureCanvas
 * (que asume "último nivel = 1 solo nodo que emerge") habría significado
 * pisar ese contrato o reescribirlo — más simple y más seguro tener un
 * layout dedicado.
 *
 * Reglas visuales del docx que este componente respeta explícitamente:
 *   - Punto 4 ("compatible"): línea protagonista — trazo sólido, opacidad
 *     alta, grosor mayor.
 *   - Punto 5 ("posible"): "la línea no debe parecer un enlace existente,
 *     la interfaz nunca debe confundir ambos estados" — trazo PUNTEADO,
 *     opacidad menor. Nunca el mismo trazo que "compatible".
 *   - Punto 6 ("incompatible"): "tratamiento minimalista, no se llena el
 *     mapa de líneas rojas" — no se dibuja línea en absoluto (el estado se
 *     ve en el color/opacidad tenue del propio nodo, no en un trazo).
 *   - Punto 2 ("la entidad seleccionada siempre domina"): el centro es
 *     visualmente mayor y con opacidad plena; lo no relacionado (acá:
 *     incompatible) queda muy atenuado.
 *   - Punto 22 ("solo ruta"): si soloRutaId está activo, todo lo que no es
 *     el centro, ese vecino o la línea entre ambos baja de opacidad.
 */

import React, { useMemo, useState } from "react";

import type { EstadoCompatibilidad, NodoCompatibilidad, VecinoCompatibilidad } from "./routes/useCompatibilidadRoute";

const CENTER_R = 46;
const NEIGHBOR_R = 30;
const PAD = 48;

export interface CompatibilidadNetworkProps {
  centro: NodoCompatibilidad;
  vecinos: VecinoCompatibilidad[];
  /** Visual ya resuelto por el llamador para cada nodo (ej. AtomoVisual) —
   *  este componente no sabe qué es un Elemento ni un Compuesto, solo
   *  posiciona lo que le dan, mismo principio que StructureCanvas. */
  renderVisual: (nodo: NodoCompatibilidad) => React.ReactNode;
  selectedNodeId?: string | null;
  onHoverNode?: (nodeId: string | null) => void;
  onSelectNode?: (nodeId: string) => void;
  /** Nodo(s) a resaltar externamente (ej. desde el historial) sin hover. */
  highlightedNodeIds?: string[];
  /** Si está seteado, atenúa todo lo que no sea el centro, este vecino o
   *  la línea entre ambos (docx punto 22, "solo ruta"). */
  soloRutaHaciaId?: string | null;
  className?: string;
}

const ESTADO_ESTILO: Record<
  EstadoCompatibilidad,
  { nodeOpacity: number; lineOpacity: number; lineDash?: string; lineWidthActive: number }
> = {
  // Punto 4: protagonista — trazo sólido, opacidad alta.
  compatible: { nodeOpacity: 1, lineOpacity: 0.75, lineWidthActive: 2.5 },
  // Punto 5: menor intensidad, punteado — nunca confundible con un enlace real.
  posible: { nodeOpacity: 0.75, lineOpacity: 0.35, lineDash: "3 5", lineWidthActive: 1.5 },
  // Punto 6: minimalista — sin línea, nodo bien atenuado.
  incompatible: { nodeOpacity: 0.32, lineOpacity: 0, lineWidthActive: 0 },
};

export function CompatibilidadNetwork({
  centro,
  vecinos,
  renderVisual,
  selectedNodeId = null,
  onHoverNode,
  onSelectNode,
  highlightedNodeIds = [],
  soloRutaHaciaId = null,
  className,
}: CompatibilidadNetworkProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const activeHoverId = hoverId;

  const size = 620;
  const cx = size / 2;
  const cy = size / 2;
  const ringR = size / 2 - PAD - NEIGHBOR_R;

  const laidOut = useMemo(() => {
    return vecinos.map((v, i) => {
      const angle = (i / Math.max(1, vecinos.length)) * Math.PI * 2 - Math.PI / 2;
      return {
        vecino: v,
        angle,
        x: cx + Math.cos(angle) * ringR,
        y: cy + Math.sin(angle) * ringR,
      };
    });
  }, [vecinos, cx, cy, ringR]);

  const highlightSet = new Set(highlightedNodeIds);

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
    <div className={`w-full ${className ?? ""}`} style={{ aspectRatio: "1 / 1", maxWidth: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        className="block"
        role="img"
        aria-label="Mapa de compatibilidad"
      >
        {/* Anillo de referencia — igual criterio sutil que el resto del
            Visualizador (StructureCanvas usa el mismo tono al 6%). */}
        <circle
          cx={cx}
          cy={cy}
          r={ringR}
          fill="none"
          style={{ stroke: "color-mix(in srgb, var(--primary) 6%, transparent)", strokeWidth: 1 }}
        />

        {/* Líneas — solo para compatible/posible (punto 6: incompatible no
            dibuja línea). Se dibujan antes que los nodos para quedar debajo. */}
        <g>
          {laidOut.map(({ vecino, x, y }) => {
            const estilo = ESTADO_ESTILO[vecino.estado];
            if (estilo.lineOpacity === 0) return null;
            const isHovered = activeHoverId === vecino.nodo.nodeId;
            const isSelected = selectedNodeId === vecino.nodo.nodeId;
            const isHighlighted = highlightSet.has(vecino.nodo.nodeId);
            const emphasized = isHovered || isSelected || isHighlighted;

            // "Solo ruta" (punto 22): si hay un destino fijado y esta línea
            // no es la que va hacia él, se atenúa fuerte.
            const enSoloRuta = !soloRutaHaciaId || soloRutaHaciaId === vecino.nodo.nodeId;

            return (
              <line
                key={vecino.nodo.nodeId}
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                strokeDasharray={estilo.lineDash}
                strokeWidth={emphasized ? estilo.lineWidthActive : Math.max(1, estilo.lineWidthActive - 1)}
                style={{
                  stroke: "color-mix(in srgb, var(--primary) 70%, transparent)",
                  opacity: (emphasized ? estilo.lineOpacity + 0.2 : estilo.lineOpacity) * (enSoloRuta ? 1 : 0.12),
                  transition: "stroke-width 150ms ease, opacity 300ms ease",
                }}
              />
            );
          })}
        </g>

        {/* Vecinos */}
        <g>
          {laidOut.map(({ vecino, x, y }) => {
            const estilo = ESTADO_ESTILO[vecino.estado];
            const isHovered = activeHoverId === vecino.nodo.nodeId;
            const isSelected = selectedNodeId === vecino.nodo.nodeId;
            const isHighlighted = highlightSet.has(vecino.nodo.nodeId);
            const emphasized = isHovered || isSelected || isHighlighted;
            const enSoloRuta = !soloRutaHaciaId || soloRutaHaciaId === vecino.nodo.nodeId;
            const r = NEIGHBOR_R * (emphasized ? 1.08 : 1);
            return (
              <g
                key={vecino.nodo.nodeId}
                transform={`translate(${x}, ${y})`}
                onMouseEnter={() => handleEnter(vecino.nodo.nodeId)}
                onMouseLeave={handleLeave}
                onClick={() => handleClick(vecino.nodo.nodeId)}
                style={{
                  cursor: "pointer",
                  opacity: estilo.nodeOpacity * (emphasized ? 1 : 0.92) * (enSoloRuta ? 1 : 0.18),
                  transition: "opacity 300ms ease, transform 180ms ease",
                }}
              >
                <circle
                  r={r}
                  strokeWidth={isSelected ? 2.25 : 1.25}
                  style={{
                    fill: "var(--bg-main)",
                    stroke: emphasized
                      ? "var(--primary)"
                      : "color-mix(in srgb, var(--primary) 30%, transparent)",
                    transition: "stroke 150ms ease",
                  }}
                />
                <foreignObject x={-r + 5} y={-r + 5} width={(r - 5) * 2} height={(r - 5) * 2}>
                  <div className="flex h-full w-full items-center justify-center">{renderVisual(vecino.nodo)}</div>
                </foreignObject>
                <text
                  y={r + 15}
                  textAnchor="middle"
                  fontSize={10.5}
                  fontWeight={900}
                  style={{ fill: "color-mix(in srgb, var(--primary) 82%, transparent)" }}
                >
                  {vecino.nodo.label.length > 15 ? <title>{vecino.nodo.label}</title> : null}
                  {vecino.nodo.label.length > 15 ? `${vecino.nodo.label.slice(0, 14)}…` : vecino.nodo.label}
                </text>
              </g>
            );
          })}
        </g>

        {/* Centro — siempre domina (punto 2), plena opacidad y mayor tamaño. */}
        <g
          transform={`translate(${cx}, ${cy})`}
          onMouseEnter={() => handleEnter(centro.nodeId)}
          onMouseLeave={handleLeave}
          style={{ cursor: "default" }}
        >
          <circle
            r={CENTER_R}
            strokeWidth={2}
            style={{
              fill: "color-mix(in srgb, var(--primary) 6%, transparent)",
              stroke: "var(--primary)",
            }}
          />
          <foreignObject x={-CENTER_R + 8} y={-CENTER_R + 8} width={(CENTER_R - 8) * 2} height={(CENTER_R - 8) * 2}>
            <div className="flex h-full w-full items-center justify-center">{renderVisual(centro)}</div>
          </foreignObject>
          <text
            y={CENTER_R + 18}
            textAnchor="middle"
            fontSize={13}
            fontWeight={900}
            style={{ fill: "color-mix(in srgb, var(--primary) 92%, transparent)" }}
          >
            {centro.label}
          </text>
          {centro.sublabel ? (
            <text
              y={CENTER_R + 33}
              textAnchor="middle"
              fontSize={10.5}
              style={{ fill: "color-mix(in srgb, var(--primary) 42%, transparent)" }}
            >
              {centro.sublabel}
            </text>
          ) : null}
        </g>
      </svg>
    </div>
  );
}
