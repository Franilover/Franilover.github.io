"use client";

/**
 * GrafoRelaciones.tsx
 * ─────────────────────
 * Modal con visualización D3 del grafo de relaciones de un personaje.
 * Carga de datos en useGrafoRelaciones / lib/utils/grafoRelaciones.
 * Lectura de tema en hooks/ui/useCSSVar.
 *
 * Ruta: src/features/editorGarlia/components/personajes/GrafoRelaciones.tsx
 */

import * as d3 from "d3";
import { X, Loader2, GitFork, UserCircle2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { useGrafoRelaciones } from "@/domains/garlia/relaciones/useGrafoRelaciones";
import { useCSSVar } from "@/hooks/ui/useCSSVar";
import { esFamilia, TIPOS_FAM_ARRIBA } from "@/lib/utils/grafoRelaciones";
import type {
  DatosGrafo,
  EnlaceRelacion,
  NodoPersonaje,
} from "@/lib/utils/grafoRelaciones";

// ─── Grafo D3 ─────────────────────────────────────────────────────────────────

function GrafoD3({
  datos,
  centroId,
  width,
  height,
}: {
  datos: DatosGrafo;
  centroId: string;
  width: number;
  height: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const primary = useCSSVar("--primary");
  const bgMain = useCSSVar("--bg-main");
  const accent = useCSSVar("--accent");

  useEffect(() => {
    if (!svgRef.current || !datos.nodos.length || !primary) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const W = width;
    const H = height;
    const cx = W / 2;
    const cy = H / 2;

    const familiaNodos = datos.enlaces
      .filter((e: EnlaceRelacion) => esFamilia(e.tipo))
      .map((e: EnlaceRelacion) => e.target);

    const posiciones: Record<string, { x: number; y: number; fixed: boolean }> =
      {};
    posiciones[centroId] = { x: cx, y: cy, fixed: true };

    const enlacesFam = datos.enlaces.filter((e: EnlaceRelacion) =>
      esFamilia(e.tipo),
    );
    const enlacesLib = datos.enlaces.filter(
      (e: EnlaceRelacion) => !esFamilia(e.tipo),
    );

    const famArriba = enlacesFam
      .filter((e: EnlaceRelacion) =>
        TIPOS_FAM_ARRIBA.includes(e.tipo.toLowerCase()),
      )
      .map((e: EnlaceRelacion) => e.target);
    const famAbajo = enlacesFam
      .filter(
        (e: EnlaceRelacion) => !TIPOS_FAM_ARRIBA.includes(e.tipo.toLowerCase()),
      )
      .map((e: EnlaceRelacion) => e.target);

    famArriba.forEach((id: string, i: number) => {
      const total = famArriba.length;
      const x = cx + (i - (total - 1) / 2) * 110;
      posiciones[id] = { x, y: cy - 130, fixed: true };
    });
    famAbajo.forEach((id: string, i: number) => {
      const total = famAbajo.length;
      const x = cx + (i - (total - 1) / 2) * 110;
      posiciones[id] = { x, y: cy + 130, fixed: true };
    });

    const libresIds = enlacesLib
      .map((e: EnlaceRelacion) => e.target)
      .filter((id: string) => !familiaNodos.includes(id));
    const radioLibre = Math.min(W, H) * 0.36;
    libresIds.forEach((id: string, i: number) => {
      const total = libresIds.length;
      const angleStart = -Math.PI / 3;
      const angleRange = (4 * Math.PI) / 3;
      const angle = angleStart + (i / Math.max(total - 1, 1)) * angleRange;
      posiciones[id] = {
        x: cx + radioLibre * Math.cos(angle),
        y: cy + radioLibre * Math.sin(angle) * 0.7,
        fixed: false,
      };
    });

    datos.nodos.forEach((n: NodoPersonaje) => {
      if (!posiciones[n.id]) {
        posiciones[n.id] = {
          x: cx + Math.random() * 80 - 40,
          y: cy + Math.random() * 80 - 40,
          fixed: false,
        };
      }
    });

    const nodes = datos.nodos.map((n: NodoPersonaje) => ({
      ...n,
      x: posiciones[n.id]?.x ?? cx,
      y: posiciones[n.id]?.y ?? cy,
      fx: posiciones[n.id]?.fixed ? posiciones[n.id].x : undefined,
      fy: posiciones[n.id]?.fixed ? posiciones[n.id].y : undefined,
    })) as any[];

    const links = datos.enlaces.map((e: EnlaceRelacion) => ({ ...e })) as any[];

    const sim = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance((d) => (esFamilia((d as any).tipo) ? 135 : 150))
          .strength(0.8),
      )
      .force("charge", d3.forceManyBody().strength(-220))
      .force("collision", d3.forceCollide(50))
      .force("center", d3.forceCenter(cx, cy).strength(0.04));

    nodes.forEach((n) => {
      if (posiciones[n.id]?.fixed) {
        n.fx = posiciones[n.id].x;
        n.fy = posiciones[n.id].y;
      }
    });

    const g = svg.append("g");
    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.4, 2.5])
        .on("zoom", (event) => g.attr("transform", event.transform)),
    );

    // ── Definiciones: gradiente, filtros, clip-paths ──────────────────────────
    const defs = svg.append("defs");

    const gradFam = defs
      .append("linearGradient")
      .attr("id", "grad-fam")
      .attr("gradientUnits", "userSpaceOnUse");
    gradFam
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", primary)
      .attr("stop-opacity", 0.5);
    gradFam
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", primary)
      .attr("stop-opacity", 0.2);

    const gradLib = defs
      .append("linearGradient")
      .attr("id", "grad-lib")
      .attr("gradientUnits", "userSpaceOnUse");
    gradLib
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", accent || primary)
      .attr("stop-opacity", 0.4);
    gradLib
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", accent || primary)
      .attr("stop-opacity", 0.15);

    defs
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 28)
      .attr("refY", 0)
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L8,0L0,4")
      .attr("fill", primary)
      .attr("opacity", 0.35);

    datos.nodos.forEach((n: NodoPersonaje) => {
      defs
        .append("clipPath")
        .attr("id", `clip-${n.id}`)
        .append("circle")
        .attr("r", n.esCentro ? 26 : 18);
    });

    // ── Líneas ────────────────────────────────────────────────────────────────
    const linkG = g.append("g").attr("class", "links");

    const linkEl = linkG
      .selectAll("g.link")
      .data(links)
      .join("g")
      .attr("class", "link");

    const linea = linkEl
      .append("line")
      .attr("stroke-width", (d) => (esFamilia(d.tipo) ? 1.5 : 1))
      .attr("stroke", (d) => (esFamilia(d.tipo) ? primary : accent || primary))
      .attr("stroke-opacity", (d) => (esFamilia(d.tipo) ? 0.4 : 0.25))
      .attr("stroke-dasharray", (d) => (esFamilia(d.tipo) ? "none" : "4 3"))
      .attr("marker-end", "url(#arrow)");

    const labelLinea = linkEl
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", -5)
      .attr("font-size", 7)
      .attr("font-weight", "800")
      .attr("letter-spacing", "0.08em")
      .attr("text-transform", "uppercase")
      .attr("fill", primary)
      .attr("fill-opacity", 0.45)
      .attr("pointer-events", "none")
      .text((d) => d.tipo.toUpperCase());

    // ── Nodos ─────────────────────────────────────────────────────────────────
    const nodeG = g.append("g").attr("class", "nodes");

    const nodoEl = nodeG
      .selectAll("g.nodo")
      .data(nodes)
      .join("g")
      .attr("class", "nodo")
      .style("cursor", "grab")
      .call(
        d3
          .drag<SVGGElement, any>()
          .on("start", (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            if (!posiciones[d.id]?.fixed) {
              d.fx = null;
              d.fy = null;
            }
          }) as unknown as (
          selection: d3.Selection<
            SVGGElement | d3.BaseType,
            any,
            SVGGElement,
            unknown
          >,
        ) => void,
      );

    nodoEl
      .append("circle")
      .attr("r", (d) => (d.esCentro ? 30 : 22))
      .attr("fill", primary)
      .attr("opacity", 0.08)
      .attr("transform", "translate(1, 2)");

    nodoEl
      .append("circle")
      .attr("r", (d) => (d.esCentro ? 28 : 20))
      .attr("fill", bgMain || "#fff")
      .attr("stroke", primary)
      .attr("stroke-width", (d) => (d.esCentro ? 2 : 1.2))
      .attr("stroke-opacity", (d) => (d.esCentro ? 0.7 : 0.3));

    nodoEl.each(function (d: any) {
      const el = d3.select(this);
      const r = d.esCentro ? 26 : 18;

      if (d.img_url) {
        el.append("image")
          .attr("href", d.img_url)
          .attr("x", -r)
          .attr("y", -r)
          .attr("width", r * 2)
          .attr("height", r * 2)
          .attr("clip-path", `url(#clip-${d.id})`)
          .attr("preserveAspectRatio", "xMidYMid slice");
      } else {
        const s = r * 0.55;
        el.append("circle")
          .attr("r", s * 0.45)
          .attr("cy", -s * 0.2)
          .attr("fill", primary)
          .attr("opacity", 0.2);
        el.append("path")
          .attr(
            "d",
            `M${-s * 0.7},${s * 0.6} Q${-s * 0.7},${s * 0.05} 0,${s * 0.05} Q${s * 0.7},${s * 0.05} ${s * 0.7},${s * 0.6}`,
          )
          .attr("fill", primary)
          .attr("opacity", 0.18);
      }
    });

    nodoEl
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => (d.esCentro ? 42 : 34))
      .attr("font-size", (d) => (d.esCentro ? 9 : 8))
      .attr("font-weight", "800")
      .attr("letter-spacing", "0.04em")
      .attr("fill", primary)
      .attr("fill-opacity", (d) => (d.esCentro ? 0.9 : 0.65))
      .text((d) =>
        d.nombre.length > 14 ? d.nombre.slice(0, 13) + "…" : d.nombre,
      );

    nodeG
      .selectAll("g.nodo")
      .filter((d: any) => d.esCentro)
      .append("circle")
      .attr("r", 4)
      .attr("fill", accent || primary)
      .attr("opacity", 0.8)
      .attr("transform", "translate(0, -28)");

    sim.on("tick", () => {
      linea
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      labelLinea
        .attr("x", (d) => (d.source.x + d.target.x) / 2)
        .attr("y", (d) => (d.source.y + d.target.y) / 2);

      nodoEl.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      sim.stop();
    };
  }, [datos, centroId, width, height, primary, bgMain, accent]);

  return (
    <svg ref={svgRef} className="w-full h-full" height={height} width={width} />
  );
}

// ─── Modal principal ──────────────────────────────────────────────────────────

export function GrafoRelaciones({
  personajeId,
  personajeNombre,
}: {
  personajeId: string;
  personajeNombre?: string;
}) {
  const { abierto, abrir, cerrar, datos, loading, contenedorRef, size } =
    useGrafoRelaciones(personajeId);

  return (
    <>
      <button
        className="w-5 h-5 flex items-center justify-center rounded text-primary/25 hover:text-primary hover:bg-primary/8 transition-all border border-transparent hover:border-primary/15"
        title="Ver árbol de relaciones"
        onClick={abrir}
      >
        <GitFork size={8} />
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-primary/10 backdrop-blur-sm"
          onClick={cerrar}
        >
          <div
            className="relative w-full max-w-3xl bg-bg-main rounded-2xl shadow-2xl border border-primary/15 flex flex-col overflow-hidden"
            style={{ height: "min(85vh, 600px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-primary/[0.06] bg-primary/[0.03]">
              <div className="flex items-center gap-2">
                <GitFork className="text-primary/40" size={11} />
                <span className="text-micro font-black uppercase tracking-widest text-primary/50">
                  Red de relaciones
                </span>
                {personajeNombre && (
                  <span className="text-micro font-black text-primary/30">
                    — {personajeNombre}
                  </span>
                )}
              </div>
              <button
                className="w-6 h-6 flex items-center justify-center rounded-lg text-primary/30 hover:text-primary hover:bg-primary/10 transition-all"
                onClick={cerrar}
              >
                <X size={12} />
              </button>
            </div>

            <div className="shrink-0 flex items-center gap-4 px-4 py-1.5 border-b border-primary/[0.04]">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-px bg-primary/40" />
                <span className="text-micro font-black uppercase tracking-widest text-primary/35">
                  Familia
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-px border-t border-dashed border-primary/30" />
                <span className="text-micro font-black uppercase tracking-widest text-primary/35">
                  Otros
                </span>
              </div>
              <div className="ml-auto flex items-center gap-1 text-micro text-primary/25 font-bold italic">
                Arrastrá los nodos · Scroll para zoom
              </div>
            </div>

            <div ref={contenedorRef} className="flex-1 min-h-0 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="animate-spin text-primary/20" size={18} />
                </div>
              ) : !datos || datos.nodos.length <= 1 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <UserCircle2 className="text-primary/15" size={28} />
                  <p className="text-micro font-bold text-primary/20 uppercase tracking-widest italic">
                    Sin relaciones para mostrar
                  </p>
                </div>
              ) : (
                <GrafoD3
                  centroId={personajeId}
                  datos={datos}
                  height={size.h}
                  width={size.w}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
