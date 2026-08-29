"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Atom,
  BarChart3,
  ChevronRight,
  CircleDot,
  FlaskConical,
  Gauge,
  GitBranch,
  Layers3,
  Orbit,
  Radio,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";

// V2 — conectado a datos reales de Supabase. Cada sección lee de los
// hooks/tipos ya usados por el resto del sistema (fisica/useFisica,
// elementos/useCompuestos, materiales/useMateriales, etc.) en vez de
// fixtures locales. Las pocas piezas sin hook propio (particulas con
// ejes_fundamentales, runas, propiedades_derivadas) viven en
// useVisualizadorData.ts, mismo patrón useSupabaseData que todo lo demás.
// Nada de física/química se calcula acá: solo se lee y se presenta.

import {
  contarLetrasDeOris,
  particulasDeIum,
  particulasDeOris,
  type FilaIum,
} from "@/domains/garlia/fisica/types";
import { useOrisConIums } from "@/domains/garlia/fisica/useOrisConIums";
import { useIums, useParticulasBase } from "@/domains/garlia/fisica/useFisica";

import { useMateriales } from "@/domains/garlia/materiales/useMateriales";
import {
  PropiedadesFisicasGenerico,
  propiedadesCalculadasGenerico,
} from "@/domains/garlia/_shared/GridPropiedadesCalculadas";

import { useEstructuras } from "@/domains/garlia/elementos/useEstructuras";
import { useCompuestos } from "@/domains/garlia/elementos/useCompuestos";
import { useProcesos } from "@/domains/garlia/elementos/useProcesos";
import { propiedadesCalculadasDeCompuesto } from "@/domains/garlia/elementos/types";

import { RunaThumbnail } from "@/domains/garlia/runas/RunaThumbnail";

import {
  useParticulasCompletas,
  usePropiedadesDerivadas,
  useRunasCatalogo,
  useValoresDerivadosDeEntidad,
  type EntidadTipoDerivada,
  type ParticulaCompleta,
} from "./useVisualizadorData";

// ─── Vertical slice: lenguaje visual reutilizable + rutas Física/Alquimia ──
// Nueva sección "rutas" (no toca las 12 secciones existentes arriba).
import { StructureCanvas, type CanvasColumn, type CanvasEdge } from "./StructureCanvas";
import { Inspector, type InspectorEntity } from "./Inspector";
import { TraceView, type TraceStep } from "./TraceView";
import { PerspectivaSwitcher, type Perspectiva } from "./PerspectivaSwitcher";
import { useFisicaRoute } from "./routes/useFisicaRoute";
import { useAlquimiaRoute } from "./routes/useAlquimiaRoute";
import { ParticulaNodo, CentroGravedadNodo, ElementoNodo, contarLetrasNodo } from "./NodeVisuals";

type SectionKey =
  | "rutas"
  | "micro"
  | "ats"
  | "formula"
  | "material"
  | "structure"
  | "reactivity"
  | "energy"
  | "electric"
  | "information"
  | "oris"
  | "runas"
  | "process";

const navItems: { key: SectionKey; label: string; icon: React.ReactNode }[] = [
  { key: "rutas", label: "Rutas", icon: <GitBranch size={15} /> },
  { key: "micro", label: "Micro", icon: <Layers3 size={15} /> },
  { key: "ats", label: "ATS", icon: <Orbit size={15} /> },
  { key: "formula", label: "Fórmulas", icon: <Gauge size={15} /> },
  { key: "material", label: "Material", icon: <Atom size={15} /> },
  { key: "structure", label: "Estructura", icon: <GitBranch size={15} /> },
  { key: "reactivity", label: "Reactividad", icon: <FlaskConical size={15} /> },
  { key: "energy", label: "Energía", icon: <BarChart3 size={15} /> },
  { key: "electric", label: "Electricidad", icon: <Zap size={15} /> },
  { key: "information", label: "Información", icon: <Radio size={15} /> },
  { key: "oris", label: "Oris", icon: <Sparkles size={15} /> },
  { key: "runas", label: "Runas", icon: <CircleDot size={15} /> },
  { key: "process", label: "Proceso", icon: <Workflow size={15} /> },
];

// ─── UI primitives — pass de densidad: mismo lenguaje visual, más aire.
// Todos estos se reutilizan decenas de veces en las 13 secciones, así que
// ajustarlos acá sube la respiración de todo el visualizador de una vez,
// sin tener que tocar cada sección individualmente.

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary/50">
      {children}
    </span>
  );
}

function FlowNode({
  title,
  subtitle,
  tone = "default",
  onClick,
}: {
  title: string;
  subtitle?: string;
  tone?: "default" | "accent";
  onClick?: () => void;
}) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`min-w-[128px] rounded-xl border px-4 py-4 text-left transition-colors ${
        tone === "accent" ? "border-primary/30" : "border-primary/10"
      } ${onClick ? "hover:border-primary/30 cursor-pointer" : ""}`}
    >
      <p className="text-sm font-black text-primary/80">{title}</p>
      {subtitle ? <p className="mt-1.5 text-[11px] leading-4 text-primary/40">{subtitle}</p> : null}
    </Comp>
  );
}

function Arrow() {
  return <ChevronRight className="shrink-0 text-primary/25" size={20} />;
}

function MiniBarChart({ values }: { values: { label: string; value: number }[] }) {
  return (
    <div className="space-y-4">
      {values.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-primary/45">
            <span>{item.label}</span>
            <span>{item.value.toFixed(2)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-primary/60"
              style={{ width: `${Math.max(0, Math.min(1, item.value)) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Barra centrada en cero para ejes que van de -N a +N (ejes_fundamentales
 *  de Partícula). A diferencia de MiniBarChart (0..1), acá el 0 es el
 *  centro visual y positivo/negativo van a cada lado. */
function BarraDivergente({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.max(-1, Math.min(1, value / max)) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-primary/45">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full">
        <div className="absolute left-1/2 top-0 h-full w-px bg-primary/20" />
        {pct >= 0 ? (
          <div
            className="absolute left-1/2 top-0 h-full rounded-r-full bg-primary/60"
            style={{ width: `${(pct / 1) * 50}%` }}
          />
        ) : (
          <div
            className="absolute right-1/2 top-0 h-full rounded-l-full bg-primary/60"
            style={{ width: `${(-pct / 1) * 50}%` }}
          />
        )}
      </div>
    </div>
  );
}

/** Selector horizontal de "chips" para elegir una entidad real de un
 *  catálogo — mismo patrón repetido en Material/Estructura/Reactividad/
 *  Oris/Runas/Proceso: evita reimplementar un <select> feo por sección y
 *  hace el visualizador tangiblemente más interactivo (clic para explorar). */
function ChipSelector<T>({
  items,
  active,
  getKey,
  getLabel,
  onSelect,
}: {
  items: T[];
  active: T | null;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  onSelect: (item: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const selected = active ? getKey(active) === getKey(item) : false;
        return (
          <button
            key={getKey(item)}
            type="button"
            onClick={() => onSelect(item)}
            className={`rounded-full border px-3.5 py-2 text-xs font-black transition-colors ${
              selected
                ? "border-primary/40 text-primary/90"
                : "border-primary/10 text-primary/50 hover:border-primary/25 hover:text-primary/75"
            }`}
          >
            {getLabel(item)}
          </button>
        );
      })}
    </div>
  );
}

function SelectDropdown<T>({
  items,
  active,
  getKey,
  getLabel,
  onSelect,
  placeholder = "Seleccioná un elemento…",
}: {
  items: T[];
  active: T | null;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  onSelect: (item: T) => void;
  placeholder?: string;
}) {
  return (
    <select
      value={active ? getKey(active) : ""}
      onChange={(e) => {
        const found = items.find((item) => getKey(item) === e.target.value);
        if (found) onSelect(found);
      }}
      className="w-full max-w-sm rounded-lg border border-primary/15 bg-transparent px-3.5 py-2.5 text-xs font-black text-primary/85 outline-none transition-colors hover:border-primary/30 focus:border-primary/40"
    >
      {!active ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {items.map((item) => (
        <option key={getKey(item)} value={getKey(item)} className="bg-[var(--bg-main)] text-primary">
          {getLabel(item)}
        </option>
      ))}
    </select>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-primary/10 p-5 text-xs font-bold text-primary/35">
      <span className="h-2 w-2 animate-pulse rounded-full bg-primary/40" />
      Cargando datos reales desde Supabase…
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-primary/15 p-5 text-xs leading-5 text-primary/40">
      {children}
    </div>
  );
}


// ─── Valores derivados reales: tarjeta reusable para Material/Estructura/Compuesto ──

function TarjetaValoresDerivados({
  tipo,
  entidadId,
  entidadNombre,
}: {
  tipo: EntidadTipoDerivada;
  entidadId: string | null;
  entidadNombre?: string;
}) {
  const { items, loading } = useValoresDerivadosDeEntidad(tipo, entidadId);

  if (!entidadId) return <EmptyRow>Selecciona una entidad para ver sus propiedades derivadas reales.</EmptyRow>;
  if (loading) return <LoadingRow />;
  if (items.length === 0)
    return (
      <EmptyRow>
        {entidadNombre ?? "Esta entidad"} no tiene valores calculados en valores_propiedades_derivadas todavía.
      </EmptyRow>
    );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((v) => (
        <div
          key={v.id}
          className="rounded-xl border border-primary/10 p-4"
          title={v.propiedad.descripcion ?? undefined}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary/35">{v.propiedad.nombre}</p>
            <span className="shrink-0 text-sm font-black tabular-nums text-primary/85">
              {Number.isFinite(v.valor) ? v.valor.toLocaleString("es-CL", { maximumFractionDigits: 4 }) : "—"}
            </span>
          </div>
          {v.propiedad.formula ? (
            <p className="mt-2.5 truncate text-xs font-bold text-primary/55" title={v.propiedad.formula}>
              {v.propiedad.formula}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ─── Sección "Rutas" — vertical slice: Física vs Alquimia ──────────────────
// Deliberadamente separada de VisualizadorPage: encapsula sus propios hooks
// de ruta (useFisicaRoute/useAlquimiaRoute) para no mezclar su estado con
// las 12 secciones existentes. No calcula nada — solo arma nodos/edges/trace
// a partir de lo que los hooks de ruta ya resolvieron.

function RutaFisicaCanvas({
  route,
  hoverId,
  setHoverId,
  selectedNodeId,
  onSelectNode,
}: {
  route: ReturnType<typeof useFisicaRoute>;
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}) {
  const {
    oris,
    orisSel,
    setOrisSelId,
    iumPorId,
    particulasDelOrisSel,
    iumSel,
    setIumSelId,
    particulasDelIumSel,
  } = route;

  // Zoom: click en un nodo IUM entra al nivel Ium → Partículas propias del
  // Ium (particulasDelIumSel, ya resuelto por el hook, sin recalcular
  // nada). "iumSel" viene del mismo hook — reutiliza su propio estado en
  // vez de duplicar un id de zoom acá.
  const enZoomIum = Boolean(iumSel);

  const columns: CanvasColumn[] = useMemo(() => {
    if (enZoomIum && iumSel) {
      // Vista con zoom: Partículas del Ium (nivel 1) → Ium (nivel 2).
      const particulaNodesZoom = particulasDelIumSel.map((p, i) => ({
        id: `particula-ium-${i}`,
        label: p.nombre,
        sublabel: p.formula,
        visual: <ParticulaNodo formula={p.formula} size={40} />,
      }));
      const iumNodeZoom = {
        id: `ium-${iumSel.id}`,
        label: iumSel.nombre,
        sublabel: "Ium seleccionado",
        tone: "accent" as const,
        visual: <CentroGravedadNodo particulas={particulasDelIumSel} size={52} />,
      };
      return [
        { id: "particulas", label: "Partículas del Ium", nodes: particulaNodesZoom },
        { id: "ium", label: "IUM", nodes: [iumNodeZoom] },
      ];
    }
    if (!orisSel) return [];
    // Nivel 1: partículas reales expandidas del Oris, CONSERVANDO de qué
    // IUM viene cada una (antes se usaba particulasDelOrisSel, que aplana
    // todo en un array sin recordar el origen — por eso todas terminaban
    // conectadas al primer IUM). Se reconstruye acá mismo iterando
    // iums_composicion, igual que hace particulasDeOris internamente, pero
    // sin perder el iumId en el camino — mismo dato, sin agregar cálculo
    // nuevo de dominio.
    const particulaNodes: { id: string; label: string; sublabel: string; visual: React.ReactNode; iumId: string }[] = [];
    for (const [iumId, cantidadIum] of Object.entries(orisSel.iums_composicion)) {
      const ium = iumPorId[iumId];
      if (!ium || !cantidadIum) continue;
      const particulasDelIum = particulasDeIum(ium);
      for (let rep = 0; rep < cantidadIum; rep++) {
        for (const p of particulasDelIum) {
          particulaNodes.push({
            id: `particula-${iumId}-${particulaNodes.length}`,
            label: p.nombre,
            sublabel: p.formula,
            visual: <ParticulaNodo formula={p.formula} size={40} />,
            iumId,
          });
        }
      }
    }
    // Nivel 2: los IUMs reales que componen el Oris (desde iums_composicion).
    // Cada IUM se pinta con CentroGravedadNodo (núcleo ✦ + partículas
    // propias en anillo), forma propia del visualizador — no la reutiliza
    // de fisica/. particulasDeIum sigue siendo cálculo de datos, no visual,
    // así que se reusa tal cual: ya expande la composición real.
    const iumNodes = Object.entries(orisSel.iums_composicion)
      .filter(([, cantidad]) => cantidad > 0)
      .map(([iumId]) => {
        const ium = iumPorId[iumId];
        return {
          id: `ium-${iumId}`,
          label: ium?.nombre ?? "IUM",
          sublabel: `${orisSel.iums_composicion[iumId]}×`,
          visual: ium ? <CentroGravedadNodo particulas={particulasDeIum(ium)} size={44} /> : undefined,
        };
      });
    // Nivel 3: el Oris seleccionado — mismo tratamiento de centro de
    // gravedad que un IUM (un Oris es, en el modelo, una bolsa de IUMs que
    // a su vez son bolsas de partículas), con sus partículas ya expandidas.
    const orisNode = {
      id: `oris-${orisSel.id}`,
      label: orisSel.nombre,
      sublabel: orisSel.dominio,
      tone: "accent" as const,
      // Subido de 56 → 68: el Oris es el centro de gravedad "final" de la
      // ruta física (IUM → Oris) y debe leerse claramente como el nodo
      // más importante del canvas, más grande que los IUM (44) que orbitan
      // alrededor de él. 68 aprovecha el nuevo CENTER_R=40 del canvas
      // (diámetro útil ~64px tras el padding interno) sin recortarse.
      visual: <CentroGravedadNodo particulas={particulasDelOrisSel} size={68} />,
    };
    return [
      { id: "particulas", label: "Partículas (A/T/S)", nodes: particulaNodes },
      { id: "iums", label: "IUM", nodes: iumNodes },
      { id: "oris", label: "Oris", nodes: [orisNode] },
    ];
  }, [enZoomIum, iumSel, particulasDelIumSel, orisSel, iumPorId, particulasDelOrisSel]);

  const edges: CanvasEdge[] = useMemo(() => {
    if (enZoomIum && iumSel) {
      // Cada partícula del Ium se conecta al Ium — trazabilidad real 1:1,
      // a diferencia de la vista de conjunto (donde particulasDeOris no
      // trae mapeo partícula→IUM individual).
      return particulasDelIumSel.map((_, i) => ({
        fromNodeId: `particula-ium-${i}`,
        toNodeId: `ium-${iumSel.id}`,
        weight: 0.5,
      }));
    }
    if (!orisSel) return [];
    const out: CanvasEdge[] = [];
    const iumIds = Object.keys(orisSel.iums_composicion).filter((id) => orisSel.iums_composicion[id] > 0);
    // Cada IUM se conecta al nodo Oris.
    for (const iumId of iumIds) {
      out.push({ fromNodeId: `ium-${iumId}`, toNodeId: `oris-${orisSel.id}`, weight: 0.6 });
    }
    // Cada partícula se conecta a SU propio IUM real — antes todas se
    // conectaban al primer IUM disponible (particulasDeOris no traía el
    // mapeo), dejando sin líneas a cualquier otro IUM del Oris. El id de
    // cada nodo de partícula ahora es `particula-{iumId}-{n}`, así que el
    // IUM de origen se lee directamente del id sin recalcular nada.
    columns
      .find((c) => c.id === "particulas")
      ?.nodes.forEach((n) => {
        const sinPrefijo = n.id.slice("particula-".length);
        const iumId = sinPrefijo.slice(0, sinPrefijo.lastIndexOf("-"));
        if (iumId) out.push({ fromNodeId: n.id, toNodeId: `ium-${iumId}`, weight: 0.25 });
      });
    return out;
  }, [enZoomIum, iumSel, particulasDelIumSel, orisSel, columns]);

  // Click en un nodo: si es un IUM de la vista de conjunto, hace zoom.
  // Si no, delega al manejo normal (partícula/Oris) del padre.
  function handleSelectNode(nodeId: string) {
    if (!enZoomIum && nodeId.startsWith("ium-")) {
      setIumSelId(nodeId.slice("ium-".length));
      return;
    }
    onSelectNode(nodeId);
  }

  return (
    <>
      {route.loading ? <LoadingRow /> : route.empty ? <EmptyRow>No hay Oris cargados en Supabase todavía.</EmptyRow> : null}
      {!route.loading && oris.length > 0 ? (
        <>
          {enZoomIum ? (
            <button
              type="button"
              onClick={() => setIumSelId(null)}
              className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/15 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary/60 hover:border-primary/30 hover:text-primary/85"
            >
              <ChevronRight className="rotate-180" size={12} />
              Volver a {orisSel?.nombre ?? "Oris"}
            </button>
          ) : (
            <ChipSelector
              items={oris}
              active={orisSel}
              getKey={(o) => o.id}
              getLabel={(o) => o.nombre}
              onSelect={(o) => {
                setOrisSelId(o.id);
                setIumSelId(null);
              }}
            />
          )}
          <div className="mt-5 rounded-2xl p-5">
            <StructureCanvas
              columns={columns}
              edges={edges}
              selectedNodeId={
                enZoomIum
                  ? (iumSel ? `ium-${iumSel.id}` : null)
                  : (selectedNodeId ?? (orisSel ? `oris-${orisSel.id}` : null))
              }
              onHoverNode={setHoverId}
              onSelectNode={handleSelectNode}
              highlightedNodeIds={hoverId ? [hoverId] : []}
            />
          </div>
        </>
      ) : null}
    </>
  );
}

function RutaAlquimiaCanvas({
  route,
  hoverId,
  setHoverId,
  selectedNodeId,
  onSelectNode,
}: {
  route: ReturnType<typeof useAlquimiaRoute>;
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}) {
  const { elementos, elementoSel, setElementoSelId, capas, capaSel, setCapaSel, particulasDeCapaSel } = route;

  const columns: CanvasColumn[] = useMemo(() => {
    if (!elementoSel) return [];
    if (capaSel) {
      // Vista con zoom: Partículas de la capa (nivel 1) → esa capa (nivel 2),
      // mismo patrón que la vista con zoom de Física (Partículas del Ium → Ium).
      const particulaNodesZoom = particulasDeCapaSel.map((p, i) => ({
        id: `particula-${capaSel}-${i}`,
        label: p.nombre,
        sublabel: p.formula,
        visual: <ParticulaNodo formula={p.formula} size={40} />,
      }));
      const capaZoomLabel = capas.find((c) => c.capa === capaSel)?.label ?? capaSel;
      const capaNodeZoom = {
        id: `capa-${capaSel}`,
        label: capaZoomLabel,
        sublabel: "Capa seleccionada",
        tone: "accent" as const,
        // Una capa individual en zoom cumple el mismo rol de "centro" que
        // un IUM en zoom (punto 2 del docx aplicado por consistencia): sus
        // propias partículas son lo que la compone.
        visual: <CentroGravedadNodo particulas={particulasDeCapaSel} size={52} />,
      };
      return [
        { id: "particulas", label: "Partícula química", nodes: particulaNodesZoom },
        { id: "capa", label: "Capa", nodes: [capaNodeZoom] },
      ];
    }
    const capaNodes = capas.map((c) => ({
      id: `capa-${c.capa}`,
      label: c.label,
      sublabel: c.total > 0 ? c.resumen : "vacía",
      tone: "default" as const,
    }));
    const elementoNode = {
      id: `elemento-${elementoSel.id}`,
      label: elementoSel.nombre,
      sublabel: elementoSel.simbolo,
      tone: "accent" as const,
      // Punto 9 del docx: la composición microscópica (totales reales por
      // capa, ya calculados por el hook — layerTotal) alimenta la forma.
      // Sin inventar reparto: una capa con total 0 no ocupa gajo.
      visual: <ElementoNodo capas={capas.map((c) => ({ capa: c.capa, total: c.total }))} size={64} />,
    };
    return [
      { id: "capas", label: "Capa", nodes: capaNodes },
      { id: "elemento", label: "Elemento", nodes: [elementoNode] },
    ];
  }, [elementoSel, capas, capaSel, particulasDeCapaSel]);

  const edges: CanvasEdge[] = useMemo(() => {
    if (!elementoSel) return [];
    if (capaSel) {
      // Cada partícula de la capa se conecta a esa capa — trazabilidad 1:1.
      return particulasDeCapaSel.map((_, i) => ({
        fromNodeId: `particula-${capaSel}-${i}`,
        toNodeId: `capa-${capaSel}`,
        weight: 0.5,
      }));
    }
    const out: CanvasEdge[] = [];
    for (const c of capas) {
      if (c.total > 0) {
        out.push({ fromNodeId: `capa-${c.capa}`, toNodeId: `elemento-${elementoSel.id}`, weight: 0.6 });
      }
    }
    return out;
  }, [elementoSel, capas, capaSel, particulasDeCapaSel]);

  // Click en un nodo: si es una capa de la vista de conjunto, hace zoom
  // (selecciona esa capa, mismo estado capaSel que ya manejaba el hook).
  // Si no, delega al manejo normal (partícula/Elemento) del padre.
  function handleSelectNode(nodeId: string) {
    if (nodeId.startsWith("capa-")) {
      const capa = nodeId.slice("capa-".length) as typeof capaSel;
      const capaData = capas.find((c) => c.capa === capa);
      if (!capaData || capaData.total === 0) return;
      setCapaSel(capaSel === capa ? null : capa);
      return;
    }
    onSelectNode(nodeId);
  }

  return (
    <>
      {route.loading ? <LoadingRow /> : route.empty ? <EmptyRow>No hay Elementos cargados en Supabase todavía.</EmptyRow> : null}
      {!route.loading && elementos.length > 0 ? (
        <>
          <ChipSelector
            items={elementos}
            active={elementoSel}
            getKey={(e) => e.id}
            getLabel={(e) => `${e.simbolo} · ${e.nombre}`}
            onSelect={(e) => {
              setElementoSelId(e.id);
              setCapaSel(null);
            }}
          />
          {capaSel ? (
            <button
              type="button"
              onClick={() => setCapaSel(null)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/15 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary/60 hover:border-primary/30 hover:text-primary/85"
            >
              <ChevronRight className="rotate-180" size={12} />
              Volver a {elementoSel?.nombre ?? "Elemento"}
            </button>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {capas.map((c) => (
                <button
                  key={c.capa}
                  type="button"
                  onClick={() => setCapaSel(c.capa)}
                  disabled={c.total === 0}
                  className={`rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors ${
                    c.total === 0
                      ? "cursor-not-allowed border-primary/5 text-primary/25"
                      : "border-primary/10 text-primary/45 hover:border-primary/25"
                  }`}
                >
                  {c.label} · {c.total > 0 ? c.resumen : "vacía"}
                </button>
              ))}
            </div>
          )}
          <div className="mt-5 rounded-2xl p-5">
            <StructureCanvas
              columns={columns}
              edges={edges}
              selectedNodeId={
                capaSel
                  ? `capa-${capaSel}`
                  : (selectedNodeId ?? (elementoSel ? `elemento-${elementoSel.id}` : null))
              }
              onHoverNode={setHoverId}
              onSelectNode={handleSelectNode}
              highlightedNodeIds={hoverId ? [hoverId] : []}
            />
          </div>
        </>
      ) : null}
    </>
  );
}

function RutasSection() {
  const [perspectiva, setPerspectiva] = useState<Perspectiva>("fisica");
  const [hoverId, setHoverId] = useState<string | null>(null);
  // Nodo fijado por click dentro del canvas — distinto del Oris/Elemento
  // elegido en el ChipSelector. Se limpia al cambiar de contexto (Oris,
  // Elemento, capa o perspectiva) para no dejar seleccionado un nodo que
  // ya no existe en el canvas nuevo.
  const [nodoSelId, setNodoSelId] = useState<string | null>(null);

  const fisicaRoute = useFisicaRoute();
  const alquimiaRoute = useAlquimiaRoute();

  useEffect(() => {
    setNodoSelId(null);
  }, [
    perspectiva,
    fisicaRoute.orisSel?.id,
    fisicaRoute.iumSel?.id,
    alquimiaRoute.elementoSel?.id,
    alquimiaRoute.capaSel,
  ]);

  // Partícula clickeada dentro del canvas activo, si el nodo seleccionado
  // es de nivel "partícula" — usa las mismas listas ya expandidas por el
  // hook de ruta (particulasDelOrisSel / particulasDelIumSel en zoom /
  // particulasDeCapaSel), sin volver a consultar nada.
  const particulaClickeada = useMemo(() => {
    if (!nodoSelId || !nodoSelId.startsWith("particula-")) return null;
    if (perspectiva === "fisica") {
      if (nodoSelId.startsWith("particula-ium-")) {
        const idx = Number(nodoSelId.slice("particula-ium-".length));
        return fisicaRoute.particulasDelIumSel[idx] ?? null;
      }
      // Formato vista de conjunto: `particula-{iumId}-{i}` — el índice es
      // siempre lo que sigue al ÚLTIMO guión, igual que en Alquimia más
      // abajo (antes asumía que todo tras "particula-" era el índice, lo
      // cual dejó de ser cierto al incluir el iumId real en el id).
      const idx = Number(nodoSelId.slice(nodoSelId.lastIndexOf("-") + 1));
      return fisicaRoute.particulasDelOrisSel[idx] ?? null;
    }
    // Formato alquimia: `particula-${capa}-${i}`
    const idx = Number(nodoSelId.slice(nodoSelId.lastIndexOf("-") + 1));
    return alquimiaRoute.particulasDeCapaSel[idx] ?? null;
  }, [nodoSelId, perspectiva, fisicaRoute.particulasDelOrisSel, fisicaRoute.particulasDelIumSel, alquimiaRoute.particulasDeCapaSel]);

  // Inspector: solo presentacional — el shape se arma acá a partir de datos
  // ya resueltos por el hook de ruta activo, sin calcular nada nuevo.
  // Si hay una partícula clickeada, tiene prioridad: es la única entidad
  // cuya A/T/S es geometría relevante para el usuario en este momento
  // (sección "A/T/S es información contextual, no geometría principal").
  const inspectorEntity: InspectorEntity | null = useMemo(() => {
    if (particulaClickeada) {
      const letras = contarLetrasNodo(particulaClickeada.formula);
      return {
        eyebrow: "Partícula",
        title: particulaClickeada.nombre,
        subtitle: particulaClickeada.formula,
        visual: <ParticulaNodo formula={particulaClickeada.formula} size={40} />,
        fields: [
          { label: "A (antítesis)", value: letras.A },
          { label: "T (tesis)", value: letras.T },
          { label: "S (síntesis)", value: letras.S },
        ],
      };
    }
    if (perspectiva === "fisica") {
      // IUM en zoom tiene prioridad sobre el Oris de fondo: es la entidad
      // que el usuario efectivamente clickeó y quiere inspeccionar. Antes
      // el click en un IUM nunca llegaba acá (ver handleSelectNode en
      // RutaFisicaCanvas) y el Inspector seguía mostrando el Oris.
      const ium = fisicaRoute.iumSel;
      if (ium) {
        return {
          eyebrow: "IUM",
          title: ium.nombre,
          subtitle: `${fisicaRoute.particulasDelIumSel.length} partícula(s)`,
          visual: <CentroGravedadNodo particulas={fisicaRoute.particulasDelIumSel} size={40} />,
          fields: [
            { label: "A", value: fisicaRoute.letrasIumSel.A },
            { label: "T", value: fisicaRoute.letrasIumSel.T },
            { label: "S", value: fisicaRoute.letrasIumSel.S },
          ],
        };
      }
      const o = fisicaRoute.orisSel;
      if (!o) return null;
      return {
        eyebrow: "Oris",
        title: o.nombre,
        subtitle: `${o.familia} · ${o.dominio}`,
        note: o.descripcion ?? null,
        // Mismo criterio que en el canvas: el Oris se dibuja más grande
        // que el IUM (que queda en 40, arriba) para que el Inspector
        // refleje la misma jerarquía visual.
        visual: <CentroGravedadNodo particulas={fisicaRoute.particulasDelOrisSel} size={52} />,
        fields: [
          { label: "Fórmula", value: o.formula },
          { label: "A", value: fisicaRoute.letrasOrisSel.A },
          { label: "T", value: fisicaRoute.letrasOrisSel.T },
          { label: "S", value: fisicaRoute.letrasOrisSel.S },
          { label: "IUMs distintos", value: Object.keys(o.iums_composicion).length },
        ],
      };
    }
    // Capa en zoom tiene prioridad sobre el Elemento de fondo, mismo
    // criterio que IUM sobre Oris en Física: es la entidad que el usuario
    // efectivamente clickeó. Antes el click en una capa nunca llegaba acá
    // (ver handleSelectNode en RutaAlquimiaCanvas) y el Inspector seguía
    // mostrando el Elemento.
    const capa = alquimiaRoute.capaSel;
    if (capa) {
      const capaData = alquimiaRoute.capas.find((c) => c.capa === capa);
      return {
        eyebrow: "Capa",
        title: capaData?.label ?? capa,
        subtitle: alquimiaRoute.elementoSel?.nombre,
        fields: [
          { label: "Partículas", value: alquimiaRoute.particulasDeCapaSel.length },
          { label: "Composición", value: capaData?.resumen ?? "—" },
        ],
      };
    }
    const e = alquimiaRoute.elementoSel;
    if (!e) return null;
    return {
      eyebrow: "Elemento",
      title: `${e.simbolo} · ${e.nombre}`,
      subtitle: e.familia,
      note: e.notas ?? null,
      visual: <ElementoNodo capas={alquimiaRoute.capas.map((c) => ({ capa: c.capa, total: c.total }))} size={40} />,
      fields: [
        { label: "N° atómico", value: e.numero_atomico },
        { label: "Núcleo", value: alquimiaRoute.capas.find((c) => c.capa === "nucleo")?.resumen },
        { label: "Media", value: alquimiaRoute.capas.find((c) => c.capa === "media")?.resumen },
        { label: "Externa", value: alquimiaRoute.capas.find((c) => c.capa === "externa")?.resumen },
        { label: "Es noble", value: e.es_noble ? "Sí" : "No" },
      ],
    };
  }, [particulaClickeada, perspectiva, fisicaRoute, alquimiaRoute]);

  // Trace: ruta ya resuelta, en el mismo orden que el modelo real — nunca
  // fusiona Física y Alquimia en una sola secuencia. Si hay una partícula
  // clickeada (o un Ium en zoom), el Trace la refleja en vez de asumir
  // siempre la primera — para no mostrarle al usuario una procedencia
  // distinta de lo que ve seleccionado en el canvas/Inspector.
  const traceSteps: TraceStep[] = useMemo(() => {
    if (perspectiva === "fisica") {
      const o = fisicaRoute.orisSel;
      const ium = fisicaRoute.iumSel;
      const particulaTrace =
        particulaClickeada ??
        (ium ? fisicaRoute.particulasDelIumSel[0] : fisicaRoute.particulasDelOrisSel[0]) ??
        null;
      const iumTrace =
        ium ??
        (o
          ? (() => {
              const primerIumId = Object.keys(o.iums_composicion)[0];
              return primerIumId ? fisicaRoute.iumPorId[primerIumId] : null;
            })()
          : null);
      return [
        {
          id: "t-particula",
          levelLabel: "Partícula (A/T/S)",
          title: particulaTrace?.nombre ?? null,
          subtitle: particulaTrace?.formula ?? undefined,
        },
        {
          id: "t-ium",
          levelLabel: "IUM",
          title: iumTrace?.nombre ?? null,
        },
        { id: "t-oris", levelLabel: "Oris", title: o?.nombre ?? null, subtitle: o?.dominio ?? undefined },
      ];
    }
    const e = alquimiaRoute.elementoSel;
    const capaSel = alquimiaRoute.capaSel;
    const capaConDatos = capaSel
      ? alquimiaRoute.capas.find((c) => c.capa === capaSel)
      : alquimiaRoute.capas.find((c) => c.total > 0);
    const particulaTrace = particulaClickeada ?? alquimiaRoute.particulasDeCapaSel[0] ?? null;
    return [
      {
        id: "t-particula",
        levelLabel: "Partícula química",
        title: particulaTrace?.nombre ?? (capaConDatos && !particulaTrace ? capaConDatos.resumen.split(" ")[0] ?? null : null),
        subtitle: particulaTrace?.formula ?? undefined,
      },
      { id: "t-capa", levelLabel: "Capa", title: capaConDatos?.label ?? null },
      { id: "t-elemento", levelLabel: "Elemento", title: e ? `${e.simbolo} · ${e.nombre}` : null },
    ];
  }, [perspectiva, fisicaRoute, alquimiaRoute, particulaClickeada]);

  return (
    <>
      <PerspectivaSwitcher value={perspectiva} onChange={setPerspectiva} />

      <div className="mt-8 grid gap-5 lg:grid-cols-[2.2fr_1fr]">
        <div>
          {perspectiva === "fisica" ? (
            <RutaFisicaCanvas
              route={fisicaRoute}
              hoverId={hoverId}
              setHoverId={setHoverId}
              selectedNodeId={nodoSelId}
              onSelectNode={setNodoSelId}
            />
          ) : (
            <RutaAlquimiaCanvas
              route={alquimiaRoute}
              hoverId={hoverId}
              setHoverId={setHoverId}
              selectedNodeId={nodoSelId}
              onSelectNode={setNodoSelId}
            />
          )}
        </div>

        <div className="space-y-4">
          <Inspector entity={inspectorEntity} emptyLabel="Seleccioná un Oris o un Elemento para inspeccionarlo." />
          <div className="rounded-2xl p-5">
            <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-primary/40">Trace</p>
            <TraceView steps={traceSteps} />
          </div>
        </div>
      </div>
    </>
  );
}

function VisualizadorPage() {
  const [active, setActive] = useState<SectionKey>("rutas");

  // ─── Fuentes de datos reales ────────────────────────────────────────────
  const { items: particulasBase } = useParticulasBase();
  const { items: particulas, loading: loadingParticulas } = useParticulasCompletas();
  const { items: iums } = useIums();
  const { items: oris, loading: loadingOris } = useOrisConIums();
  const { items: materiales, loading: loadingMateriales } = useMateriales();
  const { items: estructuras, loading: loadingEstructuras } = useEstructuras();
  const { items: compuestos, loading: loadingCompuestos } = useCompuestos();
  const { items: procesos, loading: loadingProcesos } = useProcesos();
  const { items: runas, loading: loadingRunas } = useRunasCatalogo();
  const { items: propiedadesDerivadas, loading: loadingPropiedadesDerivadas } = usePropiedadesDerivadas();

  const iumPorId = useMemo(() => {
    const mapa: Record<string, FilaIum> = {};
    for (const i of iums) {
      mapa[i.id] = {
        id: i.id,
        nombre: i.nombre,
        detalle: i.detalle,
        extra: i.extra ?? undefined,
        composicion: i.composicion,
      };
    }
    return mapa;
  }, [iums]);

  // ─── Selecciones activas por sección ────────────────────────────────────
  const [particulaSel, setParticulaSel] = useState<ParticulaCompleta | null>(null);
  const [orisSel, setOrisSel] = useState<(typeof oris)[number] | null>(null);
  const [materialSel, setMaterialSel] = useState<(typeof materiales)[number] | null>(null);
  const [estructuraSel, setEstructuraSel] = useState<(typeof estructuras)[number] | null>(null);
  const [compuestoSel, setCompuestoSel] = useState<(typeof compuestos)[number] | null>(null);
  const [procesoSel, setProcesoSel] = useState<(typeof procesos)[number] | null>(null);
  const [runaSel, setRunaSel] = useState<(typeof runas)[number] | null>(null);

  useEffect(() => {
    if (!particulaSel && particulas.length > 0) setParticulaSel(particulas[0]);
  }, [particulas, particulaSel]);
  useEffect(() => {
    if (!orisSel && oris.length > 0) setOrisSel(oris[0]);
  }, [oris, orisSel]);
  useEffect(() => {
    if (!materialSel && materiales.length > 0) setMaterialSel(materiales[0]);
  }, [materiales, materialSel]);
  useEffect(() => {
    if (!estructuraSel && estructuras.length > 0) setEstructuraSel(estructuras[0]);
  }, [estructuras, estructuraSel]);
  useEffect(() => {
    if (!compuestoSel && compuestos.length > 0) setCompuestoSel(compuestos[0]);
  }, [compuestos, compuestoSel]);
  useEffect(() => {
    if (!procesoSel && procesos.length > 0) setProcesoSel(procesos[0]);
  }, [procesos, procesoSel]);
  useEffect(() => {
    if (!runaSel && runas.length > 0) setRunaSel(runas[0]);
  }, [runas, runaSel]);

  // Fórmula seleccionada en la sección "Fórmulas" — calculadora interactiva
  const densidad = useMemo(
    () => propiedadesDerivadas.find((p) => p.clave === "densidad") ?? null,
    [propiedadesDerivadas],
  );
  const [mass, setMass] = useState(12);
  const [volume, setVolume] = useState(0.004);
  const densidadCalculada = useMemo(() => (volume > 0 ? mass / volume : 0), [mass, volume]);
  const [propiedadFormulaSel, setPropiedadFormulaSel] = useState<(typeof propiedadesDerivadas)[number] | null>(null);

  const oriSelLetras = useMemo(() => {
    if (!orisSel) return { A: 0, T: 0, S: 0 };
    return contarLetrasDeOris(orisSel.iums_composicion, iumPorId);
  }, [orisSel, iumPorId]);

  const oriSelParticulas = useMemo(() => {
    if (!orisSel) return [];
    return particulasDeOris(orisSel.iums_composicion, iumPorId);
  }, [orisSel, iumPorId]);

  const materialPropiedades = useMemo(
    () => (materialSel ? propiedadesCalculadasGenerico(materialSel.propiedades_calculadas) : []),
    [materialSel],
  );

  const compuestoPropiedades = useMemo(
    () => (compuestoSel ? propiedadesCalculadasDeCompuesto(compuestoSel) : []),
    [compuestoSel],
  );

  return (
    <main className="min-h-screen bg-[var(--bg-main)] text-primary">
      <div className="w-full py-8">

        <div className="grid gap-2 lg:grid-cols-[150px_minmax(0,1fr)]">
          <aside className="p-0 lg:sticky lg:top-6 lg:self-start">
            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const selected = item.key === active;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActive(item.key)}
                    className={`flex w-full items-center gap-2 py-2 text-left text-xs transition-colors ${selected ? "font-black text-primary/90" : "font-medium text-primary/45 hover:text-primary/70"}`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="min-w-0">
            {active === "rutas" ? <RutasSection /> : null}

            {active === "micro" ? (
              <>
                <div className="overflow-x-auto rounded-2xl p-5">
                  <div className="flex min-w-[820px] items-center gap-2">
                    <FlowNode title="Partículas Base" subtitle={`${particulasBase.length} · A / T / S`} />
                    <Arrow />
                    <FlowNode title="Partículas" subtitle={`${particulas.length} combinaciones`} />
                    <Arrow />
                    <FlowNode title="IUMs" subtitle={`${iums.length} configuraciones`} />
                    <Arrow />
                    <FlowNode title="Oris" subtitle={`${oris.length} sistemas funcionales`} tone="accent" />
                    <Arrow />
                    <FlowNode title="Éterium" subtitle="acoplamiento mágico" />
                  </div>
                </div>

                <div className="mt-8 grid gap-7 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-2xl p-7">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-primary/80">Elige un Oris</p>
                        <p className="text-[10px] text-primary/35">Composición real de IUMs y partículas</p>
                      </div>
                      <StatusPill>{oris.length} Oris</StatusPill>
                    </div>
                    {loadingOris ? (
                      <LoadingRow />
                    ) : (
                      <ChipSelector
                        items={oris}
                        active={orisSel}
                        getKey={(o) => o.id}
                        getLabel={(o) => o.nombre}
                        onSelect={setOrisSel}
                      />
                    )}

                    {orisSel ? (
                      <div className="mt-4 rounded-xl border border-primary/10 p-4">
                        <p className="text-xs font-black text-primary/80">{orisSel.nombre}</p>
                        <p className="mt-1 text-[11px] text-primary/45">
                          {orisSel.dominio} · {orisSel.familia} · {orisSel.formula}
                        </p>
                        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                          {(["A", "T", "S"] as const).map((letra) => (
                            <div key={letra} className="rounded-lg border border-primary/10 p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-primary/35">{letra}</p>
                              <p className="mt-1 text-lg font-black text-primary/75">{oriSelLetras[letra]}</p>
                            </div>
                          ))}
                        </div>
                        {oriSelParticulas.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {oriSelParticulas.map((p, i) => (
                              <span
                                key={`${p.nombre}-${i}`}
                                className="rounded-full border border-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary/55"
                              >
                                {p.nombre} · {p.formula}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">Procedencia</p>
                    <div className="mt-5 space-y-2.5 text-xs">
                      {[
                        "Partícula Base (letra A/T/S)",
                        "Partícula (fórmula de 3 letras)",
                        "IUM (composición de partículas)",
                        "Oris (composición de IUMs)",
                      ].map((item, index) => (
                        <div key={item} className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black text-primary/50">
                            {index + 1}
                          </span>
                          <span className="font-bold text-primary/55">{item}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-[11px] leading-5 text-primary/40">
                      Cadena calculada en vivo con las mismas funciones (contarLetrasDeOris, particulasDeOris) que usa
                      el editor de Física — nada se recalcula distinto acá.
                    </p>
                  </div>
                </div>
              </>
            ) : null}

            {active === "ats" ? (
              <>
                <div className="grid gap-7 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-2xl p-7">
                    {loadingParticulas ? (
                      <LoadingRow />
                    ) : (
                      <ChipSelector
                        items={particulas}
                        active={particulaSel}
                        getKey={(p) => p.id}
                        getLabel={(p) => p.nombre}
                        onSelect={setParticulaSel}
                      />
                    )}
                    {particulaSel ? (
                      <div className="mx-auto mt-5 flex max-w-xs flex-col items-center">
                        <div className="rounded-full border border-primary/15 px-8 py-5 text-center">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary/35">Partícula</p>
                          <p className="mt-1 text-2xl font-black text-primary/85">{particulaSel.nombre}</p>
                          <p className="mt-1 text-xs font-bold text-primary/40">{particulaSel.formula}</p>
                        </div>
                        <div className="my-3 h-8 border-l border-dashed border-primary/20" />
                        <div className="grid w-full grid-cols-3 gap-3 text-center">
                          {(["A", "T", "S"] as const).map((letra) => {
                            const count = particulaSel.formula.split("").filter((c) => c === letra).length;
                            return (
                              <div key={letra} className="rounded-xl border border-primary/10 p-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary/35">{letra}</p>
                                <p className="mt-1 text-lg font-black text-primary/75">{count}</p>
                              </div>
                            );
                          })}
                        </div>
                        {particulaSel.vector_neto !== null && particulaSel.vector_neto !== undefined ? (
                          <p className="mt-3 text-[11px] font-bold text-primary/40">
                            Vector neto: <span className="text-primary/70">{particulaSel.vector_neto}</span>
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">Ejes fundamentales</p>
                    <p className="text-[10px] text-primary/35">Valores reales de particulas.ejes_fundamentales</p>
                    {particulaSel?.ejes_fundamentales ? (
                      <div className="mt-4 space-y-4">
                        {(
                          [
                            ["dinamica", "Dinámica"],
                            ["coherencia", "Coherencia"],
                            ["estabilidad", "Estabilidad"],
                            ["informacion", "Información"],
                            ["interaccion", "Interacción"],
                            ["transformacion", "Transformación"],
                          ] as const
                        ).map(([clave, label]) => {
                          const valores = particulas
                            .map((p) => p.ejes_fundamentales?.[clave])
                            .filter((v): v is number => typeof v === "number");
                          const max = Math.max(1, ...valores.map((v) => Math.abs(v)));
                          const v = particulaSel.ejes_fundamentales?.[clave] ?? 0;
                          return <BarraDivergente key={clave} label={label} value={v} max={max} />;
                        })}
                      </div>
                    ) : (
                      <EmptyRow>Sin ejes fundamentales para esta partícula.</EmptyRow>
                    )}
                  </div>
                </div>
              </>
            ) : null}

            {active === "formula" ? (
              <>
                <div className="grid gap-7 lg:grid-cols-2">
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">Densidad</p>
                    <p className="mt-1 text-[10px] text-primary/35">
                      Calculadora interactiva usando la fórmula real: {densidad?.formula ?? "rho=M/V"}
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <label className="rounded-xl border border-primary/10 p-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/35">Masa</span>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            aria-label="Masa"
                            type="number"
                            value={mass}
                            onChange={(e) => setMass(Number(e.target.value))}
                            className="w-full rounded-lg border border-primary/10 bg-transparent px-3 py-2 text-sm font-black text-primary/80 outline-none"
                          />
                          <span className="text-xs font-bold text-primary/35">kg</span>
                        </div>
                      </label>
                      <label className="rounded-xl border border-primary/10 p-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/35">Volumen</span>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            aria-label="Volumen"
                            type="number"
                            step="0.001"
                            value={volume}
                            onChange={(e) => setVolume(Number(e.target.value))}
                            className="w-full rounded-lg border border-primary/10 bg-transparent px-3 py-2 text-sm font-black text-primary/80 outline-none"
                          />
                          <span className="text-xs font-bold text-primary/35">m³</span>
                        </div>
                      </label>
                    </div>
                    <div className="mt-8 rounded-2xl p-6 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/35">Resultado</p>
                      <p className="mt-2 text-3xl font-black tabular-nums text-primary/85">
                        {Number.isFinite(densidadCalculada) ? densidadCalculada.toLocaleString("es-CL") : "—"}
                      </p>
                      <p className="mt-1 text-xs font-bold text-primary/40">kg/m³</p>
                      <p className="mt-3 text-lg font-black text-primary/75">{densidad?.formula ?? "rho=M/V"}</p>
                      {densidad?.dependencias ? (
                        <p className="mt-1 text-[10px] font-bold text-primary/35">Dependencias: {densidad.dependencias}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl p-7">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-primary/80">Catálogo real</p>
                      <StatusPill>{propiedadesDerivadas.length} propiedades</StatusPill>
                    </div>
                    {loadingPropiedadesDerivadas ? (
                      <LoadingRow />
                    ) : (
                      <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                        {propiedadesDerivadas.map((p) => {
                          const selected = propiedadFormulaSel?.id === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setPropiedadFormulaSel(selected ? null : p)}
                              className={`w-full rounded-xl border p-3 text-left transition-colors ${selected ? "border-primary/30" : "border-primary/10 hover:border-primary/20"}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-black text-primary/80">{p.nombre}</p>
                                {p.tipo_valor ? <StatusPill>{p.tipo_valor}</StatusPill> : null}
                              </div>
                              {p.formula ? <p className="mt-1 truncate text-[11px] font-bold text-primary/50">{p.formula}</p> : null}
                              {selected && p.dependencias ? (
                                <p className="mt-2 text-[10px] leading-4 text-primary/40">Depende de: {p.dependencias}</p>
                              ) : null}
                              {selected && p.descripcion ? (
                                <p className="mt-1 text-[10px] leading-4 text-primary/40">{p.descripcion}</p>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}

            {active === "material" ? (
              <>
                {loadingMateriales ? (
                  <LoadingRow />
                ) : (
                  <SelectDropdown
                    items={materiales}
                    active={materialSel}
                    getKey={(m) => m.id}
                    getLabel={(m) => m.nombre}
                    onSelect={setMaterialSel}
                    placeholder="Seleccioná un material…"
                  />
                )}
                <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_0.8fr]">
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">
                      Perfil físico {materialSel ? `· ${materialSel.nombre}` : ""}
                    </p>
                    <div className="mt-5">
                      {materialPropiedades.length > 0 ? (
                        <PropiedadesFisicasGenerico propiedades={materialSel?.propiedades_calculadas} columnas={2} />
                      ) : (
                        <EmptyRow>Sin propiedades calculadas todavía para este material.</EmptyRow>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">Metadatos</p>
                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                      <StatusPill>{materialSel?.tipo_material ?? "—"}</StatusPill>
                      <StatusPill>{materialSel?.estado_calculo ?? "sin calcular"}</StatusPill>
                      {materialSel?.propiedades_calculadas?.fuente_fisica ? (
                        <StatusPill>{String(materialSel.propiedades_calculadas.fuente_fisica)}</StatusPill>
                      ) : null}
                    </div>
                    {materialSel?.descripcion ? (
                      <p className="mt-4 text-xs leading-5 text-primary/45">{materialSel.descripcion}</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-8 rounded-2xl p-7">
                  <p className="text-xs font-black text-primary/80">Valores derivados reales</p>
                  <p className="mt-1 text-[10px] text-primary/35">valores_propiedades_derivadas para este material</p>
                  <div className="mt-4">
                    <TarjetaValoresDerivados tipo="material" entidadId={materialSel?.id ?? null} entidadNombre={materialSel?.nombre} />
                  </div>
                </div>
              </>
            ) : null}

            {active === "structure" ? (
              <>
                {loadingEstructuras ? (
                  <LoadingRow />
                ) : (
                  <SelectDropdown
                    items={estructuras}
                    active={estructuraSel}
                    getKey={(e) => e.id}
                    getLabel={(e) => e.nombre}
                    onSelect={setEstructuraSel}
                    placeholder="Seleccioná una estructura…"
                  />
                )}
                <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_0.8fr]">
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">
                      Propiedades {estructuraSel ? `· ${estructuraSel.nombre}` : ""}
                    </p>
                    <div className="mt-5">
                      {estructuraSel?.propiedades_calculadas ? (
                        <PropiedadesFisicasGenerico propiedades={estructuraSel.propiedades_calculadas} columnas={2} />
                      ) : (
                        <EmptyRow>Sin propiedades calculadas todavía para esta estructura.</EmptyRow>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">Función</p>
                    <div className="mt-3 space-y-2">
                      <StatusPill>{estructuraSel?.tipo ?? "sin tipo"}</StatusPill>
                    </div>
                    {estructuraSel?.funcion ? (
                      <p className="mt-4 text-xs leading-5 text-primary/45">{estructuraSel.funcion}</p>
                    ) : null}
                    {estructuraSel?.descripcion ? (
                      <p className="mt-3 text-xs leading-5 text-primary/40">{estructuraSel.descripcion}</p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-8 rounded-2xl p-7">
                  <p className="text-xs font-black text-primary/80">Valores derivados reales</p>
                  <div className="mt-4">
                    <TarjetaValoresDerivados
                      tipo="estructura"
                      entidadId={estructuraSel?.id ?? null}
                      entidadNombre={estructuraSel?.nombre}
                    />
                  </div>
                </div>
              </>
            ) : null}

            {active === "reactivity" ? (
              <>
                {loadingCompuestos ? (
                  <LoadingRow />
                ) : (
                  <SelectDropdown
                    items={compuestos}
                    active={compuestoSel}
                    getKey={(c) => c.id}
                    getLabel={(c) => c.nombre}
                    onSelect={setCompuestoSel}
                    placeholder="Seleccioná un compuesto…"
                  />
                )}
                <div className="mt-8 grid gap-7 lg:grid-cols-2">
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">
                      Perfil reactivo {compuestoSel ? `· ${compuestoSel.nombre}` : ""}
                    </p>
                    <div className="mt-5">
                      {compuestoPropiedades.filter((p) => p.proporcion !== undefined).length > 0 ? (
                        <MiniBarChart
                          values={compuestoPropiedades
                            .filter((p) => p.proporcion !== undefined)
                            .map((p) => ({ label: p.label, value: p.proporcion ?? 0 }))}
                        />
                      ) : (
                        <EmptyRow>Sin índices reactivos calculados todavía.</EmptyRow>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">Ficha</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {compuestoSel?.tipo_compuesto ? <StatusPill>{compuestoSel.tipo_compuesto}</StatusPill> : null}
                      {compuestoSel?.clasificacion ? <StatusPill>{compuestoSel.clasificacion}</StatusPill> : null}
                      {compuestoSel?.estado ? <StatusPill>{compuestoSel.estado}</StatusPill> : null}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
                      {compuestoPropiedades
                        .filter((p) => p.valor !== null && p.proporcion === undefined)
                        .slice(0, 6)
                        .map((p) => (
                          <div key={p.clave} className="rounded-lg border border-primary/10 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/35">{p.label}</p>
                            <p className="mt-1 font-black text-primary/75">{p.valor}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
                <div className="mt-8 rounded-2xl p-7">
                  <p className="text-xs font-black text-primary/80">Valores derivados reales</p>
                  <div className="mt-4">
                    <TarjetaValoresDerivados tipo="compuesto" entidadId={compuestoSel?.id ?? null} entidadNombre={compuestoSel?.nombre} />
                  </div>
                </div>
              </>
            ) : null}

            {active === "energy" ? (
              <>
                {loadingCompuestos ? (
                  <LoadingRow />
                ) : (
                  <div className="rounded-2xl p-5">
                    <MiniBarChart
                      values={compuestos
                        .filter((c) => typeof c.energia_enlace === "number")
                        .slice(0, 8)
                        .map((c) => ({
                          label: c.nombre,
                          value: Math.max(0, Math.min(1, (c.energia_enlace ?? 0) / 5)),
                        }))}
                    />
                  </div>
                )}
                <div className="mt-8 rounded-2xl p-6 text-xs leading-5 text-primary/45">
                  Barra normalizada a un techo visual de 5 solo para comparar proporciones — el valor real de{" "}
                  <span className="font-black text-primary/60">energia_enlace</span> no está acotado a [0,1]; usa la
                  ficha del compuesto en la pestaña Química para el número exacto.
                </div>
              </>
            ) : null}

            {active === "electric" ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {compuestos
                    .filter((c) => typeof c.carga === "number" && c.carga !== 0)
                    .slice(0, 8)
                    .map((c) => (
                      <FlowNode
                        key={c.id}
                        title={c.nombre}
                        subtitle={`carga ${c.carga}`}
                        tone={(c.carga ?? 0) > 0 ? "accent" : "default"}
                      />
                    ))}
                </div>
                {compuestos.filter((c) => typeof c.carga === "number" && c.carga !== 0).length === 0 ? (
                  <EmptyRow>Ningún compuesto cargado tiene carga distinta de cero todavía.</EmptyRow>
                ) : null}
              </>
            ) : null}

            {active === "information" ? (
              <>
                <div className="flex flex-wrap items-center gap-2 overflow-x-auto rounded-2xl p-7">
                  <FlowNode title="Fuente" subtitle="mensaje + intensidad" />
                  <Arrow />
                  <FlowNode title="Propagación" subtitle="distancia" />
                  <Arrow />
                  <FlowNode title="Receptor" subtitle="intensidad · fidelidad" tone="accent" />
                </div>
                <div className="mt-8 rounded-2xl p-6 text-xs leading-5 text-primary/45">
                  Diagrama conceptual — a diferencia de las otras 11 secciones, no hay una tabla "información"/"señal" en
                  Supabase todavía. No se inventan valores numéricos acá.
                </div>
              </>
            ) : null}

            {active === "oris" ? (
              <>
                {loadingOris ? (
                  <LoadingRow />
                ) : (
                  <ChipSelector
                    items={oris}
                    active={orisSel}
                    getKey={(o) => o.id}
                    getLabel={(o) => o.nombre}
                    onSelect={setOrisSel}
                  />
                )}
                <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_0.9fr]">
                  <div className="overflow-x-auto rounded-2xl p-7">
                    <div className="flex min-w-[620px] items-center gap-2">
                      <FlowNode title="Partículas" subtitle="A/T/S" />
                      <Arrow />
                      <FlowNode
                        title="IUMs"
                        subtitle={orisSel ? `${Object.keys(orisSel.iums_composicion).length} usados` : undefined}
                      />
                      <Arrow />
                      <FlowNode title={orisSel?.nombre ?? "Oris"} subtitle={orisSel?.dominio} tone="accent" />
                      <Arrow />
                      <FlowNode title="Éterium" subtitle={orisSel?.familia} />
                    </div>
                  </div>
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">Equilibrio A/T/S</p>
                    <div className="mt-5">
                      <MiniBarChart
                        values={(["A", "T", "S"] as const).map((letra) => ({
                          label: letra,
                          value:
                            oriSelLetras.A + oriSelLetras.T + oriSelLetras.S > 0
                              ? oriSelLetras[letra] / (oriSelLetras.A + oriSelLetras.T + oriSelLetras.S)
                              : 0,
                        }))}
                      />
                    </div>
                    {orisSel?.formula ? <p className="mt-4 text-xs font-black text-primary/70">{orisSel.formula}</p> : null}
                    {orisSel?.descripcion ? (
                      <p className="mt-2 text-[11px] leading-5 text-primary/40">{orisSel.descripcion}</p>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}

            {active === "runas" ? (
              <>
                {loadingRunas ? (
                  <LoadingRow />
                ) : (
                  <ChipSelector
                    items={runas}
                    active={runaSel}
                    getKey={(r) => r.id}
                    getLabel={(r) => r.nombre}
                    onSelect={setRunaSel}
                  />
                )}
                <div className="mt-8 grid gap-7 lg:grid-cols-[0.85fr_1.15fr]">
                  <div className="flex min-h-[260px] items-center justify-center rounded-2xl p-6">
                    {runaSel?.patron_trazos && runaSel.patron_trazos.length > 0 ? (
                      <div className="h-44 w-44">
                        <RunaThumbnail patronTrazos={runaSel.patron_trazos} />
                      </div>
                    ) : (
                      <EmptyRow>Esta runa no tiene patrón de trazos guardado todavía.</EmptyRow>
                    )}
                  </div>
                  <div className="rounded-2xl p-7">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-primary/80">{runaSel?.nombre ?? "Runa"}</p>
                      <StatusPill>{runaSel?.patron_trazos?.length ?? 0} trazos</StatusPill>
                    </div>
                    <div className="mt-5 space-y-3 text-xs text-primary/60">
                      <div className="rounded-xl border border-primary/10 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary/35">Explicación</p>
                        <p className="mt-1 leading-5">{runaSel?.explicacion || "Sin explicación registrada todavía."}</p>
                      </div>
                      {runaSel?.explicacion_por_rango && Object.keys(runaSel.explicacion_por_rango).length > 0 ? (
                        <div className="rounded-xl border border-primary/10 p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary/35">
                            Feedback progresivo por precisión
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {Object.entries(runaSel.explicacion_por_rango).map(([rango, texto]) => (
                              <p key={rango} className="text-[11px] leading-4">
                                <span className="font-black text-primary/70">{rango}%: </span>
                                {texto}
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {active === "process" ? (
              <>
                {loadingProcesos ? (
                  <LoadingRow />
                ) : (
                  <SelectDropdown
                    items={procesos}
                    active={procesoSel}
                    getKey={(p) => p.id}
                    getLabel={(p) => p.nombre}
                    onSelect={setProcesoSel}
                    placeholder="Seleccioná un proceso…"
                  />
                )}
                <div className="mt-8 overflow-x-auto rounded-2xl p-7">
                  <div className="flex min-w-[760px] items-center gap-2">
                    <FlowNode title="Entrada" subtitle={procesoSel?.entrada ?? "—"} />
                    <Arrow />
                    <FlowNode title="Transformación" subtitle={procesoSel?.transformacion ?? "—"} tone="accent" />
                    <Arrow />
                    <FlowNode title="Salida" subtitle={procesoSel?.salida ?? "—"} />
                  </div>
                </div>
                <div className="mt-8 grid gap-7 lg:grid-cols-2">
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">Condiciones</p>
                    <p className="mt-2 text-xs leading-5 text-primary/50">{procesoSel?.condiciones || "Sin condiciones registradas."}</p>
                  </div>
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">Regla clave / conservación</p>
                    <p className="mt-2 text-xs leading-5 text-primary/50">{procesoSel?.regla_clave || "—"}</p>
                    {procesoSel?.conservacion ? (
                      <p className="mt-2 text-[11px] leading-5 text-primary/40">Conserva: {procesoSel.conservacion}</p>
                    ) : null}
                    {procesoSel?.tipo ? <StatusPill>{procesoSel.tipo}</StatusPill> : null}
                  </div>
                </div>
              </>
            ) : null}

          </section>
        </div>
      </div>
    </main>
  );
}

export default VisualizadorPage;
